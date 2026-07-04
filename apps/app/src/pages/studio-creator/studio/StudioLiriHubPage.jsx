/**
 * StudioLiriHubPage — Hub principal de l'écosystème LIRI
 * Route : /studio/liri
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap, Brain, LayoutGrid, Radio, Library, Home,
  Download, Plus, Clock, ArrowRight, Sparkles,
  FolderOpen, FileText, Layers, Zap, BookOpen,
  FileUp, Package, Film, FileOutput,   Star,   Camera, Image as ImageIconLucide,
  ChevronRight,
  Monitor,
  Route,
  Compass,
  Languages,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { cn } from '@/lib/utils';
import StudioDesignerLikeShell from '@/components/liri/liri-ecosystem/StudioDesignerLikeShell';

const HUB_CARDS = [
  {
    id: 'creer', icon: Plus, title: 'Créer', subtitle: 'Nouveau projet pédagogique ou visuel',
    gradient: 'radial-gradient(circle at 20% 30%, rgba(217,119,87,0.28), transparent 55%), radial-gradient(circle at 80% 70%, rgba(200,110,70,0.16), transparent 50%)',
    border: 'border-[#d97757]/25', glow: 'hover:shadow-[0_8px_40px_rgba(217,119,87,0.20)]',
    accent: 'text-[#e0926a]', accentBg: 'bg-[#d97757]/15', iconGlow: 'shadow-[0_0_18px_rgba(217,119,87,0.42)]',
    actions: [
      { label: 'Choisir un constructeur', href: '/studio/liri/constructeurs', icon: Compass, desc: 'Programme, cours unique, école du futur, Studio vidéo…' },
      { label: 'Formation complète', href: '/studio/liri/formation', icon: GraduationCap, desc: 'Programme multi-modules calendrier' },
      { label: 'Cours unique', href: '/studio/liri/cours', icon: Brain, desc: '10 étapes · MasterScript · SmartBoard' },
      { label: 'Agent LIRI (immersif)', href: '/studio/liri-agent', icon: Sparkles, desc: 'Même 10 étapes · plein écran Studio' },
      { label: 'Pédagogie du futur', href: '/studio/liri/pedagogie-futur', icon: Route, desc: 'Parcours · weekly grammar · blocs IA' },
      { label: 'SmartBoard seul', href: '/studio/smartboard-designer', icon: LayoutGrid, desc: 'Design visuel interactif' },
      { label: 'Cinéma pédagogique', href: '/studio/smartboard-cinema', icon: Camera, desc: 'Prises par slide · workspace (bêta)' },
      { label: 'LIRI Studio Image', href: '/studio/liri/studio-image', icon: ImageIconLucide, desc: 'Canvas + IA contextuelle · suggestions · LONGIA' },
      { label: 'Visuel / Affiche', href: '/studio/smartboard-designer', icon: Layers, desc: 'Composite Studio · LUT · Poster' },
    ],
  },
  {
    id: 'reprendre', icon: Clock, title: 'Reprendre', subtitle: 'Continuer un projet existant',
    gradient: 'radial-gradient(circle at 20% 30%, rgba(207,122,82,0.26), transparent 55%), radial-gradient(circle at 80% 70%, rgba(176,83,47,0.15), transparent 50%)',
    border: 'border-[#cf7a52]/22', glow: 'hover:shadow-[0_8px_40px_rgba(207,122,82,0.18)]',
    accent: 'text-[#daa07a]', accentBg: 'bg-[#cf7a52]/15', iconGlow: 'shadow-[0_0_18px_rgba(207,122,82,0.40)]',
    actions: [
      { label: 'Formations en cours', href: '/studio/liri/formation', icon: GraduationCap, desc: 'Vos programmes actifs' },
      { label: 'Cours en brouillon', href: '/studio/liri/cours', icon: FileText, desc: 'Parcours non finalisés' },
      { label: 'SmartBoards récents', href: '/studio/smartboard-designer', icon: LayoutGrid, desc: 'Derniers workspaces' },
      { label: 'Lives planifiés', href: '/studio/live', icon: Radio, desc: 'Sessions à venir' },
    ],
  },
  {
    id: 'importer', icon: Download, title: 'Importer', subtitle: 'Ressource externe ou communautaire',
    gradient: 'radial-gradient(circle at 20% 30%, rgba(207,128,89,0.25), transparent 55%), radial-gradient(circle at 80% 70%, rgba(184,108,66,0.14), transparent 50%)',
    border: 'border-[#cf8059]/20', glow: 'hover:shadow-[0_8px_40px_rgba(207,128,89,0.18)]',
    accent: 'text-[#e0976a]', accentBg: 'bg-[#cf8059]/15', iconGlow: 'shadow-[0_0_18px_rgba(207,128,89,0.38)]',
    actions: [
      { label: 'Document source', href: '/studio/liri/import?type=document', icon: FileUp, desc: 'PDF · PPT · texte · notes' },
      { label: 'Template', href: '/studio/liri/import?type=template', icon: FolderOpen, desc: 'Modèles JSON · presets' },
      { label: 'Asset visuel', href: '/studio/liri/import?type=asset', icon: FileText, desc: 'Image · SVG · LUT' },
      { label: 'Pack communautaire', href: '/studio/liri/import?type=pack', icon: Package, desc: 'Collections partagées' },
    ],
  },
  {
    id: 'diffuser', icon: Radio, title: 'Diffuser', subtitle: 'Live ou export final',
    gradient: 'radial-gradient(circle at 20% 30%, rgba(224,112,90,0.28), transparent 55%), radial-gradient(circle at 80% 70%, rgba(206,76,55,0.16), transparent 50%)',
    border: 'border-[#e0705a]/22', glow: 'hover:shadow-[0_8px_40px_rgba(224,112,90,0.18)]',
    accent: 'text-[#ec8a72]', accentBg: 'bg-[#e0705a]/15', iconGlow: 'shadow-[0_0_18px_rgba(224,112,90,0.38)]',
    actions: [
      { label: 'Multilingue (live / vidéo)', href: '/studio/liri/multilang', icon: Languages, desc: 'Sessions traduction · projets export' },
      { label: 'Live online', href: '/studio/live', icon: Radio, desc: 'Diffusion streaming' },
      { label: 'Live hybride', href: '/studio/live-immersive', icon: Film, desc: 'Présentiel + streaming' },
      { label: 'Vue projecteur', href: '/studio/live-preview', icon: Zap, desc: 'Plein écran · sans UI' },
      { label: 'Exporter', href: '/studio/export-center', icon: FileOutput, desc: 'PDF · JSON · assets' },
      { label: 'Contrôle app intégrée', href: '/studio/liri/embedded-control', icon: Monitor, desc: 'Electron · capture · injection OS (LIRI_FULL_SYSTEM)' },
    ],
  },
  {
    id: 'bibliotheque', icon: Library, title: 'Bibliothèque', subtitle: 'Assets · templates · presets',
    gradient: 'radial-gradient(circle at 20% 30%, rgba(217,154,78,0.24), transparent 55%), radial-gradient(circle at 80% 70%, rgba(193,124,52,0.14), transparent 50%)',
    border: 'border-[#d99a4e]/20', glow: 'hover:shadow-[0_8px_40px_rgba(217,154,78,0.18)]',
    accent: 'text-[#e6b878]', accentBg: 'bg-[#d99a4e]/15', iconGlow: 'shadow-[0_0_18px_rgba(217,154,78,0.38)]',
    actions: [
      { label: 'Mes assets', href: '/studio/liri/bibliotheque?tab=assets', icon: BookOpen, desc: 'Images · SVG · vidéos' },
      { label: 'Templates', href: '/studio/liri/bibliotheque?tab=templates', icon: FolderOpen, desc: 'Modèles SmartBoard' },
      { label: 'LUT & Presets', href: '/studio/liri/bibliotheque?tab=lut', icon: Layers, desc: 'Styles visuels' },
      { label: 'Communautaire', href: '/studio/liri/bibliotheque?tab=community', icon: Star, desc: 'Packs partagés' },
    ],
  },
];

// Piliers = mêmes nuances chaudes que l'objet ACCENT du shell (zéro froid).
const PILIERS = [
  { label: 'Constructeurs', href: '/studio/liri/constructeurs', icon: Compass, desc: 'Choisir programme / cours / scolaire', accent: 'text-[#e0926a]', bg: 'bg-[#d97757]/10', border: 'border-[#d97757]/20' },
  { label: 'Formation Builder', href: '/studio/liri/formation', icon: GraduationCap, desc: 'Programme dans le temps', accent: 'text-[#daa07a]', bg: 'bg-[#cf7a52]/10', border: 'border-[#cf7a52]/20' },
  { label: 'Course Builder', href: '/studio/liri/cours', icon: Brain, desc: 'Contenu pédagogique', accent: 'text-[#e6b878]', bg: 'bg-[#d99a4e]/10', border: 'border-[#d99a4e]/20' },
  { label: 'Pédagogie du futur', href: '/studio/liri/pedagogie-futur', icon: Route, desc: 'Méthode · parcours · post-prod', accent: 'text-[#dc9a72]', bg: 'bg-[#d8916a]/10', border: 'border-[#d8916a]/20' },
  { label: 'Multilingue', href: '/studio/liri/multilang', icon: Languages, desc: 'Live translate · vidéo multilingue', accent: 'text-[#e0976a]', bg: 'bg-[#cf8059]/10', border: 'border-[#cf8059]/20' },
  { label: 'Studio Image', href: '/studio/liri/studio-image', icon: ImageIconLucide, desc: 'Création visuelle assistée', accent: 'text-[#e0926a]', bg: 'bg-[#d97757]/10', border: 'border-[#d97757]/20' },
  { label: 'SmartBoard Designer', href: '/studio/smartboard-designer', icon: LayoutGrid, desc: 'Design & composition', accent: 'text-[#e6b878]', bg: 'bg-[#e3aa6b]/10', border: 'border-[#e3aa6b]/20' },
  { label: 'Live Classroom', href: '/studio/live', icon: Radio, desc: 'Diffusion multi-sorties', accent: 'text-[#ec8a72]', bg: 'bg-[#e0705a]/10', border: 'border-[#e0705a]/20' },
];

function HubCard({ card, index }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = card.icon;
  return (
    <motion.div
      initial={false} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      className={cn('relative overflow-hidden rounded-2xl border cursor-pointer transition-all duration-300', card.border, card.glow)}
      style={{ background: card.gradient }}
      onClick={() => setExpanded(v => !v)}
    >
      <div className="absolute inset-0 bg-[#16120f]/64 backdrop-blur-sm" />
      <div className="relative z-10 p-5">
        <div className="flex items-start justify-between mb-4">
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', card.accentBg, card.iconGlow)}>
            <Icon className={cn('h-5 w-5', card.accent)} />
          </div>
          <ChevronRight className={cn('h-4 w-4 text-white/30 transition-transform duration-200', expanded && 'rotate-90')} />
        </div>
        <h3 className="text-[15px] font-semibold text-white mb-0.5">{card.title}</h3>
        <p className="text-[12px] text-white/40 leading-relaxed">{card.subtitle}</p>
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
    </motion.div>
  );
}

export default function StudioLiriHubPage() {
  return (
    <StudioDesignerLikeShell
      railActiveKey="hub"
      pageLabel="Hub"
      pageAccent="violet"
      TitleIcon={Home}
      titleLine="Atelier LIRI"
    >
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Hero */}
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-8">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#e0926a]">Écosystème</span>
            <LiriWordmark size="kicker" className="text-[#e0926a]" bulbColor="#e0926a" subtleGlow />
          </div>
          <h1 className="text-[26px] font-bold text-white leading-tight mb-1">Un seul atelier intelligent.</h1>
          <p className="text-[14px] text-white/40 max-w-lg">
            De l'idée à la diffusion — créez, structurez, designez et enseignez dans une seule logique pédagogique et visuelle.
          </p>
        </motion.div>

        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
          className="mb-8 max-w-2xl rounded-xl border border-[#d99a4e]/20 bg-[#d99a4e]/[0.06] px-4 py-3"
        >
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#e6b878] mb-1.5">Constructeurs puis Designer</p>
          <p className="text-[13px] leading-relaxed text-white/55">
            <strong className="text-white/75 font-medium">Formation</strong> et{' '}
            <strong className="text-white/75 font-medium">Cours</strong> structurent d'abord le pédagogique (parcours, 10 étapes,
            MasterScript, checkpoints). Quand le cours est prêt,{' '}
            <span className="inline-flex items-end gap-1 font-medium text-white/75">
              <LiriWordmark size="kicker" className="text-white/75" bulbColor="#d9a574" subtleGlow />
              <span>Designer</span>
            </span>{' '}
            sert à le rendre visuel : slides, mise en page et tout
            ce qui est éditable sur le canevas SmartBoard — avant diffusion ou live.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            <Link
              to="/studio/liri/constructeurs"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#e0926a] transition-colors hover:text-[#ecae90]"
            >
              <Compass className="h-3.5 w-3.5" />
              Comparer les constructeurs
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/studio/smartboard-designer"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#e6b878] transition-colors hover:text-[#eec896]"
            >
              SmartBoard Designer
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.div>

        {/* 5 cartes */}
        <section className="mb-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {HUB_CARDS.map((card, i) => <HubCard key={card.id} card={card} index={i} />)}
          </div>
        </section>

        {/* 4 Piliers */}
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.15em] text-white/35 mb-3">Studios spécialisés</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {PILIERS.map((p, i) => {
              const Icon = p.icon;
              return (
                <motion.div key={p.label} initial={false} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.42 + i * 0.06 }}>
                  <Link to={p.href} className={cn('flex flex-col gap-2 rounded-xl border p-4 transition-all hover:bg-white/[0.05] group', p.border, 'bg-white/[0.02]')}>
                    <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', p.bg)}>
                      <Icon className={cn('h-4 w-4', p.accent)} />
                    </div>
                    <div>
                      <div className="text-[12px] font-semibold text-white/80">{p.label}</div>
                      <div className="text-[10px] text-white/32 mt-0.5">{p.desc}</div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </StudioDesignerLikeShell>
  );
}
