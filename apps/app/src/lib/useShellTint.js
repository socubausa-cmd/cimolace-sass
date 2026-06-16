import { useState, useEffect, useCallback } from 'react';

/**
 * Teinte du back-office LIRI (zone de contenu) : « light » (crème) ou « dark » (sombre historique).
 * - Persistée dans localStorage (`liri-shell-tint`) → le choix suit l'utilisateur d'un écran à l'autre.
 * - Synchronisée entre composants (owner ↔ secrétariat, plusieurs onglets) via un événement custom + `storage`.
 * - Défaut : « light » (le fond crème demandé), basculable vers le sombre d'origine.
 *
 * N'affecte QUE les surfaces qui passent `lightContent` au shell (la sidebar LORI reste sombre/or).
 */
const KEY = 'liri-shell-tint';
const EVT = 'liri-shell-tint-change';

export function getInitialTint() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch { /* SSR / accès refusé */ }
  return 'dark'; // sombre par défaut (bascule vers crème via le bouton)
}

export function useShellTint() {
  const [tint, setTint] = useState(getInitialTint);

  useEffect(() => {
    const sync = () => setTint(getInitialTint());
    window.addEventListener(EVT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const toggleTint = useCallback(() => {
    const next = getInitialTint() === 'light' ? 'dark' : 'light';
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
    setTint(next);
    window.dispatchEvent(new Event(EVT));
  }, []);

  return [tint, toggleTint];
}
