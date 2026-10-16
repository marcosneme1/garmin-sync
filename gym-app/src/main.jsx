import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Version web (iPhone / navegador): modo sin conexion y pedir que el
// navegador no borre los datos guardados. En la app Android no hace falta.
if (!Capacitor.isNativePlatform() && import.meta.env.PROD) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
  navigator.storage?.persist?.().catch(() => {});
}
