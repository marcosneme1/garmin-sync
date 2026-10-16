import ExerciseAnimation from './ExerciseAnimation.jsx';
import { equipmentEs, exName, muscleEs } from '../lib/exercises.js';

// Lista de ejercicios con miniatura. `labels` permite mostrar otro nombre
// (por ejemplo el que puso Gemini en el plan) y `notes` una linea extra.
export default function ExerciseList({ items, onSelect, actionLabel, onAction, labels = {}, notes = {} }) {
  if (!items.length) return null;
  return (
    <ul className="ex-list">
      {items.map((ex) => (
        <li key={ex.id} className="ex-item">
          <button className="ex-main" onClick={() => onSelect?.(ex)}>
            <ExerciseAnimation exercise={ex} size="thumb" interval={1200} />
            <div className="ex-info">
              <strong>{labels[ex.id] ?? exName(ex)}</strong>
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
