/**
 * LivePostIntelligencePage — Exploitation post-live
 * Route: /studio/post-live/:sessionId
 *
 * Fonctionnalités:
 *   - Résumé de la session (notes, points clés)
 *   - Replay vidéo (depuis Supabase Storage)
 *   - Export (résumé texte, liste participants)
 *   - Suivi (proposer prochain RDV, formation, mentorat)
 *   - Statistiques (durée, participants, messages chat)
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft, Play, Download, FileText, Users, MessageSquare,
  Clock, ChevronDown, ChevronRight, BookOpen, Calendar,
  CheckCircle2, Loader2, AlertTriangle, Video,
  Copy, Check, TrendingUp, Target, Circle,
  Sparkles, Brain, HelpCircle, Zap, ChevronUp, Library, Link2, GraduationCap, X, PlayCircle,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { getSupabaseFunctionErrorMessage } from '@/lib/supabaseEdgeInvoke';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import {
  fetchNeuroRecallState,
  upsertNeuroRecallState,
  countNeuroFlashcards,
  countNeuroReports,
  listNeuroFlashcards,
  listNeuroReports,
  fetchNeuroUserProgress,
  upsertNeuroUserProgress,
  NEURO_RECALL_WORKFLOW_LABELS,
  postProductionEditorPath,
} from '@/services/neuroRecall';
import { LIRI_MOBILE } from '@/lib/liriMobileRoutes';
import { downloadSubtitleFile, generateSubtitleFile } from '@/lib/generateSrtFromLines';
import { Languages } from 'lucide-react';
import useTenantBranding from '@/hooks/useTenantBranding';

// ─── Formatage durée ───────────────────────────────────────────────────────────
function fmtDuration(seconds) {
  if (!seconds || seconds < 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}h ${String(m).padStart(2, '0')}min`
    : `${m}min ${String(s).padStart(2, '0')}s`;
}

/** Formate un timestamp en secondes → "1:23" ou "1:02:05" */
function fmtTimestamp(seconds) {
  const s = Math.floor(Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// ─── Carte statistique ─────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color = 'amber' }) {
  const colors = {
    amber:   'from-amber-500/15 to-amber-600/5 border-amber-500/25 text-amber-300',
    emerald: 'from-[#5a8f52]/15 to-emerald-600/5 border-[#5a8f52]/25 text-[#9cc48a]',
    blue:    'from-[#d4924a]/15 to-blue-600/5 border-[#d4924a]/25 text-[#e6b566]',
    purple:  'from-[#d97757]/15 to-[#c96544]/5 border-[#d97757]/25 text-[#e8a97f]',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border bg-gradient-to-br p-4 flex items-center gap-3',
        colors[color]
      )}
    >
      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[11px] text-white/50 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-white">{value}</p>
      </div>
    </motion.div>
  );
}

// ─── Section accordéon ─────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c1220] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-4 h-4 text-[var(--school-accent,#D4AF37)]" />
          <span className="text-sm font-semibold text-white">{title}</span>
        </div>
        {open
          ? <ChevronDown className="w-4 h-4 text-white/40" />
          : <ChevronRight className="w-4 h-4 text-white/40" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-2 border-t border-white/[0.06]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Replay multilingue LIRI ──────────────────────────────────────────────────
function MultilangReplaySection({ sessionId }) {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [activeLang, setActiveLang] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase
      .from('liri_multilang_live_captions')
      .select('target_lang, source_lang, source_text, translated_text, occurred_at')
      .eq('live_session_id', String(sessionId))
      .order('occurred_at', { ascending: true });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    setRows(data || []);
    const langs = [...new Set((data || []).map((r) => r.target_lang))];
    if (langs.length) setActiveLang(langs[0]);
  }, [sessionId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-white/30" /></div>;
  if (err) return <p className="text-[12px] text-red-300/80 py-2">{err}</p>;
  if (!rows) return null;
  if (rows.length === 0) return (
    <p className="text-[12px] text-white/35 py-2">
      Aucune caption multilingue enregistrée pour cette séance.
      La traduction live LIRI doit être activée pendant la session.
    </p>
  );

  const langs = [...new Set(rows.map((r) => r.target_lang))];
  const byLang = langs.reduce((acc, l) => {
    acc[l] = rows.filter((r) => r.target_lang === l);
    return acc;
  }, {});
  const sourceLang = rows[0]?.source_lang || '?';
  const visible = activeLang ? (byLang[activeLang] || []) : [];

  const handleDownload = (lang, format) => {
    const lines = (byLang[lang] || []).map((r) => ({ text: r.translated_text }));
    const durationMin = Math.max(1, Math.ceil(rows.length / 6));
    downloadSubtitleFile(lines, durationMin, lang, format);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
          Source : {sourceLang.toUpperCase()} &nbsp;·&nbsp; {rows.length} segment(s)
        </span>
      </div>

      {/* Sélecteur de langue */}
      <div className="flex flex-wrap gap-2">
        {langs.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setActiveLang(l)}
            className={cn(
              'rounded-full px-3 py-1 text-[11px] font-semibold border transition-colors',
              activeLang === l
                ? 'border-[#d97757]/60 bg-[#d97757]/20 text-[#f0c4b3]'
                : 'border-white/10 bg-white/[0.04] text-white/50 hover:text-white/75',
            )}
          >
            {l.toUpperCase()} ({byLang[l].length})
          </button>
        ))}
      </div>

      {/* Transcript */}
      {activeLang && (
        <div className="max-h-64 overflow-y-auto rounded-xl border border-white/[0.07] bg-black/30 divide-y divide-white/[0.05]">
          {visible.map((r, i) => (
            <div key={i} className="px-3 py-2 flex gap-3 text-[12px]">
              <span className="flex-shrink-0 text-[10px] text-white/25 pt-0.5 font-mono w-16">
                {r.occurred_at ? new Date(r.occurred_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : `#${i + 1}`}
              </span>
              <div className="flex-1 space-y-0.5">
                <p className="text-white/80 leading-snug">{r.translated_text}</p>
                <p className="text-[10px] text-white/30 italic">{r.source_text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Export */}
      {activeLang && (
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="text-[10px] text-white/30 self-center">Export {activeLang.toUpperCase()} :</span>
          {['srt', 'vtt'].map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => handleDownload(activeLang, fmt)}
              className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold text-white/70 hover:bg-white/10"
            >
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Replay vidéo ─────────────────────────────────────────────────────────────
function ReplayPlayer({ recordings }) {
  const [selected, setSelected] = useState(0);
  const rec = recordings[selected];

  if (!recordings.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#080c14] flex flex-col items-center justify-center py-12 gap-3">
        <Video className="w-10 h-10 text-white/20" />
        <p className="text-sm text-white/40">Aucun enregistrement disponible</p>
        <p className="text-xs text-white/25">
          L'enregistrement doit être activé pendant le live (bouton "Enregistrer")
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recordings.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {recordings.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelected(i)}
              className={cn(
                'h-7 px-3 rounded-full text-[11px] border transition-all',
                i === selected
                  ? 'text-[var(--school-accent,#D4AF37)]'
                  : 'bg-white/[0.04] border-white/10 text-white/50 hover:text-white'
              )}
              style={i === selected ? {
                backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 20%, transparent)',
                borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 40%, transparent)',
              } : undefined}
            >
              Enregistrement {i + 1}
            </button>
          ))}
        </div>
      )}

      {rec?.public_url ? (
        <video
          src={rec.public_url}
          controls
          className="w-full rounded-2xl border border-white/10 bg-black"
          style={{ maxHeight: '420px' }}
        />
      ) : (
        <div className="rounded-2xl border border-white/10 bg-[#080c14] flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 className="w-8 h-8 text-white/20 animate-spin" />
          <p className="text-sm text-white/40">Enregistrement en traitement…</p>
        </div>
      )}

      {rec && (
        <div className="flex items-center gap-3">
          {rec.public_url && (
            <a
              href={rec.public_url}
              download
              className="h-8 px-4 rounded-xl border text-xs hover:bg-white/[0.06] flex items-center gap-1.5 transition-colors"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 15%, transparent)',
                borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 30%, transparent)',
                color: 'var(--school-accent, #D4AF37)',
              }}
            >
              <Download className="w-3.5 h-3.5" />
              Télécharger
            </a>
          )}
          <span className="text-xs text-white/30">
            {rec.file_size ? `${(rec.file_size / 1_000_000).toFixed(1)} Mo` : ''}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Notes éditables (autosave) ───────────────────────────────────────────────
function NotesEditor({ sessionId, initialNotes }) {
  const [notes,  setNotes]  = useState(initialNotes || '');
  const [saved,  setSaved]  = useState(false);
  const [saving, setSaving] = useState(false);
  const debounce = useRef(null);

  const save = useCallback(async (val) => {
    setSaving(true);
    await supabase
      .from('live_sessions')
      .update({ post_notes: val })
      .eq('id', sessionId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [sessionId]);

  const handleChange = (e) => {
    const val = e.target.value;
    setNotes(val);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => save(val), 1200);
  };

  return (
    <div className="relative">
      <textarea
        value={notes}
        onChange={handleChange}
        placeholder="Points clés de la session, observations, actions à suivre…"
        rows={6}
        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/80 placeholder:text-white/25 outline-none focus:border-[color:var(--school-accent,#D4AF37)] resize-none transition-colors"
      />
      <div className="absolute bottom-3 right-3 text-[10px]">
        {saving && <span className="text-white/30">Sauvegarde…</span>}
        {saved  && <span className="text-[#7bb06a]">✓ Sauvegardé</span>}
      </div>
    </div>
  );
}

// ─── Chat replay ───────────────────────────────────────────────────────────────
function ChatReplay({ messages }) {
  if (!messages.length) {
    return <p className="text-sm text-white/30 py-4">Aucun message durant la session.</p>;
  }
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {messages.map((m) => (
        <div key={m.id} className="flex gap-2.5 text-sm">
          <div
            className="w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 20%, transparent)',
              borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 30%, transparent)',
              color: 'var(--school-accent, #D4AF37)',
            }}
          >
            {(m.name || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] text-white/40">{m.name}</span>
            <p className="text-white/70 text-xs leading-relaxed">{m.text}</p>
          </div>
          <span className="text-[9px] text-white/25 flex-shrink-0">
            {m.time ? format(new Date(m.time), 'HH:mm') : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Export texte ──────────────────────────────────────────────────────────────
function ExportSection({ session, participants, messages, notes }) {
  const [copied, setCopied] = useState(false);

  const generate = () => {
    const lines = [
      `📋 RAPPORT DE SESSION — ${session.title || 'Sans titre'}`,
      `Date: ${session.started_at ? format(new Date(session.started_at), 'dd/MM/yyyy HH:mm', { locale: fr }) : '—'}`,
      `Durée: ${fmtDuration(session.duration_seconds)}`,
      `Participants: ${participants.length}`,
      '',
      '─── NOTES ───',
      notes || '(aucune note)',
      '',
      '─── MESSAGES CHAT ───',
      ...messages.map(
        (m) => `[${m.time ? format(new Date(m.time), 'HH:mm') : '?'}] ${m.name}: ${m.text}`
      ),
    ];
    return lines.join('\n');
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(generate());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadText = () => {
    const blob = new Blob([generate()], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `session-${(session.title || 'rapport').replace(/\s+/g, '-').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <button
        type="button"
        onClick={downloadText}
        className="h-9 px-4 rounded-xl border text-xs hover:bg-white/[0.06] flex items-center gap-1.5 transition-colors"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 15%, transparent)',
          borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 30%, transparent)',
          color: 'var(--school-accent, #D4AF37)',
        }}
      >
        <FileText className="w-3.5 h-3.5" />
        Télécharger résumé
      </button>
      <button
        type="button"
        onClick={copyToClipboard}
        className="h-9 px-4 rounded-xl bg-white/[0.04] border border-white/10 text-white/60 text-xs hover:text-white flex items-center gap-1.5 transition-colors"
      >
        {copied
          ? <Check className="w-3.5 h-3.5 text-[#7bb06a]" />
          : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Copié !' : 'Copier le résumé'}
      </button>
    </div>
  );
}

// ─── Suivi & actions ───────────────────────────────────────────────────────────
const FORMATION_DAY_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ─── NeuroRecall — fiche live → post-production existante + extensions ─────────
function NeuroRecallPanel({ sessionId, isTeacher, lirSummaryReady, compact = false }) {
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [contentIdInput, setContentIdInput] = useState('');
  const [formationDayIdInput, setFormationDayIdInput] = useState('');
  const [flashcardCount, setFlashcardCount] = useState(0);
  const [reportCount, setReportCount] = useState(0);
  const [apiHint, setApiHint] = useState(null);

  const reload = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    const [stRes, fcRes, repRes] = await Promise.all([
      fetchNeuroRecallState(sessionId),
      countNeuroFlashcards(sessionId),
      countNeuroReports(sessionId),
    ]);
    const st = stRes.data;
    setRow(st || null);
    setFlashcardCount(fcRes.count ?? 0);
    setReportCount(repRes.count ?? 0);
    if (st?.postproduction_content_id) setContentIdInput(st.postproduction_content_id);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const invokeNeuroEdge = async (fnName, body) => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.access_token) {
      throw new Error('Session expirée — reconnectez-vous.');
    }
    const { data, error } = await supabase.functions.invoke(fnName, { body });
    if (error) throw new Error(await getSupabaseFunctionErrorMessage(error));
    if (data?.error) throw new Error(String(data.error));
    return data;
  };

  const runBootstrap = async () => {
    if (!sessionId || !isTeacher) return;
    setBusy(true);
    setApiHint(null);
    try {
      const data = await invokeNeuroEdge('neuro-recall-bootstrap', { sessionId });
      setApiHint({
        type: 'ok',
        text: `Synchronisé : ${data.transcript_segments_count ?? 0} segment(s), enregistrement(s) ${data.events_snapshot?.recordings_count ?? 0}.`,
      });
      await reload();
    } catch (e) {
      setApiHint({ type: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const runGenerateFlashcards = async () => {
    if (!sessionId || !isTeacher) return;
    setBusy(true);
    setApiHint(null);
    try {
      const data = await invokeNeuroEdge('neuro-recall-generate-flashcards', {
        sessionId,
        maxCards: 14,
      });
      setApiHint({
        type: 'ok',
        text: `${data.inserted} flashcard(s) générée(s)${data.provider ? ` (${data.provider})` : ''}.`,
      });
      await reload();
    } catch (e) {
      setApiHint({ type: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const runGenerateNodeReports = async () => {
    if (!sessionId || !isTeacher) return;
    setBusy(true);
    setApiHint(null);
    try {
      const data = await invokeNeuroEdge('neuro-recall-generate-node-reports', {
        sessionId,
        maxNodes: 16,
      });
      setApiHint({
        type: 'ok',
        text: `${data.upserted} rapport(s) nœud enregistré(s)${data.provider ? ` (${data.provider})` : ''}.`,
      });
      await reload();
    } catch (e) {
      setApiHint({ type: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const runCreatePostProdContent = async () => {
    if (!sessionId || !isTeacher) return;
    const dayId = formationDayIdInput.trim();
    if (!FORMATION_DAY_UUID_RE.test(dayId)) {
      setApiHint({ type: 'err', text: 'Collez l\'UUID d\'un jour de formation (table formation_days).' });
      return;
    }
    setBusy(true);
    setApiHint(null);
    try {
      const data = await invokeNeuroEdge('neuro-recall-create-postprod-content', {
        sessionId,
        formationDayId: dayId,
      });
      setApiHint({
        type: 'ok',
        text: `Contenu vidéo créé (${data.contentId?.slice(0, 8)}…). Ouvrez l'éditeur post-production ci-dessous.`,
      });
      await reload();
    } catch (e) {
      setApiHint({ type: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const savePostProdLink = async () => {
    if (!sessionId || !isTeacher) return;
    const id = contentIdInput.trim();
    if (!id) return;
    setBusy(true);
    const { error } = await upsertNeuroRecallState(sessionId, {
      postproduction_content_id: id,
      workflow_status: 'draft_generated',
      pipeline_error: null,
    });
    setBusy(false);
    if (!error) await reload();
  };

  const setWorkflow = async (workflow_status) => {
    if (!sessionId || !isTeacher || !row) return;
    setBusy(true);
    const { error } = await upsertNeuroRecallState(sessionId, { workflow_status });
    setBusy(false);
    if (!error) await reload();
  };

  const statusLabel = row?.workflow_status
    ? NEURO_RECALL_WORKFLOW_LABELS[row.workflow_status] || row.workflow_status
    : null;

  return (
    <div className="rounded-2xl border border-[#d4924a]/20 bg-gradient-to-br from-[#d4924a]/[0.07] to-transparent overflow-hidden">
      <div className="flex items-start gap-3 px-5 py-4">
        <div className="w-9 h-9 rounded-xl bg-[#d4924a]/15 border border-[#d4924a]/25 flex items-center justify-center flex-shrink-0">
          <Library className="w-4 h-4 text-[#e6b566]" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <p className="text-sm font-semibold text-white/90">NeuroRecall</p>
            {compact ? (
              <p className="text-[11px] text-white/50 leading-relaxed mt-0.5">
                Replay, transcription, flashcards et rapports — liés au contenu post-production du live.
              </p>
            ) : (
              <p className="text-[11px] text-white/45 leading-relaxed mt-0.5">
                Mémoire post-live : ce module s'appuie sur le{' '}
                <strong className="text-white/55">moteur de post-production vidéo</strong> déjà en place (transcription,
                chapitres, mindmap, navigation temps ↔ contenu). Vous y accédez via le contenu de formation lié ci-dessous.
                Les tables <code className="text-[10px] text-[#ecc98f]/80">live_transcripts</code> et{' '}
                <code className="text-[10px] text-[#ecc98f]/80">live_mindmaps</code> restent les sources live d'origine ;
                ici on trace le pipeline, les flashcards et la progression.
              </p>
            )}
          </div>

          {loading ? (
            <Loader2 className="w-4 h-4 text-[#e0a458]/60 animate-spin" />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="text-white/35">Statut :</span>
                <span className="px-2 py-0.5 rounded-full bg-[#d4924a]/15 border border-[#d4924a]/25 text-[#ecc98f]/90">
                  {row ? statusLabel : '—'}
                </span>
                <span className="text-white/30">
                  · {flashcardCount} flashcard{flashcardCount !== 1 ? 's' : ''}
                  {' · '}
                  {reportCount} rapport{reportCount !== 1 ? 's' : ''} nœud
                </span>
              </div>

              {isTeacher && (
                <div className={cn('flex flex-wrap gap-2 pt-1', compact && 'flex-col')}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runBootstrap()}
                    className={cn(
                      'rounded-lg bg-[#d4924a]/20 border border-[#d4924a]/35 text-[#f0d9b8] text-xs hover:bg-[#d4924a]/30 transition-colors disabled:opacity-50',
                      compact ? 'min-h-11 w-full px-3 py-2' : 'h-8 px-3',
                    )}
                  >
                    {busy ? '…' : 'Synchroniser depuis le live'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runGenerateFlashcards()}
                    className={cn(
                      'rounded-lg bg-[#d97757]/15 border border-[#d97757]/30 text-[#f0c4b3] text-xs hover:bg-[#d97757]/25 transition-colors disabled:opacity-50',
                      compact ? 'min-h-11 w-full px-3 py-2' : 'h-8 px-3',
                    )}
                  >
                    {busy ? '…' : 'Générer flashcards (IA)'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runGenerateNodeReports()}
                    className={cn(
                      'rounded-lg bg-[#d4924a]/15 border border-[#d4924a]/30 text-[#ecc98f] text-xs hover:bg-[#d4924a]/25 transition-colors disabled:opacity-50',
                      compact ? 'min-h-11 w-full px-3 py-2' : 'h-8 px-3',
                    )}
                  >
                    {busy ? '…' : 'Rapports par nœud (IA)'}
                  </button>
                </div>
              )}
              {isTeacher && (
                <p className="text-[10px] text-white/30">
                  Flashcards : résumé LIRI et/ou <code className="text-[#ecc98f]/70">live_transcripts</code>.
                  Rapports : mindmap LIRI (<code className="text-[#ecc98f]/70">mindmap_nodes</code>) ou points clés.
                  {!lirSummaryReady && ' Générez d\'abord le résumé IA ci-dessus si besoin.'}
                </p>
              )}
              {apiHint && (
                <p
                  className={cn(
                    'text-[11px] rounded-lg px-2 py-1.5',
                    apiHint.type === 'ok' ? 'bg-[#5a8f52]/10 text-[#bcd9a4]/90' : 'bg-red-500/10 text-red-200/90',
                  )}
                >
                  {apiHint.text}
                </p>
              )}

              {row?.postproduction_content_id && (
                <Link
                  to={postProductionEditorPath(row.postproduction_content_id)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs hover:bg-white/[0.06] transition-colors"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 15%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 35%, transparent)',
                    color: 'var(--school-accent, #D4AF37)',
                  }}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Ouvrir en post-production (mindmap & transcript)
                </Link>
              )}

              {isTeacher && (
                <div className="space-y-2 pt-1 border-t border-white/[0.06] mt-2">
                  <p className="text-[10px] uppercase tracking-wide text-white/35">Créer un contenu post-production</p>
                  <p className="text-[10px] text-white/30 leading-relaxed">
                    Nouvelle entrée <code className="text-[#ecc98f]/70">formation_day_contents</code> (vidéo) avec le{' '}
                    <strong className="text-white/45">replay</strong> et la transcription NeuroRecall si disponible.
                    Récupérez l'UUID du <strong className="text-white/45">jour</strong> dans le constructeur de programme
                    (formation → semaine → jour).
                  </p>
                  <div className="flex flex-col gap-2">
                    <input
                      value={formationDayIdInput}
                      onChange={(e) => setFormationDayIdInput(e.target.value)}
                      placeholder="UUID formation_days (jour du programme)"
                      className="flex-1 min-w-0 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 sm:py-2 text-xs text-white/80 outline-none focus:border-[#5a8f52]/40"
                    />
                    <button
                      type="button"
                      disabled={busy || !formationDayIdInput.trim()}
                      onClick={() => void runCreatePostProdContent()}
                      className="min-h-11 sm:h-9 px-4 rounded-lg border border-[#5a8f52]/30 bg-[#5a8f52]/15 text-xs text-[#d4e6c4] hover:bg-[#5a8f52]/25 disabled:opacity-40 shrink-0"
                    >
                      Créer le contenu vidéo
                    </button>
                  </div>

                  <p className="text-[10px] uppercase tracking-wide text-white/35 pt-2">Ou lier un contenu existant</p>
                  <p className="text-[10px] text-white/30">
                    Collez l'UUID du contenu (URL /studio/post-production/<strong className="text-white/45">…</strong>).
                  </p>
                  <div className="flex flex-col gap-2">
                    <input
                      value={contentIdInput}
                      onChange={(e) => setContentIdInput(e.target.value)}
                      placeholder="UUID formation_day_contents"
                      className="flex-1 min-w-0 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 sm:py-2 text-xs text-white/80 outline-none focus:border-[#d4924a]/40"
                    />
                    <button
                      type="button"
                      disabled={busy || !contentIdInput.trim()}
                      onClick={() => void savePostProdLink()}
                      className="min-h-11 sm:h-9 px-4 rounded-lg border border-white/15 bg-white/[0.04] text-xs text-white/70 hover:bg-white/[0.08] disabled:opacity-40 shrink-0"
                    >
                      Enregistrer le lien
                    </button>
                  </div>
                  {row && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-white/35">Workflow :</span>
                      <select
                        value={row.workflow_status || 'idle'}
                        disabled={busy}
                        onChange={(e) => void setWorkflow(e.target.value)}
                        className="rounded-lg border border-white/10 bg-black/40 text-xs text-white/80 py-1.5 px-2 outline-none focus:border-[#d4924a]/40"
                      >
                        {Object.entries(NEURO_RECALL_WORKFLOW_LABELS).map(([k, lab]) => (
                          <option key={k} value={k}>
                            {lab}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {row?.pipeline_error && (
                    <p className="text-[11px] text-amber-300/90">Pipeline : {row.pipeline_error}</p>
                  )}
                </div>
              )}

              {!isTeacher && !row && (
                <p className="text-[11px] text-white/35">La fiche NeuroRecall n'est pas encore créée pour ce live.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Feuille plein écran — révision flashcard (mobile LIRI / compact). */
function NeuroRecallFlashcardFullSheet({
  open,
  onClose,
  cardId,
  question,
  answer,
  topic,
  difficulty,
  userId,
  grade,
  onGrade,
}) {
  const [showAns, setShowAns] = useState(false);
  useEffect(() => {
    if (!open) setShowAns(false);
  }, [open]);
  const canGrade = Boolean(userId && cardId);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Fermer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-[2px] border-0 p-0 cursor-default"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="nr-flash-title"
            initial={{ y: '105%' }}
            animate={{ y: 0 }}
            exit={{ y: '105%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340 }}
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-0 bottom-0 top-[12vh] z-[71] flex flex-col rounded-t-[26px] border border-white/14 bg-[#0a0f18]/98 backdrop-blur-2xl shadow-[0_-28px_80px_-12px_rgba(0,0,0,0.92)] overflow-hidden"
          >
            <div className="flex-shrink-0 flex justify-center pt-2 pb-1" aria-hidden>
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>
            <div className="flex items-center justify-between px-4 pt-1 pb-2 border-b border-white/[0.08] flex-shrink-0">
              <span id="nr-flash-title" className="text-sm font-semibold text-white/90">
                Flashcard
              </span>
              <button
                type="button"
                onClick={onClose}
                className="h-10 w-10 rounded-full hover:bg-white/10 text-gray-400 flex items-center justify-center"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4 pt-3">
              <div className="flex flex-wrap gap-2 text-[9px] uppercase tracking-wide text-white/35">
                {topic ? <span className="text-[#ecc98f]/70">{topic}</span> : null}
                {difficulty ? <span>{difficulty}</span> : null}
              </div>
              <p className="text-base text-white/90 leading-relaxed">{question}</p>
              <button
                type="button"
                onClick={() => setShowAns((s) => !s)}
                className="min-h-11 w-full rounded-xl border text-sm font-medium"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 12%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 35%, transparent)',
                  color: 'var(--school-accent, #D4AF37)',
                }}
              >
                {showAns ? 'Masquer la réponse' : 'Voir la réponse'}
              </button>
              {showAns ? (
                <p className="text-sm text-[#bcd9a4]/95 whitespace-pre-wrap leading-relaxed border-t border-white/[0.08] pt-3">
                  {answer}
                </p>
              ) : null}
              {showAns && canGrade ? (
                <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.08]">
                  <span className="text-[11px] text-white/45">Auto-évaluation</span>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => onGrade?.(cardId, 'ok')}
                      className={cn(
                        'flex-1 min-h-12 rounded-xl border text-sm font-medium transition-colors',
                        grade === 'ok'
                          ? 'bg-[#5a8f52]/25 border-[#7bb06a]/50 text-[#d4e6c4]'
                          : 'border-white/15 text-white/75 hover:bg-white/[0.06]',
                      )}
                    >
                      Je savais
                    </button>
                    <button
                      type="button"
                      onClick={() => onGrade?.(cardId, 'ko')}
                      className={cn(
                        'flex-1 min-h-12 rounded-xl border text-sm font-medium transition-colors',
                        grade === 'ko'
                          ? 'bg-rose-500/25 border-rose-400/50 text-rose-100'
                          : 'border-white/15 text-white/75 hover:bg-white/[0.06]',
                      )}
                    >
                      À revoir
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function NeuroRecallReportFullSheet({ open, onClose, title, nodeKey, content }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Fermer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-[2px] border-0 p-0 cursor-default"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ y: '105%' }}
            animate={{ y: 0 }}
            exit={{ y: '105%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340 }}
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-0 bottom-0 top-[18vh] z-[71] flex flex-col rounded-t-[26px] border border-white/14 bg-[#0a0f18]/98 backdrop-blur-2xl shadow-[0_-28px_80px_-12px_rgba(0,0,0,0.92)] overflow-hidden"
          >
            <div className="flex-shrink-0 flex justify-center pt-2 pb-1" aria-hidden>
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>
            <div className="flex items-center justify-between px-4 pt-1 pb-2 border-b border-white/[0.08] flex-shrink-0 gap-2">
              <span className="text-sm font-semibold text-white/90 truncate pr-2">{title || nodeKey || 'Rapport'}</span>
              <button
                type="button"
                onClick={onClose}
                className="h-10 w-10 rounded-full hover:bg-white/10 text-gray-400 flex items-center justify-center shrink-0"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-2">
              {nodeKey ? (
                <p className="text-[10px] text-white/40 font-mono break-all">{nodeKey}</p>
              ) : null}
              <p className="text-sm text-white/75 whitespace-pre-wrap leading-relaxed">{content}</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function NeuroRecallFlashcardRow({
  cardId,
  question,
  answer,
  topic,
  difficulty,
  userId,
  grade,
  onGrade,
  compact = false,
  onOpenSheet,
}) {
  const [show, setShow] = useState(false);
  const canGrade = Boolean(userId && cardId);

  if (compact && typeof onOpenSheet === 'function') {
    return (
      <button
        type="button"
        onClick={() =>
          onOpenSheet({ cardId, question, answer, topic, difficulty })
        }
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left space-y-2 transition-colors hover:bg-white/[0.07] active:scale-[0.99]"
      >
        <div className="flex flex-wrap gap-2 text-[9px] uppercase tracking-wide text-white/35">
          {topic ? <span className="text-[#ecc98f]/70">{topic}</span> : null}
          {difficulty ? <span>{difficulty}</span> : null}
        </div>
        <p className="text-sm text-white/85 leading-snug line-clamp-3">{question}</p>
        <span className="inline-flex items-center text-[11px] font-medium text-[var(--school-accent,#D4AF37)]">
          Ouvrir la fiche
          <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
      <div className="flex flex-wrap gap-2 text-[9px] uppercase tracking-wide text-white/35">
        {topic && <span className="text-[#ecc98f]/70">{topic}</span>}
        {difficulty && <span>{difficulty}</span>}
      </div>
      <p className="text-sm text-white/85 leading-relaxed">{question}</p>
      {show && (
        <p className="text-sm text-[#bcd9a4]/90 border-t border-white/[0.08] pt-2 whitespace-pre-wrap leading-relaxed">
          {answer}
        </p>
      )}
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="text-[11px] text-[var(--school-accent,#D4AF37)] hover:underline min-h-10 sm:min-h-0 py-2 sm:py-0 text-left w-full sm:w-auto"
      >
        {show ? 'Masquer la réponse' : 'Voir la réponse'}
      </button>
      {show && canGrade ? (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/[0.06]">
          <span className="text-[10px] text-white/40">Auto-évaluation :</span>
          <button
            type="button"
            onClick={() => onGrade?.(cardId, 'ok')}
            className={cn(
              'text-[11px] px-2.5 py-1 rounded-lg border transition-colors',
              grade === 'ok'
                ? 'bg-[#5a8f52]/25 border-[#7bb06a]/50 text-[#d4e6c4]'
                : 'border-white/15 text-white/60 hover:bg-white/[0.05]',
            )}
          >
            Je savais
          </button>
          <button
            type="button"
            onClick={() => onGrade?.(cardId, 'ko')}
            className={cn(
              'text-[11px] px-2.5 py-1 rounded-lg border transition-colors',
              grade === 'ko'
                ? 'bg-rose-500/25 border-rose-400/50 text-rose-100'
                : 'border-white/15 text-white/60 hover:bg-white/[0.05]',
            )}
          >
            À revoir
          </button>
        </div>
      ) : null}
    </div>
  );
}

function NeuroRecallReportRow({ title, nodeKey, content, compact = false, timestamp = null, replayUrl = null, onOpenSheet }) {
  const [open, setOpen] = useState(false);

  const timestampBadge = timestamp != null ? (
    <a
      href={replayUrl ? `${replayUrl}#t=${Math.floor(timestamp)}` : undefined}
      target={replayUrl ? '_blank' : undefined}
      rel="noopener noreferrer"
      title={`Aller à ${fmtTimestamp(timestamp)} dans le replay`}
      onClick={!replayUrl ? (e) => e.preventDefault() : undefined}
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded',
        'border shrink-0 text-[var(--school-accent,#D4AF37)] opacity-80',
        replayUrl && 'hover:bg-white/[0.06] cursor-pointer',
      )}
      style={{
        backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 10%, transparent)',
        borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 20%, transparent)',
      }}
    >
      <PlayCircle className="w-2.5 h-2.5" />
      {fmtTimestamp(timestamp)}
    </a>
  ) : null;

  if (compact && typeof onOpenSheet === 'function') {
    return (
      <button
        type="button"
        onClick={() => onOpenSheet({ title, nodeKey, content })}
        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-left flex items-start gap-2 hover:bg-white/[0.06] transition-colors active:scale-[0.99]"
      >
        <ChevronRight className="w-4 h-4 text-[var(--school-accent,#D4AF37)] opacity-80 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <span className="text-sm text-white/85 line-clamp-2 block">{title || nodeKey}</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-[var(--school-accent,#D4AF37)] opacity-90">Lire le rapport</span>
            {timestampBadge}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.08] overflow-hidden bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-white/[0.03] transition-colors"
      >
        <ChevronRight className={cn('w-4 h-4 text-white/30 shrink-0 transition-transform', open && 'rotate-90')} />
        <span className="text-sm text-white/80 flex-1 min-w-0">{title || nodeKey}</span>
        {timestampBadge}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-0 border-t border-white/[0.06]">
          <p className="text-[11px] text-white/40 mb-2 font-mono">{nodeKey}</p>
          <p className="text-xs text-white/70 whitespace-pre-wrap leading-relaxed">{content}</p>
        </div>
      )}
    </div>
  );
}

/** Flashcards + rapports nœud (RLS : hôte, participants, etc.) */
function NeuroRecallRevisionSection({ sessionId, userId, compact = false }) {
  const { toast } = useToast();
  const [cards, setCards] = useState([]);
  const [reports, setReports] = useState([]);
  const [recallState, setRecallState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState({});
  const [progressRow, setProgressRow] = useState(null);
  const [savingProgress, setSavingProgress] = useState(false);
  const [flashSheet, setFlashSheet] = useState(null);
  const [reportSheet, setReportSheet] = useState(null);

  /** node_key → seconds dans le replay */
  const nodeTimestampMap = recallState?.node_timestamp_map ?? {};
  const replayUrl = recallState?.replay_public_url ?? null;

  const loadProgress = useCallback(async () => {
    if (!sessionId || !userId) {
      setProgressRow(null);
      return;
    }
    const { data, error } = await fetchNeuroUserProgress(sessionId);
    if (error) return;
    setProgressRow(data);
  }, [sessionId, userId]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [fc, rp, st] = await Promise.all([
        listNeuroFlashcards(sessionId),
        listNeuroReports(sessionId),
        fetchNeuroRecallState(sessionId),
      ]);
      if (cancelled) return;
      setCards(fc.data || []);
      setReports(rp.data || []);
      setRecallState(st.data || null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  const handleGrade = useCallback((cardId, g) => {
    setGrades((prev) => ({ ...prev, [cardId]: g }));
  }, []);

  const gradedEntries = Object.entries(grades).filter(([, g]) => g === 'ok' || g === 'ko');
  const roundAttempted = gradedEntries.length;
  const roundCorrect = gradedEntries.filter(([, g]) => g === 'ok').length;

  const saveProgress = async () => {
    if (!userId || roundAttempted === 0 || !sessionId) return;
    setSavingProgress(true);
    const { data: prevRow } = await fetchNeuroUserProgress(sessionId);
    const prevA = prevRow?.flashcards_attempted ?? 0;
    const prevC = prevRow?.flashcards_correct ?? 0;
    const nextA = prevA + roundAttempted;
    const nextC = prevC + roundCorrect;
    const score = nextA ? Math.round((100 * nextC) / nextA) : null;

    const prevWeak = Array.isArray(prevRow?.weak_concepts) ? prevRow.weak_concepts : [];
    const prevStrong = Array.isArray(prevRow?.strong_concepts) ? prevRow.strong_concepts : [];
    const weakAdd = [];
    const strongAdd = [];
    for (const [cid, g] of gradedEntries) {
      const card = cards.find((x) => x.id === cid);
      const label = (card?.topic || card?.question || '').trim();
      if (!label) continue;
      if (g === 'ko') weakAdd.push(label);
      else strongAdd.push(label);
    }
    const mergeUnique = (a, b) => [...new Set([...a, ...b])];

    const { data: saved, error } = await upsertNeuroUserProgress(sessionId, {
      flashcards_attempted: nextA,
      flashcards_correct: nextC,
      comprehension_score: score,
      weak_concepts: mergeUnique(prevWeak, weakAdd),
      strong_concepts: mergeUnique(prevStrong, strongAdd),
      extra: {
        ...(typeof prevRow?.extra === 'object' && prevRow.extra ? prevRow.extra : {}),
        last_round_at: new Date().toISOString(),
        last_round_attempted: roundAttempted,
        last_round_correct: roundCorrect,
      },
    });
    setSavingProgress(false);
    if (error) {
      toast({
        title: 'Enregistrement impossible',
        description: error.message || String(error),
        variant: 'destructive',
      });
      return;
    }
    setProgressRow(saved ?? null);
    setGrades({});
    toast({
      title: 'Progression enregistrée',
      description: `Cette série : ${roundCorrect} / ${roundAttempted}. Total : ${nextC} / ${nextA}.`,
    });
  };

  if (loading) {
    return (
      <Section title="Révision NeuroRecall" icon={GraduationCap}>
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 text-[var(--school-accent,#D4AF37)] opacity-60 animate-spin" />
        </div>
      </Section>
    );
  }

  if (!cards.length && !reports.length) return null;

  return (
    <>
    <Section title="Révision NeuroRecall" icon={GraduationCap} defaultOpen>
      <p className={cn('text-white/45 leading-relaxed', compact ? 'text-[11px] mb-3' : 'text-xs mb-4')}>
        Cartes et fiches générées pour ce live (selon les droits d'accès). Utilisez-les pour réviser après la session.
      </p>
      {userId && cards.length > 0 ? (
        <div className="mb-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-white/40 font-semibold">Ma progression (flashcards)</p>
          {progressRow ? (
            <p className="text-xs text-white/70">
              Cumul : <span className="text-white font-medium">{progressRow.flashcards_correct}</span> /{' '}
              <span className="text-white/80">{progressRow.flashcards_attempted}</span> bonnes réponses
              {progressRow.comprehension_score != null && (
                <span className="text-white/50"> ({Math.round(Number(progressRow.comprehension_score))} %)</span>
              )}
            </p>
          ) : (
            <p className="text-xs text-white/45">Aucune série enregistrée pour ce live — notez-vous après chaque révision.</p>
          )}
          {roundAttempted > 0 && (
            <p className="text-[11px] text-[var(--school-accent,#D4AF37)] opacity-80">
              Série en cours : {roundCorrect} / {roundAttempted} « Je savais »
            </p>
          )}
          <button
            type="button"
            disabled={savingProgress || roundAttempted === 0}
            onClick={() => void saveProgress()}
            className={cn(
              'rounded-lg border text-[var(--school-accent,#D4AF37)] hover:bg-white/[0.06] disabled:opacity-40 disabled:pointer-events-none transition-colors text-[11px]',
              compact ? 'min-h-11 w-full px-3 py-2' : 'px-3 py-1.5',
            )}
            style={{
              backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 10%, transparent)',
              borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 40%, transparent)',
            }}
          >
            {savingProgress ? 'Enregistrement…' : 'Enregistrer ma progression'}
          </button>
        </div>
      ) : cards.length > 0 ? (
        <p className="text-[11px] text-amber-200/70 mb-4">Connectez-vous pour enregistrer votre progression sur les flashcards.</p>
      ) : null}
      {cards.length > 0 && (
        <div className="space-y-3 mb-6">
          <p className="text-[10px] uppercase tracking-wide text-white/40 font-semibold">
            Flashcards ({cards.length})
          </p>
          <div className={cn('grid gap-3', compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
            {cards.map((c) => (
              <NeuroRecallFlashcardRow
                key={c.id}
                cardId={c.id}
                question={c.question}
                answer={c.answer}
                topic={c.topic}
                difficulty={c.difficulty}
                userId={userId}
                grade={grades[c.id]}
                onGrade={handleGrade}
                compact={compact}
                onOpenSheet={compact ? (payload) => setFlashSheet(payload) : undefined}
              />
            ))}
          </div>
        </div>
      )}
      {reports.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-white/40 font-semibold">
            Rapports par thème ({reports.length})
          </p>
          <div className="space-y-2">
            {reports.map((r) => (
              <NeuroRecallReportRow
                key={r.id}
                title={r.title}
                nodeKey={r.node_key}
                content={r.content}
                compact={compact}
                timestamp={nodeTimestampMap[r.node_key] ?? null}
                replayUrl={replayUrl}
                onOpenSheet={compact ? (payload) => setReportSheet(payload) : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </Section>
    <NeuroRecallFlashcardFullSheet
      open={Boolean(flashSheet)}
      onClose={() => setFlashSheet(null)}
      cardId={flashSheet?.cardId}
      question={flashSheet?.question}
      answer={flashSheet?.answer}
      topic={flashSheet?.topic}
      difficulty={flashSheet?.difficulty}
      userId={userId}
      grade={flashSheet?.cardId ? grades[flashSheet.cardId] : undefined}
      onGrade={handleGrade}
    />
    <NeuroRecallReportFullSheet
      open={Boolean(reportSheet)}
      onClose={() => setReportSheet(null)}
      title={reportSheet?.title}
      nodeKey={reportSheet?.nodeKey}
      content={reportSheet?.content}
    />
    </>
  );
}

function FollowUpSection() {
  const navigate = useNavigate();
  const actions = [
    {
      icon: Calendar,
      label: 'Planifier un prochain RDV',
      desc: 'Continuez la progression avec un nouveau rendez-vous',
      color: 'amber',
      onClick: () => navigate('/secretariat-space?tab=rendez-vous'),
    },
    {
      icon: BookOpen,
      label: 'Proposer une formation',
      desc: 'Recommandez une formation adaptée au parcours',
      color: 'blue',
      onClick: () => navigate('/studio'),
    },
    {
      icon: Target,
      label: 'Plan de mentorat',
      desc: 'Structurez un accompagnement personnalisé long terme',
      color: 'purple',
      onClick: () => navigate('/studio'),
    },
  ];

  const colorMap = {
    amber:  'border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/5',
    blue:   'border-[#d4924a]/20 hover:border-[#d4924a]/40 hover:bg-[#d4924a]/5',
    purple: 'border-[#d97757]/20 hover:border-[#d97757]/40 hover:bg-[#d97757]/5',
  };
  const iconColor = {
    amber: 'text-amber-400', blue: 'text-[#e0a458]', purple: 'text-[#e08a5f]',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={a.onClick}
          className={cn(
            'rounded-xl border bg-white/[0.02] p-4 text-left transition-all',
            colorMap[a.color]
          )}
        >
          <a.icon className={cn('w-5 h-5 mb-2', iconColor[a.color])} />
          <p className="text-sm font-semibold text-white">{a.label}</p>
          <p className="text-xs text-white/40 mt-1 leading-relaxed">{a.desc}</p>
        </button>
      ))}
    </div>
  );
}

// ─── MindmapPanel ─────────────────────────────────────────────────────────────
function MindmapNode({ node, depth = 0 }) {
  const [open, setOpen] = useState(true);
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const indent = depth * 20;
  const isRoot = depth === 0;

  return (
    <div style={{ marginLeft: indent }}>
      <button
        type="button"
        onClick={() => hasChildren && setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 py-1.5 px-3 rounded-xl text-left w-full transition-colors',
          isRoot
            ? 'border text-[var(--school-accent,#D4AF37)] font-semibold text-sm mb-2'
            : depth === 1
              ? 'bg-white/[0.04] border border-white/[0.08] text-white/80 text-xs font-medium mb-1 hover:bg-white/[0.07]'
              : 'text-white/50 text-[11px] hover:text-white/70 mb-0.5'
        )}
        style={isRoot ? {
          backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 15%, transparent)',
          borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 30%, transparent)',
        } : undefined}
      >
        {hasChildren && (
          <ChevronRight className={cn('w-3 h-3 flex-shrink-0 transition-transform', open && 'rotate-90')} />
        )}
        {!hasChildren && depth > 0 && <span className="w-3 h-px bg-white/20 flex-shrink-0" />}
        <span className="leading-snug">{node.label}</span>
      </button>
      <AnimatePresence>
        {open && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden pl-2 border-l border-white/[0.06] ml-3"
          >
            {node.children.map((child) => (
              <MindmapNode key={child.id} node={child} depth={depth + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MindmapPanel({ sessionId, aiSummary, aiKeyPoints, neuronQuestions, disabled, compact = false }) {
  const [status,    setStatus]    = useState('idle');
  const [nodes,     setNodes]     = useState(null);
  const [error,     setError]     = useState('');
  const [expanded,  setExpanded]  = useState(false);

  const generate = async () => {
    if (status === 'loading') return;
    setStatus('loading');
    setError('');
    try {
      const { data, error: invErr } = await supabase.functions.invoke('liri-mindmap-generate', {
        body: {
          sessionId,
          summary: aiSummary,
          keyPoints: aiKeyPoints,
          questions: neuronQuestions,
        },
      });
      if (invErr) throw new Error(await getSupabaseFunctionErrorMessage(invErr));
      if (data?.error) throw new Error(String(data.error));
      setNodes(data?.nodes);
      setStatus('done');
      setExpanded(true);
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  };

  return (
    <div className="rounded-2xl border border-[#d97757]/15 bg-gradient-to-br from-[#d97757]/5 to-transparent overflow-hidden">
      <button
        type="button"
        onClick={() => status === 'done' ? setExpanded((v) => !v) : generate()}
        disabled={disabled && status === 'idle'}
        className={cn(
          'w-full flex items-center gap-3 text-left transition-colors',
          compact ? 'min-h-[3.25rem] px-4 py-3' : 'px-5 py-4',
          disabled && status === 'idle' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/[0.03]'
        )}
      >
        <div className="w-9 h-9 rounded-xl bg-[#d97757]/15 border border-[#d97757]/25 flex items-center justify-center flex-shrink-0">
          {status === 'loading'
            ? <Loader2 className="w-4 h-4 text-[#e08a5f] animate-spin" />
            : <Brain className="w-4 h-4 text-[#e08a5f]" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white/90">Carte mentale IA</p>
          <p className="text-xs text-white/40">
            {disabled && status === 'idle' && 'Générez d\'abord le résumé IA'}
            {!disabled && status === 'idle' && 'Générer la mindmap de cette session'}
            {status === 'loading' && 'Génération en cours…'}
            {status === 'done' && `${nodes?.[0]?.children?.length || 0} branches principales`}
            {status === 'error' && error}
          </p>
        </div>
        {status === 'done' && (
          expanded
            ? <ChevronUp className="w-4 h-4 text-white/30" />
            : <ChevronDown className="w-4 h-4 text-white/30" />
        )}
        {status === 'idle' && !disabled && (
          <span className="h-6 px-2.5 rounded-full bg-[#d97757]/20 border border-[#d97757]/30 text-[10px] font-semibold text-[#e8a97f]">
            Générer
          </span>
        )}
      </button>

      <AnimatePresence>
        {status === 'done' && expanded && nodes && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-white/[0.06] pt-4">
              {nodes.map((root) => (
                <MindmapNode key={root.id} node={root} depth={0} />
              ))}
              <button
                type="button"
                onClick={() => { setStatus('idle'); setNodes(null); setExpanded(false); }}
                className="mt-3 text-[10px] text-white/25 hover:text-white/50 transition-colors"
              >
                Regénérer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function LivePostIntelligencePage({ mobileLiriShell = false } = {}) {
  const { sessionId } = useParams();
  const { user }      = useAuth();
  const { branding, cssVars, shellTheme } = useTenantBranding();

  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [session,      setSession]      = useState(null);
  const [participants, setParticipants] = useState([]);
  const [messages,     setMessages]     = useState([]);
  const [recordings,   setRecordings]   = useState([]);
  const [notes,        setNotes]        = useState('');

  // ── IA Résumé ──────────────────────────────────────────────────────────────
  const [aiStatus,     setAiStatus]     = useState('idle'); // idle | loading | done | error
  const [aiSummary,    setAiSummary]    = useState('');
  const [aiKeyPoints,  setAiKeyPoints]  = useState([]);
  const [aiError,      setAiError]      = useState('');
  const [showAiPanel,  setShowAiPanel]  = useState(false);

  // ── NeuronQ questions ─────────────────────────────────────────────────────
  const [neuronQuestions, setNeuronQuestions] = useState([]);
  const [showNeuron,      setShowNeuron]      = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    async function load() {
      try {
        // 1. Session
        const { data: sess, error: sErr } = await supabase
          .from('live_sessions')
          .select('id, title, status, teacher_id, started_at, ended_at, post_notes')
          .eq('id', sessionId)
          .maybeSingle();
        if (sErr || !sess) throw new Error('Session introuvable');
        if (cancelled) return;

        const duration_seconds = sess.started_at && sess.ended_at
          ? Math.round((new Date(sess.ended_at) - new Date(sess.started_at)) / 1000)
          : null;
        setSession({ ...sess, duration_seconds });
        setNotes(sess.post_notes || '');

        // 2. Participants
        const { data: parts } = await supabase
          .from('live_session_participants')
          .select('user_id, role, joined_at, left_at, profiles(name, avatar_url)')
          .eq('live_session_id', sessionId);
        if (!cancelled) setParticipants(parts || []);

        // 3. Messages chat
        const { data: msgs } = await supabase
          .from('live_session_chat')
          .select('id, user_id, message, created_at, profiles(name)')
          .eq('live_session_id', sessionId)
          .order('created_at', { ascending: true });
        if (!cancelled) {
          setMessages(
            (msgs || []).map((m) => ({
              id:   m.id,
              text: m.message,
              name: m.profiles?.name || 'Participant',
              time: m.created_at,
            }))
          );
        }

        // 4. Enregistrements
        const { data: recs } = await supabase
          .from('live_recordings')
          .select('id, file_path, file_size, recorded_at')
          .eq('live_session_id', sessionId)
          .order('recorded_at', { ascending: false });

        if (!cancelled) {
          const withUrls = await Promise.all(
            (recs || []).map(async (r) => {
              const { data } = supabase.storage
                .from('live-recordings')
                .getPublicUrl(r.file_path);
              return { ...r, public_url: data?.publicUrl || null };
            })
          );
          setRecordings(withUrls);
        }

      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [sessionId]);

  // ── Charger questions Neuron-Q ─────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    supabase
      .from('live_neuronq_questions')
      .select('id, raw_text, reformulated_text, status, created_at')
      .eq('live_session_id', sessionId)
      .order('created_at', { ascending: true })
      .then(({ data }) => { if (data) setNeuronQuestions(data); })
      .catch(() => {});
  }, [sessionId]);

  // ── Générer résumé IA ──────────────────────────────────────────────────────
  const generateAiSummary = useCallback(async () => {
    if (!sessionId || aiStatus === 'loading') return;
    setAiStatus('loading');
    setAiError('');
    try {
      const durationSeconds = session?.duration_seconds || 0;
      const slidesCovered = []; // à enrichir si on a des méta-diapos

      const answeredQs  = neuronQuestions.filter((q) => q.status === 'answered');
      const skippedQs   = neuronQuestions.filter((q) => q.status === 'skipped');

      const { data, error: invErr } = await supabase.functions.invoke('liri-summary-generate', {
        body: {
          sessionId,
          participantName: session?.title || 'Session',
          durationSeconds,
          slidesCovered,
          questionsTotal:    neuronQuestions.length,
          questionsAnswered: answeredQs.length,
          questionsSkipped:  skippedQs.length,
          questions:         neuronQuestions.slice(0, 10),
        },
      });
      if (invErr) throw new Error(await getSupabaseFunctionErrorMessage(invErr));
      if (data?.error) throw new Error(String(data.error));

      setAiSummary(data.aiSummary || '');
      setAiKeyPoints(Array.isArray(data.keyPoints) ? data.keyPoints : []);
      setAiStatus('done');
      setShowAiPanel(true);
    } catch (err) {
      setAiError(err.message);
      setAiStatus('error');
    }
  }, [sessionId, session, neuronQuestions, aiStatus]);

  if (loading) {
    return (
      <div
        className={cn(
          'flex items-center justify-center',
          mobileLiriShell ? 'min-h-[40vh] py-12' : 'min-h-screen bg-[#05070c]',
        )}
        style={!mobileLiriShell ? {
          ...cssVars,
          background: 'var(--school-background, #05070c)',
          fontFamily: 'var(--school-font-family, Inter, sans-serif)',
        } : undefined}
      >
        <Loader2 className="w-8 h-8 text-[var(--school-accent,#D4AF37)] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-4 px-4 text-center',
          mobileLiriShell ? 'min-h-[40vh] py-12' : 'min-h-screen bg-[#05070c]',
        )}
        style={!mobileLiriShell ? {
          ...cssVars,
          background: 'var(--school-background, #05070c)',
          fontFamily: 'var(--school-font-family, Inter, sans-serif)',
        } : undefined}
      >
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-white/60">{error}</p>
        <Link
          to={mobileLiriShell ? LIRI_MOBILE.postLive : '/studio'}
          className="text-sm text-[var(--school-accent,#D4AF37)] hover:underline"
        >
          {mobileLiriShell ? '← Autre session' : '← Retour au studio'}
        </Link>
      </div>
    );
  }

  const msgCount  = messages.length;
  const partCount = participants.length;

  return (
    <div
      className={cn('text-white', mobileLiriShell ? 'min-h-0' : 'min-h-screen')}
      data-school-shell={mobileLiriShell ? 'liri-mobile-postproduction' : 'live-post-intelligence'}
      data-tenant-brand={branding.slug}
      style={{
        ...cssVars,
        background: mobileLiriShell ? undefined : 'var(--school-background, #05070c)',
        fontFamily: 'var(--school-font-family, Inter, sans-serif)',
      }}
    >

      {/* Header sticky */}
      <div
        className={cn(
          'border-b border-white/[0.06] backdrop-blur-xl sticky top-0 z-20',
          mobileLiriShell ? 'bg-[#0d0b09]/92 -mx-4 px-4' : '',
        )}
        style={!mobileLiriShell ? { background: shellTheme.topBarBackground } : undefined}
      >
        <div className="max-w-4xl mx-auto py-3 sm:py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to={mobileLiriShell ? LIRI_MOBILE.neuron : `/studio/live-preparation/${sessionId}`}
              className="flex items-center gap-1.5 text-sm text-white/50 hover:text-[var(--school-accent,#D4AF37)] transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              {mobileLiriShell ? 'Neuron' : 'Studio'}
            </Link>
            <div className="h-4 w-px bg-white/10 hidden sm:block" />
            <div className="flex-1 min-w-0">
              <h1 className="text-sm sm:text-base font-semibold truncate">
                {session?.title || 'Session sans titre'}
              </h1>
              {session?.ended_at && (
                <p className="text-[10px] sm:text-[11px] text-white/40">
                  Terminée {formatDistanceToNow(new Date(session.ended_at), { locale: fr, addSuffix: true })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2 sm:shrink-0">
            <div className="flex items-center gap-1.5 h-7 sm:h-6 px-3 rounded-full bg-[#5a8f52]/15 border border-[#5a8f52]/25">
              <CheckCircle2 className="w-3 h-3 text-[#7bb06a]" />
              <span className="text-[11px] text-[#9cc48a] font-medium">Terminée</span>
            </div>
            {!mobileLiriShell ? null : (
              <Link
                to={`/studio/live-post/${sessionId}`}
                className="text-[10px] px-2.5 py-1 rounded-lg border border-white/15 text-white/55 hover:text-white/85"
              >
                Vue studio
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className={cn('max-w-4xl mx-auto space-y-4 sm:space-y-5', mobileLiriShell ? 'px-0 py-4' : 'px-4 py-8')}>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <StatCard icon={Clock}         label="Durée"           value={fmtDuration(session?.duration_seconds)} color="amber"   />
          <StatCard icon={Users}          label="Participants"    value={partCount}                              color="emerald" />
          <StatCard icon={MessageSquare}  label="Messages"        value={msgCount}                               color="blue"    />
          <StatCard icon={Video}          label="Enregistrements" value={recordings.length}                      color="purple"  />
        </div>

        {/* ── Résumé IA ─────────────────────────────────────────────────────── */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{
            borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 20%, transparent)',
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--school-accent, #D4AF37) 5%, transparent), transparent)',
            borderRadius: 'var(--school-radius, 1rem)',
          }}
        >
          <button
            type="button"
            onClick={() => aiStatus === 'done' ? setShowAiPanel((v) => !v) : generateAiSummary()}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.03] transition-colors text-left"
          >
            <div
              className="w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 15%, transparent)',
                borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 25%, transparent)',
                borderRadius: 'var(--school-radius, 0.75rem)',
              }}
            >
              {aiStatus === 'loading'
                ? <Loader2 className="w-4 h-4 text-[var(--school-accent,#D4AF37)] animate-spin" />
                : <Brain className="w-4 h-4 text-[var(--school-accent,#D4AF37)]" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white/90">Résumé Intelligence Artificielle</p>
              <p className="text-xs text-white/40">
                {aiStatus === 'idle'   && 'Générer un résumé pédagogique + analyse Neuron-Q'}
                {aiStatus === 'loading'&& 'Analyse en cours…'}
                {aiStatus === 'done'   && `${aiKeyPoints.length} points clés identifiés`}
                {aiStatus === 'error'  && `Erreur — ${aiError}`}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {aiStatus === 'idle' && (
                <span
                  className="h-6 px-2.5 rounded-full border text-[10px] font-semibold"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 20%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 30%, transparent)',
                    color: 'var(--school-accent, #D4AF37)',
                  }}
                >
                  Générer
                </span>
              )}
              {aiStatus === 'done' && (
                showAiPanel
                  ? <ChevronUp className="w-4 h-4 text-white/30" />
                  : <ChevronDown className="w-4 h-4 text-white/30" />
              )}
            </div>
          </button>

          <AnimatePresence>
            {aiStatus === 'done' && showAiPanel && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5 space-y-4">
                  <div className="border-t border-white/[0.06] pt-4">
                    <p className="text-xs font-semibold text-[var(--school-accent,#D4AF37)] mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Résumé
                    </p>
                    <p className="text-sm text-white/75 leading-relaxed">{aiSummary}</p>
                  </div>

                  {aiKeyPoints.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-white/50 mb-2 flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5" /> Points clés
                      </p>
                      <ul className="space-y-1.5">
                        {aiKeyPoints.map((kp, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                            <Zap className="w-3.5 h-3.5 text-[var(--school-accent,#D4AF37)] flex-shrink-0 mt-0.5" />
                            {kp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {neuronQuestions.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowNeuron((v) => !v)}
                        className="flex items-center gap-2 text-xs font-semibold text-white/50 hover:text-white/80 transition-colors"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        Questions Neuron-Q ({neuronQuestions.length})
                        {showNeuron ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      <AnimatePresence>
                        {showNeuron && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden mt-2"
                          >
                            <div className="space-y-2">
                              {neuronQuestions.map((q) => (
                                <div key={q.id} className="flex items-start gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                  <span className={cn(
                                    'mt-0.5 w-2 h-2 rounded-full flex-shrink-0',
                                    q.status === 'answered' ? 'bg-[#7bb06a]' : q.status === 'skipped' ? 'bg-red-400/60' : 'bg-amber-400/60'
                                  )} />
                                  <p className="text-xs text-white/65 leading-relaxed">
                                    {q.reformulated_text || q.raw_text}
                                  </p>
                                  <span className="ml-auto text-[9px] capitalize text-white/25 flex-shrink-0">{q.status || 'posée'}</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => { setAiStatus('idle'); setAiSummary(''); setAiKeyPoints([]); setShowAiPanel(false); }}
                    className="text-[10px] text-white/25 hover:text-white/50 transition-colors"
                  >
                    Regénérer
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Mindmap IA ──────────────────────────────────────────────────── */}
        <MindmapPanel
          sessionId={sessionId}
          aiSummary={aiSummary}
          aiKeyPoints={aiKeyPoints}
          neuronQuestions={neuronQuestions}
          disabled={aiStatus !== 'done'}
          compact={mobileLiriShell}
        />

        <NeuroRecallPanel
          sessionId={sessionId}
          isTeacher={Boolean(user?.id && session?.teacher_id === user.id)}
          lirSummaryReady={aiStatus === 'done' && Boolean(aiSummary)}
          compact={mobileLiriShell}
        />

        <NeuroRecallRevisionSection sessionId={sessionId} userId={user?.id} compact={mobileLiriShell} />

        {/* Replay */}
        <Section title="Replay" icon={Play} defaultOpen>
          <ReplayPlayer recordings={recordings} />
        </Section>

        {/* Notes */}
        <Section title="Notes & Points clés" icon={FileText} defaultOpen>
          <NotesEditor sessionId={sessionId} initialNotes={notes} />
        </Section>

        {/* Participants */}
        <Section title={`Participants (${partCount})`} icon={Users}>
          <div className="space-y-2 pt-1">
            {participants.map((p) => (
              <div key={p.user_id} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                <div
                  className="w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 20%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 30%, transparent)',
                    color: 'var(--school-accent, #D4AF37)',
                  }}
                >
                  {(p.profiles?.name || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80">{p.profiles?.name || p.user_id}</p>
                  <p className="text-[10px] text-white/40 capitalize">{p.role}</p>
                </div>
                {p.joined_at && p.left_at && (
                  <span className="text-[10px] text-white/30">
                    {fmtDuration(Math.round((new Date(p.left_at) - new Date(p.joined_at)) / 1000))}
                  </span>
                )}
              </div>
            ))}
            {!participants.length && (
              <p className="text-sm text-white/30 py-4">Aucun participant enregistré.</p>
            )}
          </div>
        </Section>

        {/* Chat replay */}
        <Section title={`Chat (${msgCount} messages)`} icon={MessageSquare}>
          <ChatReplay messages={messages} />
        </Section>

        {/* Transcript multilingue LIRI */}
        <Section title="Transcript multilingue (LIRI)" icon={Languages}>
          <MultilangReplaySection sessionId={sessionId} />
        </Section>

        {/* Export */}
        <Section title="Export & Partage" icon={Download}>
          <ExportSection
            session={session}
            participants={participants}
            messages={messages}
            notes={notes}
          />
        </Section>

        {/* Suivi */}
        <Section title="Actions de suivi" icon={TrendingUp} defaultOpen>
          <FollowUpSection />
        </Section>

      </div>
    </div>
  );
}
