import { useEffect, useState } from 'react';
import { loadExercises } from './lib/exercises.js';
import { DEFAULT_SETTINGS, storage } from './lib/storage.js';
import ProfileForm from './screens/ProfileForm.jsx';
import PlanScreen from './screens/PlanScreen.jsx';
import SettingsScreen, { ApiKeyFields } from './screens/SettingsScreen.jsx';
import SearchPanel from './components/SearchPanel.jsx';
import InstallHint from './components/InstallHint.jsx';
import GalleryScreen from './screens/GalleryScreen.jsx';
import { clearGallery, loadGallery } from './lib/gallery.js';
import { clearAiCache } from './lib/aiCache.js';
import WorkoutScreen from './screens/WorkoutScreen.jsx';
import ProgressScreen from './screens/ProgressScreen.jsx';
import {
  finishWorkout, getActiveWorkout, getHistory, setActiveWorkout as persistActive, setHistory as persistHistory, startWorkout,
} from './lib/workouts.js';

const TABS = [
  ['plan', '📋', 'Plan'],
  ['progress', '📈', 'Progreso'],
  ['search', '🔍', 'Buscar'],
  ['gallery', '🎞️', 'Galería'],
  ['settings', '⚙️', 'Ajustes'],
];

export default function App() {
  const [exercises, setExercises] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [profile, setProfile] = useState(storage.getProfile);
  const [plans, setPlans] = useState(storage.getPlans);
  const [activePlanId, setActivePlanId] = useState(storage.getActivePlanId);
  const [settings, setSettings] = useState(storage.getSettings);
  const [tab, setTab] = useState('plan');
  const [onboardingKey, setOnboardingKey] = useState(settings);
  const [history, setHistory] = useState(getHistory);
  const [workout, setWorkout] = useState(getActiveWorkout);

  useEffect(() => {
    loadExercises().then(setExercises).catch((e) => setLoadError(e.message));
    loadGallery();
  }, []);

  const saveProfile = (p) => { storage.setProfile(p); setProfile(p); };
  const savePlans = (ps) => { storage.setPlans(ps); setPlans(ps); };
  const saveActive = (id) => { storage.setActivePlanId(id); setActivePlanId(id); };
  const saveSettings = (s) => { storage.setSettings(s); setSettings(s); };
  const saveWorkout = (w) => { persistActive(w); setWorkout(w); };
  const saveHistory = (h) => { persistHistory(h); setHistory(h); };

  const beginWorkout = (plan, day) => {
    if (workout && !window.confirm(`Hay un entrenamiento en curso (${workout.dayName}). ¿Descartarlo y empezar otro?`)) {
      setTab('workout');
      return;
    }
    saveWorkout(startWorkout(plan, day, history));
    setTab('workout');
  };

  const swapInPlan = (planItemId, ex, nombre) =>
    savePlans(
      plans.map((p) => ({
        ...p,
        dias: p.dias.map((d) => ({
          ...d,
          ejercicios: d.ejercicios.map((it) =>
            it.id === planItemId ? { ...it, exerciseId: ex.id, nombre, notas: '' } : it,
          ),
        })),
      })),
    );

  const activePlan = plans.find((p) => p.id === activePlanId) ?? plans[0];

  if (loadError) return <div className="center error">{loadError}</div>;
  if (!exercises) return <div className="center muted">Cargando…</div>;

  if (!profile) {
    return (
      <main className="app onboarding">
        <InstallHint />
        <h1>Bienvenido a GymPlan 💪</h1>
        <p className="muted">Contame un poco de vos para armarte un plan a medida.</p>
        <ProfileForm
          wizard
          extraLastStep={{
            title: 'Conectar con Gemini',
            body: (
              <>
                <ApiKeyFields value={onboardingKey} onChange={setOnboardingKey} />
                <p className="small muted">Podés saltear este paso y cargarla después en Ajustes.</p>
              </>
            ),
          }}
          onSave={(p) => {
            saveSettings({ ...DEFAULT_SETTINGS, ...onboardingKey });
            saveProfile(p);
            setTab('plan');
          }}
        />
      </main>
    );
  }

  return (
    <div className="app-shell">
      <main className="app">
        <InstallHint />
        {workout && tab !== 'workout' && (
          <button className="workout-banner" onClick={() => setTab('workout')}>
            ▶ Entrenamiento en curso: <strong>{workout.dayName}</strong> — continuar
          </button>
        )}
        {tab === 'plan' && (
          <PlanScreen
            profile={profile}
            settings={settings}
            exercises={exercises}
            plans={plans}
            activePlanId={activePlanId}
            onSavePlans={savePlans}
            onSetActive={saveActive}
            history={history}
            onStartWorkout={beginWorkout}
          />
        )}
        {tab === 'workout' && workout && (
          <WorkoutScreen
            workout={workout}
            history={history}
            exercises={exercises}
            profile={profile}
            settings={settings}
            onChange={saveWorkout}
            onSwapInPlan={swapInPlan}
            onDiscard={() => { saveWorkout(null); setTab('plan'); }}
            onFinish={() => {
              saveHistory([finishWorkout(workout), ...history]);
              saveWorkout(null);
              setTab('progress');
            }}
          />
        )}
        {tab === 'progress' && (
          <ProgressScreen
            history={history}
            targetDays={activePlan?.request?.daysPerWeek}
            onDelete={(id) => saveHistory(history.filter((w) => w.id !== id))}
          />
        )}
        {tab === 'search' && (
          <>
            <h2>Buscar ejercicio</h2>
            <SearchPanel exercises={exercises} settings={settings} />
          </>
        )}
        {tab === 'gallery' && <GalleryScreen settings={settings} />}
        {tab === 'profile' && (
          <>
            <h2>Mi perfil</h2>
            <p className="muted small">Los cambios se usan en los próximos planes que generes.</p>
            <ProfileForm initial={profile} onSave={(p) => { saveProfile(p); setTab('plan'); }} />
          </>
        )}
        {tab === 'settings' && (
          <SettingsScreen
            settings={settings}
            onSave={saveSettings}
            onEditProfile={() => setTab('profile')}
            onResetAll={() => {
              localStorage.clear();
              clearAiCache();
              clearGallery().catch(() => {});
              setProfile(null);
              setPlans([]);
              setActivePlanId(null);
              setHistory([]);
              setWorkout(null);
              setSettings(DEFAULT_SETTINGS);
              setOnboardingKey(DEFAULT_SETTINGS);
            }}
          />
        )}
      </main>
      <nav className="tabbar">
        {TABS.map(([key, icon, label]) => (
          <button
            key={key}
            className={tab === key || (key === 'plan' && tab === 'workout') || (key === 'settings' && tab === 'profile') ? 'active' : ''}
            onClick={() => setTab(key)}
          >
            <span aria-hidden>{icon}</span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
