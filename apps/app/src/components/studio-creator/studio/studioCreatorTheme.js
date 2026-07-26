/**
 * Thème visuel commun — Studio créateur → arène (or chaud / #0a0908, verre, typo display).
 * Référence pour classes cohérentes ; les composants peuvent dupliquer les chaînes si besoin.
 *
 * POURQUOI CE FICHIER EST LE PLUS SENSIBLE DE LA PASSE COULEUR.
 * C'est un module PARTAGÉ, et ce qu'il exporte sont des chaînes de classes Tailwind
 * ARBITRAIRES (`border-[#…]`). Aucun neutraliseur CSS ne peut les rattraper : les
 * sélecteurs d'attribut de studioWarm.css visent des classes précises, et une variable
 * CSS ne s'interpose pas ici puisque la couleur est écrite en dur dans le nom de classe.
 * L'or FROID (D4AF37) qui vivait ici teintait donc en froid, À LA SOURCE, tous ses
 * importeurs, sans recours possible en aval :
 *   · StudioBuilder.jsx            → coque + en-tête de TOUS les studios créateur
 *                                    (Formation, Coaching, Rendez-vous, Événement, Cours) ;
 *   · LivePreparationStudioPage.jsx → carte, modale et focus de champ du studio live.
 *
 * L'or de la charte chaude remplace l'or froid : accent #d99a4e, encre #e6b878.
 */
export const studioCreatorShellBg = 'bg-[#0a0908]';

/**
 * En-tête : simple filet de séparation, rôle décoratif (12 % d'alpha) — l'ACCENT
 * #d99a4e suffit, il ne porte aucune information à lui seul.
 */
export const studioCreatorHeader =
  'border-b border-[#d99a4e]/12 bg-[#0a0908]/92 backdrop-blur-xl';

/**
 * Modale : la bordure détoure une surface flottante au-dessus du reste de l'écran.
 * Même rôle structurel que l'en-tête, un cran plus affirmé (20 %) → ACCENT.
 */
export const studioCreatorModal =
  'rounded-2xl border border-[#d99a4e]/20 bg-[#0a0908]/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl';

/** Carte : même rôle de détourage que la modale, plus discret encore (15 %) → ACCENT. */
export const studioCreatorCard =
  'rounded-2xl border border-[#d99a4e]/15 bg-[#0f0d0b]/80 backdrop-blur-md';

/**
 * Focus de champ : la SEULE occurrence porteuse de sens du module — elle dit
 * « le clavier écrit ICI ». Elle passe donc sur l'ENCRE #e6b878, plus claire que
 * l'accent, et son alpha monte de 45 % à 60 %.
 * Mesuré sur les deux fonds de champ que rencontre ce module :
 *   bordure #e6b878/60 → 4,42:1 sur #0f0d0b (carte) et 3,81:1 sur #2b2a27 (champ charte),
 * au-delà des 3:1 exigés d'un indicateur de focus. L'ancien or froid D4AF37 à 45 % plafonnait
 * à 2,47:1 : le focus était sous la norme, pas seulement froid.
 * Le `ring` reste un halo décoratif à 25 % : c'est la BORDURE qui porte le signal.
 */
export const studioCreatorInputFocus =
  'focus:border-[#e6b878]/60 focus:ring-1 focus:ring-[#e6b878]/25';
