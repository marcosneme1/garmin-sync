// Registro de entrenamientos: sesion en curso + historial (localStorage).

const KEYS = { history: 'gym.workouts', active: 'gym.activeWorkout' };

const uid = () => Math.random().toString(36).slice(2, 10);

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
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sin almacenamiento
  }
}

export const getHistory = () => read(KEYS.history, []);
export const setHistory = (h) => write(KEYS.history, h);
export const getActiveWorkout = () => read(KEYS.active, null);
export const setActiveWorkout = (w) => write(KEYS.active, w);

export const toNumber = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

// "8-10" -> 8, "12 por lado" -> 12, "30 s" -> 30
export const targetReps = (text) => {
  const m = String(text ?? '').match(/\d+/);
  return m ? m[0] : '';
};

const sameExercise = (a, b) =>
  (a.exerciseId && a.exerciseId === b.exerciseId) || (!a.exerciseId && a.nombre === b.nombre);

// Ultima vez que se hizo este ejercicio (con al menos una serie hecha).
export function lastPerformance(history, item) {
  for (const w of history) {
    const ex = w.exercises.find((e) => sameExercise(e, item) && e.sets.some((s) => s.done));
    if (ex) return { date: w.finishedAt, sets: ex.sets.filter((s) => s.done) };
  }
  return null;
}

export function startWorkout(plan, day, history) {
  return {
    id: uid(),
    planId: plan.id,
    planName: plan.nombre,
    dayId: day.id,
    dayName: day.nombre,
    startedAt: new Date().toISOString(),
    exercises: day.ejercicios.map((it) => newWorkoutExercise(it, history)),
  };
}

export function newWorkoutExercise(it, history) {
  const last = lastPerformance(history, it);
  const sets = Array.from({ length: Math.max(1, it.series || 3) }, (_, i) => ({
    weight: last?.sets[Math.min(i, last.sets.length - 1)]?.weight ?? '',
    reps: '',
    done: false,
  }));
  return {
    id: uid(),
    planItemId: it.id,
    exerciseId: it.exerciseId,
    nombre: it.nombre,
    target: { series: it.series, repeticiones: it.repeticiones, descansoSeg: it.descansoSeg },
    sets,
  };
}

export const doneSets = (w) => w.exercises.flatMap((e) => e.sets.filter((s) => s.done));

export const volumeKg = (w) =>
  Math.round(doneSets(w).reduce((acc, s) => acc + toNumber(s.weight) * toNumber(s.reps), 0));

// 1RM estimado (Epley). Solo orientativo; poco fiable por encima de ~12 reps.
export const estimated1RM = (weight, reps) => {
  const w = toNumber(weight);
  const r = toNumber(reps);
  if (!w || !r) return 0;
  return r === 1 ? w : Math.round(w * (1 + r / 30) * 10) / 10;
};

export function finishWorkout(w) {
  const finishedAt = new Date().toISOString();
  return {
    ...w,
    finishedAt,
    durationMin: Math.max(1, Math.round((new Date(finishedAt) - new Date(w.startedAt)) / 60000)),
    // No guardar ejercicios sin ninguna serie hecha.
    exercises: w.exercises
      .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
      .filter((e) => e.sets.length),
  };
}

// Serie por ejercicio para el grafico de progreso (mas viejo -> mas nuevo).
export function exerciseProgress(history, key) {
  const points = [];
  for (const w of [...history].reverse()) {
    const ex = w.exercises.find((e) => (e.exerciseId ?? e.nombre) === key);
    if (!ex) continue;
    const best = ex.sets.reduce(
      (b, s) => (toNumber(s.weight) > toNumber(b.weight) ? s : b),
      ex.sets[0],
    );
    points.push({
      date: w.finishedAt,
      weight: toNumber(best.weight),
      reps: toNumber(best.reps),
      e1rm: Math.max(...ex.sets.map((s) => estimated1RM(s.weight, s.reps))),
    });
  }
  return points;
}

// Lunes de la semana de `d` (semana de lunes a domingo).
export function weekStart(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
