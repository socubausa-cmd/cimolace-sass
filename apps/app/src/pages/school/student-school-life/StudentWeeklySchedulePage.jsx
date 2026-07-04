import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PedagogicalBlockRenderer from "@/components/liri/liri-ecosystem/PedagogicalBlockRenderer";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Play,
  Video,
  Presentation,
  Brain,
  FlaskConical,
  X,
  BarChart3,
  FileText,
  Zap,
  Clock,
  CheckCircle2,
  Circle,
  Loader2,
  BookOpen,
  Radio,
  Map,
  Award,
  AlertCircle,
  Sparkles,
  Lock,
  Target,
  ArrowRight,
  ChevronDown,
  GraduationCap,
  Check,
  Sunrise,
  Languages,
  Link2,
  Maximize2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ImmersiveClassroom from '@/components/school/course-builder/ImmersiveClassroom';
import { buildClassroomChapters } from '@/lib/smartboard/buildClassroomChapters';
import { themeProxy as T, useSslThemeMode } from './sslTheme';

// ── Design tokens — thème HOST-AWARE (sslTheme) ───────────────────────────────
// « Ma semaine » vit dans DEUX coques : le portail LIRI (sombre/chaud par défaut)
// et l'ancien espace student-school-life (clair, via <SslThemeProvider mode="light">).
// On lit donc les tokens du pont `themeProxy` (T_DARK par défaut = LIRI ; T_LIGHT
// sous provider light) — le composant publie le mode via `useSslThemeMode()` en tête.
// Badges/icônes colorés conservés ; T_DARK est déjà re-skiné coral (directive LIRI).

// ── Constants ─────────────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
const WEEKDAY_SHORT  = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];

const MONTH_LABELS = [
  'jan', 'fév', 'mars', 'avr', 'mai', 'juin',
  'juil', 'août', 'sep', 'oct', 'nov', 'déc',
];

const MONTH_LABELS_FULL = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

// pedagogy_type badge colors
// Palette CHAUDE (directive LIRI : bannir teal/violet/or). Types distincts via
// coral / amber / honey / rose / sage / vert (ex-#2dd4bf teal, #a78bfa violet, #D4AF37 or).
const PEDAGOGY_COLORS = {
  opening_live:         { bg: 'rgba(224,138,95,0.15)',  border: 'rgba(224,138,95,0.35)',  color: '#e08a5f' },
  closure_live:         { bg: 'rgba(224,138,95,0.15)',  border: 'rgba(224,138,95,0.35)',  color: '#e08a5f' },
  smartboard_session:   { bg: 'rgba(224,164,88,0.15)',  border: 'rgba(224,164,88,0.35)',  color: '#e0a458' },
  friction_block:       { bg: 'rgba(251,191,36,0.15)',  border: 'rgba(251,191,36,0.35)',  color: '#fbbf24' },
  recall_block:         { bg: 'rgba(230,181,102,0.15)', border: 'rgba(230,181,102,0.35)', color: '#e6b566' },
  experiment_block:     { bg: 'rgba(74,222,128,0.15)',  border: 'rgba(74,222,128,0.35)',  color: '#4ade80' },
  previsualisation_video:{ bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.35)', color: '#f87171' },
  doctrinal_video:      { bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.35)', color: '#f87171' },
  quiz_block:           { bg: 'rgba(221,143,116,0.15)', border: 'rgba(221,143,116,0.35)', color: '#dd8f74' },
  mindmap_block:        { bg: 'rgba(156,196,138,0.15)', border: 'rgba(156,196,138,0.35)', color: '#9cc48a' },
  summary_block:        { bg: 'rgba(169,162,155,0.15)', border: 'rgba(169,162,155,0.35)', color: '#a9a29b' },
  generic:              { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)', color: '#9a938c' },
};

const PEDAGOGY_LABELS = {
  opening_live:         "Live d'ouverture",
  closure_live:         "Live de clôture",
  smartboard_session:   'SmartBoard',
  friction_block:       'Friction',
  recall_block:         'Recall',
  experiment_block:     'Expérimentation',
  previsualisation_video:'Prévisualisation',
  doctrinal_video:      'Vidéo doctrinale',
  quiz_block:           'Quiz',
  mindmap_block:        'Mindmap',
  summary_block:        'Synthèse',
  generic:              'Jour générique',
};

// block type → lucide icon
const BLOCK_ICONS = {
  opening_live:          Radio,
  closure_live:          Radio,
  smartboard_session:    Presentation,
  friction_block:        Zap,
  doctrinal_video:       Video,
  previsualisation_video:Play,
  experiment_block:      FlaskConical,
  recall_block:          Brain,
  quiz_block:            BarChart3,
  mindmap_block:         Map,
  summary_block:         FileText,
};

// block type → CTA label
const BLOCK_CTA = {
  opening_live:          'Rejoindre',
  closure_live:          'Rejoindre',
  smartboard_session:    'Ouvrir',
  friction_block:        'Commencer',
  doctrinal_video:       'Aller en classe',
  previsualisation_video:'Aller en classe',
  experiment_block:      'Commencer',
  recall_block:          'Réviser',
  quiz_block:            'Commencer',
  mindmap_block:         'Explorer',
  summary_block:         'Lire',
};

// ── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Returns the Monday of the ISO week containing `date`.
 */
function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Format a date as "D mois" e.g. "10 mars"
 */
function formatDayMonth(date) {
  const d = new Date(date);
  return `${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`;
}

/**
 * Full date label for day column header: "LUNDI 10 mars"
 */
function formatDayLabel(weekMonday, dayIndex) {
  const d = new Date(weekMonday);
  d.setDate(d.getDate() + dayIndex);
  return {
    full: `${WEEKDAY_LABELS[dayIndex].toUpperCase()} ${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`,
    date: d,
  };
}

/**
 * Number of full weeks between two dates (floor).
 */
function weeksBetween(a, b) {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const start = getMondayOfWeek(a);
  const end   = getMondayOfWeek(b);
  return Math.floor((end - start) / msPerWeek);
}

function isToday(date) {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth()    === now.getMonth() &&
    date.getDate()     === now.getDate()
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Skeleton shimmer block */
function Skeleton({ width = '100%', height = 16, radius = 6 }) {
  const [shimmerPos, setShimmerPos] = useState(0);
  useEffect(() => {
    let frame;
    let start = null;
    function step(ts) {
      if (!start) start = ts;
      const elapsed = ts - start;
      setShimmerPos((elapsed % 1800) / 1800);
      frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);
  const pct = shimmerPos * 200 - 100;
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: `linear-gradient(90deg, ${T.surface} 0%, rgba(0,0,0,0.05) ${50 + pct}%, ${T.surface} 100%)`,
      backgroundSize: '200% 100%',
      flexShrink: 0,
    }} />
  );
}

/** Pedagogy type badge */
function PedagogyBadge({ type }) {
  const cfg = PEDAGOGY_COLORS[type] || PEDAGOGY_COLORS.generic;
  const label = PEDAGOGY_LABELS[type] || type;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: cfg.color,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: 20, padding: '2px 8px',
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

/** Block status badge */
function StatusBadge({ status }) {
  const map = {
    termine:  { label: 'Terminé',  color: T.success, bg: T.successDim },
    en_cours: { label: 'En cours', color: T.warn,    bg: T.warnDim    },
    a_faire:  { label: 'À faire',  color: T.t3,      bg: 'rgba(0,0,0,0.05)' },
  };
  const cfg = map[status] || map.a_faire;
  const Icon = status === 'termine' ? CheckCircle2 : status === 'en_cours' ? Loader2 : Circle;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 600,
      color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.color}22`,
      borderRadius: 20, padding: '2px 8px',
      flexShrink: 0,
    }}>
      <Icon size={9} />
      {cfg.label}
    </span>
  );
}

/** Duration chip */
function DurationChip({ minutes }) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const label = h > 0 ? `${h}h${m > 0 ? m : ''}` : `${m} min`;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 500, color: T.t3,
      background: 'rgba(0,0,0,0.04)',
      border: `1px solid ${T.border}`,
      borderRadius: 20, padding: '2px 8px',
      flexShrink: 0,
    }}>
      <Clock size={9} style={{ color: T.t3 }} />
      {label}
    </span>
  );
}

/** Composant VIDÉO SEUL (viewer) — rien d'autre : <video> natif (scrubber/timecode/plein
 *  écran natifs) ou embed YouTube/Vimeo. Reporte le temps au parent (onTimeUpdate/onLoadedMetadata). */
// Composant RENDER (vidéo SEUL) — remplit son parent ; c'est le WRAPPER (dans VideoModal)
// qui fixe le format 16:9 et les angles NETS (pas de coins arrondis ici). Aucune navigation.
function ClassroomVideo({ videoUrl, isDirect, embedUrl, title, lang, videoRef, onTimeUpdate, onLoadedMetadata }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000', overflow: 'hidden' }}>
      {!videoUrl ? (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Vidéo bientôt disponible</div>
      ) : isDirect ? (
        <video ref={videoRef} src={videoUrl} controls autoPlay crossOrigin="anonymous"
          onTimeUpdate={onTimeUpdate} onLoadedMetadata={onLoadedMetadata}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <track kind="captions" srcLang={lang} label={lang.toUpperCase()} default />
        </video>
      ) : (
        <iframe key={embedUrl} ref={videoRef} src={embedUrl} title={title || 'Vidéo'} frameBorder="0" allow="autoplay; fullscreen" allowFullScreen style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} />
      )}
    </div>
  );
}

/** Panneau LATÉRAL de navigation par CHAPITRES — composant séparé, piloté par le parent
 *  (curTime / duration / onSeek). Liste verticale, chapitre courant surligné, clic → seek. */
function ClassroomChapterPanel({ chapters, curTime, duration, onSeek }) {
  const fmtT = (s) => { const n = Number(s) || 0; return `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`; };
  const chaps = (Array.isArray(chapters) ? chapters : []).filter((c) => c && typeof c.start === 'number').sort((a, b) => a.start - b.start);
  const curChap = chaps.reduce((acc, c, i) => (curTime >= c.start ? i : acc), 0);
  if (!chaps.length) return null;
  return (
    <aside style={{ width: 306, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(245,241,233,0.62)' }}>Chapitres</span>
        <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: 'rgba(245,241,233,0.45)' }}>{fmtT(curTime)} / {fmtT(duration)}</span>
      </div>
      {/* Stepper vertical : pastilles numérotées 01/02… sur un rail, état actif/fait/à venir */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px 4px' }}>
        {chaps.map((c, i) => {
          const end = chaps[i + 1]?.start ?? (duration || c.start + 1);
          const active = i === curChap;
          const done = curTime >= end;
          const last = i === chaps.length - 1;
          const num = String(i + 1).padStart(2, '0');
          return (
            <button key={i} onClick={() => onSeek(c.start)} title={`Aller à : ${c.title}`}
              style={{ display: 'flex', gap: 14, width: '100%', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
              {/* Rail : pastille + ligne verticale de connexion */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <span style={{
                  display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700,
                  background: active ? '#e08a5f' : done ? 'rgba(224,164,88,0.92)' : 'transparent',
                  border: (active || done) ? 'none' : '1.5px solid rgba(245,241,233,0.22)',
                  boxShadow: active ? '0 0 0 4px rgba(217,119,87,0.22)' : 'none',
                  color: (active || done) ? '#1c140e' : 'rgba(245,241,233,0.5)',
                }}>{done && !active ? <Check size={18} /> : i + 1}</span>
                {!last && <span style={{ width: 2, flex: 1, minHeight: 30, margin: '4px 0', borderRadius: 2, background: done ? 'rgba(224,164,88,0.5)' : 'rgba(245,241,233,0.12)' }} />}
              </div>
              {/* Texte : 0X · timecode + TITRE en MAJUSCULES */}
              <div style={{ paddingTop: 2, paddingBottom: 22, minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: active ? '#e08a5f' : done ? 'rgba(224,164,88,0.92)' : 'rgba(245,241,233,0.4)' }}>{num}</span>
                  <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: 'rgba(245,241,233,0.4)' }}>{fmtT(c.start)}</span>
                </div>
                <div style={{ marginTop: 3, fontSize: 13, fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase', lineHeight: 1.25, color: active ? '#f5f1e9' : done ? 'rgba(245,241,233,0.82)' : 'rgba(245,241,233,0.5)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

/** Lecteur « Salle de classe » — orchestre le composant VIDÉO (seul) + le PANNEAU CHAPITRES
 *  (latéral, séparé), en petit format centré sur le fond spotlight du shell (#262624). */
function VideoModal({ videoUrl, title, chapters = [], onClose }) {
  const cardRef = useRef(null);
  const videoRef = useRef(null);
  const [lang, setLang] = useState('fr');
  const [langOpen, setLangOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const LANGS = [
    { k: 'fr', label: 'Français' }, { k: 'en', label: 'English' },
    { k: 'ar', label: 'العربية' }, { k: 'es', label: 'Español' },
  ];
  const isDirect = /\.(mp4|webm|ogg|m3u8|mov)(\?|$)/i.test(videoUrl || '');
  let embedUrl = videoUrl;
  if (videoUrl && !isDirect) {
    const yt = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (yt) embedUrl = `https://www.youtube.com/embed/${yt[1]}?rel=0&cc_load_policy=1&cc_lang_pref=${lang}&hl=${lang}`;
    const vim = videoUrl.match(/vimeo\.com\/(\d+)/);
    if (vim) embedUrl = `https://player.vimeo.com/video/${vim[1]}?texttrack=${lang}`;
  }

  const enlarge = () => { const el = videoRef.current || cardRef.current; el?.requestFullscreen?.(); };
  const copyLink = async () => { try { await navigator.clipboard.writeText(videoUrl || ''); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard indispo */ } };
  const ctrlBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '7px 11px', cursor: 'pointer', color: 'rgba(245,241,233,0.85)', fontSize: 12.5, fontWeight: 600 };

  // Le RENDU des chapitres est délégué au composant séparé ClassroomChapterPanel. Ici on ne
  // garde que : `hasChaps` (largeur de carte quand le panneau est présent) + `seekTo` (seek natif).
  const hasChaps = isDirect && (Array.isArray(chapters) ? chapters : []).some((c) => c && typeof c.start === 'number');
  const seekTo = (t) => { if (videoRef.current && isDirect) { try { videoRef.current.currentTime = Math.max(0, t); videoRef.current.play?.(); } catch { /* seek indispo */ } } };

  return createPortal((
    // CANEVAS IMMERSIF plein-site (portail <body>) : fond = shell LIRI (#262624). PAS de carte
    // monobloc centrée → 3 zones distinctes ancrées aux bords : ① en-tête (titre) · ② écran
    // vidéo seul (angles nets) au centre-gauche · ③ rail chapitres docké au coin droit ·
    // ④ barre de boutons en bas. Chaque composant respire dans l'espace immersif.
    <div role="dialog" aria-modal="true" aria-label={title || 'Vidéo'} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9000, background: '#262624', display: 'flex', flexDirection: 'column', animation: 'evFade .3s ease both' }}>
      <style>{'@keyframes evFade{from{opacity:0}to{opacity:1}}'}</style>
      {/* Halo ambiant derrière l'écran vidéo (centre-gauche) */}
      <div aria-hidden style={{ position: 'absolute', top: '46%', left: '42%', width: 'min(58vw, 860px)', height: 'min(52vh, 520px)', transform: 'translate(-50%, -50%)', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(217,119,87,0.16), transparent 76%)', filter: 'blur(90px)', pointerEvents: 'none' }} />

      {/* ① EN-TÊTE DE L'INTERFACE — titre immersif tout en haut (pleine largeur) */}
      <header onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 12, padding: '16px 26px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 10, background: 'rgba(217,119,87,0.16)', border: '1px solid rgba(217,119,87,0.4)' }}><GraduationCap size={17} color="#e08a5f" /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#e08a5f' }}>Salle de classe</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title || 'Vidéo'}</div>
        </div>
        <button onClick={onClose} aria-label="Fermer" style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', color: 'rgba(255,255,255,0.8)' }}><X size={17} /></button>
      </header>

      {/* CORPS : ② écran vidéo (centre-gauche) + ③ rail chapitres docké au coin droit */}
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch' }}>
        {/* ② COMPOSANT VIDÉO SEUL — angles NETS (aucun borderRadius), centré dans l'espace */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '26px 30px' }}>
          <div ref={cardRef} style={{ height: 'min(64vh, 512px)', maxHeight: '100%', aspectRatio: '16 / 9', maxWidth: '100%', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 36px 110px rgba(0,0,0,0.55), 0 0 120px rgba(217,119,87,0.10)' }}>
            <ClassroomVideo
              videoUrl={videoUrl} isDirect={isDirect} embedUrl={embedUrl} title={title} lang={lang} videoRef={videoRef}
              onTimeUpdate={(e) => setCurTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
            />
          </div>
        </div>

        {/* ③ RAIL CHAPITRES — composant SÉPARÉ, docké au coin côté droit (pleine hauteur du corps) */}
        {isDirect && hasChaps && <ClassroomChapterPanel chapters={chapters} curTime={curTime} duration={duration} onSeek={seekTo} />}
      </div>

      {/* ④ BOUTONS EN BAS — langue · lien (gauche) · agrandir (droite), barre pleine largeur */}
      <footer onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 26px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setLangOpen((o) => !o)} title="Langue des sous-titres / audio" style={ctrlBtn}>
            <Languages size={15} /> {LANGS.find((l) => l.k === lang)?.label} <ChevronDown size={13} />
          </button>
          {langOpen && (
            <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, background: '#221e1a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 6, minWidth: 156, boxShadow: '0 20px 44px rgba(0,0,0,0.55)', zIndex: 3 }}>
              {LANGS.map((l) => (
                <button key={l.k} onClick={() => { setLang(l.k); setLangOpen(false); }}
                  style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '8px 10px', background: l.k === lang ? 'rgba(217,119,87,0.15)' : 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', color: l.k === lang ? '#e08a5f' : 'rgba(245,241,233,0.85)', fontSize: 13, fontWeight: 600, textAlign: 'left' }}>
                  {l.label}{l.k === lang && <Check size={13} style={{ marginLeft: 'auto' }} />}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={copyLink} title="Copier le lien de la vidéo" style={ctrlBtn}>
          {copied ? <><Check size={15} color="#4ea172" /> Copié</> : <><Link2 size={15} /> Lien</>}
        </button>
        <button onClick={enlarge} title="Agrandir (plein écran)" style={{ ...ctrlBtn, marginLeft: 'auto' }}>
          <Maximize2 size={15} /> Agrandir
        </button>
      </footer>
    </div>
  ), document.body);
}

/** Inline expanded content panel (friction/experiment/mindmap/summary) */
function ExpandedPanel({ block, onClose }) {
  return (
    <div style={{
      marginTop: 10, padding: '14px 16px',
      background: 'rgba(0,0,0,0.03)',
      border: `1px solid ${T.border}`,
      borderRadius: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <span style={{ color: T.t2, fontSize: 12, fontWeight: 600 }}>Contenu du bloc</span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: T.t3, padding: 2,
          }}
        >
          <X size={13} />
        </button>
      </div>
      {block.data?.description && (
        <p style={{ color: T.t2, fontSize: 13, lineHeight: 1.6, margin: '0 0 10px' }}>
          {block.data.description}
        </p>
      )}
      {block.data?.instructions && (
        <p style={{ color: T.t2, fontSize: 13, lineHeight: 1.6, margin: '0 0 10px' }}>
          {block.data.instructions}
        </p>
      )}
      {block.data?.content && (
        <p style={{ color: T.t2, fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          {block.data.content}
        </p>
      )}
      {block.data?.challenge_text && (
        <p style={{ color: T.t2, fontSize: 13, lineHeight: 1.6, margin: '0 0 10px' }}>
          <strong style={{ color: T.goldText }}>Défi : </strong>{block.data.challenge_text}
        </p>
      )}
      {block.data?.hint_text && (
        <p style={{ color: T.t3, fontSize: 12.5, lineHeight: 1.6, margin: '0 0 10px' }}>
          <strong>Indice : </strong>{block.data.hint_text}
        </p>
      )}
      {Array.isArray(block.data?.key_points) && block.data.key_points.length > 0 && (
        <ul style={{ color: T.t2, fontSize: 13, lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
          {block.data.key_points.map((p, i) => <li key={i}>{typeof p === 'string' ? p : (p?.text || p?.label || '')}</li>)}
        </ul>
      )}
      {!block.data?.description && !block.data?.instructions && !block.data?.content
        && !block.data?.challenge_text && !block.data?.hint_text
        && !(Array.isArray(block.data?.key_points) && block.data.key_points.length) && (
        <p style={{ color: T.t3, fontSize: 13, fontStyle: 'italic', margin: 0 }}>
          Aucun contenu détaillé pour ce bloc — il sera complété par ton professeur.
        </p>
      )}
    </div>
  );
}

/** Inline quiz modal */
function QuizModal({ block, onClose }) {
  const questions = block.data?.questions || [];
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState({});
  const [finished, setFinished] = useState(false);

  const q = questions[current];

  function handleAnswer(optIdx) {
    if (selected !== null) return;
    setSelected(optIdx);
    setAnswers((prev) => ({ ...prev, [current]: optIdx }));
  }

  function handleNext() {
    if (current < questions.length - 1) {
      setCurrent((c) => c + 1);
      setSelected(null);
    } else {
      setFinished(true);
    }
  }

  const score = Object.entries(answers).filter(([qi, ans]) => {
    const qq = questions[Number(qi)];
    return qq && qq.correct_index === ans;
  }).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quiz"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560,
          background: T.card, borderRadius: 16,
          border: `1px solid ${T.goldMid}`,
          padding: 28,
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <span style={{ color: T.gold, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Quiz — {block.title || 'Bloc quiz'}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(0,0,0,0.05)', border: 'none',
              borderRadius: 8, width: 30, height: 30, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.t2,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {questions.length === 0 && (
          <p style={{ color: T.t3, textAlign: 'center', fontStyle: 'italic', padding: '20px 0' }}>
            Aucune question configurée pour ce quiz.
          </p>
        )}

        {questions.length > 0 && !finished && q && (
          <>
            <div style={{ marginBottom: 6, color: T.t3, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Question {current + 1}/{questions.length}
            </div>
            <div style={{ background: T.surface, borderRadius: 10, padding: '20px 0', marginBottom: 8 }}>
              <div style={{
                width: `${((current + 1) / questions.length) * 100}%`,
                height: 3, background: T.goldSolid, borderRadius: 2, marginBottom: 18,
                transition: 'width 0.3s ease',
              }} />
              <p style={{ color: T.t1, fontSize: 16, fontWeight: 600, lineHeight: 1.5, margin: '0 0 20px', padding: '0 20px' }}>
                {q.question}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px' }}>
                {(q.options || []).map((opt, i) => {
                  let optBg = 'rgba(0,0,0,0.04)';
                  let optBorder = T.border;
                  let optColor = T.t2;
                  if (selected !== null) {
                    if (i === q.correct_index) { optBg = T.successDim; optBorder = T.success; optColor = T.success; }
                    else if (i === selected && i !== q.correct_index) { optBg = T.dangerDim; optBorder = T.danger; optColor = T.danger; }
                  } else if (selected === i) {
                    optBg = T.goldDim; optBorder = T.gold; optColor = T.gold;
                  }
                  return (
                    <button
                      key={i}
                      onClick={() => handleAnswer(i)}
                      disabled={selected !== null}
                      style={{
                        background: optBg, border: `1px solid ${optBorder}`,
                        borderRadius: 8, padding: '10px 14px',
                        color: optColor, fontSize: 14, textAlign: 'left',
                        cursor: selected !== null ? 'default' : 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
            {selected !== null && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                <button
                  onClick={handleNext}
                  style={{
                    background: T.goldSolid, color: '#18181B',
                    border: 'none', borderRadius: 8,
                    padding: '9px 22px', fontWeight: 700, fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {current < questions.length - 1 ? 'Question suivante' : 'Voir les résultats'}
                </button>
              </div>
            )}
          </>
        )}

        {finished && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Award size={48} style={{ color: T.gold, marginBottom: 14 }} />
            <div style={{ color: T.t1, fontSize: 26, fontWeight: 800, marginBottom: 4 }}>
              {score}/{questions.length}
            </div>
            <div style={{ color: T.t2, fontSize: 14, marginBottom: 24 }}>
              {score === questions.length ? 'Parfait !' : score >= questions.length / 2 ? 'Bien joué !' : 'Continuez à réviser.'}
            </div>
            <button
              onClick={onClose}
              style={{
                background: T.goldDim, color: T.gold,
                border: `1px solid ${T.goldMid}`,
                borderRadius: 8, padding: '9px 22px',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Block card ────────────────────────────────────────────────────────────────

function BlockCard({ block, onNavigate, onOpenVideo, onOpenQuiz }) {
  const [expanded, setExpanded] = useState(false);
  const type   = block.type || 'summary_block';
  const Icon   = BLOCK_ICONS[type] || BookOpen;
  const ctaLabel = BLOCK_CTA[type] || 'Ouvrir';
  const status = block.status || 'a_faire';
  const duration = block.data?.duration_minutes || null;

  function handleCTA() {
    switch (type) {
      case 'opening_live':
      case 'closure_live':
        onNavigate('/lives'); // portail LIRI — jamais /t/:slug/* (realm ISNA)
        break;
      case 'previsualisation_video':
      case 'doctrinal_video':
        onOpenVideo(block);
        break;
      case 'smartboard_session':
        onOpenVideo(block); // vue ÉLÈVE (jamais le studio créateur) — chemin BlockCard (legacy)
        break;
      case 'recall_block':
        onNavigate('/student-school-life/neuro-recall');
        break;
      case 'quiz_block':
        onOpenQuiz(block);
        break;
      case 'friction_block':
      case 'experiment_block':
      case 'mindmap_block':
      case 'summary_block':
        setExpanded((v) => !v);
        break;
      default:
        setExpanded((v) => !v);
    }
  }

  const isExpandable = ['friction_block', 'experiment_block', 'mindmap_block', 'summary_block'].includes(type);

  return (
    <div style={{
      background: T.card,
      border: `1px solid ${status === 'en_cours' ? T.goldMid : T.border}`,
      borderRadius: 10,
      padding: '12px 14px',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      boxShadow: status === 'en_cours' ? `0 0 0 1px ${T.goldMid}, 0 4px 20px rgba(212,175,55,0.08)` : 'none',
    }}>
      {/* Block header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: (PEDAGOGY_COLORS[type] || PEDAGOGY_COLORS.generic).bg,
          border: `1px solid ${(PEDAGOGY_COLORS[type] || PEDAGOGY_COLORS.generic).border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={14} style={{ color: (PEDAGOGY_COLORS[type] || PEDAGOGY_COLORS.generic).color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: T.t1, fontSize: 12, fontWeight: 600, lineHeight: 1.4,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {block.title || ctaLabel}
          </div>
        </div>
      </div>

      {/* Status + duration row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <StatusBadge status={status} />
        {duration && <DurationChip minutes={duration} />}
      </div>

      {/* CTA */}
      <button
        onClick={handleCTA}
        style={{
          width: '100%',
          background: status === 'termine' ? 'rgba(0,0,0,0.04)' : T.goldDim,
          border: `1px solid ${status === 'termine' ? T.border : T.goldMid}`,
          borderRadius: 7,
          padding: '7px 12px',
          color: status === 'termine' ? T.t3 : T.gold,
          fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
          cursor: 'pointer',
          textTransform: 'uppercase',
          transition: 'all 0.18s',
        }}
        onMouseEnter={(e) => { if (status !== 'termine') e.currentTarget.style.background = T.goldMid; }}
        onMouseLeave={(e) => { if (status !== 'termine') e.currentTarget.style.background = T.goldDim; }}
      >
        {isExpandable && expanded ? 'Replier' : ctaLabel}
      </button>

      {/* Expanded inline panel */}
      {isExpandable && expanded && (
        <ExpandedPanel block={block} onClose={() => setExpanded(false)} />
      )}
    </div>
  );
}

// ── Day column ────────────────────────────────────────────────────────────────

function DayColumn({ dayLabel, dayDate, dayData, isMobile, onNavigate, onOpenVideo, onOpenQuiz, completedBlocks, onBlockComplete, onOpenClassroom }) {
  const today    = isToday(dayDate);
  const dayTitle = dayData?.title || null;
  const pedagogy = dayData?.pedagogy_type || 'generic';
  const blocks   = dayData?.pedagogical_blocks || [];

  const sortedBlocks = [...blocks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${today ? T.gold : T.border}`,
      borderRadius: 12,
      overflow: 'hidden',
      flex: isMobile ? undefined : '1 1 0',
      minWidth: 0,
      boxShadow: today ? `0 0 0 1px ${T.goldBright}, 0 8px 30px rgba(212,175,55,0.10)` : 'none',
      transition: 'box-shadow 0.2s',
    }}>
      {/* Day header */}
      <div style={{
        padding: '12px 14px 10px',
        borderBottom: `1px solid ${today ? T.goldMid : T.border}`,
        background: today ? T.goldDim : 'transparent',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{
            color: today ? T.gold : T.t1,
            fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            {dayLabel}
          </span>
          {today && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
              color: T.gold, background: T.goldDim,
              border: `1px solid ${T.goldMid}`,
              borderRadius: 20, padding: '2px 7px', textTransform: 'uppercase',
            }}>
              Aujourd'hui
            </span>
          )}
        </div>
        {dayTitle && (
          <div style={{
            color: T.t2, fontSize: 11, marginBottom: 6,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {dayTitle}
          </div>
        )}
        <PedagogyBadge type={pedagogy} />
      </div>

      {/* Blocks */}
      <div style={{ padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!dayData && (
          <p style={{ color: T.t3, fontSize: 11, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
            Jour non configuré
          </p>
        )}
        {dayData && sortedBlocks.length === 0 && (
          <p style={{ color: T.t3, fontSize: 11, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
            Aucun bloc
          </p>
        )}
        {sortedBlocks.map((block) => (
          <PedagogicalBlockRenderer
            key={block.id}
            block={block}
            isActive={false}
            isCompleted={completedBlocks ? completedBlocks.has(block.id) : false}
            onComplete={(score) => onBlockComplete && onBlockComplete(block.id, score)}
            onNavigate={(path) => onNavigate(path)}
            onOpenClassroom={onOpenClassroom}
          />
        ))}
      </div>
    </div>
  );
}

// ── Week progress bar ─────────────────────────────────────────────────────────

function WeekProgressBar({ days }) {
  const allBlocks = days.flatMap((d) => d?.pedagogical_blocks || []);
  const total     = allBlocks.length;
  const done      = allBlocks.filter((b) => b.status === 'termine').length;
  const pct       = total > 0 ? Math.round((done / total) * 100) : 0;

  if (total === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 5, background: 'rgba(0,0,0,0.08)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: `linear-gradient(90deg, ${T.gold} 0%, ${T.teal} 100%)`,
          borderRadius: 4,
          transition: 'width 0.4s ease',
        }} />
      </div>
      <span style={{ color: T.t2, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
        {done}/{total} blocs
      </span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

/* ─── Documentation pédagogique par RÔLE de jour (déduite du pedagogy_type) ─── */
const PEDAGOGY_DOC = {
  opening:      { role: 'Ouverture',       Icon: Sunrise,      objectif: 'Lancer la semaine : découvrir le thème, le fil directeur et les objectifs.', learn: "La vue d’ensemble et les questions clés de la semaine.", able: 'Situer où tu vas — et pourquoi.' },
  course:       { role: 'Cours principal', Icon: Presentation, objectif: 'Acquérir les concepts clés, au tableau interactif.', learn: 'Les notions fondamentales et leur logique.', able: 'Expliquer et réutiliser les concepts.' },
  friction:     { role: 'Friction',        Icon: Zap,          objectif: 'Mettre les concepts à l’épreuve sur un cas pratique.', learn: 'Où tu bloques encore — et pourquoi.', able: 'Appliquer les concepts à un vrai problème.' },
  memorisation: { role: 'Mémorisation',    Icon: Brain,        objectif: 'Ancrer durablement par la répétition espacée (SM-2).', learn: 'Ce qui doit rester en mémoire long terme.', able: 'Restituer sans effort.' },
  synthesis:    { role: 'Synthèse',        Icon: Map,          objectif: 'Relier, résumer et valider les acquis de la semaine.', learn: 'Comment toutes les pièces s’assemblent.', able: 'Faire le bilan et enchaîner la suite.' },
};
function pedagogyDoc(type) {
  const t = String(type || '').toLowerCase();
  if (/(open|ouvert|debut|bienven)/.test(t)) return PEDAGOGY_DOC.opening;
  if (/(friction|defi|challenge)/.test(t)) return PEDAGOGY_DOC.friction;
  if (/(memo|recall|revis|sm2|sm-2)/.test(t)) return PEDAGOGY_DOC.memorisation;
  if (/(synth|closure|clotur|bilan|summary|resum)/.test(t)) return PEDAGOGY_DOC.synthesis;
  return PEDAGOGY_DOC.course;
}
/** Statut d'un jour vs aujourd'hui : completed (passé) / today / locked (futur). */
function dayStatusFor(dayDate, today) {
  const d = new Date(dayDate); d.setHours(0, 0, 0, 0);
  const t = new Date(today); t.setHours(0, 0, 0, 0);
  if (d.getTime() < t.getTime()) return 'completed';
  if (d.getTime() === t.getTime()) return 'today';
  return 'locked';
}

/* ─── Un jour = un nœud de la timeline (documenté + déblocage progressif) ─── */
function TimelineDay({ last, dayLabel, dDate, dayData, status, onNavigate, onOpenVideo, onOpenQuiz, onOpenClassroom, completedBlocks }) {
  const [open, setOpen] = useState(status === 'today');
  // Bloc à contenu inline actuellement déplié (friction/experiment/mindmap/summary).
  const [expandedBlockId, setExpandedBlockId] = useState(null);
  const doc = pedagogyDoc(dayData?.pedagogy_type || dayData?.title);
  const DocIcon = doc.Icon;
  const blocks = dayData?.pedagogical_blocks || [];
  const locked = status === 'locked';
  const isToday = status === 'today';
  const done = status === 'completed';
  const unlockLabel = dDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const handleBlockClick = (block) => {
    if (locked) return;
    switch (block.type) {
      case 'opening_live':
      // Lives du PORTAIL (/lives) — jamais /t/:slug/* (frontière des realms LIRI≠ISNA).
      case 'closure_live': onNavigate('/lives'); break;
      case 'previsualisation_video':
      case 'doctrinal_video':
        // « Aller en classe » → SALLE DE CLASSE = vidéo PLEIN ÉCRAN IMMERSIVE (jamais une
        // modale). Ouverture immédiate (synchrone), fiable.
        onOpenVideo(block);
        break;
      // SmartBoard = cours au tableau interactif → VUE ÉLÈVE (salle de classe / deck en
      // lecture seule via data.content_id). PLUS de fuite vers /studio/smartboard-designer
      // (l'outil d'AUTEUR créateur). Fallback gracieux si pas de contenu généré.
      case 'smartboard_session': onOpenClassroom(block); break;
      case 'recall_block': onNavigate('/student-school-life/neuro-recall'); break;
      case 'quiz_block': onOpenQuiz(block); break;
      // Blocs à CONTENU INLINE (défi, atelier, mindmap, synthèse) : panneau déplié
      // sous le bloc — plus de cul-de-sac (CTA sans action).
      case 'friction_block':
      case 'experiment_block':
      case 'mindmap_block':
      case 'summary_block':
        setExpandedBlockId((cur) => (cur === block.id ? null : block.id));
        break;
      default: break;
    }
  };

  return (
    <div style={{ display: 'flex', gap: 15, alignItems: 'stretch' }}>
      {/* Rail */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 40, flexShrink: 0 }}>
        <div style={{ position: 'relative', width: 40, height: 40, borderRadius: 999, background: locked ? 'rgba(0,0,0,0.28)' : isToday ? T.gold : T.goldDim, border: `1.5px solid ${locked ? T.border : T.goldMid}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          {locked ? <Lock size={16} color={T.t3} /> : done ? <Check size={18} color={T.gold} /> : <DocIcon size={18} color={isToday ? '#1c140e' : T.gold} />}
          {isToday && <span style={{ position: 'absolute', inset: -5, borderRadius: 999, border: `2px solid ${T.goldMid}`, animation: 'evPing 1.7s ease-out infinite' }} />}
        </div>
        {!last && <div style={{ flex: 1, width: 2, minHeight: 20, background: done || isToday ? T.goldMid : T.border, margin: '4px 0', borderRadius: 2 }} />}
      </div>

      {/* Carte jour */}
      <div style={{ flex: 1, minWidth: 0, marginBottom: 14, background: isToday ? T.goldDim : 'rgba(0,0,0,0.16)', border: `1px solid ${isToday ? T.goldMid : T.border}`, borderRadius: 16, overflow: 'hidden', opacity: locked ? 0.7 : 1 }}>
        <button onClick={() => setOpen((o) => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'inherit' }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: T.t1 }}>{dayLabel}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', color: T.goldText, background: T.goldDim, border: `1px solid ${T.goldMid}`, borderRadius: 20, padding: '2px 9px' }}>{doc.role}</span>
              {isToday && <span style={{ fontSize: 10, fontWeight: 800, color: '#1c140e', background: T.gold, borderRadius: 20, padding: '2px 9px' }}>AUJOURD’HUI</span>}
              {done && <span style={{ fontSize: 10.5, fontWeight: 700, color: T.success, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={12} /> Terminé</span>}
              {locked && <span style={{ fontSize: 10.5, fontWeight: 700, color: T.t3, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Lock size={11} /> Verrouillé</span>}
            </span>
            <span style={{ display: 'block', fontSize: 12.5, color: T.t3, marginTop: 3 }}>{locked ? `Se débloque ${unlockLabel}` : doc.objectif}</span>
          </span>
          <ChevronDown size={17} color={T.t3} style={{ transition: 'transform 180ms ease', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }} />
        </button>

        {open && (
          <div style={{ padding: '0 16px 16px 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 10, marginBottom: 13 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`, borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: T.t3, marginBottom: 4 }}><GraduationCap size={13} color={T.goldText} /> Ce que tu vas apprendre</div>
                <div style={{ fontSize: 13, color: T.t2, lineHeight: 1.45 }}>{doc.learn}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`, borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: T.t3, marginBottom: 4 }}><Target size={13} color={T.goldText} /> Tu seras capable de</div>
                <div style={{ fontSize: 13, color: T.t2, lineHeight: 1.45 }}>{doc.able}</div>
              </div>
            </div>

            {locked ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 15, background: 'rgba(0,0,0,0.2)', border: `1px dashed ${T.border}`, borderRadius: 12, color: T.t3, fontSize: 13 }}>
                <Lock size={16} /> {blocks.length > 0 ? `${blocks.length} activité${blocks.length > 1 ? 's' : ''} — débloquée${blocks.length > 1 ? 's' : ''} ${unlockLabel}.` : `Le programme se dévoilera ${unlockLabel}.`}
              </div>
            ) : blocks.length === 0 ? (
              <div style={{ fontSize: 13, color: T.t3, padding: '6px 0' }}>Aucune activité programmée ce jour.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {blocks.map((block) => {
                  const cfg = PEDAGOGY_COLORS[block.type] || PEDAGOGY_COLORS.generic;
                  const Icon = BLOCK_ICONS[block.type] || FileText;
                  const label = PEDAGOGY_LABELS[block.type] || 'Activité';
                  const action = BLOCK_CTA[block.type];
                  const isDone = completedBlocks?.has(block.id);
                  const isExpanded = expandedBlockId === block.id;
                  return (
                    <div key={block.id}>
                      <button onClick={() => handleBlockClick(block)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: isExpanded ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`, borderRadius: 12, cursor: action ? 'pointer' : 'default', textAlign: 'left', color: 'inherit', width: '100%' }}>
                        <span style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 9, background: cfg.bg, border: `1px solid ${cfg.border}`, flexShrink: 0 }}><Icon size={16} style={{ color: cfg.color }} /></span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: cfg.color }}>{label}</span>
                          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: T.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{block.title}</span>
                        </span>
                        {isDone ? <Check size={16} color={T.success} /> : action ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: T.goldText, flexShrink: 0 }}>{isExpanded ? 'Fermer' : action} <ArrowRight size={13} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 160ms ease' }} /></span> : null}
                      </button>
                      {isExpanded && <ExpandedPanel block={block} onClose={() => setExpandedBlockId(null)} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Timeline de la semaine : déblocage progressif jour après jour ─── */
function WeekTimeline({ days, weekMonday, onNavigate, onOpenVideo, onOpenQuiz, onOpenClassroom, completedBlocks }) {
  const today = new Date();
  return (
    <div>
      <style>{'@keyframes evPing{from{transform:scale(1);opacity:.55}to{transform:scale(1.5);opacity:0}}'}</style>
      {Array(5).fill(null).map((_, i) => {
        const dDate = new Date(weekMonday); dDate.setDate(dDate.getDate() + i);
        const { full: dayLabel } = formatDayLabel(weekMonday, i);
        return (
          <TimelineDay
            key={i} last={i === 4} dayLabel={dayLabel} dDate={dDate}
            dayData={days[i]} status={dayStatusFor(dDate, today)}
            onNavigate={onNavigate} onOpenVideo={onOpenVideo} onOpenQuiz={onOpenQuiz}
            onOpenClassroom={onOpenClassroom} completedBlocks={completedBlocks}
          />
        );
      })}
    </div>
  );
}

export default function StudentWeeklySchedulePage() {
  // Publie le mode courant (dark/light) pour le pont `themeProxy` AVANT le rendu des
  // sous-composants (StatCard, PedagogyBadge…) qui référencent `T` au scope module.
  const isLight = useSslThemeMode() === 'light';
  // En LIRI (sombre) on laisse le fond du portail (#262624) transparaître ; en clair
  // standalone on garde le canvas #F4F5F7. → fondu parfait avec la coque LIRI.
  const pageBg = isLight ? T.bg : 'transparent';
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [noPath,    setNoPath]    = useState(false);

  // school path meta
  const [schoolPath,  setSchoolPath]  = useState(null);  // { id, title, starts_on }
  const [weekOffset,  setWeekOffset]  = useState(0);     // 0 = current week
  const [currentWeek, setCurrentWeek] = useState(null);  // module_week row
  const [weekIndex,   setWeekIndex]   = useState(0);     // global week index from starts_on

  // days data: array indexed 0–4 (Mon–Fri), each = { day_number, pedagogy_type, title, pedagogical_blocks[] }
  const [days, setDays] = useState(Array(5).fill(null));

  // UI state
  const [videoModal, setVideoModal] = useState(null); // { block }
  // Pont « Salle de classe » immersive : un bloc vidéo du calendrier relié à un
  // contenu généré (data.content_id → formation_day_contents avec mindmap post-prod)
  // ouvre le plein écran narré. Résolution À LA DEMANDE (au clic du bouton).
  const [classroomChapters, setClassroomChapters] = useState([]);
  const [showImmersive, setShowImmersive] = useState(false);

  const onOpenClassroom = useCallback(async (block) => {
    const contentId = block?.data?.content_id;
    if (!contentId) { setVideoModal({ block }); return; }
    try {
      const { data } = await supabase
        .from('formation_day_contents')
        .select('data')
        .eq('id', contentId)
        .maybeSingle();
      // ⚠️ PIÈGE supabaseCompat + colonne nommée `data` : le shim peut renvoyer le JSON
      // du contenu DIRECTEMENT (déjà déballé), le vrai client renvoie { data: json }.
      // On accepte les deux formes (le JSON porte mindmap/chapters à sa racine).
      const src = (data && typeof data === 'object' && data.data && typeof data.data === 'object') ? data.data : data;
      const chapters = buildClassroomChapters(src || null);
      if (chapters.length) { setClassroomChapters(chapters); setShowImmersive(true); }
      else setVideoModal({ block }); // pas de chapitres constructibles → lecture vidéo classique
    } catch { setVideoModal({ block }); }
  }, []);
  const [quizModal,  setQuizModal]  = useState(null); // { block }

  // Completed blocks tracking
  const [completedBlocks, setCompletedBlocks] = useState(new Set());

  const markBlockCompleted = (blockId, score) => {
    setCompletedBlocks(prev => {
      const next = new Set([...prev, blockId]);
      // Task A: persist to localStorage (learning_analytics table has no block_id/week_id columns)
      try {
        const weekId = currentWeek?.id;
        const userId = user?.id;
        if (userId && weekId) {
          const storageKey = 'progress_' + userId + '_' + weekId;
          localStorage.setItem(storageKey, JSON.stringify([...next]));
        }
      } catch (_) {
        // silent fail
      }
      return next;
    });
  };

  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    function onResize() { setMobile(window.innerWidth < 768); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadWeekData = useCallback(async (pathId, startsOn, offset) => {
    setLoading(true);
    setError(null);
    try {
      const today   = new Date();
      const baseWeek = getMondayOfWeek(startsOn ? new Date(startsOn) : today);
      const nowWeek  = getMondayOfWeek(today);
      const naturalWeekIdx = weeksBetween(baseWeek, nowWeek);
      const targetWeekIdx  = naturalWeekIdx + offset;
      setWeekIndex(targetWeekIdx);

      // Fetch ALL module_weeks for this path in sorted order
      // Walk school_paths → path_courses (course_id) → course_modules → module_weeks
      const { data: pathCourses, error: ce } = await supabase
        .from('path_courses')
        .select('id, course_id')
        .eq('path_id', pathId)
        .order('created_at', { ascending: true });
      if (ce) throw ce;

      if (!pathCourses || pathCourses.length === 0) {
        setCurrentWeek(null);
        setDays(Array(5).fill(null));
        setLoading(false);
        return;
      }

      // Use course_id (FK to courses table) — filter out rows without course_id
      const courseIds = pathCourses
        .map((c) => c.course_id)
        .filter(Boolean);

      if (courseIds.length === 0) {
        setCurrentWeek(null);
        setDays(Array(5).fill(null));
        setLoading(false);
        return;
      }

      const { data: modules, error: me } = await supabase
        .from('course_modules')
        .select('id')
        .in('course_id', courseIds)
        .order('order_index', { ascending: true });
      if (me) throw me;

      if (!modules || modules.length === 0) {
        setCurrentWeek(null);
        setDays(Array(5).fill(null));
        setLoading(false);
        return;
      }

      const moduleIds = modules.map((m) => m.id);

      const { data: weeks, error: we } = await supabase
        .from('module_weeks')
        .select('id, module_id, title, sort_order')
        .in('module_id', moduleIds)
        .order('sort_order', { ascending: true });
      if (we) throw we;

      if (!weeks || weeks.length === 0) {
        setCurrentWeek(null);
        setDays(Array(5).fill(null));
        setLoading(false);
        return;
      }

      const idx  = Math.max(0, Math.min(targetWeekIdx, weeks.length - 1));
      const week = weeks[idx] || null;
      setCurrentWeek(week);

      if (!week) {
        setDays(Array(5).fill(null));
        setLoading(false);
        return;
      }

      // Load week_days + pedagogical_blocks
      const { data: rawDays, error: de } = await supabase
        .from('week_days')
        .select('id, week_id, day_number, title, pedagogy_type, sort_order, pedagogical_blocks(*)')
        .eq('week_id', week.id)
        .order('day_number', { ascending: true });
      if (de) throw de;

      // Map to Mon–Fri (day_number 1–5)
      const mapped = Array(5).fill(null);
      (rawDays || []).forEach((d) => {
        const idx = (d.day_number || 1) - 1;
        if (idx >= 0 && idx < 5) mapped[idx] = d;
      });
      setDays(mapped);

      // Task B: load persisted progress for this week from localStorage
      try {
        const userId = (await supabase.auth.getUser()).data?.user?.id;
        if (userId && week?.id) {
          const storageKey = 'progress_' + userId + '_' + week.id;
          const stored = localStorage.getItem(storageKey);
          if (stored) {
            setCompletedBlocks(new Set(JSON.parse(stored)));
          } else {
            setCompletedBlocks(new Set());
          }
        } else {
          setCompletedBlocks(new Set());
        }
      } catch (_) {
        setCompletedBlocks(new Set());
      }
    } catch (err) {
      console.error('[StudentWeeklySchedulePage] load error', err);
      setError(err?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load: fetch user profile → school_path_id → school_path
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: profile, error: pe } = await supabase
          .from('profiles')
          .select('metadata')
          .eq('id', user.id)
          .maybeSingle();
        if (pe) throw pe;

        const pathId = profile?.metadata?.school_path_id;
        if (!pathId) {
          if (!cancelled) { setNoPath(true); setLoading(false); }
          return;
        }

        const { data: path, error: spErr } = await supabase
          .from('school_paths')
          .select('id, title, starts_on')
          .eq('id', pathId)
          .maybeSingle();
        if (spErr) throw spErr;

        if (!path) {
          if (!cancelled) { setNoPath(true); setLoading(false); }
          return;
        }

        if (!cancelled) {
          // Ancre calendrier du parcours : honore school_paths.starts_on (null = lundi courant)
          setSchoolPath(path);
          await loadWeekData(path.id, path.starts_on ?? null, 0);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[StudentWeeklySchedulePage] init error', err);
          setError(err?.message || 'Erreur de chargement');
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, loadWeekData]);

  // Week navigation
  function handlePrevWeek() {
    const next = weekOffset - 1;
    setWeekOffset(next);
    if (schoolPath) loadWeekData(schoolPath.id, schoolPath.starts_on ?? null, next);
  }
  function handleNextWeek() {
    const next = weekOffset + 1;
    setWeekOffset(next);
    if (schoolPath) loadWeekData(schoolPath.id, schoolPath.starts_on ?? null, next);
  }

  // Current week Monday
  const today = new Date();
  const baseMonday = getMondayOfWeek(
    schoolPath?.starts_on ? new Date(schoolPath.starts_on) : today
  );
  const weekMonday = new Date(baseMonday);
  weekMonday.setDate(weekMonday.getDate() + (weekIndex ?? 0) * 7);
  const weekFriday = new Date(weekMonday);
  weekFriday.setDate(weekFriday.getDate() + 4);

  const weekRangeLabel = `${formatDayMonth(weekMonday)} — ${weekFriday.getDate()} ${MONTH_LABELS[weekFriday.getMonth()]} ${weekFriday.getFullYear()}`;
  const weekNavLabel   = `Semaine ${(weekIndex ?? 0) + 1} — ${MONTH_LABELS_FULL[weekMonday.getMonth()]} ${weekMonday.getFullYear()}`;

  // ── Render ────────────────────────────────────────────────────────────────────

  // No path assigned
  if (!loading && noPath) {
    return (
      <div style={{
        minHeight: '100%', background: pageBg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 32, textAlign: 'center',
      }}>
        <AlertCircle size={48} style={{ color: T.t3, marginBottom: 20 }} />
        <h2 style={{ color: T.t1, fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>
          Aucun parcours assigné
        </h2>
        <p style={{ color: T.t2, fontSize: 14, lineHeight: 1.6, maxWidth: 380, margin: '0 0 28px' }}>
          Vous n'avez pas encore de parcours scolaire. Consultez le catalogue pour rejoindre un programme.
        </p>
        <button
          onClick={() => navigate('/liri/formations')}
          style={{
            background: T.goldDim, color: T.gold,
            border: `1px solid ${T.goldMid}`,
            borderRadius: 10, padding: '11px 28px',
            fontWeight: 700, fontSize: 14, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
        >
          <BookOpen size={16} />
          Voir le catalogue
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100%', background: pageBg, color: T.t1, fontFamily: 'inherit' }}>
      {/* Page container */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: mobile ? '20px 14px 40px' : '28px 24px 60px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 24 }}>
          {/* Title row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 12, marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: T.goldDim, border: `1px solid ${T.goldMid}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Calendar size={19} style={{ color: T.gold }} />
              </div>
              <div>
                <h1 style={{ color: T.t1, fontSize: mobile ? 20 : 24, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
                  Ma semaine
                </h1>
                <p style={{ color: T.t2, fontSize: 12, margin: 0, marginTop: 2 }}>
                  {weekRangeLabel}
                </p>
              </div>
            </div>

            {/* Week nav */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 10, padding: '6px 10px',
            }}>
              <button
                onClick={handlePrevWeek}
                disabled={loading}
                style={{
                  background: 'rgba(0,0,0,0.05)', border: `1px solid ${T.border}`,
                  borderRadius: 7, width: 28, height: 28, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: T.t2, opacity: loading ? 0.4 : 1,
                }}
              >
                <ChevronLeft size={15} />
              </button>
              <span style={{
                color: T.t1, fontSize: 12, fontWeight: 600,
                whiteSpace: 'nowrap', padding: '0 4px',
                minWidth: mobile ? 120 : 160, textAlign: 'center',
              }}>
                {weekNavLabel}
              </span>
              <button
                onClick={handleNextWeek}
                disabled={loading}
                style={{
                  background: 'rgba(0,0,0,0.05)', border: `1px solid ${T.border}`,
                  borderRadius: 7, width: 28, height: 28, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: T.t2, opacity: loading ? 0.4 : 1,
                }}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {/* Week progress bar */}
          {!loading && <WeekProgressBar days={days} />}
          {loading && <Skeleton width="100%" height={5} radius={4} />}

          {/* Week title from module_week */}
          {!loading && currentWeek?.title && (
            <div style={{
              marginTop: 10, color: T.t3, fontSize: 12, fontStyle: 'italic',
            }}>
              {currentWeek.title}
            </div>
          )}
        </div>

        {/* ── Error state ── */}
        {error && (
          <div style={{
            background: T.dangerDim, border: `1px solid ${T.danger}22`,
            borderRadius: 10, padding: '14px 18px',
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
          }}>
            <AlertCircle size={16} style={{ color: T.danger, flexShrink: 0 }} />
            <span style={{ color: T.danger, fontSize: 13 }}>{error}</span>
          </div>
        )}

        {/* ── Week grid (desktop) / list (mobile) ── */}
        {loading ? (
          <div style={{
            display: 'flex', flexDirection: mobile ? 'column' : 'row',
            gap: 10,
          }}>
            {Array(5).fill(null).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: mobile ? undefined : '1 1 0',
                  background: T.surface, border: `1px solid ${T.border}`,
                  borderRadius: 12, padding: '14px 14px',
                  minHeight: 220,
                }}
              >
                <Skeleton width="70%" height={14} radius={5} />
                <div style={{ marginTop: 10 }}><Skeleton width="45%" height={11} radius={20} /></div>
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Skeleton width="100%" height={70} radius={8} />
                  <Skeleton width="100%" height={70} radius={8} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <WeekTimeline
            days={days}
            weekMonday={weekMonday}
            onNavigate={(path) => navigate(path)}
            onOpenVideo={(block) => setVideoModal({ block })}
            onOpenQuiz={(block) => setQuizModal({ block })}
            onOpenClassroom={onOpenClassroom}
            completedBlocks={completedBlocks}
          />
        )}
      </div>

      {/* ── Video modal ── */}
      {videoModal && (
        <VideoModal
          videoUrl={videoModal.block.data?.video_url}
          title={videoModal.block.title}
          chapters={videoModal.block.data?.chapters || []}
          onClose={() => setVideoModal(null)}
        />
      )}

      {/* Salle de classe immersive plein écran — pour les cours du calendrier reliés
          à un contenu généré (data.content_id). Non destructif : superposé. */}
      <ImmersiveClassroom
        open={showImmersive}
        chapters={classroomChapters}
        title={classroomChapters[0]?.title || 'Cours'}
        supabase={supabase}
        onClose={() => setShowImmersive(false)}
      />

      {/* ── Quiz modal ── */}
      {quizModal && (
        <QuizModal
          block={quizModal.block}
          onClose={() => setQuizModal(null)}
        />
      )}
    </div>
  );
}
