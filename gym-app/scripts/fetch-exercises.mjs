// Descarga la base de ejercicios libre (dominio publico, Unlicense) de
// https://github.com/yuhonas/free-exercise-db y la guarda recortada en
// public/exercises.json. Las imagenes no se copian: se cargan desde GitHub.
import { writeFile } from 'node:fs/promises';

const SRC = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

const res = await fetch(SRC);
if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${SRC}`);
const data = await res.json();

const slim = data.map((e) => ({
  id: e.id,
  name: e.name,
  level: e.level,
  force: e.force,
  mechanic: e.mechanic,
  equipment: e.equipment ?? 'other',
  primaryMuscles: e.primaryMuscles,
  secondaryMuscles: e.secondaryMuscles,
  category: e.category,
  instructions: e.instructions,
  images: e.images,
}));

await writeFile(new URL('../public/exercises.json', import.meta.url), JSON.stringify(slim));
console.log(`${slim.length} ejercicios guardados en public/exercises.json`);
