// Base de ejercicios: free-exercise-db (dominio publico).
// Cada ejercicio trae 2 fotos (posicion inicial y final) que la app alterna
// para mostrar el movimiento.

export const IMAGE_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

export const imageUrls = (ex) => (ex?.images ?? []).map((p) => IMAGE_BASE + p);

export const MUSCLES_ES = {
  abdominals: 'Abdominales',
  abductors: 'Abductores',
  adductors: 'Aductores',
  biceps: 'Bíceps',
  calves: 'Gemelos',
  chest: 'Pecho',
  forearms: 'Antebrazos',
  glutes: 'Glúteos',
  hamstrings: 'Isquiotibiales',
  lats: 'Dorsales',
  'lower back': 'Zona lumbar',
  'middle back': 'Espalda media',
  neck: 'Cuello',
  quadriceps: 'Cuádriceps',
  shoulders: 'Hombros',
  traps: 'Trapecios',
  triceps: 'Tríceps',
};

export const EQUIPMENT_ES = {
  barbell: 'Barra',
  dumbbell: 'Mancuernas',
  'e-z curl bar': 'Barra Z',
  cable: 'Polea',
  machine: 'Máquina',
  kettlebells: 'Pesa rusa',
  bands: 'Bandas elásticas',
  'medicine ball': 'Balón medicinal',
  'exercise ball': 'Pelota suiza',
  'foam roll': 'Rodillo de espuma',
  'body only': 'Peso corporal',
  other: 'Otro (barra fija, banco, etc.)',
};

export const LEVEL_ES = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  expert: 'Avanzado',
};

export const CATEGORY_ES = {
  strength: 'Fuerza',
  stretching: 'Estiramiento',
  plyometrics: 'Pliometría',
  powerlifting: 'Powerlifting',
  'olympic weightlifting': 'Halterofilia',
  strongman: 'Strongman',
  cardio: 'Cardio',
};

export const ALL_EQUIPMENT = Object.keys(EQUIPMENT_ES);

export const muscleEs = (m) => MUSCLES_ES[m] ?? m;
export const equipmentEs = (e) => EQUIPMENT_ES[e] ?? e;

let cache = null;
let byId = null;

export async function loadExercises() {
  if (cache) return cache;
  const res = await fetch('./exercises.json');
  if (!res.ok) throw new Error('No se pudo cargar la base de ejercicios');
  cache = await res.json();
  byId = new Map(cache.map((e) => [e.id, e]));
  return cache;
}

export const getExercise = (id) => byId?.get(id) ?? null;

// ---------- Busqueda en español ----------

const normalize = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Frases en español -> terminos en ingles de la base. Se aplican de la mas
// larga a la mas corta, asi "press de banca inclinado" gana sobre "press".
const DICTIONARY = [
  ['press de banca', 'bench press'],
  ['press banca', 'bench press'],
  ['press de pecho', 'chest press'],
  ['press militar', 'military press'],
  ['press de hombros', 'shoulder press'],
  ['press de hombro', 'shoulder press'],
  ['press frances', 'lying triceps extension'],
  ['peso muerto rumano', 'romanian deadlift'],
  ['peso muerto', 'deadlift'],
  ['buenos dias', 'good morning'],
  ['jalon al pecho', 'pulldown'],
  ['jalon', 'pulldown'],
  ['remo con barra', 'bent over barbell row'],
  ['prensa de piernas', 'leg press'],
  ['prensa', 'leg press'],
  ['extension de piernas', 'leg extensions'],
  ['extensiones de piernas', 'leg extensions'],
  ['extension de cuadriceps', 'leg extensions'],
  ['sillon de cuadriceps', 'leg extensions'],
  ['curl femoral', 'leg curl'],
  ['curl de piernas', 'leg curl'],
  ['curl martillo', 'hammer curl'],
  ['elevaciones laterales', 'lateral raise'],
  ['elevacion lateral', 'lateral raise'],
  ['elevaciones frontales', 'front raise'],
  ['elevacion frontal', 'front raise'],
  ['elevacion de talones', 'calf raise'],
  ['elevaciones de talones', 'calf raise'],
  ['elevacion de piernas', 'leg raise'],
  ['elevaciones de piernas', 'leg raise'],
  ['vuelos laterales', 'lateral raise'],
  ['pajaros', 'reverse fly'],
  ['face pull', 'face pull'],
  ['hip thrust', 'hip thrust'],
  ['empuje de cadera', 'hip thrust'],
  ['puente de gluteos', 'glute bridge'],
  ['patada de gluteo', 'glute kickback'],
  ['fondos en paralelas', 'dips'],
  ['flexiones de brazos', 'push-up'],
  ['lagartijas', 'push-up'],
  ['flexiones', 'push-up'],
  ['dominadas', 'pull-up'],
  ['dominada', 'pull-up'],
  ['sentadilla bulgara', 'split squat'],
  ['sentadilla hack', 'hack squat'],
  ['sentadillas', 'squat'],
  ['sentadilla', 'squat'],
  ['zancadas', 'lunge'],
  ['zancada', 'lunge'],
  ['estocadas', 'lunge'],
  ['estocada', 'lunge'],
  ['aperturas', 'fly'],
  ['apertura', 'fly'],
  ['cruce de poleas', 'cable crossover'],
  ['crossover', 'crossover'],
  ['pullover', 'pullover'],
  ['encogimientos', 'shrug'],
  ['encogimiento', 'shrug'],
  ['remo', 'row'],
  ['fondos', 'dips'],
  ['plancha', 'plank'],
  ['abdominales', 'crunch'],
  ['abdominal', 'crunch'],
  ['patada de triceps', 'kickback'],
  ['extension de triceps', 'triceps extension'],
  ['extensiones de triceps', 'triceps extension'],
  ['mancuernas', 'dumbbell'],
  ['mancuerna', 'dumbbell'],
  ['barra z', 'ez-bar'],
  ['barra', 'barbell'],
  ['poleas', 'cable'],
  ['polea', 'cable'],
  ['maquina', 'machine'],
  ['pesa rusa', 'kettlebell'],
  ['banda', 'band'],
  ['bandas', 'band'],
  ['inclinado', 'incline'],
  ['inclinada', 'incline'],
  ['declinado', 'decline'],
  ['declinada', 'decline'],
  ['sentado', 'seated'],
  ['sentada', 'seated'],
  ['de pie', 'standing'],
  ['acostado', 'lying'],
  ['agarre cerrado', 'close-grip'],
  ['agarre ancho', 'wide-grip'],
  ['inverso', 'reverse'],
  ['inversa', 'reverse'],
  ['frontal', 'front'],
  ['lateral', 'lateral'],
  ['pecho', 'chest'],
  ['pectoral', 'chest'],
  ['espalda', 'back'],
  ['dorsales', 'lats'],
  ['dorsal', 'lats'],
  ['hombros', 'shoulders'],
  ['hombro', 'shoulder'],
  ['biceps', 'biceps'],
  ['triceps', 'triceps'],
  ['cuadriceps', 'quadriceps'],
  ['isquiotibiales', 'hamstrings'],
  ['femorales', 'hamstrings'],
  ['femoral', 'hamstrings'],
  ['gluteos', 'glutes'],
  ['gluteo', 'glute'],
  ['gemelos', 'calf'],
  ['pantorrillas', 'calf'],
  ['pantorrilla', 'calf'],
  ['antebrazos', 'forearms'],
  ['antebrazo', 'forearm'],
  ['trapecios', 'traps'],
  ['trapecio', 'traps'],
  ['lumbares', 'lower back'],
  ['lumbar', 'lower back'],
  ['aductores', 'adductors'],
  ['abductores', 'abductors'],
  ['piernas', 'leg'],
  ['pierna', 'leg'],
  ['brazos', 'arm'],
  ['cuello', 'neck'],
  ['estiramiento', 'stretch'],
  ['saltos', 'jump'],
  ['salto', 'jump'],
].sort((a, b) => b[0].length - a[0].length);

const STOPWORDS = new Set(['de', 'del', 'con', 'en', 'la', 'el', 'al', 'a', 'para', 'y', 'los', 'las', 'en', 'un', 'una']);

export function translateQuery(query) {
  let q = ` ${normalize(query)} `;
  for (const [es, en] of DICTIONARY) {
    q = q.replace(new RegExp(` ${es} `, 'g'), ` ${en} `);
  }
  return q.trim();
}

function haystack(ex) {
  return {
    name: normalize(ex.name),
    extra: normalize(
      [...ex.primaryMuscles, ...ex.secondaryMuscles, ex.equipment, ex.category].join(' '),
    ),
  };
}

export function searchExercises(all, query, { limit = 40 } = {}) {
  const translated = translateQuery(query);
  const tokens = translated.split(' ').filter((t) => t && !STOPWORDS.has(t));
  if (!tokens.length) return [];

  const scored = [];
  for (const ex of all) {
    const h = haystack(ex);
    let score = 0;
    let matched = 0;
    for (const t of tokens) {
      const stem = t.length > 4 ? t.replace(/s$/, '') : t;
      if (h.name.includes(stem)) {
        score += 3;
        if (new RegExp(`(^|[\\s-])${stem}`).test(h.name)) score += 1;
        matched++;
      } else if (h.extra.includes(stem)) {
        score += 1;
        matched++;
      }
    }
    if (!matched) continue;
    // Priorizar los que cumplen todos los terminos.
    if (matched === tokens.length) score += 5;
    if (ex.category === 'strength') score += 0.5;
    score -= h.name.length / 200; // a igualdad, nombres mas cortos (mas genericos)
    scored.push({ ex, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.ex);
}

// ---------- Alternativas para el mismo musculo ----------

export function findAlternatives(all, exercise, { equipment = ALL_EQUIPMENT, limit = 30 } = {}) {
  if (!exercise) return [];
  const main = exercise.primaryMuscles[0];
  const allowed = new Set(equipment);
  const candidates = all.filter(
    (e) =>
      e.id !== exercise.id &&
      e.primaryMuscles.includes(main) &&
      e.category !== 'stretching' &&
      allowed.has(e.equipment),
  );
  // Parecido al original: mismo patron (empuje/tiron), mismos musculos
  // secundarios y mismo tipo (compuesto/aislado).
  const secondary = new Set(exercise.secondaryMuscles);
  const score = (e) =>
    (e.primaryMuscles[0] === main ? 4 : 0) +
    (e.force && e.force === exercise.force ? 2 : 0) +
    (e.mechanic === exercise.mechanic ? 2 : 0) +
    Math.min(2, e.secondaryMuscles.filter((m) => secondary.has(m)).length) +
    (e.category === exercise.category ? 1 : 0) +
    (e.level === exercise.level ? 0.5 : 0);
  return candidates.sort((a, b) => score(b) - score(a)).slice(0, limit);
}

// Mejor coincidencia para un id/nombre que devolvio Gemini (por si lo escribe mal).
export function resolveExercise(all, id, name) {
  if (id) {
    const exact = getExercise(id);
    if (exact) return exact;
    const n = normalize(id.replace(/_/g, ' '));
    const byName = all.find((e) => normalize(e.name) === n || normalize(e.id.replace(/_/g, ' ')) === n);
    if (byName) return byName;
  }
  if (name) return searchExercises(all, name, { limit: 1 })[0] ?? null;
  return null;
}
