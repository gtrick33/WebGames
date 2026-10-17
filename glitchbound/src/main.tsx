// Global styles first, so component styles (imported by App) can override them.
import './styles/tokens.css';
import './styles/base.css';
import './styles/intro.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = document.getElementById('root');
if (root) {
  // The prerendered HTML inside #root is for crawlers and no-JS visitors; React replaces it.
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
