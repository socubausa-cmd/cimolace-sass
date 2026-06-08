import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { getApiBaseUrl } from '@/lib/apiBase';
import { Loader2 } from 'lucide-react';

/**
 * Cross-app SSO landing. med-app opens /handoff?code=…&next=… so a
 * practitioner who is already logged into med-app lands authenticated in the
 * immersive Liri room WITHOUT a second login. The one-time code is exchanged
 * server-side for the session tokens (never in the URL), then we
 * supabase.auth.setSession(...) and redirect to `next`.
 */
export default function HandoffPage() {
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      let next = params.get('next') || '/studio';
      // Open-redirect guard: only allow same-origin relative paths.
      if (!next.startsWith('/') || next.startsWith('//')) next = '/studio';
      if (!code) { setError('Lien de connexion invalide (code manquant).'); return; }
      try {
        const res = await fetch(getApiBaseUrl() + '/auth/handoff/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        if (!res.ok) throw new Error('Lien expiré ou déjà utilisé.');
        const tokens = await res.json();
        const access_token = tokens?.access_token;
        const refresh_token = tokens?.refresh_token;
        if (!access_token || !refresh_token) throw new Error('Réponse de connexion invalide.');
        const { error: sErr } = await supabase.auth.setSession({ access_token, refresh_token });
        if (sErr) throw sErr;
        // Drop the code from history, then full-load the target so the app
        // re-bootstraps with the freshly-set session.
        window.history.replaceState({}, '', '/handoff');
        window.location.replace(next);
      } catch (e) {
        setError(e?.message || 'Échec de la connexion.');
      }
    })();
  }, []);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-[#0F1419] p-6">
      {!error ? (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-[#D4AF37]" />
          <p className="text-sm text-gray-400">Connexion à la salle…</p>
        </>
      ) : (
        <div className="max-w-sm rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-center space-y-3">
          <p className="text-sm font-medium text-red-200">{error}</p>
          <p className="text-xs text-red-300/80">
            Relance la téléconsultation depuis med-app, ou connecte-toi au studio.
          </p>
          <button
            type="button"
            onClick={() => window.location.replace('/login')}
            className="rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-medium text-black hover:bg-amber-500"
          >
            Aller à la connexion
          </button>
        </div>
      )}
    </div>
  );
}
