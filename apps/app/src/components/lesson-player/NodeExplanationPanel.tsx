import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, RefreshCw, Maximize2, X } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { tsToSeconds, formatTime } from '@/components/lesson-player/types';
import type { MindMapNode } from '@/components/lesson-player/types';
import VisualRenderer, { type VisualSpec } from '@/components/lesson-player/VisualRenderer';

type PanelTranscriptLine = {
  time?: string;
  timeText?: string;
  timeSeconds?: number;
  text?: string;
};

type ConceptItem = { label: string; definition?: string };
type RelationItem = { from: string; to: string; type?: string };

type NodeExplanation = {
  sourceQuotes?: string[];
  deepExplanation?: string;
  corePrinciple?: string;
  concepts?: ConceptItem[];
  relations?: RelationItem[];
  examples?: string[];
  insights?: string[];
  visuals?: VisualSpec[];
};

type Props = {
  node: MindMapNode;
  videoTitle?: string;
  transcript?: PanelTranscriptLine[];
  onSeek?: (seconds: number) => void;
  onClose?: () => void;
  onSelectNode?: (node: MindMapNode) => void;
};

function parseLineSeconds(line: PanelTranscriptLine): number | null {
  if (line.timeSeconds != null && Number.isFinite(line.timeSeconds)) return line.timeSeconds;
  const raw = line.timeText || line.time || '';
  const m = /^(\d+):(\d{1,2})$/.exec(raw.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function getRelevantTranscript(lines: PanelTranscriptLine[], nodeSeconds: number | null, limit = 18) {
  if (!lines.length) return [];
  if (nodeSeconds == null) return lines.slice(0, limit).map((l) => ({ t: l.timeText || l.time || '', x: l.text || '' }));

  let closest = 0;
  let minDiff = Infinity;
  lines.forEach((line, i) => {
    const s = parseLineSeconds(line);
    if (s != null) {
      const diff = Math.abs(s - nodeSeconds);
      if (diff < minDiff) { minDiff = diff; closest = i; }
    }
  });

  const half = Math.floor(limit / 2);
  const start = Math.max(0, closest - half);
  const end = Math.min(lines.length, start + limit);
  return lines.slice(start, end).map((l) => ({ t: l.timeText || l.time || '', x: String(l.text || '').slice(0, 220) }));
}

type ExpandedSection = 'explanation' | 'examples' | 'insights' | 'visuals' | null;

export default function NodeExplanationPanel({ node, videoTitle, transcript, onSeek, onClose, onSelectNode }: Props) {
  const [explanation, setExplanation] = useState<NodeExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchExplanation = async (n: MindMapNode) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    let timedOut = false;

    setLoading(true);
    setExplanation(null);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (abortRef.current !== controller) return; // annulé pendant getSession

      const bearerToken = sessionData?.session?.access_token || '';
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      const nodeSeconds = tsToSeconds(n);
      const relevantTranscript = getRelevantTranscript(transcript || [], nodeSeconds);

      const timeoutId = window.setTimeout(() => { timedOut = true; controller.abort(); }, 90_000);

      let res: Response;
      try {
        res = await fetch(`${supabaseUrl}/functions/v1/generate-node-explanation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${bearerToken || supabaseAnonKey}`,
          },
          body: JSON.stringify({
            nodeLabel: n.label,
            nodeSummary: n.summary || '',
            nodeTime: n.time || '',
            videoTitle: videoTitle || '',
            transcript: relevantTranscript,
          }),
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeoutId);
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || `Erreur ${res.status}`);
      }

      const data: NodeExplanation = await res.json();
      if (abortRef.current === controller) setExplanation(data);
    } catch (e: unknown) {
      if (abortRef.current !== controller) return; // requête obsolète (nœud changé) — ignorer
      if (controller.signal.aborted && !timedOut) return; // abort propre (démontage) — ignorer silencieusement
      if (timedOut) {
        setError('Délai dépassé (90s). Vérifiez votre connexion et réessayez.');
      } else {
        setError((e as Error)?.message || String(e));
      }
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  };

  useEffect(() => {
    if (!node) return;
    fetchExplanation(node).catch(() => {}); // empêche unhandled rejection si abort survient
    return () => { abortRef.current?.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  useEffect(() => {
    if (!expandedSection) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpandedSection(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [expandedSection]);

  const nodeSeconds = tsToSeconds(node);

  return (
    <motion.div
      key={node.id}
      initial={{ opacity: 0, x: 40, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.97 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="h-full overflow-auto bg-gradient-to-b from-[#0d1b2a] to-[#0F1419]"
    >
      <div className="p-4 space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-white leading-tight">{node.label}</div>
            {nodeSeconds != null && (
              <div className="text-xs text-[var(--school-accent)] mt-1 flex items-center gap-1">
                <span>⏱</span>
                <span>{formatTime(nodeSeconds)}</span>
              </div>
            )}
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 text-xl leading-none flex-shrink-0 rounded"
            >×</button>
          )}
        </div>

        {/* Seek button */}
        <button
          type="button"
          disabled={nodeSeconds == null || !onSeek}
          onClick={() => { if (nodeSeconds != null && onSeek) { onSeek(nodeSeconds); } }}
          className="w-full flex items-center justify-center gap-2 bg-[var(--school-accent)] text-black font-bold rounded-lg px-3 py-2 text-sm hover:bg-yellow-400 disabled:opacity-40 transition-colors"
        >
          ▶ Aller au temps vidéo
        </button>

        {/* Summary from mindmap (instant, no loading) */}
        {node.summary && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">📋 Résumé</div>
            <p className="text-sm text-gray-200 leading-relaxed">{node.summary}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400 flex-shrink-0" />
            <span className="text-sm text-blue-300">Génération d'une analyse enrichie du sujet…</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 space-y-2">
            <p className="text-sm text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => fetchExplanation(node)}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-200"
            >
              <RefreshCw className="w-3 h-3" /> Réessayer
            </button>
          </div>
        )}

        {/* Rich explanation */}
        {explanation && !loading && (
          <>
            {/* Source Quotes — fidelity verification */}
            {(explanation.sourceQuotes?.length ?? 0) > 0 && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
                <div className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider mb-2">📜 Texte source utilisé</div>
                <ul className="space-y-1.5">
                  {explanation.sourceQuotes!.map((q, i) => (
                    <li key={i} className="text-xs text-amber-100/80 italic border-l-2 border-amber-400/40 pl-2 leading-snug">"{q}"</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Core Principle */}
            {explanation.corePrinciple && (
              <div className="rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_8%,transparent)] px-4 py-3 flex items-start gap-2"
                style={{ background: 'rgba(212,175,55,0.08)' }}>
                <span className="text-[var(--school-accent)] text-base flex-shrink-0">⚡</span>
                <div>
                  <div className="text-[10px] font-semibold text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)] uppercase tracking-wider mb-0.5">Principe fondamental</div>
                  <p className="text-sm font-semibold text-[var(--school-accent)] leading-snug">{explanation.corePrinciple}</p>
                </div>
              </div>
            )}

            {/* Concepts */}
            {(explanation.concepts?.length ?? 0) > 0 && (
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3">
                <div className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wider mb-2">🧠 Concepts clés</div>
                <div className="flex flex-wrap gap-2">
                  {explanation.concepts!.map((c, i) => (
                    <div key={i} className="group relative">
                      <div className="bg-indigo-500/15 border border-indigo-400/30 rounded-lg px-2.5 py-1.5 cursor-default">
                        <div className="text-xs font-semibold text-indigo-200">{c.label}</div>
                        {c.definition && (
                          <div className="text-[10px] text-indigo-300/70 mt-0.5 max-w-[160px] leading-snug">{c.definition}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Relations */}
            {(explanation.relations?.length ?? 0) > 0 && (
              <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-3">
                <div className="text-[10px] font-semibold text-teal-300 uppercase tracking-wider mb-2">🔗 Relations causales</div>
                <div className="flex flex-col gap-1.5">
                  {explanation.relations!.map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs flex-wrap">
                      <span className="bg-teal-500/15 border border-teal-400/30 rounded px-2 py-0.5 text-teal-200 font-medium">{r.from}</span>
                      <span className="text-teal-400/60 font-bold">→</span>
                      {r.type && (
                        <span className="text-[10px] text-teal-400/50 italic">[{r.type}]</span>
                      )}
                      <span className="bg-teal-500/15 border border-teal-400/30 rounded px-2 py-0.5 text-teal-200 font-medium">{r.to}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {explanation.deepExplanation && (
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                <div className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>📖 Explication approfondie</span>
                  <button
                    type="button"
                    onClick={() => setExpandedSection('explanation')}
                    title="Agrandir"
                    className="flex-shrink-0 text-blue-300/50 hover:text-blue-200 hover:bg-blue-500/20 rounded p-0.5 transition-colors"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-line line-clamp-6">{explanation.deepExplanation}</p>
              </div>
            )}

            {(explanation.examples?.length ?? 0) > 0 && (
              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3">
                <div className="text-[10px] font-semibold text-yellow-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>💡 Exemples concrets</span>
                  <button
                    type="button"
                    onClick={() => setExpandedSection('examples')}
                    title="Agrandir"
                    className="flex-shrink-0 text-yellow-300/50 hover:text-yellow-200 hover:bg-yellow-500/20 rounded p-0.5 transition-colors"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <ol className="space-y-2">
                  {explanation.examples!.slice(0, 3).map((ex, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-200">
                      <span className="text-yellow-400 font-bold flex-shrink-0">{i + 1}.</span>
                      <span>{ex}</span>
                    </li>
                  ))}
                  {(explanation.examples!.length > 3) && (
                    <li className="text-xs text-yellow-300/60 pl-5">+{explanation.examples!.length - 3} autres…</li>
                  )}
                </ol>
              </div>
            )}

            {(explanation.insights?.length ?? 0) > 0 && (
              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
                <div className="text-[10px] font-semibold text-green-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>✨ Points clés</span>
                  <button
                    type="button"
                    onClick={() => setExpandedSection('insights')}
                    title="Agrandir"
                    className="flex-shrink-0 text-green-300/50 hover:text-green-200 hover:bg-green-500/20 rounded p-0.5 transition-colors"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <ul className="space-y-1.5">
                  {explanation.insights!.slice(0, 4).map((ins, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-200">
                      <span className="text-green-400 mt-0.5 flex-shrink-0">•</span>
                      <span>{ins}</span>
                    </li>
                  ))}
                  {(explanation.insights!.length > 4) && (
                    <li className="text-xs text-green-300/60 pl-5">+{explanation.insights!.length - 4} autres…</li>
                  )}
                </ul>
              </div>
            )}

            {(explanation.visuals?.length ?? 0) > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-purple-300 uppercase tracking-wider mb-2 px-0.5 flex items-center justify-between">
                  <span>🎨 Visualisations</span>
                  <button
                    type="button"
                    onClick={() => setExpandedSection('visuals')}
                    title="Agrandir"
                    className="flex-shrink-0 text-purple-300/50 hover:text-purple-200 hover:bg-purple-500/20 rounded p-0.5 transition-colors"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-3">
                  {explanation.visuals!.map((v, i) => (
                    <VisualRenderer key={i} visual={v as VisualSpec | string} onExpand={() => setExpandedSection('visuals')} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Full-screen expanded section overlay ── */}
        <AnimatePresence>
          {expandedSection && explanation && (
            <motion.div
              key="expand-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[250] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
              onClick={() => setExpandedSection(null)}
            >
              <motion.div
                initial={{ scale: 0.96, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.96, y: 12 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                className="w-full max-w-3xl max-h-[88vh] bg-[#0d1b2a] border border-white/15 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-black/30 flex-shrink-0">
                  <span className="font-semibold text-sm text-white">
                    {expandedSection === 'explanation' && '📖 Explication approfondie'}
                    {expandedSection === 'examples' && '💡 Exemples concrets'}
                    {expandedSection === 'insights' && '✨ Points clés'}
                    {expandedSection === 'visuals' && '🎨 Visualisations'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpandedSection(null)}
                    className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    title="Fermer (ESC)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {/* Content */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 min-w-0">
                  {expandedSection === 'explanation' && (
                    <p className="text-base text-gray-100 leading-relaxed whitespace-pre-line">{explanation.deepExplanation}</p>
                  )}
                  {expandedSection === 'examples' && (
                    <ol className="space-y-4">
                      {explanation.examples?.map((ex, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="text-yellow-400 font-bold text-base flex-shrink-0 mt-0.5">{i + 1}.</span>
                          <span className="text-base text-gray-100 leading-relaxed">{ex}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  {expandedSection === 'insights' && (
                    <ul className="space-y-3">
                      {explanation.insights?.map((ins, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="text-green-400 text-lg flex-shrink-0 mt-0.5">•</span>
                          <span className="text-base text-gray-100 leading-relaxed">{ins}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {expandedSection === 'visuals' && (
                    <div className="space-y-5">
                      {explanation.visuals?.map((v, i) => (
                        <VisualRenderer key={i} visual={v as VisualSpec | string} />
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sub-topics */}
        {Array.isArray(node.children) && node.children.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">🔗 Sous-thèmes</div>
            <div className="space-y-1">
              {node.children.map((c) => {
                const cs = tsToSeconds(c);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left rounded-lg border border-white/10 px-3 py-2 hover:bg-white/10 transition-colors"
                    onClick={() => {
                      if (onSelectNode) onSelectNode(c);
                      if (cs != null && onSeek) onSeek(cs);
                    }}
                  >
                    <div className="text-sm text-white font-medium">{c.label}</div>
                    {cs != null && <div className="text-xs text-gray-400">{formatTime(cs)}</div>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
