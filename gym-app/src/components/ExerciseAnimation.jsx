import { useEffect, useState } from 'react';
import { imageUrls } from '../lib/exercises.js';
import { getGifUrl, useGallery } from '../lib/gallery.js';

// Muestra el GIF guardado en la galeria; si todavia no existe, alterna las
// fotos de posicion inicial/final descargadas de internet.
export default function ExerciseAnimation({ exercise, size = 'large', interval = 900 }) {
  useGallery();
  const gif = getGifUrl(exercise?.id);
  const urls = gif ? [] : imageUrls(exercise);
  const [frame, setFrame] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFrame(0);
    setFailed(false);
    if (urls.length < 2) return undefined;
    const t = setInterval(() => setFrame((f) => (f + 1) % urls.length), interval);
    return () => clearInterval(t);
  }, [exercise?.id, interval, urls.length]);

  if (gif) {
    return (
      <div className={`anim anim-${size}`}>
        <img src={gif} alt={exercise.name} className="visible" />
      </div>
    );
  }

  if (!urls.length || failed) {
    return <div className={`anim anim-${size} anim-empty`}>Sin imagen{failed ? ' (¿sin conexión?)' : ''}</div>;
  }

  return (
    <div className={`anim anim-${size}`}>
      {urls.map((u, i) => (
        <img
          key={u}
          src={u}
          alt={`${exercise.name} – posición ${i + 1}`}
          loading="lazy"
          className={i === frame ? 'visible' : ''}
          onError={() => setFailed(true)}
        />
      ))}
    </div>
  );
}
