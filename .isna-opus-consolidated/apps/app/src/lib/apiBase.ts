/** Base URL Nest (`apps/api`). Préfère `VITE_API_URL`, sinon `VITE_API_V2_URL` du .env.example historique. */
export function getApiBaseUrl(): string {
  const raw =
    import.meta.env.VITE_API_URL?.trim() ||
    import.meta.env.VITE_API_V2_URL?.trim() ||
    '';
  return raw.replace(/\/+$/, '') || 'http://localhost:4000';
}
