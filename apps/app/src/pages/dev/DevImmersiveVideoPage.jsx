import React from 'react';
import ImmersiveVideoPlayer from '@/components/school/formations/ImmersiveVideoPlayer';

/**
 * DEV — banc d'essai du player vidéo immersif. Passe ?src=<url> pour une vraie vidéo.
 * Transcription/chapitres d'exemple pour valider le rendu synchronisé.
 */
const SAMPLE_LINES = [
  "Bienvenue dans cette session de l'arbre du Manikongo.",
  "Aujourd'hui nous entrons dans le cœur de la transmission.",
  "Le symbole n'est pas une image morte, il est une porte.",
  "Chaque racine de l'arbre raconte une lignée, une mémoire.",
  "Observez comment la sève monte, lentement, du sol vers la lumière.",
  "C'est exactement le chemin de la connaissance en nous.",
  "Nous allons d'abord poser le vocabulaire, puis le vécu.",
  "Un mot mal compris ferme la porte du sens.",
  "Prenons le temps de nommer ce que nous ressentons.",
  "La spiritualité n'exclut jamais la rigueur.",
  "Au contraire, elle l'exige, comme la racine exige la terre.",
  "Regardez ce croquis : le tronc relie deux mondes.",
  "En bas l'invisible, en haut le manifesté.",
  "Votre travail cette semaine sera d'observer cette montée.",
  "Notez chaque jour un signe, même minuscule.",
  "La discipline douce vaut mieux que l'effort violent.",
  "Nous reviendrons sur vos observations la prochaine fois.",
  "Merci pour votre présence et votre attention.",
];

function buildCues(nLoops = 3, step = 26) {
  const cues = [];
  let t = 4;
  for (let l = 0; l < nLoops; l++) {
    for (const line of SAMPLE_LINES) { cues.push({ t, text: line }); t += step + (l % 2 ? 6 : 0); }
  }
  return cues;
}

export default function DevImmersiveVideoPage() {
  const params = new URLSearchParams(window.location.search);
  const [sample, setSample] = React.useState(null);
  React.useEffect(() => {
    if (params.get('src')) return;
    fetch('/_dev-sample.json').then((r) => (r.ok ? r.json() : null)).then(setSample).catch(() => {});
  }, []);
  const src = params.get('src') || sample?.src || 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
  const title = params.get('title') || sample?.title || "L'arbre du Manikongo — 11 avril 2026";

  // Mode intégré (coque classe OS) : ?embedded=1
  if (params.get('embedded')) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#262624', color: '#f4efe6', fontFamily: "'Source Serif 4', Georgia, serif", display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 26px 8px', fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600 }}>Jour 3 — L'invocation (coque classe OS)</div>
        <div style={{ display: 'flex', gap: 8, padding: '0 26px 12px' }}>
          {['Vidéo', 'Support', 'Quiz', 'Mindmap'].map((t, i) => (
            <span key={t} style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: i === 0 ? '1px solid #d97757' : '1px solid rgba(245,244,238,.1)', background: i === 0 ? 'rgba(217,119,87,.16)' : 'transparent', color: i === 0 ? '#f0c3ac' : 'rgba(245,244,238,.6)' }}>{t}</span>
          ))}
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px clamp(16px,6vw,90px) 60px' }}>
          <div style={{ width: '100%', maxWidth: 1100 }}>
            <ImmersiveVideoPlayer embedded src={src} title={title} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <ImmersiveVideoPlayer
      src={src}
      title={title}
      description="Session enregistrée du parcours — revois-la quand tu veux, navigue par chapitres et suis la transcription."
      crumb={{ module: "L'arbre du Manikongo", semaine: 'Semaine 6', jour: 'Jour 3' }}
      cues={buildCues()}
      onExit={() => window.history.back()}
    />
  );
}
