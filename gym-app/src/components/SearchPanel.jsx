import { useMemo, useState } from 'react';
import ExerciseList from './ExerciseList.jsx';
import ExerciseDetail from './ExerciseDetail.jsx';
import Modal from './Modal.jsx';
import { resolveExercise, searchExercises } from '../lib/exercises.js';
import { aiSearch } from '../lib/gemini.js';
import { cacheKey, getCached } from '../lib/aiCache.js';

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

  const toResults = (q, res) => {
    const items = [];
    const labels = {};
    for (const r of res) {
      const ex = resolveExercise(exercises, r.exerciseId, null);
      if (ex && !labels[ex.id]) {
        items.push(ex);
        labels[ex.id] = r.nombre;
      }
    }
    return { query: q, items, labels };
  };

  const runAi = async () => {
    setLoading(true);
    setError('');
    try {
      setAiResults(toResults(query, await aiSearch(settings, query, exercises)));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Si esta busqueda ya se hizo con IA antes, mostrar lo guardado sin consultar.
  const saved = useMemo(() => {
    const hit = query.trim().length >= 2 && getCached(cacheKey('search', query));
    return hit ? toResults(query, hit.resultados ?? []) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, aiResults, exercises]);

  const ai = aiResults && aiResults.query === query ? aiResults : saved;
  const showAi = !!ai;

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
          <h4>Resultados de Gemini{ai === saved && aiResults?.query !== query ? ' (guardados)' : ''}</h4>
          {ai.items.length ? (
            <ExerciseList
              items={ai.items}
              labels={ai.labels}
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
            displayName={showAi ? ai.labels[selected.id] : undefined}
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
