/**
 * Empreinte de la ligne `liri_course_workspaces` actuellement OUVERTE dans le Designer.
 *
 * ⛔ Pièce load-bearing anti-perte de données. Le Designer reconstruit son payload
 * ENTIÈREMENT depuis ses stores Zustand à chaque enregistrement ; sans cette empreinte,
 * l'UPDATE écrase toute clé que les stores ne savent pas produire (typiquement
 * `polotnoProject` des anciens workspaces v2) et écrase aussi, sans le voir, le travail
 * d'un autre onglet ou d'un co-éditeur.
 *
 * Deux garanties portées ici :
 *  1. `payload` = la charge utile TELLE QU'ELLE EST EN BASE au moment de l'ouverture →
 *     la sauvegarde FUSIONNE par-dessus au lieu de reconstruire (cf. mergeWorkspacePayloadOverBase).
 *  2. `updatedAt` = jeton de concurrence optimiste → l'UPDATE porte `.eq('updated_at', …)`,
 *     donc 0 ligne touchée = la fiche a bougé ailleurs → refus au lieu d'écrasement muet.
 *
 * Singleton module (pas un store React) : la couche Supabase, la page et le panneau Cloud
 * doivent voir EXACTEMENT la même empreinte, sinon la garantie saute au premier appelant oublié.
 */

/**
 * @typedef {{
 *   id: string;
 *   payload: Record<string, unknown> | null;
 *   updatedAt: string | null;
 *   canvasHydrated: boolean;
 *   legacyPolotnoOnly: boolean;
 * }} LiriWorkspaceBaseline
 */

/** @type {LiriWorkspaceBaseline | null} */
let baseline = null;

/**
 * Mémorise la ligne ouverte.
 * @param {{ id: string; payload?: unknown; updatedAt?: string | null; canvasHydrated?: boolean; legacyPolotnoOnly?: boolean }} args
 */
export function setWorkspaceBaseline({ id, payload, updatedAt, canvasHydrated, legacyPolotnoOnly }) {
  if (!id) return;
  baseline = {
    id: String(id),
    payload: payload && typeof payload === 'object' ? /** @type {Record<string, unknown>} */ (payload) : null,
    updatedAt: updatedAt ? String(updatedAt) : null,
    canvasHydrated: Boolean(canvasHydrated),
    legacyPolotnoOnly: Boolean(legacyPolotnoOnly),
  };
}

/** Plus aucune fiche ouverte (nouveau document, déconnexion, suppression). */
export function clearWorkspaceBaseline() {
  baseline = null;
}

/** @returns {LiriWorkspaceBaseline | null} */
export function getWorkspaceBaseline() {
  return baseline;
}

/**
 * Empreinte SI ET SEULEMENT SI elle concerne cette fiche — une empreinte d'un autre
 * document ne doit jamais servir de base de fusion.
 * @param {string | null | undefined} id
 * @returns {LiriWorkspaceBaseline | null}
 */
export function getWorkspaceBaselineFor(id) {
  if (!id || !baseline) return null;
  return baseline.id === String(id) ? baseline : null;
}

/**
 * Après un écrit réussi : l'empreinte avance, sinon le prochain enregistrement se croirait
 * en conflit avec sa propre écriture.
 * @param {{ id: string; payload?: unknown; updatedAt?: string | null }} args
 */
export function noteWorkspaceSaved({ id, payload, updatedAt }) {
  if (!id) return;
  const prev = getWorkspaceBaselineFor(id);
  baseline = {
    id: String(id),
    payload:
      payload && typeof payload === 'object'
        ? /** @type {Record<string, unknown>} */ (payload)
        : prev?.payload ?? null,
    updatedAt: updatedAt ? String(updatedAt) : null,
    // Un enregistrement réussi prouve que le canevas courant EST celui de la fiche.
    canvasHydrated: true,
    legacyPolotnoOnly: false,
  };
}
