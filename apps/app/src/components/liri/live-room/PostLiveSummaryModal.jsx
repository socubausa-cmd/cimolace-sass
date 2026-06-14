/**
 * Post-live Summary Modal — Phase 5 LIRI
 *
 * Affiché après la fin du live, il montre :
 * - Durée totale et statistiques
 * - Diapos couvertes avec temps passé
 * - Stats NEURON-Q
 * - Résumé IA + Points clés générés par Claude
 * - Actions : copier, partager dans messagerie
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Sparkles, Clock, Layers, HelpCircle, BookOpen,
  CheckCircle2, XCircle, Copy, Check, Loader2, ChevronDown, ChevronUp,
  Award, BarChart2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return s > 0 ? `${m} min ${s}s` : `${m} min`;
}

function formatDurationShort(seconds) {
  if (!seconds || seconds < 1) return '<1s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m${s > 0 ? `${s}s` : ''}` : `${s}s`;
}

// ── Carte statistique ──────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color = 'text-white/80', bg = 'bg-white/[0.04]' }) {
  return (
    <div className={cn('rounded-xl border border-white/8 p-3 flex flex-col gap-1', bg)}>
      <div className="flex items-center gap-1.5">
        <Icon className={cn('w-3.5 h-3.5', color)} />
        <span className="text-[9px] uppercase tracking-wider text-gray-500">{label}</span>
      </div>
      <p className={cn('text-lg font-bold', color)}>{value}</p>
    </div>
  );
}

// ── Barre de progression diapo ─────────────────────────────────────────────────
function SlideBar({ slide, maxDuration }) {
  const pct = maxDuration > 0 ? Math.round((slide.duration_s / maxDuration) * 100) : 0;
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="w-14 text-right text-[9px] text-gray-500 flex-shrink-0">
        Diapo #{slide.index + 1}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, delay: 0.1 + slide.index * 0.04 }}
          className="h-full rounded-full bg-[color-mix(in_srgb,var(--school-accent)_60%,transparent)]"
        />
      </div>
      <span className="w-10 text-[9px] text-gray-400 flex-shrink-0">
        {formatDurationShort(slide.duration_s)}
      </span>
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────
export default function PostLiveSummaryModal({
  open,
  onClose,
  summary = null,
  generating = false,
  error = null,
  onGenerateReport, // async () => void — appelle la fonction Netlify report (inchangée)
}) {
  const [copied, setCopied]               = useState(false);
  const [slidesExpanded, setSlidesExpanded] = useState(false);
  const [sendingReport, setSendingReport]   = useState(false);
  const [reportSent, setReportSent]         = useState(false);

  const handleCopy = async () => {
    if (!summary) return;
    const lines = [
      `Résumé de session — ${formatDuration(summary.durationSeconds)}`,
      summary.participantName ? `Participant : ${summary.participantName}` : '',
      '',
      summary.aiSummary || '',
      '',
      summary.keyPoints?.length > 0
        ? 'Points clés :\n' + summary.keyPoints.map((p) => `• ${p}`).join('\n')
        : '',
      '',
      `Diapos : ${summary.slidesCovered?.length || 0} · Questions : ${summary.questionsAnswered}/${summary.questionsTotal} répondues`,
    ].filter(Boolean).join('\n');
    await navigator.clipboard.writeText(lines).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendReport = async () => {
    if (!onGenerateReport) return;
    setSendingReport(true);
    try {
      await onGenerateReport();
      setReportSent(true);
    } finally {
      setSendingReport(false);
    }
  };

  const maxSlideDuration = summary?.slidesCovered?.length > 0
    ? Math.max(...summary.slidesCovered.map((s) => s.duration_s))
    : 0;

  const visibleSlides = slidesExpanded
    ? summary?.slidesCovered || []
    : (summary?.slidesCovered || []).slice(0, 5);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/12 bg-[#0D1117] shadow-[0_40px_100px_-25px_rgba(0,0,0,0.9)]"
          >
            {/* Gradient de fond */}
            <div className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(212,175,55,0.07),transparent_50%)]" />
            </div>

            {/* Header */}
            <div className="relative flex items-start justify-between p-5 pb-4 border-b border-white/8">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] flex items-center justify-center flex-shrink-0">
                  <Award className="w-4.5 h-4.5 text-[var(--school-accent)]" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Résumé de session</h2>
                  {summary?.participantName && (
                    <p className="text-[10px] text-gray-500">avec {summary.participantName}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="h-7 w-7 rounded-full bg-white/[0.05] border border-white/10 text-gray-500 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Content */}
            <div className="relative p-5 space-y-5">

              {/* Generating state */}
              {generating && (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-[var(--school-accent)] animate-pulse" />
                  </div>
                  <p className="text-sm text-white/70">Génération du résumé en cours…</p>
                  <p className="text-[10px] text-gray-500">Claude analyse votre session</p>
                </div>
              )}

              {/* Error state */}
              {error && !generating && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/8 p-4 text-center">
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}

              {/* Summary content */}
              {summary && !generating && (
                <>
                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <StatCard
                      icon={Clock}
                      label="Durée"
                      value={formatDuration(summary.durationSeconds)}
                      color="text-[var(--school-accent)]"
                      bg="bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)]"
                    />
                    <StatCard
                      icon={Layers}
                      label="Diapos"
                      value={summary.slidesCovered?.length || 0}
                      color="text-blue-300"
                      bg="bg-blue-500/5"
                    />
                    <StatCard
                      icon={HelpCircle}
                      label="Questions"
                      value={`${summary.questionsAnswered}/${summary.questionsTotal}`}
                      color="text-emerald-300"
                      bg="bg-emerald-500/5"
                    />
                    <StatCard
                      icon={BookOpen}
                      label="Script"
                      value={summary.scriptSectionsTotal || 0}
                      color="text-violet-300"
                      bg="bg-violet-500/5"
                    />
                  </div>

                  {/* AI Summary */}
                  {summary.aiSummary && (
                    <div className="rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] p-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Sparkles className="w-3 h-3 text-[var(--school-accent)]" />
                        <span className="text-[9px] uppercase tracking-wider text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)] font-semibold">Résumé IA</span>
                      </div>
                      <p className="text-xs text-white/80 leading-relaxed">{summary.aiSummary}</p>
                    </div>
                  )}

                  {/* Key points */}
                  {summary.keyPoints?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-1.5">
                        <BarChart2 className="w-3 h-3" /> Points clés
                      </p>
                      <div className="space-y-1.5">
                        {summary.keyPoints.map((point, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.06 }}
                            className="flex items-start gap-2 rounded-lg bg-white/[0.03] border border-white/8 px-3 py-2"
                          >
                            <span className="w-4 h-4 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] text-[8px] font-bold text-[var(--school-accent)] flex items-center justify-center flex-shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <p className="text-xs text-white/75">{point}</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Slides timeline */}
                  {summary.slidesCovered?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-1.5">
                        <Layers className="w-3 h-3" /> Temps par diapositive
                      </p>
                      <div className="space-y-0.5">
                        {visibleSlides.map((s) => (
                          <SlideBar key={s.index} slide={s} maxDuration={maxSlideDuration} />
                        ))}
                      </div>
                      {summary.slidesCovered.length > 5 && (
                        <button
                          type="button"
                          onClick={() => setSlidesExpanded((v) => !v)}
                          className="flex items-center gap-1 text-[9px] text-gray-500 hover:text-white transition-colors"
                        >
                          {slidesExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {slidesExpanded ? 'Réduire' : `Voir ${summary.slidesCovered.length - 5} de plus`}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Questions breakdown */}
                  {summary.questionsTotal > 0 && (
                    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 space-y-2">
                      <p className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-1.5">
                        <HelpCircle className="w-3 h-3" /> Questions NEURON-Q
                      </p>
                      <div className="flex gap-3">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-xs text-white/70">{summary.questionsAnswered} répondues</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <XCircle className="w-3.5 h-3.5 text-gray-500" />
                          <span className="text-xs text-gray-500">{summary.questionsSkipped} ignorées</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500">
                            {summary.questionsTotal - summary.questionsAnswered - summary.questionsSkipped} en attente
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer actions */}
            {(summary || error) && !generating && (
              <div className="relative flex items-center gap-2 px-5 pb-5">
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!summary}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-gray-400 hover:text-white hover:bg-white/8 disabled:opacity-40 transition-all"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copié !' : 'Copier'}
                </button>

                {onGenerateReport && !reportSent && (
                  <button
                    type="button"
                    onClick={handleSendReport}
                    disabled={sendingReport || !summary}
                    className="flex-1 h-9 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] text-xs text-[var(--school-accent)] font-semibold flex items-center justify-center gap-1.5 hover:bg-[color-mix(in_srgb,var(--school-accent)_22%,transparent)] disabled:opacity-40 transition-all"
                  >
                    {sendingReport
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Envoi…</>
                      : <><Sparkles className="w-3.5 h-3.5" /> Envoyer le rapport complet</>
                    }
                  </button>
                )}

                {reportSent && (
                  <div className="flex-1 h-9 rounded-xl bg-emerald-500/12 border border-emerald-400/22 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs text-emerald-300">Rapport envoyé</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-3 rounded-xl bg-white/[0.04] border border-white/8 text-xs text-gray-500 hover:text-white transition-colors"
                >
                  Fermer
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
