import React from 'react';
import { createPortal } from 'react-dom';

/**
 * BASCULE SITE ↔ NAVIGATION IMMERSIVE (prorascience.org).
 *
 * Décision fondateur du 2026-08-02 : l'agent immersif n'est plus imposé à
 * l'arrivée. Le site classique accueille le visiteur, et l'immersif devient un
 * CHOIX, porté par ce bouton.
 *
 * ⚠️ Le rechargement complet (`window.location.assign`) est VOULU : le mode est
 * décidé à la racine de l'application (`RootRedirect` dans App.jsx), qui monte
 * soit la vitrine soit l'agent. Une navigation React ne changerait pas l'arbre
 * déjà monté — l'utilisateur cliquerait sans rien voir changer.
 *
 * Le paramètre d'URL sert de secours quand le stockage local est indisponible
 * (navigation privée) : il suffit à imposer le mode au chargement suivant.
 *
 * ⚠️ POSITION : la pastille se rend par PORTAIL dans <body>, ancrée en BAS À DROITE. Elle était
 * auparavant centrée en bas (conteneur fixe d'App.jsx) — pile sur l'axe des boutons d'achat, qui
 * sont en pleine largeur sous 1024 px : un tap manqué rechargeait la page dans l'agent et faisait
 * perdre le tunnel. Le portail est nécessaire car le conteneur d'appel porte un `translate`, qui
 * crée un bloc conteneur pour tout enfant `position: fixed`.
 */
export default function ImmersiveModeToggle({ active = false, className = '', flottant = true }) {
  const basculer = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('os', active ? '0' : '1');
      window.location.assign(url.toString());
    } catch {
      window.location.assign(active ? '/?os=0' : '/?os=1');
    }
  };

  const bouton = (
    <button
      type="button"
      onClick={basculer}
      title={active
        ? 'Revenir au site Prorascience'
        : 'Explorer le site guidé par l’agent, en plein écran'}
      aria-pressed={active}
      className={[
        'inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-medium',
        'transition-colors backdrop-blur',
        active
          ? 'border-white/20 bg-black/50 text-white/80 hover:bg-black/70'
          : 'border-[color:var(--school-accent,#D4AF37)]/40 bg-[color:var(--school-accent,#D4AF37)]/[0.12] text-[color:var(--school-accent,#D4AF37)] hover:bg-[color:var(--school-accent,#D4AF37)]/20',
        className,
      ].join(' ')}
    >
      <span aria-hidden="true">{active ? '↩' : '✦'}</span>
      {active ? 'Revenir au site' : 'Navigation immersive'}
    </button>
  );

  if (!flottant || typeof document === 'undefined') return bouton;

  return createPortal(
    <div className="fixed bottom-4 right-4 z-[2147480000]">{bouton}</div>,
    document.body,
  );
}
