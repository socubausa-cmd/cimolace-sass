import React from 'react';
import {
  House, Video, MessagesSquare, MessageCircle, WandSparkles, Library, GraduationCap, Sparkles,
  CalendarDays, BookOpen, School, Calendar, FileText, Award, AlertTriangle, FolderOpen, Tag,
} from 'lucide-react';

/**
 * RAIL groupé du portail LIRI — SOURCE UNIQUE partagée par l'accueil (LiriPortalPage) et le
 * shell des sous-pages (LiriPortalShell), pour une nav 100% cohérente.
 *
 * LIRI a 2 modes : SIMPLE (Zoom : Accueil/Lives/Forum/Messages) et ÉCOLE (ajoute la Vie
 * scolaire). Visibilité 3 niveaux :
 *   creator: true  → réservé au CRÉATEUR (Studio/École/Brain…)
 *   school: true   → réservé à l'ÉLÈVE d'un tenant ÉCOLE activé (agenda/notes/cours…)
 *   (aucun flag)   → partagé (Accueil, Lives, Forum, Messages)
 */
export type RailKey =
  | 'accueil' | 'semaine' | 'formations'
  | 'vie-scolaire' | 'agenda' | 'notes' | 'evaluations' | 'absences'
  | 'lives' | 'forum' | 'messages'
  | 'biblio-eleve' | 'documents'
  | 'studio' | 'ecole' | 'services' | 'biblio' | 'brain' | 'integrations' | 'reglages';

export type RailItem = { key: RailKey; label: string; icon: typeof House; to: string; creator?: boolean; school?: boolean };

export const RAIL_GROUPS: { section?: string; items: RailItem[] }[] = [
  { items: [
    { key: 'accueil', label: 'Accueil', icon: House, to: '/liri' },
  ] },
  { section: 'Parcours', items: [
    { key: 'semaine', label: 'Ma semaine', icon: CalendarDays, to: '/liri/semaine', school: true },
    { key: 'formations', label: 'Mes cours', icon: BookOpen, to: '/liri/formations', school: true },
  ] },
  { section: 'Scolarité', items: [
    { key: 'vie-scolaire', label: 'Vie scolaire', icon: School, to: '/liri/vie-scolaire', school: true },
    { key: 'agenda', label: 'Agenda', icon: Calendar, to: '/liri/agenda', school: true },
    { key: 'notes', label: 'Notes', icon: FileText, to: '/liri/notes', school: true },
    { key: 'evaluations', label: 'Évals', icon: Award, to: '/liri/evaluations', school: true },
    { key: 'absences', label: 'Absences', icon: AlertTriangle, to: '/liri/absences', school: true },
  ] },
  { section: 'Communauté', items: [
    { key: 'lives', label: 'Lives', icon: Video, to: '/lives' },
    { key: 'forum', label: 'Forum', icon: MessagesSquare, to: '/liri/forum' },
    { key: 'messages', label: 'Messages', icon: MessageCircle, to: '/liri/messages' },
  ] },
  { section: 'Ressources', items: [
    { key: 'biblio-eleve', label: 'Biblio.', icon: Library, to: '/liri/bibliotheque', school: true },
    { key: 'documents', label: 'Documents', icon: FolderOpen, to: '/liri/documents', school: true },
  ] },
  { section: 'Création', items: [
    { key: 'studio', label: 'Studio', icon: WandSparkles, to: '/studio/liri', creator: true },
    { key: 'ecole', label: 'École', icon: GraduationCap, to: '/liri/ecole', creator: true },
    { key: 'services', label: 'Services', icon: Tag, to: '/liri/services', creator: true },
    { key: 'biblio', label: 'Biblio.', icon: Library, to: '/studio/liri/bibliotheque', creator: true },
    { key: 'brain', label: 'Brain', icon: Sparkles, to: '/dashboard/liri', creator: true },
  ] },
];

/** Liste PLATE des items du rail, filtrés par rôle + mode école — source de la barre de
 *  navigation basse mobile (le rail latéral 92px est masqué < md). Même filtre que LiriRailGroups. */
export function getRailItems(opts: { isCreator: boolean; schoolActive: boolean }): RailItem[] {
  const { isCreator, schoolActive } = opts;
  return RAIL_GROUPS.flatMap((g) => g.items)
    .filter((it) => (it.creator ? isCreator : it.school ? (!isCreator && schoolActive) : true));
}

/** Rend les groupes du rail (labels de section + boutons), filtrés par rôle + mode école. */
export function LiriRailGroups({
  active, isCreator, schoolActive, live = false, onNav,
}: {
  active?: RailKey;
  isCreator: boolean;
  schoolActive: boolean;
  live?: boolean;
  onNav: (to: string) => void;
}) {
  return (
    <>
      {RAIL_GROUPS.map((group, gi) => {
        const items = group.items.filter((it) => (it.creator ? isCreator : it.school ? (!isCreator && schoolActive) : true));
        if (!items.length) return null;
        return (
          <div key={group.section || `g${gi}`} className="flex w-full flex-col items-center gap-0.5">
            {group.section && (
              <div className="mb-0.5 mt-2 w-full px-1 text-center lp-faint" style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{group.section}</div>
            )}
            {items.map((it) => {
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
        );
      })}
    </>
  );
}
