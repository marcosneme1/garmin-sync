import { useState } from 'react';
import { ALL_EQUIPMENT, equipmentEs } from '../lib/exercises.js';

export const GOALS = [
  'Ganar masa muscular (hipertrofia)',
  'Ganar fuerza',
  'Perder grasa / recomposición corporal',
  'Salud y bienestar general',
  'Mejorar resistencia y acondicionamiento',
  'Complementar otro deporte',
];

const EXPERIENCE = [
  'Nunca entrené con pesas',
  'Menos de 6 meses',
  'Entre 6 meses y 2 años',
  'Más de 2 años',
];

const ACTIVITY = [
  ['sedentario', 'Sedentario', 'No hago actividad física'],
  ['ligero', 'Ligera', '1-2 veces por semana'],
  ['moderado', 'Moderada', '3-4 veces por semana'],
  ['alto', 'Alta', '5 o más veces por semana'],
];

const EQUIPMENT_PRESETS = {
  'Gimnasio completo': ALL_EQUIPMENT,
  'Gimnasio básico': ['barbell', 'dumbbell', 'e-z curl bar', 'body only', 'other', 'bands'],
  'En casa (mancuernas)': ['dumbbell', 'body only', 'bands', 'kettlebells', 'exercise ball'],
  'Solo peso corporal': ['body only', 'other'],
};

export const DAYS_OPTIONS = [2, 3, 4, 5, 6];
export const MINUTES_OPTIONS = [30, 45, 60, 75, 90, 120];

export const EMPTY_PROFILE = {
  name: '',
  age: '',
  sex: '',
  weight: '',
  height: '',
  activity: '',
  experience: '',
  otherSports: '',
  equipment: ALL_EQUIPMENT,
  injuries: '',
  avoid: '',
  goal: GOALS[0],
  daysPerWeek: 3,
  minutesPerSession: 60,
};

function validate(p, section) {
  const errs = {};
  const num = (v) => Number(String(v).replace(',', '.'));
  if (section === 'personal' || section === 'all') {
    if (!(num(p.age) >= 12 && num(p.age) <= 99)) errs.age = 'Edad entre 12 y 99';
    if (!p.sex) errs.sex = 'Elegí una opción';
    if (!(num(p.weight) >= 30 && num(p.weight) <= 300)) errs.weight = 'Peso en kg (30-300)';
    if (!(num(p.height) >= 120 && num(p.height) <= 230)) errs.height = 'Altura en cm (120-230)';
  }
  if (section === 'activity' || section === 'all') {
    if (!p.activity) errs.activity = 'Elegí una opción';
    if (!p.experience) errs.experience = 'Elegí una opción';
  }
  if (section === 'equipment' || section === 'all') {
    if (!p.equipment.length) errs.equipment = 'Elegí al menos un tipo de equipamiento';
  }
  return errs;
}

function Choice({ options, value, onChange }) {
  return (
    <div className="choice">
      {options.map((o) => {
        const [val, label, hint] = Array.isArray(o) ? o : [o, String(o)];
        return (
          <button
            type="button"
            key={val}
            className={value === val ? 'selected' : ''}
            onClick={() => onChange(val)}
          >
            {label}
            {hint && <small>{hint}</small>}
          </button>
        );
      })}
    </div>
  );
}

const Field = ({ label, error, children }) => (
  // div y no label: un label con botones adentro dispara el primer boton al tocar el texto.
  <div className="field">
    <span>{label}</span>
    {children}
    {error && <em className="error">{error}</em>}
  </div>
);

// Formulario de perfil. En modo `wizard` (pantalla inicial) muestra una
// seccion por paso; si no, todo junto para editar.
export default function ProfileForm({ initial, wizard, onSave, onCancel, extraLastStep }) {
  const [p, setP] = useState({ ...EMPTY_PROFILE, ...initial });
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const set = (k) => (v) => setP((prev) => ({ ...prev, [k]: v?.target ? v.target.value : v }));

  const sections = [
    {
      key: 'personal',
      title: 'Tus datos',
      body: (
        <>
          <Field label="Nombre (opcional)">
            <input className="input" value={p.name} onChange={set('name')} />
          </Field>
          <div className="grid2">
            <Field label="Edad" error={errors.age}>
              <input className="input" inputMode="numeric" value={p.age} onChange={set('age')} />
            </Field>
            <Field label="Peso (kg)" error={errors.weight}>
              <input className="input" inputMode="decimal" value={p.weight} onChange={set('weight')} />
            </Field>
            <Field label="Altura (cm)" error={errors.height}>
              <input className="input" inputMode="numeric" value={p.height} onChange={set('height')} />
            </Field>
          </div>
          <Field label="Sexo" error={errors.sex}>
            <Choice options={['Masculino', 'Femenino', 'Prefiero no decir']} value={p.sex} onChange={set('sex')} />
          </Field>
        </>
      ),
    },
    {
      key: 'activity',
      title: 'Actividad y experiencia',
      body: (
        <>
          <Field label="¿Hacés actividad física actualmente?" error={errors.activity}>
            <Choice options={ACTIVITY} value={p.activity} onChange={set('activity')} />
          </Field>
          <Field label="Experiencia entrenando con pesas" error={errors.experience}>
            <Choice options={EXPERIENCE} value={p.experience} onChange={set('experience')} />
          </Field>
          <Field label="¿Practicás otro deporte? (opcional)">
            <input className="input" placeholder="Ej: running 3 veces por semana, fútbol…" value={p.otherSports} onChange={set('otherSports')} />
          </Field>
        </>
      ),
    },
    {
      key: 'equipment',
      title: 'Gimnasio y limitaciones',
      body: (
        <>
          <Field label="¿Dónde entrenás?" error={errors.equipment}>
            <div className="choice">
              {Object.entries(EQUIPMENT_PRESETS).map(([name, eq]) => (
                <button type="button" key={name} onClick={() => set('equipment')(eq)}>{name}</button>
              ))}
            </div>
          </Field>
          <div className="checks">
            {ALL_EQUIPMENT.map((e) => (
              <label key={e} className="check">
                <input
                  type="checkbox"
                  checked={p.equipment.includes(e)}
                  onChange={(ev) =>
                    set('equipment')(ev.target.checked ? [...p.equipment, e] : p.equipment.filter((x) => x !== e))
                  }
                />
                {equipmentEs(e)}
              </label>
            ))}
          </div>
          <Field label="Lesiones, dolores o limitaciones (opcional)">
            <textarea className="input" rows={2} placeholder="Ej: hernia lumbar, me molesta la rodilla derecha…" value={p.injuries} onChange={set('injuries')} />
          </Field>
          <Field label="Ejercicios que no querés hacer (opcional)">
            <input className="input" value={p.avoid} onChange={set('avoid')} />
          </Field>
        </>
      ),
    },
    {
      key: 'goal',
      title: 'Objetivo y disponibilidad',
      body: (
        <>
          <Field label="Objetivo principal">
            <Choice options={GOALS} value={p.goal} onChange={set('goal')} />
          </Field>
          <Field label="¿Cuántos días por semana vas a ir?">
            <Choice options={DAYS_OPTIONS.map((d) => [d, `${d}`])} value={p.daysPerWeek} onChange={set('daysPerWeek')} />
          </Field>
          <Field label="¿Cuánto tiempo por día?">
            <Choice options={MINUTES_OPTIONS.map((m) => [m, `${m} min`])} value={p.minutesPerSession} onChange={set('minutesPerSession')} />
          </Field>
        </>
      ),
    },
  ];

  const clean = () => ({
    ...p,
    age: Number(p.age),
    weight: Number(String(p.weight).replace(',', '.')),
    height: Number(p.height),
  });

  if (wizard) {
    const total = sections.length + (extraLastStep ? 1 : 0);
    const isExtra = extraLastStep && step === sections.length;
    const s = sections[step];
    const next = () => {
      if (!isExtra) {
        const errs = validate(p, s.key);
        setErrors(errs);
        if (Object.keys(errs).length) return;
      }
      if (step < total - 1) setStep(step + 1);
      else onSave(clean());
    };
    return (
      <div className="wizard">
        <div className="progress"><div style={{ width: `${((step + 1) / total) * 100}%` }} /></div>
        <p className="muted small">Paso {step + 1} de {total}</p>
        <h2>{isExtra ? extraLastStep.title : s.title}</h2>
        {isExtra ? extraLastStep.body : s.body}
        <div className="row gap end">
          {step > 0 && <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>Atrás</button>}
          <button className="btn" onClick={next}>{step < total - 1 ? 'Siguiente' : 'Empezar'}</button>
        </div>
      </div>
    );
  }

  const save = () => {
    const errs = validate(p, 'all');
    setErrors(errs);
    if (!Object.keys(errs).length) onSave(clean());
  };

  return (
    <div className="profile-form">
      {sections.map((s) => (
        <section key={s.key} className="card">
          <h3>{s.title}</h3>
          {s.body}
        </section>
      ))}
      {Object.keys(errors).length > 0 && <p className="error">Revisá los campos marcados.</p>}
      <div className="row gap end">
        {onCancel && <button className="btn btn-secondary" onClick={onCancel}>Cancelar</button>}
        <button className="btn" onClick={save}>Guardar</button>
      </div>
    </div>
  );
}
