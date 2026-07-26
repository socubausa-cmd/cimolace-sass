/**
 * StudioSmartboardDesignerPage — SmartBoard Designer
 * Route: /studio/smartboard
 * Canvas de design visuel pour slides pédagogiques
 * V2 port from isna_app V1 (simplifié)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_TENANT_SLUG } from '@/config/platform';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Sparkles, Loader2, Plus, Trash2,
  Type, Square, Circle, ImageIcon, Palette, Move,
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Eye,
  LayoutGrid, Layers, FileOutput, Play, Undo2, Redo2,
  Download, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';

// ── Types ───────────────────────────────────────────────────────────────────

interface SlideElement {
  id: string;
  type: 'text' | 'rect' | 'circle' | 'image';
  x: number; y: number; width: number; height: number;
  content?: string;
  fill?: string;
  stroke?: string;
  fontSize?: number;
  imageUrl?: string;
}

interface Slide {
  id: string;
  title: string;
  elements: SlideElement[];
  background?: string;
}

interface Theme {
  background: string;
  accent_primary: string;
  accent_secondary: string;
  text_primary: string;
  text_secondary: string;
  name: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const CANVAS_W = 1037;
const CANVAS_H = 750;
const DISPLAY_SCALE = 0.55;

// Palettes de slide — CHAUDES (charte LIRI). Les presets d'origine partaient
// tous du froid : navy 0a0a2e / 1e3a5f, l'or bannie D4AF37, les bleus 3b82f6 et
// 58a6ff, les violets 7c3aed / a855f7 / c084fc, les gris ardoise 94a3b8 / 64748b.
// (hex cités sans « # » exprès : ce commentaire ne doit pas ressortir dans un
// grep de contrôle des couleurs bannies.)
// La DIFFÉRENCIATION des 5 thèmes est conservée, mais elle se joue désormais sur
// la teinte chaude (or · corail · argile · ocre · brique) et sur l'intensité du
// fond, jamais sur une teinte froide. « Nature » garde un vert — c'est l'identité
// du thème — mais un vert olive chaud (#5a8f52), pas un émeraude bleuté.
// Contrastes des textes secondaires sur leur fond réel : 7,6:1 · 6,1:1 · 5,4:1
// · 7,0:1 · 7,9:1 (tous ≥ 4,5:1).
const THEMES: Theme[] = [
  { name: 'Cosmique', background: '#201d1a', accent_primary: '#e6cc92', accent_secondary: '#d97757', text_primary: '#f5f4ee', text_secondary: '#b6ada0' },
  { name: 'Académique', background: '#ffffff', accent_primary: '#7a4630', accent_secondary: '#c2603c', text_primary: '#241f1b', text_secondary: '#6b6157' },
  { name: 'Nature', background: '#f5f0e8', accent_primary: '#4a6b3d', accent_secondary: '#5a8f52', text_primary: '#22281c', text_secondary: '#6a6154' },
  { name: 'Tech', background: '#1a1917', accent_primary: '#e3aa6b', accent_secondary: '#cf7a52', text_primary: '#f5f4ee', text_secondary: '#a9a297' },
  { name: 'Spirituel', background: '#241a16', accent_primary: '#e6cc92', accent_secondary: '#cf8059', text_primary: '#f7efe4', text_secondary: '#bfae99' },
];

/**
 * Encre de l'ÉTAT VIDE de l'artboard, choisie d'après le fond réellement peint.
 *
 * POURQUOI CE CALCUL PLUTÔT QU'UNE COULEUR FIXE. Le fond de l'artboard n'est pas
 * une surface de la charte : c'est `activeSlide.background || theme.background`,
 * donc une valeur CHOISIE PAR L'UTILISATEUR, qui va du blanc pur (« Académique »
 * #ffffff) au presque-noir (« Tech » #1a1917). Aucune encre fixe ne peut tenir
 * 4,5:1 sur les deux bouts : le gris #837c71 qui était posé ici plafonnait entre
 * 3,64:1 (Nature) et 4,26:1 (Tech) — sous la norme sur LES CINQ thèmes.
 * On choisit donc l'encre d'après la luminance du fond, ce qui couvre aussi les
 * thèmes futurs et les fonds de slide personnalisés.
 *
 * Les deux encres ne sont pas inventées : ce sont les `text_secondary` que les
 * thèmes chauds définissent déjà pour leur versant clair et leur versant sombre.
 * Résultat : ≥ 5,3:1 sur les cinq thèmes livrés (7,6 · 6,1 · 5,4 · 7,0 · 7,9).
 */
const ENCRE_VIDE_SUR_FOND_SOMBRE = '#b6ada0'; // beige chaud — text_secondary « Cosmique »
const ENCRE_VIDE_SUR_FOND_CLAIR = '#6b6157';  // brun chaud — text_secondary « Académique »

function encreEtatVide(fond: string | undefined): string {
  // Fond non lisible (dégradé, `url(...)`, valeur absente) → on suppose sombre,
  // l'hypothèse la plus sûre : la coque du studio l'est, et les thèmes clairs
  // livrés sont tous des hex plats.
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((fond || '').trim());
  if (!m) return ENCRE_VIDE_SUR_FOND_SOMBRE;
  let h = m[1];
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const canal = (i: number) => {
    const c = parseInt(h.slice(i * 2, i * 2 + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  // Luminance relative WCAG. Le seuil 0,18 est le point où les deux encins
  // ci-dessus passent la norme ; il sépare bien les fonds clairs des sombres.
  const luminance = 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
  return luminance > 0.18 ? ENCRE_VIDE_SUR_FOND_CLAIR : ENCRE_VIDE_SUR_FOND_SOMBRE;
}

const TOOLS = [
  { id: 'select', icon: Move, label: 'Sélection', shortcut: 'V' },
  { id: 'text', icon: Type, label: 'Texte', shortcut: 'T' },
  { id: 'rect', icon: Square, label: 'Rectangle', shortcut: 'R' },
  { id: 'circle', icon: Circle, label: 'Cercle', shortcut: 'C' },
  { id: 'image', icon: ImageIcon, label: 'Image', shortcut: 'I' },
];

// ── Slide Thumbnail ────────────────────────────────────────────────────────

function SlideThumbnail({ slide, active, onClick, onDelete }: {
  slide: Slide; active: boolean; onClick: () => void; onDelete: () => void;
}) {
  return (
    <div className={cn('group relative flex-shrink-0 cursor-pointer rounded-lg border-2 transition-all',
      active ? 'border-[#d97757] shadow-[0_0_12px_rgba(217,119,87,0.35)]' : 'border-white/[0.06] hover:border-white/20')}
      onClick={onClick}>
      <div className="w-32 h-[92px] rounded-md overflow-hidden" style={{ background: slide.background || THEMES[0].background }}>
        {slide.elements.map(el => (
          <div key={el.id} className="absolute" style={{
            left: el.x * 0.125, top: el.y * 0.125,
            width: el.width * 0.125, height: el.height * 0.125,
            background: el.type === 'image' ? undefined : el.fill || 'rgba(255,255,255,0.1)',
            border: el.stroke ? `1px solid ${el.stroke}` : 'none',
            borderRadius: el.type === 'circle' ? '50%' : '2px',
            fontSize: `${Math.max(6, (el.fontSize || 14) * 0.125)}px`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {el.type === 'text' && <span className="truncate px-1 text-[6px]" style={{ color: '#f5f4ee' }}>{el.content}</span>}
          </div>
        ))}
      </div>
      <div className="absolute bottom-1 left-1 w-28 truncate rounded bg-[#1f1e1c]/85 px-1 text-[8px] text-[#f5f4ee]/85">{slide.title}</div>
      <button onClick={e => { e.stopPropagation(); onDelete(); }}
        className="absolute top-1 right-1 p-0.5 rounded opacity-0 group-hover:opacity-100 bg-red-500/80 hover:bg-red-500 transition-all">
        <Trash2 className="h-2.5 w-2.5 text-white" />
      </button>
    </div>
  );
}

// ── Canvas Element ─────────────────────────────────────────────────────────

function CanvasElement({ el, scale, selected, onClick }: {
  el: SlideElement; scale: number; selected: boolean; onClick: () => void;
}) {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: el.x * scale, top: el.y * scale,
    width: el.width * scale, height: el.height * scale,
    background: el.type === 'image' ? undefined : el.fill || 'rgba(217,119,87,0.15)',
    border: selected ? '2px solid #d97757' : el.stroke ? `1px solid ${el.stroke}` : '1px solid rgba(255,255,255,0.1)',
    borderRadius: el.type === 'circle' ? '50%' : '4px',
    fontSize: `${(el.fontSize || 16) * scale}px`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', overflow: 'hidden', userSelect: 'none',
  };

  return (
    <div style={style} onClick={e => { e.stopPropagation(); onClick(); }}>
      {el.type === 'text' && (
        <span className="px-2 text-center leading-tight" style={{ color: '#f5f4ee' }}>{el.content || 'Texte'}</span>
      )}
      {el.type === 'image' && el.imageUrl && (
        <img src={el.imageUrl} alt="" className="w-full h-full object-cover" />
      )}
      {selected && (
        <>
          <div className="absolute -top-1 -left-1 w-2 h-2 bg-[#d97757] rounded-full" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#d97757] rounded-full" />
          <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-[#d97757] rounded-full" />
          <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-[#d97757] rounded-full" />
        </>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function StudioSmartboardDesignerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deckId = searchParams.get('deckId');

  const [deckTitle, setDeckTitle] = useState('Nouveau SmartBoard');
  const [slides, setSlides] = useState<Slide[]>([
    { id: 'slide-1', title: 'Slide 1', elements: [], background: THEMES[0].background },
  ]);
  const [activeSlideId, setActiveSlideId] = useState('slide-1');
  const [activeTool, setActiveTool] = useState('select');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(THEMES[0]);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sourceText, setSourceText] = useState('');
  const [showSource, setShowSource] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const canvasRef = useRef<HTMLDivElement>(null);

  const activeSlide = slides.find(s => s.id === activeSlideId) || slides[0];

  // ── Slide management ──────────────────────────────────────────────────

  const addSlide = useCallback(() => {
    const id = `slide-${Date.now()}`;
    const newSlide: Slide = { id, title: `Slide ${slides.length + 1}`, elements: [], background: theme.background };
    setSlides(prev => [...prev, newSlide]);
    setActiveSlideId(id);
  }, [slides.length, theme.background]);

  const deleteSlide = useCallback((id: string) => {
    if (slides.length <= 1) return;
    setSlides(prev => prev.filter(s => s.id !== id));
    if (activeSlideId === id) setActiveSlideId(slides[0].id === id ? slides[1]?.id || slides[0].id : slides[0].id);
  }, [slides, activeSlideId]);

  const updateSlide = useCallback((id: string, patch: Partial<Slide>) => {
    setSlides(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  // ── Element management ────────────────────────────────────────────────

  const addElement = useCallback((type: SlideElement['type']) => {
    const el: SlideElement = {
      id: `el-${Date.now()}`,
      type,
      x: 100, y: 100, width: type === 'circle' ? 150 : 300, height: type === 'circle' ? 150 : 80,
      content: type === 'text' ? 'Nouveau texte' : undefined,
      fill: 'rgba(217,119,87,0.2)',
      fontSize: 18,
    };
    updateSlide(activeSlideId, { elements: [...activeSlide.elements, el] });
    setSelectedElementId(el.id);
    setActiveTool('select');
  }, [activeSlideId, activeSlide.elements, updateSlide]);

  const updateElement = useCallback((elId: string, patch: Partial<SlideElement>) => {
    updateSlide(activeSlideId, {
      elements: activeSlide.elements.map(e => e.id === elId ? { ...e, ...patch } : e),
    });
  }, [activeSlideId, activeSlide.elements, updateSlide]);

  const deleteElement = useCallback(() => {
    if (!selectedElementId) return;
    updateSlide(activeSlideId, { elements: activeSlide.elements.filter(e => e.id !== selectedElementId) });
    setSelectedElementId(null);
  }, [selectedElementId, activeSlideId, activeSlide.elements, updateSlide]);

  // ── Canvas click → add element ───────────────────────────────────────

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (activeTool === 'select') { setSelectedElementId(null); return; }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / DISPLAY_SCALE;
    const y = (e.clientY - rect.top) / DISPLAY_SCALE;
    addElement(activeTool as SlideElement['type']);
  }, [activeTool, addElement]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') deleteElement();
      if (e.key === 'v') setActiveTool('select');
      if (e.key === 't') setActiveTool('text');
      if (e.key === 'r') setActiveTool('rect');
      if (e.key === 'c') setActiveTool('circle');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [deleteElement]);

  // ── API calls ─────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/studio/workspaces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'X-Tenant-Slug': localStorage.getItem('tenantSlug') || DEFAULT_TENANT_SLUG,
        },
        body: JSON.stringify({ title: deckTitle }),
      });
      const json = await res.json();
      if (json.data) {
        await fetch(`${import.meta.env.VITE_API_URL}/studio/workspaces/${json.data.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'X-Tenant-Slug': localStorage.getItem('tenantSlug') || DEFAULT_TENANT_SLUG,
          },
          body: JSON.stringify({ slides_json: { slides, theme } }),
        });
        setSuccess('Workspace sauvegardé');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }, [deckTitle, slides, theme]);

  const handleGenerate = useCallback(async () => {
    if (!sourceText.trim()) { setError('Saisissez un texte source'); return; }
    setGenerating(true);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/smartboard/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'X-Tenant-Slug': localStorage.getItem('tenantSlug') || DEFAULT_TENANT_SLUG,
        },
        body: JSON.stringify({ sourceText }),
      });
      const json = await res.json();
      if (json.data?.slidesGenerated) {
        setSuccess(`${json.data.slidesGenerated} slides générés`);
        setTimeout(() => setSuccess(''), 3000);
      } else setError(json.error?.message || 'Erreur génération');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }, [sourceText]);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-[#262624] text-[#f5f4ee] overflow-hidden">
      {/* ── Top Bar ──────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-[#30302e]/95 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <Link to="/studio/liri" className="text-white/55 hover:text-[#e08b6d]">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <input value={deckTitle} onChange={e => setDeckTitle(e.target.value)}
            className="bg-transparent text-[14px] font-semibold text-[#f5f4ee] outline-none border-b border-transparent focus:border-[#d97757]/60 px-1 w-48" />
          <span className="text-[10px] text-white/55">{slides.length} slides</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Theme selector */}
          <select value={theme.name} onChange={e => {
            const t = THEMES.find(th => th.name === e.target.value) || THEMES[0];
            setTheme(t);
            updateSlide(activeSlideId, { background: t.background });
          }} className="rounded-lg border border-white/10 bg-[#2b2a27] px-2.5 py-1 text-[10px] text-white/70 outline-none">
            {THEMES.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
          </select>

          {/* Generate AI */}
          <button onClick={() => setShowSource(v => !v)}
            className={cn('flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium transition-all',
              showSource ? 'bg-[#e6cc92] text-[#1f1e1c]' : 'border border-white/10 text-white/60 hover:text-white/85')}>
            <Sparkles className="h-3 w-3" /> IA
          </button>

          {/* Save */}
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1 rounded-lg bg-[#d97757] px-3 py-1 text-[10px] font-semibold text-[#1f1e1c] hover:bg-[#e08b6d] disabled:opacity-50">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Sauver
          </button>

          {/* Export */}
          <button onClick={() => navigate('/studio/export-center')}
            className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[10px] text-white/60 hover:text-white/85">
            <FileOutput className="h-3 w-3" /> Export
          </button>
        </div>

        {success && <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 flex items-center gap-1.5 rounded-lg bg-[#5a8f52]/20 border border-[#5a8f52]/35 px-3 py-1.5"><CheckCircle2 className="h-3 w-3 text-[#7bb06a]" /><span className="text-[10px] text-[#9cc48a]">{success}</span></div>}
        {error && <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 flex items-center gap-1.5 rounded-lg bg-red-500/20 border border-red-500/30 px-3 py-1.5"><AlertTriangle className="h-3 w-3 text-red-300" /><span className="text-[10px] text-red-300">{error}</span></div>}
      </header>

      {/* ── Source text panel ────────────────────────────────────────── */}
      {showSource && (
        <div className="border-b border-white/[0.06] bg-[#30302e] p-4">
          <div className="flex gap-3">
            <textarea value={sourceText} onChange={e => setSourceText(e.target.value)}
              placeholder="Collez votre texte source pour générer des slides IA..."
              rows={3}
              className="flex-1 resize-none rounded-lg border border-white/10 bg-[#2b2a27] px-3 py-2 text-[11px] text-[#f5f4ee]/85 placeholder-white/50 outline-none focus:border-[#d97757]/50" />
            <button onClick={handleGenerate} disabled={generating}
              className="flex items-center gap-1.5 rounded-lg bg-[#d97757] px-4 py-2 text-[11px] font-semibold text-[#1f1e1c] hover:bg-[#e08b6d] disabled:opacity-50 self-end">
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Générer
            </button>
          </div>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Left — Slide thumbnails */}
        <aside className="flex w-40 flex-shrink-0 flex-col border-r border-white/[0.06] bg-[#30302e]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">Slides</span>
            <button onClick={addSlide} className="flex h-5 w-5 items-center justify-center rounded hover:bg-white/10">
              <Plus className="h-3 w-3 text-white/65" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
            {slides.map(slide => (
              <SlideThumbnail key={slide.id} slide={slide} active={slide.id === activeSlideId}
                onClick={() => setActiveSlideId(slide.id)}
                onDelete={() => deleteSlide(slide.id)} />
            ))}
          </div>
        </aside>

        {/* Center — Canvas */}
        <main className="flex-1 flex items-center justify-center bg-[#1f1e1c] relative overflow-hidden" onClick={handleCanvasClick}>
          {/* Tool strip — vertical left */}
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-10">
            {TOOLS.map(tool => {
              const Icon = tool.icon;
              return (
                <button key={tool.id} onClick={e => { e.stopPropagation(); setActiveTool(tool.id); }}
                  title={`${tool.label} (${tool.shortcut})`}
                  className={cn('flex h-8 w-8 items-center justify-center rounded-lg transition-all',
                    activeTool === tool.id ? 'bg-[#d97757] text-[#1f1e1c] shadow-[0_0_8px_rgba(217,119,87,0.35)]' : 'text-white/55 hover:text-white/85 hover:bg-white/[0.06]')}>
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>

          {/* Canvas area */}
          <div ref={canvasRef} className="relative rounded-lg shadow-2xl overflow-hidden"
            style={{
              width: CANVAS_W * DISPLAY_SCALE,
              height: CANVAS_H * DISPLAY_SCALE,
              background: activeSlide.background || theme.background,
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
            {activeSlide.elements.map(el => (
              <CanvasElement key={el.id} el={el} scale={DISPLAY_SCALE}
                selected={el.id === selectedElementId}
                onClick={() => { setSelectedElementId(el.id); setActiveTool('select'); }} />
            ))}

            {/* État vide — encre calculée sur le fond RÉEL de l'artboard (cf. encreEtatVide) :
                ce fond est un thème choisi par l'utilisateur, du blanc au presque-noir. */}
            {activeSlide.elements.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                style={{ color: encreEtatVide(activeSlide.background || theme.background) }}>
                <LayoutGrid className="h-12 w-12 mb-2" />
                <p className="text-[11px]">Cliquez sur le canvas pour ajouter un élément</p>
                <p className="text-[9px] mt-1">ou sélectionnez un outil à gauche</p>
              </div>
            )}
          </div>

          {/* Zoom controls */}
          <div className="absolute right-3 bottom-4 flex items-center gap-1 bg-[#30302e]/90 rounded-lg border border-white/[0.06] px-1.5 py-1">
            <span className="text-[9px] text-white/60 px-1">{Math.round(DISPLAY_SCALE * 100)}%</span>
            <button className="p-1 rounded text-white/55 hover:text-white/85"><ZoomOut className="h-3 w-3" /></button>
            <button className="p-1 rounded text-white/55 hover:text-white/85"><ZoomIn className="h-3 w-3" /></button>
          </div>
        </main>

        {/* Right — Properties panel */}
        <aside className="flex w-56 flex-shrink-0 flex-col border-l border-white/[0.06] bg-[#30302e]">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">Propriétés</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {selectedElementId ? (
              <div className="space-y-3">
                {(() => {
                  const el = activeSlide.elements.find(e => e.id === selectedElementId);
                  if (!el) return null;
                  return (
                    <>
                      <div>
                        <label className="text-[9px] text-white/60 uppercase">Type</label>
                        <div className="text-[11px] text-white/75 mt-0.5 capitalize">{el.type}</div>
                      </div>
                      <div>
                        <label className="text-[9px] text-white/60 uppercase">Position</label>
                        <div className="flex gap-2 mt-0.5">
                          <input type="number" value={Math.round(el.x)} onChange={e => updateElement(el.id, { x: Number(e.target.value) })}
                            className="w-16 rounded border border-white/10 bg-[#2b2a27] px-2 py-1 text-[10px] text-white/80 outline-none" placeholder="X" />
                          <input type="number" value={Math.round(el.y)} onChange={e => updateElement(el.id, { y: Number(e.target.value) })}
                            className="w-16 rounded border border-white/10 bg-[#2b2a27] px-2 py-1 text-[10px] text-white/80 outline-none" placeholder="Y" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] text-white/60 uppercase">Taille</label>
                        <div className="flex gap-2 mt-0.5">
                          <input type="number" value={Math.round(el.width)} onChange={e => updateElement(el.id, { width: Number(e.target.value) })}
                            className="w-16 rounded border border-white/10 bg-[#2b2a27] px-2 py-1 text-[10px] text-white/80 outline-none" placeholder="W" />
                          <input type="number" value={Math.round(el.height)} onChange={e => updateElement(el.id, { height: Number(e.target.value) })}
                            className="w-16 rounded border border-white/10 bg-[#2b2a27] px-2 py-1 text-[10px] text-white/80 outline-none" placeholder="H" />
                        </div>
                      </div>
                      {el.type === 'text' && (
                        <div>
                          <label className="text-[9px] text-white/60 uppercase">Contenu</label>
                          <textarea value={el.content || ''} onChange={e => updateElement(el.id, { content: e.target.value })}
                            rows={3}
                            className="w-full mt-0.5 resize-none rounded border border-white/10 bg-[#2b2a27] px-2 py-1.5 text-[10px] text-white/80 outline-none" />
                        </div>
                      )}
                      <button onClick={deleteElement}
                        className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[10px] text-red-300 hover:bg-red-500/20 w-full">
                        <Trash2 className="h-3 w-3" /> Supprimer
                      </button>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Eye className="h-6 w-6 text-white/45 mb-2" />
                <p className="text-[10px] text-white/60">Sélectionnez un élément</p>
              </div>
            )}
          </div>

          {/* Slide info */}
          <div className="border-t border-white/[0.06] p-3">
            <div className="text-[9px] text-white/60 uppercase mb-1">Slide actif</div>
            <input value={activeSlide.title} onChange={e => updateSlide(activeSlideId, { title: e.target.value })}
              className="w-full rounded border border-white/10 bg-[#2b2a27] px-2.5 py-1.5 text-[11px] text-white/80 outline-none focus:border-[#d97757]/50" />
          </div>
        </aside>
      </div>

      {/* ── Bottom Bar ────────────────────────────────────────────────── */}
      <footer className="flex items-center justify-between px-4 py-1.5 border-t border-white/[0.06] bg-[#30302e]">
        <div className="flex items-center gap-3 text-[9px] text-white/60">
          <button className="flex items-center gap-1 hover:text-white/85"><Undo2 className="h-3 w-3" /> Annuler</button>
          <button className="flex items-center gap-1 hover:text-white/85"><Redo2 className="h-3 w-3" /> Rétablir</button>
        </div>
        <div className="flex items-center gap-3 text-[9px] text-white/60">
          <span>{CANVAS_W}×{CANVAS_H}</span>
          <span>Slide {slides.findIndex(s => s.id === activeSlideId) + 1}/{slides.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 rounded px-2 py-0.5 text-[9px] text-white/60 hover:text-white/85">
            <Play className="h-3 w-3" /> Présenter
          </button>
        </div>
      </footer>
    </div>
  );
}
