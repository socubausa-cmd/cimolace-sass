import { useEffect, useState } from 'react';

/**
 * useEcran — le point de rupture PARTAGÉ du portail LIRI.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI CE FICHIER EXISTE
 * ════════════════════════════════════════════════════════════════════════════
 * Le portail comptait **13 calculs de largeur écrits à la main**, sur TROIS
 * seuils différents (`innerWidth < 768` ×9, `< 900` ×2, `< 640` ×2), chacun avec
 * son propre `addEventListener('resize')`. Conséquences vécues :
 *   • deux écrans voisins basculaient en mobile à des largeurs différentes ;
 *   • chaque `resize` déclenchait un rendu React, même quand le booléen ne
 *     changeait pas (un glissement de 1100 → 1000 px re-rendait pour rien) ;
 *   • personne ne mesurait le MOYEN DE POINTAGE, seulement la largeur.
 *
 * ⭐ LA LARGEUR NE DIT PAS COMMENT ON TOUCHE L'ÉCRAN. Un portable à écran
 * tactile est large ET tactile ; une fenêtre étroite sur un Mac est étroite ET
 * à la souris. Dimensionner les cibles sur la seule largeur donne des boutons
 * de 44 px à la souris (lourd) et de 36 px au doigt (raté). D'où `tactile`,
 * mesuré par `(pointer: coarse)` — la vraie question quand on dimensionne une
 * cible.
 *
 * `matchMedia` plutôt que `resize` : le navigateur ne nous réveille QUE lorsque
 * la réponse change réellement.
 *
 * @param {number} seuilEtroit largeur (px) sous laquelle la mise en page passe
 *   en colonne unique. Le défaut 768 est le seuil du portail ; un écran peut
 *   passer le SIEN quand son contenu casse ailleurs (le lecteur vidéo bascule à
 *   900 px, largeur sous laquelle son rail de transcription ne tient plus).
 *   C'est la règle « point de rupture dicté par le contenu », pas par le catalogue
 *   des tailles de téléphones.
 * @returns {{ etroit: boolean, tactile: boolean }}
 */
export function useEcran(seuilEtroit = 768) {
  const requete = `(max-width: ${seuilEtroit - 1}px)`;

  // Lecture synchrone au premier rendu : sans ça, un lecteur ouvert directement
  // sur mobile s'affiche une frame en version large, puis saute. Garde SSR incluse.
  const [etat, setEtat] = useState(() => ({
    etroit: typeof window !== 'undefined' && !!window.matchMedia?.(requete).matches,
    tactile: typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches,
  }));

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mLargeur = window.matchMedia(requete);
    const mPointage = window.matchMedia('(pointer: coarse)');
    const relire = () => setEtat({ etroit: mLargeur.matches, tactile: mPointage.matches });
    relire();
    // `addListener` : repli Safari < 14, encore répandu sur les iPhone d'Afrique
    // centrale — public réel de ce portail (cf. PRODUCT.md).
    const brancher = (m) => (m.addEventListener ? m.addEventListener('change', relire) : m.addListener(relire));
    const debrancher = (m) => (m.removeEventListener ? m.removeEventListener('change', relire) : m.removeListener(relire));
    brancher(mLargeur); brancher(mPointage);
    return () => { debrancher(mLargeur); debrancher(mPointage); };
  }, [requete]);

  return etat;
}

/**
 * Taille minimale d'une cible tactile. 44 px = plancher commun aux règles Apple
 * (HIG) et WCAG 2.5.5 (AAA). En dessous, on rate la cible au doigt — c'est
 * mesurable, pas une question de goût.
 */
export const CIBLE_TACTILE = 44;

/**
 * Dimensionne un contrôle : confortable au doigt, compact à la souris.
 * `base` est la taille historique à la souris ; au doigt on ne descend jamais
 * sous CIBLE_TACTILE.
 */
export function taillePointage(base, tactile) {
  return tactile ? Math.max(base, CIBLE_TACTILE) : base;
}

export default useEcran;
