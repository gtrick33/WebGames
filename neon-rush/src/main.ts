import '@fontsource/orbitron/latin-700.css';
import '@fontsource/orbitron/latin-900.css';
import './ui/styles.css';
import { App } from './app';

function setLoading(text: string): void {
  const el = document.getElementById('loading-text');
  if (el) el.textContent = text;
}

async function start(): Promise<void> {
  // Give the display font a brief chance so canvas text uses it; never block on it.
  await Promise.race([document.fonts?.load('900 20px Orbitron').catch(() => undefined), new Promise((r) => setTimeout(r, 800))]);
  const app = new App();
  await app.boot();
  document.getElementById('loading')?.classList.add('hidden');
  window.setTimeout(() => document.getElementById('loading')?.remove(), 600);
}

start().catch((err: unknown) => {
  console.error(err);
  setLoading('COULD NOT START. PLEASE RELOAD.');
});

// Offline support: cache the app shell after the first visit (production only).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err: unknown) => console.warn('[sw] registration failed', err));
  });
}
