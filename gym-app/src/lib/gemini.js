// Cliente minimo para la API de Gemini (Google AI Studio).
// La API key la carga el usuario en Ajustes y queda guardada solo en el telefono.

import { equipmentEs, muscleEs } from './exercises.js';
import { cacheKey, cached } from './aiCache.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

class GeminiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function call(path, apiKey, init = {}) {
  if (!apiKey) throw new Error('Falta la API key de Gemini. Cargala en Ajustes.');
  const res = await fetch(`${BASE}/${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey, ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message ?? `HTTP ${res.status}`;
    throw new GeminiError(`Gemini: ${msg}`, res.status);
  }
  return body;
}

export async function listModels(apiKey) {
  const body = await call('models?pageSize=200', apiKey);
  return (body.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((n) => n.startsWith('gemini'));
}

// ---------- Eleccion de modelo ----------
// Google retira modelos seguido (y a veces solo para usuarios nuevos), asi que
// por defecto ("auto") la app elige el Flash estable mas nuevo que la key tenga
// disponible, y si un modelo deja de andar elige otro y reintenta.

export const AUTO_MODEL = 'auto';
const AUTO_KEY = 'gym.autoModel';
const EXCLUDE = /lite|image|tts|audio|live|embed|vision|thinking|exp|preview|learnlm|robotics|computer/;
const unavailable = new Set(); // modelos que fallaron en esta sesion

export function pickBestModel(models) {
  const usable = models.filter((m) => !unavailable.has(m));
  const version = (m) => Number(m.match(/^gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0);
  const byVersion = (a, b) => version(b) - version(a);
  const stableFlash = usable.filter((m) => /^gemini-\d+(\.\d+)?-flash$/.test(m)).sort(byVersion);
  if (stableFlash.length) return stableFlash[0];
  if (usable.includes('gemini-flash-latest')) return 'gemini-flash-latest';
  // Un Flash en preview antes que un Pro: mas rapido y con mas cuota gratuita.
  const anyFlash = usable
    .filter((m) => m.includes('flash') && !/lite|image|tts|audio|live|embed|thinking/.test(m))
    .sort(byVersion);
  if (anyFlash.length) return anyFlash[0];
  const any = usable.filter((m) => !EXCLUDE.test(m)).sort(byVersion);
  return any[0] ?? usable[0] ?? null;
}

async function resolveModel(settings, { refresh = false } = {}) {
  const chosen = settings.model && settings.model !== AUTO_MODEL ? settings.model : null;
  if (chosen && !unavailable.has(chosen)) return chosen;
  if (!refresh) {
    try {
      const saved = localStorage.getItem(AUTO_KEY);
      if (saved && !unavailable.has(saved)) return saved;
    } catch {
      // sin almacenamiento
    }
  }
  const best = pickBestModel(await listModels(settings.apiKey));
  if (!best) throw new Error('Tu API key no tiene ningún modelo de Gemini disponible.');
  try {
    localStorage.setItem(AUTO_KEY, best);
  } catch {
    // sin almacenamiento
  }
  return best;
}

// Errores que indican que el modelo no existe o fue retirado (no de cuota ni de key).
const isModelGone = (e) =>
  e instanceof GeminiError &&
  (e.status === 404 || /no longer available|not found|not supported|deprecated|retired/i.test(e.message));

async function generateJson(settings, prompt, temperature = 0.6) {
  let model = await resolveModel(settings);
  for (let attempt = 0; ; attempt++) {
    try {
      return await generateWith(settings.apiKey, model, prompt, temperature);
    } catch (e) {
      if (!isModelGone(e) || attempt >= 2) throw e;
      unavailable.add(model);
      // Si era un modelo elegido a mano, volver a "auto" para las proximas veces.
      if (settings.model === model) {
        try {
          const stored = JSON.parse(localStorage.getItem('gym.settings') ?? '{}');
          localStorage.setItem('gym.settings', JSON.stringify({ ...stored, model: AUTO_MODEL }));
        } catch {
          // sin almacenamiento
        }
      }
      model = await resolveModel({ ...settings, model: AUTO_MODEL }, { refresh: true });
    }
  }
}

async function generateWith(apiKey, model, prompt, temperature) {
  const body = await call(`models/${encodeURIComponent(model)}:generateContent`, apiKey, {
    method: 'POST',
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature },
    }),
  });
  const cand = body.candidates?.[0];
  const text = cand?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) {
    const reason = cand?.finishReason ?? body.promptFeedback?.blockReason ?? 'respuesta vacía';
    throw new Error(`Gemini no devolvió contenido (${reason}).`);
  }
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw new Error('Gemini devolvió un JSON inválido. Probá de nuevo.');
  }
}

// Catalogo compacto que se le pasa a Gemini para que elija ejercicios que
// existen en la base (asi siempre hay imagenes para mostrar).
function catalog(exercises) {
  return exercises
    .map((e) => `${e.id} | ${e.primaryMuscles.join(',')} | ${e.equipment} | ${e.category}`)
    .join('\n');
}

const ACTIVITY_ES = {
  sedentario: 'sedentario (no hace actividad física)',
  ligero: 'actividad ligera (1-2 veces por semana)',
  moderado: 'actividad moderada (3-4 veces por semana)',
  alto: 'muy activo (5 o más veces por semana)',
};

function profileText(p) {
  return [
    `- Edad: ${p.age} años`,
    `- Sexo: ${p.sex}`,
    `- Peso: ${p.weight} kg`,
    `- Altura: ${p.height} cm`,
    `- Nivel de actividad actual: ${ACTIVITY_ES[p.activity] ?? p.activity}`,
    `- Experiencia entrenando con pesas: ${p.experience}`,
    p.otherSports ? `- Otros deportes que practica: ${p.otherSports}` : null,
    `- Equipamiento disponible: ${p.equipment.map(equipmentEs).join(', ')}`,
    p.injuries ? `- Lesiones o limitaciones: ${p.injuries}` : '- Lesiones o limitaciones: ninguna informada',
    p.avoid ? `- Ejercicios que no quiere hacer: ${p.avoid}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function generatePlan(settings, profile, request, exercises) {
  const available = exercises.filter((e) => profile.equipment.includes(e.equipment));
  const prompt = `Sos un entrenador personal certificado y con criterio basado en evidencia.
Armá un plan de entrenamiento de gimnasio en español rioplatense para esta persona.

PERFIL
${profileText(profile)}

PEDIDO
- Objetivo principal: ${request.goal}
- Días por semana que va a entrenar: ${request.daysPerWeek}
- Tiempo disponible por sesión: ${request.minutesPerSession} minutos (incluyendo calentamiento)
${request.focus ? `- Prioridades / zonas a enfatizar: ${request.focus}` : ''}
${request.notes ? `- Comentarios adicionales: ${request.notes}` : ''}

REGLAS
- Exactamente ${request.daysPerWeek} días de entrenamiento.
- Cada sesión tiene que entrar en ${request.minutesPerSession} minutos: estimá ~2-3 min por serie incluyendo descanso, más el calentamiento. No pongas más ejercicios de los que entran.
- Elegí la división (full body, torso/pierna, empuje/tirón/pierna, etc.) según días, tiempo, experiencia y objetivo.
- Respetá las lesiones/limitaciones: evitá ejercicios que las comprometan.
- Usá SOLO ejercicios del CATÁLOGO, copiando el "exerciseId" exactamente como aparece (primera columna).
- "nombre" es el nombre del ejercicio en español, como se lo conoce en un gimnasio de Argentina.
- "repeticiones" es texto (ej. "8-10", "12 por lado", "30 s").

Respondé SOLO con JSON con esta forma:
{
  "nombre": string,
  "resumen": string,               // 2-4 oraciones: división elegida y por qué
  "dias": [{
    "nombre": string,              // ej. "Día 1 · Torso"
    "enfoque": string,
    "duracionMin": number,
    "calentamiento": string,
    "ejercicios": [{
      "exerciseId": string,
      "nombre": string,
      "series": number,
      "repeticiones": string,
      "descansoSeg": number,
      "notas": string              // técnica o intensidad (RIR/RPE), corto
    }],
    "vueltaCalma": string
  }],
  "progresion": string,            // cómo progresar semana a semana
  "advertencias": string           // precauciones según el perfil; "" si no hay
}

CATÁLOGO (exerciseId | músculos principales | equipamiento | categoría)
${catalog(available)}`;

  return generateJson(settings, prompt, 0.7);
}

export async function suggestAlternatives(settings, profile, exercise, reason, exercises) {
  const main = exercise.primaryMuscles[0];
  const pool = exercises.filter(
    (e) => e.id !== exercise.id && e.primaryMuscles.includes(main) && e.category !== 'stretching',
  );
  const prompt = `Sos entrenador personal. En un plan de gimnasio hay que reemplazar el ejercicio "${exercise.name}" (id ${exercise.id}, músculo principal: ${muscleEs(main)}, equipo: ${equipmentEs(exercise.equipment)}).
Motivo: ${reason || 'la máquina o el equipo no está disponible en el gimnasio'}.
Equipamiento disponible de la persona: ${profile.equipment.map(equipmentEs).join(', ')}.
${profile.injuries ? `Lesiones/limitaciones: ${profile.injuries}.` : ''}

Elegí hasta 5 reemplazos del CATÁLOGO que trabajen el mismo músculo con un estímulo lo más parecido posible, ordenados de mejor a peor. Copiá el exerciseId exacto.
Respondé SOLO JSON: {"alternativas":[{"exerciseId": string, "nombre": string, "motivo": string}]}
"nombre" en español; "motivo" una oración corta.

CATÁLOGO (exerciseId | músculos | equipamiento | categoría)
${catalog(pool)}`;

  const key = cacheKey('alt', exercise.id, reason, [...profile.equipment].sort().join(','), profile.injuries);
  const res = await cached(key, () => generateJson(settings, prompt, 0.4));
  return res.alternativas ?? [];
}

export async function aiSearch(settings, query, exercises) {
  const prompt = `El usuario busca un ejercicio de gimnasio escribiendo: "${query}" (puede estar en español, con jerga de gimnasio argentino o mal escrito).
Devolvé hasta 8 ejercicios del CATÁLOGO que mejor correspondan, del más al menos parecido, copiando el exerciseId exacto.
Respondé SOLO JSON: {"resultados":[{"exerciseId": string, "nombre": string}]} con "nombre" en español.

CATÁLOGO (exerciseId | músculos | equipamiento | categoría)
${catalog(exercises)}`;
  const res = await cached(cacheKey('search', query), () => generateJson(settings, prompt, 0.2));
  return res.resultados ?? [];
}

export async function translateInstructions(settings, exercise) {
  const prompt = `Traducí al español rioplatense, de forma clara y breve, el nombre y los pasos de este ejercicio de gimnasio. Mantené la numeración de pasos.
Nombre: ${exercise.name}
Pasos:
${exercise.instructions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Respondé SOLO JSON: {"nombre": string, "pasos": [string]}`;
  return cached(cacheKey('tr', exercise.id), () => generateJson(settings, prompt, 0.2));
}
