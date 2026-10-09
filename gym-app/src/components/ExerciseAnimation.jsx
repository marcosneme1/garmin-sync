import { useEffect, useState } from 'react';
import { imageUrls } from '../lib/exercises.js';

// Alterna las fotos de posicion inicial/final del ejercicio, como un GIF.
export default function ExerciseAnimation({ exercise, size = 'large', interval = 900 }) {
  const urls = imageUrls(exercise);
  const [frame, setFrame] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFrame(0);
    setFailed(false);
    if (urls.length < 2) return undefined;
    const t = setInterval(() => setFrame((f) => (f + 1) % urls.length), interval);
    return () => clearInterval(t);
  }, [exercise?.id, interval, urls.length]);

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
