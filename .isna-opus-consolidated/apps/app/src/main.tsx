import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Styles V1 — Tailwind + thème LIRI + variables CSS
import '@/index.css';
import '@/styles/liri-brand-theme.css';

// App V1 — contient tous les providers et le routeur complet
import App from '@/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
