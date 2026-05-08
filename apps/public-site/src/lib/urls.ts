export function getOnboardingUrl(): string {
  return process.env.NEXT_PUBLIC_CONSTRUCTOR_URL ?? "http://localhost:5173/onboarding";
}
