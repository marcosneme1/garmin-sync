// Persistencia local (localStorage dentro del WebView de Android).
// Todo queda en el telefono: perfil, planes y la API key de Gemini.

const KEYS = {
  profile: 'gym.profile',
  plans: 'gym.plans',
  activePlanId: 'gym.activePlanId',
  settings: 'gym.settings',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin almacenamiento disponible: la app sigue funcionando en memoria.
  }
}

// model 'auto': la app elige el mejor modelo disponible para la key (ver gemini.js).
export const DEFAULT_SETTINGS = { apiKey: '', model: 'auto' };

export const storage = {
  getProfile: () => read(KEYS.profile, null),
  setProfile: (p) => write(KEYS.profile, p),
  getPlans: () => read(KEYS.plans, []),
  setPlans: (plans) => write(KEYS.plans, plans),
  getActivePlanId: () => read(KEYS.activePlanId, null),
  setActivePlanId: (id) => write(KEYS.activePlanId, id),
  getSettings: () => ({ ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) }),
  setSettings: (s) => write(KEYS.settings, s),
};
