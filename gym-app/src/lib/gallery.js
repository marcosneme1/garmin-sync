// Galeria de GIFs guardados en el telefono (IndexedDB).
// La primera vez que se abre un ejercicio se arma un GIF animado con sus
// fotos y se guarda; desde ahi se muestra el GIF local, sin internet.

import { useEffect, useState } from 'react';
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { exName, imageUrls } from './exercises.js';

const DB_NAME = 'gymplan';
const STORE = 'gifs';
const GIF_WIDTH = 360;
const FRAME_DELAY_MS = 900;

let dbPromise = null;
const urls = new Map(); // id -> objectURL del GIF
const records = new Map(); // id -> registro sin el blob
const listeners = new Set();
let loaded = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const res = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(res?.result);
        t.onerror = () => reject(t.error);
      }),
  );
}

const notify = () => listeners.forEach((l) => l());

function remember(rec) {
  const { blob, ...meta } = rec;
  if (!urls.has(rec.id)) urls.set(rec.id, URL.createObjectURL(blob));
  records.set(rec.id, meta);
}

export function loadGallery() {
  if (!loaded) {
    loaded = tx('readonly', (s) => s.getAll())
      .then((all) => {
        all.forEach(remember);
        notify();
      })
      .catch(() => {}); // sin IndexedDB la app funciona igual, solo sin galeria
  }
  return loaded;
}

export const getGifUrl = (id) => urls.get(id) ?? null;

export const listGallery = () =>
  [...records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

// Re-renderiza el componente cuando cambia la galeria.
export function useGallery() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    loadGallery();
    return () => listeners.delete(l);
  }, []);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // necesario para leer los pixeles en el canvas
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo descargar la imagen'));
    img.src = src;
  });
}

async function buildGif(exercise) {
  const imgs = await Promise.all(imageUrls(exercise).map(loadImage));
  if (!imgs.length) throw new Error('El ejercicio no tiene imágenes');
  const w = GIF_WIDTH;
  const h = Math.round((imgs[0].naturalHeight / imgs[0].naturalWidth) * w);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const gif = GIFEncoder();
  for (const img of imgs) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    // Encajar la foto sin deformarla.
    const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    const { data } = ctx.getImageData(0, 0, w, h);
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), w, h, { palette, delay: FRAME_DELAY_MS });
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}

const pending = new Map();

// Devuelve el GIF guardado o lo crea y lo guarda. `name` es el nombre en
// español si se conoce (del plan, de Gemini o de la traduccion).
export async function ensureGif(exercise, name) {
  await loadGallery(); // evita regenerar un GIF que ya esta guardado
  const existing = records.get(exercise.id);
  if (existing) {
    if (name && name !== existing.name) {
      updateGif(exercise.id, { name });
    }
    return urls.get(exercise.id);
  }
  if (!pending.has(exercise.id)) {
    const p = buildGif(exercise)
      .then(async (blob) => {
        const rec = {
          id: exercise.id,
          name: name || exName(exercise),
          originalName: exercise.name,
          muscles: exercise.primaryMuscles,
          equipment: exercise.equipment,
          createdAt: new Date().toISOString(),
          blob,
        };
        await tx('readwrite', (s) => s.put(rec));
        remember(rec);
        notify();
        return urls.get(exercise.id);
      })
      .finally(() => pending.delete(exercise.id));
    pending.set(exercise.id, p);
  }
  return pending.get(exercise.id);
}

export async function updateGif(id, changes) {
  const rec = await tx('readonly', (s) => s.get(id));
  if (!rec) return;
  const next = { ...rec, ...changes };
  await tx('readwrite', (s) => s.put(next));
  records.set(id, { ...records.get(id), ...changes });
  notify();
}

export async function deleteGif(id) {
  await tx('readwrite', (s) => s.delete(id));
  const u = urls.get(id);
  if (u) URL.revokeObjectURL(u);
  urls.delete(id);
  records.delete(id);
  notify();
}

export async function clearGallery() {
  await tx('readwrite', (s) => s.clear());
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls.clear();
  records.clear();
  notify();
}
