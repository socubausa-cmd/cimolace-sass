/**
 * StudioEntryPage — Hub du Studio Créateur
 * Redesign pro (inspiration DaVinci Resolve / Premiere Pro) :
 *   • TopBar avec logo, workspace switcher, actions
 *   • Rail d'icônes gauche (catégories)
 *   • Zone principale : grille de projets/labs (cards) + search
 *   • Inspector droit : détails du lab survolé/sélectionné
 *   • StatusBar bas : infos projet & session
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap, Video, Calendar, Mic2, HeartHandshake,
  Wand2, Clapperboard, Megaphone, ArrowLeft, Swords, Brain, LayoutGrid,
  Search, Star, Plus, ChevronRight, Settings, User, Clock, Layers,
  Film, BookOpen, Target, Sparkles, Circle, Activity,
} from 'lucide-react';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import {
  ProShell, ProTopBar, ProMenuButton, ProWorkspaceSwitcher, ProRecPill,
  ProSideRail, ProPanel, ProStatusBar, ProStatusItem,
  proColors, proRadii, proType, proSize, proShadow,
} from '@/components/studio-creator/studio-pro';

const STUDIO_TYPES = [
  {
    id: 'course-builder', path: '/studio/formation-llm-builder', icon: Wand2,
    title: 'Formation LLM Builder', category: 'pedagogy',
    shortDesc: 'Brief → génération pédagogique IA → scripts.',
    description: "Espace unique de création de cours par IA : brief initial, génération pédagogique, étapes structurées et scripts. Idéal pour démarrer un cours à partir d'un sujet.",
    accent: '#D946EF',
  },
  {
    id: 'liri-agent', path: '/studio/liri-agent', icon: Brain,
    title: 'Agent LIRI', category: 'pedagogy',
    shortDesc: 'Parcours complet en 10 étapes (SmartBoard + mindmap).',
    description: "Générez un parcours pédagogique complet en 10 étapes : SmartBoard, MasterScript et mindmap automatiquement, depuis un simple sujet — méthode LIRI.",
    accent: '#F59E0B',
  },
  {
    id: 'smartboard-designer', path: '/studio/smartboard-designer', icon: LayoutGrid,
    title: 'SmartBoard Designer', category: 'pedagogy',
    shortDesc: 'Éditeur Konva 1037×750 + Course Copilot.',
    description: "Éditeur Konva 1037×750 avec Course Copilot : scènes, calques, exports. Workspaces cloud et import Polotno historique. Aide disponible via /studio/smartboard-aide.",
    accent: '#22D3EE',
  },
  {
    id: 'formation', path: '/studio/formation', icon: GraduationCap,
    title: 'Formation', category: 'pedagogy',
    shortDesc: 'Modules, leçons, parcours structurés.',
    description: "Concevez des parcours pédagogiques complets : modules, leçons et progression, dans une expérience structurée de bout en bout.",
    accent: '#8B5CF6',
  },
  {
    id: 'live', path: '/studio/live', icon: Video,
    title: 'Live', category: 'live',
    shortDesc: 'Sessions temps réel avec interactions.',
    description: "Préparez des sessions en direct avec interactions, contrôle de salle et expérience premium en temps réel.",
    accent: '#F59E0B',
  },
  {
    id: 'debate-builder', path: '/studio/debate-builder', icon: Swords,
    title: 'Débat', category: 'live',
    shortDesc: 'DebateCore : rounds, NeuronQ, juge IA.',
    description: "DebateCore : configurez sujet, rounds, NeuronQ et juge IA. Préparez les débatteurs ; l'Arena exécute le mode débat.",
    accent: '#F43F5E',
  },
  {
    id: 'live-preparation', path: '/studio/live-preparation', icon: Clapperboard,
    title: 'Live Production', category: 'live',
    shortDesc: 'Blueprint + scènes + contenus avant arène.',
    description: "Studio premium : blueprint, scènes, contenus, Secret Classroom, accès — avant d'entrer dans l'arène. N'altère pas le live messagerie.",
    accent: '#F97316',
  },
  {
    id: 'appointment', path: '/studio/appointment', icon: Calendar,
    title: 'Rendez-vous', category: 'agenda',
    shortDesc: 'Créneaux et disponibilités.',
    description: "Structurez vos créneaux, modalités et disponibilités pour des rendez-vous fluides et précis.",
    accent: '#10B981',
  },
  {
    id: 'event', path: '/studio/event', icon: Mic2,
    title: 'Événement', category: 'agenda',
    shortDesc: 'Ateliers, conférences, campus.',
    description: "Créez des événements impactants — ateliers ou conférences — avec une présentation claire et moderne, visibles dans la vie scolaire.",
    accent: '#F43F5E',
  },
  {
    id: 'coaching', path: '/studio/coaching', icon: HeartHandshake,
    title: 'Programme / Coaching', category: 'agenda',
    shortDesc: 'Accompagnement, jalons, progression.',
    description: "Concevez des accompagnements personnalisés avec objectifs, jalons et suivi de progression.",
    accent: '#06B6D4',
  },
  {
    id: 'ad-creator', path: '/studio/ad-creator', icon: Megaphone,
    title: 'Ad Creator', category: 'marketing',
    shortDesc: 'Publicités IA multi-plateformes.',
    description: "Créez des publicités IA pour Facebook, TikTok, YouTube et Google. Sélectionnez un extrait de cours, générez le contenu et publiez en un clic.",
    accent: '#EAB308',
  },
];

const CATEGORIES = [
  { id: 'all', label: 'Tous', shortLabel: 'All', icon: Layers },
  { id: 'pedagogy', label: 'Pédagogie', shortLabel: 'Péda', icon: BookOpen },
  { id: 'live', label: 'Live', shortLabel: 'Live', icon: Film },
  { id: 'agenda', label: 'Agenda', shortLabel: 'Cal', icon: Calendar },
  { id: 'marketing', label: 'Marketing', shortLabel: 'Mkt', icon: Target },
  { divider: true, id: 'divider-1' },
  { id: 'favorites', label: 'Favoris', shortLabel: 'Fav', icon: Star },
  { id: 'recent', label: 'Récents', shortLabel: 'Rec', icon: Clock },
];

const WORKSPACES = [
  { id: 'create', label: 'Create', icon: Sparkles },
  { id: 'build', label: 'Build', icon: LayoutGrid },
  { id: 'broadcast', label: 'Broadcast', icon: Video },
  { id: 'export', label: 'Export', icon: Activity },
];

const FAV_STORAGE_KEY = 'studio_entry_favorites_v1';

export default function StudioEntryPage() {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState('create');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(STUDIO_TYPES[0].id);
  const [favorites, setFavorites] = useState(() => {
    try {
      const raw = localStorage.getItem(FAV_STORAGE_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });

  const persistFavorites = useCallback((next) => {
    setFavorites(next);
    try { localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify([...next])); } catch { /* noop */ }
  }, []);

  const toggleFavorite = useCallback((id) => {
    const next = new Set(favorites);
    if (next.has(id)) next.delete(id); else next.add(id);
    persistFavorites(next);
  }, [favorites, persistFavorites]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return STUDIO_TYPES.filter((s) => {
      if (category === 'favorites') return favorites.has(s.id);
      if (category === 'recent') return true; // (future: read from usage log)
      if (category !== 'all' && s.category !== category) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.shortDesc.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      );
    });
  }, [category, search, favorites]);

  useEffect(() => {
    if (filtered.length && !filtered.find((s) => s.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = useMemo(
    () => STUDIO_TYPES.find((s) => s.id === selectedId) || STUDIO_TYPES[0],
    [selectedId]
  );

  return (
    <ProShell
      topBar={
        <ProTopBar
          logo={
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <LiriWordmark size="compact" className="text-[#e8e0d8]" />
              <span
                style={{
                  fontSize: proType.sm,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  color: proColors.textPrimary,
                }}
              >
                Studio
              </span>
            </div>
          }
          left={
            <>
              <ProMenuButton label="Fichier" onClick={() => { /* stub menus */ }} />
              <ProMenuButton label="Édition" />
              <ProMenuButton label="Affichage" />
              <ProMenuButton label="Espace" />
              <ProMenuButton label="Aide" />
            </>
          }
          center={
            <ProWorkspaceSwitcher
              items={WORKSPACES}
              activeId={workspace}
              onChange={setWorkspace}
            />
          }
          right={
            <>
              <ProRecPill state="idle" label="Prêt" />
              <button
                type="button"
                onClick={() => navigate(-1)}
                title="Retour"
                aria-label="Retour"
                style={{
                  width: 26, height: 26, borderRadius: proRadii.sm,
                  background: 'transparent', border: `1px solid ${proColors.border}`,
                  color: proColors.textSecondary, display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                <ArrowLeft size={14} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => { /* settings placeholder */ }}
                title="Paramètres"
                aria-label="Paramètres"
                style={{
                  width: 26, height: 26, borderRadius: proRadii.sm,
                  background: 'transparent', border: `1px solid ${proColors.border}`,
                  color: proColors.textSecondary, display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                <Settings size={14} strokeWidth={1.75} />
              </button>
              <div
                style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: proColors.surface3, border: `1px solid ${proColors.borderStrong}`,
                  color: proColors.textSecondary, display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                }}
                title="Profil"
              >
                <User size={13} strokeWidth={1.75} />
              </div>
            </>
          }
        />
      }
      sideRail={
        <ProSideRail
          items={CATEGORIES}
          activeId={category}
          onSelect={setCategory}
        />
      }
      inspector={
        <div
          style={{
            width: 320, minWidth: 320, flexShrink: 0,
            background: proColors.surface1,
            borderLeft: `1px solid ${proColors.border}`,
            boxShadow: proShadow.inspector,
            display: 'flex', flexDirection: 'column', minHeight: 0,
          }}
        >
          <InspectorSelectedLab selected={selected} navigate={navigate} toggleFavorite={toggleFavorite} isFav={favorites.has(selected.id)} />
        </div>
      }
      statusBar={
        <ProStatusBar
          left={
            <>
              <ProStatusItem icon={Circle} label="Projet" value="studio.liri" tone="info" />
              <ProStatusItem label="Catégorie" value={CATEGORIES.find((c) => c.id === category)?.label || '—'} />
              <ProStatusItem label="Résultats" value={String(filtered.length)} />
            </>
          }
          center={<ProStatusItem label="Workspace" value={WORKSPACES.find((w) => w.id === workspace)?.label} tone="ok" />}
          right={
            <>
              <ProStatusItem label="Version" value="2026.04" />
              <ProStatusItem label="Auto-save" value="ON" tone="ok" />
            </>
          }
        />
      }
    >
      <MainLabsGrid
        labs={filtered}
        selectedId={selected.id}
        onSelect={setSelectedId}
        onOpen={(lab) => navigate(lab.path)}
        search={search}
        onSearch={setSearch}
        category={category}
        favorites={favorites}
        onToggleFav={toggleFavorite}
      />
    </ProShell>
  );
}

/* ============================================================
 *  MAIN — Grille principale des Studios (cards type projet)
 * ============================================================ */

function MainLabsGrid({ labs, selectedId, onSelect, onOpen, search, onSearch, category, favorites, onToggleFav }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Search bar + breadcrumb */}
      <div
        style={{
          height: 42, minHeight: 42,
          background: proColors.surface1,
          borderBottom: `1px solid ${proColors.border}`,
          display: 'flex', alignItems: 'center',
          padding: '0 14px', gap: 10,
        }}
      >
        <span style={{ fontSize: proType.xs, color: proColors.textMuted, letterSpacing: proType.tracking.caps, textTransform: 'uppercase' }}>
          Studio / <span style={{ color: proColors.textPrimary }}>{labelForCategory(category)}</span>
        </span>
        <div style={{ flex: 1 }} />
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: proColors.surface3,
            border: `1px solid ${proColors.border}`,
            borderRadius: proRadii.sm,
            padding: '0 8px', height: 26, width: 260,
          }}
        >
          <Search size={12} strokeWidth={2} color={proColors.textMuted} />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Rechercher un laboratoire…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: proColors.textPrimary, fontSize: proType.sm,
              fontFamily: proType.ui,
            }}
          />
          {search && (
            <button
              type="button" onClick={() => onSearch('')}
              style={{ background: 'none', border: 'none', color: proColors.textMuted, cursor: 'pointer', padding: 0 }}
            >×</button>
          )}
        </div>
        <button
          type="button"
          onClick={() => onOpen(labs[0])}
          disabled={!labs.length}
          style={{
            height: 26, padding: '0 10px',
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: proColors.accent, color: '#0a0908',
            border: 'none', borderRadius: proRadii.sm,
            fontSize: proType.xs, fontWeight: 700, letterSpacing: '0.04em',
            textTransform: 'uppercase', cursor: 'pointer',
            fontFamily: proType.ui,
            opacity: labs.length ? 1 : 0.4,
          }}
        >
          <Plus size={12} strokeWidth={2.5} /> Nouveau projet
        </button>
      </div>

      {/* Labs grid */}
      <div
        className="pro-scroll"
        style={{
          flex: 1, minHeight: 0, overflow: 'auto',
          padding: 16,
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          alignContent: 'start',
        }}
      >
        {labs.length === 0 && (
          <div
            style={{
              gridColumn: '1 / -1',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '60px 20px', gap: 8,
              color: proColors.textMuted, fontSize: proType.sm,
            }}
          >
            <Search size={28} strokeWidth={1.5} />
            Aucun laboratoire ne correspond.
          </div>
        )}
        {labs.map((lab) => (
          <LabCard
            key={lab.id}
            lab={lab}
            active={lab.id === selectedId}
            isFav={favorites.has(lab.id)}
            onSelect={() => onSelect(lab.id)}
            onDoubleClick={() => onOpen(lab)}
            onToggleFav={(e) => { e.stopPropagation(); onToggleFav(lab.id); }}
          />
        ))}
      </div>
    </div>
  );
}

function LabCard({ lab, active, isFav, onSelect, onDoubleClick, onToggleFav }) {
  const Icon = lab.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      style={{
        textAlign: 'left',
        background: proColors.surface1,
        border: `1px solid ${active ? proColors.borderAccent : proColors.border}`,
        borderRadius: proRadii.md,
        padding: 12,
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 8,
        boxShadow: active ? proShadow.selected : 'none',
        transition: 'border-color 140ms, background 140ms, box-shadow 140ms',
        fontFamily: proType.ui,
        color: proColors.textPrimary,
        minHeight: 120,
        position: 'relative',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = proColors.surface2; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = proColors.surface1; }}
    >
      {/* Thumbnail strip */}
      <div
        style={{
          height: 54,
          borderRadius: proRadii.sm,
          background: `linear-gradient(135deg, ${lab.accent}33 0%, ${proColors.surface3} 60%, ${proColors.surface2} 100%)`,
          border: `1px solid ${proColors.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: lab.accent,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: `repeating-linear-gradient(45deg, transparent 0 8px, ${lab.accent}08 8px 9px)`,
          }}
        />
        <Icon size={26} strokeWidth={1.5} />
      </div>
      {/* Title + fav */}
      <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: proType.sm, fontWeight: 600, color: proColors.textPrimary, letterSpacing: '0.01em' }}>
            {lab.title}
          </div>
          <div
            style={{
              fontSize: proType.xs, color: proColors.textMuted, marginTop: 2,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {lab.shortDesc}
          </div>
        </div>
        <span
          role="button"
          tabIndex={0}
          onClick={onToggleFav}
          onKeyDown={(e) => { if (e.key === 'Enter') onToggleFav(e); }}
          title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          style={{
            width: 20, height: 20, borderRadius: proRadii.xs,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: isFav ? proColors.accent : proColors.textMuted,
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <Star size={12} strokeWidth={2} fill={isFav ? proColors.accent : 'transparent'} />
        </span>
      </div>
      {/* Footer meta */}
      <div
        style={{
          marginTop: 'auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 8, borderTop: `1px solid ${proColors.border}`,
          fontSize: proType.xxs, color: proColors.textMuted,
          letterSpacing: proType.tracking.caps, textTransform: 'uppercase',
        }}
      >
        <span>{labelForCategory(lab.category)}</span>
        <ChevronRight size={12} strokeWidth={2} />
      </div>
    </button>
  );
}

/* ============================================================
 *  INSPECTOR — Détails du lab sélectionné
 * ============================================================ */

function InspectorSelectedLab({ selected, navigate, toggleFavorite, isFav }) {
  const Icon = selected.icon;
  return (
    <>
      <div
        style={{
          height: proSize.panelHeaderHeight,
          background: proColors.surface2,
          borderBottom: `1px solid ${proColors.border}`,
          display: 'flex', alignItems: 'center',
          padding: '0 10px',
          fontSize: proType.xs, fontWeight: 600,
          color: proColors.textSecondary,
          letterSpacing: proType.tracking.label,
          textTransform: 'uppercase',
          userSelect: 'none',
        }}
      >
        Inspecteur
      </div>
      <div className="pro-scroll" style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Preview area */}
        <div
          style={{
            height: 130, borderRadius: proRadii.md,
            background: `linear-gradient(135deg, ${selected.accent}33 0%, ${proColors.surface3} 60%, ${proColors.surface2} 100%)`,
            border: `1px solid ${proColors.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: selected.accent,
            position: 'relative', overflow: 'hidden',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute', inset: 0,
              backgroundImage: `repeating-linear-gradient(45deg, transparent 0 10px, ${selected.accent}10 10px 11px)`,
            }}
          />
          <Icon size={42} strokeWidth={1.25} />
        </div>

        {/* Title + fav */}
        <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ fontSize: proType.md, fontWeight: 600, color: proColors.textPrimary }}>{selected.title}</div>
            <div style={{ fontSize: proType.xxs, color: proColors.textMuted, marginTop: 3, letterSpacing: proType.tracking.caps, textTransform: 'uppercase' }}>
              {labelForCategory(selected.category)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleFavorite(selected.id)}
            title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            style={{
              width: 26, height: 26, borderRadius: proRadii.sm,
              background: 'transparent', border: `1px solid ${proColors.border}`,
              color: isFav ? proColors.accent : proColors.textMuted,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Star size={13} strokeWidth={2} fill={isFav ? proColors.accent : 'transparent'} />
          </button>
        </div>

        {/* Description */}
        <div style={{ fontSize: proType.sm, color: proColors.textSecondary, lineHeight: 1.55 }}>
          {selected.description}
        </div>

        {/* Primary action */}
        <button
          type="button"
          onClick={() => navigate(selected.path)}
          style={{
            height: 34, borderRadius: proRadii.sm,
            background: proColors.accent, color: '#0a0908',
            border: 'none', cursor: 'pointer',
            fontSize: proType.sm, fontWeight: 700, letterSpacing: '0.05em',
            textTransform: 'uppercase', fontFamily: proType.ui,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          Ouvrir le laboratoire <ChevronRight size={14} strokeWidth={2.5} />
        </button>

        {/* Meta strip */}
        <ProPanel title="Propriétés" dense>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: proType.sm }}>
            <MetaRow label="Route" value={selected.path} mono />
            <MetaRow label="Catégorie" value={labelForCategory(selected.category)} />
            <MetaRow label="ID" value={selected.id} mono />
            <MetaRow label="Accent" value={selected.accent} mono swatch={selected.accent} />
          </div>
        </ProPanel>

        {/* Shortcuts hint */}
        <div
          style={{
            fontSize: proType.xxs, color: proColors.textMuted,
            padding: '8px 10px', borderRadius: proRadii.sm,
            background: proColors.surface2, border: `1px solid ${proColors.border}`,
            letterSpacing: '0.02em',
          }}
        >
          <strong style={{ color: proColors.textSecondary }}>Astuce :</strong> double-cliquez sur une carte pour ouvrir le laboratoire directement.
        </div>
      </div>
    </>
  );
}

function MetaRow({ label, value, mono = false, swatch = null }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, padding: '4px 0',
        borderBottom: `1px solid ${proColors.border}`,
      }}
    >
      <span style={{ color: proColors.textMuted, fontSize: proType.xs, letterSpacing: proType.tracking.caps, textTransform: 'uppercase' }}>
        {label}
      </span>
      <span
        style={{
          color: proColors.textPrimary,
          fontSize: proType.xs,
          fontFamily: mono ? proType.mono : proType.ui,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170,
          whiteSpace: 'nowrap',
        }}
      >
        {swatch ? (
          <span
            style={{
              width: 10, height: 10, borderRadius: 2,
              background: swatch, border: `1px solid ${proColors.borderStrong}`,
              flexShrink: 0,
            }}
          />
        ) : null}
        {value}
      </span>
    </div>
  );
}

function labelForCategory(id) {
  const c = CATEGORIES.find((x) => x.id === id);
  return c?.label || 'Tous';
}
