import { useState } from 'react';
import { Capacitor } from '@capacitor/core';

const KEY = 'gym.installHintClosed';

// En iPhone/iPad, desde Safari, explica como instalar la app en la pantalla
// de inicio (iOS no muestra un boton de instalar por su cuenta).
export default function InstallHint() {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const installed = window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
  const [closed, setClosed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  if (!isIos || installed || closed || Capacitor.isNativePlatform()) return null;

  const close = () => {
    setClosed(true);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // nada
    }
  };

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
