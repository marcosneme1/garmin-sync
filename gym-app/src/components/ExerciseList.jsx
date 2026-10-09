import ExerciseAnimation from './ExerciseAnimation.jsx';
import { equipmentEs, muscleEs } from '../lib/exercises.js';

// Lista de ejercicios con miniatura. `labels` permite mostrar el nombre en
// español (cuando viene de Gemini) y `notes` una linea extra por ejercicio.
export default function ExerciseList({ items, onSelect, actionLabel, onAction, labels = {}, notes = {} }) {
  if (!items.length) return null;
  return (
    <ul className="ex-list">
      {items.map((ex) => (
        <li key={ex.id} className="ex-item">
          <button className="ex-main" onClick={() => onSelect?.(ex)}>
            <ExerciseAnimation exercise={ex} size="thumb" interval={1200} />
            <div className="ex-info">
              <strong>{labels[ex.id] ?? ex.name}</strong>
              {labels[ex.id] && <span className="muted small">{ex.name}</span>}
              <span className="muted small">
                {ex.primaryMuscles.map(muscleEs).join(', ')} · {equipmentEs(ex.equipment)}
              </span>
              {notes[ex.id] && <span className="small note">{notes[ex.id]}</span>}
            </div>
          </button>
          {onAction && (
            <button className="btn btn-small" onClick={() => onAction(ex)}>{actionLabel}</button>
          )}
        </li>
      ))}
    </ul>
  );
}
