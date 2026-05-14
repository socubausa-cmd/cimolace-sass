import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  name?: string;
  status?: 'idle' | 'running' | 'completed' | 'failed';
  progress?: number;
  currentTask?: string;
  jobsProcessed?: number;
  error?: string | null;
  agent?: any;
  isFocused?: boolean;
  onClick?: () => void;
}

export function AgentStatusCard({
  name,
  status,
  progress,
  currentTask,
  jobsProcessed,
  error,
  agent,
  isFocused = false,
  onClick,
}: Props) {
  const resolvedName = agent?.name ?? name ?? 'Agent';
  const resolvedStatus = (agent?.status ?? status ?? 'idle') as 'idle' | 'running' | 'completed' | 'failed';
  const resolvedProgress = Number(agent?.progress ?? progress ?? 0);
  const resolvedTask = agent?.currentTask ?? currentTask ?? 'En attente';
  const resolvedJobs = Number(agent?.jobsDone ?? agent?.jobsProcessed ?? jobsProcessed ?? 0);
  const resolvedError = agent?.error ?? error ?? null;

  const tone =
    resolvedStatus === 'completed'
      ? 'border-emerald-400/40'
      : resolvedStatus === 'failed'
      ? 'border-red-400/40'
      : resolvedStatus === 'running'
      ? 'border-violet-400/40'
      : 'border-white/15';

  const glow =
    resolvedStatus === 'running'
      ? 'shadow-[0_0_32px_-10px_rgba(124,58,237,0.8)]'
      : resolvedStatus === 'completed'
      ? 'shadow-[0_0_24px_-12px_rgba(16,185,129,0.7)]'
      : resolvedStatus === 'failed'
      ? 'shadow-[0_0_24px_-12px_rgba(239,68,68,0.7)]'
      : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClick}
      className={`rounded-2xl border bg-white/[0.04] p-3 backdrop-blur-xl ${tone} ${glow} ${isFocused ? 'ring-1 ring-cyan-300/45' : ''} ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-white">{resolvedName}</p>
        <div className={`rounded-full px-2 py-0.5 text-[10px] ${resolvedStatus === 'running' ? 'bg-violet-500/20 text-violet-100 animate-pulse' : 'bg-white/10 text-white/80'}`}>
          {resolvedStatus}
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-400"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(resolvedProgress, 100))}%` }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        />
      </div>
      <p className="mt-2 text-[10px] text-white/65">{resolvedTask}</p>
      <div className="mt-2 flex items-center justify-between text-[10px] text-white/70">
        <span>{resolvedProgress}%</span>
        <span>{resolvedJobs} jobs</span>
      </div>
      {resolvedStatus === 'running' ? <Loader2 className="mt-2 h-3.5 w-3.5 animate-spin text-violet-300" /> : null}
      {resolvedStatus === 'completed' ? <CheckCircle2 className="mt-2 h-3.5 w-3.5 text-emerald-300" /> : null}
      {resolvedStatus === 'failed' ? <AlertTriangle className="mt-2 h-3.5 w-3.5 text-red-300" /> : null}
      {resolvedError ? <p className="mt-2 text-[10px] text-red-300">{resolvedError}</p> : null}
    </motion.div>
  );
}

export default AgentStatusCard;
