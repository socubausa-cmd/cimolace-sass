/**
 * Source UNIQUE de vérité : « ce membre est-il un CRÉATEUR (staff) ? »
 *
 * Le portail LIRI est ORG-FIRST : l'élève RESTE dans le portail mais en vue ALLÉGÉE.
 * Tout l'outillage créateur (Studio, École-gestion, Brain, Intégrations, Réglages,
 * bandeau de facturation, métriques revenus/quota) est masqué pour les non-créateurs.
 *
 * FAIL-CLOSED volontaire : un rôle vide / non résolu → `false` (vue élève).
 * Conséquence assumée : un créateur dont le claim n'est pas encore résolu voit
 * transitoirement la vue élève — dégradé SÛR, jamais une fuite d'outillage vers un élève.
 * En prod, `tenantRole` est décodé du JWT (synchrone, fiable pour les gardes) : un
 * créateur qui passe les gardes /liri • /studio le porte donc toujours.
 *
 * Partagé par LiriPortalPage (accueil) et LiriPortalShell (Lives/Forum/Messages/…)
 * pour que la coupe soit IDENTIQUE sur tous les écrans du portail.
 */
export const CREATOR_ROLES = [
  'owner',
  'admin',
  'teacher',
  'secretariat',
  'practitioner',
  'clinic_admin',
  'staff',
] as const;

/**
 * `true` si le PREMIER rôle non vide fourni est un rôle créateur.
 * Ordre d'appel recommandé : `isCreatorRole(tenantRole, org?.role)` — le JWT d'abord.
 */
export function isCreatorRole(...roles: (string | null | undefined)[]): boolean {
  const resolved = String(roles.find((r) => r != null && r !== '') || '').toLowerCase();
  return (CREATOR_ROLES as readonly string[]).includes(resolved);
}
