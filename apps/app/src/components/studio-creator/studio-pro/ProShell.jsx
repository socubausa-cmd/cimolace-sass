/**
 * ProShell — Layout canonique "logiciel d'édition pro"
 *
 *   +----------------------------------------------------+
 *   |                 ProTopBar                          |
 *   +------+----------------------------------+----------+
 *   |      |                                  |          |
 *   | SIDE |           MAIN (viewport)        | INSPECTOR|
 *   | RAIL |                                  |          |
 *   |      |                                  |          |
 *   +------+----------------------------------+----------+
 *   |                  ProStatusBar                      |
 *   +----------------------------------------------------+
 *
 * Tout est optionnel. N'impose aucun contenu — c'est une shell pure.
 *
 * ── Positionnement : `absolute; inset:0`, volontairement conservé ────────────
 * Monté SEUL, aucun ancêtre positionné → le bloc conteneur est le viewport,
 * donc plein écran, exactement comme avant. Monté DANS la coque du portail,
 * `.lp-shell-main` est `position:relative` ET porte `transform:translateZ(0)`
 * (LiriPortal.css) : il devient le bloc conteneur, et la shell se confine
 * d'elle-même sous la topbar/le rail, sans conditionnel ni détection JS.
 *
 * ── Atmosphère (nouveau) ────────────────────────────────────────────────────
 * L'ambiance est peinte en CSS pur, via `::before`/`::after` sur la racine, et
 * PAS en nœuds DOM : aucun enfant ajouté, donc aucune page existante ne voit
 * son arbre flex changer.
 *
 * Les couches sont posées en `z-index:-1`, et la racine porte
 * `isolation:isolate`. C'est le point important : la racine devient un
 * contexte d'empilement, donc un z-index négatif s'y trouve borné — il peint
 * AU-DESSUS du fond de la racine et EN DESSOUS du contenu, sans qu'aucun
 * enfant n'ait à être remonté. L'alternative évidente (`> * { position:
 * relative; z-index:1 }`) aurait marché visuellement mais aurait fait des
 * enfants directs de nouveaux blocs conteneurs : tout `position:absolute`
 * d'une page se serait mis à s'ancrer sur la ligne du milieu au lieu de la
 * shell, déplaçant en silence des surcouches déjà en place. Ici, le
 * positionnement de chaque enfant reste rigoureusement celui d'avant.
 *
 * Le contenu est visible par défaut : l'animation n'anime QUE la couche
 * décorative, jamais l'opacité de ce qu'il y a à lire (un rendu sans JS ni
 * animation affiche la page complète).
 */
import React from 'react';
import { proColors, proType } from './tokens';

export function ProShell({
  topBar = null,
  sideRail = null,
  inspector = null,
  statusBar = null,
  dock = null,
  children,
}) {
  return (
    <div
      className="pro-shell-root"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: proColors.surface0,
        color: proColors.textPrimary,
        fontFamily: proType.ui,
        fontSize: proType.base,
        overflow: 'hidden',
        // Borne les couches d'ambiance en z-index négatif à l'intérieur de la
        // shell (cf. en-tête de fichier). Sans cela elles passeraient DERRIÈRE
        // le fond opaque de la racine et seraient invisibles.
        isolation: 'isolate',
        // Respiration exposée aux pages qui VEULENT l'utiliser. Volontairement
        // non appliquée ici : imposer un padding à la shell retirerait de la
        // place au contenu sur toutes les pages existantes.
        '--pro-gutter': 'clamp(16px, 1.6vw, 40px)',
      }}
    >
      {/* Scrollbar chaude + keyframes + couches d'ambiance, injectées une fois. */}
      <style>{`
        @keyframes proPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        /* Respiration du halo : très lente et de faible amplitude — on veut une
           présence, pas un clignotement dans le champ de vision d'un monteur. */
        @keyframes proBreathe {
          0%, 100% { opacity: .55; transform: translateX(-50%) scale(1); }
          50%      { opacity: .9;  transform: translateX(-50%) scale(1.06); }
        }
        /* Halo coral suspendu au-dessus du plan de travail. */
        .pro-shell-root::before {
          content: ''; position: absolute; z-index: -1; pointer-events: none;
          top: -16%; left: 50%; transform: translateX(-50%);
          width: min(1280px, 94%); height: 46%;
          border-radius: 50%; filter: blur(10px);
          background: radial-gradient(closest-side, rgba(217,119,87,0.17), rgba(217,119,87,0) 72%);
          animation: proBreathe 11s ease-in-out infinite;
        }
        /* Lavis d'or en bas à droite + vignette : donnent une profondeur de
           scène au lieu du plat uniforme d'un panneau de contrôle. */
        .pro-shell-root::after {
          content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none;
          background: radial-gradient(940px 580px at 108% 118%, rgba(230,204,146,0.07), transparent 60%);
          box-shadow: inset 0 0 240px 64px rgba(0,0,0,0.42);
        }
        .pro-scroll::-webkit-scrollbar { width: 9px; height: 9px; }
        .pro-scroll::-webkit-scrollbar-track { background: transparent; }
        .pro-scroll::-webkit-scrollbar-thumb { background: rgba(217,119,87,0.26); border-radius: 8px; }
        .pro-scroll::-webkit-scrollbar-thumb:hover { background: rgba(217,119,87,0.42); }
        .pro-scroll { scrollbar-width: thin; scrollbar-color: rgba(217,119,87,0.30) transparent; }
        /* Mouvement réduit : le halo reste, figé à mi-course. On ne retire
           jamais la couche (sinon l'ambiance disparaît pour ces utilisateurs). */
        @media (prefers-reduced-motion: reduce) {
          .pro-shell-root::before { animation: none; opacity: .72; }
        }
      `}</style>
      {topBar}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        {sideRail}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
            <div
              className="pro-scroll"
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                // `transparent` et non surface0 : c'est ce qui laisse le halo et
                // le lavis d'or traverser jusque sous le contenu. Le fond opaque
                // de la racine reste la couleur de repli.
                background: 'transparent',
                overflow: 'auto',
              }}
            >
              {children}
            </div>
            {inspector}
          </div>
          {dock}
        </div>
      </div>
      {statusBar}
    </div>
  );
}
