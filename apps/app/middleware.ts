// Middleware Vercel (s'exécute AVANT le filesystem), SANS dépendance — corrige le SEUL cas que les
// rewrites de vercel.json ne couvrent pas : la RACINE `/`. Vercel sert `index.html` (title « LIRI »)
// par priorité filesystem pour `/`, avant les rewrites. Ici on RÉÉCRIT `/` du host prorascience.org
// vers `/prorascience.html` (META SEO/OG correctes pour les crawlers & scrapers no-JS) via l'en-tête
// natif `x-middleware-rewrite`. Les autres chemins sont déjà gérés par les rewrites host de vercel.json ;
// les autres hosts (LIRI, app…) passent (return undefined) → index.html.
export const config = { matcher: '/' };

export default function middleware(request: Request): Response | undefined {
  const host = (request.headers.get('host') || '').toLowerCase();
  if (host === 'prorascience.org' || host === 'www.prorascience.org') {
    const url = new URL(request.url);
    url.pathname = '/prorascience.html';
    return new Response(null, { headers: { 'x-middleware-rewrite': url.toString() } });
  }
  return undefined;
}
