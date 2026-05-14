/**
 * Orchestrator Live V2 — Dashboard monitoring 4 agents IA, UI premium
 * Surveille en temps réel : Coach · Visual · SmartBoard · Quality
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Activity, Brain, Eye, LayoutTemplate, CheckSquare,
  ArrowLeft, Play, Square, ChevronRight, Circle,
  Loader2, AlertCircle, Clock, Layers, BarChart2,
  Terminal, Filter,
} from 'lucide-react';
import { useOrchestratorLiveStore } from '@/stores/orchestrator-live.store';

const BG      = '#080c14';
const SURFACE = '#0f1520';
const PANEL   = '#141c2d';
const BORDER  = '#1e2a40';
const GOLD    = '#D4AF37';

// ─── Config des 4 agents ─────────────────────────────────────────────────
const AGENTS = [
  { id: 'coach',      label: 'Coach',      icon: Brain,         color: '#a78bfa', desc: 'Pipeline pédagogique' },
  { id: 'visual',     label: 'Visual',     icon: Eye,           color: '#38bdf8', desc: 'Génération images'    },
  { id: 'smartboard', label: 'SmartBoard', icon: LayoutTemplate, color: GOLD,     desc: 'Design slides'       },
  { id: 'quality',    label: 'Quality',    icon: CheckSquare,   color: '#34d399', desc: 'Validation & score'  },
];

const STATUS_META = {
  idle:      { label: 'En attente', color: '#475569', dot: '#475569' },
  running:   { label: 'En cours',   color: '#38bdf8', dot: '#38bdf8' },
  completed: { label: 'Terminé',    color: '#22c55e', dot: '#22c55e' },
  error:     { label: 'Erreur',     color: '#f87171', dot: '#f87171' },
};

// ─── Agent Status Card ────────────────────────────────────────────────────
function AgentCard({ agent, data, active, onClick }) {
  const Icon = agent.icon;
  const status = STATUS_META[data?.status ?? 'idle'];
  const progress = data?.progress ?? 0;

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      className="rounded-2xl p-5 text-left transition-all w-full"
      style={{
        background: active ? `${agent.color}10` : PANEL,
        border: `1px solid ${active ? agent.color + '40' : BORDER}`,
        boxShadow: active ? `0 0 24px ${agent.color}15` : 'none',
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: `${agent.color}15`, border: `1px solid ${agent.color}25` }}>
            <Icon size={16} style={{ color: agent.color }} />
          </div>
          <div>
            <p className="text-white font-bold text-sm">{agent.label}</p>
            <p className="text-slate-500 text-[10px]">{agent.desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Circle size={6} style={{ color: status.dot, fill: status.dot }} />
          <span className="text-[10px] font-medium" style={{ color: status.color }}>{status.label}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full mb-3" style={{ background: '#1e2a40' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: agent.color, width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <p className="text-slate-500">Jobs traités</p>
          <p className="text-slate-300 font-semibold">{data?.jobsProcessed ?? 0}</p>
        </div>
        <div>
          <p className="text-slate-500">File d'attente</p>
          <p className="text-slate-300 font-semibold">{data?.queueSize ?? 0}</p>
        </div>
      </div>

      {data?.currentTask && (
        <p className="mt-3 text-[10px] text-slate-500 truncate border-t pt-2" style={{ borderColor: BORDER }}>
          ▸ {data.currentTask}
        </p>
      )}
    </motion.button>
  );
}

// ─── Chapter Progress Grid ────────────────────────────────────────────────
function ChapterGrid({ chapters, selectedId, onSelect }) {
  if (!chapters?.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
      <Layers size={24} />
      <p className="text-sm">Aucun chapitre généré</p>
    </div>
  );

  const statusColor = { pending: '#334155', running: '#38bdf8', completed: '#22c55e', error: '#f87171' };

  return (
    <div className="grid grid-cols-2 gap-2">
      {chapters.map((ch, i) => {
        const chId = ch.chapter_id ?? ch.id ?? i;
        return (
        <button key={chId}
          onClick={() => onSelect(chId)}
          className="rounded-xl p-3 text-left transition-all hover:scale-[1.01]"
          style={{
            background: selectedId === chId ? `${GOLD}10` : PANEL,
            border: `1px solid ${selectedId === chId ? GOLD + '40' : BORDER}`,
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500">CH {i + 1}</span>
            <Circle size={6} style={{ color: statusColor[ch.status] ?? '#334155', fill: statusColor[ch.status] ?? '#334155' }} />
          </div>
          <p className="text-slate-300 text-xs font-medium truncate">{ch.title}</p>
          {ch.slides_count > 0 && (
            <p className="text-slate-500 text-[10px] mt-1">{ch.slides_count} slides</p>
          )}
        </button>
        );
      })}
    </div>
  );
}

// ─── Live Logs ────────────────────────────────────────────────────────────
function LiveLogs({ logs, filter }) {
  const filtered = filter === 'all'
    ? logs
    : logs.filter(l => l.agent === filter || l.message?.toLowerCase().includes(filter));

  const levelColor = { info: '#38bdf8', warn: '#fbbf24', error: '#f87171', success: '#22c55e' };

  return (
    <div className="space-y-1 font-mono text-[11px]">
      {filtered.length === 0 && (
        <p className="text-slate-500 italic py-4 text-center">Aucun log</p>
      )}
      {[...filtered].reverse().slice(0, 60).map((log, i) => (
        <div key={i} className="flex items-start gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: '#0b1018', borderLeft: `2px solid ${levelColor[log.level] ?? '#334155'}` }}>
          <span className="text-slate-500 shrink-0 mt-0.5">
            {new Date(log.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className="font-bold shrink-0 w-20 truncate"
            style={{ color: AGENTS.find(a => a.id === log.agent)?.color ?? '#64748b' }}>
            {log.agent ?? '—'}
          </span>
          <span className="text-slate-400 break-all leading-snug">{log.message}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Stats strip ──────────────────────────────────────────────────────────
function StatPill({ label, value, color }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-xl"
      style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
      <div className="w-1.5 h-6 rounded-full" style={{ background: color }} />
      <div>
        <p className="text-lg font-bold text-white">{value}</p>
        <p className="text-[10px] text-slate-500">{label}</p>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────
export default function OrchestratorLiveV2() {
  const navigate = useNavigate();
  const store = useOrchestratorLiveStore?.() ?? {};

  const {
    status = 'idle',
    chapters = [],
    logs = [],
    queue = {},
    selectedChapterId,
    setSelectedChapterId,
    startProject,
    stopProject,
  } = store;

  const [rawText, setRawText] = useState('');
  const [activeAgent, setActiveAgent] = useState(null);
  const [logFilter, setLogFilter] = useState('all');

  const totalSlides    = chapters.reduce((s, c) => s + (c.slides_count ?? 0), 0);
  const completedCh    = chapters.filter(c => c.status === 'completed').length;
  // queue values are arrays (from INITIAL_QUEUE) — use .length to count items
  const totalQueue     = Object.values(queue).reduce((s, v) => s + (Array.isArray(v) ? v.length : (v ?? 0)), 0);
  const isRunning      = status === 'running';

  const agentData = (id) => {
    const q = queue[`${id}_queue`];
    const qLen = Array.isArray(q) ? q.length : (q ?? 0);
    return {
      status:       isRunning ? (qLen > 0 ? 'running' : 'idle') : status === 'completed' ? 'completed' : 'idle',
      progress:     completedCh > 0 ? Math.round((completedCh / Math.max(chapters.length, 1)) * 100) : 0,
      jobsProcessed: completedCh,
      queueSize:    qLen,
      currentTask:  isRunning && qLen > 0 ? `Traitement chapitre ${completedCh + 1}…` : null,
    };
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG }}>
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: BORDER, background: SURFACE }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dev/liri/studio')}
            className="text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft size={16} />
          </button>
          {/* Lien Factory si les chapitres ont été chargés depuis Factory */}
          {status === 'completed' && chapters.length > 0 && (
            <button onClick={() => navigate('/dev/liri/masterclass-v2')}
              className="text-[10px] px-2 py-1 rounded-lg transition-colors"
              style={{ background: '#a78bfa15', color: '#a78bfa', border: '1px solid #a78bfa30' }}>
              ← Factory
            </button>
          )}
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: '#38bdf820' }}>
            <Activity size={14} style={{ color: '#38bdf8' }} />
          </div>
          <span className="text-white font-bold">Orchestrator Live</span>
          <div className="flex items-center gap-1.5 ml-3">
            <Circle size={6}
              style={{ color: isRunning ? '#22c55e' : '#475569', fill: isRunning ? '#22c55e' : '#475569' }}
              className={isRunning ? 'animate-pulse' : ''} />
            <span className="text-[11px]" style={{ color: isRunning ? '#22c55e' : '#475569' }}>
              {isRunning ? 'Génération active' : status === 'completed' ? 'Terminé' : 'En attente'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isRunning
            ? <button
                onClick={() => rawText.length > 10 && startProject?.(rawText)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
                style={{ background: '#22c55e', color: '#000' }}>
                <Play size={13} /> Démarrer
              </button>
            : <button
                onClick={stopProject}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
                style={{ background: '#f8717120', color: '#f87171', border: '1px solid #f8717140' }}>
                <Square size={13} /> Arrêter
              </button>
          }
          <button
            onClick={() => navigate('/dev/liri/streaming-v2')}
            disabled={completedCh === 0}
            title={completedCh === 0 ? 'Attendez qu\'au moins un chapitre soit terminé' : 'Ouvrir SmartBoard Streaming'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{
              background: PANEL,
              border: `1px solid ${BORDER}`,
              color: completedCh > 0 ? '#e2e8f0' : '#334155',
              cursor: completedCh > 0 ? 'pointer' : 'not-allowed',
              opacity: completedCh > 0 ? 1 : 0.5,
            }}>
            Voir les slides <ChevronRight size={13} />
          </button>
        </div>
      </header>

      {/* ── Stats strip ──────────────────────────────────────────────────── */}
      <div className="px-6 py-4 flex items-center gap-3 border-b overflow-x-auto" style={{ borderColor: BORDER }}>
        <StatPill label="Chapitres générés" value={completedCh} color="#a78bfa" />
        <StatPill label="Slides totaux"      value={totalSlides} color="#38bdf8" />
        <StatPill label="Chapitres prévus"   value={chapters.length} color={GOLD} />
        <StatPill label="File d'attente"     value={totalQueue} color="#34d399" />
        {isRunning && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl ml-2"
            style={{ background: '#22c55e10', border: '1px solid #22c55e25' }}>
            <Loader2 size={12} className="animate-spin text-green-400" />
            <span className="text-green-400 text-xs">~{Math.max(1, chapters.length * 2)} min estimées</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Panel gauche : agents ──────────────────────────────────────── */}
        <aside className="w-72 shrink-0 border-r flex flex-col gap-3 p-4 overflow-y-auto"
          style={{ borderColor: BORDER, background: SURFACE }}>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 px-1">Agents actifs</p>
          {AGENTS.map(ag => (
            <AgentCard
              key={ag.id}
              agent={ag}
              data={agentData(ag.id)}
              active={activeAgent === ag.id}
              onClick={() => setActiveAgent(activeAgent === ag.id ? null : ag.id)}
            />
          ))}

          {/* Input texte — uniquement si aucun chapitre déjà chargé et pas running */}
          {!isRunning && status === 'idle' && (
            <div className="mt-2 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 px-1">Source</p>
              <textarea
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder="Collez votre texte ou ID de projet…"
                rows={4}
                className="w-full text-xs text-slate-300 rounded-xl p-3 resize-none outline-none placeholder:text-slate-500"
                style={{ background: PANEL, border: `1px solid ${BORDER}`, fontFamily: 'inherit' }}
              />
            </div>
          )}
          {/* Badge Factory — si chapitres chargés depuis Factory */}
          {status === 'completed' && chapters.length > 0 && (
            <div className="mt-3 px-3 py-2.5 rounded-xl"
              style={{ background: '#a78bfa10', border: '1px solid #a78bfa25' }}>
              <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-1">Source</p>
              <p className="text-xs font-semibold" style={{ color: '#a78bfa' }}>
                Factory LIRI — {chapters.length} chapitre{chapters.length > 1 ? 's' : ''}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Chargé depuis la Factory</p>
            </div>
          )}
        </aside>

        {/* ── Centre : chapitres ─────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: BORDER }}>
            <p className="text-white font-semibold text-sm">Chapitres</p>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <BarChart2 size={12} />
              {completedCh}/{chapters.length} terminés
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <ChapterGrid
              chapters={chapters}
              selectedId={selectedChapterId}
              onSelect={setSelectedChapterId}
            />
          </div>
        </main>

        {/* ── Panel droit : logs ────────────────────────────────────────── */}
        <aside className="w-96 shrink-0 border-l flex flex-col" style={{ borderColor: BORDER, background: SURFACE }}>
          <div className="px-4 py-4 border-b flex items-center justify-between" style={{ borderColor: BORDER }}>
            <div className="flex items-center gap-2">
              <Terminal size={13} className="text-slate-500" />
              <p className="text-sm font-semibold text-white">Logs live</p>
            </div>
            <div className="flex items-center gap-1">
              <Filter size={11} className="text-slate-500" />
              <select
                value={logFilter}
                onChange={e => setLogFilter(e.target.value)}
                className="text-[10px] text-slate-400 bg-transparent outline-none cursor-pointer"
              >
                <option value="all">Tous</option>
                {AGENTS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <LiveLogs logs={logs} filter={logFilter} />
          </div>
        </aside>
      </div>
    </div>
  );
}
