import { useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import ExerciseList from './ExerciseList.jsx';
import ExerciseDetail from './ExerciseDetail.jsx';
import SearchPanel from './SearchPanel.jsx';
import { ALL_EQUIPMENT, findAlternatives, muscleEs, resolveExercise } from '../lib/exercises.js';
import { suggestAlternatives } from '../lib/gemini.js';

// Reemplazar un ejercicio del plan por otro del mismo musculo.
export default function SwapModal({ item, exercise, exercises, profile, settings, onSwap, onClose }) {
  const [tab, setTab] = useState('same');
  const [onlyMine, setOnlyMine] = useState(true);
  const [reason, setReason] = useState('');
  const [ai, setAi] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  const alternatives = useMemo(
    () =>
      findAlternatives(exercises, exercise, {
        equipment: onlyMine ? profile.equipment : ALL_EQUIPMENT,
      }),
    [exercises, exercise, onlyMine, profile.equipment],
  );

  const askAi = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await suggestAlternatives(settings, profile, exercise, reason, exercises);
      const items = [];
      const labels = {};
      const notes = {};
      for (const r of res) {
        const ex = resolveExercise(exercises, r.exerciseId, null);
        if (ex && ex.id !== exercise.id && !labels[ex.id]) {
          items.push(ex);
          labels[ex.id] = r.nombre;
          notes[ex.id] = r.motivo;
        }
      }
      setAi({ items, labels, notes });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const pick = (ex, label) => onSwap(ex, label);

  if (!exercise) {
    return (
      <Modal title={`Reemplazar: ${item.nombre}`} onClose={onClose}>
        <p className="muted">Este ejercicio no está en la base; buscá uno para reemplazarlo.</p>
        <SearchPanel exercises={exercises} settings={settings} onPick={(ex) => pick(ex)} pickLabel="Usar este" />
      </Modal>
    );
  }

  return (
    <Modal title={`Reemplazar: ${item.nombre}`} onClose={onClose}>
      <p className="muted small">
        Músculo principal: <strong>{muscleEs(exercise.primaryMuscles[0])}</strong>. Se mantienen las series,
        repeticiones y descanso.
      </p>
      <div className="tabs">
        <button className={tab === 'same' ? 'active' : ''} onClick={() => setTab('same')}>Mismo músculo</button>
        <button className={tab === 'ai' ? 'active' : ''} onClick={() => setTab('ai')}>Sugerencia IA</button>
        <button className={tab === 'search' ? 'active' : ''} onClick={() => setTab('search')}>Buscar</button>
      </div>

      {tab === 'same' && (
        <>
          <label className="check">
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
            Solo con mi equipamiento
          </label>
          {alternatives.length ? (
            <ExerciseList items={alternatives} onSelect={setPreview} onAction={(ex) => pick(ex)} actionLabel="Usar" />
          ) : (
            <p className="muted">No hay alternativas con ese filtro.</p>
          )}
        </>
      )}

      {tab === 'ai' && (
        <>
          {!settings.apiKey ? (
            <p className="muted">Cargá tu API key de Gemini en Ajustes para usar esta opción.</p>
          ) : (
            <>
              <input
                className="input"
                placeholder="Motivo (opcional): ej. no hay prensa, me molesta el hombro…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <button className="btn btn-block" onClick={askAi} disabled={loading}>
                {loading ? 'Consultando a Gemini…' : '✨ Pedir alternativas'}
              </button>
            </>
          )}
          {error && <p className="error">{error}</p>}
          {ai && (
            <ExerciseList
              items={ai.items}
              labels={ai.labels}
              notes={ai.notes}
              onSelect={setPreview}
              onAction={(ex) => pick(ex, ai.labels[ex.id])}
              actionLabel="Usar"
            />
          )}
        </>
      )}

      {tab === 'search' && (
        <SearchPanel exercises={exercises} settings={settings} onPick={(ex) => pick(ex)} pickLabel="Usar este" />
      )}

      {preview && (
        <Modal title="Vista previa" onClose={() => setPreview(null)}>
          <ExerciseDetail exercise={preview} settings={settings} displayName={ai?.labels[preview.id]} />
          <button className="btn btn-block" onClick={() => pick(preview, ai?.labels[preview.id])}>
            Usar este ejercicio
          </button>
        </Modal>
      )}
    </Modal>
  );
}
