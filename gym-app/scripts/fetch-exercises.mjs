// Descarga la base de ejercicios libre (dominio publico, Unlicense) de
// https://github.com/yuhonas/free-exercise-db y la guarda recortada en
// public/exercises.json. Las imagenes no se copian: se cargan desde GitHub.
// Conserva la traduccion al español (`nombre` y `pasos`) que ya tenga cada
// ejercicio; los ejercicios nuevos quedan en ingles hasta traducirlos.
import { readFile, writeFile } from 'node:fs/promises';

const OUT = new URL('../public/exercises.json', import.meta.url);
const previous = new Map();
try {
  for (const e of JSON.parse(await readFile(OUT, 'utf8'))) previous.set(e.id, e);
} catch {
  // primera descarga
}

const SRC = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

const res = await fetch(SRC);
if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${SRC}`);
const data = await res.json();

const slim = data.map((e) => ({
  id: e.id,
  name: e.name,
  nombre: previous.get(e.id)?.nombre,
  level: e.level,
  force: e.force,
  mechanic: e.mechanic,
  equipment: e.equipment ?? 'other',
  primaryMuscles: e.primaryMuscles,
  secondaryMuscles: e.secondaryMuscles,
  category: e.category,
  instructions: e.instructions,
  images: e.images,
  pasos: previous.get(e.id)?.pasos,
}));

await writeFile(OUT, JSON.stringify(slim));
console.log(`${slim.length} ejercicios guardados en public/exercises.json`);
