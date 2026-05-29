import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SupabaseProvider } from './lib/auth';
import { BrandingProvider } from './lib/branding';
import App from './App';
import './index.css';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SupabaseProvider url={import.meta.env.VITE_SUPABASE_URL || ''} anonKey={import.meta.env.VITE_SUPABASE_ANON_KEY || ''}>
      <BrandingProvider>
        <App />
      </BrandingProvider>
    </SupabaseProvider>
  </StrictMode>
);
