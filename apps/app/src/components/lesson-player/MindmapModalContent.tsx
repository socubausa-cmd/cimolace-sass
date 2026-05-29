import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, RefreshCw } from 'lucide-react';

import MindMapNavigation from '@/components/lesson-player/MindMapNavigation';
import VisualRenderer from '@/components/lesson-player/VisualRenderer';
import { DraggablePanelLayout } from '@/components/lesson-player/dnd/DraggablePanelLayout';
import { useNodeExplanation } from '@/components/lesson-player/useNodeExplanation';
import { formatTime, tsToSeconds } from '@/components/lesson-player/types';
import type { MindMapNode } from '@/components/lesson-player/types';

const NOOP_SEEK = (_s: number) => {};  // fallback when onSeek not provided

// ── Types ─────────────────────────────────────────────────────────────────────

type TranscriptLine = {
  time?: string;
  timeText?: string;
  timeSeconds?: number;
  text?: string;
};

interface Props {
  mindmap: MindMapNode | null;
  selectedNode: MindMapNode | null;
  videoTitle?: string;
  transcript?: TranscriptLine[];
  onSeek?: (seconds: number) => void;
  onSelectNode?: (node: MindMapNode) => void;
  onCloseNode?: () => void;
}

// ── Panel content components ───────────────────────────────────────────────────

function MindmapPanel({
  mindmap,
  onSeek,
  onSelectNode,
  selectedNodeId,
}: {
  mindmap: MindMapNode | null;
  onSeek: (s: number) => void;
  onSelectNode?: (n: MindMapNode) => void;
  selectedNodeId?: string | null;
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <MindMapNavigation
        mindmap={mindmap}
        onSeek={onSeek}
        onSelectNode={onSelectNode}
        selectedNodeId={selectedNodeId || null}
        hideLabel
      />
    </div>
  );
}

function SummaryPanel({
  node,
  onSeek,
}: {
  node: MindMapNode | null;
  onSeek?: (s: number) => void;
}) {
  if (!node) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-gray-500 p-4 text-center">
        Sélectionne un nœud sur la mindmap pour voir le résumé.
      </div>
    );
  }

  const nodeSeconds = tsToSeconds(node);
  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      <div>
        <div className="font-semibold text-sm text-white leading-tight">{node.label}</div>
        {nodeSeconds != null && (
          <div className="text-xs text-[#D4AF37] mt-0.5 flex items-center gap-1">
            <span>⏱</span>
            <span>{formatTime(nodeSeconds)}</span>
          </div>
        )}
      </div>

      {onSeek && nodeSeconds != null && (
        <button
          type="button"
          onClick={() => onSeek(nodeSeconds)}
          className="w-full flex items-center justify-center gap-2 bg-[#D4AF37] text-black font-bold rounded-lg px-3 py-2 text-xs hover:bg-yellow-400 transition-colors"
        >
          ▶ Aller au temps vidéo
        </button>
      )}

      {node.summary ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">📋 Résumé</div>
          <p className="text-sm text-gray-200 leading-relaxed">{node.summary}</p>
        </div>
      ) : (
        <div className="text-xs text-gray-500 italic">Aucun résumé disponible pour ce nœud.</div>
      )}
    </div>
  );
}

function KeyPointsPanel({
  loading,
  error,
  examples,
  insights,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  examples?: string[];
  insights?: string[];
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-blue-300">
        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
        <span>Analyse en cours…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-3 space-y-2">
        <p className="text-xs text-red-300">{error}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-200">
            <RefreshCw className="w-3 h-3" /> Réessayer
          </button>
        )}
      </div>
    );
  }
  if (!insights?.length && !examples?.length) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-gray-500 p-4 text-center">
        Sélectionne un nœud pour voir les points clés.
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      {(insights?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
          <div className="text-[10px] font-semibold text-green-300 uppercase tracking-wider mb-2">✨ Points clés</div>
          <ul className="space-y-1.5">
            {insights!.map((ins, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-200">
                <span className="text-green-400 mt-0.5 flex-shrink-0">•</span>
                <span>{ins}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(examples?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3">
          <div className="text-[10px] font-semibold text-yellow-300 uppercase tracking-wider mb-2">💡 Exemples concrets</div>
          <ol className="space-y-2">
            {examples!.map((ex, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-200">
                <span className="text-yellow-400 font-bold flex-shrink-0">{i + 1}.</span>
                <span>{ex}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function ExplanationPanel({
  loading,
  error,
  deepExplanation,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  deepExplanation?: string;
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-blue-300">
        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
        <span>Génération de l'explication…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-3 space-y-2">
        <p className="text-xs text-red-300">{error}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-200">
            <RefreshCw className="w-3 h-3" /> Réessayer
          </button>
        )}
      </div>
    );
  }
  if (!deepExplanation) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-gray-500 p-4 text-center">
        Sélectionne un nœud pour voir l'explication approfondie.
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
        <div className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider mb-2">📖 Explication approfondie</div>
        <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-line">{deepExplanation}</p>
      </div>
    </div>
  );
}

function VisualsPanel({
  loading,
  error,
  visuals,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  visuals?: unknown[];
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-blue-300">
        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
        <span>Préparation des visuels…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-3 space-y-2">
        <p className="text-xs text-red-300">{error}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-200">
            <RefreshCw className="w-3 h-3" /> Réessayer
          </button>
        )}
      </div>
    );
  }
  if (!visuals?.length) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-gray-500 p-4 text-center">
        Sélectionne un nœud pour voir les visualisations.
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      {visuals.map((v, i) => (
        <VisualRenderer key={i} visual={v as Parameters<typeof VisualRenderer>[0]['visual']} />
      ))}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function MindmapModalContent({
  mindmap,
  selectedNode,
  videoTitle,
  transcript,
  onSeek,
  onSelectNode,
  onCloseNode: _onCloseNode,
}: Props) {
  const { data, loading, error, refetch } = useNodeExplanation(selectedNode, videoTitle, transcript);

  const panels = useMemo(() => ({
    mindmap: (
      <MindmapPanel
        mindmap={mindmap}
        onSeek={onSeek ?? NOOP_SEEK}
        onSelectNode={onSelectNode}
        selectedNodeId={selectedNode?.id ?? null}
      />
    ),
    summary: <SummaryPanel node={selectedNode} onSeek={onSeek} />,
    keypoints: (
      <KeyPointsPanel
        loading={loading}
        error={error}
        insights={data?.insights}
        examples={data?.examples}
        onRetry={refetch}
      />
    ),
    explanation: (
      <ExplanationPanel
        loading={loading}
        error={error}
        deepExplanation={data?.deepExplanation}
        onRetry={refetch}
      />
    ),
    visuals: (
      <VisualsPanel
        loading={loading}
        error={error}
        visuals={data?.visuals}
        onRetry={refetch}
      />
    ),
  }), [mindmap, selectedNode, onSeek, onSelectNode, loading, error, data, refetch]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="dnd-layout"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="h-full"
      >
        <DraggablePanelLayout
          panels={panels}
          storageKey="mindmap-panel-layout"
        />
      </motion.div>
    </AnimatePresence>
  );
}
