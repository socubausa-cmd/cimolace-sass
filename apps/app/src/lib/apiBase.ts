/** Base URL Nest (`apps/api`). Préfère `VITE_API_URL`, sinon `VITE_API_V2_URL` du .env.example historique. */
export function getApiBaseUrl(): string {
  const raw =
    import.meta.env.VITE_API_URL?.trim() ||
    import.meta.env.VITE_API_V2_URL?.trim() ||
    '';
  // ⚠️ En build de PRODUCTION, ne JAMAIS retomber sur localhost : un `vercel build`
  // local a déjà cuit VITE_API_URL="" (le pull renvoie la variable vide) → toute la
  // prod appelait localhost:4000 en silence. L'API publique est le repli sûr.
  return raw.replace(/\/+$/, '') || (import.meta.env.PROD ? 'https://api.cimolace.space' : 'http://localhost:4000');
}
