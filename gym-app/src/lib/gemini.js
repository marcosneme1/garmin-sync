// Cliente minimo para la API de Gemini (Google AI Studio).
// La API key la carga el usuario en Ajustes y queda guardada solo en el telefono.

import { equipmentEs, muscleEs } from './exercises.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

async function call(path, apiKey, init = {}) {
  if (!apiKey) throw new Error('Falta la API key de Gemini. Cargala en Ajustes.');
  const res = await fetch(`${BASE}/${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey, ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Gemini: ${msg}`);
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

async function generateJson({ apiKey, model }, prompt, temperature = 0.6) {
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

  const res = await generateJson(settings, prompt, 0.4);
  return res.alternativas ?? [];
}

export async function aiSearch(settings, query, exercises) {
  const prompt = `El usuario busca un ejercicio de gimnasio escribiendo: "${query}" (puede estar en español, con jerga de gimnasio argentino o mal escrito).
Devolvé hasta 8 ejercicios del CATÁLOGO que mejor correspondan, del más al menos parecido, copiando el exerciseId exacto.
Respondé SOLO JSON: {"resultados":[{"exerciseId": string, "nombre": string}]} con "nombre" en español.

CATÁLOGO (exerciseId | músculos | equipamiento | categoría)
${catalog(exercises)}`;
  const res = await generateJson(settings, prompt, 0.2);
  return res.resultados ?? [];
}

export async function translateInstructions(settings, exercise) {
  const prompt = `Traducí al español rioplatense, de forma clara y breve, el nombre y los pasos de este ejercicio de gimnasio. Mantené la numeración de pasos.
Nombre: ${exercise.name}
Pasos:
${exercise.instructions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Respondé SOLO JSON: {"nombre": string, "pasos": [string]}`;
  return generateJson(settings, prompt, 0.2);
}
