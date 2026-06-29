// ─────────────────────────────────────────────────────────────────────────────
// Écran de DÉMARRAGE de la salle immersive (téléconsultation / live).
//
// Affiché pendant le boot du handoff cross-origin (MEDOS → app.cimolace.space) :
// chargement de l'app + auth + chunk lazy + connexion LiveKit. Remplace le spinner
// nu par le LOGO OFFICIEL LIRI (mark doré + inscription « LIRI ») sur un badge clair
// (l'or ressort sur le fond sombre), animé, + une phrase explicite + une barre de
// progression. Plein écran (zIndex max) pour couvrir tout shell résiduel.
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
        {/* Logo officiel LIRI (mark + inscription « LIRI ») sur badge clair, animé. */}
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 22 }}>
          <div style={{ position: 'absolute', inset: -26, borderRadius: 30, background: 'radial-gradient(circle, rgba(217,119,87,0.32), transparent 70%)', animation: 'liriboot-glow 2.4s ease-in-out infinite' }} />
          <div style={{ position: 'relative', padding: '16px 22px', borderRadius: 20, background: '#ffffff', boxShadow: '0 18px 50px rgba(0,0,0,0.55)', animation: 'liriboot-breathe 2.4s ease-in-out infinite' }}>
            <img src="/liri-logo-official.png" alt="LIRI" style={{ display: 'block', height: 96, width: 'auto', objectFit: 'contain' }} />
          </div>
        </div>
        <h2 style={{ margin: '0 0 7px', fontSize: 17, fontWeight: 600, color: '#fff', letterSpacing: 0.2 }}>{message}</h2>
        <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>{submessage}</p>
        {/* Barre de progression indéterminée (on-brand terracotta). */}
        <div style={{ width: 200, height: 3, margin: '18px auto 0', borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ width: '40%', height: '100%', borderRadius: 3, background: '#d97757', animation: 'liriboot-progress 1.4s ease-in-out infinite' }} />
        </div>
      </div>
      <style>{`
        @keyframes liriboot-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
        @keyframes liriboot-glow { 0%, 100% { opacity: 0.4; transform: scale(0.94); } 50% { opacity: 1; transform: scale(1.1); } }
        @keyframes liriboot-progress { 0% { transform: translateX(-120%); } 100% { transform: translateX(330%); } }
      `}</style>
    </div>
  );
}
