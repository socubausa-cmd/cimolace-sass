// Middleware Vercel (s'exécute AVANT le filesystem), SANS dépendance — corrige le SEUL cas que les
// rewrites de vercel.json ne couvrent pas : la RACINE `/`. Vercel sert `index.html` (title « LIRI »)
// par priorité filesystem pour `/`, avant les rewrites. Ici on RÉÉCRIT `/` du host prorascience.org
// vers `/prorascience.html` (META SEO/OG correctes pour les crawlers & scrapers no-JS) via l'en-tête
// natif `x-middleware-rewrite`. Les autres chemins sont déjà gérés par les rewrites host de vercel.json ;
// les autres hosts (LIRI, app…) passent (return undefined) → index.html.
export const config = { matcher: '/' };

// Hosts Cimolace (app + vitrine) → racine sur cimolace.html (SEO « Cimolace », fini « LIRI »).
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
