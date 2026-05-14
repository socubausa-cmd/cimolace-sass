/**
 * LiriGlobalShell — Layout unifié de l'écosystème LIRI
 * Sidebar gauche + Top bar + zone de contenu
 */
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, BookOpen, Brain, LayoutGrid, Radio, Library,
  Download, Settings, ChevronRight, Menu,
  Bell, FileOutput, LogOut, GraduationCap, Layers, Route,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';

const NAV_ITEMS = [
  { id: 'hub',          path: '/studio/liri',             icon: Home,         label: 'Hub',          accentClass: 'text-violet-400', bgClass: 'bg-violet-500/15', borderClass: 'border-violet-500/30', glowClass: 'shadow-[0_0_16px_rgba(139,92,246,0.4)]' },
  { id: 'formation',    path: '/studio/liri/formation',   icon: GraduationCap,label: 'Formation',    accentClass: 'text-blue-400',   bgClass: 'bg-blue-500/15',   borderClass: 'border-blue-500/30',   glowClass: 'shadow-[0_0_16px_rgba(59,130,246,0.4)]' },
  { id: 'cours',        path: '/studio/liri/cours',       icon: Brain,        label: 'Cours',        accentClass: 'text-amber-400',  bgClass: 'bg-amber-500/15',  borderClass: 'border-amber-500/30',  glowClass: 'shadow-[0_0_16px_rgba(245,158,11,0.4)]' },
  { id: 'pedagogie-futur', path: '/studio/liri/pedagogie-futur', icon: Route, label: 'Parcours', accentClass: 'text-teal-400', bgClass: 'bg-teal-500/15', borderClass: 'border-teal-500/30', glowClass: 'shadow-[0_0_16px_rgba(45,212,191,0.35)]' },
  { id: 'designer',     path: '/studio/smartboard-designer', icon: LayoutGrid,label: 'Designer',     accentClass: 'text-cyan-400',   bgClass: 'bg-cyan-500/15',   borderClass: 'border-cyan-500/30',   glowClass: 'shadow-[0_0_16px_rgba(34,211,238,0.4)]' },
  { id: 'composite',    path: '/studio/smartboard-designer', icon: Layers,    label: 'Composite',    accentClass: 'text-purple-400', bgClass: 'bg-purple-500/15', borderClass: 'border-purple-500/30', glowClass: 'shadow-[0_0_16px_rgba(168,85,247,0.4)]' },
  { id: 'live',         path: '/studio/live',             icon: Radio,        label: 'Live',         accentClass: 'text-red-400',    bgClass: 'bg-red-500/15',    borderClass: 'border-red-500/30',    glowClass: 'shadow-[0_0_16px_rgba(248,113,113,0.4)]' },
  { id: 'bibliotheque', path: '/studio/liri/bibliotheque',icon: Library,      label: 'Bibliothèque', accentClass: 'text-emerald-400',bgClass: 'bg-emerald-500/15',borderClass: 'border-emerald-500/30',glowClass: 'shadow-[0_0_16px_rgba(52,211,153,0.4)]' },
  { id: 'import',       path: '/studio/liri/import',      icon: Download,     label: 'Import',       accentClass: 'text-slate-400',  bgClass: 'bg-slate-500/15',  borderClass: 'border-slate-500/30',  glowClass: 'shadow-[0_0_10px_rgba(148,163,184,0.2)]' },
];

function SidebarItem({ item, isActive, collapsed }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      title={collapsed ? item.label : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-all duration-200',
        isActive
          ? [item.bgClass, item.borderClass, 'border', item.glowClass]
          : 'hover:bg-white/5 border border-transparent',
      )}
    >
      {isActive && (
        <span className={cn('absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full', item.accentClass.replace('text-', 'bg-'))} />
      )}
      <Icon className={cn('h-[18px] w-[18px] flex-shrink-0 transition-colors duration-200', isActive ? item.accentClass : 'text-white/40 group-hover:text-white/70')} />
      {!collapsed && (
        <span className={cn('text-[13px] font-medium transition-colors duration-200 truncate', isActive ? 'text-white' : 'text-white/50 group-hover:text-white/80')}>
          {item.label}
        </span>
      )}
    </Link>
  );
}

export default function LiriGlobalShell({ children, activeStudio = 'hub', breadcrumb = [], title = '', actions = null, bottomBar = null }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden" style={{ background: '#0F1117' }}>
      {/* TOP BAR */}
      <header className="flex h-12 flex-shrink-0 items-center gap-3 border-b border-white/[0.07] px-4" style={{ background: 'rgba(18,17,26,0.96)', backdropFilter: 'blur(16px)' }}>
        <Link to="/studio/liri" className="mr-1 flex select-none items-center" aria-label="LIRI">
          <LiriWordmark size="compact" className="text-white/80" />
        </Link>
        <span className="h-4 w-px bg-white/10" />
        <nav className="flex items-center gap-1.5 text-[12px] text-white/40 overflow-hidden">
          <Link to="/studio/liri" className="hover:text-white/70 transition-colors shrink-0">Écosystème</Link>
          {breadcrumb.map((crumb, i) => (
            <React.Fragment key={i}>
              <ChevronRight className="h-3 w-3 flex-shrink-0 text-white/20" />
              {crumb.href
                ? <Link to={crumb.href} className="hover:text-white/70 transition-colors truncate max-w-[120px]">{crumb.label}</Link>
                : <span className="text-white/70 truncate max-w-[120px]">{crumb.label}</span>
              }
            </React.Fragment>
          ))}
        </nav>
        <div className="flex-1" />
        {actions && <div className="flex items-center gap-2">{actions}</div>}
        <Link to="/studio/live" className="flex items-center gap-1.5 rounded-lg bg-red-500/15 border border-red-500/25 px-3 py-1.5 text-[11px] font-semibold text-red-400 transition-all hover:bg-red-500/25">
          <Radio className="h-3 w-3" /> Live
        </Link>
        <Link to="/studio/export-center" className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/50 transition-all hover:border-white/20 hover:text-white/80">
          <FileOutput className="h-3 w-3" /> Exporter
        </Link>
        <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-all hover:border-white/20 hover:text-white/70">
          <Bell className="h-3.5 w-3.5" />
        </button>
        <Link to="/studio" className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-all hover:border-white/20 hover:text-white/70" title="Studio principal">
          <LogOut className="h-3.5 w-3.5" />
        </Link>
      </header>

      {/* BODY — min-h-0 évite l’effondrement flex (contenu invisible / « chargement » sans fin) */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <aside className={cn('flex min-h-0 flex-shrink-0 flex-col border-r border-white/[0.07] transition-all duration-300', collapsed ? 'w-14' : 'w-52')} style={{ background: '#12111a' }}>
          <div className="flex items-center justify-end px-2 pt-3 pb-1">
            <button onClick={() => setCollapsed(v => !v)} className="flex h-6 w-6 items-center justify-center rounded-md text-white/20 transition-colors hover:text-white/50">
              <Menu className="h-3.5 w-3.5" />
            </button>
          </div>
          <nav className="flex flex-col gap-0.5 px-2 py-1 flex-1 overflow-y-auto">
            {NAV_ITEMS.map(item => (
              <SidebarItem
                key={item.id}
                item={item}
                isActive={item.id === activeStudio || (item.path !== '/studio/liri' && location.pathname.startsWith(item.path))}
                collapsed={collapsed}
              />
            ))}
          </nav>
          <div className="border-t border-white/[0.07] p-2">
            <Link to="/studio" className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-white/30 transition-all hover:bg-white/5 hover:text-white/60">
              <Settings className="h-[18px] w-[18px] flex-shrink-0" />
              {!collapsed && <span className="text-[13px] font-medium">Studio</span>}
            </Link>
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {title && (
            <div className="flex h-10 flex-shrink-0 items-center gap-3 border-b border-white/[0.05] px-5">
              <span className="text-[13px] font-semibold text-white/80">{title}</span>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
          {bottomBar && <div className="flex-shrink-0 border-t border-white/[0.07]">{bottomBar}</div>}
        </main>
      </div>
    </div>
  );
}
