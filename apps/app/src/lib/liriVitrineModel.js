/**
 * LIRI vs portail public (vitrine Prorascience / ISNA)
 *
 * - **Portail & vitrine** : site public (présentation, pédagogie, forfaits, prise de contact). La marque « Prorascience Academy »
 *   côté marketing désigne surtout ce volet.
 * - **LIRI** : l'**application** qui héberge les écoles partenaires — parcours élève, lives, messagerie, outils. Ce n'est pas la vitrine.
 *
 * **Connexion membre** : les utilisateurs qui veulent rejoindre leur **espace** doivent passer par les parcours **LIRI**
 * (route mobile `/m/eleve/...` ou, sur grand écran, `/login` qui reste l'entrée unifiée Supabase, avec préférence LIRI sur mobile
 * — voir `getLoginEntryPath` / `ELEVE_MOBILE`).
 *
 * @module liriVitrineModel
 */

export { getLoginEntryPath, shouldUseLiriMobileLogin } from './loginEntryPath';
export { ELEVE_MOBILE } from './eleveMobileRoutes';

/** Alias sémantique : URL de connexion vers l'espace applicatif (LIRI), selon le contexte (mobile / desktop). */
export { getLoginEntryPath as getLiriMemberLoginPath } from './loginEntryPath';
