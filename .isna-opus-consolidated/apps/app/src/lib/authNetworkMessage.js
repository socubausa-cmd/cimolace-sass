/**
 * Messages utilisateur quand Supabase / le réseau échoue (surtout mobile Capacitor).
 */
export function formatLoginErrorMessage(err, { isNative = false } = {}) {
  const raw = String(err?.message ?? err ?? '').trim();
  if (!raw) return 'Une erreur est survenue.';

  const lower = raw.toLowerCase();
  const isNetwork =
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower === 'load failed' ||
    lower.includes('erreur réseau');

  if (isNetwork) {
    if (isNative) {
      return (
        "L'app n'a pas pu joindre Supabase. Causes fréquentes : variables VITE_SUPABASE_URL / " +
        'VITE_SUPABASE_ANON_KEY absentes au moment du build (ajouter .env puis npm run cap:sync) ; projet Supabase ' +
        'en pause ; mauvaise URL sur émulateur (préférer https://votre-projet.supabase.co). Vérifiez aussi le Wi‑Fi.'
      );
    }
    return (
      "Impossible de joindre le serveur d'authentification. Vérifiez votre connexion, " +
      'que le projet Supabase est actif (non en pause), puis réessayez.'
    );
  }

  return raw;
}
