import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { resolveVitrineContactEmailSync } from '@/lib/vitrineContactEmail';

const VitrineContactEmailContext = createContext(null);

function parseContactEmailValue(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  try {
    const s = JSON.stringify(value);
    const parsed = JSON.parse(s);
    return typeof parsed === 'string' ? parsed.trim() : '';
  } catch {
    return '';
  }
}

/**
 * Fournit l'e-mail vitrine effectif (DB `app_settings` si disponible, sinon sync).
 * À placer sous `<Router>` pour que toutes les pages vitrine y aient accès.
 */
export function VitrineContactEmailProvider({ children }) {
  const [email, setEmail] = useState(() => resolveVitrineContactEmailSync());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'contact_email')
          .maybeSingle();
        if (cancelled || error || data == null) return;
        const parsed = parseContactEmailValue(data.value);
        if (parsed && parsed.includes('@')) {
          setEmail(parsed);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <VitrineContactEmailContext.Provider value={email}>{children}</VitrineContactEmailContext.Provider>;
}

/** E-mail vitrine (contexte). Hors provider : même logique que `resolveVitrineContactEmailSync`. */
export function useVitrineContactEmail() {
  const v = useContext(VitrineContactEmailContext);
  if (v == null || v === '') return resolveVitrineContactEmailSync();
  return v;
}
