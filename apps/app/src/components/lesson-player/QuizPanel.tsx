import React, { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, ChevronRight, Trophy, RotateCcw, Lock } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { MindMapNode } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────
interface QuizQuestion {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  difficulty: 'facile' | 'moyen' | 'difficile';
}

interface NodeQuizState {
  status: 'idle' | 'loading' | 'ready' | 'answered' | 'error';
  quiz?: QuizQuestion;
  selectedIndex?: number;
  error?: string;
}

interface Props {
  nodes: MindMapNode[];
  videoTitle?: string;
  unlocked: boolean;
}

// ── Flatten all nodes ─────────────────────────────────────────────────────────
function flattenNodes(root: MindMapNode): MindMapNode[] {
  const result: MindMapNode[] = [];
  const walk = (n: MindMapNode) => {
    result.push(n);
    (n.children || []).forEach(walk);
  };
  walk(root);
  return result;
}

// ── Difficulty badge ──────────────────────────────────────────────────────────
const DIFF_COLORS: Record<string, string> = {
  facile: 'bg-green-500/20 text-green-300 border-green-500/30',
  moyen:  'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  difficile: 'bg-red-500/20 text-red-300 border-red-500/30',
};

// ── Single quiz card ──────────────────────────────────────────────────────────
function QuizCard({
  node,
  state,
  onGenerate,
  onAnswer,
  index,
  total,
}: {
  node: MindMapNode;
  state: NodeQuizState;
  onGenerate: () => void;
  onAnswer: (idx: number) => void;
  index: number;
  total: number;
}) {
  const isAnswered = state.status === 'answered';
  const isCorrect = isAnswered && state.selectedIndex === state.quiz?.correctIndex;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-xl border overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0d1b2a 0%, #0a1220 100%)',
        borderColor: isAnswered
          ? isCorrect ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'
          : 'rgba(212,175,55,0.2)',
      }}
    >
      {/* Card header */}
      <div
        className="px-4 py-2 flex items-center justify-between gap-2"
        style={{ background: 'rgba(212,175,55,0.07)', borderBottom: '1px solid rgba(212,175,55,0.1)' }}
      >
        <span className="text-xs font-bold text-[#D4AF37] truncate">
          {index + 1}/{total} — {node.label}
        </span>
        {state.quiz?.difficulty && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${DIFF_COLORS[state.quiz.difficulty] || ''}`}>
            {state.quiz.difficulty}
          </span>
        )}
        {isAnswered && (
          <span className="flex-shrink-0">
            {isCorrect
              ? <CheckCircle2 className="w-4 h-4 text-green-400" />
              : <XCircle className="w-4 h-4 text-red-400" />}
          </span>
        )}
      </div>

      <div className="p-4">
        {/* Idle */}
        {state.status === 'idle' && (
          <button
            type="button"
            onClick={onGenerate}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-purple-300 border border-purple-500/30 hover:bg-purple-500/10 transition-colors"
          >
            <ChevronRight className="w-4 h-4" /> Générer la question
          </button>
        )}

        {/* Loading */}
        {state.status === 'loading' && (
          <div className="flex items-center justify-center gap-2 py-3 text-gray-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Génération en cours…
          </div>
        )}

        {/* Error */}
        {state.status === 'error' && (
          <div className="flex flex-col items-center gap-2 py-2">
            <p className="text-xs text-red-400">{state.error}</p>
            <button type="button" onClick={onGenerate} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
              <RotateCcw className="w-3 h-3" /> Réessayer
            </button>
          </div>
        )}

        {/* Ready / Answered */}
        {(state.status === 'ready' || state.status === 'answered') && state.quiz && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-white leading-relaxed">{state.quiz.question}</p>
            <div className="grid grid-cols-1 gap-2">
              {state.quiz.choices.map((choice, ci) => {
                const isSelected = state.selectedIndex === ci;
                const isRight = ci === state.quiz!.correctIndex;
                let btnStyle = 'border-white/10 text-gray-300 hover:border-white/30 hover:text-white';
                if (isAnswered) {
                  if (isRight) btnStyle = 'border-green-500/60 bg-green-500/10 text-green-300';
                  else if (isSelected && !isRight) btnStyle = 'border-red-500/60 bg-red-500/10 text-red-300';
                  else btnStyle = 'border-white/5 text-gray-600';
                } else if (isSelected) {
                  btnStyle = 'border-[#D4AF37]/60 bg-[#D4AF37]/10 text-[#D4AF37]';
                }
                return (
                  <button
                    key={ci}
                    type="button"
                    disabled={isAnswered}
                    onClick={() => onAnswer(ci)}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-xs leading-relaxed transition-all ${btnStyle} disabled:cursor-default`}
                  >
                    <span className="font-bold mr-1">{['A', 'B', 'C', 'D'][ci]}.</span> {choice}
                  </button>
                );
              })}
            </div>
            {isAnswered && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg p-3 text-xs leading-relaxed"
                style={{ background: isCorrect ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${isCorrect ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}
              >
                <span className="font-bold" style={{ color: isCorrect ? '#86efac' : '#fca5a5' }}>
                  {isCorrect ? '✓ Correct !' : '✗ Incorrect.'}
                </span>{' '}
                <span className="text-gray-300">{state.quiz.explanation}</span>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main QuizPanel ────────────────────────────────────────────────────────────
const QuizPanel: React.FC<Props> = ({ nodes, videoTitle, unlocked }) => {
  const allNodes = nodes.length > 0 ? flattenNodes(nodes[0]) : [];
  const [quizStates, setQuizStates] = useState<Record<string, NodeQuizState>>({});
  const [allGenerated, setAllGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);

  const updateState = useCallback((nodeId: string, patch: Partial<NodeQuizState>) => {
    setQuizStates((prev) => ({ ...prev, [nodeId]: { ...(prev[nodeId] || { status: 'idle' }), ...patch } }));
  }, []);

  const generateForNode = useCallback(async (node: MindMapNode) => {
    updateState(node.id, { status: 'loading', error: undefined });
    try {
      const { data, error } = await (supabase as any).functions.invoke('generate-quiz', {
        body: {
          nodeLabel: node.label,
          nodeSummary: node.summary || '',
          videoTitle: videoTitle || '',
          nodeExplanation: node.explanation || '',
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      updateState(node.id, { status: 'ready', quiz: data as QuizQuestion });
    } catch (e) {
      updateState(node.id, { status: 'error', error: String((e as Error)?.message || 'Erreur') });
    }
  }, [updateState, videoTitle]);

  const generateAll = useCallback(async () => {
    setGenerating(true);
    await Promise.all(allNodes.map((n) => generateForNode(n)));
    setAllGenerated(true);
    setGenerating(false);
  }, [allNodes, generateForNode]);

  const answerNode = useCallback((nodeId: string, idx: number) => {
    setQuizStates((prev) => {
      const s = prev[nodeId];
      if (!s || s.status !== 'ready') return prev;
      return { ...prev, [nodeId]: { ...s, status: 'answered', selectedIndex: idx } };
    });
  }, []);

  // Score
  const answeredStates = Object.values(quizStates).filter((s) => s.status === 'answered');
  const correctCount = answeredStates.filter((s) => s.selectedIndex === s.quiz?.correctIndex).length;
  const scorePercent = answeredStates.length > 0 ? Math.round((correctCount / answeredStates.length) * 100) : null;
  const allAnswered = answeredStates.length === allNodes.length && allNodes.length > 0;

  if (!unlocked) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
        <Lock className="w-12 h-12 text-gray-600" />
        <div>
          <p className="text-sm font-semibold text-gray-400">Quiz verrouillé</p>
          <p className="text-xs text-gray-600 mt-1 max-w-[260px]">
            Explore tous les nœuds de la mindmap pour débloquer les questions de révision.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#D4AF37]" /> Quiz de révision
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{allNodes.length} questions · {answeredStates.length} répondues</div>
        </div>
        <div className="flex items-center gap-2">
          {scorePercent !== null && (
            <div className={`text-sm font-bold px-3 py-1 rounded-full ${scorePercent >= 70 ? 'bg-green-500/20 text-green-300' : scorePercent >= 40 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300'}`}>
              {scorePercent}%
            </div>
          )}
          {!allGenerated && (
            <button
              type="button"
              onClick={generateAll}
              disabled={generating}
              className="flex items-center gap-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
              Tout générer
            </button>
          )}
        </div>
      </div>

      {/* Score banner */}
      <AnimatePresence>
        {allAnswered && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex-shrink-0 px-4 py-3 text-center"
            style={{ background: scorePercent! >= 70 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
          >
            <p className="text-sm font-bold text-white">
              {scorePercent! >= 70 ? '🎉 Excellent !' : scorePercent! >= 40 ? '👍 Pas mal !' : '📚 Révise encore !'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Score final : {correctCount}/{allNodes.length} — {scorePercent}%
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {allNodes.map((node, i) => (
          <QuizCard
            key={node.id}
            node={node}
            state={quizStates[node.id] || { status: 'idle' }}
            onGenerate={() => generateForNode(node)}
            onAnswer={(idx) => answerNode(node.id, idx)}
            index={i}
            total={allNodes.length}
          />
        ))}
      </div>
    </div>
  );
};

export default QuizPanel;
