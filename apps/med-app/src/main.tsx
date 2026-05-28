import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SupabaseProvider } from '@isna/ui/auth';
import App from './App';
import './index.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SupabaseProvider url={supabaseUrl} anonKey={supabaseKey}>
      <App />
    </SupabaseProvider>
  </StrictMode>
);
