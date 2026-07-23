// Préchargement « à chaud » des onglets du portail LIRI.
//
// PROBLÈME : chaque onglet École/LIRI est un composant `lazy()` (App.jsx). Au 1er clic, le
// navigateur DOIT télécharger le chunk JS de la page → flash « CHARGEMENT… » (fallback Suspense)
// → ressenti « rechargement de page » comme sur un site HTML statique, alors que c'est une SPA.
//
// FIX (2 niveaux) :
//   1. idle — dès qu'on entre dans le portail, on précharge en tâche de fond (sans bloquer la 1re
//      peinture) tous les chunks d'onglets → au bout de ~1-2s tout est en cache.
//   2. survol — au `mouseenter` sur un item du rail, on précharge IMMÉDIATEMENT ce chunk précis
//      (couvre le clic ultra-rapide avant que l'idle ait tout fini). Technique SPA standard.
// Au clic, le chunk est déjà là → la page rend tout de suite, la coque (rail + en-tête) ne bouge
// pas → navigation instantanée « à chaud ».
//
// ⚠️ Les import() ci-dessous DOIVENT cibler exactement les mêmes modules que les `lazy()` d'App.jsx
// pour que Vite dédoublonne (même chunk partagé, aucun doublon).

// Map chemin de route → importer du chunk. Sert à la fois à l'idle (toutes les valeurs) et au
// survol (valeur d'un chemin précis). Un chemin absent = no-op (il se chargera au clic).
const ROUTE_IMPORTERS = {
  '/liri/formations': () => import('@/pages/school/student-school-life/StudentFormationsOsPage'),
  '/liri/videotheque': () => import('@/pages/school/student-school-life/VideothequePage'),
  '/liri/semaine': () => import('@/pages/school/student-school-life/StudentWeeklySchedulePage'),
  '/liri/vie-scolaire': () => import('@/pages/school/SchoolLifePage'),
  '/liri/agenda': () => import('@/pages/school/student-school-life/StudentAgendaPage'),
  '/liri/notes': () => import('@/pages/school/student-school-life/StudentNotesHubPage'),
  '/liri/evaluations': () => import('@/pages/school/student-school-life/StudentEvaluationsPage'),
  '/liri/absences': () => import('@/pages/school/student-school-life/StudentAbsencesPage'),
  '/liri/documents': () => import('@/pages/school/student-school-life/StudentDocumentsPage'),
  '/liri/bibliotheque': () => import('@/pages/BibliothequePage'),
  '/liri/messages': () => import('@/pages/MessagingPage'),
  '/liri/temple': () => import('@/pages/liri/LiriTemplePage'),
  '/liri/marche': () => import('@/pages/liri/LiriMboloMarketPage'),
};

// Ordre de préchargement idle : onglets les plus consultés d'abord.
const IDLE_ORDER = [
  '/liri/formations',
  '/liri/videotheque',
  '/liri/vie-scolaire',
  '/liri/agenda',
  '/liri/notes',
  '/liri/semaine',
  '/liri/evaluations',
  '/liri/absences',
  '/liri/documents',
  '/liri/bibliotheque',
];

const loaded = new Set(); // chemins déjà préchargés (évite de relancer le même import).

function prefetchOne(path) {
  if (loaded.has(path)) return;
  const importer = ROUTE_IMPORTERS[path];
  if (!importer) return;
  loaded.add(path);
  // un onglet qui échoue au prefetch ne casse rien : il se chargera au clic.
  Promise.resolve().then(importer).catch(() => loaded.delete(path));
}

/** Précharge le chunk d'un chemin précis (à appeler au survol d'un item du rail). */
export function prefetchLiriPath(path) {
  prefetchOne(path);
}

let started = false;

/** Précharge en idle tous les chunks d'onglets — à appeler une fois à l'entrée dans le portail. */
export function prefetchLiriRoutes() {
  if (started || typeof window === 'undefined') return;
  started = true;

  const idle =
    window.requestIdleCallback?.bind(window) ||
    ((cb) => window.setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 600));

  // Un chunk à la fois, chacun en idle : jamais en concurrence avec un fetch de données de la page
  // courante, et on cède la main entre chaque préchargement.
  let i = 0;
  const pump = () => {
    if (i >= IDLE_ORDER.length) return;
    prefetchOne(IDLE_ORDER[i++]);
    idle(pump);
  };
  idle(pump);
}
