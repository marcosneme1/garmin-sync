import { useEffect, useRef, useState } from 'react';
import ExerciseAnimation from '../components/ExerciseAnimation.jsx';
import ExerciseDetail from '../components/ExerciseDetail.jsx';
import Modal from '../components/Modal.jsx';
import SwapModal from '../components/SwapModal.jsx';
import { exName, getExercise } from '../lib/exercises.js';
import { doneSets, lastPerformance, targetReps } from '../lib/workouts.js';

const fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// En iPhone, Safari solo permite sonido si el contexto de audio se habilito
// durante un toque del usuario: se hace al marcar la serie (unlockAudio) y
// despues el pitido del fin del descanso reutiliza ese contexto.
let audioCtx = null;

function unlockAudio() {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {
    // sin audio
  }
}

function beep() {
  navigator.vibrate?.([300, 150, 300]); // no existe en iPhone
  try {
    unlockAudio();
    const ctx = audioCtx;
    for (const start of [0, 0.35]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + start;
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    }
  } catch {
    // sin audio
  }
}

function RestTimer({ rest, onChange }) {
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);

  useEffect(() => {
    fired.current = false;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [rest.endsAt]);

  const left = Math.max(0, Math.ceil((rest.endsAt - now) / 1000));
  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true;
      beep();
      const t = setTimeout(() => onChange(null), 4000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [left, onChange]);

  const add = (s) => onChange({ ...rest, endsAt: Math.max(Date.now(), rest.endsAt + s * 1000) });

  return (
    <div className={`rest-bar ${left === 0 ? 'rest-done' : ''}`} role="timer" aria-live="polite">
      <div className="rest-progress" style={{ width: `${(left / rest.total) * 100}%` }} />
      <span className="rest-time">{left === 0 ? '¡A la próxima serie!' : `Descanso ${fmtClock(left)}`}</span>
      {left > 0 && (
        <span className="row gap">
          <button className="btn btn-small btn-secondary" onClick={() => add(-15)}>−15</button>
          <button className="btn btn-small btn-secondary" onClick={() => add(15)}>+15</button>
          <button className="btn btn-small" onClick={() => onChange(null)}>Saltar</button>
        </span>
      )}
    </div>
  );
}

export default function WorkoutScreen({
  workout, history, exercises, profile, settings, onChange, onFinish, onDiscard, onSwapInPlan,
}) {
  const [rest, setRest] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [swapping, setSwapping] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const elapsedMin = Math.floor((now - new Date(workout.startedAt)) / 60000);
  const total = workout.exercises.reduce((n, e) => n + e.sets.length, 0);
  const done = doneSets(workout).length;

  const updateEx = (id, fn) =>
    onChange({ ...workout, exercises: workout.exercises.map((e) => (e.id === id ? fn(e) : e)) });

  const updateSet = (ex, i, changes) =>
    updateEx(ex.id, (e) => ({ ...e, sets: e.sets.map((s, j) => (j === i ? { ...s, ...changes } : s)) }));

  const toggleDone = (ex, i) => {
    const s = ex.sets[i];
    if (s.done) {
      updateSet(ex, i, { done: false });
      return;
    }
    unlockAudio();
    // Si no cargo repeticiones, se toma el objetivo del plan.
    updateSet(ex, i, { done: true, reps: s.reps || targetReps(ex.target.repeticiones) });
    const secs = ex.target.descansoSeg || 90;
    setRest({ endsAt: Date.now() + secs * 1000, total: secs });
  };

  const addSet = (ex) =>
    updateEx(ex.id, (e) => ({ ...e, sets: [...e.sets, { weight: e.sets.at(-1)?.weight ?? '', reps: '', done: false }] }));

  const removeSet = (ex) =>
    updateEx(ex.id, (e) => ({ ...e, sets: e.sets.length > 1 ? e.sets.slice(0, -1) : e.sets }));

  const doSwap = (newEx, label) => {
    const ex = swapping.ex;
    const nombre = label || exName(newEx);
    const last = lastPerformance(history, { exerciseId: newEx.id, nombre });
    updateEx(ex.id, (e) => ({
      ...e,
      exerciseId: newEx.id,
      nombre,
      sets: e.sets.map((s, i) => ({
        ...s,
        weight: s.done ? s.weight : last?.sets[Math.min(i, last.sets.length - 1)]?.weight ?? '',
      })),
    }));
    if (ex.planItemId && window.confirm('¿Cambiarlo también en el plan para las próximas veces?')) {
      onSwapInPlan(ex.planItemId, newEx, nombre);
    }
    setSwapping(null);
  };

  const finish = () => {
    if (!done) {
      if (window.confirm('No marcaste ninguna serie. ¿Descartar el entrenamiento?')) onDiscard();
      return;
    }
    if (done < total && !window.confirm(`Hiciste ${done} de ${total} series. ¿Terminar igual?`)) return;
    onFinish();
  };

  return (
    <div className="workout">
      <section className="card workout-head">
        <div>
          <h2>{workout.dayName}</h2>
          <p className="muted small">
            {elapsedMin} min · {done}/{total} series
          </p>
        </div>
        <div className="row gap">
          <button className="btn btn-small btn-danger" onClick={() => window.confirm('¿Descartar este entrenamiento?') && onDiscard()}>
            Descartar
          </button>
          <button className="btn btn-small" onClick={finish}>Terminar</button>
        </div>
      </section>

      {workout.exercises.map((ex) => {
        const dbEx = ex.exerciseId ? getExercise(ex.exerciseId) : null;
        const last = lastPerformance(history, ex);
        const allDone = ex.sets.every((s) => s.done);
        return (
          <section key={ex.id} className={`card wo-ex ${allDone ? 'wo-ex-done' : ''}`}>
            <div className="wo-ex-head">
              <button className="plan-ex-main" onClick={() => dbEx && setViewing({ ex, dbEx })}>
                {dbEx ? <ExerciseAnimation exercise={dbEx} size="thumb" /> : <div className="anim anim-thumb anim-empty">?</div>}
                <div className="ex-info">
                  <strong>{ex.nombre}</strong>
                  <span className="sets">
                    Objetivo {ex.target.series} × {ex.target.repeticiones} · {ex.target.descansoSeg}s
                  </span>
                  {last && (
                    <span className="small muted">
                      Última vez: {last.sets.map((s) => `${s.weight || 0}×${s.reps}`).join(', ')}
                    </span>
                  )}
                </div>
              </button>
              <button className="btn btn-small btn-secondary" onClick={() => setSwapping({ ex, dbEx })}>🔄</button>
            </div>
            <table className="sets-table">
              <thead>
                <tr><th>Serie</th><th>Kg</th><th>Reps</th><th aria-label="Hecha" /></tr>
              </thead>
              <tbody>
                {ex.sets.map((s, i) => (
                  <tr key={i} className={s.done ? 'set-done' : ''}>
                    <td>{i + 1}</td>
                    <td>
                      <input
                        className="input" inputMode="decimal" aria-label={`Kg serie ${i + 1}`}
                        value={s.weight} placeholder="0"
                        onChange={(e) => updateSet(ex, i, { weight: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="input" inputMode="numeric" aria-label={`Repeticiones serie ${i + 1}`}
                        value={s.reps} placeholder={targetReps(ex.target.repeticiones)}
                        onChange={(e) => updateSet(ex, i, { reps: e.target.value })}
                      />
                    </td>
                    <td>
                      <button
                        className={`check-btn ${s.done ? 'on' : ''}`}
                        aria-label={s.done ? 'Desmarcar serie' : 'Marcar serie hecha'}
                        aria-pressed={s.done}
                        onClick={() => toggleDone(ex, i)}
                      >✓</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row gap end">
              <button className="btn btn-small btn-secondary" onClick={() => removeSet(ex)} disabled={ex.sets.length < 2}>− Serie</button>
              <button className="btn btn-small btn-secondary" onClick={() => addSet(ex)}>+ Serie</button>
            </div>
          </section>
        );
      })}

      {rest && <RestTimer rest={rest} onChange={setRest} />}

      {viewing && (
        <Modal title={viewing.ex.nombre} onClose={() => setViewing(null)}>
          <ExerciseDetail exercise={viewing.dbEx} displayName={viewing.ex.nombre} />
        </Modal>
      )}

      {swapping && (
        <SwapModal
          item={swapping.ex}
          exercise={swapping.dbEx}
          exercises={exercises}
          profile={profile}
          settings={settings}
          onSwap={doSwap}
          onClose={() => setSwapping(null)}
        />
      )}
    </div>
  );
}
