// Global styles first, so component styles (imported by App) can override them.
import './styles/tokens.css';
import './styles/base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installErrorReporting } from './platform/analytics';
import { reloadForNewBuild } from './platform/freshBuild';
import { isDiscordLaunch, setEmbedHost } from './platform/embed';
import { DISCORD } from './platform/env';
import { startLiveCatalog } from './platform/liveCatalog';
import { startI18n } from './i18n';
import { loadGamePage } from './pages/loadGamePage';
import { matchRoute } from './router/router';

installErrorReporting();
// A code file from an older deploy is gone: reload into the new build (see platform/freshBuild.ts).
window.addEventListener('vite:preloadError', (e) => {
  if (reloadForNewBuild()) e.preventDefault();
});
startLiveCatalog();

// Launched as a Discord Activity: Discord opens "/" with its own query (frame_id, instance_id, …);
// its start page is /discord (docs/discord-activity.md). The query stays for the Discord SDK.
if (DISCORD.enabled && isDiscordLaunch(location.search)) {
  setEmbedHost({ kind: 'discord' });
  if (location.pathname === '/' || location.pathname === '/index.html') history.replaceState(null, '', `/discord${location.search}`);
}

const root = document.getElementById('root');
// The chosen language's words load first (English needs none), so the page never flashes English.
// A game page waits for its own code too (its HTML preloads it), so it renders in one go.
const pageCode = matchRoute(location.pathname).name === 'game' ? loadGamePage().catch(() => undefined) : undefined;
void Promise.all([startI18n(), pageCode]).then(() => {
  if (!root) return;
  // The prerendered HTML inside #root is for crawlers and no-JS visitors; React replaces it.
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
