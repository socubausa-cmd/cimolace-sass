/**
 * LIRI Studio Hub — Point d'entrée unifié des 4 outils de création
 * Visualise la chaîne : Factory → Orchestrator → Streaming → Designer
 */
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Activity, Monitor, PenTool,
  ArrowRight, ChevronRight, Circle, CheckCircle2,
  Layers, Zap, Eye, Wand2,
} from 'lucide-react';

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG       = '#080c14';
const SURFACE  = '#0f1520';
const ELEVATED = '#161d2e';
const BORDER   = '#1e2a40';
const GOLD     = '#D4AF37';

// ─── Données des outils ───────────────────────────────────────────────────────
const TOOLS = [
  {
    id: 'factory',
    step: 1,
    icon: Sparkles,
    label: 'Masterclass Factory',
    tagline: 'Créer',
    desc: 'Transforme un texte brut en cours complet via un pipeline IA en 8 étapes. Génère chapitres, pédagogie, slides et script professeur.',
    route: '/dev/liri/masterclass-v2',
    color: '#a78bfa',        // violet
    glow: 'rgba(167,139,250,0.15)',
    features: ['Pipeline 8 étapes', '22 segments pédagogiques', 'Script professeur', 'Export multi-formats'],
    status: 'entry',
  },
  {
    id: 'orchestrator',
    step: 2,
    icon: Activity,
    label: 'Orchestrator Live',
    tagline: 'Surveiller',
    desc: '4 agents IA en parallèle (Coach, Visual, SmartBoard, Quality). Monitoring temps réel, logs filtrés, Gantt des chapitres.',
    route: '/dev/liri/orchestrator-v2',
    color: '#38bdf8',        // bleu ciel
    glow: 'rgba(56,189,248,0.15)',
    features: ['4 agents IA parallèles', 'Logs temps réel', 'Gantt chapitres', 'Estimation durée'],
    status: 'monitor',
  },
  {
    id: 'streaming',
    step: 3,
    icon: Monitor,
    label: 'SmartBoard Streaming',
    tagline: 'Valider',
    desc: 'Lecteur de slides avec progression a/b/c pilotable. Génération, validation et navigation étape par étape avant export.',
    route: '/dev/liri/streaming-v2',
    color: '#34d399',        // vert
    glow: 'rgba(52,211,153,0.15)',
    features: ['Progression a/b/c', 'Validation slide', 'Auto-mode', 'Export JSON'],
    status: 'validate',
  },
  {
    id: 'designer',
    step: 4,
    icon: PenTool,
    label: 'SmartBoard Designer',
    tagline: 'Perfectionner',
    desc: 'Studio graphique Konva complet. Design professionnel, collaboration temps réel, Coach IA + Architect IA, export vidéo.',
    route: '/dev/smartboard-designer',
    color: GOLD,             // or
    glow: 'rgba(212,175,55,0.15)',
    features: ['Canvas Konva', 'Coach + Architect IA', 'Collaboration live', 'Export vidéo'],
    status: 'design',
  },
];

// ─── Composant ────────────────────────────────────────────────────────────────
export default function LiriStudioHub() {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(null);
  const [active, setActive] = useState(null);
  const navTidRef = useRef(null);

  // Cleanup pending navigation on unmount (P0-1 memory leak)
  useEffect(() => () => clearTimeout(navTidRef.current), []);

  const handleOpen = (tool) => {
    setActive(tool.id);
    clearTimeout(navTidRef.current);
    navTidRef.current = setTimeout(() => navigate(tool.route), 300);
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: BG, fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="px-8 py-6 flex items-center justify-between border-b" style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}20` }}>
            <Layers size={16} style={{ color: GOLD }} />
          </div>
          <div>
            <span className="text-white font-bold text-lg tracking-tight">LIRI Studio</span>
            <span className="text-slate-500 text-xs ml-3">Écosystème de création pédagogique</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Circle size={6} className="text-green-400 fill-green-400" />
          4 outils actifs
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div className="px-8 pt-16 pb-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs mb-6"
            style={{ background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}30` }}>
            <Zap size={11} /> Chaîne de création complète
          </div>
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
            Du texte au cours<br />
            <span style={{ color: GOLD }}>en 4 étapes.</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Quatre outils spécialisés qui travaillent en séquence. Choisissez votre point d'entrée.
          </p>
        </motion.div>
      </div>

      {/* ── Pipeline visuel ────────────────────────────────────────────────── */}
      <div className="px-8 pb-4">
        <div className="flex items-center justify-center gap-0 max-w-2xl mx-auto">
          {TOOLS.map((tool, i) => (
            <React.Fragment key={tool.id}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: `${tool.color}20`, border: `1px solid ${tool.color}40`, color: tool.color }}
                >
                  {tool.step}
                </div>
                <span className="text-xs text-slate-500 whitespace-nowrap">{tool.tagline}</span>
              </div>
              {i < TOOLS.length - 1 && (
                <div className="flex-1 mx-2 mt-[-12px]">
                  <div className="h-px" style={{ background: `linear-gradient(to right, ${TOOLS[i].color}40, ${TOOLS[i+1].color}40)` }} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Grille des outils ──────────────────────────────────────────────── */}
      <div className="flex-1 px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 max-w-7xl mx-auto">
          {TOOLS.map((tool, idx) => {
            const Icon = tool.icon;
            const isHovered = hovered === tool.id;
            const isActive = active === tool.id;

            return (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08, duration: 0.4 }}
                onMouseEnter={() => setHovered(tool.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => handleOpen(tool)}
                className="relative rounded-2xl cursor-pointer overflow-hidden flex flex-col"
                style={{
                  background: ELEVATED,
                  border: `1px solid ${isHovered ? tool.color + '50' : BORDER}`,
                  boxShadow: isHovered ? `0 0 40px ${tool.glow}` : 'none',
                  transition: 'all 0.25s ease',
                }}
              >
                {/* Glow bg */}
                <div
                  className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                  style={{ background: `radial-gradient(circle at 30% 20%, ${tool.glow} 0%, transparent 70%)`, opacity: isHovered ? 1 : 0 }}
                />

                {/* Step badge */}
                <div className="absolute top-4 right-4 text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${tool.color}15`, color: tool.color, border: `1px solid ${tool.color}30` }}>
                  Étape {tool.step}
                </div>

                <div className="relative p-6 flex flex-col flex-1">
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: `${tool.color}15`, border: `1px solid ${tool.color}25` }}>
                    <Icon size={22} style={{ color: tool.color }} />
                  </div>

                  {/* Label + tagline */}
                  <div className="mb-3">
                    <div className="text-xs font-semibold uppercase tracking-widest mb-1"
                      style={{ color: tool.color }}>
                      {tool.tagline}
                    </div>
                    <h3 className="text-white font-bold text-lg leading-tight">{tool.label}</h3>
                  </div>

                  {/* Desc */}
                  <p className="text-slate-400 text-sm leading-relaxed mb-5 flex-1">{tool.desc}</p>

                  {/* Features */}
                  <ul className="space-y-1.5 mb-6">
                    {tool.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-xs text-slate-500">
                        <CheckCircle2 size={11} style={{ color: tool.color }} className="shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <motion.button
                    whileHover={{ x: 2 }}
                    className="flex items-center justify-between w-full rounded-xl px-4 py-3 font-semibold text-sm transition-all"
                    style={{
                      background: isHovered ? `${tool.color}20` : `${tool.color}10`,
                      color: tool.color,
                      border: `1px solid ${tool.color}30`,
                    }}
                  >
                    Ouvrir
                    <ChevronRight size={15} />
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Schéma de flux ─────────────────────────────────────────────────── */}
      <div className="px-8 py-10 border-t" style={{ borderColor: BORDER }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-slate-500 text-xs uppercase tracking-widest mb-8">Comment les outils s'articulent</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center text-sm">
            {[
              { icon: Sparkles, label: 'Texte brut', sub: 'Transcription, article, idée', color: '#a78bfa' },
              { icon: Activity, label: 'Cours structuré', sub: 'Chapitres, pédagogie, slides', color: '#38bdf8' },
              { icon: Eye, label: 'Slides validés', sub: 'Progression a/b/c vérifiée', color: '#34d399' },
              { icon: Wand2, label: 'Cours finalisé', sub: 'Design, video, live', color: GOLD },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <React.Fragment key={item.label}>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: `${item.color}10`, border: `1px solid ${item.color}25` }}>
                      <Icon size={16} style={{ color: item.color }} />
                    </div>
                    <span className="text-white font-medium">{item.label}</span>
                    <span className="text-slate-500 text-xs">{item.sub}</span>
                  </div>
                  {i < 3 && (
                    <div className="hidden md:flex items-center justify-center -mx-2 mt-5">
                      <ArrowRight size={16} className="text-slate-500" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
