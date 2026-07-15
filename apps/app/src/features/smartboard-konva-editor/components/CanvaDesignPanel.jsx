/**
 * CanvaDesignPanel — panneau gauche style Canva Pro.
 * Tabs : Modeles · Elements · Texte · Fonds · Icones · Blocs · Theme · Fichier
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import SmartboardCanvasImage from '@/components/media/SmartboardCanvasImage';
import {
  Type, Square, Circle as CircleIcon, Triangle, Star, Minus, Diamond,
  Image as ImageIcon, Upload, Download, Save, FolderOpen, Loader2, Code,
  Palette, BookOpen, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import {
  SB_SLIDE_TEMPLATES,
  SB_BACKGROUNDS,
  SB_TYPO_PRESETS,
  SB_ICON_LIBRARY,
  SB_COLOR_PALETTES,
} from '@/config/smartboardEditorTools';
import { SMARTBOARD_DESIGN_WIDTH, SMARTBOARD_DESIGN_HEIGHT } from '@/lib/smartboardDesignCanvas';
import {
  mkTextObject,
  mkRectObject,
  mkCircleObject,
  mkImageObject,
  mkIconObject,
  mkHtmlEmbedObject,
  mkTriangleObject,
  mkStarShapeObject,
  mkLineObject,
  mkDiamondObject,
  mkEmojiObject,
  mkArrowObject,
  mkTableObject,
} from '../model/sceneModel';
import LiriKonvaToolkitPanel from './LiriKonvaToolkitPanel';
import {
  DESIGNER_IA_IMAGE_SIZES,
  fetchDesignerImageGallery,
  invokeGenerateVisualImage,
  pushLegacyLocalDesignerImage,
} from '../lib/designerIaImageHistory';

const TABS = [
  { id: 'templates', label: 'Modeles', icon: '🎨' },
  { id: 'elements',  label: 'Elements', icon: '◆' },
  { id: 'texte',    label: 'Texte',    icon: 'T' },
  { id: 'fonds',    label: 'Fonds',    icon: '▣' },
  { id: 'icones',   label: 'Icones',   icon: '✨' },
  { id: 'blocs',    label: 'Blocs',    icon: '📚' },
  { id: 'liri',     label: 'LIRI+',    icon: '✦' },
  { id: 'theme',    label: 'Theme',    icon: '🎭' },
  { id: 'fichier',  label: 'Fichier',  icon: '📁' },
];

// ── Module 4 : Themes globaux ─────────────────────────────────────────────
const GLOBAL_THEMES = [
  {
    id: 'theme_academique',
    label: 'Academique',
    description: 'Sobre, lisible, fond sombre marine',
    bg: 'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)',
    accent: '#D4AF37',
    fontTitle: 'Georgia, serif',
    fontBody: 'Inter, system-ui, sans-serif',
    preview: { bg: '#0f172a', accent: '#D4AF37' },
  },
  {
    id: 'theme_creatif',
    label: 'Creatif',
    description: 'Cosmique, couleurs vives, energie',
    bg: 'linear-gradient(135deg,#0d0021 0%,#1a0540 50%,#07001a 100%)',
    accent: '#a78bfa',
    fontTitle: 'Georgia, serif',
    fontBody: 'Inter, system-ui, sans-serif',
    preview: { bg: '#0d0021', accent: '#a78bfa' },
  },
  {
    id: 'theme_spirituel',
    label: 'Spirituel',
    description: 'Or et nuit, profondeur, prestige',
    bg: 'linear-gradient(135deg,#0a0e1a 0%,#10162b 100%)',
    accent: '#D4AF37',
    fontTitle: 'Georgia, serif',
    fontBody: 'Georgia, serif',
    preview: { bg: '#0a0e1a', accent: '#D4AF37' },
  },
  {
    id: 'theme_technique',
    label: 'Technique',
    description: 'Mono, cyan, style dev / science',
    bg: 'linear-gradient(135deg,#001a2e 0%,#00354d 100%)',
    accent: '#06b6d4',
    fontTitle: 'ui-monospace, monospace',
    fontBody: 'ui-monospace, monospace',
    preview: { bg: '#001a2e', accent: '#06b6d4' },
  },
  {
    id: 'theme_administratif',
    label: 'Administratif',
    description: 'Blanc, propre, professionnel',
    bg: 'linear-gradient(135deg,#ffffff 0%,#f1f5f9 100%)',
    accent: '#0f172a',
    fontTitle: 'Inter, system-ui, sans-serif',
    fontBody: 'Inter, system-ui, sans-serif',
    preview: { bg: '#f1f5f9', accent: '#0f172a' },
  },
  {
    id: 'theme_nature',
    label: 'Nature',
    description: 'Vert foret, calme, bienveillance',
    bg: 'linear-gradient(135deg,#031a0e 0%,#052e16 100%)',
    accent: '#4ade80',
    fontTitle: 'Georgia, serif',
    fontBody: 'Inter, system-ui, sans-serif',
    preview: { bg: '#031a0e', accent: '#4ade80' },
  },
];

// ── Module 5 : Blocs pedagogiques ────────────────────────────────────────
const PEDAGOGY_BLOCKS = [
  {
    id: 'bloc_definition',
    label: 'Definition',
    icon: '📖',
    category: 'Concepts',
    description: 'Terme + definition formelle',
    build: (W) => [
      mkTextObject({ x: 60, y: 60, width: W - 120, height: 60,
        style: { fontSize: 14, fontWeight: 700, fill: '#D4AF37', fontFamily: 'Inter, system-ui, sans-serif', align: 'left' },
        content: { text: 'DEFINITION' }, layer: 3 }),
      mkTextObject({ x: 60, y: 110, width: W - 120, height: 80,
        style: { fontSize: 38, fontWeight: 900, fill: '#F7F2E8', fontFamily: 'Georgia, serif', align: 'left', lineHeight: 1.1 },
        content: { text: 'Terme a definir' }, layer: 3 }),
      mkRectObject({ x: 60, y: 205, width: W - 120, height: 3,
        style: { fill: '#D4AF37', stroke: '', strokeWidth: 0, cornerRadius: 2 }, layer: 2 }),
      mkTextObject({ x: 60, y: 225, width: W - 120, height: 180,
        style: { fontSize: 22, fontWeight: 400, fill: '#e2e8f0', fontFamily: 'Georgia, serif', fontStyle: 'italic', lineHeight: 1.6, align: 'left' },
        content: { text: '"Inserez ici la definition formelle du concept. Soyez precis et complet."' }, layer: 3 }),
    ],
  },
  {
    id: 'bloc_exemple',
    label: 'Exemple concret',
    icon: '💡',
    category: 'Concepts',
    description: 'Titre + situation concrete',
    build: (W) => [
      mkRectObject({ x: 40, y: 40, width: W - 80, height: 400,
        style: { fill: 'rgba(212,175,55,0.06)', stroke: '#D4AF37', strokeWidth: 1, cornerRadius: 16 }, layer: 0 }),
      mkTextObject({ x: 80, y: 70, width: 200, height: 50,
        style: { fontSize: 12, fontWeight: 700, fill: '#D4AF37', fontFamily: 'Inter, system-ui, sans-serif', align: 'left' },
        content: { text: 'EXEMPLE CONCRET' }, layer: 3 }),
      mkEmojiObject('💡', { x: W - 160, y: 55, width: 70, height: 70,
        style: { fontSize: 56, fill: '#D4AF37' }, layer: 3 }),
      mkTextObject({ x: 80, y: 140, width: W - 160, height: 80,
        style: { fontSize: 30, fontWeight: 700, fill: '#F7F2E8', fontFamily: 'Georgia, serif', lineHeight: 1.2, align: 'left' },
        content: { text: 'Situation illustrative' }, layer: 3 }),
      mkTextObject({ x: 80, y: 240, width: W - 160, height: 160,
        style: { fontSize: 20, fontWeight: 400, fill: '#cbd5e1', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1.6, align: 'left' },
        content: { text: 'Decrivez ici un exemple concret, une anecdote ou un cas reel qui illustre le concept.' }, layer: 3 }),
    ],
  },
  {
    id: 'bloc_citation',
    label: 'Citation',
    icon: '💬',
    category: 'Rhetorique',
    description: 'Grand exergue + source',
    build: (W, H) => [
      mkTextObject({ x: 80, y: 60, width: 60, height: 200,
        style: { fontSize: 180, fontWeight: 900, fill: 'rgba(212,175,55,0.15)', fontFamily: 'Georgia, serif', lineHeight: 1 },
        content: { text: '"' }, layer: 1 }),
      mkTextObject({ x: 100, y: 120, width: W - 200, height: 220,
        style: { fontSize: 32, fontWeight: 300, fill: '#F7F2E8', fontFamily: 'Georgia, serif', fontStyle: 'italic', lineHeight: 1.55, align: 'center' },
        content: { text: 'Inserez ici la citation ou le verset. Une phrase courte et percutante.' }, layer: 3 }),
      mkRectObject({ x: W / 2 - 40, y: 365, width: 80, height: 3,
        style: { fill: '#D4AF37', stroke: '', strokeWidth: 0, cornerRadius: 2 }, layer: 2 }),
      mkTextObject({ x: 100, y: 385, width: W - 200, height: 40,
        style: { fontSize: 14, fontWeight: 600, fill: '#D4AF37', fontFamily: 'Inter, system-ui, sans-serif', align: 'center', letterSpacing: 2 },
        content: { text: '— Auteur / Source' }, layer: 3 }),
    ],
  },
  {
    id: 'bloc_comparaison',
    label: 'Comparaison',
    icon: '⚖️',
    category: 'Structure',
    description: 'Colonne A vs colonne B',
    build: (W, H) => [
      mkTextObject({ x: 60, y: 40, width: W - 120, height: 60,
        style: { fontSize: 36, fontWeight: 800, fill: '#F7F2E8', fontFamily: 'Georgia, serif', align: 'center', lineHeight: 1.1 },
        content: { text: 'Comparaison' }, layer: 3 }),
      mkRectObject({ x: 40, y: 120, width: W / 2 - 60, height: 340,
        style: { fill: 'rgba(74,222,128,0.08)', stroke: '#4ade80', strokeWidth: 1, cornerRadius: 12 }, layer: 0 }),
      mkTextObject({ x: 60, y: 140, width: W / 2 - 100, height: 40,
        style: { fontSize: 14, fontWeight: 700, fill: '#4ade80', fontFamily: 'Inter, system-ui, sans-serif', align: 'center' },
        content: { text: 'SANS LA LOI / AVANT' }, layer: 3 }),
      mkTextObject({ x: 60, y: 195, width: W / 2 - 100, height: 250,
        style: { fontSize: 18, fontWeight: 400, fill: '#d1fae5', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1.55, align: 'left' },
        content: { text: '• Point 1\n• Point 2\n• Point 3' }, layer: 3 }),
      mkRectObject({ x: W / 2 + 20, y: 120, width: W / 2 - 60, height: 340,
        style: { fill: 'rgba(96,165,250,0.08)', stroke: '#60a5fa', strokeWidth: 1, cornerRadius: 12 }, layer: 0 }),
      mkTextObject({ x: W / 2 + 40, y: 140, width: W / 2 - 100, height: 40,
        style: { fontSize: 14, fontWeight: 700, fill: '#60a5fa', fontFamily: 'Inter, system-ui, sans-serif', align: 'center' },
        content: { text: 'AVEC LA LOI / APRES' }, layer: 3 }),
      mkTextObject({ x: W / 2 + 40, y: 195, width: W / 2 - 100, height: 250,
        style: { fontSize: 18, fontWeight: 400, fill: '#dbeafe', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1.55, align: 'left' },
        content: { text: '• Point 1\n• Point 2\n• Point 3' }, layer: 3 }),
    ],
  },
  {
    id: 'bloc_chronologie',
    label: 'Chronologie',
    icon: '📅',
    category: 'Structure',
    description: '3 etapes numerotees',
    build: (W) => {
      const items = [
        { n: '01', title: 'Premiere etape', text: 'Description de la premiere etape.' },
        { n: '02', title: 'Deuxieme etape', text: 'Description de la deuxieme etape.' },
        { n: '03', title: 'Troisieme etape', text: 'Description de la troisieme etape.' },
      ];
      const objs = [
        mkTextObject({ x: 60, y: 30, width: W - 120, height: 60,
          style: { fontSize: 36, fontWeight: 800, fill: '#F7F2E8', fontFamily: 'Georgia, serif', align: 'left' },
          content: { text: 'Chronologie' }, layer: 3 }),
      ];
      items.forEach((item, i) => {
        const y = 120 + i * 190;
        objs.push(
          mkTextObject({ x: 60, y, width: 90, height: 90,
            style: { fontSize: 56, fontWeight: 900, fill: 'rgba(212,175,55,0.25)', fontFamily: 'Georgia, serif', align: 'left', lineHeight: 1 },
            content: { text: item.n }, layer: 1 }),
          mkTextObject({ x: 165, y: y + 8, width: W - 240, height: 40,
            style: { fontSize: 22, fontWeight: 700, fill: '#D4AF37', fontFamily: 'Inter, system-ui, sans-serif', align: 'left' },
            content: { text: item.title }, layer: 3 }),
          mkTextObject({ x: 165, y: y + 52, width: W - 240, height: 50,
            style: { fontSize: 16, fontWeight: 400, fill: '#cbd5e1', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1.5, align: 'left' },
            content: { text: item.text }, layer: 3 }),
        );
        if (i < items.length - 1) {
          objs.push(mkLineObject({ x: 95, y: y + 90, width: 2, height: 100,
            style: { stroke: 'rgba(212,175,55,0.25)', strokeWidth: 2 }, layer: 1 }));
        }
      });
      return objs;
    },
  },
  {
    id: 'bloc_resume',
    label: 'Resume / Synthese',
    icon: '📋',
    category: 'Conclusion',
    description: 'Points cles + message fort',
    build: (W) => [
      mkRectObject({ x: 40, y: 30, width: W - 80, height: 460,
        style: { fill: 'rgba(212,175,55,0.04)', stroke: 'rgba(212,175,55,0.2)', strokeWidth: 1, cornerRadius: 16 }, layer: 0 }),
      mkTextObject({ x: 60, y: 55, width: 180, height: 35,
        style: { fontSize: 11, fontWeight: 700, fill: '#D4AF37', fontFamily: 'Inter, system-ui, sans-serif', align: 'left' },
        content: { text: 'CE QU\'IL FAUT RETENIR' }, layer: 3 }),
      mkTextObject({ x: 60, y: 105, width: W - 120, height: 80,
        style: { fontSize: 34, fontWeight: 900, fill: '#F7F2E8', fontFamily: 'Georgia, serif', lineHeight: 1.2, align: 'left' },
        content: { text: 'Message principal fort' }, layer: 3 }),
      mkRectObject({ x: 60, y: 200, width: 60, height: 3,
        style: { fill: '#D4AF37', stroke: '', strokeWidth: 0, cornerRadius: 2 }, layer: 2 }),
      mkTextObject({ x: 60, y: 225, width: W - 120, height: 220,
        style: { fontSize: 19, fontWeight: 400, fill: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1.7, align: 'left' },
        content: { text: '◆ Point cle numero un a retenir\n◆ Point cle numero deux a retenir\n◆ Point cle numero trois a retenir\n◆ Message de conclusion important' }, layer: 3 }),
    ],
  },
  {
    id: 'bloc_exercice',
    label: 'Exercice / Question',
    icon: '✏️',
    category: 'Interaction',
    description: 'Mise en activite des eleves',
    build: (W) => [
      mkRectObject({ x: 40, y: 30, width: W - 80, height: 420,
        style: { fill: 'rgba(168,85,247,0.07)', stroke: '#a855f7', strokeWidth: 1, cornerRadius: 16 }, layer: 0 }),
      mkEmojiObject('✏️', { x: W - 160, y: 50, width: 80, height: 80,
        style: { fontSize: 60, fill: '#a855f7' }, layer: 3 }),
      mkTextObject({ x: 70, y: 60, width: 200, height: 35,
        style: { fontSize: 11, fontWeight: 700, fill: '#a855f7', fontFamily: 'Inter, system-ui, sans-serif', align: 'left' },
        content: { text: 'EXERCICE / QUESTION' }, layer: 3 }),
      mkTextObject({ x: 70, y: 115, width: W - 160, height: 80,
        style: { fontSize: 30, fontWeight: 800, fill: '#F7F2E8', fontFamily: 'Georgia, serif', lineHeight: 1.2, align: 'left' },
        content: { text: 'Quelle est la question ?' }, layer: 3 }),
      mkRectObject({ x: 70, y: 225, width: W - 140, height: 180,
        style: { fill: 'rgba(255,255,255,0.04)', stroke: 'rgba(168,85,247,0.3)', strokeWidth: 1, cornerRadius: 10 }, layer: 1 }),
      mkTextObject({ x: 90, y: 245, width: W - 180, height: 140,
        style: { fontSize: 17, fontWeight: 400, fill: 'rgba(255,255,255,0.35)', fontFamily: 'Inter, system-ui, sans-serif', fontStyle: 'italic', lineHeight: 1.6, align: 'left' },
        content: { text: 'Zone de reponse / brainstorming\n\nLes eleves notent ici leurs idees.' }, layer: 3 }),
    ],
  },
  {
    id: 'bloc_schema',
    label: 'Schema / Diagramme',
    icon: '🔷',
    category: 'Visuel',
    description: 'Centre + 3 branches rayonnantes',
    build: (W, H) => {
      const cx = W / 2;
      const cy = 340;
      const r = 70;
      const branches = [
        { x: cx - 350, y: cy - 170, label: 'Composante A' },
        { x: cx + 220, y: cy - 170, label: 'Composante B' },
        { x: cx - 60, y: cy + 130, label: 'Composante C' },
      ];
      const objs = [
        mkTextObject({ x: 60, y: 30, width: W - 120, height: 60,
          style: { fontSize: 36, fontWeight: 800, fill: '#F7F2E8', fontFamily: 'Georgia, serif', align: 'center' },
          content: { text: 'Concept Central' }, layer: 3 }),
        mkRectObject({ x: cx - r, y: cy - r, width: r * 2, height: r * 2,
          style: { fill: '#D4AF37', stroke: '', strokeWidth: 0, cornerRadius: r }, layer: 2 }),
        mkTextObject({ x: cx - r, y: cy - 20, width: r * 2, height: 40,
          style: { fontSize: 16, fontWeight: 800, fill: '#0a0e1a', fontFamily: 'Inter, system-ui, sans-serif', align: 'center' },
          content: { text: 'CENTRE' }, layer: 3 }),
      ];
      branches.forEach((b) => {
        objs.push(
          mkRectObject({ x: b.x, y: b.y, width: 150, height: 70,
            style: { fill: 'rgba(212,175,55,0.12)', stroke: '#D4AF37', strokeWidth: 1, cornerRadius: 10 }, layer: 1 }),
          mkTextObject({ x: b.x + 10, y: b.y + 22, width: 130, height: 26,
            style: { fontSize: 14, fontWeight: 600, fill: '#F7F2E8', fontFamily: 'Inter, system-ui, sans-serif', align: 'center' },
            content: { text: b.label }, layer: 3 }),
        );
      });
      return objs;
    },
  },
];

const SHAPES = [
  { mk: mkTextObject,      label: 'Texte',      icon: Type,     color: '#D4AF37' },
  { mk: mkRectObject,      label: 'Rectangle',  icon: Square,   color: '#60a5fa' },
  { mk: mkCircleObject,    label: 'Cercle',     icon: CircleIcon, color: '#34d399' },
  { mk: mkTriangleObject,  label: 'Triangle',   icon: Triangle, color: '#a855f7' },
  { mk: mkStarShapeObject, label: 'Étoile',     icon: Star,     color: '#f59e0b' },
  { mk: mkDiamondObject,   label: 'Losange',    icon: Diamond,  color: '#14b8a6' },
  { mk: mkLineObject,      label: 'Ligne',      icon: Minus,    color: '#94a3b8' },
  { mk: mkArrowObject,     label: 'Fleche',     icon: null,     color: '#f97316', arrow: true },
  { mk: () => mkArrowObject({ style: { stroke: '#60a5fa', fill: '#60a5fa', strokeWidth: 3, doubleArrow: true, pointerLength: 14, pointerWidth: 10 } }), label: 'Double',  icon: null, color: '#60a5fa', doubleArrow: true },
  { mk: () => mkIconObject(), label: 'Icone',   icon: null,     color: '#D4AF37', emoji: '★' },
  { mk: mkTableObject,     label: 'Tableau',    icon: null,     color: '#34d399', table: true },
  { mk: mkHtmlEmbedObject, label: 'HTML',       icon: Code,     color: '#a78bfa' },
];

const TYPO_FONT_MAP = {
  typo_hero:     { fontFamily: 'Georgia, serif', fontSize: 72, fontWeight: 900 },
  typo_title:    { fontFamily: 'Georgia, serif', fontSize: 48, fontWeight: 700 },
  typo_subtitle: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 32, fontWeight: 600 },
  typo_body:     { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 22, fontWeight: 400 },
  typo_bullet:   { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 20, fontWeight: 500 },
  typo_quote:    { fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 300, fontStyle: 'italic' },
  typo_tag:      { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14, fontWeight: 700 },
  typo_number:   { fontFamily: 'Georgia, serif', fontSize: 96, fontWeight: 900 },
};

// ── Module 15 : Tonalite pedagogique ────────────────────────────────────
const TONE_PRESETS = [
  { id: 'academique', label: 'Academique', desc: 'Sobre, serif, creme', color: '#F7F2E8' },
  { id: 'narratif',   label: 'Narratif',   desc: 'Italique, chaleureux', color: '#fde68a' },
  { id: 'spirituel',  label: 'Spirituel',  desc: 'Serif, violet doux', color: '#c4b5fd' },
  { id: 'technique',  label: 'Technique',  desc: 'Monospace, bleu vif', color: '#7dd3fc' },
  { id: 'emotionnel', label: 'Emotionnel', desc: 'Italique, rose tendre', color: '#fda4af' },
];

export default function CanvaDesignPanel({
  addObject,
  addObjects,
  setCanvasBackground,
  applyGlobalTheme,
  onDownloadJson,
  onPickFile,
  onDownloadWorkspace,
  onPickWorkspaceFile,
  onSaveLocalDraft,
  onLoadLocalDraft,
  onPickImageUpload,
  imageUploadBusy,
  imageUploadHint,
  imageUrlDraft,
  setImageUrlDraft,
  onExportPdf,
  onExportPptx,
  onExportScript,
  onExportStudentSheet,
  onExportFlashcards,
  onPublishClassroom,
  publishingClassroom,
  applyTone,
  cloudSection,
  className,
  // Controlled mode: si fourni depuis le parent
  activeTab,
  onTabChange,
  /** Filtre transversal (recherche en tête de colonne gauche éditeur) */
  quickFilter = '',
}) {
  const [tabInternal, setTabInternal] = useState('templates');
  const tab = activeTab ?? tabInternal;
  const setTab = onTabChange ?? setTabInternal;
  const [iconCategory, setIconCategory] = useState('education');
  const [blocCategory, setBlocCategory] = useState('Concepts');
  const [blocSearch, setBlocSearch] = useState('');
  const [aiImagePrompt, setAiImagePrompt] = useState('');
  const [aiImageSize, setAiImageSize] = useState('1792x1024');
  const [aiImageProvider, setAiImageProvider] = useState('auto');
  const [aiImageBusy, setAiImageBusy] = useState(false);
  const [aiImageHistoryList, setAiImageHistoryList] = useState([]);
  const refreshAiImageHistory = useCallback(async () => {
    const rows = await fetchDesignerImageGallery(supabase);
    setAiImageHistoryList(rows);
  }, []);

  useEffect(() => {
    if (tab === 'elements') void refreshAiImageHistory();
  }, [tab, refreshAiImageHistory]);
  const fileInputRef = useRef(null);
  const workspaceFileInputRef = useRef(null);
  const imageFileInputRef = useRef(null);

  const qf = (quickFilter || '').trim().toLowerCase();
  const matchesQf = (s) => !qf || String(s).toLowerCase().includes(qf);

  const filteredTemplates = useMemo(
    () =>
      SB_SLIDE_TEMPLATES.filter((tpl) => matchesQf(tpl.label) || matchesQf(tpl.description)),
    [qf],
  );
  const filteredShapes = useMemo(() => SHAPES.filter((s) => matchesQf(s.label)), [qf]);
  const filteredTypoPresets = useMemo(
    () => SB_TYPO_PRESETS.filter((p) => matchesQf(p.label) || matchesQf(p.description)),
    [qf],
  );
  const filteredBackgrounds = useMemo(
    () => SB_BACKGROUNDS.filter((b) => matchesQf(b.label) || matchesQf(b.category)),
    [qf],
  );
  const filteredColorPalettes = useMemo(
    () => SB_COLOR_PALETTES.filter((p) => matchesQf(p.label)),
    [qf],
  );
  const filteredGlobalThemes = useMemo(
    () => GLOBAL_THEMES.filter((t) => matchesQf(t.label) || matchesQf(t.description)),
    [qf],
  );
  const filteredTonePresets = useMemo(
    () => TONE_PRESETS.filter((t) => matchesQf(t.label) || matchesQf(t.desc)),
    [qf],
  );
  const filteredIconItems = useMemo(
    () => (SB_ICON_LIBRARY[iconCategory]?.items || []).filter((emoji) => matchesQf(emoji)),
    [iconCategory, qf],
  );

  const showFileAction = (hints) => !qf || hints.some((h) => matchesQf(h));

  function applyTemplate(tpl) {
    const bg = tpl.preview?.bg || tpl.apply?.bg || '#0b0f1a';
    setCanvasBackground(bg);
    const accent = tpl.preview?.accent || tpl.apply?.accentColor || '#D4AF37';
    const titleText = tpl.applyContent?.title || tpl.label;
    const objs = [
      mkTextObject({
        x: 60, y: 120, width: SMARTBOARD_DESIGN_WIDTH - 120, height: 120,
        style: {
          fontFamily: 'Georgia, serif',
          fontSize: 56,
          fontWeight: 900,
          fill: accent,
          align: tpl.apply?.titleAlign === 'center' ? 'center' : 'left',
          lineHeight: 1.1,
        },
        content: { text: titleText },
        layer: 2,
      }),
    ];
    if (tpl.applyContent?.points?.length) {
      const bodyText = tpl.applyContent.points.join('\n');
      objs.push(
        mkTextObject({
          x: 60, y: 270, width: SMARTBOARD_DESIGN_WIDTH - 120, height: 340,
          style: {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 22,
            fontWeight: 400,
            fill: '#ffffff',
            align: tpl.apply?.titleAlign === 'center' ? 'center' : 'left',
            lineHeight: 1.55,
          },
          content: { text: bodyText },
          layer: 2,
        }),
      );
    }
    addObjects(objs);
  }

  function addTypoPreset(preset) {
    const fontOverrides = TYPO_FONT_MAP[preset.id] || {};
    const texts = {
      typo_hero: 'Titre Principal',
      typo_title: 'Titre de Section',
      typo_subtitle: 'Sous-titre élégant',
      typo_body: 'Corps du texte. Rédigez votre contenu ici.',
      typo_bullet: '◆ Premier point\n◆ Deuxième point\n◆ Troisième point',
      typo_quote: '« La connaissance est la lumière qui éclaire l\'obscurité. »',
      typo_tag: 'CATÉGORIE',
      typo_number: '01',
    };
    addObject(mkTextObject({
      x: 60, y: 100,
      width: SMARTBOARD_DESIGN_WIDTH - 120,
      height: fontOverrides.fontSize ? fontOverrides.fontSize * 2.5 : 120,
      style: {
        fontFamily: fontOverrides.fontFamily || 'Inter, system-ui, sans-serif',
        fontSize: fontOverrides.fontSize || 32,
        fontWeight: fontOverrides.fontWeight || 700,
        fontStyle: fontOverrides.fontStyle || 'normal',
        fill: '#F7F2E8',
        align: 'left',
        lineHeight: 1.25,
      },
      content: { text: texts[preset.id] || preset.label },
      layer: 2,
    }));
  }

  // Mode controle depuis le parent (barre icones) : on cache la tab bar
  const isControlled = activeTab !== undefined;

  return (
    <div className={cn('flex min-h-0 flex-col overflow-hidden bg-transparent', className)}>
      {/* Tab bar — cachee quand controllee par la barre icones gauche */}
      <div className={cn('flex shrink-0 overflow-x-auto border-b border-white/[0.07] bg-[#080a12]', isControlled && 'hidden')}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'flex min-w-0 flex-col items-center gap-0.5 px-3 py-2 text-[13px] font-medium transition-colors',
              tab === t.id
                ? 'border-b-2 border-[var(--school-accent)] text-[#f5dd8a]'
                : 'border-b-2 border-transparent text-white/50 hover:text-white/80',
            )}
          >
            <span className="text-[14px] leading-none">{t.icon}</span>
            <span className="leading-none tracking-wide">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-width:thin]">

        {/* ── MODÈLES ── */}
        {tab === 'templates' && (
          <div className="space-y-3">
            <p className="px-1 text-[13px] font-semibold uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)]">
              Modèles prêts à l&apos;emploi
            </p>
            {filteredTemplates.length === 0 ? (
              <p className="px-2 py-4 text-center text-[12px] text-white/35">
                Aucun modèle ne correspond au filtre.
              </p>
            ) : (
              filteredTemplates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className="group w-full overflow-hidden rounded-xl border border-white/10 text-left transition-all hover:border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] hover:shadow-[0_0_16px_rgba(212,175,55,0.12)]"
              >
                {/* Miniature slide */}
                <div
                  className="relative h-[72px] w-full overflow-hidden"
                  style={{ background: tpl.preview.bg }}
                >
                  <div
                    className="absolute bottom-2 left-3 right-3 h-2 rounded-sm opacity-80"
                    style={{ background: tpl.preview.accent, maxWidth: '70%' }}
                  />
                  <div
                    className="absolute left-3 top-3 h-3 w-2/3 rounded-sm opacity-90"
                    style={{ background: tpl.preview.accent }}
                  />
                  <div
                    className="absolute left-3 top-8 h-2 w-1/2 rounded-sm opacity-50"
                    style={{ background: tpl.preview.accent }}
                  />
                  <div className="absolute inset-0 flex items-end justify-end p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="rounded-md bg-black/70 px-2 py-0.5 text-[13px] text-white/90">
                      Appliquer
                    </span>
                  </div>
                </div>
                <div className="bg-[#10131c] px-2.5 py-1.5">
                  <p className="text-[12px] font-semibold text-white/90">{tpl.label}</p>
                  <p className="text-[13px] text-white/40">{tpl.description}</p>
                </div>
              </button>
            ))
            )}
          </div>
        )}

        {/* ── ÉLÉMENTS ── */}
        {tab === 'elements' && (
          <div className="space-y-3">
            <p className="px-1 text-[13px] font-semibold uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)]">
              Formes & éléments
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {filteredShapes.length === 0 ? (
                <p className="col-span-3 px-2 py-3 text-center text-[12px] text-white/35">
                  Aucune forme ne correspond au filtre.
                </p>
              ) : (
                filteredShapes.map((s, i) => {
                const Icon = s.icon;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => addObject(s.mk())}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] py-3 text-[13px] font-medium text-white/75 transition-all hover:border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] hover:bg-white/[0.07] hover:text-white"
                  >
                    {s.emoji ? (
                      <span className="text-xl leading-none" style={{ color: s.color }}>{s.emoji}</span>
                    ) : s.arrow ? (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="19" y2="12"/><polyline points="13,6 19,12 13,18"/></svg>
                    ) : s.doubleArrow ? (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="13,6 19,12 13,18"/><polyline points="11,6 5,12 11,18"/></svg>
                    ) : s.table ? (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                    ) : Icon ? (
                      <Icon className="h-5 w-5" style={{ color: s.color }} />
                    ) : null}
                    <span>{s.label}</span>
                  </button>
                );
              })
              )}
            </div>

            {/* Image section */}
            <div className="space-y-1.5 rounded-xl border border-white/[0.07] bg-black/25 p-2.5">
              <p className="text-[13px] font-semibold uppercase tracking-wider text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)]">
                Image
              </p>
              <input
                value={imageUrlDraft}
                onChange={(e) => setImageUrlDraft(e.target.value)}
                placeholder="https://… ou téléverser ci-dessous"
                className="w-full rounded-lg border border-white/12 bg-black/40 px-2 py-1.5 text-[12px] text-white placeholder-white/25"
              />
              <input
                ref={imageFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                className="hidden"
                onChange={(ev) => void onPickImageUpload(ev)}
              />
              <button
                type="button"
                disabled={imageUploadBusy}
                onClick={() => imageFileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] py-1.5 text-[13px] text-white/70 hover:border-cyan-500/30 hover:text-cyan-100 disabled:opacity-50"
              >
                {imageUploadBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                Téléverser une image
              </button>
              {imageUploadHint && (
                <p className="text-[13px] leading-snug text-white/45">{imageUploadHint}</p>
              )}
              <button
                type="button"
                onClick={() => addObject(mkImageObject(imageUrlDraft.trim()))}
                className="flex w-full items-center justify-center gap-1 rounded-lg border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] py-1.5 text-[13px] font-medium text-[#f5dd8a]"
              >
                <ImageIcon className="h-3 w-3" />
                Placer sur le canvas
              </button>
            </div>

            {/* IA Image generation */}
            <div className="space-y-1.5 rounded-xl border border-violet-500/20 bg-violet-950/20 p-2.5">
              <p className="text-[13px] font-semibold uppercase tracking-wider text-violet-300/70">
                IA Visuelle
              </p>
              <input
                value={aiImagePrompt}
                onChange={(e) => setAiImagePrompt(e.target.value)}
                placeholder="Ex: diagramme pedagogique pyramide doree..."
                className="w-full rounded-lg border border-white/12 bg-black/40 px-2 py-1.5 text-[12px] text-white placeholder-white/25"
              />
              <label className="block text-[11px] text-white/45">
                Format
                <select
                  value={aiImageSize}
                  onChange={(e) => setAiImageSize(e.target.value)}
                  className="mt-0.5 w-full rounded-lg border border-white/12 bg-black/50 py-1 text-[12px] text-white/85"
                >
                  {DESIGNER_IA_IMAGE_SIZES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[11px] text-white/45">
                Moteur (Google AI Studio = Imagen)
                <select
                  value={aiImageProvider}
                  onChange={(e) => setAiImageProvider(e.target.value)}
                  className="mt-0.5 w-full rounded-lg border border-white/12 bg-black/50 py-1 text-[12px] text-white/85"
                >
                  <option value="auto">Auto</option>
                  <option value="gemini">Google Imagen (GEMINI_API_KEY)</option>
                  <option value="dalle">DALL·E 3 uniquement</option>
                </select>
              </label>
              <button
                type="button"
                disabled={aiImageBusy || !aiImagePrompt.trim()}
                onClick={async () => {
                  setAiImageBusy(true);
                  try {
                    const { data, error } = await invokeGenerateVisualImage(supabase, {
                      prompt: aiImagePrompt,
                      size: aiImageSize,
                      provider: aiImageProvider,
                    });
                    if (error) throw new Error(error.message || 'Edge function');
                    const url = data?.imageUrl || data?.url;
                    if (url) {
                      if (!data?.persisted) {
                        pushLegacyLocalDesignerImage({ url, prompt: aiImagePrompt, size: data?.size || aiImageSize });
                      }
                      void refreshAiImageHistory();
                      setImageUrlDraft(url);
                      addObject(mkImageObject(url));
                    } else if (data?.error) {
                      console.error('IA image:', data.error);
                    }
                  } catch (err) {
                    console.error('IA image error:', err);
                  } finally {
                    setAiImageBusy(false);
                  }
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-900/30 py-1.5 text-[13px] font-medium text-violet-200 disabled:opacity-50"
              >
                {aiImageBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Generer avec l'IA
              </button>
              {aiImageHistoryList.length > 0 ? (
                <div className="border-t border-white/10 pt-2">
                  <p className="mb-1 text-[11px] font-medium text-white/40">Galerie (clic = placer)</p>
                  <div className="flex max-h-[min(75vh,900px)] flex-wrap gap-1 overflow-y-auto">
                    {aiImageHistoryList.map((h) => (
                      <button
                        key={h.id || h.url}
                        type="button"
                        title={h.prompt || 'Image'}
                        onClick={() => addObject(mkImageObject(h.url, { width: 480, height: 275 }))}
                        className="shrink-0 overflow-hidden rounded border border-white/10 hover:border-violet-400/40"
                      >
                        <SmartboardCanvasImage src={h.url} alt="" className="h-11 w-16 object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* ── TEXTE ── */}
        {tab === 'texte' && (
          <div className="space-y-2">
            <p className="px-1 text-[13px] font-semibold uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)]">
              Styles typographiques
            </p>
            {filteredTypoPresets.length === 0 ? (
              <p className="px-2 py-3 text-center text-[12px] text-white/35">Aucun style ne correspond au filtre.</p>
            ) : (
              filteredTypoPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => addTypoPreset(preset)}
                className="w-full rounded-xl border border-white/[0.08] bg-[#10131c] px-3 py-2.5 text-left transition-all hover:border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] hover:bg-[#1a1d2a]"
              >
                <p
                  className="leading-tight text-white/90"
                  style={preset.previewStyle}
                >
                  {preset.preview}
                </p>
                <p className="mt-1 text-[13px] text-white/40">{preset.description}</p>
              </button>
            ))
            )}

            <div className="mt-2 space-y-1.5 rounded-xl border border-white/[0.07] bg-black/20 p-2.5">
              <p className="text-[13px] text-white/45">
                Cliquez sur un style pour l&apos;ajouter sur le canvas. Modifiez ensuite le texte et les couleurs dans le panneau droite.
              </p>
            </div>
          </div>
        )}

        {/* ── FONDS ── */}
        {tab === 'fonds' && (
          <div className="space-y-3">
            {/* Couleur unie personnalisée */}
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#10131c] p-2">
              <label className="flex flex-1 items-center gap-2 text-[13px] text-white/60">
                <span>Couleur personnalisée</span>
                <input
                  type="color"
                  defaultValue="#0b0f1a"
                  onChange={(e) => setCanvasBackground(e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded border border-white/20 bg-transparent"
                />
              </label>
            </div>

            {/* Gradients sombres */}
            <div>
              <p className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Dégradés sombres
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {filteredBackgrounds.filter((b) => b.category === 'gradient').map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => setCanvasBackground(bg.css)}
                    className="group relative h-14 w-full overflow-hidden rounded-xl border border-white/10 transition-all hover:border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] hover:shadow-[0_0_12px_rgba(212,175,55,0.15)]"
                    style={{ background: bg.css }}
                    title={bg.label}
                  >
                    <span className="absolute inset-x-0 bottom-0 bg-black/50 py-0.5 text-center text-[13px] text-white/80 opacity-0 transition-opacity group-hover:opacity-100">
                      {bg.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Clairs */}
            <div>
              <p className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Fonds clairs
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {filteredBackgrounds.filter((b) => b.category === 'light').map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => setCanvasBackground(bg.css)}
                    className="group relative h-14 w-full overflow-hidden rounded-xl border border-black/20 transition-all hover:border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)]"
                    style={{ background: bg.css }}
                    title={bg.label}
                  >
                    <span className="absolute inset-x-0 bottom-0 bg-black/40 py-0.5 text-center text-[13px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {bg.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Solides */}
            <div>
              <p className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Couleurs unies
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {filteredBackgrounds.filter((b) => b.category === 'solid').map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => setCanvasBackground(bg.css)}
                    className="h-10 w-full rounded-xl border border-white/15 transition-all hover:border-[color-mix(in_srgb,var(--school-accent)_60%,transparent)] hover:scale-105"
                    style={{ background: bg.css }}
                    title={bg.label}
                  />
                ))}
              </div>
            </div>

            {/* Palettes */}
            <div>
              <p className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Palettes de couleurs
              </p>
              {filteredColorPalettes.map((palette) => (
                <div key={palette.id} className="mb-2">
                  <p className="mb-1 text-[13px] text-white/35">{palette.label}</p>
                  <div className="flex gap-1">
                    {palette.colors.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCanvasBackground(c)}
                        className="h-7 flex-1 rounded-lg border border-white/10 transition-all hover:scale-110 hover:border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)]"
                        style={{ background: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ICÔNES ── */}
        {tab === 'icones' && (
          <div className="space-y-2">
            <p className="px-1 text-[13px] font-semibold uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)]">
              Bibliothèque d&apos;icônes
            </p>
            {/* Category tabs */}
            <div className="flex flex-wrap gap-1">
              {Object.entries(SB_ICON_LIBRARY).map(([key, cat]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIconCategory(key)}
                  className={cn(
                    'rounded-lg border px-2 py-0.5 text-[13px] transition-colors',
                    iconCategory === key
                      ? 'border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-[#f5dd8a]'
                      : 'border-white/10 text-white/50 hover:border-white/25',
                  )}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
            {/* Emoji grid */}
            <div className="grid grid-cols-5 gap-1">
              {filteredIconItems.length === 0 ? (
                <p className="col-span-5 py-2 text-center text-[12px] text-white/35">Aucune icône ne correspond.</p>
              ) : (
                filteredIconItems.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => addObject(mkEmojiObject(emoji))}
                    className="flex h-10 w-full items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-xl transition-all hover:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] hover:scale-110"
                    title={`Ajouter ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── BLOCS PEDAGOGIQUES (Module 5) ── */}
        {tab === 'blocs' && (
          <div className="space-y-2">
            <p className="px-1 text-[13px] font-semibold uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)]">
              Blocs pedagogiques
            </p>
            {/* Search */}
            <input
              type="text"
              value={blocSearch}
              onChange={(e) => setBlocSearch(e.target.value)}
              placeholder="Rechercher un bloc..."
              className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[12px] text-white placeholder:text-white/25 focus:border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] focus:outline-none"
            />
            {/* Category filter */}
            {!blocSearch && (
              <div className="flex flex-wrap gap-1">
                {['Tous', 'Concepts', 'Rhetorique', 'Structure', 'Interaction', 'Conclusion', 'Visuel'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setBlocCategory(cat)}
                    className={cn(
                      'rounded-lg border px-2 py-0.5 text-[13px] transition-colors',
                      blocCategory === cat
                        ? 'border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-[#f5dd8a]'
                        : 'border-white/10 text-white/50 hover:border-white/25',
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
              {PEDAGOGY_BLOCKS
                .filter((b) => {
                  if (qf && !matchesQf(b.label) && !matchesQf(b.description) && !matchesQf(b.category)) {
                    return false;
                  }
                  if (blocSearch) {
                    const q = blocSearch.toLowerCase();
                    return b.label.toLowerCase().includes(q) || b.description.toLowerCase().includes(q) || b.category.toLowerCase().includes(q);
                  }
                  return blocCategory === 'Tous' || b.category === blocCategory;
                })
                .map((bloc) => (
                  <button
                    key={bloc.id}
                    type="button"
                    onClick={() => {
                      const objs = bloc.build(
                        1037,
                        750,
                      );
                      addObjects(objs);
                    }}
                    className="group flex w-full items-start gap-2.5 rounded-xl border border-white/[0.08] bg-[#10131c] px-3 py-2.5 text-left transition-all hover:border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] hover:bg-[#1a1d2a]"
                  >
                    <span className="mt-0.5 text-2xl leading-none">{bloc.icon}</span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-white/90">{bloc.label}</p>
                      <p className="text-[13px] text-white/40">{bloc.description}</p>
                      <span className="mt-1 inline-block rounded-md border border-white/10 px-1.5 py-0.5 text-[13px] text-white/30">
                        {bloc.category}
                      </span>
                    </div>
                    <span className="ml-auto shrink-0 text-[13px] text-[color-mix(in_srgb,var(--school-accent)_0%,transparent)] transition-colors group-hover:text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)]">
                      Inserer
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* ── LIRI+ (packs Pro/Science, design texte, coach slide) ── */}
        {tab === 'liri' && (
          <LiriKonvaToolkitPanel addObjects={addObjects} quickFilter={quickFilter} />
        )}

        {/* ── THEME GLOBAL (Module 4) ── */}
        {tab === 'theme' && (
          <div className="space-y-3">
            <p className="px-1 text-[13px] font-semibold uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)]">
              Theme global du cours
            </p>
            <p className="px-1 text-[13px] leading-relaxed text-white/35">
              Applique le fond, la typographie et la couleur d&apos;accent a <strong className="text-white/60">toutes les scenes</strong> du projet.
            </p>
            <div className="space-y-1.5">
              {filteredGlobalThemes.length === 0 ? (
                <p className="px-2 py-3 text-center text-[12px] text-white/35">Aucun thème ne correspond au filtre.</p>
              ) : (
                filteredGlobalThemes.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => applyGlobalTheme?.(theme)}
                  className="group flex w-full items-center gap-3 overflow-hidden rounded-xl border border-white/[0.08] bg-[#10131c] transition-all hover:border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] hover:shadow-[0_0_16px_rgba(212,175,55,0.1)]"
                >
                  {/* Miniature couleur */}
                  <div
                    className="h-16 w-14 shrink-0"
                    style={{ background: theme.preview.bg }}
                  >
                    <div
                      className="mx-2 mt-4 h-2 rounded-sm opacity-90"
                      style={{ background: theme.preview.accent }}
                    />
                    <div
                      className="mx-2 mt-1 h-1.5 w-2/3 rounded-sm opacity-50"
                      style={{ background: theme.preview.accent }}
                    />
                  </div>
                  <div className="min-w-0 py-2 text-left">
                    <p className="text-[13px] font-bold text-white/90">{theme.label}</p>
                    <p className="text-[13px] text-white/40">{theme.description}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full border border-white/20" style={{ background: theme.preview.accent }} />
                      <span className="text-[13px] text-white/30">{theme.preview.accent}</span>
                    </div>
                  </div>
                  <span className="mr-3 shrink-0 text-[13px] text-[color-mix(in_srgb,var(--school-accent)_0%,transparent)] transition-colors group-hover:text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)]">
                    Appliquer
                  </span>
                </button>
              ))
              )}
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-900/10 px-3 py-2">
              <p className="text-[13px] leading-snug text-amber-200/70">
                Le theme change le fond de <strong>toutes les scenes</strong>. Les objets existants conservent leurs couleurs individuelles.
              </p>
            </div>

            {/* Module 15 - Tonalite pedagogique */}
            {applyTone && (
              <>
                <p className="mt-3 px-1 text-[13px] font-semibold uppercase tracking-[0.18em] text-white/40">
                  Tonalite pedagogique (Module 15)
                </p>
                <p className="px-1 text-[13px] text-white/30">
                  Ajuste le style des textes de la scene active.
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {filteredTonePresets.length === 0 ? (
                    <p className="col-span-2 py-2 text-center text-[12px] text-white/35">Aucune tonalité ne correspond.</p>
                  ) : (
                    filteredTonePresets.map((tone) => (
                      <button
                        key={tone.id}
                        type="button"
                        onClick={() => applyTone(tone)}
                        className="flex flex-col items-start gap-0.5 rounded-xl border border-white/[0.08] bg-[#10131c] p-2.5 text-left transition-all hover:border-white/25"
                      >
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full" style={{ background: tone.color }} />
                          <span className="text-[12px] font-semibold text-white/85">{tone.label}</span>
                        </div>
                        <p className="text-[13px] text-white/35">{tone.desc}</p>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── FICHIER ── */}
        {tab === 'fichier' && (
          <div className="space-y-2">
            {qf ? (
              <p className="rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-[10px] text-white/45">
                Filtre actif : seules les actions dont le libellé correspond sont affichées (mots-clés : brouillon,
                json, workspace, pdf, pptx…).
              </p>
            ) : null}
            <p className="px-1 text-[13px] font-semibold uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)]">
              Gestion du projet
            </p>
            {showFileAction(['sauvegarder', 'brouillon', 'charger', 'gestion', 'projet']) ? (
            <div className="space-y-1">
              <button
                type="button"
                onClick={onSaveLocalDraft}
                className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white/80 hover:bg-white/[0.08]"
              >
                <Save className="h-3.5 w-3.5 text-[var(--school-accent)]" />
                Sauvegarder brouillon
              </button>
              <button
                type="button"
                onClick={onLoadLocalDraft}
                className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white/80 hover:bg-white/[0.08]"
              >
                <FolderOpen className="h-3.5 w-3.5 text-[var(--school-accent)]" />
                Charger brouillon
              </button>
            </div>
            ) : null}

            <p className="mt-2 px-1 text-[13px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Canvas (JSON)
            </p>
            {showFileAction(['canvas', 'json', 'exporter', 'importer']) ? (
            <div className="space-y-1">
              <button
                type="button"
                onClick={onDownloadJson}
                className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white/80 hover:bg-white/[0.08]"
              >
                <Download className="h-3.5 w-3.5" />
                Exporter canvas JSON
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white/80 hover:bg-white/[0.08]"
              >
                <Upload className="h-3.5 w-3.5" />
                Importer canvas JSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={onPickFile}
              />
            </div>
            ) : null}

            <p className="mt-2 px-1 text-[13px] font-semibold uppercase tracking-[0.18em] text-[color-mix(in_srgb,var(--school-accent)_60%,transparent)]">
              Workspace complet
            </p>
            {showFileAction(['workspace', 'complet', 'exporter', 'importer']) ? (
            <div className="space-y-1">
              <button
                type="button"
                onClick={onDownloadWorkspace}
                className="flex w-full items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_08%,transparent)] px-3 py-2 text-[12px] text-[#f5dd8a]/90 hover:bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)]"
              >
                <Download className="h-3.5 w-3.5" />
                Exporter workspace
              </button>
              <button
                type="button"
                onClick={() => workspaceFileInputRef.current?.click()}
                className="flex w-full items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_08%,transparent)] px-3 py-2 text-[12px] text-[#f5dd8a]/90 hover:bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)]"
              >
                <Upload className="h-3.5 w-3.5" />
                Importer workspace
              </button>
              <input
                ref={workspaceFileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={onPickWorkspaceFile}
              />
            </div>
            ) : null}

            {/* Module 10 : Export multi-formats */}
            {(onExportPdf || onExportScript || onExportStudentSheet || onExportFlashcards) && (
              <>
                {showFileAction(['export', 'pdf', 'pptx', 'powerpoint', 'script', 'flashcard', 'fiche', 'eleve', 'enseignant', 'module']) ? (
                <>
                <p className="mt-3 px-1 text-[13px] font-semibold uppercase tracking-[0.18em] text-white/40">
                  Export (Module 10)
                </p>
                <div className="space-y-1">
                  {onPublishClassroom && (
                    <button
                      type="button"
                      disabled={publishingClassroom}
                      onClick={onPublishClassroom}
                      className="flex w-full items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_16%,transparent)] px-3 py-2 text-[12px] font-semibold text-[#f5dd8a] hover:bg-[color-mix(in_srgb,var(--school-accent)_24%,transparent)] disabled:opacity-50"
                    >
                      {publishingClassroom ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5 text-[var(--school-accent)]" />}
                      Publier en classe (Mes formations)
                    </button>
                  )}
                  {onExportPdf && showFileAction(['pdf', 'export', 'slides', 'exporter']) && (
                    <button
                      type="button"
                      onClick={onExportPdf}
                      className="flex w-full items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_08%,transparent)] px-3 py-2 text-[12px] text-[#f5dd8a]/90 hover:bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)]"
                    >
                      <Download className="h-3.5 w-3.5 text-[var(--school-accent)]" />
                      Exporter PDF (toutes les slides)
                    </button>
                  )}
                  {onExportPptx && showFileAction(['pptx', 'powerpoint', 'export']) && (
                    <button
                      type="button"
                      onClick={onExportPptx}
                      className="flex w-full items-center gap-2 rounded-xl border border-orange-400/30 bg-orange-950/20 px-3 py-2 text-[12px] text-orange-200/90 hover:bg-orange-950/35"
                    >
                      <Download className="h-3.5 w-3.5 text-orange-400" />
                      Exporter PPTX (PowerPoint)
                    </button>
                  )}
                  {onExportScript && showFileAction(['script', 'enseignant', 'markdown']) && (
                    <button
                      type="button"
                      onClick={onExportScript}
                      className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white/80 hover:bg-white/[0.08]"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-amber-400" />
                      Script enseignant (.md)
                    </button>
                  )}
                  {onExportStudentSheet && showFileAction(['fiche', 'eleve', 'etudiant']) && (
                    <button
                      type="button"
                      onClick={onExportStudentSheet}
                      className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white/80 hover:bg-white/[0.08]"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                      Fiche eleve (.md)
                    </button>
                  )}
                  {onExportFlashcards && showFileAction(['flashcard', 'json', 'carte']) && (
                    <button
                      type="button"
                      onClick={onExportFlashcards}
                      className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white/80 hover:bg-white/[0.08]"
                    >
                      <Code className="h-3.5 w-3.5 text-green-400" />
                      Flashcards JSON
                    </button>
                  )}
                </div>
                </>
                ) : null}
              </>
            )}

            {/* Cloud section injected from parent */}
            {cloudSection && (
              <div className="mt-3 border-t border-white/[0.07] pt-3">
                {cloudSection}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
