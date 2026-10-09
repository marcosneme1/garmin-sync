import { useMemo, useState } from 'react';
import ExerciseList from './ExerciseList.jsx';
import ExerciseDetail from './ExerciseDetail.jsx';
import Modal from './Modal.jsx';
import { resolveExercise, searchExercises } from '../lib/exercises.js';
import { aiSearch } from '../lib/gemini.js';

// Buscador de ejercicios. Si se pasa `onPick`, cada resultado tiene un boton
// para elegirlo (agregar/reemplazar en un plan).
export default function SearchPanel({ exercises, settings, onPick, pickLabel = 'Elegir', autoFocus }) {
  const [query, setQuery] = useState('');
  const [aiResults, setAiResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const local = useMemo(
    () => (query.trim().length >= 2 ? searchExercises(exercises, query) : []),
    [exercises, query],
  );

  const runAi = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await aiSearch(settings, query, exercises);
      const items = [];
      const labels = {};
      for (const r of res) {
        const ex = resolveExercise(exercises, r.exerciseId, null);
        if (ex && !labels[ex.id]) {
          items.push(ex);
          labels[ex.id] = r.nombre;
        }
      }
      setAiResults({ query, items, labels });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const showAi = aiResults && aiResults.query === query;

  return (
    <div className="search">
      <input
        className="input search-input"
        type="search"
        placeholder="Ej: press banca inclinado, sentadilla, jalón al pecho…"
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => setQuery(e.target.value)}
      />

      {query.trim().length >= 2 && settings.apiKey && !showAi && (
        <button className="btn btn-secondary btn-block" onClick={runAi} disabled={loading}>
          {loading ? 'Buscando con Gemini…' : `✨ Buscar "${query}" con IA`}
        </button>
      )}
      {error && <p className="error">{error}</p>}

      {showAi && (
        <>
          <h4>Resultados de Gemini</h4>
          {aiResults.items.length ? (
            <ExerciseList
              items={aiResults.items}
              labels={aiResults.labels}
              onSelect={setSelected}
              onAction={onPick}
              actionLabel={pickLabel}
            />
          ) : (
            <p className="muted">Gemini no encontró coincidencias.</p>
          )}
          <h4>Resultados locales</h4>
        </>
      )}

      {query.trim().length >= 2 && !local.length && (
        <p className="muted">
          No encontré coincidencias directas.
          {settings.apiKey ? ' Probá la búsqueda con IA.' : ' Cargá tu API key de Gemini en Ajustes para buscar con IA.'}
        </p>
      )}
      <ExerciseList items={local} onSelect={setSelected} onAction={onPick} actionLabel={pickLabel} />

      {selected && (
        <Modal title="Ejercicio" onClose={() => setSelected(null)}>
          <ExerciseDetail
            exercise={selected}
            settings={settings}
            displayName={showAi ? aiResults.labels[selected.id] : undefined}
          />
          {onPick && (
            <button
              className="btn btn-block"
              onClick={() => {
                onPick(selected);
                setSelected(null);
              }}
            >
              {pickLabel}
            </button>
          )}
        </Modal>
      )}
    </div>
  );
}
