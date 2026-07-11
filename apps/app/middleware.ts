import { rewrite, next } from '@vercel/edge';

// Middleware Vercel (s'exécute AVANT le filesystem) — corrige le SEUL cas que les rewrites vercel.json
// ne couvrent pas : la RACINE `/`. Vercel sert `index.html` (title « LIRI ») par priorité filesystem
// pour `/`, avant les rewrites. Ici on RÉÉCRIT `/` du host prorascience.org vers `/prorascience.html`
// (META SEO/OG correctes pour les crawlers & scrapers no-JS). Les autres chemins sont déjà gérés par
// les rewrites host de vercel.json ; les autres hosts (LIRI, app…) gardent index.html.
export const config = { matcher: '/' };

export default function middleware(request: Request) {
  const host = (request.headers.get('host') || '').toLowerCase();
  if (host === 'prorascience.org' || host === 'www.prorascience.org') {
    return rewrite(new URL('/prorascience.html', request.url));
  }
  return next();
}
