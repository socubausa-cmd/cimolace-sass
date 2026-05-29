import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from 'recharts';
import { Loader2, ImageIcon, RefreshCw, AlertCircle, Maximize2, X } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import {
  DESIGNER_IA_IMAGE_SIZES,
  invokeGenerateVisualImage,
  pushLegacyLocalDesignerImage,
} from '@/features/smartboard-konva-editor/lib/designerIaImageHistory';

// ── Types (exported for NodeExplanationPanel) ─────────────────────────────────
export type SketchElement = {
  shape: 'circle' | 'box' | 'rectangle' | 'node' | 'diamond' | 'arrow' | 'spiral';
  label?: string;
  from?: number;
  to?: number;
  color?: string;
};

export type InfographicBranch = { label: string; items?: string[] };
export type InfographicElement = { label: string; sub?: string };
export type InfographicStep = { label: string; sub?: string };

export type VisualSpec =
  | { type: 'diagram'; title?: string; format: 'mermaid'; code: string }
  | { type: 'chart'; title?: string; chartType?: string; labels?: string[]; values?: number[]; unit?: string }
  | { type: 'sketch'; title?: string; elements?: SketchElement[] }
  | { type: 'image'; title?: string; prompt: string }
  | {
      type: 'infographic';
      title?: string;
      mindmap?: { center?: string; branches?: InfographicBranch[] };
      scientific?: { formula?: string; elements?: InfographicElement[] };
      pedagogic?: { steps?: InfographicStep[]; math?: string };
      cosmological?: { elements?: string[]; sequence?: string };
    }
  | { type: string; [key: string]: unknown };

// ── Shared animation variant ──────────────────────────────────────────────────
const fadeScale = {
  hidden: { opacity: 0, scale: 0.95, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } },
  exit:    { opacity: 0, scale: 0.95, y: 8, transition: { duration: 0.2 } },
};

// ── VisualCard wrapper ────────────────────────────────────────────────────────
function VisualCard({ title, children, onExpand }: { title?: string; children: React.ReactNode; onExpand?: () => void }) {
  return (
    <motion.div
      variants={fadeScale}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="rounded-xl overflow-hidden group shadow-lg w-full min-w-0"
      style={{ background: 'linear-gradient(135deg, #0d1b2a 0%, #0a1220 100%)', border: '1px solid rgba(212,175,55,0.2)' }}
    >
      <div
        className="px-3 py-2 flex items-center justify-between min-h-[34px]"
        style={{ background: 'linear-gradient(90deg, rgba(212,175,55,0.15) 0%, rgba(212,175,55,0.03) 100%)', borderBottom: '1px solid rgba(212,175,55,0.15)' }}
      >
        {title && (
          <span className="text-xs font-semibold text-[#D4AF37] truncate tracking-wide">{title}</span>
        )}
        {onExpand && (
          <button
            type="button"
            onClick={onExpand}
            title="Agrandir"
            className="ml-auto flex-shrink-0 text-[#D4AF37]/40 hover:text-[#D4AF37] transition-colors p-0.5 rounded"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="p-3">{children}</div>
    </motion.div>
  );
}

// ── Mermaid sanitizer ─────────────────────────────────────────────────────────
function sanitizeMermaid(code: string): string {
  return code
    .split('\n')
    .map((line) => {
      // Remove style lines that contain unicode garbage (non-ASCII outside quotes)
      if (/style\s+\w+/.test(line) && /[^\x00-\x7F]/.test(line)) {
        // Keep only ASCII-safe content, strip non-ASCII chars
        return line.replace(/[^\x00-\x7F]/g, '');
      }
      // Fix corrupted # in colors (unicode lookalikes → #)
      return line.replace(/[ﬂ°¶ß]/g, '').replace(/(?<=stroke:|fill:|color:)\s*[^\x00-\x7F]+/g, '#333');
    })
    .filter((line) => line.trim() !== '') // remove lines that became empty after strip
    .join('\n');
}

// ── 1. MermaidDiagram ─────────────────────────────────────────────────────────
function MermaidDiagram({ code, title, onExpand }: { code: string; title?: string; onExpand?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const safeCode = sanitizeMermaid(code);

  useEffect(() => {
    if (!containerRef.current || !safeCode) return;
    const id = `mermaid-${Math.random().toString(36).slice(2)}`;
    let alive = true;

    import('mermaid').then((mod) => {
      if (!alive) return;
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: {
          background: '#0a1220',
          primaryColor: '#1e3a5f',
          primaryTextColor: '#e8f4fd',
          primaryBorderColor: '#D4AF37',
          secondaryColor: '#2d1b4e',
          secondaryTextColor: '#f3e8ff',
          secondaryBorderColor: '#a855f7',
          tertiaryColor: '#0f3320',
          tertiaryTextColor: '#dcfce7',
          tertiaryBorderColor: '#22c55e',
          edgeLabelBackground: '#0d1b2a',
          lineColor: '#D4AF37',
          fontSize: '13px',
          fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
          clusterBkg: '#0d1b2a',
          clusterBorder: '#D4AF37',
          titleColor: '#D4AF37',
          nodeBorder: '#D4AF37',
          mainBkg: '#1e3a5f',
          nodeTextColor: '#ffffff',
        },
        flowchart: { htmlLabels: true, curve: 'basis', padding: 16 },
      });
      mermaid
        .render(id, safeCode)
        .then(({ svg }) => {
          if (!alive || !containerRef.current) return;
          // Post-process: ensure readable font sizes and stroke weights
          const enhanced = svg
            .replace(/font-size:\s*[\d.]+px/g, 'font-size:13px')
            .replace(/stroke-width:\s*[\d.]+(?!px)/g, 'stroke-width:1.8');
          containerRef.current.innerHTML = enhanced;
        })
        .catch((e: unknown) => {
          if (alive) setError(String((e as Error)?.message || 'Erreur Mermaid'));
        });
    });

    return () => { alive = false; };
  }, [safeCode]);

  return (
    <VisualCard title={title} onExpand={onExpand}>
      {error ? (
        <div className="flex items-center gap-2 text-red-400 text-xs">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="w-full overflow-x-auto overflow-y-hidden min-h-[120px] [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:mx-auto [&_text]:font-medium"
        />
      )}
    </VisualCard>
  );
}

// ── 2. ChartDiagram ───────────────────────────────────────────────────────────
function ChartDiagram({
  title,
  chartType = 'bar',
  labels = [],
  values = [],
  unit = '',
  onExpand,
}: {
  title?: string;
  chartType?: string;
  labels?: string[];
  values?: number[];
  unit?: string;
  onExpand?: () => void;
}) {
  const data = labels.map((l, i) => ({ name: l, value: values[i] ?? 0 }));
  const isLine = chartType === 'line';

  return (
    <VisualCard title={title} onExpand={onExpand}>
      <ResponsiveContainer width="100%" height={280}>
        {isLine ? (
          <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#ffffff15' }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} unit={unit ? ` ${unit}` : ''} axisLine={{ stroke: '#ffffff15' }} />
            <Tooltip
              contentStyle={{ background: '#0d1b2a', border: '1px solid rgba(212,175,55,0.3)', fontSize: 12, borderRadius: 8 }}
              labelStyle={{ color: '#D4AF37', fontWeight: 600 }}
            />
            <Line type="monotone" dataKey="value" stroke="#D4AF37" strokeWidth={2.5} dot={{ fill: '#D4AF37', r: 4, strokeWidth: 2, stroke: '#0d1b2a' }} activeDot={{ r: 6 }} />
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#ffffff15' }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} unit={unit ? ` ${unit}` : ''} axisLine={{ stroke: '#ffffff15' }} />
            <Tooltip
              contentStyle={{ background: '#0d1b2a', border: '1px solid rgba(212,175,55,0.3)', fontSize: 12, borderRadius: 8 }}
              labelStyle={{ color: '#D4AF37', fontWeight: 600 }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {data.map((_, index) => (
                <Cell key={index} fill={['#D4AF37','#a855f7','#22c55e','#3b82f6','#f97316','#ec4899'][index % 6]} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </VisualCard>
  );
}

// ── 3. SketchDiagram ──────────────────────────────────────────────────────────
const CANVAS_W = 420;
const CANVAS_H = 240;
const NODE_R = 34;
const BOX_W = 80;
const BOX_H = 44;

function computeNodePositions(elements: SketchElement[]): { x: number; y: number }[] {
  const nodes = elements.filter((e) => e.shape !== 'arrow');
  const n = nodes.length;
  if (n === 0) return [];
  const cols = Math.min(n, 4);
  const rows = Math.ceil(n / cols);
  const xStep = CANVAS_W / (cols + 1);
  const yStep = CANVAS_H / (rows + 1);
  return nodes.map((_, i) => ({
    x: xStep * ((i % cols) + 1),
    y: yStep * (Math.floor(i / cols) + 1),
  }));
}

function SketchDiagram({ title, elements = [], onExpand }: { title?: string; elements?: SketchElement[]; onExpand?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    let alive = true;

    import('roughjs').then((mod) => {
      if (!alive || !canvasRef.current) return;
      try {
        const rough = mod.default;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        const rc = rough.canvas(canvas);

        const nodeElements = elements.filter((e) => e.shape !== 'arrow');
        const arrowElements = elements.filter((e) => e.shape === 'arrow');
        const positions = computeNodePositions(nodeElements);

        // Draw arrows first (below nodes)
        arrowElements.forEach((el) => {
          const fromIdx = Number(el.from ?? 0);
          const toIdx = Number(el.to ?? 1);
          const fp = positions[fromIdx];
          const tp = positions[toIdx];
          if (!fp || !tp) return;
          const opts = { stroke: '#D4AF37', roughness: 1.2, strokeWidth: 1.5 };
          rc.line(fp.x, fp.y, tp.x, tp.y, opts);
          // Arrowhead
          const angle = Math.atan2(tp.y - fp.y, tp.x - fp.x);
          const aw = 10;
          ctx.save();
          ctx.strokeStyle = '#D4AF37';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(tp.x, tp.y);
          ctx.lineTo(tp.x - aw * Math.cos(angle - 0.4), tp.y - aw * Math.sin(angle - 0.4));
          ctx.moveTo(tp.x, tp.y);
          ctx.lineTo(tp.x - aw * Math.cos(angle + 0.4), tp.y - aw * Math.sin(angle + 0.4));
          ctx.stroke();
          ctx.restore();
        });

        // Draw nodes
        nodeElements.forEach((el, i) => {
          const pos = positions[i];
          if (!pos) return;
          const color = el.color || '#D4AF37';
          const shapeOpts = { stroke: color, roughness: 1.6, fillStyle: 'hachure', fill: '#1a253540', strokeWidth: 1.5 };

          if (el.shape === 'circle' || el.shape === 'spiral') {
            rc.circle(pos.x, pos.y, NODE_R * 2, shapeOpts);
          } else if (el.shape === 'diamond') {
            const d = NODE_R + 6;
            rc.linearPath(
              [[pos.x, pos.y - d], [pos.x + d, pos.y], [pos.x, pos.y + d], [pos.x - d, pos.y], [pos.x, pos.y - d]],
              shapeOpts
            );
          } else {
            // box / rectangle / node
            rc.rectangle(pos.x - BOX_W / 2, pos.y - BOX_H / 2, BOX_W, BOX_H, shapeOpts);
          }

          // Label
          if (el.label) {
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const maxW = el.shape === 'circle' || el.shape === 'diamond' || el.shape === 'spiral' ? NODE_R * 1.6 : BOX_W - 6;
            const words = el.label.split(' ');
            let line = '';
            const lines: string[] = [];
            for (const w of words) {
              const test = line ? `${line} ${w}` : w;
              if (ctx.measureText(test).width > maxW && line) {
                lines.push(line);
                line = w;
              } else {
                line = test;
              }
            }
            if (line) lines.push(line);
            const lineH = 13;
            lines.forEach((l, li) => {
              ctx.fillText(l, pos.x, pos.y + (li - (lines.length - 1) / 2) * lineH);
            });
            ctx.restore();
          }
        });
      } catch (e) {
        if (alive) setError(String((e as Error)?.message || 'Erreur Sketch'));
      }
    });

    return () => { alive = false; };
  }, [elements]);

  return (
    <VisualCard title={title} onExpand={onExpand}>
      {error ? (
        <div className="flex items-center gap-2 text-red-400 text-xs">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="w-full h-auto rounded"
          style={{ background: '#0a1520' }}
        />
      )}
    </VisualCard>
  );
}

// ── 4. ImageVisual ────────────────────────────────────────────────────────────
function ImageVisual({ prompt, title, onExpand }: { prompt: string; title?: string; onExpand?: () => void }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const [imageGenSize, setImageGenSize] = useState('1792x1024');

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await invokeGenerateVisualImage(supabase, {
        prompt,
        size: imageGenSize,
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      const url = data?.imageUrl || data?.url;
      if (!url) throw new Error('Pas d\'URL image retournée');
      if (!data?.persisted) {
        pushLegacyLocalDesignerImage({ url, prompt, size: data?.size || imageGenSize });
      }
      setImageUrl(url);
    } catch (e) {
      setError(String((e as Error)?.message || 'Erreur génération image'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <VisualCard title={title || 'Illustration IA'} onExpand={onExpand}>
      <AnimatePresence mode="wait">
        {!imageUrl && !loading && !error && (
          <motion.div key="idle" variants={fadeScale} initial="hidden" animate="visible" exit="exit">
            <div className="flex flex-col items-center gap-3 py-4">
              <ImageIcon className="h-8 w-8 text-purple-400/60" />
              <p className="text-xs text-gray-400 text-center leading-relaxed max-w-[260px]">
                {prompt.slice(0, 120)}{prompt.length > 120 ? '…' : ''}
              </p>
              <label className="flex w-full max-w-[260px] flex-col gap-1 text-left">
                <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  Format DALL·E 3
                </span>
                <select
                  value={imageGenSize}
                  onChange={(e) => setImageGenSize(e.target.value)}
                  className="rounded-lg border border-white/10 bg-gray-900/90 px-2.5 py-2 text-xs text-gray-200 focus:border-purple-500/40 focus:outline-none"
                >
                  {DESIGNER_IA_IMAGE_SIZES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={generate}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Générer l&apos;illustration
              </button>
            </div>
          </motion.div>
        )}

        {loading && (
          <motion.div key="loading" variants={fadeScale} initial="hidden" animate="visible" exit="exit"
            className="flex flex-col items-center gap-2 py-6">
            <Loader2 className="h-6 w-6 text-purple-400 animate-spin" />
            <p className="text-xs text-gray-400">Génération en cours…</p>
          </motion.div>
        )}

        {error && !loading && (
          <motion.div key="error" variants={fadeScale} initial="hidden" animate="visible" exit="exit"
            className="flex flex-col items-center gap-2 py-3">
            <div className="flex items-center gap-2 text-red-400 text-xs">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button type="button" onClick={generate}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors mt-1">
              <RefreshCw className="h-3 w-3" /> Réessayer
            </button>
          </motion.div>
        )}

        {imageUrl && (
          <motion.div key="image" variants={fadeScale} initial="hidden" animate="visible" exit="exit">
            <div className="relative group/img">
              <img
                src={imageUrl}
                alt={title || prompt.slice(0, 60)}
                className="w-full max-w-full rounded-lg object-contain cursor-zoom-in hover:opacity-90 transition-opacity block"
                style={{
                  maxHeight: imageGenSize === '1024x1792' ? 340 : imageGenSize === '1792x1024' ? 300 : 280,
                }}
                onClick={() => setLightbox(true)}
              />
              <button
                type="button"
                onClick={() => setLightbox(true)}
                title="Voir en grand"
                className="absolute top-2 right-2 bg-black/60 hover:bg-black/90 text-white rounded-lg p-1.5 opacity-0 group-hover/img:opacity-100 transition-opacity"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <label className="mt-2 block w-full">
              <span className="text-[10px] text-gray-500">Format pour régénérer</span>
              <select
                value={imageGenSize}
                onChange={(e) => setImageGenSize(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-gray-900/90 px-2 py-1.5 text-[11px] text-gray-200 focus:border-purple-500/40 focus:outline-none"
              >
                {DESIGNER_IA_IMAGE_SIZES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => { setImageUrl(null); generate(); }}
              className="mt-2 flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors">
              <RefreshCw className="h-2.5 w-2.5" /> Régénérer
            </button>
            {lightbox && (
              <div
                className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={() => setLightbox(false)}
              >
                <button
                  type="button"
                  onClick={() => setLightbox(false)}
                  className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <img
                  src={imageUrl}
                  alt={title || prompt.slice(0, 60)}
                  className="max-w-[95vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </VisualCard>
  );
}

// ── 5. InfographicVisual (4-panel structured educational infographic) ─────────
type InfographicVisualProps = {
  spec: Extract<VisualSpec, { type: 'infographic' }>;
  onExpand?: () => void;
};

function InfographicVisual({ spec, onExpand }: InfographicVisualProps) {
  const { title, mindmap, scientific, pedagogic, cosmological } = spec;
  const branches = mindmap?.branches ?? [];
  const sciElements = scientific?.elements ?? [];
  const steps = pedagogic?.steps ?? [];
  const cosmoElements = cosmological?.elements ?? [];

  const PANEL_COLORS = ['#1565c0', '#6a1b9a', '#2e7d32', '#311b92'];

  return (
    <VisualCard title={title || 'Infographie pédagogique'} onExpand={onExpand}>
      <div style={{ background: 'linear-gradient(135deg,#dce8ff 0%,#ede8ff 50%,#d8f0e8 100%)', borderRadius: 10, padding: 10 }}>
        {/* Title */}
        <div style={{ textAlign: 'center', color: '#1a237e', fontWeight: 900, fontSize: 15, marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' }}>
          {title}
        </div>

        {/* 2×2 grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>

          {/* ── Panel 1: MINDMAP ── */}
          <div style={{ background: 'rgba(255,255,255,0.88)', borderRadius: 9, padding: 8, border: '2px solid #90caf9', minHeight: 160 }}>
            <div style={{ display: 'inline-block', background: PANEL_COLORS[0], color: '#fff', borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 700, marginBottom: 6 }}>
              1. MINDMAP
            </div>
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ background: 'linear-gradient(135deg,#1565c0,#42a5f5)', color: '#fff', borderRadius: 20, padding: '5px 10px', fontSize: 11, fontWeight: 700, textAlign: 'center', boxShadow: '0 2px 8px #1565c040' }}>
                {mindmap?.center || title}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginTop: 2 }}>
                {branches.map((b, i) => (
                  <div key={i} style={{ background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 8, padding: '3px 7px', fontSize: 9.5, color: '#1565c0', fontWeight: 600, maxWidth: 100, textAlign: 'center' }}>
                    <div>{b.label}</div>
                    {b.items?.map((it, j) => (
                      <div key={j} style={{ color: '#555', fontWeight: 400, fontSize: 9 }}>• {it}</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Panel 2: DIAGRAMME SCIENTIFIQUE ── */}
          <div style={{ background: 'rgba(255,255,255,0.88)', borderRadius: 9, padding: 8, border: '2px solid #ce93d8', minHeight: 160 }}>
            <div style={{ display: 'inline-block', background: PANEL_COLORS[1], color: '#fff', borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 700, marginBottom: 6 }}>
              2. DIAGRAMME SCIENTIFIQUE
            </div>
            {scientific?.formula && (
              <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#6a1b9a', marginBottom: 6, background: '#f3e5f5', borderRadius: 6, padding: '3px 6px' }}>
                {scientific.formula}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
              {sciElements.map((el, i) => (
                <React.Fragment key={i}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ width: 54, height: 54, borderRadius: '50%', background: `linear-gradient(135deg, ${['#7b1fa2','#ab47bc','#e91e63'][i % 3]}, ${['#ab47bc','#e91e63','#ff6090'][i % 3]})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px #6a1b9a40' }}>
                      <span style={{ color: '#fff', fontSize: 9, fontWeight: 700, textAlign: 'center', padding: 4, lineHeight: 1.2 }}>{el.label}</span>
                    </div>
                    {el.sub && <div style={{ fontSize: 8.5, color: '#666', textAlign: 'center', maxWidth: 60, lineHeight: 1.2 }}>{el.sub}</div>}
                  </div>
                  {i < sciElements.length - 1 && (
                    <div style={{ color: '#6a1b9a', fontWeight: 900, fontSize: 14 }}>{i === sciElements.length - 2 ? '=' : '+'}</div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* ── Panel 3: INFOGRAPHIE PÉDAGOGIQUE ── */}
          <div style={{ background: 'rgba(255,255,255,0.88)', borderRadius: 9, padding: 8, border: '2px solid #a5d6a7', minHeight: 140 }}>
            <div style={{ display: 'inline-block', background: PANEL_COLORS[2], color: '#fff', borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 700, marginBottom: 6 }}>
              3. INFOGRAPHIE PÉDAGOGIQUE
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
              {steps.map((st, i) => (
                <React.Fragment key={i}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ background: `linear-gradient(135deg,${['#2e7d32','#43a047','#66bb6a'][i % 3]},${['#43a047','#66bb6a','#a5d6a7'][i % 3]})`, color: '#fff', borderRadius: 8, padding: '4px 8px', fontSize: 10, fontWeight: 700, textAlign: 'center', boxShadow: '0 2px 6px #2e7d3240' }}>
                      {st.label}
                    </div>
                    {st.sub && <div style={{ fontSize: 8.5, color: '#555', textAlign: 'center', maxWidth: 70, lineHeight: 1.2 }}>• {st.sub}</div>}
                  </div>
                  {i < steps.length - 1 && <div style={{ color: '#f57f17', fontWeight: 900, fontSize: 16, marginTop: 6 }}>→</div>}
                </React.Fragment>
              ))}
            </div>
            {pedagogic?.math && (
              <div style={{ marginTop: 6, textAlign: 'center', fontSize: 9, color: '#2e7d32', fontWeight: 600, background: '#e8f5e9', borderRadius: 6, padding: '2px 6px' }}>
                Se modélise par : {pedagogic.math}
              </div>
            )}
          </div>

          {/* ── Panel 4: ILLUSTRATION COSMOLOGIQUE ── */}
          <div style={{ background: 'linear-gradient(135deg,#050520 0%,#1a0535 60%,#070a2e 100%)', borderRadius: 9, padding: 8, border: '2px solid #7c4dff', minHeight: 140 }}>
            <div style={{ display: 'inline-block', background: PANEL_COLORS[3], color: '#fff', borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 700, marginBottom: 6 }}>
              4. ILLUSTRATION COSMOLOGIQUE
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginBottom: 6 }}>
              {cosmoElements.map((el, i) => (
                <div key={i} style={{ background: 'rgba(124,77,255,0.25)', border: '1px solid #9c6eff', color: '#e0d0ff', borderRadius: 12, padding: '3px 8px', fontSize: 9.5, fontWeight: 600, textAlign: 'center', boxShadow: '0 0 8px #7c4dff50' }}>
                  {el}
                </div>
              ))}
            </div>
            {cosmological?.sequence && (
              <div style={{ textAlign: 'center', fontSize: 9, color: '#d4af37', fontWeight: 700, background: 'rgba(212,175,55,0.1)', borderRadius: 6, padding: '4px 6px', border: '1px solid rgba(212,175,55,0.3)', lineHeight: 1.4 }}>
                ✦ {cosmological.sequence}
              </div>
            )}
          </div>

        </div>
      </div>
    </VisualCard>
  );
}

// ── 6. FallbackVisual (backward-compat for plain-string visuals) ──────────────
function FallbackVisual({ text }: { text: string }) {
  return (
    <VisualCard>
      <p className="text-sm text-gray-300 leading-relaxed">{text}</p>
    </VisualCard>
  );
}

// ── Main VisualRenderer ───────────────────────────────────────────────────────
interface VisualRendererProps {
  visual: VisualSpec | string;
  onExpand?: () => void;
}

export default function VisualRenderer({ visual, onExpand }: VisualRendererProps) {
  if (typeof visual === 'string') return <FallbackVisual text={visual} />;

  if (visual.type === 'diagram') {
    const v = visual as Extract<VisualSpec, { type: 'diagram' }>;
    return <MermaidDiagram code={v.code} title={v.title} onExpand={onExpand} />;
  }

  if (visual.type === 'chart') {
    const v = visual as Extract<VisualSpec, { type: 'chart' }>;
    return (
      <ChartDiagram
        title={v.title}
        chartType={v.chartType}
        labels={v.labels ?? []}
        values={v.values ?? []}
        unit={v.unit}
        onExpand={onExpand}
      />
    );
  }

  if (visual.type === 'sketch') {
    const v = visual as Extract<VisualSpec, { type: 'sketch' }>;
    return <SketchDiagram title={v.title} elements={v.elements ?? []} onExpand={onExpand} />;
  }

  if (visual.type === 'image') {
    const v = visual as Extract<VisualSpec, { type: 'image' }>;
    return <ImageVisual prompt={v.prompt} title={v.title} onExpand={onExpand} />;
  }

  if (visual.type === 'infographic') {
    const v = visual as Extract<VisualSpec, { type: 'infographic' }>;
    return <InfographicVisual spec={v} onExpand={onExpand} />;
  }

  // Unknown type — show nothing
  return null;
}
