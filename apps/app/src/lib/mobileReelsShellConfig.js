/** Viewport max (px) pour activer la coque type app (Reels / Instagram). */
export const MOBILE_REELS_SHELL_MAX_PX = 1023;

/**
 * Routes sans barre haute/basse (plein écran immersif ou auth).
 */
export function isMobileReelsShellExcluded(pathname, search) {
  if (!pathname) return true;
  const p = String(pathname);
  try {
    const sp = typeof search === 'string' ? new URLSearchParams(search) : search;
    if (sp?.get?.('immersive_embed') === '1') return true;
  } catch {
    /* ignore */
  }

  // Pages EMBED (iframe sur des sites tiers) : jamais de coque app (barres nav).
  if (p.startsWith('/embed/')) return true;
  if (p.startsWith('/studio/live-arena')) return true;
  if (p.startsWith('/live/') && !p.startsWith('/lives')) return true;
  // Salle de téléconsultation MEDOS (santé) : CLOISON stricte — jamais la coque
  // portail LIRI/école (barre + onglets Accueil/Cours/Live/Messages/Client vers
  // prorascience) par-dessus, ni pendant l'appel ni sur l'écran de fin. Le contexte
  // santé (patient/proche) ne doit pas fuir vers le portail école.
  if (p.startsWith('/teleconsult')) return true;
  if (
    p === '/login' ||
    p === '/signup' ||
    p === '/auth/callback' ||
    p === '/forgot-password' ||
    p === '/update-password'
  ) {
    return true;
  }
  if (p.startsWith('/companion-capture')) return true;
  if (p.startsWith('/classroom/live/')) return true;
  if (p.startsWith('/classroom/video')) return true;
  if (p.startsWith('/creator-dashboard')) return true;
  if (p.startsWith('/teacher-dashboard')) return true;
  /* Espace propriétaire : layout plein écran + barre locale — pas de coque LIRI ni wordmark par-dessus. */
  if (p.startsWith('/owner-dashboard')) return true;
  /* Studio : plein écran interne ; la coque LIRI (≤1023px) empile barres + padding et peut laisser la zone utile vide (écran noir). */
  if (p.startsWith('/studio')) return true;
  /* Maquettes / prévisu dev — pas de barre Prorascience + menu par-dessus (ex. /dev/eleve-shell). */
  if (p.startsWith('/dev')) return true;
  /* App mobile LIRI Élève — coquille Reels (titre Prorascience + menu) ne doit pas recouvrir la maquette */
  if (p.startsWith('/m/eleve')) return true;
  if (p === '/choose-account-type') return true;
  if (
    typeof import.meta !== 'undefined' &&
    import.meta.env?.VITE_APP_VARIANT === 'eleve' &&
    (p === '/messages' || p.startsWith('/messages/'))
  ) {
    return true;
  }
  return false;
}

const TITLE_RULES = [
  [/^\/m\/eleve$/, 'LIRI'],
  [/^\/m\/eleve\/choisir-compte$/, 'Espaces'],
  [/^\/m\/eleve\/bibliotheque$/, 'Cours'],
  [/^\/m\/eleve\/live$/, 'Live'],
  [/^\/m\/eleve\/communaute$/, 'Communauté'],
  [/^\/m\/eleve\/profil$/, 'Profil'],
  [/^\/m\/eleve\/agenda$/, 'Agenda'],
  [/^\/m\/liri$/, 'LIRI'],
  [/^\/m\/liri\/courses$/, 'Cours'],
  [/^\/m\/liri\/live$/, 'Live'],
  [/^\/m\/liri\/calendar$/, 'Agenda'],
  [/^\/m\/liri\/client$/, 'Espace client'],
  [/^\/m\/liri\/arena$/, 'Arena'],
  [/^\/m\/liri\/appointments$/, 'Rendez-vous'],
  [/^\/$/, 'Accueil'],
  [/^\/choose-account-type$/, 'Espaces'],
  [/^\/dashboard/, 'Accueil'],
  [/^\/landing/, 'Découvrir'],
  [/^\/forfaits/, 'Forfaits'],
  [/^\/formations/, 'Formations'],
  [/^\/lives/, 'Lives'],
  [/^\/messages/, 'Messages'],
  [/^\/classroom/, 'Classe'],
  [/^\/student-school-life/, 'Vie scolaire'],
  [/^\/owner-dashboard/, 'Espace pro'],
  [/^\/studio/, 'Studio'],
  [/^\/admin/, 'Admin'],
  [/^\/secretariat/, 'Secrétariat'],
  [/^\/teacher-space/, 'Espace prof'],
  [/^\/profil\//, 'Profil'],
  [/^\/settings/, 'Réglages'],
  [/^\/notifications/, 'Notifications'],
  [/^\/support/, 'Support'],
  [/^\/boutique/, 'Boutique'],
  [/^\/community/, 'Communauté'],
  [/^\/resources/, 'Ressources'],
  [/^\/isna/, 'ISNA'],
  [/^\/temple-ngowazulu/, 'Temple'],
  [/^\/nous-contacter/, 'Contact'],
  [/^\/app$/, 'Membre'],
  [/^\/vie-scolaire/, 'Vie scolaire'],
  [/^\/accompagnement/, 'Accompagnement'],
  [/^\/appointment/, 'Rendez-vous'],
];

export function getMobileReelsShellTitle(pathname) {
  const path = String(pathname || '/') || '/';
  for (const [re, title] of TITLE_RULES) {
    if (re.test(path)) return title;
  }
  return 'LIRI';
}

/** Racines « onglet » : pas de bouton retour. */
export function isMobileReelsTabRoot(pathname, homeHref) {
  const p = String(pathname || '/') || '/';
  const h = String(homeHref || '/') || '/';
  if (p === '/m/eleve' || p.startsWith('/m/eleve?')) return true;
  if (p === '/m/eleve/bibliotheque') return true;
  if (p === '/m/eleve/en-ligne') return true;
  if (p === '/m/eleve/etudiant' || p.startsWith('/m/eleve/etudiant/')) return true;
  if (p === '/m/eleve/live') return true;
  if (p === '/m/eleve/communaute' || p.startsWith('/m/eleve/communaute/')) return true;
  if (p === '/m/eleve/agenda') return true;
  if (p === '/m/liri' || p.startsWith('/m/liri?')) return true;
  if (p === '/m/liri/courses') return true;
  if (p === '/m/liri/live') return true;
  if (p === '/m/liri/client' || p.startsWith('/m/liri/client/')) return true;
  if (p === '/' || p === h) return true;
  if (h !== '/' && h !== '/login' && (p === h || p.startsWith(`${h}/`))) return true;
  if (p.startsWith('/forfaits') && p.split('/').length <= 2) return true;
  if (p === '/lives' || p.startsWith('/lives?')) return true;
  if (p.startsWith('/messages') && p.split('/').length <= 2) return true;
  const profileRoots = ['/login', '/signup', '/profil/mon-profil'];
  if (profileRoots.some((r) => p === r || p.startsWith(`${r}/`))) return true;
  if (p === '/dashboard' || p.startsWith('/dashboard/')) return true;
  return false;
}
