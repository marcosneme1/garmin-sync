import { useState } from 'react';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { APK_URL } from '../components/InstallHint.jsx';
import { AUTO_MODEL, listModels, pickBestModel } from '../lib/gemini.js';

export function ApiKeyFields({ value, onChange }) {
  const [models, setModels] = useState([]);
  const [auto, setAuto] = useState('');
  const [status, setStatus] = useState('');
  const [show, setShow] = useState(false);

  const test = async () => {
    setStatus('Probando…');
    try {
      const list = await listModels(value.apiKey);
      setModels(list);
      setAuto(pickBestModel(list) ?? '');
      setStatus(`✓ La key funciona (${list.length} modelos disponibles).`);
    } catch (e) {
      setStatus(`✗ ${e.message}`);
    }
  };

  return (
    <>
      <p className="small">
        La app usa Gemini para armar los planes. Necesitás una API key gratuita de Google AI Studio; queda
        guardada solo en este teléfono.
      </p>
      <button className="btn btn-secondary btn-small" onClick={() => Browser.open({ url: 'https://aistudio.google.com/apikey' })}>
        Obtener API key en Google AI Studio
      </button>
      <div className="field">
        <span>API key de Gemini</span>
        <div className="row gap">
          <input
            className="input"
            type={show ? 'text' : 'password'}
            autoComplete="off"
            value={value.apiKey}
            onChange={(e) => onChange({ ...value, apiKey: e.target.value.trim() })}
          />
          <button className="btn btn-secondary btn-small" onClick={() => setShow(!show)}>{show ? 'Ocultar' : 'Ver'}</button>
        </div>
      </div>
      <div className="field">
        <span>Modelo</span>
        <select className="input" value={value.model} onChange={(e) => onChange({ ...value, model: e.target.value })}>
          <option value={AUTO_MODEL}>Automático (recomendado){auto ? ` · ${auto}` : ''}</option>
          {value.model !== AUTO_MODEL && !models.includes(value.model) && <option value={value.model}>{value.model}</option>}
          {models.map((m) => <option key={m}>{m}</option>)}
        </select>
        <span className="small muted">
          En automático la app usa el modelo Flash más nuevo disponible y cambia sola si Google retira uno.
        </span>
      </div>
      <button className="btn btn-secondary btn-small" onClick={test} disabled={!value.apiKey}>
        Probar key y cargar modelos
      </button>
      {status && <p className={status.startsWith('✗') ? 'error' : 'small'}>{status}</p>}
    </>
  );
}

export default function SettingsScreen({ settings, onSave, onResetAll, onEditProfile }) {
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);

  return (
    <div>
      <section className="card">
        <h2>Mi perfil</h2>
        <p className="small muted">Edad, peso, equipamiento, lesiones, objetivo y disponibilidad.</p>
        <button className="btn btn-secondary btn-small" onClick={onEditProfile}>Editar mi perfil</button>
      </section>
      <section className="card">
        <h2>Gemini</h2>
        <ApiKeyFields value={draft} onChange={(v) => { setDraft(v); setSaved(false); }} />
        <div className="row end">
          <button className="btn" onClick={() => { onSave(draft); setSaved(true); }}>{saved ? 'Guardado ✓' : 'Guardar'}</button>
        </div>
      </section>
      {/android/i.test(navigator.userAgent) && !Capacitor.isNativePlatform() && (
        <section className="card">
          <h2>App para Android</h2>
          <p className="small muted">
            Podés instalar GymPlan como app. Abrí el archivo descargado y, si Android lo pide, permití instalar desde el
            navegador. Lo que cargues acá en la web no pasa a la app.
          </p>
          <a className="btn btn-block" href={APK_URL}>Descargar app (APK)</a>
        </section>
      )}

      <section className="card">
        <h2>Datos</h2>
        <p className="small muted">
          Las imágenes de los ejercicios provienen de free-exercise-db (dominio público) y se descargan de internet
          la primera vez que se ven.
        </p>
        <button
          className="btn btn-danger btn-small"
          onClick={() => window.confirm('¿Borrar perfil, planes, historial de entrenamientos, galería de GIFs y API key de este teléfono?') && onResetAll()}
        >
          Borrar todos mis datos
        </button>
      </section>
    </div>
  );
}
