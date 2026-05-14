/**
 * Mappe les capacités invité (useGuestCapabilities / guest_permissions) vers LivePermissions partielles.
 * Les flags session (micro/cam autorisés par le formateur) sont fusionnés côté LiveGuestPage.
 *
 * @param {Record<string, unknown>} caps
 * @returns {Record<string, boolean>}
 */
export function mapGuestCapsToPermissionOverride(caps) {
  const c = caps && typeof caps === 'object' ? caps : {};
  return {
    canDrawSmartboard: Boolean(c.canAnnotateWhiteboard),
    canUseNeuronQ: Boolean(c.canUseNeuronq),
    /** Main levée ou réactions — aligné permissions élèves (les deux peuvent être coupés séparément côté studio). */
    canUseSignals: Boolean(c.canRaiseHand || c.canReactEmoji),
  };
}
