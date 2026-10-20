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

// La conexion se corto antes de recibir respuesta (sin internet, cambio de
// WiFi a datos, o Android corto la red porque la app quedo en segundo plano).
// En Android aparece como "Software caused connection abort".
class NetworkError extends Error {
  // cause: el error original; startedAt: cuando arranco el pedido. Se muestran
  // en el mensaje para poder distinguir un bloqueo (corta enseguida) de una
  // conexion que se corta por esperar demasiado (corta siempre al mismo tiempo).
  constructor(cause, startedAt) {
    const secs = startedAt ? Math.round((Date.now() - startedAt) / 1000) : null;
    const detail = [cause?.message, secs !== null ? `se cortó a los ${secs} s` : null].filter(Boolean).join(', ');
    super(
      'Se cortó la conexión con Gemini antes de recibir la respuesta. Suele pasar si se va internet, si el celular cambia entre WiFi y datos, o si salís de la app (o se apaga la pantalla) mientras espera. Probá de nuevo y dejá la app abierta hasta que termine.' +
        (detail ? ` (Detalle: ${detail}.)` : ''),
    );
    this.network = true;
  }
}

async function send(path, apiKey, init = {}) {
  if (!apiKey) throw new Error('Falta la API key de Gemini. Cargala en Ajustes.');
  const startedAt = Date.now();
  try {
    return await fetch(`${BASE}/${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey, ...init.headers },
    });
  } catch (e) {
    throw new NetworkError(e, startedAt);
  }
}

const errorFrom = (body, status) => {
  const err = Array.isArray(body) ? body[0]?.error : body?.error;
  return new GeminiError(`Gemini: ${err?.message ?? `HTTP ${status}`}`, err?.code ?? status);
};

async function call(path, apiKey, init = {}) {
  const res = await send(path, apiKey, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw errorFrom(body, res.status);
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

// Saturacion o limite de uso: suele ser temporal y por modelo, asi que se
// reintenta y, si sigue, se prueba con otro modelo disponible.
const isBusy = (e) =>
  e instanceof GeminiError &&
  (e.status === 503 || e.status === 429 || /high demand|overloaded|try again later|resource.?exhausted/i.test(e.message));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Orden de modelos alternativos cuando el elegido esta saturado.
export function fallbackOrder(models) {
  const version = (m) => Number(m.match(/^gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0);
  const groups = [
    (m) => /^gemini-\d+(\.\d+)?-flash$/.test(m),
    (m) => m === 'gemini-flash-latest',
    (m) => m.includes('flash') && !/lite|image|tts|audio|live|embed|thinking/.test(m),
    (m) => /flash-lite/.test(m) && !/image|tts|audio|live|preview|exp/.test(m),
    (m) => !EXCLUDE.test(m),
  ];
  const out = [];
  for (const g of groups) {
    for (const m of models.filter(g).sort((a, b) => version(b) - version(a))) {
      if (!out.includes(m)) out.push(m);
    }
  }
  return out;
}

async function generateJson(settings, prompt, temperature = 0.6) {
  let model = await resolveModel(settings);
  let goneRetries = 0;
  let sameRetries = 0;
  let netRetries = 0;
  const busy = new Set();
  let models = null;
  for (;;) {
    try {
      return await generateWith(settings.apiKey, model, prompt, temperature);
    } catch (e) {
      if (isModelGone(e) && goneRetries < 2) {
        goneRetries++;
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
        continue;
      }
      if (e.network) {
        // Un corte de conexion suele ser momentaneo: reintentar una vez.
        if (netRetries++ < 1) {
          await sleep(2000);
          continue;
        }
        throw e;
      }
      if (!isBusy(e)) throw e;
      // Saturacion: esperar y reintentar el mismo modelo (mas paciencia con
      // el primero), y despues probar con otros modelos disponibles.
      const waits = busy.size === 0 ? [3000, 8000] : [4000];
      if (sameRetries < waits.length) {
        await sleep(waits[sameRetries++]);
        continue;
      }
      sameRetries = 0;
      busy.add(model);
      models ??= await listModels(settings.apiKey).catch(() => []);
      const next = fallbackOrder(models).find((m) => !busy.has(m) && !unavailable.has(m));
      if (!next || busy.size >= 5) {
        throw new Error(
          e.status === 429
            ? 'Se alcanzó el límite de uso gratuito de Gemini de tu API key por ahora. Probá de nuevo más tarde.'
            : 'Gemini está saturado en este momento (es un problema temporal de Google, no de tu key ni de la app). Probá de nuevo en unos minutos.',
        );
      }
      model = next; // solo para esta consulta; no se guarda como preferido
    }
  }
}

// Se pide la respuesta en modo streaming (SSE): Gemini la va mandando a
// medida que la escribe. Asi la conexion no queda "callada" mientras se arma
// un plan largo; en datos moviles una conexion sin trafico por mas de ~1 min
// suele cortarse ("Software caused connection abort").
async function generateWith(apiKey, model, prompt, temperature) {
  const startedAt = Date.now();
  const res = await send(`models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, apiKey, {
    method: 'POST',
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature },
    }),
  });
  let raw;
  try {
    raw = await res.text();
  } catch (e) {
    throw new NetworkError(e, startedAt);
  }
  if (!res.ok) {
    let body = {};
    try {
      body = JSON.parse(raw);
    } catch {
      // cuerpo no JSON
    }
    throw errorFrom(body, res.status);
  }

  // Cada evento es una linea "data: {...}" con un pedazo del texto. Si por
  // algun motivo llega como JSON comun (objeto o lista), tambien se acepta.
  let chunks = raw
    .split(/\r?\n/)
    .filter((l) => l.startsWith('data:'))
    .map((l) => {
      try {
        return JSON.parse(l.slice(5).trim());
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  if (!chunks.length) {
    try {
      const body = JSON.parse(raw);
      chunks = Array.isArray(body) ? body : [body];
    } catch {
      chunks = [];
    }
  }

  let text = '';
  let reason = '';
  for (const c of chunks) {
    if (c.error) throw errorFrom(c, c.error.code);
    const cand = c.candidates?.[0];
    text += cand?.content?.parts?.map((p) => (p.thought ? '' : p.text ?? '')).join('') ?? '';
    reason = cand?.finishReason ?? c.promptFeedback?.blockReason ?? reason;
  }
  if (!text) throw new Error(`Gemini no devolvió contenido (${reason || 'respuesta vacía'}).`);
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw new Error(
      reason === 'MAX_TOKENS'
        ? 'La respuesta de Gemini quedó cortada por larga. Probá con menos ejercicios por día.'
        : 'Gemini devolvió un JSON inválido. Probá de nuevo.',
    );
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

// Cuantos ejercicios por dia entran en el tiempo disponible. Se calcula con
// ~8 min por ejercicio de 3 series con descanso (10 min si el objetivo es
// fuerza, por los descansos largos; 6,5 si es perder grasa o resistencia),
// descontando el calentamiento.
export function exerciseRange(minutes, goal = '') {
  const perExercise = /fuerza/i.test(goal) ? 10 : /grasa|resistencia/i.test(goal) ? 6.5 : 8;
  const usable = minutes - (minutes >= 60 ? 10 : 7);
  const n = usable / perExercise;
  const max = Math.min(10, Math.max(4, Math.ceil(n) === Math.floor(n) ? n + 1 : Math.ceil(n)));
  const min = Math.min(max, Math.max(3, Math.floor(n)));
  return { min, max };
}

export async function generatePlan(settings, profile, request, exercises) {
  const available = exercises.filter((e) => profile.equipment.includes(e.equipment));
  const fixed = Number(request.exercisesPerDay) || 0;
  const { min, max } = fixed ? { min: fixed, max: fixed } : exerciseRange(request.minutesPerSession, request.goal);
  const amount = min === max ? `exactamente ${min}` : `entre ${min} y ${max}`;
  const prompt = `Sos un entrenador personal certificado y con criterio basado en evidencia.
Armá un plan de entrenamiento de gimnasio en español rioplatense para esta persona.

PERFIL
${profileText(profile)}

PEDIDO
- Objetivo principal: ${request.goal}
- Días por semana que va a entrenar: ${request.daysPerWeek}
- Tiempo disponible por sesión: ${request.minutesPerSession} minutos (incluyendo calentamiento)
${request.focus ? `- Prioridades y comentarios de la persona (MUY IMPORTANTE, el plan tiene que reflejarlos): ${request.focus}` : ''}

REGLAS
- Exactamente ${request.daysPerWeek} días de entrenamiento.
- Cada día tiene que tener ${amount} ejercicios (sin contar el calentamiento ni la vuelta a la calma). Es un requisito, no un máximo.
- La sesión tiene que ocupar los ${request.minutesPerSession} minutos: usá 3 series por ejercicio (4 en los multiarticulares principales) y descansos acordes al objetivo. No armes sesiones más cortas que el tiempo disponible.
- Elegí la división (full body, torso/pierna, empuje/tirón/pierna, etc.) según días, tiempo, experiencia y objetivo.
- Respetá las lesiones/limitaciones: evitá ejercicios que las comprometan.
- Si la persona dejó prioridades o comentarios, adaptá el plan a cada uno (zonas a priorizar, tiempos por día, equipamiento, molestias, otros deportes) y mencioná en el resumen cómo los tuviste en cuenta.
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

  const plan = await generateJson(settings, prompt, 0.7);
  // Gemini a veces se queda corto: si algun dia tiene menos ejercicios de los
  // pedidos, se lo vuelve a pedir una vez marcandole el error.
  const tooFew = (p) => (p.dias ?? []).some((d) => (d.ejercicios ?? []).length < min);
  if (!tooFew(plan)) return plan;
  const counts = plan.dias.map((d) => (d.ejercicios ?? []).length).join(', ');
  const retry = await generateJson(
    settings,
    `${prompt}\n\nIMPORTANTE: en un intento anterior armaste días con ${counts} ejercicios. Cada día tiene que tener ${amount} ejercicios.`,
    0.7,
  ).catch(() => null);
  return retry && !tooFew(retry) ? retry : plan;
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

// Plan del mes siguiente: misma estructura (dias, enfoque, musculos y
// cantidad de ejercicios) pero con ejercicios nuevos. mode 'basics' mantiene
// los basicos multiarticulares para seguir progresando en peso; 'all' cambia
// todos.
export async function renewPlan(settings, profile, plan, mode, exercises) {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const available = exercises.filter((e) => profile.equipment.includes(e.equipment));
  const request = plan.request ?? {};
  const current = plan.dias
    .map((d, i) => {
      const lines = d.ejercicios.map((it) => {
        const ex = byId.get(it.exerciseId);
        const muscles = ex ? ex.primaryMuscles.map(muscleEs).join(', ') : '?';
        return `  - ${it.exerciseId ?? '?'} | ${it.nombre} | ${muscles} | ${it.series}x${it.repeticiones}`;
      });
      return `Día ${i + 1}: "${d.nombre}" (${d.enfoque || 'sin enfoque'})\n${lines.join('\n')}`;
    })
    .join('\n\n');
  const changeRule =
    mode === 'all'
      ? '- Reemplazá TODOS los ejercicios por otros distintos (otro exerciseId) que trabajen el mismo músculo principal.'
      : '- Mantené los ejercicios básicos multiarticulares (sentadilla, peso muerto, press de banca, press militar, remo, dominadas y similares; como máximo 2 por día) con el mismo exerciseId, para que la persona siga progresando en peso. Reemplazá todos los demás por otros distintos (otro exerciseId) que trabajen el mismo músculo principal.';

  const prompt = `Sos un entrenador personal certificado y con criterio basado en evidencia.
Esta persona terminó un ciclo con el plan de abajo y quiere el plan del mes siguiente, en español rioplatense: la MISMA estructura con ejercicios nuevos.

PERFIL
${profileText(profile)}

PEDIDO ORIGINAL
- Objetivo principal: ${request.goal ?? ''}
- Días por semana: ${request.daysPerWeek ?? plan.dias.length}
- Tiempo por sesión: ${request.minutesPerSession ?? ''} minutos
${request.focus ? `- Prioridades y comentarios de la persona (MUY IMPORTANTE, el plan tiene que reflejarlos): ${request.focus}` : ''}

PLAN ACTUAL (exerciseId | nombre | músculo principal | series x repeticiones)
${current}

REGLAS
- Mismos días, en el mismo orden, con el mismo nombre y enfoque.
- Cada día tiene que tener la misma cantidad de ejercicios que en el plan actual, trabajando los mismos músculos.
${changeRule}
- Podés ajustar series, repeticiones y descansos para dar un estímulo nuevo, acorde al objetivo.
- Respetá las lesiones/limitaciones y los comentarios de la persona.
- Usá SOLO ejercicios del CATÁLOGO, copiando el "exerciseId" exactamente como aparece (primera columna).
- "nombre" es el nombre del ejercicio en español, como se lo conoce en un gimnasio de Argentina.
- "repeticiones" es texto (ej. "8-10", "12 por lado", "30 s").
- En "resumen" contá en 2-3 oraciones qué cambió y por qué.

Respondé SOLO con JSON con esta forma:
{
  "nombre": string,
  "resumen": string,
  "dias": [{
    "nombre": string,
    "enfoque": string,
    "duracionMin": number,
    "calentamiento": string,
    "ejercicios": [{
      "exerciseId": string,
      "nombre": string,
      "series": number,
      "repeticiones": string,
      "descansoSeg": number,
      "notas": string
    }],
    "vueltaCalma": string
  }],
  "progresion": string,
  "advertencias": string
}

CATÁLOGO (exerciseId | músculos | equipamiento | categoría)
${catalog(available)}`;

  // Control: misma cantidad de ejercicios por dia y que realmente haya cambios.
  const oldIds = new Set(plan.dias.flatMap((d) => d.ejercicios.map((it) => it.exerciseId)));
  const problems = (p) => {
    const dias = p.dias ?? [];
    if (dias.length < plan.dias.length) return 'tenía menos días que el plan actual';
    if (dias.some((d, i) => (d.ejercicios ?? []).length < plan.dias[i].ejercicios.length)) return 'tenía días con menos ejercicios que el plan actual';
    const all = dias.flatMap((d) => (d.ejercicios ?? []).map((e) => e.exerciseId));
    const repeated = all.filter((id) => oldIds.has(id)).length;
    const allowed = mode === 'all' ? 0 : Math.max(2, plan.dias.length * 2);
    if (repeated > allowed) return `repetía ${repeated} ejercicios del plan actual`;
    return null;
  };

  const first = await generateJson(settings, prompt, 0.8);
  const issue = problems(first);
  if (!issue) return first;
  const retry = await generateJson(
    settings,
    `${prompt}\n\nIMPORTANTE: en un intento anterior la respuesta ${issue}. Corregilo respetando todas las reglas.`,
    0.8,
  ).catch(() => null);
  return retry && !problems(retry) ? retry : first;
}

