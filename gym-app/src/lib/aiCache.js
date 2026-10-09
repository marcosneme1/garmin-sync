// Guarda las respuestas de Gemini para no volver a pedir lo mismo
// (busquedas, traducciones, alternativas).

const KEY = 'gym.aiCache';
let cache = null;

function load() {
  if (!cache) {
    try {
      cache = JSON.parse(localStorage.getItem(KEY)) ?? {};
    } catch {
      cache = {};
    }
  }
  return cache;
}

export const cacheKey = (...parts) =>
  parts
    .map((p) =>
      String(p ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .join('|');

export function getCached(key) {
  return load()[key] ?? null;
}

export function setCached(key, value) {
  load()[key] = value;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Sin espacio: seguimos sin guardar.
  }
}

// Ejecuta `fn` solo si no hay una respuesta guardada para `key`.
export async function cached(key, fn) {
  const hit = getCached(key);
  if (hit) return hit;
  const value = await fn();
  setCached(key, value);
  return value;
}

export function clearAiCache() {
  cache = {};
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nada
  }
}
