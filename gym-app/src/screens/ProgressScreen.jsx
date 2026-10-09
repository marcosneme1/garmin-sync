import { useMemo, useState } from 'react';
import Modal from '../components/Modal.jsx';
import ProgressChart from '../components/ProgressChart.jsx';
import { doneSets, exerciseProgress, volumeKg, weekStart } from '../lib/workouts.js';

const fmtDay = (iso) =>
  new Date(iso).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });

export default function ProgressScreen({ history, targetDays, onDelete }) {
  const [selected, setSelected] = useState(null);
  const [metric, setMetric] = useState('weight');

  const thisWeek = history.filter((w) => new Date(w.finishedAt) >= weekStart()).length;

  // Ejercicios con historial, el mas frecuente primero.
  const exerciseOptions = useMemo(() => {
    const map = new Map();
    for (const w of history) {
      for (const e of w.exercises) {
        const key = e.exerciseId ?? e.nombre;
        const cur = map.get(key) ?? { key, nombre: e.nombre, count: 0 };
        cur.count++;
        map.set(key, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [history]);

  const [exKey, setExKey] = useState(null);
  const currentKey = exKey && exerciseOptions.some((o) => o.key === exKey) ? exKey : exerciseOptions[0]?.key;
  const points = useMemo(() => (currentKey ? exerciseProgress(history, currentKey) : []), [history, currentKey]);
  const hasWeights = points.some((p) => p.weight > 0);

  if (!history.length) {
    return (
      <div>
        <h2>Progreso</h2>
        <section className="card">
          <p>Todavía no registraste entrenamientos.</p>
          <p className="muted small">
            En la pestaña Plan, elegí el día y tocá <strong>▶ Empezar entrenamiento</strong>. Al terminar, la sesión aparece acá.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div>
      <h2>Progreso</h2>
      <div className="stats">
        <div className="stat card">
          <span className="muted small">Esta semana</span>
          <strong>{thisWeek}{targetDays ? ` / ${targetDays}` : ''}</strong>
          <span className="muted small">entrenamientos</span>
        </div>
        <div className="stat card">
          <span className="muted small">Total</span>
          <strong>{history.length}</strong>
          <span className="muted small">sesiones</span>
        </div>
      </div>

      {exerciseOptions.length > 0 && (
        <section className="card">
          <h3>Evolución por ejercicio</h3>
          <select className="input" value={currentKey} onChange={(e) => setExKey(e.target.value)}>
            {exerciseOptions.map((o) => (
              <option key={o.key} value={o.key}>{o.nombre} ({o.count})</option>
            ))}
          </select>
          {hasWeights ? (
            <>
              <div className="tabs chart-tabs">
                <button className={metric === 'weight' ? 'active' : ''} onClick={() => setMetric('weight')}>Peso máximo</button>
                <button className={metric === 'e1rm' ? 'active' : ''} onClick={() => setMetric('e1rm')}>1RM estimado</button>
              </div>
              <ProgressChart
                points={points}
                valueKey={metric}
                label={metric === 'weight' ? 'Peso máximo' : '1RM estimado'}
              />
              {metric === 'e1rm' && (
                <p className="muted small">
                  Estimación con la fórmula de Epley a partir de tus series; es orientativa, no un máximo real.
                </p>
              )}
            </>
          ) : (
            <p className="muted small">Este ejercicio no tiene pesos cargados (peso corporal); no hay gráfico de peso.</p>
          )}
          <table className="hist-table">
            <thead><tr><th>Fecha</th><th>Mejor serie</th><th>1RM est.</th></tr></thead>
            <tbody>
              {[...points].reverse().map((p, i) => (
                <tr key={i}>
                  <td>{fmtDay(p.date)}</td>
                  <td>{p.weight ? `${p.weight} kg × ${p.reps}` : `${p.reps} reps`}</td>
                  <td>{p.e1rm ? `${p.e1rm} kg` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card">
        <h3>Historial</h3>
        <ul className="hist-list">
          {history.map((w) => (
            <li key={w.id}>
              <button onClick={() => setSelected(w)}>
                <strong>{w.dayName}</strong>
                <span className="muted small">
                  {fmtDay(w.finishedAt)} · {w.durationMin} min · {doneSets(w).length} series · {volumeKg(w).toLocaleString('es-AR')} kg
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {selected && (
        <Modal title={`${selected.dayName} · ${fmtDay(selected.finishedAt)}`} onClose={() => setSelected(null)}>
          <p className="muted small">
            {selected.planName} · {selected.durationMin} min · volumen {volumeKg(selected).toLocaleString('es-AR')} kg
          </p>
          {selected.exercises.map((e) => (
            <div key={e.id} className="hist-ex">
              <strong>{e.nombre}</strong>
              <span className="small">{e.sets.map((s) => `${s.weight || 0} kg × ${s.reps}`).join(' · ')}</span>
            </div>
          ))}
          <button
            className="btn btn-danger btn-block"
            onClick={() => {
              if (window.confirm('¿Borrar este entrenamiento del historial?')) {
                onDelete(selected.id);
                setSelected(null);
              }
            }}
          >
            Borrar del historial
          </button>
        </Modal>
      )}
    </div>
  );
}
