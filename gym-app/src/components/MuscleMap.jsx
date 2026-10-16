import Body from 'react-muscle-highlighter';
import { storage } from '../lib/storage.js';

// Musculos de la base (free-exercise-db) -> zonas del dibujo.
// El dibujo no separa dorsales de espalda media ni tiene abductores propios.
const SLUGS = {
  abdominals: ['abs', 'obliques'],
  abductors: ['gluteal'],
  adductors: ['adductors'],
  biceps: ['biceps'],
  calves: ['calves'],
  chest: ['chest'],
  forearms: ['forearm'],
  glutes: ['gluteal'],
  hamstrings: ['hamstring'],
  lats: ['upper-back'],
  'lower back': ['lower-back'],
  'middle back': ['upper-back'],
  neck: ['neck'],
  quadriceps: ['quadriceps'],
  shoulders: ['deltoids'],
  traps: ['trapezius'],
  triceps: ['triceps'],
};

const PRIMARY = '#ff7a1a';
const SECONDARY = '#9a4d18';
const BASE = '#3a424d';
const HEAD = '#545d69';

// Cuerpo de frente y de espalda con el musculo principal pintado fuerte y
// los secundarios mas suave, como los dibujos de las maquinas del gimnasio.
export default function MuscleMap({ exercise }) {
  const fills = new Map();
  for (const m of exercise.secondaryMuscles ?? []) for (const s of SLUGS[m] ?? []) fills.set(s, SECONDARY);
  for (const m of exercise.primaryMuscles ?? []) for (const s of SLUGS[m] ?? []) fills.set(s, PRIMARY);
  if (!fills.size) return null;

  // Cabeza y cuello vienen con un gris claro propio: oscurecerlos para que no distraigan.
  for (const [slug, fill] of [['head', HEAD], ['hair', HEAD], ['neck', BASE]]) if (!fills.has(slug)) fills.set(slug, fill);
  const data = [...fills].map(([slug, fill]) => ({ slug, styles: { fill } }));
  const gender = storage.getProfile()?.sex === 'Femenino' ? 'female' : 'male';
  const common = { data, gender, border: 'none', defaultFill: BASE };

  return (
    <figure className="muscle-map" aria-label="Músculos que trabaja">
      <div className="muscle-map-bodies">
        <div>
          <Body {...common} side="front" />
          <span className="small muted">Frente</span>
        </div>
        <div>
          <Body {...common} side="back" />
          <span className="small muted">Espalda</span>
        </div>
      </div>
      <figcaption className="small muted">
        <span className="swatch" style={{ background: PRIMARY }} /> Principal
        <span className="swatch" style={{ background: SECONDARY }} /> Secundario
      </figcaption>
    </figure>
  );
}
