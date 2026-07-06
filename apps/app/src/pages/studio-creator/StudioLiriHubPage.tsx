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

// ── Hub Cards ──────────────────────────────────────────────────────────────

const HUB_CARDS = [
  {
    id: 'creer', icon: Plus, title: 'Créer', subtitle: 'Nouveau projet pédagogique ou visuel',
    gradient: 'from-violet-900/30 to-indigo-900/20',
    border: 'border-violet-500/25', accent: 'text-violet-400', accentBg: 'bg-violet-500/15',
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
    gradient: 'from-blue-900/30 to-sky-900/20',
    border: 'border-blue-500/20', accent: 'text-blue-400', accentBg: 'bg-blue-500/15',
    actions: [
      { label: 'Formations en cours', href: '/studio/liri/formation', icon: GraduationCap, desc: 'Programmes actifs' },
      { label: 'Cours en brouillon', href: '/studio/liri/cours', icon: FileText, desc: 'Non finalisés' },
      { label: 'SmartBoards récents', href: '/studio/smartboard', icon: LayoutGrid, desc: 'Derniers workspaces' },
    ],
  },
  {
    id: 'importer', icon: Download, title: 'Importer', subtitle: 'Ressource externe',
    gradient: 'from-emerald-900/30 to-green-900/20',
    border: 'border-emerald-500/20', accent: 'text-emerald-400', accentBg: 'bg-emerald-500/15',
    actions: [
      { label: 'Document source', href: '/studio/liri/import?type=document', icon: FileUp, desc: 'PDF · PPT · texte' },
      { label: 'Template', href: '/studio/liri/import?type=template', icon: FolderOpen, desc: 'Modèles JSON' },
    ],
  },
  {
    id: 'diffuser', icon: Radio, title: 'Diffuser', subtitle: 'Live ou export final',
    gradient: 'from-red-900/30 to-rose-900/20',
    border: 'border-red-500/20', accent: 'text-red-400', accentBg: 'bg-red-500/15',
    actions: [
      { label: 'Multilingue', href: '/studio/liri/multilang', icon: Languages, desc: 'Traduction live/vidéo' },
      { label: 'Live online', href: '/studio/live', icon: Radio, desc: 'Diffusion streaming' },
      { label: 'Exporter', href: '/studio/export-center', icon: FileOutput, desc: 'PDF · JSON · assets' },
    ],
  },
  {
    id: 'bibliotheque', icon: Library, title: 'Bibliothèque', subtitle: 'Assets · templates · presets',
    gradient: 'from-amber-900/30 to-yellow-900/20',
    border: 'border-amber-500/20', accent: 'text-amber-400', accentBg: 'bg-amber-500/15',
    actions: [
      { label: 'Mes assets', href: '/studio/liri/bibliotheque?tab=assets', icon: BookOpen, desc: 'Images · SVG · vidéos' },
      { label: 'Templates', href: '/studio/liri/bibliotheque?tab=templates', icon: FolderOpen, desc: 'Modèles SmartBoard' },
    ],
  },
];

const PILIERS = [
  { label: 'Course Builder', href: '/studio/liri/cours', icon: Brain, desc: 'Contenu pédagogique 10 étapes', accent: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  { label: 'Formation Builder', href: '/studio/liri/formation', icon: GraduationCap, desc: 'Programme dans le temps', accent: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { label: 'Masterclass Factory', href: '/dashboard/tools/masterclass-factory', icon: Sparkles, desc: 'Génération IA 21/26 segments', accent: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  { label: 'SmartBoard Designer', href: '/studio/smartboard', icon: LayoutGrid, desc: 'Design & composition', accent: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  { label: 'Export Center', href: '/studio/export-center', icon: FileOutput, desc: 'PDF · PPTX · JSON', accent: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { label: 'Multilingue', href: '/studio/liri/multilang', icon: Languages, desc: 'Traduction live/vidéo', accent: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  { label: 'Live Classroom', href: '/studio/live', icon: Radio, desc: 'Diffusion multi-sorties', accent: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  { label: 'Bibliothèque', href: '/studio/liri/bibliotheque', icon: Library, desc: 'Assets & templates', accent: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
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
        'hover:shadow-[0_8px_40px_rgba(139,92,246,0.12)]',
      )}
      style={{ background: `linear-gradient(135deg, var(--tw-gradient-stops))` }}
    >
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-60', card.gradient)} />
      <div className="absolute inset-0 bg-[#0a0a14]/70 backdrop-blur-sm" />
      <div className="relative z-10 p-5">
        <div className="flex items-start justify-between mb-4">
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', card.accentBg)}>
            <Icon className={cn('h-5 w-5', card.accent)} />
          </div>
          <ChevronRight className={cn('h-4 w-4 text-white/30 transition-transform duration-200', expanded && 'rotate-90')} />
        </div>
        <h3 className="text-[15px] font-semibold text-white mb-0.5">{card.title}</h3>
        <p className="text-[12px] text-white/40">{card.subtitle}</p>
        {expanded && (
          <div className="mt-4 flex flex-col gap-2" onClick={e => e.stopPropagation()}>
            {card.actions.map(action => {
              const AIcon = action.icon;
              return (
                <Link key={action.label} to={action.href}
                  className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2.5 transition-all hover:bg-white/[0.09] hover:border-white/15">
                  <AIcon className={cn('h-4 w-4 flex-shrink-0', card.accent)} />
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-white/85 truncate">{action.label}</div>
                    <div className="text-[10px] text-white/32 truncate">{action.desc}</div>
                  </div>
                  <ArrowRight className="ml-auto h-3 w-3 flex-shrink-0 text-white/20" />
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

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-white/30" />;

  const stats = data?.data ?? {};
  return (
    <div className="flex gap-4 text-[12px] text-white/50">
      <span><span className="text-white/80 font-medium">{stats.workspaceCount ?? 0}</span> workspaces</span>
      <span><span className="text-white/80 font-medium">{stats.projectCount ?? 0}</span> projets</span>
      <span><span className="text-white/80 font-medium">{stats.formationCount ?? 0}</span> formations</span>
      <span><span className="text-white/80 font-medium">{stats.assetCount ?? 0}</span> assets</span>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function StudioLiriHubPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a14] text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-white/[0.06]">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-white/40 hover:text-white/70 transition-colors">
            <LayoutGrid className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-violet-400 via-fuchsia-400 to-amber-400 bg-clip-text text-transparent">
              Studio LIRI
            </h1>
            <p className="text-[12px] text-white/30">Écosystème de création pédagogique</p>
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
                  <div className="text-[12px] font-medium text-white/85">{p.label}</div>
                  <div className="text-[10px] text-white/32 truncate">{p.desc}</div>
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
