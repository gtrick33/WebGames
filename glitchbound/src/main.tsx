// Global styles first, so component styles (imported by App) can override them.
import './styles/tokens.css';
import './styles/base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installErrorReporting } from './platform/analytics';
import { startLiveCatalog } from './platform/liveCatalog';
import { startI18n } from './i18n';

installErrorReporting();
startLiveCatalog();

const root = document.getElementById('root');
// The chosen language's words load first (English needs none), so the page never flashes English.
void startI18n().then(() => {
  if (!root) return;
  // The prerendered HTML inside #root is for crawlers and no-JS visitors; React replaces it.
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
