import type { Feather } from '@expo/vector-icons';

/**
 * MOTEURS de l'app native — pendant de `components/liri/liriRail.tsx` côté web.
 *
 * Le web range ses surfaces par moteur (LIRI, École, mbolo, Studio, Créa) et
 * n'affiche un moteur que s'il a au moins un item visible pour l'utilisateur.
 * L'app native servait six onglets fixes à tout le monde : les écrans École
 * existaient mais étaient enterrés dans la liste du Profil, et un tenant sans
 * boutique voyait quand même la Boutique.
 *
 * Adaptation au mobile — ce n'est PAS une copie du rail :
 *   • le rail latéral devient la barre du bas, donc 5 items maximum par moteur ;
 *   • les six rubriques scolaires du web (Agenda, Notes, Évals, Absences,
 *     Documents, Programme) sont déjà réunies dans `vie-scolaire`, on garde
 *     cette version condensée plutôt que six onglets ;
 *   • ce qui n'a pas d'écran natif n'est pas listé (pas de lien mort).
 */

type IconName = React.ComponentProps<typeof Feather>['name'];

export type EngineKey = 'liri' | 'ecole' | 'mbolo' | 'studio';

export type NavItem = {
  /** Nom de la route Expo Router (doit exister dans src/app). */
  route: string;
  label: string;
  icon: IconName;
  /** Réservé aux créateurs (owner/admin/prof/secrétariat). */
  creator?: boolean;
  /** Réservé aux élèves. */
  student?: boolean;
};

export type EngineDef = {
  key: EngineKey;
  label: string;
  sub: string;
  icon: IconName;
  /** Service(s) `tenant_services` qui allument le moteur. Vide = toujours actif. */
  requires?: 'school' | 'shop';
  items: NavItem[];
};

/**
 * `index` (Accueil) ouvre CHAQUE moteur : c'est le seul écran qui porte le
 * sélecteur, donc l'y garder partout garantit qu'on peut toujours revenir
 * changer de moteur, quel que soit l'endroit où l'on se trouve.
 */
const ACCUEIL: NavItem = { route: 'index', label: 'Accueil', icon: 'home' };

export const ENGINES: EngineDef[] = [
  {
    key: 'liri', label: 'LIRI', sub: 'Live', icon: 'video',
    items: [
      ACCUEIL,
      { route: 'lives', label: 'Lives', icon: 'video' },
      { route: 'forum', label: 'Forum', icon: 'message-square' },
      { route: 'bibliotheque', label: 'Biblio.', icon: 'book-open' },
      { route: 'brain', label: 'Brain', icon: 'zap' },
    ],
  },
  {
    key: 'ecole', label: 'École', sub: 'Pédagogie', icon: 'book', requires: 'school',
    items: [
      ACCUEIL,
      { route: 'formations', label: 'Mes cours', icon: 'book' },
      { route: 'videotheque', label: 'Vidéothèque', icon: 'film' },
      { route: 'vie-scolaire', label: 'Vie scolaire', icon: 'clipboard', student: true },
      { route: 'ma-classe', label: 'Ma classe', icon: 'users' },
    ],
  },
  {
    key: 'mbolo', label: 'mbolo', sub: 'Boutique', icon: 'shopping-bag', requires: 'shop',
    items: [
      ACCUEIL,
      { route: 'commerce', label: 'Boutique', icon: 'shopping-bag' },
    ],
  },
  {
    // Entièrement réservé aux créateurs : un élève n'a rien à y faire, donc le
    // moteur disparaît de son sélecteur au lieu de s'ouvrir presque vide.
    key: 'studio', label: 'Studio', sub: 'Création', icon: 'edit-3',
    items: [
      ACCUEIL,
      { route: 'studio', label: 'Studio', icon: 'edit-3', creator: true },
      { route: 'masterscript', label: 'Masterscript', icon: 'file-text', creator: true },
    ],
  },
];

export type NavFilter = { isCreator: boolean; schoolActive: boolean; shopActive: boolean };

const itemVisible = (it: NavItem, f: NavFilter) =>
  it.creator ? f.isCreator : it.student ? !f.isCreator : true;

const engineUnlocked = (e: EngineDef, f: NavFilter) =>
  e.requires === 'school' ? f.schoolActive : e.requires === 'shop' ? f.shopActive : true;

/** Items visibles d'un moteur pour cet utilisateur (barre du bas). */
export const engineItems = (key: EngineKey, f: NavFilter): NavItem[] => {
  const e = ENGINES.find((x) => x.key === key);
  if (!e || !engineUnlocked(e, f)) return [];
  return e.items.filter((it) => itemVisible(it, f));
};

/**
 * Moteurs proposés au sélecteur : souscrits ET ayant au moins un item visible
 * EN PLUS d'Accueil (présent partout, il ne suffit pas à justifier un moteur).
 * Même règle que le web — un moteur vide ne s'affiche pas.
 */
export const visibleEngines = (f: NavFilter): EngineDef[] =>
  ENGINES.filter(
    (e) => engineUnlocked(e, f)
      && e.items.some((it) => it.route !== ACCUEIL.route && itemVisible(it, f)),
  );
