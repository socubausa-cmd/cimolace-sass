import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import AgentStatusCard from '@/components/orchestrator/AgentStatusCard';
import PipelineTimeline from '@/components/orchestrator/PipelineTimeline';
import LiveLogsPanel from '@/components/orchestrator/LiveLogsPanel';
import ChapterProgressBoard from '@/components/orchestrator/ChapterProgressBoard';
import ChapterGanttLive from '@/components/orchestrator/ChapterGanttLive';
import { useOrchestratorLiveStore } from '@/stores/orchestrator-live.store';

export default function OrchestratorLiveDashboardPage() {
  const [rawText, setRawText] = useState('');
  const [focusedAgent, setFocusedAgent] = useState('all');
  const {
    projectId,
    agents,
    chapters,
    logs,
    status,
    queue,
    selectedChapterId,
    startProject,
    selectChapter,
    stopPolling,
  } = useOrchestratorLiveStore();

  const filteredLogs = useMemo(() => {
    if (focusedAgent === 'all') return logs;
    const agentHints = {
      coach: ['coach', 'masterclass'],
      visual: ['visual'],
      smartboard: ['smartboard', 'slide'],
      quality: ['quality', 'valid'],
    };
    const hints = agentHints[focusedAgent] || [];
    return logs.filter((entry) => hints.some((hint) => String(entry || '').toLowerCase().includes(hint)));
  }, [focusedAgent, logs]);

  const focusedAgentData = useMemo(() => {
    if (focusedAgent === 'all') return null;
    return agents.find((agent) => agent.id === focusedAgent) || null;
  }, [focusedAgent, agents]);

  const stats = useMemo(() => {
    const slidesGenerated = chapters.reduce((acc, c) => acc + Number(c.slides_count || 0), 0);
    const slidesValidated = chapters.filter((c) => c.status === 'completed').reduce((acc, c) => acc + Number(c.slides_count || 0), 0);
    return {
      chapters: chapters.length,
      slidesGenerated,
      slidesValidated,
      queue: (queue.coach_queue?.length || 0) + (queue.visual_queue?.length || 0) + (queue.smartboard_queue?.length || 0) + (queue.quality_queue?.length || 0),
    };
  }, [chapters, queue]);

  return (
    <main className="min-h-[100dvh] bg-[radial-gradient(80%_60%_at_50%_0%,rgba(124,58,237,0.18),transparent_70%),#070b14] p-4 text-white">
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-0 opacity-55"
        animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
        transition={{ duration: 24, repeat: Infinity, repeatType: 'reverse', ease: 'linear' }}
        style={{
          backgroundImage:
            'radial-gradient(40% 30% at 20% 10%, rgba(124,58,237,0.18), transparent 70%), radial-gradient(35% 25% at 80% 20%, rgba(34,211,238,0.14), transparent 75%), radial-gradient(30% 25% at 60% 85%, rgba(251,191,36,0.12), transparent 75%)',
          backgroundSize: '140% 140%',
        }}
      />
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl">
          <p className="text-sm font-semibold">LIRI Orchestrator Live Dashboard</p>
          <p className="mt-1 text-xs text-white/65">Agents IA en parallel, pipeline vivant, logs temps reel.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={2}
              className="min-w-[320px] flex-1 rounded-xl border border-white/15 bg-black/25 p-2 text-xs text-white"
              placeholder="Collez un texte brut pour demarrer l'orchestrateur..."
            />
            <button
              type="button"
              onClick={() => startProject(rawText)}
              className="rounded-xl border border-violet-300/40 bg-violet-500/20 px-4 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/30"
            >
              Demarrer
            </button>
            <button
              type="button"
              onClick={stopPolling}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs"
            >
              Stop
            </button>
          </div>
          <p className="mt-2 text-[11px] text-cyan-200/70">projectId: {projectId || '—'} · status: {status}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[300px_1fr_360px]">
          <section className="space-y-2">
            <div className="mb-1 flex flex-wrap gap-1">
              {['all', 'coach', 'visual', 'smartboard', 'quality'].map((agent) => (
                <button
                  key={agent}
                  type="button"
                  onClick={() => setFocusedAgent(agent)}
                  className={`rounded-full border px-2 py-0.5 text-[10px] ${
                    focusedAgent === agent
                      ? 'border-cyan-300/50 bg-cyan-500/20 text-cyan-100'
                      : 'border-white/15 bg-white/5 text-white/70'
                  }`}
                >
                  {agent === 'all' ? 'Tous' : agent}
                </button>
              ))}
            </div>
            {agents.map((agent) => (
              <AgentStatusCard
                key={agent.id}
                {...agent}
                isFocused={focusedAgent === 'all' || focusedAgent === agent.id}
                onClick={() => setFocusedAgent((prev) => (prev === agent.id ? 'all' : agent.id))}
              />
            ))}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-200/80">Agent Details</p>
              {focusedAgentData ? (
                <div className="space-y-1.5 text-[11px] text-white/75">
                  <p><span className="text-white/50">Agent:</span> {focusedAgentData.name}</p>
                  <p><span className="text-white/50">Status:</span> {focusedAgentData.status}</p>
                  <p><span className="text-white/50">Task:</span> {focusedAgentData.currentTask}</p>
                  <p><span className="text-white/50">Progress:</span> {focusedAgentData.progress}%</p>
                  <p><span className="text-white/50">Jobs:</span> {focusedAgentData.jobsProcessed}</p>
                  <p><span className="text-white/50">Erreurs:</span> {focusedAgentData.error || 'aucune'}</p>
                </div>
              ) : (
                <div className="space-y-1.5 text-[11px] text-white/75">
                  <p><span className="text-white/50">Vue:</span> Tous les agents</p>
                  <p><span className="text-white/50">Actifs:</span> {agents.filter((a) => a.status === 'running').length}</p>
                  <p><span className="text-white/50">Completed:</span> {agents.filter((a) => a.status === 'completed').length}</p>
                  <p><span className="text-white/50">Failed:</span> {agents.filter((a) => a.status === 'failed').length}</p>
                  <p><span className="text-white/50">Jobs traités:</span> {agents.reduce((acc, a) => acc + Number(a.jobsProcessed || 0), 0)}</p>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <PipelineTimeline status={status} />
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <StatChip label="Chapitres" value={stats.chapters} />
              <StatChip label="Slides generes" value={stats.slidesGenerated} />
              <StatChip label="Slides valides" value={stats.slidesValidated} />
              <StatChip label="Queue attente" value={stats.queue} />
            </div>
            <ChapterGanttLive chapters={chapters} />
            <ChapterProgressBoard chapters={chapters} selectedChapterId={selectedChapterId} onSelect={selectChapter} />
          </section>

          <section className="space-y-3">
            <LiveLogsPanel logs={filteredLogs} />
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-[11px] text-white/70">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/65">Stats Live</p>
              <p>Coach queue: {queue.coach_queue?.length || 0}</p>
              <p>Visual queue: {queue.visual_queue?.length || 0}</p>
              <p>SmartBoard queue: {queue.smartboard_queue?.length || 0}</p>
              <p>Quality queue: {queue.quality_queue?.length || 0}</p>
              <p className="mt-1 text-cyan-200/70">Temps estime: {Math.max(1, stats.chapters * 2)} min</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function StatChip({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[11px] text-white/60">{label}</p>
    </div>
  );
}
