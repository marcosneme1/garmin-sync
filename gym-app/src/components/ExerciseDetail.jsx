import { useEffect, useState } from 'react';
import { Browser } from '@capacitor/browser';
import ExerciseAnimation from './ExerciseAnimation.jsx';
import { CATEGORY_ES, LEVEL_ES, equipmentEs, exSteps, muscleEs } from '../lib/exercises.js';
import { ensureGif, getGifUrl, loadGallery } from '../lib/gallery.js';
import { translateInstructions } from '../lib/gemini.js';
import { cacheKey, getCached } from '../lib/aiCache.js';

export default function ExerciseDetail({ exercise, settings, displayName }) {
  const [showOriginal, setShowOriginal] = useState(false);
  // Traduccion hecha con Gemini (por si algun ejercicio no tiene la incluida
  // o se quiere otra version). Queda guardada y no se vuelve a pedir.
  const [tr, setTr] = useState(() => getCached(cacheKey('tr', exercise.id)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gifStatus, setGifStatus] = useState(() => (getGifUrl(exercise.id) ? 'saved' : 'saving'));
  const spanishName = displayName || exercise.nombre;

  // Primera vez que se abre: armar el GIF y guardarlo en la galeria.
  useEffect(() => {
    let alive = true;
    loadGallery()
      .then(() => {
        const wasSaved = !!getGifUrl(exercise.id);
        return ensureGif(exercise, spanishName).then(() => wasSaved);
      })
      .then((wasSaved) => alive && setGifStatus(wasSaved ? 'saved' : 'new'))
      .catch(() => alive && setGifStatus('error'));
    return () => {
      alive = false;
    };
  }, [exercise, spanishName]);

  const openVideo = () =>
    Browser.open({
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exercise.name} exercise technique`)}`,
    });

  const translate = async () => {
    setLoading(true);
    setError('');
    try {
      setTr(await translateInstructions(settings, exercise));
      setShowOriginal(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const steps = showOriginal ? exercise.instructions : tr?.pasos?.length ? tr.pasos : exSteps(exercise);
  const hasSpanish = !!(tr?.pasos?.length || exercise.pasos?.length);

  return (
    <div className="detail">
      <ExerciseAnimation exercise={exercise} />
      <p className="small muted gif-status">
        {gifStatus === 'saving' && 'Guardando GIF en tu galería…'}
        {gifStatus === 'new' && '✓ GIF guardado en tu galería'}
        {gifStatus === 'saved' && '✓ En tu galería (disponible sin internet)'}
        {gifStatus === 'error' && 'No se pudo guardar el GIF (¿sin conexión?)'}
      </p>
      <h3>{displayName || exercise.nombre || tr?.nombre || exercise.name}</h3>
      {(displayName || exercise.nombre || tr?.nombre) && <p className="muted small">{exercise.name}</p>}
      <div className="chips">
        {exercise.primaryMuscles.map((m) => (
          <span key={m} className="chip chip-primary">{muscleEs(m)}</span>
        ))}
        {exercise.secondaryMuscles.map((m) => (
          <span key={m} className="chip">{muscleEs(m)}</span>
        ))}
        <span className="chip chip-equip">{equipmentEs(exercise.equipment)}</span>
        {exercise.level && <span className="chip">{LEVEL_ES[exercise.level] ?? exercise.level}</span>}
        <span className="chip">{CATEGORY_ES[exercise.category] ?? exercise.category}</span>
      </div>

      <h4>Cómo se hace</h4>
      {tr && !showOriginal && <p className="muted small">Traducción hecha con IA (Gemini)</p>}
      <ol className="steps">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>

      <div className="row gap">
        <button className="btn btn-secondary" onClick={openVideo}>Ver videos en YouTube</button>
        {!tr && settings?.apiKey && (
          <button className="btn btn-secondary" onClick={translate} disabled={loading}>
            {loading ? 'Traduciendo…' : exercise.pasos?.length ? 'Traducir con IA' : 'Traducir al español'}
          </button>
        )}
        {hasSpanish && (
          <button className="btn btn-secondary btn-small" onClick={() => setShowOriginal((v) => !v)}>
            {showOriginal ? 'Ver en español' : 'Ver original (inglés)'}
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
