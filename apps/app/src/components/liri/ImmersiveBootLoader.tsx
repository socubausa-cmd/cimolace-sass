// ─────────────────────────────────────────────────────────────────────────────
// Écran de DÉMARRAGE de la salle immersive (téléconsultation / live).
//
// Affiché pendant le boot du handoff cross-origin (MEDOS → app.cimolace.space) :
// chargement de l'app + auth + chunk lazy + connexion LiveKit. Remplace le spinner
// nu par le LOGO LIRI ANIMÉ (le même que le portail, /lirilogo.png) + une phrase
// explicite. Plein écran (zIndex max) pour couvrir tout shell résiduel.
// ─────────────────────────────────────────────────────────────────────────────
export default function ImmersiveBootLoader({
  message = 'Démarrage de votre salle immersive',
  submessage = 'Connexion à la consultation en cours…',
}: {
  message?: string;
  submessage?: string;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: '#0b0b0c', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        {/* Logo LIRI animé : respiration + anneau d'accent rotatif + halo clair. */}
        <div style={{ position: 'relative', width: 124, height: 124, margin: '0 auto 16px' }}>
          {/* halo clair qui « lève » le mark doré sur le fond sombre */}
          <div style={{ position: 'absolute', inset: -24, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.10) 0%, rgba(217,119,87,0.28) 38%, transparent 72%)', animation: 'liriboot-glow 2.2s ease-in-out infinite' }} />
          {/* anneau d'accent rotatif */}
          <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#d97757', borderRightColor: 'rgba(217,119,87,0.45)', animation: 'liriboot-spin 1.1s linear infinite' }} />
          {/* le logo (le même que le portail LIRI) */}
          <img
            src="/lirilogo.png"
            alt="LIRI"
            style={{ position: 'absolute', inset: 12, width: 'calc(100% - 24px)', height: 'calc(100% - 24px)', objectFit: 'contain', filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.55))', animation: 'liriboot-breathe 2.2s ease-in-out infinite' }}
          />
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: 4, color: '#fff', marginBottom: 16 }}>LIRI</div>
        <h2 style={{ margin: '0 0 7px', fontSize: 17, fontWeight: 600, color: '#fff', letterSpacing: 0.2 }}>{message}</h2>
        <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>{submessage}</p>
      </div>
      <style>{`
        @keyframes liriboot-spin { to { transform: rotate(360deg); } }
        @keyframes liriboot-breathe { 0%, 100% { transform: scale(1); opacity: 0.92; } 50% { transform: scale(1.06); opacity: 1; } }
        @keyframes liriboot-glow { 0%, 100% { opacity: 0.45; transform: scale(0.92); } 50% { opacity: 1; transform: scale(1.12); } }
      `}</style>
    </div>
  );
}
