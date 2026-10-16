import { useState } from 'react';
import ExerciseAnimation from '../components/ExerciseAnimation.jsx';
import ExerciseDetail from '../components/ExerciseDetail.jsx';
import Modal from '../components/Modal.jsx';
import SearchPanel from '../components/SearchPanel.jsx';
import SwapModal from '../components/SwapModal.jsx';
import { exName, getExercise, resolveExercise } from '../lib/exercises.js';
import { generatePlan } from '../lib/gemini.js';
import { DAYS_OPTIONS, GOALS, MINUTES_OPTIONS } from './ProfileForm.jsx';
import { lastPerformance } from '../lib/workouts.js';

const uid = () => Math.random().toString(36).slice(2, 10);

// Convierte la respuesta de Gemini en un plan guardable, validando que cada
// ejercicio exista en la base.
function normalizePlan(raw, request, exercises) {
  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    request,
    nombre: raw.nombre || 'Plan de entrenamiento',
    resumen: raw.resumen || '',
    progresion: raw.progresion || '',
    advertencias: raw.advertencias || '',
    dias: (raw.dias ?? []).map((d, i) => ({
      id: uid(),
      nombre: d.nombre || `Día ${i + 1}`,
      enfoque: d.enfoque || '',
      duracionMin: d.duracionMin ?? null,
      calentamiento: d.calentamiento || '',
      vueltaCalma: d.vueltaCalma || '',
      ejercicios: (d.ejercicios ?? []).map((e) => {
        const ex = resolveExercise(exercises, e.exerciseId, e.nombre);
        return {
          id: uid(),
          exerciseId: ex?.id ?? null,
          nombre: e.nombre || exName(ex) || e.exerciseId,
          series: Number(e.series) || 3,
          repeticiones: String(e.repeticiones ?? '10'),
          descansoSeg: Number(e.descansoSeg) || 90,
          notas: e.notas || '',
        };
      }),
    })),
  };
}

function GenerateForm({ profile, settings, exercises, onCreated, onCancel }) {
  const [req, setReq] = useState({
    daysPerWeek: profile.daysPerWeek,
    minutesPerSession: profile.minutesPerSession,
    goal: profile.goal,
    focus: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setReq((r) => ({ ...r, [k]: v }));

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      const raw = await generatePlan(settings, profile, req, exercises);
      const plan = normalizePlan(raw, req, exercises);
      if (!plan.dias.length) throw new Error('Gemini devolvió un plan sin días. Probá de nuevo.');
      onCreated(plan);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card">
      <h2>Nuevo plan</h2>
      {!settings.apiKey && (
        <p className="error">Necesitás cargar tu API key de Gemini en Ajustes para generar planes.</p>
      )}
      <div className="field">
        <span>Días por semana</span>
        <div className="choice">
          {DAYS_OPTIONS.map((d) => (
            <button key={d} className={req.daysPerWeek === d ? 'selected' : ''} onClick={() => set('daysPerWeek', d)}>{d}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>Minutos por sesión</span>
        <div className="choice">
          {MINUTES_OPTIONS.map((m) => (
            <button key={m} className={req.minutesPerSession === m ? 'selected' : ''} onClick={() => set('minutesPerSession', m)}>{m}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>Objetivo</span>
        <select className="input" value={req.goal} onChange={(e) => set('goal', e.target.value)}>
          {GOALS.map((g) => <option key={g}>{g}</option>)}
        </select>
      </div>
      <div className="field">
        <span>Zonas a priorizar (opcional)</span>
        <input className="input" placeholder="Ej: glúteos y espalda" value={req.focus} onChange={(e) => set('focus', e.target.value)} />
      </div>
      <div className="field">
        <span>Algo más que deba saber (opcional)</span>
        <textarea className="input" rows={2} placeholder="Ej: los martes tengo solo 40 minutos, prefiero máquinas…" value={req.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row gap end">
        {onCancel && <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancelar</button>}
        <button className="btn" onClick={submit} disabled={loading || !settings.apiKey}>
          {loading ? 'Generando (puede tardar ~30 s)…' : '✨ Generar plan'}
        </button>
      </div>
    </section>
  );
}

function ExerciseCard({ item, history, onView, onSwap, onUpdate, onRemove }) {
  const ex = item.exerciseId ? getExercise(item.exerciseId) : null;
  const last = lastPerformance(history, item);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item);

  const save = () => {
    onUpdate({ ...draft, series: Number(draft.series) || item.series, descansoSeg: Number(draft.descansoSeg) || item.descansoSeg });
    setEditing(false);
  };

  return (
    <li className="plan-ex">
      <button className="plan-ex-main" onClick={() => ex && onView(item, ex)}>
        {ex ? <ExerciseAnimation exercise={ex} size="thumb" /> : <div className="anim anim-thumb anim-empty">?</div>}
        <div className="ex-info">
          <strong>{item.nombre}</strong>
          <span className="sets">
            {item.series} × {item.repeticiones} · descanso {item.descansoSeg}s
          </span>
          {item.notas && <span className="small muted">{item.notas}</span>}
          {last && (
            <span className="small muted">Última vez: {last.sets.map((s) => `${s.weight || 0}×${s.reps}`).join(', ')}</span>
          )}
        </div>
      </button>
      {editing ? (
        <div className="edit-row">
          <input className="input" value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} aria-label="Nombre" />
          <div className="grid3">
            <label>Series<input className="input" inputMode="numeric" value={draft.series} onChange={(e) => setDraft({ ...draft, series: e.target.value })} /></label>
            <label>Reps<input className="input" value={draft.repeticiones} onChange={(e) => setDraft({ ...draft, repeticiones: e.target.value })} /></label>
            <label>Desc. (s)<input className="input" inputMode="numeric" value={draft.descansoSeg} onChange={(e) => setDraft({ ...draft, descansoSeg: e.target.value })} /></label>
          </div>
          <div className="row gap end">
            <button className="btn btn-small btn-danger" onClick={onRemove}>Quitar</button>
            <button className="btn btn-small btn-secondary" onClick={() => setEditing(false)}>Cancelar</button>
            <button className="btn btn-small" onClick={save}>Guardar</button>
          </div>
        </div>
      ) : (
        <div className="row gap end">
          <button className="btn btn-small btn-secondary" onClick={() => { setDraft(item); setEditing(true); }}>Editar</button>
          <button className="btn btn-small" onClick={() => onSwap(item, ex)}>🔄 Cambiar ejercicio</button>
        </div>
      )}
    </li>
  );
}

export default function PlanScreen({
  profile, settings, exercises, plans, activePlanId, onSavePlans, onSetActive, history, onStartWorkout,
}) {
  const plan = plans.find((p) => p.id === activePlanId) ?? plans[0] ?? null;
  const [creating, setCreating] = useState(!plan);
  const [dayIdx, setDayIdx] = useState(0);
  const [viewing, setViewing] = useState(null);
  const [swapping, setSwapping] = useState(null);
  const [adding, setAdding] = useState(false);

  if (creating || !plan) {
    return (
      <GenerateForm
        profile={profile}
        settings={settings}
        exercises={exercises}
        onCancel={plan ? () => setCreating(false) : null}
        onCreated={(p) => {
          onSavePlans([p, ...plans]);
          onSetActive(p.id);
          setDayIdx(0);
          setCreating(false);
        }}
      />
    );
  }

  const day = plan.dias[Math.min(dayIdx, plan.dias.length - 1)];

  const updateDay = (fn) => {
    const updated = {
      ...plan,
      dias: plan.dias.map((d) => (d.id === day.id ? { ...d, ejercicios: fn(d.ejercicios) } : d)),
    };
    onSavePlans(plans.map((p) => (p.id === plan.id ? updated : p)));
  };

  const doSwap = (newEx, label) => {
    updateDay((list) =>
      list.map((it) =>
        it.id === swapping.item.id ? { ...it, exerciseId: newEx.id, nombre: label || exName(newEx), notas: '' } : it,
      ),
    );
    setSwapping(null);
  };

  const deletePlan = () => {
    if (!window.confirm(`¿Borrar el plan "${plan.nombre}"?`)) return;
    const rest = plans.filter((p) => p.id !== plan.id);
    onSavePlans(rest);
    onSetActive(rest[0]?.id ?? null);
    setDayIdx(0);
  };

  return (
    <div className="plan">
      <section className="card">
        {plans.length > 1 && (
          <select className="input" value={plan.id} onChange={(e) => { onSetActive(e.target.value); setDayIdx(0); }}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({new Date(p.createdAt).toLocaleDateString('es-AR')})
              </option>
            ))}
          </select>
        )}
        <h2>{plan.nombre}</h2>
        <p className="muted small">
          {plan.request.daysPerWeek} días/semana · {plan.request.minutesPerSession} min · {plan.request.goal}
        </p>
        {plan.resumen && <p>{plan.resumen}</p>}
        <div className="row gap">
          <button className="btn btn-secondary btn-small" onClick={() => setCreating(true)}>+ Nuevo plan</button>
          <button className="btn btn-danger btn-small" onClick={deletePlan}>Borrar</button>
        </div>
      </section>

      <div className="day-tabs">
        {plan.dias.map((d, i) => (
          <button key={d.id} className={d.id === day.id ? 'active' : ''} onClick={() => setDayIdx(i)}>
            {d.nombre}
          </button>
        ))}
      </div>

      <section className="card">
        <h3>{day.nombre}</h3>
        <p className="muted small">
          {day.enfoque}
          {day.duracionMin ? ` · ~${day.duracionMin} min` : ''}
        </p>
        <button className="btn btn-block" onClick={() => onStartWorkout(plan, day)} disabled={!day.ejercicios.length}>
          ▶ Empezar entrenamiento
        </button>
        {day.calentamiento && <p className="small"><strong>Calentamiento:</strong> {day.calentamiento}</p>}
        <ul className="plan-list">
          {day.ejercicios.map((it) => (
            <ExerciseCard
              key={it.id}
              item={it}
              history={history}
              onView={(item, ex) => setViewing({ item, ex })}
              onSwap={(item, ex) => setSwapping({ item, ex })}
              onUpdate={(next) => updateDay((list) => list.map((x) => (x.id === it.id ? next : x)))}
              onRemove={() => updateDay((list) => list.filter((x) => x.id !== it.id))}
            />
          ))}
        </ul>
        <button className="btn btn-secondary btn-block" onClick={() => setAdding(true)}>+ Agregar ejercicio</button>
        {day.vueltaCalma && <p className="small"><strong>Vuelta a la calma:</strong> {day.vueltaCalma}</p>}
      </section>

      {(plan.progresion || plan.advertencias) && (
        <section className="card">
          {plan.progresion && (<><h3>Progresión</h3><p>{plan.progresion}</p></>)}
          {plan.advertencias && (<><h3>Precauciones</h3><p>{plan.advertencias}</p></>)}
        </section>
      )}

      {viewing && (
        <Modal title={viewing.item.nombre} onClose={() => setViewing(null)}>
          <p className="sets">
            {viewing.item.series} × {viewing.item.repeticiones} · descanso {viewing.item.descansoSeg}s
          </p>
          <ExerciseDetail exercise={viewing.ex} settings={settings} displayName={viewing.item.nombre} />
        </Modal>
      )}

      {swapping && (
        <SwapModal
          item={swapping.item}
          exercise={swapping.ex}
          exercises={exercises}
          profile={profile}
          settings={settings}
          onSwap={doSwap}
          onClose={() => setSwapping(null)}
        />
      )}

      {adding && (
        <Modal title={`Agregar a ${day.nombre}`} onClose={() => setAdding(false)}>
          <SearchPanel
            exercises={exercises}
            settings={settings}
            autoFocus
            pickLabel="Agregar"
            onPick={(ex) => {
              updateDay((list) => [
                ...list,
                { id: uid(), exerciseId: ex.id, nombre: exName(ex), series: 3, repeticiones: '10-12', descansoSeg: 90, notas: '' },
              ]);
              setAdding(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
