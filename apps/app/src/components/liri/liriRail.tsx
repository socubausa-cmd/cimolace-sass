import React from 'react';
import {
  House, Video, MessagesSquare, MessageCircle, WandSparkles, Library, GraduationCap, Sparkles,
  CalendarDays, BookOpen, School, Calendar, FileText, Award, AlertTriangle, FolderOpen, Tag, Files,
  SquarePen, CreditCard, Flame, ShoppingBag, Megaphone, Package, ReceiptText, Link2, Landmark,
} from 'lucide-react';

/**
 * RAIL du portail LIRI, organisé par MOTEUR (infrastructure) — SOURCE UNIQUE partagée par
 * l'accueil (LiriPortalPage) et le shell des sous-pages (LiriPortalShell).
 *
 * Le portail embarque plusieurs moteurs : LIRI (live/communauté), École (pédagogie),
 * mbolo (boutique/ventes), Créa (studio) — et MEDOS (santé) quand ses routes existeront.
 * Un SÉLECTEUR DE MOTEUR dans l'en-tête recharge tout le rail → plus de surcharge : le rail
 * ne montre QUE les sections du moteur actif.
 *
 * Visibilité 3 niveaux (inchangée) :
 *   creator: true  → réservé au CRÉATEUR (Studio/École/CRM…)
 *   school: true   → réservé à l'ÉLÈVE d'un tenant ÉCOLE activé (agenda/notes/cours…)
 *   (aucun flag)   → partagé (Accueil, Lives, Forum, Messages, Boutique…)
 * Un moteur n'apparaît dans le sélecteur QUE s'il a ≥ 1 item visible pour l'utilisateur.
 */
export type EngineKey = 'liri' | 'ecole' | 'mbolo' | 'medos' | 'studio' | 'crea';

export type RailKey =
  | 'accueil' | 'forfaits' | 'semaine' | 'formations'
  | 'vie-scolaire' | 'agenda' | 'notes' | 'evaluations' | 'absences'
  | 'lives' | 'forum' | 'messages'
  | 'biblio-eleve' | 'documents'
  | 'temple' | 'boutique' | 'produits' | 'commandes' | 'paiements' | 'factures' | 'compta'
  | 'studio' | 'ecole' | 'services' | 'crm' | 'pages' | 'contenu' | 'biblio' | 'brain' | 'integrations' | 'reglages';

export type RailItem = { key: RailKey; label: string; icon: typeof House; to: string; creator?: boolean; school?: boolean };
export type RailGroup = { section?: string; items: RailItem[] };
export type EngineDef = { key: EngineKey; label: string; sub: string; icon: typeof House; groups: RailGroup[]; home?: string };

/** Les moteurs et leurs rails (sections → items). Ordre = ordre du sélecteur d'en-tête. */
export const ENGINES: EngineDef[] = [
  {
    key: 'liri', label: 'LIRI', sub: 'Live', icon: Video,
    groups: [
      { items: [
        { key: 'accueil', label: 'Accueil', icon: House, to: '/liri' },
      ] },
      { section: 'Communauté', items: [
        { key: 'lives', label: 'Lives', icon: Video, to: '/lives' },
        { key: 'forum', label: 'Forum', icon: MessagesSquare, to: '/liri/forum' },
        { key: 'messages', label: 'Messages', icon: MessageCircle, to: '/liri/messages' },
      ] },
      { section: 'Espace', items: [
        { key: 'temple', label: 'Temple', icon: Flame, to: '/liri/temple' },
        { key: 'forfaits', label: 'Forfaits', icon: CreditCard, to: '/liri/forfaits' },
      ] },
    ],
  },
  {
    key: 'ecole', label: 'École', sub: 'Pédagogie', icon: GraduationCap,
    groups: [
      { section: 'Pilotage', items: [
        { key: 'ecole', label: 'École', icon: GraduationCap, to: '/liri/ecole', creator: true },
        { key: 'formations', label: 'Mes cours', icon: BookOpen, to: '/liri/formations', school: true },
        { key: 'semaine', label: 'Ma semaine', icon: CalendarDays, to: '/liri/semaine', school: true },
      ] },
      { section: 'Scolarité', items: [
        { key: 'vie-scolaire', label: 'Vie scolaire', icon: School, to: '/liri/vie-scolaire', school: true },
        { key: 'agenda', label: 'Agenda', icon: Calendar, to: '/liri/agenda', school: true },
        { key: 'notes', label: 'Notes', icon: FileText, to: '/liri/notes', school: true },
        { key: 'evaluations', label: 'Évals', icon: Award, to: '/liri/evaluations', school: true },
        { key: 'absences', label: 'Absences', icon: AlertTriangle, to: '/liri/absences', school: true },
      ] },
      { section: 'Ressources', items: [
        { key: 'biblio-eleve', label: 'Biblio.', icon: Library, to: '/liri/bibliotheque', school: true },
        { key: 'documents', label: 'Documents', icon: FolderOpen, to: '/liri/documents', school: true },
      ] },
    ],
  },
  {
    key: 'mbolo', label: 'mbolo', sub: 'Boutique', icon: ShoppingBag,
    groups: [
      { section: 'Boutique', items: [
        { key: 'boutique', label: 'Boutique', icon: ShoppingBag, to: '/liri/boutique' },
        { key: 'produits', label: 'Produits', icon: Package, to: '/liri/mbolo/produits', creator: true },
        { key: 'commandes', label: 'Commandes', icon: ReceiptText, to: '/liri/mbolo/commandes', creator: true },
      ] },
      { section: 'Encaissement', items: [
        { key: 'paiements', label: 'Liens de paiement', icon: Link2, to: '/liri/mbolo/paiements', creator: true },
        { key: 'factures', label: 'Factures', icon: FileText, to: '/liri/mbolo/factures', creator: true },
        { key: 'compta', label: 'Compta', icon: Landmark, to: '/liri/mbolo/compta', creator: true },
      ] },
      { section: 'Croissance', items: [
        { key: 'services', label: 'Services', icon: Tag, to: '/liri/services', creator: true },
        { key: 'crm', label: 'CRM', icon: Megaphone, to: '/liri/crm', creator: true },
      ] },
    ],
  },
  {
    // STUDIO = moteur À PART ENTIÈRE (détaché de Créa) : écosystème immersif PLEIN ÉCRAN avec
    // sa PROPRE coque + sa propre nav interne (Formation/Designer/Cours/Live/Bibliothèque…).
    // Le clic « Studio » LANCE ce monde ; on n'y groupe donc rien d'autre côté portail.
    key: 'studio', label: 'Studio', sub: 'Création', icon: WandSparkles, home: '/studio/liri',
    groups: [
      { items: [
        { key: 'studio', label: 'Studio', icon: WandSparkles, to: '/studio/liri', creator: true },
      ] },
    ],
  },
  {
    // Créa = outils de CONTENU portail (hors Studio) : CMS + IA. Studio en est détaché ↑.
    key: 'crea', label: 'Créa', sub: 'Contenu', icon: SquarePen,
    groups: [
      { section: 'Contenu', items: [
        { key: 'contenu', label: 'Contenu', icon: SquarePen, to: '/liri/contenu', creator: true },
        { key: 'pages', label: 'Pages', icon: Files, to: '/liri/pages', creator: true },
      ] },
      { section: 'Intelligence', items: [
        { key: 'brain', label: 'Brain', icon: Sparkles, to: '/dashboard/liri', creator: true },
        { key: 'biblio', label: 'Biblio.', icon: Library, to: '/studio/liri/bibliotheque', creator: true },
      ] },
    ],
  },
  // MEDOS (santé) : ajouté ici quand ses routes de portail existeront (téléconsult/patients).
  // Tant qu'il n'a aucun item visible, il n'apparaît pas dans le sélecteur (gate par activation implicite).
];

type Filter = { isCreator: boolean; schoolActive: boolean };
const isVisible = (it: RailItem, { isCreator, schoolActive }: Filter) =>
  it.creator ? isCreator : it.school ? (!isCreator && schoolActive) : true;

/** Groupes d'un moteur, filtrés par rôle + mode école (sections vides retirées). */
export function engineGroups(engine: EngineKey, f: Filter): RailGroup[] {
  const def = ENGINES.find((e) => e.key === engine);
  if (!def) return [];
  return def.groups
    .map((g) => ({ section: g.section, items: g.items.filter((it) => isVisible(it, f)) }))
    .filter((g) => g.items.length > 0);
}

/** Le moteur qui possède une clé de rail donnée (défaut : 'liri'). */
export function getActiveEngine(active?: RailKey): EngineKey {
  if (!active) return 'liri';
  for (const e of ENGINES) for (const g of e.groups) if (g.items.some((it) => it.key === active)) return e.key;
  return 'liri';
}

/** Moteurs affichés dans le sélecteur = ceux qui ont ≥ 1 item visible pour l'utilisateur. */
export function getVisibleEngines(f: Filter): EngineDef[] {
  return ENGINES.filter((e) => engineGroups(e.key, f).length > 0);
}

/** Route d'accueil d'un moteur : `home` explicite (si le 1er item est un builder plein écran
 *  sans sélecteur, ex. Studio), sinon le 1er item visible (rôle-correct : créateur ≠ élève). */
export function engineHome(engine: EngineKey, f: Filter): string {
  const def = ENGINES.find((e) => e.key === engine);
  const groups = engineGroups(engine, f);
  return def?.home || groups[0]?.items[0]?.to || '/liri';
}

/** Liste PLATE des items du moteur actif (source de la barre de nav basse mobile). */
export function getRailItems(opts: Filter & { engine?: EngineKey }): RailItem[] {
  const engine = opts.engine || 'liri';
  return engineGroups(engine, opts).flatMap((g) => g.items);
}

/** Sélecteur de MOTEUR (en-tête) — recharge tout le rail. Un seul accent coral (charte LIRI). */
export function LiriEngineSwitcher({
  activeEngine, isCreator, schoolActive, onNav,
}: {
  activeEngine: EngineKey;
  isCreator: boolean;
  schoolActive: boolean;
  onNav: (to: string) => void;
}) {
  const f = { isCreator, schoolActive };
  const engines = getVisibleEngines(f);
  if (engines.length <= 1) return null; // un seul moteur → pas de sélecteur (élève simple)
  return (
    <nav
      className="flex items-center gap-0.5 overflow-x-auto rounded-2xl p-1 no-scrollbar"
      style={{ background: 'rgba(0,0,0,.20)', border: '1px solid rgba(255,255,255,.07)' }}
      aria-label="Moteur actif"
    >
      {engines.map((e) => {
        const Icon = e.icon;
        const isActive = e.key === activeEngine;
        return (
          <button
            key={e.key}
            onClick={() => onNav(engineHome(e.key, f))}
            aria-current={isActive ? 'page' : undefined}
            title={`${e.label} · ${e.sub}`}
            className={`flex shrink-0 items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-3 lp-tr ${isActive ? '' : 'lp-muted hover:lp-ink'}`}
            style={isActive
              ? { background: 'color-mix(in srgb, var(--coral) 16%, transparent)', boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--coral) 34%, transparent)', color: '#f4f1ec' }
              : undefined}
          >
            <span
              className="grid h-6 w-6 place-items-center rounded-lg lp-tr"
              style={isActive
                ? { background: 'var(--coral)', color: '#20140f' }
                : { background: 'rgba(255,255,255,.05)' }}
            >
              <Icon size={15} />
            </span>
            <span className="hidden flex-col items-start leading-none sm:flex">
              <span className="text-[12.5px] font-semibold">{e.label}</span>
              <span className="text-[8.5px] font-semibold uppercase tracking-wider lp-faint" style={isActive ? { color: 'var(--coral)' } : undefined}>{e.sub}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/** Rend les groupes du rail DU MOTEUR ACTIF (labels de section + boutons), filtrés par rôle + école. */
export function LiriRailGroups({
  engine = 'liri', active, isCreator, schoolActive, live = false, onNav,
}: {
  engine?: EngineKey;
  active?: RailKey;
  isCreator: boolean;
  schoolActive: boolean;
  live?: boolean;
  onNav: (to: string) => void;
}) {
  const groups = engineGroups(engine, { isCreator, schoolActive });
  return (
    <>
      {groups.map((group, gi) => (
        <div key={group.section || `g${gi}`} className="flex w-full flex-col items-center gap-0.5">
          {group.section && (
            <div className="mb-0.5 mt-2 w-full px-1 text-center lp-faint" style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{group.section}</div>
          )}
          {group.items.map((it) => {
            const Icon = it.icon;
            const isActive = it.key === active;
            return (
              <button key={it.key} onClick={() => onNav(it.to)} className={`lp-nav flex w-[74px] flex-col items-center gap-0.5 rounded-2xl py-2 lp-tr ${isActive ? 'lp-nav-active' : ''}`}>
                <span className="lp-ni relative grid h-6 w-6 place-items-center">
                  <Icon size={19} />
                  {it.key === 'lives' && live && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-3 w-3">
                      <span className="lp-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--live)' }} />
                      <span className="relative inline-flex h-3 w-3 rounded-full" style={{ background: 'var(--live)', boxShadow: '0 0 0 2px var(--rail)' }} />
                    </span>
                  )}
                </span>
                <span className="lp-nl text-center text-[9px] font-medium leading-tight">{it.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
}
