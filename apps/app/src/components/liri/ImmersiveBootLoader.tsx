// ─────────────────────────────────────────────────────────────────────────────
// Écran de DÉMARRAGE de la salle immersive (téléconsultation / live).
//
// Style IMMERSIF (même langage que la page de connexion LIRI) : logo officiel LIRI
// (mark doré + inscription « LIRI », PNG transparent) directement sur fond sombre —
// PAS de boîte blanche — avec halo flou + anneaux concentriques qui irradient.
// PERSONNALISÉ : nom de la clinique (image de marque/confiance) + phrase sécurité.
// Le nom de la clinique vient du slug `?tenant=` via l'endpoint public branding.
// Plein écran (zIndex max) pour couvrir tout shell résiduel.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/apiBase';

export default function ImmersiveBootLoader({
  message = 'Connexion sécurisée à votre consultation',
}: {
  message?: string;
}) {
  const [clinic, setClinic] = useState<string | null>(null);

  // Nom d'affichage de la clinique (ex. « Zahir Wellness ») → image de marque /
  // confiance dès le chargement. Résolu par le slug `?tenant=` (branding public).
  useEffect(() => {
    let alive = true;
    try {
      const slug = new URLSearchParams(window.location.search).get('tenant');
      if (!slug) return undefined;
      fetch(`${getApiBaseUrl()}/tenants/by-slug/${encodeURIComponent(slug)}/branding`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          const n = j?.data?.name || j?.name;
          if (alive && n) setClinic(String(n));
        })
        .catch(() => {});
    } catch {
      /* ignore */
    }
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: '#0b0b0c', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        {/* Logo immersif : official LIRI (mark + inscription LIRI, transparent) +
            halo flou + anneaux concentriques qui irradient. AUCUNE boîte. */}
        <div style={{ position: 'relative', width: 240, height: 200, margin: '0 auto 18px', display: 'grid', placeItems: 'center' }}>
          {[0, 0.7, 1.4].map((d) => (
            <span key={d} style={{ position: 'absolute', width: 190, height: 190, borderRadius: '50%', border: '1px solid rgba(217,119,87,0.32)', animation: `liriboot-ripple 3.2s ease-out ${d}s infinite` }} />
          ))}
          <span style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', background: 'rgba(217,119,87,0.22)', filter: 'blur(44px)', animation: 'liriboot-glow 2.6s ease-in-out infinite' }} />
          <img
            src="/liri-logo-official.png"
            alt="LIRI"
            decoding="async"
            style={{ position: 'relative', zIndex: 2, width: 200, height: 144, objectFit: 'contain', filter: 'drop-shadow(0 0 38px rgba(217,119,87,0.45))', animation: 'liriboot-breathe 2.6s ease-in-out infinite' }}
          />
        </div>

        {/* Clinique (image de marque / confiance). */}
        {clinic ? <div style={{ fontSize: 17.5, fontWeight: 700, color: '#fff', marginBottom: 5, letterSpacing: 0.2 }}>{clinic}</div> : null}

        {/* Phrase action / sécurité. */}
        <h2 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 500, color: '#cbd5e1', lineHeight: 1.45 }}>{message}</h2>

        {/* Barre de progression indéterminée (on-brand terracotta). */}
        <div style={{ width: 200, height: 3, margin: '0 auto 16px', borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ width: '40%', height: '100%', borderRadius: 3, background: '#d97757', animation: 'liriboot-progress 1.4s ease-in-out infinite' }} />
        </div>

        {/* Footer sécurité + marque. */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#6b7280' }}>
          <Lock size={12} aria-hidden="true" /> Liaison sécurisée · propulsé par LIRI
        </div>
      </div>
      <style>{`
        @keyframes liriboot-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
        @keyframes liriboot-glow { 0%, 100% { opacity: 0.45; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1.08); } }
        @keyframes liriboot-ripple { 0% { transform: scale(0.5); opacity: 0.85; } 100% { transform: scale(1.3); opacity: 0; } }
        @keyframes liriboot-progress { 0% { transform: translateX(-120%); } 100% { transform: translateX(330%); } }
      `}</style>
    </div>
  );
}
