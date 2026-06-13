import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import '@/index.css';
import '@/styles/liri-brand-theme.css';
import App from '@/App';
import { hydrateHostTenant } from '@/lib/tenantResolver';

// Multi-tenant : résout le tenant depuis le domaine custom (tenant_domains) et le
// met en cache pour les chargements suivants — un nouveau domaine perso fonctionne
// sans modifier le code. Non bloquant. Cf. docs/CIMOLACE_ARCHITECTURE.md §7.
void hydrateHostTenant();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>
);
