/**
 * Spécification du cadre immersif « théâtre » — SmartBoard + vidéos + salon.
 *
 * Ratio cible du bloc scène (zone spectateur / diapo) : 16:9 pour coller aux diapos
 * post-production et au cadrage global. Les panneaux vidéo restent en portrait (3/4)
 * pour l'interlocuteur et la miniature chevauchée (HostMiniPreview).
 *
 * Zones (de haut en bas, desktop lg+) :
 *  ┌──────────────────────────────────────────────────────────────┐
 *  │ RAIL « Salon » — miniatures participants + compteur diapos     │
 *  ├────────────────────────────┬─────────────────────────────────┤
 *  │ Colonne A : vidéo principale │ Colonne B : SmartBoard 16:9    │
 *  │  (spectateur voit surtout    │  (diapo préconstruite, écran,   │
 *  │   l'interlocuteur / hôte)    │   web, image — ratio préservé)  │
 *  │  + mini flux (chevauché)     │                                 │
 *  ├────────────────────────────┴─────────────────────────────────┤
 *  │ Tiroir messagerie (LiveMessageDrawer) — saisie / fil          │
 *  └──────────────────────────────────────────────────────────────┘
 *
 * Ne pas réduire arbitrairement la colonne SmartBoard : min-h + aspect-video interne.
 */
export const IMMERSIVE_STAGE = {
  /** Ratio largeur/hauteur recommandé pour la zone diapo / SmartBoard */
  smartBoardAspect: '16 / 9',
  /** Classe Tailwind appliquée au conteneur SmartBoard pour verrouiller la hauteur */
  smartBoardHeightClass: 'h-[min(70vh,740px)]',
  /** Pleine largeur viewport (plus de bandes vides latérales sur grands écrans) */
  maxTheatreWidthClass: 'w-full max-w-none',
};
