/**
 * Catalogue des constructeurs de cours LIRI / Studio — typologie, public, pros/cons, alignement produit.
 * Source de vérité pour les pages /studio/liri/constructeurs et /guide.
 */

/** @typedef {'liri'|'studio'} ConstructeurFamily */
/** @typedef {'programme'|'cours'|'scolaire'|'video'|'arbre'} ConstructeurKind */

/**
 * @type {Array<{
 *   id: string;
 *   kind: ConstructeurKind;
 *   family: ConstructeurFamily;
 *   title: string;
 *   subtitle: string;
 *   href: string;
 *   external?: boolean;
 *   badge?: string;
 *   configures: string[];
 *   audience: string[];
 *   advantages: string[];
 *   drawbacks: string[];
 *   cahierDesCharges: string;
 *   flowNext?: string;
 * }>}
 */

export const DESIGNER_HREF = '/studio/smartboard-designer';

/** Enchaînement recommandé : macro → micro → canevas → live / export */
export const CONSTRUCTEUR_PIPELINE_STEPS = [
  {
    step: 1,
    title: 'Cadrage & calendrier',
    detail: 'Formation Builder (programme) ou Pédagogie du futur (année scolaire, semaines / jours).',
  },
  {
    step: 2,
    title: 'Contenu pédagogique',
    detail: 'Course Builder LIRI ou Agent LIRI (même 10 étapes), ou chaîne vidéo / arbre Studio.',
  },
  {
    step: 3,
    title: 'Design SmartBoard',
    detail: 'Slides, scènes, Konva — tous les parcours convergent ici pour le visuel.',
  },
  {
    step: 4,
    title: 'Diffusion',
    detail: 'Live Classroom, export centre, replay selon le dispositif.',
  },
];

export const CONSTRUCTEURS_CATALOG = [
  {
    id: 'liri-formation',
    kind: 'programme',
    family: 'liri',
    title: 'Formation Builder (LIRI)',
    subtitle: 'Programme modulaire dans le temps (1 mois → semestre, parcours compact)',
    href: '/studio/liri/formation',
    badge: 'Programme calendaire',
    configures: [
      'Sujet, type de programme (durée : 1/2/3 mois, semestre, compact), niveau, contexte, profil pédagogique.',
      'Génération IA via liri-formation-engine : squelette formation (étapes / structure affichée en arbre).',
      'Vue détail par nœud ; enchaînement naturel vers Course Builder puis SmartBoard Designer.',
    ],
    audience: [
      'Organismes de formation, bootcamps, parcours certifiants sur plusieurs semaines.',
      'Équipes qui pensent d’abord le rythme et la progression avant le contenu slide par slide.',
    ],
    advantages: [
      'Aligné méthode LIRI « macro » : une formation = plusieurs cours potentiels.',
      'Paramètres calendaires explicites (cahier « école du futur » : progression dans le temps).',
      'Intégration auth Supabase / même écosystème que le hub LIRI.',
      'Sauvegarde cloud des brouillons (table `liri_formation_drafts`) depuis l’écran Formation Builder.',
    ],
    drawbacks: [
      'Dépend de la fonction edge et du réseau pour la génération.',
      'Le graphe complet reste volumineux en JSON — les brouillons cloud (`liri_formation_drafts`) couvrent la sauvegarde, pas encore un éditeur de graphe collaboratif.',
    ],
    cahierDesCharges:
      'Correspond au volet parcours structuré dans le temps (vision multi-semaines) des docs LIRI / pédagogie du futur ; complète le Designer (micro-design) et le Course Builder (unitaire).',
    flowNext: 'Course Builder LIRI → SmartBoard Designer',
  },
  {
    id: 'liri-cours',
    kind: 'cours',
    family: 'liri',
    title: 'Course Builder (LIRI v2)',
    subtitle: 'Un cours = méthode LIRI 10 étapes, IA ou manuel',
    href: '/studio/liri/cours',
    badge: 'Contenu unitaire',
    configures: [
      'Les 10 étapes canoniques (tags pédagogiques : déclencheur, conflit cognitif, synthèse…).',
      'Mode IA : LIRIAgent génère le parcours ; mode manuel : blocs (idée, maîtrise, checkpoint, MasterScript…).',
      'Complétion par slide estimée via scores par étape ; orientation SmartBoard 1 sous-chapitre ≈ 1 slide.',
    ],
    audience: [
      'Enseignants et concepteurs qui préparent une séance ou un module riche, sans revenir au calendrier complet.',
      'Création rapide d’un cours « monolithique » cohérent avec la méthode LIRI.',
    ],
    advantages: [
      'Très proche du cahier SmartBoard Designer (progression pédagogique avant mise en scène).',
      'Double mode IA / manuel ; règles qualité LIRI affichées dans le panneau latéral.',
    ],
    drawbacks: [
      'Pas l’outil idéal pour piloter toute une année scolaire seul : coupler avec Formation Builder ou parcours DB.',
      'Utilisateur novice peut hésiter entre ce builder et les builders Studio historiques.',
      'Même contenu pédagogique possible via Agent LIRI (écran Studio immersif) — voir fiche dédiée dans le guide.',
    ],
    cahierDesCharges:
      'Cœur « bibliothèque pédagogique + validation » au sens large (structure d’étapes avant design) ; pont direct vers le Designer pour matérialiser les slides.',
    flowNext: 'SmartBoard Designer (et live / export)',
  },
  {
    id: 'liri-agent',
    kind: 'cours',
    family: 'liri',
    title: 'Agent LIRI (Studio immersif)',
    subtitle: 'Les 10 étapes LIRI en parcours plein écran — comme le Course Builder, autre navigation',
    href: '/studio/liri-agent',
    badge: 'Contenu unitaire · immersif',
    external: true,
    configures: [
      'Génération de parcours via edge `liri-agent-course-generate` : MasterScript, mindmap, alignement SmartBoard.',
      'Flux identique sur le fond au Course Builder LIRI v2 : une leçon structurée par la méthode canonique.',
      'Point d’entrée depuis le Studio Créateur (scroll) — pas le rail shell `/studio/liri/*`.',
    ],
    audience: [
      'Concepteurs qui découvrent le Studio par l’écran « un outil à la fois » et veulent l’IA LIRI tout de suite.',
      'Équipes qui préfèrent l’immersion plein écran au panneau latéral du hub LIRI.',
    ],
    advantages: [
      'Zéro ambiguïté sur le moteur : même pipeline IA que le reste de LIRI.',
      'Continuité avec les autres tuiles du Studio (Course Builder vidéo, Formation, etc.).',
    ],
    drawbacks: [
      'Pas le shell LIRI unifié : pas d’accès direct au rail Hub / Constructeurs sans naviguer.',
      'Deux URL pour un besoin proche (Course Builder `/studio/liri/cours` vs Agent) — à cadrer en équipe.',
    ],
    cahierDesCharges:
      'Doublon d’expérience assumé : UX Studio historique vs shell moderne ; le guide et l’assistant de choix tranchent pour l’utilisateur.',
    flowNext: 'SmartBoard Designer (et live / export)',
  },
  {
    id: 'liri-pedagogie-futur',
    kind: 'scolaire',
    family: 'liri',
    title: 'Pédagogie du futur (parcours DB)',
    subtitle: 'Système scolaire progressif — parcours / modules / semaines / jours / blocs',
    href: '/studio/liri/pedagogie-futur',
    badge: 'École du futur',
    configures: [
      'Modèle de données : school_paths → cours → modules → semaines → jours → pedagogical_blocks (replay, analytics).',
      'Ancre calendrier : champ school_paths.starts_on (date du lundi / jour 1 de la 1re semaine) + vue mois / liste FullCalendar sur le parcours.',
      'Référentiels JSON : types de blocs, weekly grammar 7 jours, pipeline post-production IA.',
      'UI : CRUD parcours, cours, puis modules → semaines → jours → blocs (JSON) sur la page Pédagogie du futur ; replay bloc en mode Simple ou JSON.',
    ],
    audience: [
      'Établissements, équipes système scolaire : année découpée en semaines, jours typés (live ouverture, friction, recall…).',
      'Architectes qui alignent live, designer et replay enrichi sur un même référentiel.',
    ],
    advantages: [
      'Seul volet explicitement calé sur un schéma scolaire (semaine / jour / type de pédagogie).',
      'RLS Supabase par propriétaire de parcours ; extensible quiz / mindmap en JSON.',
      'Création / édition des parcours et des cours racine directement dans l’UI « Pédagogie du futur ».',
      'Réordonnancement par glisser-déposer (sort_order), grille semaine lun→dim, fiche replay_assets par bloc.',
      'Vue calendrier (mois + liste) pour visualiser les jours pédagogiques sur une timeline après définition de starts_on.',
    ],
    drawbacks: [
      'La timeline calendrier dépend d’une migration DB (starts_on) et d’une date d’ancrage renseignée par parcours.',
      'Complexité fonctionnelle : réservé aux projets qui adoptent vraiment ce modèle.',
    ],
    cahierDesCharges:
      'Implémentation du pack liri_pedagogie_du_futur (vision, roadmap, schéma SQL) ; complète Formation et Cours sans les remplacer.',
    flowNext: 'Formation ou Cours LIRI + Designer selon le maillon (structure vs contenu vs visuel)',
  },
  {
    id: 'studio-course-builder',
    kind: 'video',
    family: 'studio',
    title: 'Course Builder (Studio)',
    subtitle: 'Cours basé vidéo — segments, transcript, pipeline Netlify',
    href: '/studio/course-builder',
    badge: 'Studio · Vidéo',
    external: true,
    configures: [
      'Brouillon cours : métadonnées, vidéo, transcription, segments ; hooks vers formations (useFormations, structure).',
      'Intégration fonctions Netlify course-builder-* (segmentation, master script, post-prod…).',
      'Retour SmartBoard Designer avec paramètre pp et brouillons cloud workspace.',
    ],
    audience: [
      'Équipes déjà en post-production vidéo ou import depuis capture studio.',
      'Parcours qui part d’une vidéo source plutôt que d’un prompt formation.',
    ],
    advantages: [
      'Chaînage industriel segment / illustration / versions post-prod déjà câblé dans le monorepo.',
      'Liens sortants vers Designer et pages post-production vidéo.',
    ],
    drawbacks: [
      'Hors shell LIRI unifié (navigation et modèle mental différents).',
      'Courbe technique (fonctions, stockage vidéo) plus élevée.',
    ],
    cahierDesCharges:
      'Couvre surtout timing, post-prod et versioning contenu du cahier Designer global, sous un angle vidéo-centré.',
    flowNext: 'SmartBoard Designer · post-production',
  },
  {
    id: 'studio-course-pro',
    kind: 'arbre',
    family: 'studio',
    title: 'Course Builder Pro',
    subtitle: 'Arbre chapitres · sous-chapitres · segments (store Zustand)',
    href: '/studio/course-builder-pro',
    badge: 'Studio · Arbre',
    external: true,
    configures: [
      'Initialisation manuelle ou blueprint IA (generateCourseBlueprint).',
      'Édition CourseTreePanel, SegmentEditor, SubchapterEditor ; validation intégrée.',
      'Export vers SmartBoard (sendToSmartboard) depuis le store.',
    ],
    audience: [
      'Power users : graphe hiérarchique fin (chapitre, sous-chapitre, segment) hors des 10 étapes fixes LIRI v2.',
      'Prototypage LIRI Pro expérimental.',
    ],
    advantages: [
      'Flexibilité maximale sur la profondeur de l’arbre.',
      'État centralisé useCourseBuilderStore — extensible côté UI.',
    ],
    drawbacks: [
      'Modèle différent des 10 étapes LIRI v2 — risque de double saisie si mal cadré en équipe.',
      'Hors hub LIRI ; découverte moindre pour les nouveaux utilisateurs.',
    ],
    cahierDesCharges:
      'Satisfait arborescence éditoriale et génération IA blueprint ; à rationaliser avec Course Builder LIRI pour limiter la dispersion.',
    flowNext: 'SmartBoard Designer',
  },
];

export const CONSTRUCTEURS_BY_FAMILY = {
  liri: CONSTRUCTEURS_CATALOG.filter((c) => c.family === 'liri'),
  studio: CONSTRUCTEURS_CATALOG.filter((c) => c.family === 'studio'),
};

/**
 * @param {string} id
 */
export function getConstructeurById(id) {
  return CONSTRUCTEURS_CATALOG.find((c) => c.id === id);
}
