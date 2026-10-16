import { useState } from 'react';
import { Capacitor } from '@capacitor/core';

const KEY = 'gym.installHintClosed';
const APK_URL = 'https://github.com/Turuleca82/turuleca82.github.io/releases/download/apk/GymPlan.apk';

// Desde el navegador: en iPhone/iPad explica como instalar la app en la
// pantalla de inicio (iOS no muestra un boton de instalar por su cuenta) y en
// Android ofrece descargar el APK. Dentro de la app instalada no se muestra.
export default function InstallHint() {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = /android/i.test(navigator.userAgent);
  const installed = window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
  const [closed, setClosed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  if (!(isIos || isAndroid) || installed || closed || Capacitor.isNativePlatform()) return null;

  const close = () => {
    setClosed(true);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // nada
    }
  };

  if (isAndroid) {
    return (
      <div className="install-hint" role="note">
        <div className="install-hint-body">
          <p>
            <strong>¿Tenés Android?</strong> Podés instalar GymPlan como app.
          </p>
          <a className="btn btn-small" href={APK_URL}>Descargar app (APK)</a>
          <p className="small">
            Abrí el archivo descargado y, si Android lo pide, permití instalar desde Chrome. Lo que cargues acá en la
            web no pasa a la app.
          </p>
        </div>
        <button className="icon-btn" onClick={close} aria-label="Cerrar aviso">✕</button>
      </div>
    );
  }

  return (
    <div className="install-hint" role="note">
      <p>
        <strong>Instalala en tu iPhone:</strong> en Safari tocá el botón <strong>Compartir</strong> (el cuadrado con la
        flecha hacia arriba) y elegí <strong>“Agregar a pantalla de inicio”</strong>. Así queda como una app y tus
        datos se conservan.
      </p>
      <button className="icon-btn" onClick={close} aria-label="Cerrar aviso">✕</button>
    </div>
  );
}
