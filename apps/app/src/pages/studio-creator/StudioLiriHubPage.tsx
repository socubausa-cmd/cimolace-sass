/**
 * StudioLiriHubPage — Hub principal de l'écosystème LIRI
 * Route : /studio/liri
 * V2 port from isna_app V1
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap, Brain, LayoutGrid, Radio, Library,
  Download, Plus, Clock, ArrowRight, Sparkles,
  FolderOpen, FileText, Layers, Zap, BookOpen,
  FileUp, Package, FileOutput, Star, Camera,
  Image as ImageIcon, ChevronRight, Monitor, Compass, Languages,
  Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';

// ── Charte LIRI — rampe chaude partagée par les 5 constructeurs ────────────
//
// POURQUOI une rampe explicite plutôt que les couleurs Tailwind nommées :
// les classes `violet-`/`blue-`/`cyan-`/`emerald-` sont des teintes FROIDES
// bannies par la directive artistique. On les remplace ici à la SOURCE (dans
// le JSX) et pas via un remap CSS : un remap ne repeint que l'intérieur de son
// scope et laisse fuiter le froid dès qu'un composant en sort.
//
// Chaque carte gardait un sens porté par sa couleur (créer / reprendre /
// importer / diffuser / bibliothèque). On conserve cette DIFFÉRENCIATION en
// jouant sur la famille chaude — corail, brique, argile, brasier, or — jamais
// sur une teinte froide.
//
//   corail  #d97757  encre #e08a5f   → l'action, la création
//   brique  #cf7a52  encre #daa07a   → la reprise
//   argile  #cf8059  encre #e0976a   → l'import
//   brasier #e0705a  encre #ec8a72   → la diffusion / le live
//   or      #d99a4e  encre #e6b878   → la bibliothèque, l'accent secondaire
//
// Encres neutres (mesurées sur #262624) : /100 = 13,8:1 · /80 = 9,3:1 ·
// /65 = 6,7:1 · /60 = 5,9:1 (plancher du texte). /40 = 3,5:1 → DÉCORATIF
// uniquement (chevrons, flèches), jamais du texte à lire.

// ── Hub Cards ──────────────────────────────────────────────────────────────

const HUB_CARDS = [
  {
    id: 'creer', icon: Plus, title: 'Créer', subtitle: 'Nouveau projet pédagogique ou visuel',
    gradient: 'from-[#d97757]/25 to-[#c96544]/15',
    border: 'border-[#d97757]/30', accent: 'text-[#e08a5f]', accentBg: 'bg-[#d97757]/15',
    actions: [
      { label: 'Cours unique (Course Builder)', href: '/studio/liri/cours', icon: Brain, desc: '10 étapes · MasterScript · SmartBoard' },
      { label: 'Formation complète', href: '/studio/liri/formation', icon: GraduationCap, desc: 'Programme multi-modules' },
      { label: 'Masterclass (IA)', href: '/dashboard/tools/masterclass-factory', icon: Sparkles, desc: 'Génération 21/26 segments' },
      { label: 'SmartBoard Designer', href: '/studio/smartboard', icon: LayoutGrid, desc: 'Design visuel interactif' },
      { label: 'Studio Image', href: '/studio/liri/studio-image', icon: ImageIcon, desc: 'Canvas + IA contextuelle' },
    ],
  },
  {
    id: 'reprendre', icon: Clock, title: 'Reprendre', subtitle: 'Continuer un projet existant',
    gradient: 'from-[#cf7a52]/25 to-[#b0532f]/15',
    border: 'border-[#cf7a52]/25', accent: 'text-[#daa07a]', accentBg: 'bg-[#cf7a52]/15',
    actions: [
      { label: 'Formations en cours', href: '/studio/liri/formation', icon: GraduationCap, desc: 'Programmes actifs' },
      { label: 'Cours en brouillon', href: '/studio/liri/cours', icon: FileText, desc: 'Non finalisés' },
      { label: 'SmartBoards récents', href: '/studio/smartboard', icon: LayoutGrid, desc: 'Derniers espaces de travail' },
    ],
  },
  {
    id: 'importer', icon: Download, title: 'Importer', subtitle: 'Ressource externe',
    gradient: 'from-[#cf8059]/25 to-[#b86c42]/15',
    border: 'border-[#cf8059]/25', accent: 'text-[#e0976a]', accentBg: 'bg-[#cf8059]/15',
    actions: [
      { label: 'Document source', href: '/studio/liri/import?type=document', icon: FileUp, desc: 'PDF · PPT · texte' },
      { label: 'Modèle', href: '/studio/liri/import?type=template', icon: FolderOpen, desc: 'Modèles JSON' },
    ],
  },
  {
    id: 'diffuser', icon: Radio, title: 'Diffuser', subtitle: 'Live ou export final',
    gradient: 'from-[#e0705a]/25 to-[#ce4c37]/15',
    border: 'border-[#e0705a]/25', accent: 'text-[#ec8a72]', accentBg: 'bg-[#e0705a]/15',
    actions: [
      { label: 'Multilingue', href: '/studio/liri/multilang', icon: Languages, desc: 'Traduction live/vidéo' },
      { label: 'Live en ligne', href: '/studio/live', icon: Radio, desc: 'Diffusion streaming' },
      { label: 'Exporter', href: '/studio/export-center', icon: FileOutput, desc: 'PDF · JSON · ressources' },
    ],
  },
  {
    id: 'bibliotheque', icon: Library, title: 'Bibliothèque', subtitle: 'Ressources · modèles · préréglages',
    gradient: 'from-[#d99a4e]/25 to-[#c17c34]/15',
    border: 'border-[#d99a4e]/25', accent: 'text-[#e6b878]', accentBg: 'bg-[#d99a4e]/15',
    actions: [
      { label: 'Mes ressources', href: '/studio/liri/bibliotheque?tab=assets', icon: BookOpen, desc: 'Images · SVG · vidéos' },
      { label: 'Modèles', href: '/studio/liri/bibliotheque?tab=templates', icon: FolderOpen, desc: 'Modèles SmartBoard' },
    ],
  },
];

// Huit piliers, huit teintes CHAUDES distinctes : la couleur reste porteuse de
// sens (chaque studio garde son identité) mais aucune n'est froide. L'olive
// #5a8f52 de l'Export Center rend le « terminé / exporté » de l'ancien emerald
// sans passer par un vert bleuté.
const PILIERS = [
  { label: 'Course Builder', href: '/studio/liri/cours', icon: Brain, desc: 'Contenu pédagogique 10 étapes', accent: 'text-[#e6b878]', bg: 'bg-[#d99a4e]/10', border: 'border-[#d99a4e]/20' },
  { label: 'Formation Builder', href: '/studio/liri/formation', icon: GraduationCap, desc: 'Programme dans le temps', accent: 'text-[#daa07a]', bg: 'bg-[#cf7a52]/10', border: 'border-[#cf7a52]/20' },
  { label: 'Masterclass Factory', href: '/dashboard/tools/masterclass-factory', icon: Sparkles, desc: 'Génération IA 21/26 segments', accent: 'text-[#e08a5f]', bg: 'bg-[#d97757]/10', border: 'border-[#d97757]/20' },
  { label: 'SmartBoard Designer', href: '/studio/smartboard', icon: LayoutGrid, desc: 'Design et composition', accent: 'text-[#e0a458]', bg: 'bg-[#d4924a]/10', border: 'border-[#d4924a]/20' },
  { label: 'Export Center', href: '/studio/export-center', icon: FileOutput, desc: 'PDF · PPTX · JSON', accent: 'text-[#8fbf7a]', bg: 'bg-[#5a8f52]/10', border: 'border-[#5a8f52]/20' },
  { label: 'Multilingue', href: '/studio/liri/multilang', icon: Languages, desc: 'Traduction live/vidéo', accent: 'text-[#dc9a72]', bg: 'bg-[#d8916a]/10', border: 'border-[#d8916a]/20' },
  { label: 'Live Classroom', href: '/studio/live', icon: Radio, desc: 'Diffusion multi-sorties', accent: 'text-[#ec8a72]', bg: 'bg-[#e0705a]/10', border: 'border-[#e0705a]/20' },
  { label: 'Bibliothèque', href: '/studio/liri/bibliotheque', icon: Library, desc: 'Ressources et modèles', accent: 'text-[#e0976a]', bg: 'bg-[#cf8059]/10', border: 'border-[#cf8059]/20' },
];

// ── HubCard ────────────────────────────────────────────────────────────────

function HubCard({ card, index }: { card: typeof HUB_CARDS[0]; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = card.icon;

  return (
    <div
      onClick={() => setExpanded(v => !v)}
      className={cn(
        'relative overflow-hidden rounded-2xl border cursor-pointer transition-all duration-300',
        card.border,
        // Halo de survol corail (était un halo violet rgba(139,92,246)).
        'hover:shadow-[0_8px_40px_rgba(217,119,87,0.18)]',
      )}
      style={{ background: `linear-gradient(135deg, var(--tw-gradient-stops))` }}
    >
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-60', card.gradient)} />
      {/* Voile qui ramène la carte au niveau du fond de page : brun profond
          #16120f et non plus le bleu nuit #0a0a14. */}
      <div className="absolute inset-0 bg-[#16120f]/70 backdrop-blur-sm" />
      <div className="relative z-10 p-5">
        <div className="flex items-start justify-between mb-4">
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', card.accentBg)}>
            <Icon className={cn('h-5 w-5', card.accent)} />
          </div>
          {/* Chevron = pure décoration d'état (ouvert/fermé), le libellé porte
              déjà l'information → /40 admis ici, jamais sur du texte. */}
          <ChevronRight className={cn('h-4 w-4 text-[#f5f4ee]/40 transition-transform duration-200', expanded && 'rotate-90')} />
        </div>
        <h3 className="text-[15px] font-semibold text-[#f5f4ee] mb-0.5">{card.title}</h3>
        <p className="text-[12px] text-[#f5f4ee]/65">{card.subtitle}</p>
        {expanded && (
          <div className="mt-4 flex flex-col gap-2" onClick={e => e.stopPropagation()}>
            {card.actions.map(action => {
              const AIcon = action.icon;
              return (
                <Link key={action.label} to={action.href}
                  className="flex items-center gap-3 rounded-xl border border-[#f5f4ee]/[0.09] bg-[#f5f4ee]/[0.04] px-3 py-2.5 transition-all hover:bg-[#f5f4ee]/[0.09] hover:border-[#d97757]/35">
                  <AIcon className={cn('h-4 w-4 flex-shrink-0', card.accent)} />
                  <div className="min-w-0">
                    {/* Libellé + description sont du texte à LIRE : /80 (8,4:1)
                        et /60 (5,5:1) sur le composite clair de la carte. Les
                        anciens /85 et /32 tombaient à 1,8:1 pour la desc. */}
                    <div className="text-[12px] font-medium text-[#f5f4ee]/80 truncate">{action.label}</div>
                    <div className="text-[10px] text-[#f5f4ee]/60 truncate">{action.desc}</div>
                  </div>
                  <ArrowRight className="ml-auto h-3 w-3 flex-shrink-0 text-[#f5f4ee]/40" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── QuickStats ─────────────────────────────────────────────────────────────

function QuickStats() {
  const { data, isLoading } = useQuery({
    queryKey: ['studio-hub-stats'],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/studio/hub/stats`, {
        headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
      });
      return res.json();
    },
    refetchInterval: 30000,
  });

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-[#d97757]" />;

  const stats = data?.data ?? {};
  return (
    // Compteurs : la valeur en or (accent secondaire, 8,3:1), l'unité en encre
    // /65 (6,7:1). L'ancien /50 tombait sous le seuil de lecture.
    <div className="flex gap-4 text-[12px] text-[#f5f4ee]/65">
      <span><span className="text-[#e6b878] font-medium">{stats.workspaceCount ?? 0}</span> espaces</span>
      <span><span className="text-[#e6b878] font-medium">{stats.projectCount ?? 0}</span> projets</span>
      <span><span className="text-[#e6b878] font-medium">{stats.formationCount ?? 0}</span> formations</span>
      <span><span className="text-[#e6b878] font-medium">{stats.assetCount ?? 0}</span> ressources</span>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function StudioLiriHubPage() {
  return (
    // Fond de page = #262624 (charte) à la place du bleu nuit #0a0a14.
    <div className="flex flex-col min-h-screen bg-[#262624] text-[#f5f4ee]">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-[#f5f4ee]/[0.09]">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-[#f5f4ee]/65 hover:text-[#d97757] transition-colors">
            <LayoutGrid className="h-5 w-5" />
          </Link>
          <div>
            {/* Dégradé du titre : corail → ambre → or. L'ancien violet→fuchsia
                →ambre traversait deux teintes froides bannies. */}
            <h1 className="text-xl font-bold bg-gradient-to-r from-[#e08a5f] via-[#e0a458] to-[#e6c48f] bg-clip-text text-transparent">
              Studio LIRI
            </h1>
            <p className="text-[12px] text-[#f5f4ee]/65">Écosystème de création pédagogique</p>
          </div>
        </div>
        <QuickStats />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {/* Piliers rapides */}
        <div className="grid grid-cols-4 gap-3 mb-10">
          {PILIERS.map(p => {
            const Icon = p.icon;
            return (
              <Link key={p.label} to={p.href}
                className={cn('flex items-center gap-3 rounded-xl border px-4 py-3 transition-all hover:scale-[1.02]', p.bg, p.border)}>
                <Icon className={cn('h-4 w-4 flex-shrink-0', p.accent)} />
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-[#f5f4ee]/80">{p.label}</div>
                  <div className="text-[10px] text-[#f5f4ee]/60 truncate">{p.desc}</div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Hub cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {HUB_CARDS.map((card, i) => (
            <HubCard key={card.id} card={card} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
