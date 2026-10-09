import { useEffect, useState } from 'react';
import { loadExercises } from './lib/exercises.js';
import { DEFAULT_SETTINGS, storage } from './lib/storage.js';
import ProfileForm from './screens/ProfileForm.jsx';
import PlanScreen from './screens/PlanScreen.jsx';
import SettingsScreen, { ApiKeyFields } from './screens/SettingsScreen.jsx';
import SearchPanel from './components/SearchPanel.jsx';

const TABS = [
  ['plan', '📋', 'Plan'],
  ['search', '🔍', 'Ejercicios'],
  ['profile', '👤', 'Perfil'],
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

  useEffect(() => {
    loadExercises().then(setExercises).catch((e) => setLoadError(e.message));
  }, []);

  const saveProfile = (p) => { storage.setProfile(p); setProfile(p); };
  const savePlans = (ps) => { storage.setPlans(ps); setPlans(ps); };
  const saveActive = (id) => { storage.setActivePlanId(id); setActivePlanId(id); };
  const saveSettings = (s) => { storage.setSettings(s); setSettings(s); };

  if (loadError) return <div className="center error">{loadError}</div>;
  if (!exercises) return <div className="center muted">Cargando…</div>;

  if (!profile) {
    return (
      <main className="app onboarding">
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
        {tab === 'plan' && (
          <PlanScreen
            profile={profile}
            settings={settings}
            exercises={exercises}
            plans={plans}
            activePlanId={activePlanId}
            onSavePlans={savePlans}
            onSetActive={saveActive}
          />
        )}
        {tab === 'search' && (
          <>
            <h2>Buscar ejercicio</h2>
            <SearchPanel exercises={exercises} settings={settings} />
          </>
        )}
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
            onResetAll={() => {
              localStorage.clear();
              setProfile(null);
              setPlans([]);
              setActivePlanId(null);
              setSettings(DEFAULT_SETTINGS);
              setOnboardingKey(DEFAULT_SETTINGS);
            }}
          />
        )}
      </main>
      <nav className="tabbar">
        {TABS.map(([key, icon, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            <span aria-hidden>{icon}</span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
