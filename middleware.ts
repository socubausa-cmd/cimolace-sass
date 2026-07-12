// Middleware Vercel RACINE (miroir de apps/app/middleware.ts) — garantit la SEO par host quel que
// soit le cwd du déploiement. Certains déploiements partent de la RACINE du repo (vercel.json racine,
// build monorepo `-w @isna/app`, outputDirectory apps/app/dist) ; ceux-là n'embarquaient PAS le
// middleware d'apps/app → la racine `/` de prorascience.org retombait sur index.html (« LIRI »),
// d'où la régression SEO récurrente. Ce middleware racine réécrit `/` du host prorascience.org vers
// `/prorascience.html` (META SEO/OG correctes pour crawlers & scrapers no-JS) via l'en-tête natif
// `x-middleware-rewrite`. Les autres chemins sont couverts par les rewrites host de vercel.json ;
// les autres hosts (LIRI, app…) passent (return undefined) → index.html.
export const config = { matcher: '/' };

const CIMOLACE_HOSTS = new Set(['app.cimolace.space', 'cimolace.space', 'www.cimolace.space']);

export default function middleware(request: Request): Response | undefined {
  const host = (request.headers.get('host') || '').toLowerCase();
  const url = new URL(request.url);
  if (host === 'prorascience.org' || host === 'www.prorascience.org') {
    url.pathname = '/prorascience.html';
    return new Response(null, { headers: { 'x-middleware-rewrite': url.toString() } });
  }
  if (CIMOLACE_HOSTS.has(host)) {
    url.pathname = '/cimolace.html';
    return new Response(null, { headers: { 'x-middleware-rewrite': url.toString() } });
  }
  return undefined;
}
