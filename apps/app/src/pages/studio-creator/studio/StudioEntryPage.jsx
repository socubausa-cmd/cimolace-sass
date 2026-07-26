/**
 * StudioEntryPage — Hub du Studio Créateur (route index de /studio).
 *
 * ── LA PAGE VIT DANS LA COQUE DU PORTAIL ─────────────────────────────────────
 * StudioRouter monte désormais cette page dans `LiriPortalShell active="studio"` :
 * topbar, marque, rail moteur 92 px et nav basse mobile sont posés PAR LA COQUE.
 * Conséquence directe sur la mise en page de ce hub : la barre supérieure « façon
 * logiciel de montage » qu'il portait (wordmark LIRI + menus Fichier/Édition/Affichage/
 * Espace/Aide + avatar de profil) faisait DOUBLON avec la topbar du portail — deux
 * marques, deux avatars, deux barres empilées. Elle a donc été fondue dans la barre
 * d'outils contextuelle qui existait déjà (fil d'Ariane + recherche) :
 *   • les menus et l'avatar étaient de pures décorations (aucun `onClick`) → retirés ;
 *   • le sélecteur d'espace et le bouton retour sont STATEFUL → conservés, déplacés.
 * Résultat : une seule barre au lieu de deux, aucun contrôle actif perdu.
 *
 * ── CHARTE ───────────────────────────────────────────────────────────────────
 * Les couleurs viennent TOUTES de `proColors` (@/styles/proTokens), désormais aligné
 * sur la charte LIRI (surfaces #1a1917→#3a3835, encre #f5f4ee, accent coral #d97757,
 * or #e6cc92). On ne redéfinit donc aucune palette locale : le seul ajout de ce fichier
 * est la gamme d'accents PAR OUTIL ci-dessous, qui n'a pas sa place dans des tokens
 * globaux. Le fond de la zone principale est laissé TRANSPARENT à dessein — c'est ce
 * qui laisse passer le halo d'ambiance peint par ProShell.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap, Video, Calendar, Mic2, HeartHandshake,
  Wand2, Clapperboard, Megaphone, ArrowLeft, Swords, Brain, LayoutGrid,
  Search, Star, Plus, ChevronRight, Clock, Layers,
  Film, BookOpen, Target, Sparkles, Circle, Activity,
} from 'lucide-react';
import activeTenantConfig from '@/lib/tenant/activeTenantConfig';
import {
  ProShell, ProWorkspaceSwitcher, ProSideRail, ProPanel, ProStatusBar, ProStatusItem,
  proColors, proRadii, proType, proSize, proShadow,
} from '@/components/studio-creator/studio-pro';

/** Encre posée sur un aplat coral (5,5:1 — proColors n'expose pas de « sur-accent »). */
const ENCRE_SUR_CORAIL = '#241a15';

// Marque blanche par tenant : sur le domaine d'un tenant (ex. prorascience.org) le
// Studio porte le nom du tenant et n'expose JAMAIS « LIRI » ; sur l'hôte produit
// (liri.cimolace.space / app.cimolace.space) il reste « LIRI ». activeTenantConfig
// est résolu par l'hôte (cf. isFounderHost / LIRI_NEUTRAL_CONFIG).
const STUDIO_IS_TENANT = !!(activeTenantConfig && activeTenantConfig.slug);
const STUDIO_BRAND =
  (activeTenantConfig && activeTenantConfig.branding && activeTenantConfig.branding.name) || 'LIRI';
const STUDIO_AGENT_LABEL = STUDIO_IS_TENANT ? 'Agent IA' : 'Agent LIRI';
const STUDIO_PROJECT_TAG = STUDIO_IS_TENANT ? `studio.${activeTenantConfig.slug}` : 'studio.liri';

/* ── Gamme d'accents CHAUDE, par outil ─────────────────────────────────────────
   Les accents d'origine (#D946EF magenta, #F59E0B, #F43F5E, #EAB308) cassaient la
   charte. Ils ne pouvaient pas non plus être laissés au remap de studioWarm.css, qui
   écrase toutes les familles froides sur UNE seule teinte : les onze laboratoires
   seraient devenus indistinguables.
   Principe de différenciation retenu : la TEINTE porte la catégorie, l'INTENSITÉ porte
   l'outil dans sa catégorie. Aucune teinte froide, aucune ambiguïté entre familles.
     • Pédagogie  → or et bronze (#e6cc92 → #b5834a)
     • Live       → rouge et corail saturés, la famille la plus « chaude » (#e8674f → #e08b6b)
     • Agenda     → terres désaturées, sable (#c99070 → #d99a4e)
     • Marketing  → orange doré vif, isolé (#e8a13c)
   Tous vérifiés ≥ 4,6:1 sur le fond de la charte (le plus bas : bronze #b5834a à 4,6:1). */
const STUDIO_TYPES = [
  {
    id: 'course-builder', path: '/studio/formation-llm-builder', icon: Wand2,
    title: 'Constructeur de formation IA', category: 'pedagogy',
    shortDesc: 'Brief → génération pédagogique IA → scripts.',
    description: "Espace unique de création de cours par IA : brief initial, génération pédagogique, étapes structurées et scripts. Idéal pour démarrer un cours à partir d'un sujet.",
    accent: '#e6cc92', // or clair — le point d'entrée le plus lumineux de la grille
  },
  {
    id: 'liri-agent', path: '/studio/liri-agent', icon: Brain,
    title: STUDIO_AGENT_LABEL, category: 'pedagogy',
    shortDesc: 'Parcours complet en 10 étapes (SmartBoard + mindmap).',
    description: `Générez un parcours pédagogique complet en 10 étapes : SmartBoard, MasterScript et mindmap automatiquement, depuis un simple sujet — méthode ${STUDIO_BRAND}.`,
    accent: '#d9a441', // ambre profond
  },
  {
    id: 'smartboard-designer', path: '/studio/smartboard-designer', icon: LayoutGrid,
    title: 'SmartBoard Designer', category: 'pedagogy',
    shortDesc: 'Éditeur Konva 1037×750 + Course Copilot.',
    description: "Éditeur Konva 1037×750 avec Course Copilot : scènes, calques, exports. Workspaces cloud et import Polotno historique. Aide disponible via /studio/smartboard-aide.",
    accent: '#e3aa6b', // ocre clair (déjà chaud à l'origine, conservé)
  },
  {
    id: 'formation', path: '/studio/formation', icon: GraduationCap,
    title: 'Formation', category: 'pedagogy',
    shortDesc: 'Modules, leçons, parcours structurés.',
    description: "Concevez des parcours pédagogiques complets : modules, leçons et progression, dans une expérience structurée de bout en bout.",
    accent: '#b5834a', // bronze — le plus sourd de la famille pédagogie
  },
  {
    id: 'live', path: '/studio/live', icon: Video,
    title: 'Live', category: 'live',
    shortDesc: 'Sessions temps réel avec interactions.',
    description: "Préparez des sessions en direct avec interactions, contrôle de salle et expérience premium en temps réel.",
    accent: '#e8674f', // rouge chaud — le direct
  },
  {
    id: 'debate-builder', path: '/studio/debate-builder', icon: Swords,
    title: 'Débat', category: 'live',
    shortDesc: 'DebateCore : rounds, NeuronQ, juge IA.',
    description: "DebateCore : configurez sujet, rounds, NeuronQ et juge IA. Préparez les débatteurs ; l'arène exécute le mode débat.",
    accent: '#cf7b4c', // terre brûlée — la confrontation
  },
  {
    id: 'live-preparation', path: '/studio/live-preparation', icon: Clapperboard,
    title: 'Production live', category: 'live',
    shortDesc: 'Trame + scènes + contenus avant l’arène.',
    description: "Studio premium : trame, scènes, contenus, Secret Classroom, accès — avant d'entrer dans l'arène. N'altère pas le live messagerie.",
    accent: '#e08b6b', // corail doux — la préparation, plus calme que le direct
  },
  {
    id: 'appointment', path: '/studio/appointment', icon: Calendar,
    title: 'Rendez-vous', category: 'agenda',
    shortDesc: 'Créneaux et disponibilités.',
    description: "Structurez vos créneaux, modalités et disponibilités pour des rendez-vous fluides et précis.",
    accent: '#c99070', // terre douce
  },
  {
    id: 'event', path: '/studio/event', icon: Mic2,
    title: 'Événement', category: 'agenda',
    shortDesc: 'Ateliers, conférences, campus.',
    description: "Créez des événements impactants — ateliers ou conférences — avec une présentation claire et moderne, visibles dans la vie scolaire.",
    accent: '#e0a583', // sable clair
  },
  {
    id: 'coaching', path: '/studio/coaching', icon: HeartHandshake,
    title: 'Programme / Coaching', category: 'agenda',
    shortDesc: 'Accompagnement, jalons, progression.',
    description: "Concevez des accompagnements personnalisés avec objectifs, jalons et suivi de progression.",
    accent: '#d99a4e', // or ocre
  },
  {
    id: 'ad-creator', path: '/studio/ad-creator', icon: Megaphone,
    title: 'Créateur de publicités', category: 'marketing',
    shortDesc: 'Publicités IA multi-plateformes.',
    description: "Créez des publicités IA pour Facebook, TikTok, YouTube et Google. Sélectionnez un extrait de cours, générez le contenu et publiez en un clic.",
    accent: '#e8a13c', // orange doré vif — seul de sa famille
  },
];

const CATEGORIES = [
  { id: 'all', label: 'Tous', shortLabel: 'Tous', icon: Layers },
  { id: 'pedagogy', label: 'Pédagogie', shortLabel: 'Péda', icon: BookOpen },
  { id: 'live', label: 'Live', shortLabel: 'Live', icon: Film },
  { id: 'agenda', label: 'Agenda', shortLabel: 'RDV', icon: Calendar },
  { id: 'marketing', label: 'Marketing', shortLabel: 'Pub', icon: Target },
  { divider: true, id: 'divider-1' },
  { id: 'favorites', label: 'Favoris', shortLabel: 'Fav.', icon: Star },
  { id: 'recent', label: 'Récents', shortLabel: 'Réc.', icon: Clock },
];

const WORKSPACES = [
  { id: 'create', label: 'Créer', icon: Sparkles },
  { id: 'build', label: 'Construire', icon: LayoutGrid },
  { id: 'broadcast', label: 'Diffuser', icon: Video },
  { id: 'export', label: 'Exporter', icon: Activity },
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
      /* Pas de `topBar` : la coque du portail en pose déjà une juste au-dessus.
         Les contrôles vivants ont migré dans la barre d'outils de la grille. */
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
              <ProStatusItem icon={Circle} label="Projet" value={STUDIO_PROJECT_TAG} tone="info" />
              <ProStatusItem label="Catégorie" value={CATEGORIES.find((c) => c.id === category)?.label || '—'} />
              <ProStatusItem label="Résultats" value={String(filtered.length)} />
            </>
          }
          center={<ProStatusItem label="Espace" value={WORKSPACES.find((w) => w.id === workspace)?.label} tone="ok" />}
          right={
            <>
              <ProStatusItem label="Version" value="2026.04" />
              <ProStatusItem label="Sauvegarde auto" value="ACTIVE" tone="ok" />
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
        espace={workspace}
        onEspace={setWorkspace}
        onRetour={() => navigate(-1)}
      />
    </ProShell>
  );
}

/* ============================================================
 *  MAIN — Grille principale des Studios (cards type projet)
 * ============================================================ */

function MainLabsGrid({
  labs, selectedId, onSelect, onOpen, search, onSearch, category, favorites, onToggleFav,
  espace, onEspace, onRetour,
}) {
  return (
    // Fond volontairement NON peint : ProShell peint dessous le halo coral et le lavis
    // d'or, qu'un aplat opaque masquerait.
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* ── Barre d'outils contextuelle ──────────────────────────────────────
          Fil d'Ariane + espace de travail + recherche + actions, sur UNE ligne
          qui passe à la ligne si l'écran est étroit (la coque du portail sert
          aussi le mobile — pas de débordement horizontal toléré). */}
      <div
        style={{
          minHeight: 42,
          background: proColors.surface1,
          borderBottom: `1px solid ${proColors.border}`,
          display: 'flex', alignItems: 'center', flexWrap: 'wrap',
          padding: '6px 14px', gap: 10,
        }}
      >
        <span style={{ fontSize: proType.xs, color: proColors.textMuted, letterSpacing: proType.tracking.caps, textTransform: 'uppercase' }}>
          Studio / <span style={{ color: proColors.textPrimary }}>{labelForCategory(category)}</span>
        </span>

        <ProWorkspaceSwitcher items={WORKSPACES} activeId={espace} onChange={onEspace} />

        <div style={{ flex: 1, minWidth: 8 }} />

        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: proColors.surface3,
            border: `1px solid ${proColors.border}`,
            borderRadius: proRadii.sm,
            padding: '0 8px', height: 26,
            flex: '1 1 160px', maxWidth: 260,
          }}
        >
          <Search size={12} strokeWidth={2} color={proColors.textMuted} />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Rechercher un laboratoire…"
            style={{
              flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
              color: proColors.textPrimary, fontSize: proType.sm,
              fontFamily: proType.ui,
            }}
          />
          {search && (
            <button
              type="button" onClick={() => onSearch('')}
              aria-label="Effacer la recherche"
              style={{ background: 'none', border: 'none', color: proColors.textMuted, cursor: 'pointer', padding: 0 }}
            >×</button>
          )}
        </div>

        <button
          type="button"
          onClick={onRetour}
          title="Retour"
          aria-label="Retour"
          style={{
            width: 26, height: 26, borderRadius: proRadii.sm,
            background: 'transparent', border: `1px solid ${proColors.border}`,
            color: proColors.textSecondary, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
        </button>

        <button
          type="button"
          onClick={() => onOpen(labs[0])}
          disabled={!labs.length}
          style={{
            height: 26, padding: '0 10px',
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: proColors.accent, color: ENCRE_SUR_CORAIL,
            border: 'none', borderRadius: proRadii.sm,
            fontSize: proType.xs, fontWeight: 700, letterSpacing: '0.04em',
            textTransform: 'uppercase', cursor: labs.length ? 'pointer' : 'not-allowed',
            fontFamily: proType.ui,
            opacity: labs.length ? 1 : 0.4,
            flexShrink: 0,
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
        background: proColors.surface3,
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
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = proColors.surface4; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = proColors.surface3; }}
    >
      {/* Vignette : l'accent chaud de l'outil se fond dans les surfaces de la charte */}
      <div
        style={{
          height: 54,
          borderRadius: proRadii.sm,
          background: `linear-gradient(135deg, ${lab.accent}33 0%, ${proColors.surface4} 60%, ${proColors.surface2} 100%)`,
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
              fontSize: proType.xs, color: proColors.textSecondary, marginTop: 2,
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
            color: isFav ? proColors.gold : proColors.textMuted,
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <Star size={12} strokeWidth={2} fill={isFav ? proColors.gold : 'transparent'} />
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
            background: `linear-gradient(135deg, ${selected.accent}33 0%, ${proColors.surface4} 60%, ${proColors.surface2} 100%)`,
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
              color: isFav ? proColors.gold : proColors.textMuted,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Star size={13} strokeWidth={2} fill={isFav ? proColors.gold : 'transparent'} />
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
            background: proColors.accent, color: ENCRE_SUR_CORAIL,
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
