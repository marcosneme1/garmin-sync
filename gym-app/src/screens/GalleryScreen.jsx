import { useState } from 'react';
import ExerciseDetail from '../components/ExerciseDetail.jsx';
import Modal from '../components/Modal.jsx';
import { equipmentEs, exName, getExercise, muscleEs } from '../lib/exercises.js';
import { deleteGif, getGifUrl, listGallery, useGallery } from '../lib/gallery.js';

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// GIFs guardados antes de tener los nombres en español quedaron con el
// nombre en ingles: en ese caso se muestra el nombre traducido.
const recName = (r) => (r.name && r.name !== r.originalName ? r.name : exName(getExercise(r.id)) || r.name);

export default function GalleryScreen() {
  useGallery();
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(null);

  const all = listGallery().map((r) => ({ ...r, name: recName(r) }));
  const f = norm(filter.trim());
  const items = f
    ? all.filter((r) =>
        norm([r.name, r.originalName, ...r.muscles.map(muscleEs), equipmentEs(r.equipment)].join(' ')).includes(f),
      )
    : all;

  const remove = async (rec) => {
    if (!window.confirm(`¿Quitar "${rec.name}" de la galería?`)) return;
    await deleteGif(rec.id);
    setSelected(null);
  };

  return (
    <div>
      <h2>Mi galería</h2>
      <p className="muted small">
        {all.length
          ? `${all.length} GIF${all.length === 1 ? '' : 's'} guardado${all.length === 1 ? '' : 's'} en el teléfono. Se ven sin internet.`
          : 'Todavía no hay GIFs. Cada ejercicio que abras (desde el plan o el buscador) se guarda acá automáticamente.'}
      </p>
      {all.length > 0 && (
        <input
          className="input search-input"
          type="search"
          placeholder="Filtrar por nombre, músculo o equipo…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      )}
      <div className="gallery-grid">
        {items.map((r) => (
          <button key={r.id} className="gallery-item" onClick={() => setSelected(r)}>
            <img src={getGifUrl(r.id)} alt={r.name} loading="lazy" />
            <strong>{r.name}</strong>
            <span className="muted small">{r.muscles.map(muscleEs).join(', ')}</span>
          </button>
        ))}
      </div>
      {f && !items.length && <p className="muted">No hay GIFs que coincidan.</p>}

      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)}>
          {getExercise(selected.id) ? (
            <ExerciseDetail exercise={getExercise(selected.id)} displayName={selected.name} />
          ) : (
            <img className="gallery-full" src={getGifUrl(selected.id)} alt={selected.name} />
          )}
          <button className="btn btn-danger btn-block" onClick={() => remove(selected)}>
            Quitar de la galería
          </button>
        </Modal>
      )}
    </div>
  );
}
