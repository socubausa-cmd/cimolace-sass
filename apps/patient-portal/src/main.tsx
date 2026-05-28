import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SupabaseProvider } from '@isna/ui/auth';
import App from './App';
import './index.css';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SupabaseProvider url={import.meta.env.VITE_SUPABASE_URL || ''} anonKey={import.meta.env.VITE_SUPABASE_ANON_KEY || ''}>
      <App />
    </SupabaseProvider>
  </StrictMode>
);
