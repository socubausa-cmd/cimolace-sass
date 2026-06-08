/**
 * URL d'onboarding — désormais hébergée DIRECTEMENT sur Cimolace (public-site).
 * Quand on déploie, c'est cimolace.space/onboarding. En dev local = même origine.
 */
export function getOnboardingUrl(): string {
  return "/onboarding";
}

/**
 * URL du constructeur tenant (apps/app) — utilisée pour rediriger après le
 * choix d'infrastructure. En prod : tenant.cimolace.space ou app.cimolace.space.
 */
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:5200";
}
