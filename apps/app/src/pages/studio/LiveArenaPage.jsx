/**
 * LiveArenaPage — Salle immersive complète (shell OBS : LiveRoomShell)
 * Route: /studio/live-arena-obs/:sessionId (voir StudioRouter — live-arena sans -obs = LiveHostPage LIRI)
 *
 * Connexions:
 *   - LiveKit (Room, tracks vidéo/audio, screen share)
 *   - Supabase Realtime (chat live, participants)
 *   - MediaRecorder → Supabase Storage (enregistrement)
 *   - LiveRoomShell (UI OBS)
 *   - SmartBoardCompositor (scènes: smartboard natif / diapo importé / …)
 */
import React, {
  useEffect, useRef, useState, useCallback, useMemo,
} from 'react';
import { Capacitor } from '@capacitor/core';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Room, RoomEvent, Track, VideoPresets, ConnectionState,
} from 'livekit-client';
import { supabase } from '@/lib/customSupabaseClient';
import { getSupabaseFunctionErrorMessage } from '@/lib/supabaseEdgeInvoke';
import { broadcastRealtime } from '@/lib/realtimeBroadcast';
import { sanitizeAnnotationStrokesForBroadcast, ANNOTATION_BROADCAST_MAX_STROKES } from '@/lib/annotationStrokes';
import {
  whiteboardBroadcastPatch,
  mergeWhiteboardFromPayload,
  normalizeWhiteboardPages,
  WHITEBOARD_MAX_PAGES,
} from '@/lib/whiteboardPagesSync';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import useTenantBranding from '@/hooks/useTenantBranding';
import { useLiveSessionWhispers } from '@/hooks/useLiveSessionWhispers';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import LiveRoomShell from '@/components/live-room/LiveRoomShell';
import LiveControlsBar from '@/components/live-room/LiveControlsBar';
import SmartboardSceneDockHorizontal from '@/components/live-room/SmartboardSceneDockHorizontal';
import LiveHostLayoutPreviewModal from '@/components/live-room/LiveHostLayoutPreviewModal';
import LiveStudioSettingsPanel from '@/components/live-room/LiveStudioSettingsPanel';
import DebateVoteStrip from '@/components/live-room/DebateVoteStrip';
import { createLiveRoom, getLiveKitToken } from '@/services/livekitApi';
import {
  Loader2, AlertTriangle, Video, Radio, Mic, MicOff,
  Circle, Square, CheckCircle2, Users, Copy,
  ChevronDown, ChevronUp,
  Settings2, Camera, Mic2, Check, X as XIcon, Swords, Sparkles,
} from 'lucide-react';
import { normalizeLiveSceneToSlide, buildLiveScenesFromUploadedSlides } from '@/lib/liveSceneNormalize';
import {
  mergeSmartboardSceneFlags,
  navigatorSceneIds,
  buildSmartboardNavigatorScenes,
} from '@/lib/smartboardNavigatorScenes';
import {
  shouldMergeLiriHostMocks,
  mergeParticipantsWithMocks,
  mergeRaisedHandsWithMocks,
  getMockSlidesNormalized,
  LIRI_MOCK_SCRIPT_SECTIONS,
} from '@/lib/liriHostUiMocks';
import { getCameraTrackByIdentity } from '@/lib/livekitCameraUtils';
import { getStableLiveKitRoomOptions, stableLiveKitConnectOptions } from '@/lib/livekitStableClient';
import { demoLiriAudioScenes, normalizeLiriAudioScenes } from '@/lib/liriAudioScene';
import { useLiriCompactLiveUiState } from '@/hooks/useLiriCompactLiveUiState';
import { LIRI_LIVE_ARENA_COMPACT_MAX_CSS_PX } from '@/hooks/useLiriMobileBreakpoint';
import { useMobileLiriStore } from '@/stores/mobileLiriStore';
import { buildMaquettePlanRibbon, buildMaquetteSceneLineCaption } from '@/lib/liriMobilePlanRibbon';
import { playLiriHostEventChime } from '@/lib/liriHostEventChime';
import { GestureOverlayController } from '@/components/liri-mobile/GestureOverlayController';
import { LiriMobileOverlaysRoot } from '@/components/liri-mobile/LiriMobileOverlaysRoot';
import { proColors, proRadii, proType } from '@/components/studio-pro';
import { formatJoinCodeDisplay } from '@/lib/liveJoinCode';

// ─── Phases du live ────────────────────────────────────────────────────────────
const PHASE = {
  LOADING:    'loading',
  CONNECTING: 'connecting',
  LIVE:       'live',
  ERROR:      'error',
  ENDED:      'ended',
};

// ─── Correspondance Source → scène SmartBoard ──────────────────────────────────
const SCENE_FROM_SOURCE = {
  [Track.Source.ScreenShare]: 'screen',
  [Track.Source.Camera]:      'smartboard',
};

// ─── Formatage durée ───────────────────────────────────────────────────────────
function useLiveDuration(startedAt) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const base = Date.now() - new Date(startedAt).getTime();
    setSeconds(Math.floor(base / 1000));
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatCountdownSeconds(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/** Aligne debate_rounds avec les champs arena_* du débat (modérateur uniquement côté RLS). */
async function syncDebateRoundsWithArenaPartial(prev, partial) {
  if (!prev?.debateId) return;
  const id = prev.debateId;
  const oldRound = Math.min(50, Math.max(1, Number(prev.arenaCurrentRound) || 1));
  const newRound = Object.prototype.hasOwnProperty.call(partial, 'arena_current_round')
    ? Math.min(50, Math.max(1, Number(partial.arena_current_round) || 1))
    : oldRound;
  const newSide = Object.prototype.hasOwnProperty.call(partial, 'arena_active_side')
    ? partial.arena_active_side
    : prev.arenaActiveSide;
  const iso = new Date().toISOString();

  if (Object.prototype.hasOwnProperty.call(partial, 'arena_current_round') && newRound !== oldRound) {
    if (newRound > oldRound) {
      await supabase
        .from('debate_rounds')
        .update({ status: 'completed', ended_at: iso })
        .eq('debate_id', id)
        .eq('round_number', oldRound);
    }
    await supabase
      .from('debate_rounds')
      .update({
        active_side: newSide,
        status: newSide ? 'active' : 'pending',
        started_at: iso,
      })
      .eq('debate_id', id)
      .eq('round_number', newRound);
  } else if (Object.prototype.hasOwnProperty.call(partial, 'arena_active_side')) {
    await supabase
      .from('debate_rounds')
      .update({
        active_side: newSide,
        status: newSide ? 'active' : 'pending',
      })
      .eq('debate_id', id)
      .eq('round_number', newRound);
  }
}

// ─── Bandeau DebateCore (session liée à debates.debate_id) ───────────────────
const DEBATE_ARENA_PHASES = [
  { value: 'live', label: 'Match' },
  { value: 'interactive_exchange', label: 'Échange libre' },
  { value: 'audience_questions', label: 'Q&R public' },
  { value: 'round_break', label: 'Pause' },
  { value: 'finished', label: 'Terminé' },
];

const DEBATE_STATUS_LABELS = {
  draft: 'Brouillon',
  awaiting_debaters: 'Attente débatteurs',
  preparing: 'Préparation',
  ready_to_start: 'Prêt',
  live: 'Match',
  interactive_exchange: 'Échange libre',
  audience_questions: 'Q&R public',
  round_break: 'Pause',
  finished: 'Terminé',
  archived: 'Archivé',
};

/** Points composites sur rounds terminés : voix normalisées 0–10 + pondération IA si scores IA présents. */
function computeDebateBlendedTotals(rounds, aiWeight) {
  const w = Math.min(1, Math.max(0, Number(aiWeight) || 0));
  if (!rounds?.length) return null;
  let sumA = 0;
  let sumB = 0;
  let count = 0;
  for (const row of rounds) {
    if (row.status !== 'completed') continue;
    const ha = Number(row.score_a) || 0;
    const hb = Number(row.score_b) || 0;
    const tot = ha + hb;
    const normA = tot > 0 ? (10 * ha) / tot : 5;
    const normB = tot > 0 ? (10 * hb) / tot : 5;
    const ia = row.ai_score_a != null && row.ai_score_a !== '' ? Number(row.ai_score_a) : null;
    const ib = row.ai_score_b != null && row.ai_score_b !== '' ? Number(row.ai_score_b) : null;
    if (ia != null && !Number.isNaN(ia) && ib != null && !Number.isNaN(ib)) {
      sumA += (1 - w) * normA + w * ia;
      sumB += (1 - w) * normB + w * ib;
    } else {
      sumA += normA;
      sumB += normB;
    }
    count += 1;
  }
  if (!count) return null;
  return { sumA, sumB, count, w };
}

function DebateModeBanner({ debate, liveVoteCounts }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!debate?.arenaTurnDeadline) return undefined;
    const id = setInterval(() => setNow(Date.now()), 300);
    return () => clearInterval(id);
  }, [debate?.arenaTurnDeadline]);

  const remainSec = useMemo(() => {
    if (!debate?.arenaTurnDeadline) return null;
    const end = new Date(debate.arenaTurnDeadline).getTime();
    if (Number.isNaN(end)) return null;
    return Math.max(0, Math.ceil((end - now) / 1000));
  }, [debate?.arenaTurnDeadline, now]);

  const blended = useMemo(
    () =>
      debate?.aiJudgeEnabled
        ? computeDebateBlendedTotals(debate?.rounds, debate?.aiWeight)
        : null,
    [debate?.aiJudgeEnabled, debate?.aiWeight, debate?.rounds],
  );

  const phaseHint = useMemo(() => {
    const st = debate?.status;
    if (!st || st === 'live') return null;
    const nq = debate?.neuronqEnabled !== false;
    if (st === 'audience_questions') {
      return nq
        ? 'File de questions : bouton NeuronQ en bas de l\'écran — le modérateur peut activer le mode Q&R (zone 3).'
        : 'Phase Q&R public — chat live disponible ; NeuronQ est désactivé pour ce débat.';
    }
    if (st === 'interactive_exchange') {
      return 'Échange libre — parole et chrono pilotés par le modérateur (panneau débat).';
    }
    if (st === 'round_break') {
      return 'Pause — reprendre avec Pilotage débat → Phase → Match.';
    }
    if (st === 'finished') {
      return 'Débat clôturé — vous pouvez quitter la salle.';
    }
    return null;
  }, [debate?.status, debate?.neuronqEnabled]);

  if (!debate) return null;
  const roleLabel =
    debate.myRole === 'moderator'
      ? 'Modérateur'
      : debate.myRole === 'debater'
        ? `Débatteur · camp ${debate.mySide || '?'}`
        : debate.myRole === 'viewer'
          ? 'Spectateur'
          : null;

  const roundIdx = Math.min(
    Math.max(1, Number(debate.arenaCurrentRound) || 1),
    Math.max(1, Number(debate.roundCount) || 1),
  );
  const floorLabel =
    debate.arenaActiveSide === 'A'
      ? 'Parole · camp A'
      : debate.arenaActiveSide === 'B'
        ? 'Parole · camp B'
        : 'Parole · —';

  const roundRow = debate.rounds?.find((x) => x.round_number === roundIdx);
  const votingOpen = roundRow?.status === 'voting';
  const roundTitle = roundRow?.round_label?.trim();
  const roundBrief = roundRow?.brief_public?.trim();
  const curIa =
    roundRow?.ai_score_a != null &&
    roundRow?.ai_score_b != null &&
    !Number.isNaN(Number(roundRow.ai_score_a)) &&
    !Number.isNaN(Number(roundRow.ai_score_b))
      ? { a: Number(roundRow.ai_score_a), b: Number(roundRow.ai_score_b) }
      : null;

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[52] w-[min(94vw,780px)] pointer-events-none">
      <div className="rounded-2xl border border-rose-500/35 bg-[#1a0f14]/92 backdrop-blur-xl px-4 py-2.5 shadow-lg shadow-black/40">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-center">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="text-[10px] uppercase tracking-widest text-rose-300/90 font-semibold">DebateCore</span>
          </div>
          <span className="text-sm font-medium text-white/90 truncate max-w-[48vw]">{debate.title}</span>
          {debate.status && debate.status !== 'live' ? (
            <span className="text-[10px] text-cyan-200/85 border border-cyan-500/30 rounded-full px-2 py-0.5">
              {DEBATE_STATUS_LABELS[debate.status] || debate.status}
            </span>
          ) : null}
          <span className="text-[11px] text-sky-200/85 font-medium tabular-nums">
            Round {roundIdx}/{debate.roundCount}
            {roundTitle ? ` · ${roundTitle}` : ''} · {floorLabel}
          </span>
          {remainSec != null ? (
            <span
              className={cn(
                'text-[12px] font-mono font-semibold tabular-nums',
                remainSec <= 10 ? 'text-amber-400' : 'text-white/80',
              )}
            >
              {formatCountdownSeconds(remainSec)}
            </span>
          ) : null}
          <span className="text-[11px] text-white/45 tabular-nums">
            Voix cumulées A {debate.scoreA} · B {debate.scoreB}
          </span>
          {curIa ? (
            <span className="text-[11px] text-amber-200/80 tabular-nums">
              IA round {roundIdx} · A {curIa.a.toFixed(1)} · B {curIa.b.toFixed(1)} (0–10)
            </span>
          ) : null}
          {blended ? (
            <span className="text-[11px] text-emerald-200/75 tabular-nums w-full">
              Composite ({Math.round(blended.w * 100)}% IA, rounds terminés {blended.count}) · A{' '}
              {blended.sumA.toFixed(1)} · B {blended.sumB.toFixed(1)}
            </span>
          ) : null}
          {votingOpen && liveVoteCounts ? (
            <span className="text-[11px] text-violet-200/90 tabular-nums">
              Votes · A {liveVoteCounts.a} · = {liveVoteCounts.tie} · B {liveVoteCounts.b}
              {liveVoteCounts.total > 0 ? ` (${liveVoteCounts.total})` : ''}
            </span>
          ) : null}
          {roleLabel ? (
            <span className="text-[10px] text-amber-200/80 border border-amber-500/25 rounded-full px-2 py-0.5">{roleLabel}</span>
          ) : null}
          {debate.myRole === 'viewer' ? (
            <span className="text-[10px] text-white/40 w-full">Caméra désactivée pour le public</span>
          ) : null}
          {roundBrief ? (
            <p className="w-full text-center text-[10px] text-white/50 leading-snug line-clamp-2 px-1 mt-0.5">
              {roundBrief}
            </p>
          ) : null}
          {phaseHint ? (
            <p className="w-full text-center text-[10px] text-sky-200/70 leading-snug px-2 border-t border-white/10 pt-1.5 mt-0.5">
              {phaseHint}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Pilotage débat (hôte / modérateur session) ──────────────────────────────
function DebateModeratorPanel({
  debate,
  busy,
  onPatch,
  roundStatus,
  onOpenVoting,
  onCloseVoting,
  liveVoteCounts,
  aiJudgeEnabled,
  aiJudgeBusy,
  aiReportPreview,
  onRunAiJudge,
}) {
  const [open, setOpen] = useState(true);
  const debateAiWeightPatchDebounceRef = useRef(null);
  const [debateAiWeightLocalPct, setDebateAiWeightLocalPct] = useState(null);

  const patch = (p) => {
    if (!busy) void onPatch(p);
  };

  const debateAiWeightPctDisplay = useMemo(() => {
    if (debateAiWeightLocalPct != null) return debateAiWeightLocalPct;
    const w = Number(debate?.aiWeight);
    return Math.min(100, Math.max(0, Math.round((Number.isFinite(w) && !Number.isNaN(w) ? w : 0.3) * 100)));
  }, [debateAiWeightLocalPct, debate?.aiWeight]);

  const scheduleDebateAiWeightPatch = useCallback(
    (pct) => {
      if (debateAiWeightPatchDebounceRef.current) clearTimeout(debateAiWeightPatchDebounceRef.current);
      debateAiWeightPatchDebounceRef.current = setTimeout(() => {
        debateAiWeightPatchDebounceRef.current = null;
        if (busy) return;
        const v = Math.min(1, Math.max(0, pct / 100));
        void onPatch({ ai_weight: v });
      }, 400);
    },
    [busy, onPatch],
  );

  const onDebateAiWeightRangeChange = useCallback(
    (e) => {
      const pct = Math.min(100, Math.max(0, Number(e.target.value)));
      if (!Number.isFinite(pct)) return;
      setDebateAiWeightLocalPct(pct);
      scheduleDebateAiWeightPatch(pct);
    },
    [scheduleDebateAiWeightPatch],
  );

  useEffect(() => {
    setDebateAiWeightLocalPct(null);
  }, [debate?.debateId]);

  useEffect(() => {
    setDebateAiWeightLocalPct(null);
  }, [debate?.aiWeight]);

  useEffect(() => {
    if (!debate?.aiJudgeEnabled) setDebateAiWeightLocalPct(null);
  }, [debate?.aiJudgeEnabled]);

  useEffect(
    () => () => {
      if (debateAiWeightPatchDebounceRef.current) {
        clearTimeout(debateAiWeightPatchDebounceRef.current);
        debateAiWeightPatchDebounceRef.current = null;
      }
    },
    [],
  );

  if (!debate) return null;

  const r = Math.min(
    Math.max(1, Number(debate.arenaCurrentRound) || 1),
    Math.max(1, Number(debate.roundCount) || 1),
  );
  const sec = Math.max(30, Math.min(7200, Number(debate.secondsPerTurn) || 300));
  const voting = roundStatus === 'voting';

  return (
    <div className="absolute bottom-24 left-4 z-[60] max-w-[min(92vw,340px)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-2 flex items-center gap-2 h-8 px-3 rounded-xl bg-black/75 border border-rose-500/30 text-[11px] text-rose-200/90 hover:bg-black/85 backdrop-blur-md pointer-events-auto"
      >
        <Swords className="w-3.5 h-3.5" />
        Pilotage débat
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>
      {open ? (
        <div className="rounded-2xl border border-white/12 bg-black/82 backdrop-blur-xl p-3 space-y-2.5 pointer-events-auto shadow-xl">
          <p className="text-[10px] uppercase tracking-wide text-white/40">Phase débat</p>
          <p className="text-[10px] text-white/45">
            Actuel :{' '}
            <span className="text-cyan-200/90">
              {DEBATE_STATUS_LABELS[debate.status] || debate.status || '—'}
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {DEBATE_ARENA_PHASES.map((ph) => (
              <button
                key={ph.value}
                type="button"
                disabled={busy || debate.status === ph.value}
                onClick={() => patch({ status: ph.value })}
                className={cn(
                  'h-7 px-2 rounded-lg text-[10px] font-medium border transition-colors disabled:opacity-40',
                  debate.status === ph.value
                    ? 'border-cyan-400/45 bg-cyan-500/20 text-cyan-100'
                    : 'border-white/12 bg-white/[0.04] text-white/75 hover:bg-white/10',
                )}
              >
                {ph.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] uppercase tracking-wide text-white/40">NeuronQ</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={busy || debate.neuronqEnabled !== false}
              onClick={() => patch({ neuronq_enabled: true })}
              className={cn(
                'h-7 px-2 rounded-lg text-[10px] font-medium border transition-colors disabled:opacity-40',
                debate.neuronqEnabled !== false
                  ? 'border-cyan-400/45 bg-cyan-500/20 text-cyan-100'
                  : 'border-white/12 bg-white/[0.04] text-white/75 hover:bg-white/10',
              )}
            >
              Activé
            </button>
            <button
              type="button"
              disabled={busy || debate.neuronqEnabled === false}
              onClick={() => patch({ neuronq_enabled: false })}
              className={cn(
                'h-7 px-2 rounded-lg text-[10px] font-medium border transition-colors disabled:opacity-40',
                debate.neuronqEnabled === false
                  ? 'border-rose-400/40 bg-rose-500/15 text-rose-100'
                  : 'border-white/12 bg-white/[0.04] text-white/75 hover:bg-white/10',
              )}
            >
              Désactivé
            </button>
          </div>
          <p className="text-[10px] uppercase tracking-wide text-white/40">Juge IA</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={busy || debate.aiJudgeEnabled === true}
              onClick={() => patch({ ai_judge_enabled: true })}
              className={cn(
                'h-7 px-2 rounded-lg text-[10px] font-medium border transition-colors disabled:opacity-40',
                debate.aiJudgeEnabled
                  ? 'border-amber-400/50 bg-amber-500/20 text-amber-100'
                  : 'border-white/12 bg-white/[0.04] text-white/75 hover:bg-white/10',
              )}
            >
              Activé
            </button>
            <button
              type="button"
              disabled={busy || debate.aiJudgeEnabled === false}
              onClick={() => patch({ ai_judge_enabled: false })}
              className={cn(
                'h-7 px-2 rounded-lg text-[10px] font-medium border transition-colors disabled:opacity-40',
                !debate.aiJudgeEnabled
                  ? 'border-rose-400/40 bg-rose-500/15 text-rose-100'
                  : 'border-white/12 bg-white/[0.04] text-white/75 hover:bg-white/10',
              )}
            >
              Désactivé
            </button>
          </div>
          {debate.aiJudgeEnabled ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wide text-white/40">Poids IA (composite)</p>
                <span className="text-[10px] font-semibold tabular-nums text-amber-200/90">{debateAiWeightPctDisplay}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                disabled={busy}
                value={debateAiWeightPctDisplay}
                onChange={onDebateAiWeightRangeChange}
                aria-label="Pondération du score IA dans le composite"
                className="w-full h-2 accent-amber-500 disabled:opacity-40 cursor-pointer disabled:cursor-default"
              />
              <p className="text-[9px] text-white/30 leading-snug">
                Part du score IA vs voix cumulées (bandeau composite). Envoi différé 400&nbsp;ms.
              </p>
            </div>
          ) : null}
          <p className="text-[10px] uppercase tracking-wide text-white/40">Parole</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => patch({ arena_active_side: 'A' })}
              className={cn(
                'h-8 px-3 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40',
                debate.arenaActiveSide === 'A'
                  ? 'bg-rose-600/50 border-rose-400/50 text-white'
                  : 'bg-white/5 border-white/15 text-white/80 hover:bg-white/10',
              )}
            >
              Camp A
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => patch({ arena_active_side: 'B' })}
              className={cn(
                'h-8 px-3 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40',
                debate.arenaActiveSide === 'B'
                  ? 'bg-sky-600/45 border-sky-400/45 text-white'
                  : 'bg-white/5 border-white/15 text-white/80 hover:bg-white/10',
              )}
            >
              Camp B
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => patch({ arena_active_side: null })}
              className="h-8 px-2 rounded-lg text-[11px] border border-white/15 text-white/50 hover:bg-white/5 disabled:opacity-40"
            >
              Neutre
            </button>
          </div>
          <p className="text-[10px] uppercase tracking-wide text-white/40">Chrono tour ({Math.round(sec / 60)} min)</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const end = new Date(Date.now() + sec * 1000).toISOString();
                patch({ arena_turn_deadline: end });
              }}
              className="h-8 px-3 rounded-lg bg-amber-600/70 hover:bg-amber-600 text-xs font-medium disabled:opacity-40"
            >
              Démarrer
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => patch({ arena_turn_deadline: null })}
              className="h-8 px-3 rounded-lg border border-white/15 text-xs text-white/70 hover:bg-white/5 disabled:opacity-40"
            >
              Stop
            </button>
          </div>
          <p className="text-[10px] uppercase tracking-wide text-white/40">Round</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || r <= 1}
              onClick={() => patch({ arena_current_round: r - 1 })}
              className="h-8 w-10 rounded-lg border border-white/15 text-sm disabled:opacity-30 hover:bg-white/5"
            >
              −
            </button>
            <span className="text-sm tabular-nums text-white/85 min-w-[4.5rem] text-center">
              {r} / {debate.roundCount}
            </span>
            <button
              type="button"
              disabled={busy || r >= debate.roundCount}
              onClick={() => patch({ arena_current_round: r + 1 })}
              className="h-8 w-10 rounded-lg border border-white/15 text-sm disabled:opacity-30 hover:bg-white/5"
            >
              +
            </button>
          </div>
          <p className="text-[10px] uppercase tracking-wide text-white/40">Vote du round</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || voting}
              onClick={() => void onOpenVoting?.()}
              className="h-8 px-3 rounded-lg bg-violet-600/70 hover:bg-violet-600 text-xs font-medium disabled:opacity-40"
            >
              Ouvrir vote
            </button>
            <button
              type="button"
              disabled={busy || !voting}
              onClick={() => void onCloseVoting?.()}
              className="h-8 px-3 rounded-lg border border-white/15 text-xs text-white/75 hover:bg-white/5 disabled:opacity-40"
            >
              Clore vote
            </button>
          </div>
          {voting && liveVoteCounts ? (
            <p className="text-[10px] text-violet-200/85 tabular-nums">
              A {liveVoteCounts.a} · = {liveVoteCounts.tie} · B {liveVoteCounts.b}
              {liveVoteCounts.total > 0 ? ` · ${liveVoteCounts.total} voix` : ''}
            </p>
          ) : null}
          {aiJudgeEnabled ? (
            <div className="pt-1 border-t border-white/10 space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-white/40">Juge IA</p>
              <button
                type="button"
                disabled={busy || aiJudgeBusy}
                onClick={() => void onRunAiJudge?.()}
                className="h-8 w-full rounded-lg border border-amber-500/35 bg-amber-500/15 hover:bg-amber-500/25 text-[11px] font-medium text-amber-100/90 flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0 opacity-90" />
                {aiJudgeBusy ? 'Analyse en cours…' : `Noter le round ${r} (IA)`}
              </button>
              <p className="text-[9px] text-white/30 leading-snug">
                Sans transcript : grille indicative seulement (voir synthèse).
              </p>
              {aiReportPreview?.summary ? (
                <div className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 space-y-1">
                  <p className="text-[10px] text-amber-200/80 tabular-nums">
                    IA · A {Number(aiReportPreview.score_a).toFixed(1)} / B {Number(aiReportPreview.score_b).toFixed(1)}
                  </p>
                  <p className="text-[10px] text-white/55 leading-snug line-clamp-4 whitespace-pre-wrap">
                    {aiReportPreview.summary}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
          {busy ? <p className="text-[10px] text-white/35">Enregistrement…</p> : null}
        </div>
      ) : null}
    </div>
  );
}

// ─── Indicateur statut en overlay ─────────────────────────────────────────────
function LiveStatusBadge({ phase, duration, participantCount, recording }) {
  if (phase !== PHASE.LIVE) return null;
  /** Badges bande de statut — style DaVinci/Premiere Pro : compact, mat, tabulaire. */
  const baseBadge = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 22,
    padding: '0 10px',
    borderRadius: proRadii.sm,
    background: 'rgba(18,18,22,0.88)',
    border: `1px solid ${proColors.border}`,
    backdropFilter: 'blur(10px)',
    fontFamily: proType.ui,
    fontSize: proType.xxs,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: 600,
  };
  return (
    <div
      className="absolute z-50 flex items-center gap-1.5"
      style={{ top: 10, left: '50%', transform: 'translateX(-50%)' }}
    >
      <div
        style={{
          ...baseBadge,
          borderColor: 'rgba(224,75,63,0.45)',
          color: '#F87171',
        }}
      >
        <span
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: proColors.rec,
            boxShadow: '0 0 8px rgba(224,75,63,0.65)',
            animation: 'proPulse 1.4s infinite',
          }}
        />
        <span>EN DIRECT</span>
        <span
          style={{
            color: proColors.textSecondary,
            fontFamily: proType.mono,
            letterSpacing: '0.02em',
            textTransform: 'none',
            marginLeft: 2,
          }}
        >
          {duration}
        </span>
      </div>
      <div style={{ ...baseBadge, color: proColors.textSecondary }}>
        <Video size={10} strokeWidth={1.75} style={{ color: proColors.textMuted }} />
        <span style={{ fontFamily: proType.mono, letterSpacing: '0.02em', textTransform: 'none' }}>
          {participantCount}
        </span>
      </div>
      {recording && (
        <div
          style={{
            ...baseBadge,
            borderColor: 'rgba(255,176,64,0.45)',
            color: proColors.warn,
          }}
        >
          <Circle size={8} fill={proColors.warn} stroke={proColors.warn} />
          <span>REC</span>
        </div>
      )}
    </div>
  );
}

// ─── Écran de chargement / erreur ─────────────────────────────────────────────
function PhaseScreen({ phase, error, sessionId, isHost, recoveryAsHost, joinCode }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { branding, cssVars } = useTenantBranding();
  const studioRecovery = recoveryAsHost ?? isHost;
  const phaseScreenStyle = {
    ...cssVars,
    background: 'var(--school-background, #05070c)',
    fontFamily: 'var(--school-font-family, Inter, sans-serif)',
  };

  useEffect(() => {
    if (phase !== PHASE.ENDED || isHost) return undefined;
    const t = setTimeout(() => navigate('/lives', { replace: true }), 10000);
    return () => clearTimeout(t);
  }, [phase, isHost, navigate]);
  if (phase === PHASE.LOADING || phase === PHASE.CONNECTING) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-6"
        data-school-shell="live-arena-phase"
        data-tenant-brand={branding.slug}
        style={phaseScreenStyle}
      >
        <div className="relative flex flex-col items-center gap-3 py-1">
          {/* Cercle d'attente : centré sur le bloc logo + titres (pas ancré en bas) */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[min(24rem,88vw)] w-[min(24rem,88vw)] -translate-x-1/2 -translate-y-1/2 rounded-full border animate-ping [animation-duration:2.25s]"
            style={{ borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 18%, transparent)' }}
            aria-hidden
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 h-16 w-16 rounded-2xl border bg-[#0b1220]/85 p-2"
            style={{
              borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 30%, transparent)',
              boxShadow: '0 0 40px -20px color-mix(in srgb, var(--school-accent, #D4AF37) 55%, transparent)',
            }}
          >
            <img
              src="/liri-logo-mark.png"
              alt="LIRI"
              className="h-full w-full object-contain"
            />
          </motion.div>
          <div className="relative z-10 text-center">
            <div className="flex justify-center">
              <LiriWordmark size="compact" className="text-[var(--school-accent,#D4AF37)] opacity-85" />
            </div>
            <p className="text-[11px] text-white/45">Immersive Live Studio</p>
          </div>
        </div>
        <div className="relative">
          <div
            className="w-14 h-14 rounded-full border-2 flex items-center justify-center"
            style={{ borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 20%, transparent)' }}
          >
            <Loader2 className="w-6 h-6 text-[var(--school-accent,#D4AF37)] animate-spin" />
          </div>
        </div>
        <div className="text-center -mt-1">
          <p className="text-white font-semibold text-lg">
            {phase === PHASE.LOADING ? 'Préparation du live…' : 'Connexion à la salle…'}
          </p>
          <p className="mt-1 text-sm text-white/40">
            {phase === PHASE.LOADING
              ? 'Chargement de la session'
              : 'Initialisation de la connexion vidéo'}
          </p>
          {joinCode ? (
            <div className="mt-4 flex flex-col items-center gap-2 px-4">
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">Code mobile LIRI</p>
              <button
                type="button"
                onClick={() => {
                  const d = formatJoinCodeDisplay(joinCode);
                  void navigator.clipboard.writeText(d).then(() => {
                    toast({ title: 'Code copié', description: 'À partager dans LIRI mobile — Rejoindre avec un code.' });
                  });
                }}
                className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 font-mono text-sm font-semibold tracking-wider transition-colors hover:bg-white/[0.06]"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 10%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 35%, transparent)',
                  color: 'color-mix(in srgb, var(--school-accent, #D4AF37) 35%, #ffffff)',
                }}
              >
                <Copy className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                {formatJoinCodeDisplay(joinCode)}
              </button>
              <p className="max-w-xs text-center text-[11px] text-white/35">
                Les élèves peuvent saisir ce code dans l&apos;app LIRI (connexion → rejoindre avec un code).
              </p>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (phase === PHASE.ERROR) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-5 p-8"
        data-school-shell="live-arena-phase"
        data-tenant-brand={branding.slug}
        style={phaseScreenStyle}
      >
        <div className="w-20 h-20 rounded-full border border-red-500/30 bg-red-500/10 flex items-center justify-center">
          <AlertTriangle className="w-9 h-9 text-red-400" />
        </div>
        <div className="text-center">
          <p className="text-white font-semibold text-xl">Impossible de rejoindre</p>
          <p className="text-white/50 text-sm mt-2 max-w-sm">{error}</p>
        </div>
        <Link
          to={studioRecovery ? `/studio/live-preparation/${sessionId}` : '/app'}
          className="mt-2 h-11 px-8 rounded-full border text-sm font-medium flex items-center gap-2 transition-colors hover:bg-white/[0.06]"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 20%, transparent)',
            borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 35%, transparent)',
            color: 'var(--school-accent, #D4AF37)',
          }}
        >
          {studioRecovery ? '← Retour au studio' : "← Retour à l'accueil"}
        </Link>
      </div>
    );
  }

  if (phase === PHASE.ENDED) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed inset-0 flex flex-col items-center justify-center gap-5"
        data-school-shell="live-arena-phase"
        data-tenant-brand={branding.slug}
        style={phaseScreenStyle}
      >
        <div className="w-20 h-20 rounded-full border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 className="w-9 h-9 text-emerald-400" />
        </div>
        <div className="text-center max-w-md px-4">
          <p className="text-white font-semibold text-xl">Session terminée</p>
          <p className="text-white/50 text-sm mt-1">
            {isHost
              ? "L'enregistrement est disponible en replay."
              : 'Merci d\'avoir participé. Vous pouvez fermer cette page ou revenir à l\'accueil.'}
          </p>
          {!isHost && (
            <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/lives"
                className="inline-flex h-11 px-8 rounded-full border text-sm font-medium items-center gap-2 transition-colors hover:bg-white/[0.06]"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 25%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 45%, transparent)',
                  color: 'var(--school-accent, #D4AF37)',
                }}
              >
                Voir directs & replays
              </Link>
              <Link
                to="/app"
                className="inline-flex h-11 px-8 rounded-full border text-sm font-medium items-center gap-2 transition-colors hover:bg-white/[0.06]"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 15%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 30%, transparent)',
                  color: 'color-mix(in srgb, var(--school-accent, #D4AF37) 95%, white)',
                }}
              >
                Accueil membre
              </Link>
            </div>
          )}
          {!isHost && (
            <p className="text-white/35 text-xs mt-4">Redirection automatique vers les lives dans 10 s…</p>
          )}
          {isHost && (
            <p className="text-white/35 text-xs mt-4">Redirection vers le récapitulatif…</p>
          )}
        </div>
      </motion.div>
    );
  }

  return null;
}

// ─── Barre d'enregistrement ────────────────────────────────────────────────────
function RecordingBar({ recording, onToggle, canStopRecording = true }) {
  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    height: 24,
    padding: '0 12px',
    borderRadius: proRadii.sm,
    background: 'rgba(42,24,0,0.85)',
    border: '1px solid rgba(255,176,64,0.4)',
    backdropFilter: 'blur(10px)',
    fontFamily: proType.ui,
    fontSize: proType.xxs,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: 600,
    color: proColors.warn,
  };
  return (
    <AnimatePresence>
      {recording && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="absolute z-50"
          style={{ top: 40, left: '50%', transform: 'translateX(-50%)' }}
        >
          {canStopRecording ? (
            <button
              type="button"
              onClick={onToggle}
              style={{
                ...baseStyle,
                cursor: 'pointer',
                transition: 'background 120ms, border-color 120ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(62,34,0,0.95)';
                e.currentTarget.style.borderColor = 'rgba(255,176,64,0.65)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(42,24,0,0.85)';
                e.currentTarget.style.borderColor = 'rgba(255,176,64,0.4)';
              }}
            >
              <Square size={10} fill={proColors.warn} stroke={proColors.warn} />
              Arrêter l&apos;enregistrement
            </button>
          ) : (
            <div style={{ ...baseStyle, pointerEvents: 'none' }}>
              <span
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: proColors.warn,
                  animation: 'proPulse 1.4s infinite',
                }}
              />
              Enregistrement en cours (hôte)
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function LiveArenaPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { session: authSession, user } = useAuth();
  const { toast } = useToast();
  const { branding, cssVars } = useTenantBranding();
  const { compact: arenaLiriCompact } = useLiriCompactLiveUiState({
    compactBelowWidthPx: LIRI_LIVE_ARENA_COMPACT_MAX_CSS_PX,
    /** Web : media query CSS — évite visualViewport trop étroit (zoom, UI navigateur). */
    useMatchMediaBreakpoint: !Capacitor.isNativePlatform(),
  });
  const smartboardFullMobile = useMobileLiriStore((s) => s.smartboardFull);

  // ── Phase ──────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState(PHASE.LOADING);
  const [error, setError] = useState(null);

  // ── Session data ───────────────────────────────────────────────────────────
  const [liveSession, setLiveSession] = useState(null);
  /** Contexte chargé quand live_sessions.debate_id est défini */
  const [debateArena, setDebateArena] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const duration = useLiveDuration(startedAt);

  // ── Permissions élève (lues depuis session.config) ─────────────────────────
  const [studentPerms, setStudentPerms] = useState({
    canVideo:  true,
    canAudio:  true,
    canScreen: false,
  });

  // ── LiveKit Room ref ───────────────────────────────────────────────────────
  const roomRef = useRef(null);
  const liriPersistTimeoutRef = useRef(null);

  // ── Participants ───────────────────────────────────────────────────────────
  const [participants, setParticipants] = useState([]);
  const [promotedId, setPromotedId] = useState(null);
  // Keep ref in sync so LiveKit event handlers always read the latest value
  useEffect(() => { promotedIdRef.current = promotedId; }, [promotedId]);

  // ── Video DOM refs (passés à LiveRoomShell) ────────────────────────────────
  const mainVideoRef   = useRef(null);
  const miniVideoRef   = useRef(null);
  /** Dernier MediaStream connu sur la mini (LiveKit) — secours PiP si le callback canvas arrive avant l'attache. */
  const arenaMiniStreamRef = useRef(null);
  const vbgBeforeChromaRef = useRef('immersive');
  const screenVideoRef = useRef(null);
  const camera2Ref            = useRef(null);
  const camera2LocalStreamRef = useRef(null);

  // ── Participants vidéo map: identity → <video> element créé par LiveKit ───
  const remoteVideoEls = useRef({}); // { identity: HTMLVideoElement }

  // Ref mutable pour promotedId — accessible dans callbacks LiveKit sans stale closure
  const promotedIdRef = useRef(null);
  /** Phase courante pour les handlers LiveKit (évite les closures périmées) */
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  /**
   * LIRI : flux entrant prioritaire sur le cadre principal — caméra locale uniquement en miniature.
   * Le participant « à l'antenne » (promotedId) reçoit le main ; si c'est le local, on prend le 1er remote.
   */
  const syncArenaVideoLayout = useCallback(() => {
    const room = roomRef.current;
    if (!room || phaseRef.current !== PHASE.LIVE) return;
    const mainEl = mainVideoRef.current;
    const miniEl = miniVideoRef.current;
    const localIdentity = room.localParticipant.identity;
    let mainTargetIdentity = promotedIdRef.current;

    if (mainTargetIdentity && String(mainTargetIdentity) === String(localIdentity)) {
      mainTargetIdentity = room.remoteParticipants.keys().next().value ?? null;
    }
    if (!mainTargetIdentity) {
      mainTargetIdentity = room.remoteParticipants.keys().next().value ?? null;
    }

    const localCam = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
    if (localCam && miniEl) {
      try {
        localCam.detach();
        localCam.attach(miniEl);
      } catch (e) {
        console.warn('[LiveArena] sync local→mini', e?.message);
      }
    }
    if (miniEl?.srcObject instanceof MediaStream) {
      arenaMiniStreamRef.current = miniEl.srcObject;
    }

    for (const participant of room.remoteParticipants.values()) {
      const t = participant.getTrackPublication(Track.Source.Camera)?.track;
      if (!t) continue;
      try {
        t.detach();
      } catch {
        /* ignore */
      }
      if (mainEl && mainTargetIdentity && String(participant.identity) === String(mainTargetIdentity)) {
        try {
          t.attach(mainEl);
        } catch (e) {
          console.warn('[LiveArena] sync remote→main', e?.message);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (phase !== PHASE.LIVE) return undefined;
    const id = requestAnimationFrame(() => syncArenaVideoLayout());
    return () => cancelAnimationFrame(id);
  }, [promotedId, phase, syncArenaVideoLayout]);

  // Autoplay audio : première interaction utilisateur relance startAudio si besoin
  useEffect(() => {
    if (phase !== PHASE.LIVE) return undefined;
    const resumeAudio = () => {
      try {
        roomRef.current?.startAudio?.().catch(() => {});
      } catch { /* ignore */ }
    };
    window.addEventListener('pointerdown', resumeAudio, { passive: true });
    window.addEventListener('keydown', resumeAudio, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', resumeAudio);
      window.removeEventListener('keydown', resumeAudio);
    };
  }, [phase]);

  /** Ne pas couper le live sur une micro-coupure réseau — debounce avant PHASE.ENDED */
  const liveDisconnectTimerRef = useRef(null);
  /** Re-diffuser slide/scène/rec après reconnexion LiveKit (assigné plus bas) */
  const broadcastSmartboardNowRef = useRef(null);

  // ── Controls ───────────────────────────────────────────────────────────────
  const [muted,        setMuted]        = useState(false);
  const [cameraOff,    setCameraOff]    = useState(false);
  const [sharingScreen,setSharingScreen]= useState(false);
  const [spotlight,    setSpotlight]    = useState(false);
  const [progressivePlayback, setProgressivePlayback] = useState(true);
  const progressivePlaybackRef = useRef(true);
  useEffect(() => { progressivePlaybackRef.current = progressivePlayback; }, [progressivePlayback]);
  const [sbImageModal, setSbImageModal] = useState(null);
  const sbImageModalRef = useRef(null);
  useEffect(() => { sbImageModalRef.current = sbImageModal; }, [sbImageModal]);
  /** Mode tactique SmartBoard — ref pour payload broadcast, state pour invités */
  const sbTacticalSyncRef = useRef(null);
  const [sbTacticalSyncRemote, setSbTacticalSyncRemote] = useState(null);
  const [secureAppShareState, setSecureAppShareState] = useState(null);
  const secureAppShareStateRef = useRef(null);
  useEffect(() => { secureAppShareStateRef.current = secureAppShareState; }, [secureAppShareState]);
  const [sbImageModalGuestDismissed, setSbImageModalGuestDismissed] = useState(false);
  const lastSbImageModalUrlRef = useRef('');
  useEffect(() => {
    const u = sbImageModal?.url || '';
    if (u !== lastSbImageModalUrlRef.current) {
      lastSbImageModalUrlRef.current = u;
      setSbImageModalGuestDismissed(false);
    }
  }, [sbImageModal?.url]);
  const [activeScene,  setActiveScene]  = useState('smartboard');

  // ── Mode Cinéma — SmartBoard plein écran, panneaux masqués ─────────────────
  const [cinemaMode, setCinemaMode] = useState(false);
  /** Aperçu hôte : maquette mobile sur grand écran (sans changer la largeur réelle du navigateur). */
  const [previewMobileMaquette, setPreviewMobileMaquette] = useState(false);
  /** Aperçu hôte : colonne centrale seule (comme projecteur), sans plein écran navigateur. */
  const [previewProjectorLayout, setPreviewProjectorLayout] = useState(false);
  const [layoutPreviewModalOpen, setLayoutPreviewModalOpen] = useState(false);

  const arenaLayoutCompact = arenaLiriCompact || previewMobileMaquette;
  const arenaCinemaEffective = cinemaMode || previewProjectorLayout;

  const handleCinemaToggle = useCallback(() => {
    if (previewProjectorLayout) {
      setPreviewProjectorLayout(false);
      return;
    }
    setCinemaMode((prev) => {
      const next = !prev;
      if (next) {
        setPreviewProjectorLayout(false);
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else {
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      }
      return next;
    });
  }, [previewProjectorLayout]);

  useEffect(() => {
    if (phase !== PHASE.LIVE) {
      setPreviewMobileMaquette(false);
      setPreviewProjectorLayout(false);
      setLayoutPreviewModalOpen(false);
    }
  }, [phase]);

  // ── Slides ─────────────────────────────────────────────────────────────────
  const [slides,     setSlides]     = useState([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [nativeSlideIndex, setNativeSlideIndex] = useState(0);
  const [importSlideIndex, setImportSlideIndex] = useState(0);
  const [sharedImageGallery, setSharedImageGallery] = useState([]);
  const [sharedImageIdx, setSharedImageIdx] = useState(0);
  const [sharedImageLoop, setSharedImageLoop] = useState(false);
  const [smartboardSceneFlags, setSmartboardSceneFlags] = useState(() => mergeSmartboardSceneFlags());
  const arenaSmartboardNavigatorScenes = useMemo(
    () => buildSmartboardNavigatorScenes({ flags: smartboardSceneFlags }),
    [smartboardSceneFlags],
  );
  const slideIndexRef = useRef(0);
  const activeSceneRef = useRef('smartboard');
  const nativeSlideIndexRef = useRef(0);
  const importSlideIndexRef = useRef(0);
  const sharedImageIdxRef = useRef(0);
  const sharedImageLoopRef = useRef(false);
  useEffect(() => { slideIndexRef.current = slideIndex; }, [slideIndex]);
  useEffect(() => { activeSceneRef.current = activeScene; }, [activeScene]);
  useEffect(() => { nativeSlideIndexRef.current = nativeSlideIndex; }, [nativeSlideIndex]);
  useEffect(() => { importSlideIndexRef.current = importSlideIndex; }, [importSlideIndex]);
  useEffect(() => { sharedImageIdxRef.current = sharedImageIdx; }, [sharedImageIdx]);
  useEffect(() => { sharedImageLoopRef.current = sharedImageLoop; }, [sharedImageLoop]);
  /** Annotations calque SmartBoard/diapo — synchronisées vers les invités (broadcast). */
  const [annotationStrokes, setAnnotationStrokes] = useState([]);
  const annotationStrokesRef = useRef([]);
  useEffect(() => { annotationStrokesRef.current = annotationStrokes; }, [annotationStrokes]);
  const [whiteboardPages, setWhiteboardPages] = useState(() => [[]]);
  const [whiteboardPageIndex, setWhiteboardPageIndex] = useState(0);
  const whiteboardPagesRef = useRef([[]]);
  const whiteboardPageIndexRef = useRef(0);
  const whiteboardStrokesRef = useRef([]);
  useEffect(() => { whiteboardPagesRef.current = whiteboardPages; }, [whiteboardPages]);
  useEffect(() => { whiteboardPageIndexRef.current = whiteboardPageIndex; }, [whiteboardPageIndex]);
  const whiteboardStrokes = whiteboardPages[whiteboardPageIndex] ?? [];
  useEffect(() => {
    whiteboardStrokesRef.current = whiteboardPages[whiteboardPageIndex] ?? [];
  }, [whiteboardPages, whiteboardPageIndex]);
  const [ambientTracks, setAmbientTracks] = useState([]);
  const [shopProducts, setShopProducts] = useState([]);
  /** Script maître issu du wizard (config.smartboard_master_script_sections) */
  const [configScriptSections, setConfigScriptSections] = useState([]);
  const [liriAudioScenes, setLiriAudioScenes] = useState([]);
  const [liriAudioInitialSceneIndex, setLiriAudioInitialSceneIndex] = useState(0);
  /** Invité : overlay Liri synchronisé depuis le broadcast hôte (`liriAudioSmartboard`). */
  const [guestLiriAudioSmartboard, setGuestLiriAudioSmartboard] = useState(null);
  const [guestLiriAudioSceneName, setGuestLiriAudioSceneName] = useState('');

  // ── Chat ───────────────────────────────────────────────────────────────────
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [chatMessages,  setChatMessages]  = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [forumSending, setForumSending] = useState(false);
  /** Vue hôte desktop : colonne droite « cours » ↔ membres / sièges (bouton Membres barre d'actions) */
  const [arenaLockedHostMembersColumn, setArenaLockedHostMembersColumn] = useState(false);

  // ── Main levée + Réactions (élève) ────────────────────────────────────────
  const [myHandRaised,  setMyHandRaised]  = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]); // [{id,emoji,x}]

  const raiseHand = useCallback(async () => {
    if (!user?.id || !sessionId) return;
    setMyHandRaised(true);
    await supabase.from('live_session_signals').insert({
      live_session_id: sessionId, user_id: user.id, type: 'hand_raise',
    });
  }, [user?.id, sessionId]);

  const lowerHand = useCallback(async () => {
    if (!user?.id || !sessionId) return;
    setMyHandRaised(false);
    await supabase.from('live_session_signals')
      .update({ resolved: true })
      .eq('live_session_id', sessionId)
      .eq('user_id', user.id)
      .eq('type', 'hand_raise')
      .eq('resolved', false);
  }, [user?.id, sessionId]);

  const sendReaction = useCallback(async (emoji) => {
    if (!user?.id || !sessionId) return;
    await supabase.from('live_session_signals').insert({
      live_session_id: sessionId, user_id: user.id, type: 'reaction', payload: emoji,
    });
    // Afficher localement en plus
    const id = Date.now();
    const x = 20 + Math.random() * 60;
    setFloatingReactions((prev) => [...prev, { id, emoji, x }]);
    setTimeout(() => setFloatingReactions((prev) => prev.filter((r) => r.id !== id)), 2000);
  }, [user?.id, sessionId]);

  const leaveSession = useCallback(async () => {
    try {
      await lowerHand();
      if (roomRef.current) { try { roomRef.current.disconnect(); } catch {} }
      await supabase.from('live_session_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('live_session_id', sessionId)
        .eq('user_id', user?.id);
    } finally {
      setPhase(PHASE.ENDED);
    }
  }, [lowerHand, sessionId, user?.id]);

  // ── Recording ──────────────────────────────────────────────────────────────
  const [recording,     setRecording]     = useState(false);
  const recordingRef = useRef(false);
  useEffect(() => { recordingRef.current = recording; }, [recording]);
  /** Invité : enregistrement côté hôte (diffusé sur le canal smartboard) */
  const [hostRecordingActive, setHostRecordingActive] = useState(false);
  const [recStarting,   setRecStarting]   = useState(false);
  const [recError,      setRecError]      = useState(null);
  /** Si coché : demande la capture de l'onglet (vue studio complète). Sinon : pistes caméra des éléments vidéo uniquement. */
  const [captureStudioTab, setCaptureStudioTab] = useState(true);
  const mediaRecRef    = useRef(null);
  const chunksRef      = useRef([]);
  const streamRef      = useRef(null); // MediaStream composite

  // ── Camera 2 ───────────────────────────────────────────────────────────────
  const [camera2Active, setCamera2Active] = useState(false);
  /** Synchronisé avec le broadcast SmartBoard (invités). */
  const [camera2Source, setCamera2Source] = useState(null);
  const camera2SourceRef = useRef(null);
  useEffect(() => { camera2SourceRef.current = camera2Source; }, [camera2Source]);

  // ── Device selector ────────────────────────────────────────────────────────
  const [showSettings, setShowSettings]     = useState(false);
  const readLiriLsBool = (key, defaultVal) => {
    try {
      const v = localStorage.getItem(key);
      if (v === null) return defaultVal;
      return v === '1' || v === 'true';
    } catch {
      return defaultVal;
    }
  };
  const [arenaMobileAmbientOn, setArenaMobileAmbientOn] = useState(() =>
    readLiriLsBool('liri_arena_mobile_ambient', true),
  );
  const [arenaMobileSoundFxOn, setArenaMobileSoundFxOn] = useState(() =>
    readLiriLsBool('liri_arena_mobile_sfx', true),
  );
  const [arenaMobileSubtitlesOn, setArenaMobileSubtitlesOn] = useState(() =>
    readLiriLsBool('liri_arena_mobile_subtitles', false),
  );
  /** Bips mains levées / salle d'attente / antenne / Q&R (Arena desktop hôte) */
  const [arenaDesktopHostAlertSoundOn, setArenaDesktopHostAlertSoundOn] = useState(() =>
    readLiriLsBool('liri_arena_desktop_host_alerts', true),
  );
  const [videoDevices,  setVideoDevices]    = useState([]);
  const [audioDevices,  setAudioDevices]    = useState([]);
  const [activeVideoId, setActiveVideoId]   = useState('');
  const [activeAudioId, setActiveAudioId]   = useState('');

  // ── Effets vidéo Studio (LiveStudioSettingsPanel) ───────────────────────────
  const [videoBeauty,        setVideoBeauty]        = useState(false);
  const [videoChromaKey,     setVideoChromaKey]     = useState(false);
  const [videoChromaColor,   setVideoChromaColor]   = useState('#00B140');
  const [videoChromaSens,    setVideoChromaSens]    = useState(80);
  const [videoBlur,          setVideoBlur]          = useState(false);
  /** Verre IA par défaut — fusion avec le décor live type studio créateur. */
  const [videoVbg,           setVideoVbg]           = useState('immersive');
  const [videoCustomBgUrl,   setVideoCustomBgUrl]   = useState('');
  const [videoBrightness,    setVideoBrightness]    = useState(100);
  const [videoContrast,      setVideoContrast]      = useState(100);
  const [videoSaturation,    setVideoSaturation]    = useState(100);
  const [videoHue,           setVideoHue]           = useState(0);
  const [micGain,            setMicGain]            = useState(100);
  const [noiseReduction,     setNoiseReduction]     = useState(false);
  /** PiP SmartBoard : canvas segmenté / chroma ou flux mini (aligné messagerie immersive). */
  const [arenaPipStream, setArenaPipStream] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem('liri_arena_mobile_ambient', arenaMobileAmbientOn ? '1' : '0');
      localStorage.setItem('liri_arena_mobile_sfx', arenaMobileSoundFxOn ? '1' : '0');
      localStorage.setItem('liri_arena_mobile_subtitles', arenaMobileSubtitlesOn ? '1' : '0');
      localStorage.setItem('liri_arena_desktop_host_alerts', arenaDesktopHostAlertSoundOn ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [arenaMobileAmbientOn, arenaMobileSoundFxOn, arenaMobileSubtitlesOn, arenaDesktopHostAlertSoundOn]);

  // CSS filter string calculé pour HostMiniPreview
  const videoFilterCSS = [
    `brightness(${videoBrightness}%)`,
    `contrast(${videoContrast}%)`,
    `saturate(${videoSaturation}%)`,
    `hue-rotate(${videoHue}deg)`,
    videoBeauty ? 'blur(0.3px)' : '',
  ].filter(Boolean).join(' ');

  const handleArenaPipCanvasRef = useCallback((canvas) => {
    if (canvas) {
      try {
        setArenaPipStream(canvas.captureStream(25));
      } catch {
        setArenaPipStream(null);
      }
    } else {
      const so = miniVideoRef.current?.srcObject ?? arenaMiniStreamRef.current;
      setArenaPipStream(so instanceof MediaStream ? so : null);
    }
  }, []);

  const handleArenaVbgChange = useCallback((v) => {
    setVideoVbg(v);
    if (v !== 'none') setVideoChromaKey(false);
  }, []);

  const handleArenaChromaKeyChange = useCallback((on) => {
    if (on) {
      setVideoVbg((v) => {
        vbgBeforeChromaRef.current = v;
        return 'none';
      });
      setVideoChromaKey(true);
    } else {
      setVideoChromaKey(false);
      setVideoVbg(vbgBeforeChromaRef.current ?? 'immersive');
    }
  }, []);

  const persistLiriSceneIndex = useCallback((index) => {
    if (!isHost || !sessionId) return;
    if (liriPersistTimeoutRef.current) clearTimeout(liriPersistTimeoutRef.current);
    liriPersistTimeoutRef.current = setTimeout(async () => {
      liriPersistTimeoutRef.current = null;
      try {
        const { data: row, error: fetchErr } = await supabase
          .from('live_sessions')
          .select('config')
          .eq('id', sessionId)
          .maybeSingle();
        if (fetchErr) {
          console.warn('[LiveArena] liri_audio_state read', fetchErr.message);
          return;
        }
        let c = {};
        try {
          const raw = row?.config;
          c = typeof raw === 'string' ? JSON.parse(raw) : (raw && typeof raw === 'object' ? { ...raw } : {});
        } catch { c = {}; }
        const next = {
          ...c,
          liri_audio_state: {
            ...(typeof c.liri_audio_state === 'object' && c.liri_audio_state != null ? c.liri_audio_state : {}),
            current_index: index,
          },
        };
        const { error } = await supabase
          .from('live_sessions')
          .update({ config: next, updated_at: new Date().toISOString() })
          .eq('id', sessionId);
        if (error) {
          console.warn('[LiveArena] liri_audio_state write', error.message);
          return;
        }
        setLiveSession((prev) => (prev ? { ...prev, config: next } : prev));
      } catch (e) {
        console.warn('[LiveArena] liri persist', e);
      }
    }, 900);
  }, [isHost, sessionId]);

  useEffect(() => () => {
    if (liriPersistTimeoutRef.current) clearTimeout(liriPersistTimeoutRef.current);
  }, []);

  /** PiP alimenté par canvas (segmentation / chroma) — sinon flux brut de la mini. */
  const arenaPipNeedsCanvas = videoBlur || videoVbg !== 'none' || videoChromaKey;

  useEffect(() => {
    if (phase !== PHASE.LIVE) return undefined;
    if (arenaPipNeedsCanvas) return undefined;
    const id = requestAnimationFrame(() => {
      const so = miniVideoRef.current?.srcObject ?? arenaMiniStreamRef.current;
      if (so instanceof MediaStream) {
        setArenaPipStream((prev) => (prev !== so ? so : prev));
      }
    });
    return () => cancelAnimationFrame(id);
  }, [phase, promotedId, arenaPipNeedsCanvas, videoBlur, videoVbg, videoChromaKey]);

  useEffect(() => {
    if (phase !== PHASE.LIVE) setArenaPipStream(null);
  }, [phase]);

  // ───────────────────────────────────────────────────────────────────────────
  // HELPERS — construction de la liste participants
  // ───────────────────────────────────────────────────────────────────────────
  const buildParticipantList = useCallback((room) => {
    if (!room) return;
    const local = room.localParticipant;
    const remotes = Array.from(room.remoteParticipants.values());
    const all = [local, ...remotes].map((p) => {
      const meta = tryParseMetadata(p.metadata);
      const locParts = [meta.city, meta.region, meta.country].filter(Boolean);
      const locationLabel = locParts.length ? locParts.join(', ') : (typeof meta.location === 'string' ? meta.location : null);
      const joined = p.joinedAt instanceof Date ? p.joinedAt.getTime() : null;
      return {
        id: p.identity,
        name: p.name || p.identity,
        avatar_url: meta.avatarUrl || null,
        isLocal: p.identity === local.identity,
        isHost: meta.role === 'host',
        liveJoinedAtMs: joined,
        locationLabel,
      };
    });
    setParticipants(all);
    setPromotedId((prev) => {
      if (prev && all.find((x) => String(x.id) === String(prev))) return prev;
      // Premier remote uniquement — ne pas promouvoir le local (PanelActif = entrant).
      return remotes[0]?.identity ?? null;
    });
  }, []);

  function tryParseMetadata(meta) {
    try { return meta ? JSON.parse(meta) : {}; }
    catch { return {}; }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ATTACHER les tracks vidéo aux refs DOM
  // ───────────────────────────────────────────────────────────────────────────
  const attachTrackToRef = useCallback((track, participant, room) => {
    if (!room) return;
    const isLocal = participant.identity === room.localParticipant.identity;

    if (track.source === Track.Source.ScreenShare) {
      if (screenVideoRef.current) track.attach(screenVideoRef.current);
      setActiveScene('screen');
      setSharingScreen(true);
      return;
    }

    if (track.source === Track.Source.Camera) {
      syncArenaVideoLayout();
    }

    if (track.source === Track.Source.Microphone && !isLocal) {
      const audioEl = track.attach();
      audioEl.style.display = 'none';
      audioEl.dataset.lkAudio = '1';
      document.body.appendChild(audioEl);
    }
  }, [syncArenaVideoLayout]);

  const detachTrack = useCallback((track) => {
    const els = track.detach();
    els.forEach((el) => el.remove());
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // CONNEXION LIVEKIT
  // ───────────────────────────────────────────────────────────────────────────
  const connectToRoom = useCallback(async (token, livekitUrl) => {
    setPhase(PHASE.CONNECTING);

    // Clean up any previous Room instance to avoid ghost peer connections
    if (roomRef.current) {
      try { await roomRef.current.disconnect(); } catch { /* ignore */ }
      roomRef.current = null;
    }

    const room = new Room(
      getStableLiveKitRoomOptions({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
    );

    roomRef.current = room;

    // ── Events ────────────────────────────────────────────────────────────
    room.on(RoomEvent.Connected, () => {
      clearTimeout(liveDisconnectTimerRef.current);
      liveDisconnectTimerRef.current = null;
      setPhase(PHASE.LIVE);
      setStartedAt(new Date().toISOString());
      buildParticipantList(room);

      // Débloquer la lecture audio distante (politique autoplay du navigateur)
      try {
        room.startAudio?.().catch(() => {});
      } catch { /* ignore */ }

      // Appliquer les permissions élève dès la connexion
      const amIHost = user?.id === liveSession?.teacher_id;
      if (!amIHost) {
        const perms = studentPerms;
        if (!perms.canAudio) {
          room.localParticipant.setMicrophoneEnabled(false).catch(() => {});
          setMuted(true);
        }
        if (!perms.canVideo) {
          room.localParticipant.setCameraEnabled(false).catch(() => {});
          setCameraOff(true);
        }
      }
    });

    room.on(RoomEvent.Reconnected, () => {
      clearTimeout(liveDisconnectTimerRef.current);
      liveDisconnectTimerRef.current = null;
      try {
        broadcastSmartboardNowRef.current?.();
        console.info('[LiveArena] LiveKit reconnecté — état SmartBoard renvoyé');
      } catch {
        /* ignore */
      }
    });

    room.on(RoomEvent.Disconnected, () => {
      clearTimeout(liveDisconnectTimerRef.current);
      liveDisconnectTimerRef.current = setTimeout(() => {
        const r = roomRef.current;
        if (phaseRef.current === PHASE.ENDED) return;
        if (!r || r.state === 'disconnected') setPhase(PHASE.ENDED);
      }, 8_000);
    });

    room.on(RoomEvent.ConnectionStateChanged, (state) => {
      if (state === ConnectionState.Reconnecting) {
        // UI feedback possible
      }
    });

    room.on(RoomEvent.ParticipantConnected, () => buildParticipantList(room));
    room.on(RoomEvent.ParticipantDisconnected, () => buildParticipantList(room));

    room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      attachTrackToRef(track, participant, room);
      buildParticipantList(room);
    });

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      detachTrack(track);
      if (track.source === Track.Source.ScreenShare) {
        setSharingScreen(false);
        setActiveScene('smartboard');
      }
    });

    room.on(RoomEvent.LocalTrackPublished, (pub) => {
      const track = pub.track;
      if (!track) return;
      if (track.source === Track.Source.Camera) {
        syncArenaVideoLayout();
      }
      if (track.source === Track.Source.ScreenShare) {
        setSharingScreen(true);
        setActiveScene('screen');
        if (screenVideoRef.current) {
          track.attach(screenVideoRef.current);
        }
      }
    });

    room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
      pub.track?.detach();
      if (pub.source === Track.Source.ScreenShare) {
        setSharingScreen(false);
        setActiveScene('smartboard');
      }
    });

    // ── Connexion ─────────────────────────────────────────────────────────
    const wsUrl = livekitUrl.startsWith('http')
      ? livekitUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')
      : livekitUrl;

    await room.connect(wsUrl, token, stableLiveKitConnectOptions);

    // ── Activer caméra + micro locaux ─────────────────────────────────────
    try {
      await room.localParticipant.enableCameraAndMicrophone();
    } catch (err) {
      console.warn('[LiveArena] Caméra/micro non disponible:', err.message);
    }
  }, [buildParticipantList, attachTrackToRef, detachTrack, syncArenaVideoLayout]);

  // ───────────────────────────────────────────────────────────────────────────
  // RE-ATTACH tracks once the LIVE phase DOM is committed by React
  // Fixes the race where LocalTrackPublished fires before refs are mounted.
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== PHASE.LIVE) return;
    const room = roomRef.current;
    if (!room) return;

    // Wait one paint cycle for React to flush the video elements into the DOM
    const timer = setTimeout(() => {
      syncArenaVideoLayout();
      const screenPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
      if (screenPub?.track && screenVideoRef.current) {
        screenPub.track.attach(screenVideoRef.current);
        setSharingScreen(true);
      }
      for (const participant of room.remoteParticipants.values()) {
        const remoteMic = participant.getTrackPublication(Track.Source.Microphone);
        if (remoteMic?.track) {
          const existing = document.querySelector(`audio[data-lk-identity="${participant.identity}"]`);
          if (!existing) {
            const audioEl = remoteMic.track.attach();
            audioEl.style.display = 'none';
            audioEl.dataset.lkAudio = '1';
            audioEl.dataset.lkIdentity = participant.identity;
            document.body.appendChild(audioEl);
          }
        }
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [phase, syncArenaVideoLayout]);

  // ───────────────────────────────────────────────────────────────────────────
  // INIT — Chargement session + démarrage room
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId || !authSession) return;
    let cancelled = false;

    async function init() {
      try {
        // 1. Charger la session
        const { data: sess, error: sessErr } = await supabase
          .from('live_sessions')
          .select(`
            id, title, teacher_id, status, livekit_room_name, video_room_id,
            ambient_tracks_json, config, started_at, debate_id, session_type, join_code,
            slides:live_scenes(id, name, scene_type, order_index, content_payload_json)
          `)
          .eq('id', sessionId)
          .maybeSingle();

        if (sessErr || !sess) throw new Error('Session introuvable ou accès refusé.');
        if (cancelled) return;

        setLiveSession(sess);
        const amIHost = user?.id === sess.teacher_id;
        setIsHost(amIHost);

        // 3. Ambient tracks (colonne DB ou repli sur config wizard)
        let cfg = null;
        try {
          cfg = typeof sess.config === 'string' ? JSON.parse(sess.config) : sess.config;
        } catch { cfg = null; }

        // 2. Slides triées par order_index (+ diapos image importées dans le wizard : smartboard_slides)
        let initialSlides = [];
        if (sess.slides?.length) {
          initialSlides = [...sess.slides].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        }
        if (Array.isArray(sess.ambient_tracks_json) && sess.ambient_tracks_json.length > 0) {
          setAmbientTracks(sess.ambient_tracks_json);
        } else if (Array.isArray(cfg?.ambient_tracks) && cfg.ambient_tracks.length > 0) {
          setAmbientTracks(cfg.ambient_tracks);
        } else if (typeof cfg?.ambient_tracks_json === 'string' && cfg.ambient_tracks_json) {
          try {
            const parsed = JSON.parse(cfg.ambient_tracks_json);
            if (Array.isArray(parsed)) setAmbientTracks(parsed);
          } catch { /* ignore */ }
        }

        // 3b. Shop products from session config
        try {
          if (Array.isArray(cfg?.smartboard_shop_products)) {
            setShopProducts(cfg.smartboard_shop_products);
          }
        } catch { /* config not JSON or missing */ }

        setSmartboardSceneFlags(mergeSmartboardSceneFlags(cfg?.smartboard_scenes));
        if (Array.isArray(cfg?.smartboard_shared_images) && cfg.smartboard_shared_images.length > 0) {
          setSharedImageGallery(cfg.smartboard_shared_images);
        } else {
          setSharedImageGallery([]);
        }
        setSharedImageIdx(0);
        setSharedImageLoop(cfg?.smartboard_shared_images_loop === true);

        // 3c. SmartBoard depuis le wizard (si aucune live_scenes en base)
        if (!sess.slides?.length && Array.isArray(cfg?.smartboard_element_scenes) && cfg.smartboard_element_scenes.length > 0) {
          initialSlides = [...cfg.smartboard_element_scenes].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        }
        const uploadedSlideScenes = buildLiveScenesFromUploadedSlides(cfg?.smartboard_slides);
        if (uploadedSlideScenes.length > 0) {
          initialSlides = [...initialSlides, ...uploadedSlideScenes].sort(
            (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
          );
        }
        if (initialSlides.length > 0) {
          setSlides(initialSlides);
        }
        if (Array.isArray(cfg?.smartboard_master_script_sections) && cfg.smartboard_master_script_sections.length > 0) {
          setConfigScriptSections(cfg.smartboard_master_script_sections);
        }

        const normalizedLiri = normalizeLiriAudioScenes(cfg?.liri_audio_scenes);
        if (normalizedLiri.length > 0) {
          setLiriAudioScenes(normalizedLiri);
          const st = cfg?.liri_audio_state;
          let idx = 0;
          if (st && typeof st === 'object' && st !== null) {
            const n = Number(/** @type {{ current_index?: unknown }} */ (st).current_index);
            if (Number.isFinite(n)) idx = Math.max(0, Math.floor(n));
          }
          setLiriAudioInitialSceneIndex(Math.min(idx, normalizedLiri.length - 1));
        } else if (import.meta.env.DEV) {
          setLiriAudioScenes(demoLiriAudioScenes);
          setLiriAudioInitialSceneIndex(0);
        } else {
          setLiriAudioScenes([]);
          setLiriAudioInitialSceneIndex(0);
        }

        // 4b. Permissions élève — lire depuis config session
        if (!amIHost && cfg) {
          setStudentPerms({
            canVideo:  cfg.student_video_enabled  !== false,
            canAudio:  cfg.student_audio_enabled  !== false,
            canScreen: cfg.screen_share_enabled   === true,
          });
        }

        setDebateArena(null);
        // 4c. DebateCore — métadonnées débat + spectateurs sans caméra (token LiveKit aligné côté Netlify)
        if (sess.debate_id && user?.id) {
          const [{ data: deb }, { data: rws }, { data: mePart }] = await Promise.all([
            supabase
              .from('debates')
              .select(
                'id, title, topic, status, round_count, seconds_per_turn, moderator_id, neuronq_enabled, ai_judge_enabled, ai_weight, arena_current_round, arena_active_side, arena_turn_deadline',
              )
              .eq('id', sess.debate_id)
              .maybeSingle(),
            supabase
              .from('debate_rounds')
              .select(
                'id, round_number, status, score_a, score_b, ai_score_a, ai_score_b, active_side, round_label, brief_public',
              )
              .eq('debate_id', sess.debate_id)
              .order('round_number', { ascending: true }),
            supabase
              .from('debate_participants')
              .select('role, side')
              .eq('debate_id', sess.debate_id)
              .eq('user_id', user.id)
              .maybeSingle(),
          ]);
          if (deb) {
            const rounds = rws || [];
            const scoreA = rounds.reduce((s, r) => s + (Number(r.score_a) || 0), 0);
            const scoreB = rounds.reduce((s, r) => s + (Number(r.score_b) || 0), 0);
            setDebateArena({
              debateId: deb.id,
              title: deb.title,
              topic: deb.topic,
              status: deb.status,
              roundCount: deb.round_count,
              secondsPerTurn: deb.seconds_per_turn,
              neuronqEnabled: deb.neuronq_enabled !== false,
              aiJudgeEnabled: Boolean(deb.ai_judge_enabled),
              aiWeight: deb.ai_weight != null ? Number(deb.ai_weight) : 0.3,
              myRole: mePart?.role ?? null,
              mySide: mePart?.side ?? null,
              scoreA,
              scoreB,
              rounds,
              arenaCurrentRound: deb.arena_current_round ?? 1,
              arenaActiveSide: deb.arena_active_side ?? null,
              arenaTurnDeadline: deb.arena_turn_deadline ?? null,
            });
            const isDebateMod = deb.moderator_id === user.id;
            if (mePart?.role === 'viewer' && !isDebateMod) {
              setStudentPerms({ canVideo: false, canAudio: false, canScreen: false });
            }
          }
        }

        // 5. Hôte : provisionner la room LiveKit si absente (y compris lancement immédiat depuis le wizard)
        const hasLiveKitRoom = Boolean(sess.video_room_id || sess.livekit_room_name);
        if (amIHost && !hasLiveKitRoom) {
          try {
            await createLiveRoom(sessionId);
          } catch (e) {
            console.warn('[LiveArena] createLiveRoom:', e?.message);
          }
        }

        // 6. Obtenir token + URL
        const tokenData = await getLiveKitToken(sessionId);
        if (cancelled) return;

        // 7. Connexion LiveKit
        await connectToRoom(tokenData.token, tokenData.livekitUrl);

        if (sess.started_at) setStartedAt(sess.started_at);

      } catch (err) {
        if (!cancelled) {
          console.warn('[LiveArena] Init session live:', err?.message || err);
          setError(err.message || 'Erreur inconnue');
          setPhase(PHASE.ERROR);
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, [sessionId, authSession, user?.id]);

  // Passer le débat en « live » quand l'hôte est dans l'Arena (workflow préparation → exécution)
  useEffect(() => {
    if (phase !== PHASE.LIVE || !isHost || !debateArena?.debateId) return;
    void supabase
      .from('debates')
      .update({ status: 'live' })
      .eq('id', debateArena.debateId)
      .in('status', ['draft', 'awaiting_debaters', 'preparing', 'ready_to_start']);
  }, [phase, isHost, debateArena?.debateId]);

  const debateArenaRef = useRef(debateArena);
  useEffect(() => {
    debateArenaRef.current = debateArena;
  }, [debateArena]);

  const [debateModBusy, setDebateModBusy] = useState(false);
  const [debateVoteBusy, setDebateVoteBusy] = useState(false);
  const [debateLiveVoteCounts, setDebateLiveVoteCounts] = useState({
    a: 0,
    b: 0,
    tie: 0,
    total: 0,
  });
  const [debateAiJudgeBusy, setDebateAiJudgeBusy] = useState(false);
  const debateAiJudgeBusyRef = useRef(false);
  const [debateAiReportPreview, setDebateAiReportPreview] = useState(null);

  const refreshDebateRounds = useCallback(async (debateId) => {
    if (!debateId) return;
    const { data: rws } = await supabase
      .from('debate_rounds')
      .select(
        'id, round_number, status, score_a, score_b, ai_score_a, ai_score_b, active_side, round_label, brief_public',
      )
      .eq('debate_id', debateId)
      .order('round_number', { ascending: true });
    if (!rws?.length) return;
    setDebateArena((prev) => {
      if (!prev || prev.debateId !== debateId) return prev;
      const scoreA = rws.reduce((s, x) => s + (Number(x.score_a) || 0), 0);
      const scoreB = rws.reduce((s, x) => s + (Number(x.score_b) || 0), 0);
      return { ...prev, rounds: rws, scoreA, scoreB };
    });
  }, []);

  const debatePatch = useCallback(
    async (partial) => {
      const id = debateArenaRef.current?.debateId;
      if (!id) return;
      const prev = debateArenaRef.current ? { ...debateArenaRef.current } : null;
      setDebateModBusy(true);
      const { data, error } = await supabase
        .from('debates')
        .update(partial)
        .eq('id', id)
        .select(
          'arena_current_round, arena_active_side, arena_turn_deadline, status, neuronq_enabled, ai_judge_enabled, ai_weight, title, round_count',
        )
        .single();
      if (error) {
        setDebateModBusy(false);
        console.warn('[LiveArena] debate patch:', error.message);
        return;
      }
      if (data) {
        setDebateArena((p) =>
          p
            ? {
                ...p,
                arenaCurrentRound: data.arena_current_round ?? p.arenaCurrentRound,
                arenaActiveSide: Object.prototype.hasOwnProperty.call(data, 'arena_active_side')
                  ? data.arena_active_side
                  : p.arenaActiveSide,
                arenaTurnDeadline: Object.prototype.hasOwnProperty.call(data, 'arena_turn_deadline')
                  ? data.arena_turn_deadline
                  : p.arenaTurnDeadline,
                status: data.status ?? p.status,
                neuronqEnabled: Object.prototype.hasOwnProperty.call(data, 'neuronq_enabled')
                  ? data.neuronq_enabled !== false
                  : p.neuronqEnabled,
                aiJudgeEnabled: Object.prototype.hasOwnProperty.call(data, 'ai_judge_enabled')
                  ? Boolean(data.ai_judge_enabled)
                  : p.aiJudgeEnabled,
                aiWeight:
                  data.ai_weight != null && data.ai_weight !== ''
                    ? Number(data.ai_weight)
                    : p.aiWeight,
                title:
                  data.title != null && String(data.title).trim()
                    ? String(data.title)
                    : p.title,
                roundCount: data.round_count != null ? data.round_count : p.roundCount,
              }
            : null,
        );
      }
      const shouldSync =
        prev &&
        (Object.prototype.hasOwnProperty.call(partial, 'arena_current_round') ||
          Object.prototype.hasOwnProperty.call(partial, 'arena_active_side'));
      if (shouldSync) {
        await syncDebateRoundsWithArenaPartial(prev, partial);
        await refreshDebateRounds(id);
      }
      setDebateModBusy(false);
    },
    [refreshDebateRounds],
  );

  const debateOpenVoting = useCallback(async () => {
    const ctx = debateArenaRef.current;
    if (!ctx?.debateId) return;
    const r = Math.min(
      Math.max(1, Number(ctx.arenaCurrentRound) || 1),
      Math.max(1, Number(ctx.roundCount) || 1),
    );
    setDebateModBusy(true);
    const { error } = await supabase
      .from('debate_rounds')
      .update({ status: 'voting' })
      .eq('debate_id', ctx.debateId)
      .eq('round_number', r);
    setDebateModBusy(false);
    if (error) {
      console.warn('[LiveArena] open voting:', error.message);
      return;
    }
    await refreshDebateRounds(ctx.debateId);
  }, [refreshDebateRounds]);

  useEffect(() => {
    if (!debateArena?.debateId || !isHost) {
      setDebateAiReportPreview(null);
      return undefined;
    }
    const id = debateArena.debateId;
    const r = Math.min(
      Math.max(1, Number(debateArena.arenaCurrentRound) || 1),
      Math.max(1, Number(debateArena.roundCount) || 1),
    );
    let cancelled = false;
    void supabase
      .from('debate_ai_reports')
      .select('summary, score_a, score_b, created_at')
      .eq('debate_id', id)
      .eq('round_number', r)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setDebateAiReportPreview(null);
          return;
        }
        setDebateAiReportPreview(data || null);
      });
    return () => {
      cancelled = true;
    };
  }, [debateArena?.debateId, debateArena?.arenaCurrentRound, debateArena?.roundCount, isHost]);

  const debateRunAiJudge = useCallback(async () => {
    const ctx = debateArenaRef.current;
    if (!ctx?.debateId || !sessionId || debateAiJudgeBusyRef.current) return;
    debateAiJudgeBusyRef.current = true;
    setDebateAiJudgeBusy(true);
    try {
      const r = Math.min(
        Math.max(1, Number(ctx.arenaCurrentRound) || 1),
        Math.max(1, Number(ctx.roundCount) || 1),
      );
      const { data: payload, error: invErr } = await supabase.functions.invoke('debate-ai-judge-round', {
        body: {
          debateId: ctx.debateId,
          roundNumber: r,
          liveSessionId: sessionId,
        },
      });
      if (invErr) throw new Error(await getSupabaseFunctionErrorMessage(invErr));
      if (payload?.error) throw new Error(String(payload.error));
      if (payload?.report) {
        setDebateAiReportPreview({
          summary: payload.report.summary,
          score_a: payload.report.score_a,
          score_b: payload.report.score_b,
          created_at: payload.report.created_at,
        });
      }
      await refreshDebateRounds(ctx.debateId);
    } catch (e) {
      console.warn('[DebateAI]', e?.message || e);
    } finally {
      debateAiJudgeBusyRef.current = false;
      setDebateAiJudgeBusy(false);
    }
  }, [sessionId, refreshDebateRounds]);

  const debateCloseVoting = useCallback(async () => {
    const ctx = debateArenaRef.current;
    if (!ctx?.debateId) return;
    const r = Math.min(
      Math.max(1, Number(ctx.arenaCurrentRound) || 1),
      Math.max(1, Number(ctx.roundCount) || 1),
    );
    setDebateModBusy(true);
    const { data: votes, error: vErr } = await supabase
      .from('debate_votes')
      .select('selected_side')
      .eq('debate_id', ctx.debateId)
      .eq('round_number', r);
    if (vErr) {
      setDebateModBusy(false);
      console.warn('[LiveArena] close voting read:', vErr.message);
      return;
    }
    const list = votes || [];
    const a = list.filter((v) => v.selected_side === 'A').length;
    const b = list.filter((v) => v.selected_side === 'B').length;
    const winner = a > b ? 'A' : b > a ? 'B' : 'tie';
    const { error: uErr } = await supabase
      .from('debate_rounds')
      .update({
        score_a: a,
        score_b: b,
        winner_side: winner,
        status: 'completed',
        ended_at: new Date().toISOString(),
      })
      .eq('debate_id', ctx.debateId)
      .eq('round_number', r);
    setDebateModBusy(false);
    if (uErr) {
      console.warn('[LiveArena] close voting write:', uErr.message);
      return;
    }
    await refreshDebateRounds(ctx.debateId);
  }, [refreshDebateRounds]);

  const debateCurrentRoundStatus = useMemo(() => {
    if (!debateArena?.rounds?.length) return null;
    const r = Math.min(
      Math.max(1, Number(debateArena.arenaCurrentRound) || 1),
      Math.max(1, Number(debateArena.roundCount) || 1),
    );
    return debateArena.rounds.find((x) => x.round_number === r)?.status ?? null;
  }, [debateArena]);

  const debateNavLocked = useMemo(() => {
    if (!debateArena || isHost) return false;
    if (debateArena.myRole === 'viewer') return true;
    if (debateArena.myRole !== 'debater') return false;
    if (!debateArena.mySide) return true;
    if (!debateArena.arenaActiveSide) return true;
    return debateArena.arenaActiveSide !== debateArena.mySide;
  }, [debateArena, isHost]);

  /** Hors mode débat : NeuronQ actif. En débat : suit debates.neuronq_enabled. */
  const debateNeuronqEnabled = useMemo(
    () => !debateArena || debateArena.neuronqEnabled !== false,
    [debateArena],
  );

  useEffect(() => {
    if (phase !== PHASE.LIVE || !debateArena?.debateId) {
      setDebateLiveVoteCounts({ a: 0, b: 0, tie: 0, total: 0 });
      return undefined;
    }
    const id = debateArena.debateId;
    const r = Math.min(
      Math.max(1, Number(debateArena.arenaCurrentRound) || 1),
      Math.max(1, Number(debateArena.roundCount) || 1),
    );
    const voting =
      debateArena.rounds?.find((x) => x.round_number === r)?.status === 'voting';

    const mergeRoundPayload = (nr) => {
      if (!nr?.round_number) return;
      setDebateArena((prev) => {
        if (!prev || prev.debateId !== id) return prev;
        const rounds = (prev.rounds || []).map((row) =>
          row.round_number === nr.round_number ? { ...row, ...nr } : row,
        );
        const scoreA = rounds.reduce((s, x) => s + (Number(x.score_a) || 0), 0);
        const scoreB = rounds.reduce((s, x) => s + (Number(x.score_b) || 0), 0);
        return { ...prev, rounds, scoreA, scoreB };
      });
    };

    const reloadVotes = () => {
      if (!voting) return;
      void supabase
        .from('debate_votes')
        .select('selected_side')
        .eq('debate_id', id)
        .eq('round_number', r)
        .then(({ data }) => {
          const list = data || [];
          const a = list.filter((v) => v.selected_side === 'A').length;
          const b = list.filter((v) => v.selected_side === 'B').length;
          const tie = list.filter((v) => v.selected_side === 'tie').length;
          setDebateLiveVoteCounts({ a, b, tie, total: list.length });
        });
    };

    if (!voting) {
      setDebateLiveVoteCounts({ a: 0, b: 0, tie: 0, total: 0 });
    } else {
      reloadVotes();
    }

    const channel = supabase.channel(`debate-arena-${id}`);
    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'debates', filter: `id=eq.${id}` },
      (payload) => {
        const n = payload.new;
        if (!n) return;
        setDebateArena((prev) => {
          if (!prev || prev.debateId !== id) return prev;
          const next = { ...prev };
          if (n.arena_current_round != null) next.arenaCurrentRound = n.arena_current_round;
          if (Object.prototype.hasOwnProperty.call(n, 'arena_active_side')) {
            next.arenaActiveSide = n.arena_active_side;
          }
          if (Object.prototype.hasOwnProperty.call(n, 'arena_turn_deadline')) {
            next.arenaTurnDeadline = n.arena_turn_deadline;
          }
          if (n.status) next.status = n.status;
          if (Object.prototype.hasOwnProperty.call(n, 'neuronq_enabled')) {
            next.neuronqEnabled = n.neuronq_enabled !== false;
          }
          if (Object.prototype.hasOwnProperty.call(n, 'ai_judge_enabled')) {
            next.aiJudgeEnabled = Boolean(n.ai_judge_enabled);
          }
          if (Object.prototype.hasOwnProperty.call(n, 'ai_weight') && n.ai_weight != null && n.ai_weight !== '') {
            const w = Number(n.ai_weight);
            if (!Number.isNaN(w)) next.aiWeight = w;
          }
          if (n.title != null && String(n.title).trim()) next.title = String(n.title);
          if (n.round_count != null) next.roundCount = n.round_count;
          return next;
        });
      },
    );
    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'debate_rounds', filter: `debate_id=eq.${id}` },
      (payload) => mergeRoundPayload(payload.new),
    );
    if (voting) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'debate_votes', filter: `debate_id=eq.${id}` },
        (payload) => {
          const nr = payload.new?.round_number ?? payload.old?.round_number;
          if (nr === r) reloadVotes();
        },
      );
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    phase,
    debateArena?.debateId,
    debateArena?.arenaCurrentRound,
    debateArena?.roundCount,
    debateCurrentRoundStatus,
  ]);

  // ───────────────────────────────────────────────────────────────────────────
  // CHAT — Supabase Realtime
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId || phase !== PHASE.LIVE) return;

    // Charger les messages existants
    supabase
      .from('live_session_chat')
      .select('id, user_id, message, created_at')
      .eq('live_session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(150)
      .then(async ({ data, error }) => {
        if (error || !data?.length) return;
        const ids = [...new Set(data.map((m) => m.user_id).filter(Boolean))];
        const { data: profs } = ids.length
          ? await supabase.from('profiles').select('id, name, avatar_url').in('id', ids)
          : { data: [] };
        const map = Object.fromEntries((profs || []).map((p) => [p.id, p]));
        setChatMessages(
          data.map((m) => ({
            id: m.id,
            userId: m.user_id,
            text: m.message,
            name: map[m.user_id]?.name || 'Participant',
            avatar: map[m.user_id]?.avatar_url || null,
            time: m.created_at,
          }))
        );
      });

    // Subscribe aux nouveaux messages
    const channel = supabase
      .channel(`live-chat-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_session_chat',
          filter: `live_session_id=eq.${sessionId}` },
        async (payload) => {
          const m = payload.new;
          let name = 'Participant';
          let avatar = null;
          const { data: prof } = await supabase
            .from('profiles')
            .select('name, avatar_url')
            .eq('id', m.user_id)
            .maybeSingle();
          if (prof) {
            name = prof.name || name;
            avatar = prof.avatar_url || null;
          }
          setChatMessages((prev) => [
            ...prev,
            { id: m.id, userId: m.user_id, text: m.message, name, avatar, time: m.created_at },
          ]);
          if (!drawerOpen) setUnreadCount((c) => c + 1);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId, phase]);

  // ── NeuronQ — chargement initial + Realtime ────────────────────────────────
  const [neuronqQuestions,    setNeuronqQuestions]    = useState([]);
  const [neuronqQaMode,       setNeuronqQaMode]       = useState(false);
  const [neuronqReformulating,setNeuronqReformulating]= useState(false);
  const [neuronqSubmitting,   setNeuronqSubmitting]   = useState(false);

  useEffect(() => {
    if (debateNeuronqEnabled) return;
    setNeuronqQuestions([]);
    setNeuronqQaMode(false);
  }, [debateNeuronqEnabled]);

  useEffect(() => {
    if (!sessionId || phase !== PHASE.LIVE || !debateNeuronqEnabled) return;

    // Chargement initial
    supabase
      .from('live_neuronq_questions')
      .select('id, raw_text, reformulated_text, status, user_id, created_at')
      .eq('live_session_id', sessionId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          const msg = String(error.message || '');
          if (error.code === 'PGRST205' || error.code === '42P01' || /does not exist|Could not find/i.test(msg)) return;
          return;
        }
        if (data) setNeuronqQuestions(data);
      })
      .catch(() => {});

    // Realtime — nouvelles questions
    const ch = supabase
      .channel(`live-neuronq-${sessionId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_neuronq_questions',
          filter: `live_session_id=eq.${sessionId}` },
        (payload) => {
          setNeuronqQuestions((prev) => [...prev, payload.new]);
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_neuronq_questions',
          filter: `live_session_id=eq.${sessionId}` },
        (payload) => {
          setNeuronqQuestions((prev) =>
            prev.map((q) => q.id === payload.new.id ? { ...q, ...payload.new } : q)
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [sessionId, phase, debateNeuronqEnabled]);

  const neuronqSubmit = useCallback(async (rawText, reformulatedText) => {
    if (!debateNeuronqEnabled || !rawText || !sessionId || !user?.id) return false;
    setNeuronqSubmitting(true);
    try {
      const { error } = await supabase.from('live_neuronq_questions').insert({
        live_session_id:   sessionId,
        user_id:           user.id,
        raw_text:          rawText,
        reformulated_text: reformulatedText || rawText,
        status:            'pending',
      });
      if (error) throw error;
      return true;
    } catch (e) {
      console.warn('[NeuronQ] submit error:', e.message);
      return false;
    } finally {
      setNeuronqSubmitting(false);
    }
  }, [debateNeuronqEnabled, sessionId, user?.id]);

  const neuronqMarkAnswered = useCallback(async (id) => {
    if (!debateNeuronqEnabled) return;
    await supabase.from('live_neuronq_questions').update({ status: 'answered' }).eq('id', id);
  }, [debateNeuronqEnabled]);

  const neuronqMarkSkipped = useCallback(async (id) => {
    if (!debateNeuronqEnabled) return;
    await supabase.from('live_neuronq_questions').update({ status: 'skipped' }).eq('id', id);
  }, [debateNeuronqEnabled]);

  const neuronqReformulate = useCallback(async (rawText) => {
    if (!rawText) return rawText;
    setNeuronqReformulating(true);
    try {
      const { data, error } = await supabase.functions.invoke('neuronq-reformulate', {
        body: { rawText: String(rawText).trim() },
      });
      if (error) return rawText;
      return data?.reformulated ?? data?.reformulatedText ?? rawText;
    } catch {
      return rawText;
    } finally {
      setNeuronqReformulating(false);
    }
  }, []);

  // ── Zone3 — mains levées + réactions Realtime ─────────────────────────────
  const [zone3RaisedHands,    setZone3RaisedHands]    = useState([]);
  const [zone3PrivilegedSeats,setZone3PrivilegedSeats]= useState([]);

  useEffect(() => {
    if (!sessionId || phase !== PHASE.LIVE) return;

    // Chargement initial mains levées en cours
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('live_session_signals')
          .select('id, user_id, type, payload, created_at, resolved')
          .eq('live_session_id', sessionId)
          .eq('type', 'hand_raise')
          .eq('resolved', false);
        if (error || !data?.length) return;
        const ids = [...new Set(data.map((s) => s.user_id).filter(Boolean))];
        const { data: profs } = ids.length
          ? await supabase.from('profiles').select('id, name, avatar_url').in('id', ids)
          : { data: [] };
        const map = Object.fromEntries((profs || []).map((p) => [p.id, p]));
        setZone3RaisedHands(
          data.map((s) => ({
            userId: s.user_id,
            signalId: s.id,
            name: map[s.user_id]?.name || 'Participant',
            avatar_url: map[s.user_id]?.avatar_url || null,
            at: new Date(s.created_at).getTime(),
          }))
        );
      } catch { /* ignore */ }
    })();

    // Realtime — signaux (mains levées + réactions)
    const ch = supabase
      .channel(`live-signals-${sessionId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_session_signals',
          filter: `live_session_id=eq.${sessionId}` },
        async (payload) => {
          const sig = payload.new;
          if (sig.type === 'hand_raise') {
            // Charger le profil
            const { data: prof } = await supabase
              .from('profiles').select('name, avatar_url').eq('id', sig.user_id).maybeSingle();
            setZone3RaisedHands((prev) => {
              if (prev.some((h) => h.userId === sig.user_id)) return prev;
              return [...prev, {
                userId: sig.user_id, signalId: sig.id,
                name: prof?.name || 'Participant',
                avatar_url: prof?.avatar_url || null,
                at: Date.now(),
              }];
            });
          } else if (sig.type === 'reaction' && sig.user_id !== user?.id) {
            // Réaction d'un autre participant → afficher localement
            const id = Date.now() + Math.random();
            const x = 20 + Math.random() * 60;
            setFloatingReactions((prev) => [...prev, { id, emoji: sig.payload, x }]);
            setTimeout(() => setFloatingReactions((prev) => prev.filter((r) => r.id !== id)), 2000);
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_session_signals',
          filter: `live_session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.new.type === 'hand_raise' && payload.new.resolved) {
            setZone3RaisedHands((prev) => prev.filter((h) => h.signalId !== payload.new.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [sessionId, phase, user?.id]);

  const zone3LowerHand = useCallback(async (userId) => {
    const entry = zone3RaisedHands.find((h) => h.userId === userId);
    if (!entry) return;
    await supabase
      .from('live_session_signals')
      .update({ resolved: true })
      .eq('id', entry.signalId);
    setZone3RaisedHands((prev) => prev.filter((h) => h.userId !== userId));
  }, [zone3RaisedHands]);

  const zone3GrantSeat = useCallback((position, userId) => {
    if (!position || !userId) return;
    const source = participants.find((p) => String(p.id) === String(userId))
      || zone3RaisedHands.find((h) => String(h.userId) === String(userId));
    const displayName = source?.name || 'Participant';
    setZone3PrivilegedSeats((prev) => {
      const withoutPosition = prev.filter((s) => Number(s.position) !== Number(position));
      const withoutUser = withoutPosition.filter((s) => String(s.userId) !== String(userId));
      return [...withoutUser, { position: Number(position), userId: String(userId), name: displayName }];
    });
  }, [participants, zone3RaisedHands]);

  const zone3RevokeSeat = useCallback((position) => {
    if (!position) return;
    setZone3PrivilegedSeats((prev) => prev.filter((s) => Number(s.position) !== Number(position)));
  }, []);

  // ── SmartBoard Realtime sync ───────────────────────────────────────────────
  // L'hôte diffuse slide_index + active_scene via Broadcast (pas de DB).
  // Les élèves écoutent et synchronisent leur vue.
  const smartboardChannelRef = useRef(null);

  const sendSmartboardPayload = useCallback((overrides = {}) => {
    if (!isHost || !smartboardChannelRef.current) return;
    const payload = {
      slideIndex: slideIndexRef.current,
      nativeSlideIndex: nativeSlideIndexRef.current,
      importSlideIndex: importSlideIndexRef.current,
      sharedImageIdx: sharedImageIdxRef.current,
      sharedImageLoop: sharedImageLoopRef.current,
      activeScene: activeSceneRef.current,
      recordingActive: recordingRef.current,
      annotationStrokes: annotationStrokesRef.current,
      whiteboardPages: whiteboardPagesRef.current,
      whiteboardPageIndex: whiteboardPageIndexRef.current,
      whiteboardStrokes: whiteboardStrokesRef.current,
      progressivePlayback: progressivePlaybackRef.current,
      sbImageModal: sbImageModalRef.current,
      sbTacticalSync: sbTacticalSyncRef.current,
      secureAppShareState: secureAppShareStateRef.current,
      ...overrides,
    };
    if (!Object.prototype.hasOwnProperty.call(payload, 'camera2Source')) {
      payload.camera2Source = camera2SourceRef.current;
    }
    void broadcastRealtime(smartboardChannelRef.current, 'smartboard', payload);
  }, [isHost]);

  const handleSbTacticalSync = useCallback((payload) => {
    sbTacticalSyncRef.current = payload;
    sendSmartboardPayload({ sbTacticalSync: payload });
  }, [sendSmartboardPayload]);

  const toggleProgressivePlayback = useCallback(() => {
    setProgressivePlayback((v) => {
      const next = !v;
      progressivePlaybackRef.current = next;
      queueMicrotask(() => {
        if (!isHost || phaseRef.current !== PHASE.LIVE) return;
        sendSmartboardPayload({ progressivePlayback: next });
      });
      return next;
    });
  }, [isHost, sendSmartboardPayload]);

  const closeSbImageModal = useCallback(() => {
    sbImageModalRef.current = null;
    setSbImageModal(null);
    if (isHost && phaseRef.current === PHASE.LIVE) {
      sendSmartboardPayload({ sbImageModal: null });
    }
  }, [isHost, sendSmartboardPayload]);

  const openSmartboardImageModal = useCallback(
    (p) => {
      if (!isHost || !p?.url) return;
      const next = { url: p.url, label: p.label || '' };
      sbImageModalRef.current = next;
      setSbImageModal(next);
      sendSmartboardPayload({ sbImageModal: next });
    },
    [isHost, sendSmartboardPayload],
  );

  const broadcastSmartboardNow = useCallback(() => {
    sendSmartboardPayload();
  }, [sendSmartboardPayload]);

  useEffect(() => {
    broadcastSmartboardNowRef.current = broadcastSmartboardNow;
  }, [broadcastSmartboardNow]);

  useEffect(() => {
    if (phase !== PHASE.LIVE) setHostRecordingActive(false);
  }, [phase]);

  useEffect(() => {
    if (!isHost || phase !== PHASE.LIVE) return;
    broadcastSmartboardNow();
  }, [recording, isHost, phase, broadcastSmartboardNow]);

  useEffect(() => {
    if (!sessionId || phase !== PHASE.LIVE) return;

    const ch = supabase.channel(`live-smartboard-${sessionId}`, {
      config: { broadcast: { self: false } },
    });

    if (isHost) {
      // L'hôte publie ses changements — canal stocké pour l'émission
      smartboardChannelRef.current = ch;
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Invités qui rejoignent en cours : aligner slide / scène sans attendre le prochain clic hôte
          sendSmartboardPayload();
        }
      });
    } else {
      // L'élève écoute les changements de l'hôte
      ch.on('broadcast', { event: 'smartboard' }, ({ payload }) => {
        if (typeof payload.slideIndex === 'number') setSlideIndex(payload.slideIndex);
        if (typeof payload.nativeSlideIndex === 'number') setNativeSlideIndex(payload.nativeSlideIndex);
        if (typeof payload.importSlideIndex === 'number') setImportSlideIndex(payload.importSlideIndex);
        if (typeof payload.sharedImageIdx === 'number') setSharedImageIdx(payload.sharedImageIdx);
        if (typeof payload.sharedImageLoop === 'boolean') setSharedImageLoop(payload.sharedImageLoop);
        if (typeof payload.activeScene === 'string') setActiveScene(payload.activeScene);
        if (typeof payload.recordingActive === 'boolean') setHostRecordingActive(payload.recordingActive);
        if (Object.prototype.hasOwnProperty.call(payload, 'camera2Source')) {
          setCamera2Source(payload.camera2Source);
        }
        if (Array.isArray(payload.annotationStrokes)) {
          setAnnotationStrokes(payload.annotationStrokes);
        }
        if (
          (Array.isArray(payload.whiteboardPages) && payload.whiteboardPages.every(Array.isArray))
          || Array.isArray(payload.whiteboardStrokes)
        ) {
          const { pages, pageIndex } = mergeWhiteboardFromPayload(
            payload,
            whiteboardPagesRef.current,
            whiteboardPageIndexRef.current,
          );
          whiteboardPagesRef.current = pages;
          whiteboardPageIndexRef.current = pageIndex;
          setWhiteboardPages(pages);
          setWhiteboardPageIndex(pageIndex);
          whiteboardStrokesRef.current = pages[pageIndex] ?? [];
        }
        if (typeof payload.progressivePlayback === 'boolean') {
          setProgressivePlayback(payload.progressivePlayback);
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'sbImageModal')) {
          const m = payload.sbImageModal;
          if (m && typeof m === 'object' && m.url) {
            setSbImageModal({ url: String(m.url), label: String(m.label || '') });
          } else {
            setSbImageModal(null);
          }
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'sbTacticalSync')) {
          setSbTacticalSyncRemote(payload.sbTacticalSync ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'secureAppShareState')) {
          const next =
            payload.secureAppShareState && typeof payload.secureAppShareState === 'object'
              ? payload.secureAppShareState
              : null;
          setSecureAppShareState(next);
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'liriAudioSmartboard')) {
          setGuestLiriAudioSmartboard(payload.liriAudioSmartboard ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'liriAudioSceneName')) {
          setGuestLiriAudioSceneName(
            typeof payload.liriAudioSceneName === 'string' ? payload.liriAudioSceneName : '',
          );
        }
      }).subscribe();
    }

    return () => {
      supabase.removeChannel(ch);
      smartboardChannelRef.current = null;
    };
  }, [sessionId, phase, isHost, sendSmartboardPayload]);

  const onSecureAppShareStateChange = useCallback((update) => {
    if (!isHost) return;
    setSecureAppShareState((prev) => {
      const p = prev && typeof prev === 'object' ? prev : {};
      const next = typeof update === 'function' ? update(p) : update;
      const safe = next && typeof next === 'object' ? { ...next } : null;
      secureAppShareStateRef.current = safe;
      sendSmartboardPayload({ secureAppShareState: safe });
      return safe;
    });
  }, [isHost, sendSmartboardPayload]);

  useEffect(() => {
    if (phase === PHASE.LIVE) return;
    setGuestLiriAudioSmartboard(null);
    setGuestLiriAudioSceneName('');
  }, [phase]);

  // ───────────────────────────────────────────────────────────────────────────
  // ENVOYER un message chat
  // ───────────────────────────────────────────────────────────────────────────
  const sendChatMessage = useCallback(async (text) => {
    if (!text?.trim() || !sessionId || !user?.id) return;
    await supabase.from('live_session_chat').insert({
      live_session_id: sessionId,
      user_id:         user.id,
      message:         text.trim(),
    });
  }, [sessionId, user?.id]);

  const sendForumMessage = useCallback(async (raw) => {
    setForumSending(true);
    try {
      await sendChatMessage(raw);
    } finally {
      setForumSending(false);
    }
  }, [sendChatMessage]);

  const drawerForumMessages = useMemo(
    () => chatMessages.map((m) => ({
      id: m.id,
      sender_id: m.userId,
      content: m.text,
      sender_name: m.name,
    })),
    [chatMessages],
  );

  // ───────────────────────────────────────────────────────────────────────────
  // CONTRÔLES
  // ───────────────────────────────────────────────────────────────────────────
  const toggleMuted = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    // Élève : vérifier permission audio
    if (!isHost && !studentPerms.canAudio) return;
    const next = !muted;
    await room.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  }, [muted, isHost, studentPerms.canAudio]);

  /** Réglages mobile LIRI : appliquer micro on/off sans toggle. */
  const applyMuted = useCallback(async (nextMuted) => {
    const room = roomRef.current;
    if (!room) return;
    if (!isHost && !studentPerms.canAudio) return;
    await room.localParticipant.setMicrophoneEnabled(!nextMuted);
    setMuted(nextMuted);
  }, [isHost, studentPerms.canAudio]);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    // Élève : vérifier permission vidéo
    if (!isHost && !studentPerms.canVideo) return;
    const next = !cameraOff;
    await room.localParticipant.setCameraEnabled(!next);
    setCameraOff(next);
  }, [cameraOff, isHost, studentPerms.canVideo]);

  // ── Device selector helpers ────────────────────────────────────────────────
  const openSettings = useCallback(async () => {
    // Request permission first so labels are populated
    try { await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); } catch { /* already granted */ }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
      setAudioDevices(devices.filter((d) => d.kind === 'audioinput'));
      const room = roomRef.current;
      if (room) {
        // LiveKit: getTrackPublication takes Track.Source enum
        const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        setActiveVideoId(camPub?.track?.mediaStreamTrack?.getSettings()?.deviceId || '');
        setActiveAudioId(micPub?.track?.mediaStreamTrack?.getSettings()?.deviceId || '');
      }
    } catch (e) {
      console.warn('[LiveArena] enumerateDevices:', e.message);
    }
    setShowSettings(true);
  }, []);

  const switchVideoDevice = useCallback(async (deviceId) => {
    const room = roomRef.current;
    if (!room) return;
    try {
      // LiveKit JS: switchActiveDevice is on the Room object, not LocalParticipant
      await room.switchActiveDevice('videoinput', deviceId);
      setActiveVideoId(deviceId);
      setTimeout(() => {
        syncArenaVideoLayout();
      }, 400);
    } catch (e) {
      console.warn('[LiveArena] switchVideoDevice:', e.message);
    }
  }, [syncArenaVideoLayout]);

  const switchAudioDevice = useCallback(async (deviceId) => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.switchActiveDevice('audioinput', deviceId);
      setActiveAudioId(deviceId);
    } catch (e) {
      console.warn('[LiveArena] switchAudioDevice:', e.message);
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    if (sharingScreen) {
      await room.localParticipant.setScreenShareEnabled(false);
    } else {
      try {
        await room.localParticipant.setScreenShareEnabled(true);
        // Track attaché via LocalTrackPublished event
        setActiveScene('screen');
      } catch (err) {
        console.warn('[LiveArena] Screen share refusé:', err.message);
      }
    }
  }, [sharingScreen]);

  const clearCamera2LocalStream = useCallback(() => {
    if (camera2LocalStreamRef.current) {
      camera2LocalStreamRef.current.getTracks().forEach((t) => t.stop());
      camera2LocalStreamRef.current = null;
    }
  }, []);

  const applyCamera2FromSpec = useCallback(async (spec) => {
    if (!spec || typeof spec !== 'object') return;
    const room = roomRef.current;

    if (spec.type === 'remote_camera' && spec.identity) {
      clearCamera2LocalStream();
      if (camera2Ref.current) camera2Ref.current.srcObject = null;
      setCamera2Source(spec);
      camera2SourceRef.current = spec;
      const t = getCameraTrackByIdentity(room, spec.identity);
      if (t && camera2Ref.current) {
        camera2Ref.current.srcObject = new MediaStream([t.mediaStreamTrack]);
        camera2Ref.current.play?.().catch(() => {});
        setCamera2Active(true);
      } else {
        setCamera2Active(false);
      }
      setActiveScene('camera2');
      if (isHost) sendSmartboardPayload({ camera2Source: spec });
      return;
    }

    if (spec.type === 'local_display') {
      clearCamera2LocalStream();
      if (camera2Ref.current) camera2Ref.current.srcObject = null;
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) return;
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        camera2LocalStreamRef.current = stream;
        if (camera2Ref.current) {
          camera2Ref.current.srcObject = stream;
          camera2Ref.current.play?.().catch(() => {});
        }
        const source = { type: 'local_display' };
        setCamera2Source(source);
        camera2SourceRef.current = source;
        setCamera2Active(true);
        setActiveScene('camera2');
        if (isHost) sendSmartboardPayload({ camera2Source: source });
        const vt = stream.getVideoTracks?.()[0];
        if (vt) {
          vt.onended = () => {
            clearCamera2LocalStream();
            if (camera2Ref.current) camera2Ref.current.srcObject = null;
            setCamera2Active(false);
            setCamera2Source(null);
            camera2SourceRef.current = null;
            if (isHost) sendSmartboardPayload({ camera2Source: null });
          };
        }
      } catch (err) {
        console.warn('[LiveArena] Cam2 display refusé:', err.message);
      }
      return;
    }

    if (spec.type === 'local_aux') {
      clearCamera2LocalStream();
      if (camera2Ref.current) camera2Ref.current.srcObject = null;
      try {
        let videoConstraints;
        if (spec.deviceId) {
          videoConstraints = { deviceId: { exact: spec.deviceId } };
        } else if (spec.facingMode === 'user' || spec.facingMode === 'environment') {
          videoConstraints = { facingMode: spec.facingMode };
        } else {
          videoConstraints = { facingMode: 'environment' };
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });
        camera2LocalStreamRef.current = stream;
        if (camera2Ref.current) {
          camera2Ref.current.srcObject = stream;
          camera2Ref.current.play?.().catch(() => {});
        }
        const source = { type: 'local_aux' };
        if (spec.deviceId) source.deviceId = spec.deviceId;
        else source.facingMode = spec.facingMode === 'user' ? 'user' : 'environment';
        setCamera2Source(source);
        camera2SourceRef.current = source;
        setCamera2Active(true);
        setActiveScene('camera2');
        if (isHost) sendSmartboardPayload({ camera2Source: source });
      } catch (err) {
        console.warn('[LiveArena] Cam2 refusée:', err.message);
      }
    }
  }, [clearCamera2LocalStream, isHost, sendSmartboardPayload]);

  const handleCamera2Start = useCallback((arg) => {
    if (typeof arg === 'string') {
      applyCamera2FromSpec({ type: 'local_aux', deviceId: arg });
      return;
    }
    if (arg && typeof arg === 'object') applyCamera2FromSpec(arg);
  }, [applyCamera2FromSpec]);

  // Cam 2 — piste distante (ou locale hôte) : réattache si souscription tardive ou retour sur la scène
  useEffect(() => {
    if (phase !== PHASE.LIVE || !roomRef.current) return undefined;
    if (activeScene !== 'camera2') return undefined;
    const src = camera2Source;
    if (!src || src.type !== 'remote_camera') return undefined;

    const room = roomRef.current;
    const attach = () => {
      const t = getCameraTrackByIdentity(room, src.identity);
      if (t && camera2Ref.current) {
        camera2Ref.current.srcObject = new MediaStream([t.mediaStreamTrack]);
        camera2Ref.current.play?.().catch(() => {});
        setCamera2Active(true);
      } else if (camera2Ref.current) {
        camera2Ref.current.srcObject = null;
        setCamera2Active(false);
      }
    };

    attach();
    const onSub = (_track, publication, participant) => {
      if (publication.source === Track.Source.Camera && participant.identity === src.identity) {
        attach();
      }
    };
    room.on(RoomEvent.TrackSubscribed, onSub);
    return () => { room.off(RoomEvent.TrackSubscribed, onSub); };
  }, [phase, activeScene, camera2Source]);

  useEffect(() => {
    if (activeScene !== 'camera2') return;
    const t = camera2Source?.type;
    if (t !== 'local_aux' && t !== 'local_display') return;
    const stream = camera2LocalStreamRef.current;
    if (!stream || !camera2Ref.current) return;
    if (!camera2Ref.current.srcObject) {
      camera2Ref.current.srcObject = stream;
      camera2Ref.current.play?.().catch(() => {});
      setCamera2Active(true);
    }
  }, [activeScene, camera2Source]);

  useEffect(() => {
    const room = roomRef.current;
    if (phase !== PHASE.LIVE || !room || !isHost) return undefined;
    const onLeft = (participant) => {
      const cs = camera2SourceRef.current;
      if (cs?.type === 'remote_camera' && cs.identity === participant.identity) {
        clearCamera2LocalStream();
        if (camera2Ref.current) camera2Ref.current.srcObject = null;
        setCamera2Active(false);
        setCamera2Source(null);
        camera2SourceRef.current = null;
        sendSmartboardPayload({ camera2Source: null });
      }
    };
    room.on(RoomEvent.ParticipantDisconnected, onLeft);
    return () => { room.off(RoomEvent.ParticipantDisconnected, onLeft); };
  }, [phase, isHost, clearCamera2LocalStream, sendSmartboardPayload]);

  // ── Mute/Exclure participant (hôte via LiveKit RemoteParticipant) ──────
  const muteParticipant = useCallback((identity) => {
    const room = roomRef.current;
    if (!room) return;
    const remote = room.remoteParticipants.get(identity);
    if (!remote) return;
    // Mute côté local (ne pas lire son audio)
    remote.audioTrackPublications.forEach((pub) => {
      if (pub.track) pub.track.setMuted(true);
    });
  }, []);

  const excludeParticipant = useCallback(async (identity) => {
    // LiveKit Cloud : appel API kick participant via notre Netlify function
    if (!sessionId) return;
    try {
      await fetch('/.netlify/functions/livekit-kick-participant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, identity }),
      });
    } catch (err) {
      console.warn('[LiveArena] Kick échoué:', err.message);
    }
  }, [sessionId]);

  /** Finalise le blob et l'upload avant de couper les pistes LiveKit (sinon fichier tronqué ~1 s). */
  const finalizeRecordingAsync = useCallback(async () => {
    const mr = mediaRecRef.current;
    if (!mr || mr.state === 'inactive') return;
    await new Promise((resolve) => {
      const orig = mr.onstop;
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      mr.onstop = async () => {
        try {
          if (typeof orig === 'function') await orig();
        } catch (e) {
          console.warn('[LiveArena] Enregistrement onstop:', e);
        } finally {
          done();
        }
      };
      try {
        if (typeof mr.requestData === 'function') mr.requestData();
      } catch {
        /* ignore */
      }
      try {
        mr.stop();
      } catch (e) {
        console.warn('[LiveArena] MediaRecorder.stop:', e);
        mr.onstop = orig;
        done();
      }
    });
  }, []);

  // ── Terminer le live ────────────────────────────────────────────────────
  const handleStopLive = useCallback(async () => {
    clearTimeout(liveDisconnectTimerRef.current);
    liveDisconnectTimerRef.current = null;
    if (recordingRef.current && mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
      await finalizeRecordingAsync();
    }

    clearCamera2LocalStream();
    if (camera2Ref.current) camera2Ref.current.srcObject = null;
    setCamera2Active(false);
    setCamera2Source(null);
    camera2SourceRef.current = null;

    // Déconnecter LiveKit
    const room = roomRef.current;
    if (room) {
      try { await room.disconnect(); } catch {}
    }

    // Mettre à jour le statut en DB (hôte seulement)
    if (isHost) {
      await supabase
        .from('live_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', sessionId);

      // NeuroRecall : uniquement si activé dans le wizard (même page que Neuron-Q)
      try {
        let neuroOn = false;
        try {
          const raw = liveSession?.config;
          const c = typeof raw === 'string' ? JSON.parse(raw) : raw;
          neuroOn = c?.neuro_recall_enabled === true;
        } catch { /* ignore */ }
        if (!neuroOn) {
          /* désactivé explicitement */
        } else {
          void supabase.functions.invoke('neuro-recall-bootstrap', { body: { sessionId } }).catch(() => {});
        }
      } catch {
        /* ignore */
      }
    }

    setPhase(PHASE.ENDED);

    // Redirection post-live après 1.5s (studio pour l'hôte, accueil sinon)
    setTimeout(() => {
      navigate(isHost ? `/studio/live-post/${sessionId}` : '/app');
    }, 1500);
  }, [finalizeRecordingAsync, isHost, sessionId, navigate, liveSession, clearCamera2LocalStream]);

  // ───────────────────────────────────────────────────────────────────────────
  // ENREGISTREMENT — MediaRecorder → Supabase Storage
  // Capture directement les tracks vidéo/audio du room LiveKit
  // ───────────────────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (recording || recStarting) return;
    setRecStarting(true);
    setRecError(null);
    try {
      const tracks = [];
      const room = roomRef.current;

      const bucket = import.meta.env.VITE_SUPABASE_LIVE_RECORDINGS_BUCKET || 'live-recordings';

      const pushVideoFromEl = (vid) => {
        if (!vid || !(vid.srcObject instanceof MediaStream)) return;
        vid.srcObject.getVideoTracks().forEach((t) => {
          if (t.readyState === 'live' && !tracks.includes(t)) tracks.push(t);
        });
      };

      // 1. Vidéo : une seule piste recommandée (Chrome n'encode qu'une vidéo proprement).
      //    Capture d'onglet = tout le studio (SmartBoard, slides, mise en page).
      let usedTabVideo = false;
      if (captureStudioTab) {
        const tabStream = await navigator.mediaDevices
          .getDisplayMedia({
            video: { frameRate: 30 },
            audio: false,
            preferCurrentTab: true,
            selfBrowserSurface: 'include',
          })
          .catch(() => null);
        if (tabStream) {
          tabStream.getVideoTracks().forEach((t) => {
            t.addEventListener('ended', () => {
              if (mediaRecRef.current?.state === 'recording') {
                try {
                  mediaRecRef.current.requestData();
                } catch {
                  /* ignore */
                }
                try {
                  mediaRecRef.current.stop();
                } catch {
                  /* ignore */
                }
              }
            });
            tracks.push(t);
          });
          usedTabVideo = true;
        }
      }
      if (!usedTabVideo) {
        pushVideoFromEl(mainVideoRef.current);
        pushVideoFromEl(miniVideoRef.current);
      }

      // 2. Audio : toutes les pistes audio locales + remotes du room
      if (room) {
        // Audio local (micro)
        const localMic = room.localParticipant?.getTrackPublication(Track.Source.Microphone);
        if (localMic?.track?.mediaStreamTrack) {
          tracks.push(localMic.track.mediaStreamTrack);
        }
        // Audio remote (participants)
        room.remoteParticipants.forEach((participant) => {
          participant.getTrackPublications().forEach((pub) => {
            if (pub.kind === 'audio' && pub.track?.mediaStreamTrack) {
              tracks.push(pub.track.mediaStreamTrack);
            }
          });
        });
      }

      // 3. Fallback : si aucune piste vidéo disponible, demander capture d'écran
      if (!tracks.some((t) => t.kind === 'video')) {
        const fallback = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 30 }, audio: true,
          preferCurrentTab: true,
        }).catch(() => null);
        if (fallback) {
          fallback.getTracks().forEach((t) => tracks.push(t));
        } else {
          setRecStarting(false);
          setRecError('Aucune vidéo disponible pour enregistrer');
          return;
        }
      }

      const stream = new MediaStream(tracks);
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm';

      const mr = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2_500_000,
      });

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData?.user?.id;
        if (!uid) {
          setRecError('Session expirée : reconnectez-vous pour enregistrer.');
          return;
        }
        // RLS Storage : 1er segment du chemin = auth.uid() (voir live_recordings_insert_own)
        const fileName = `${uid}/${sessionId}/${Date.now()}.webm`;
        const mainVid = mainVideoRef.current;
        const miniVid = miniVideoRef.current;
        try {
          const { error: upErr } = await supabase.storage
            .from(bucket)
            .upload(fileName, blob, { contentType: 'video/webm', upsert: false });
          if (!upErr) {
            const { error: insErr } = await supabase.from('live_recordings').insert({
              live_session_id: sessionId,
              file_path:       fileName,
              file_size:       blob.size,
              recorded_at:     new Date().toISOString(),
              created_by:      (await supabase.auth.getUser()).data?.user?.id,
            });
            if (insErr) {
              console.warn('[LiveArena] Insert live_recordings:', insErr.message);
              setRecError(`Enregistrement uploadé mais métadonnées refusées : ${insErr.message}`);
            }
          } else {
            console.warn('[LiveArena] Upload Storage échoué:', upErr.message);
            setRecError(`Upload impossible (${bucket}) : ${upErr.message}`);
          }
        } catch (err) {
          console.warn('[LiveArena] Upload enregistrement échoué:', err.message);
          setRecError(err.message || 'Erreur upload enregistrement');
        }
        // Libérer seulement les tracks issus du fallback (getDisplayMedia)
        const keep = new Set([
          ...(mainVid?.srcObject?.getTracks() || []),
          ...(miniVid?.srcObject?.getTracks() || []),
        ]);
        stream.getTracks().forEach((t) => {
          if (!keep.has(t)) t.stop();
        });
        setRecording(false);
      };

      mr.start(1000); // chunks fréquents pour limiter la perte si la piste est coupée
      mediaRecRef.current = mr;
      setRecording(true);
      setRecStarting(false);
    } catch (err) {
      console.warn('[LiveArena] Enregistrement refusé:', err.message);
      setRecError('Enregistrement refusé : ' + err.message);
      setRecStarting(false);
    }
  }, [captureStudioTab, recording, recStarting, sessionId]);

  const stopRecording = useCallback(() => {
    if (mediaRecRef.current && recordingRef.current) {
      try {
        mediaRecRef.current.requestData();
      } catch {
        /* ignore */
      }
      mediaRecRef.current.stop();
    }
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // CLEANUP on unmount
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      const room = roomRef.current;
      if (room) {
        try { room.disconnect(); } catch {}
      }
      const mr = mediaRecRef.current;
      if (mr && recordingRef.current && mr.state !== 'inactive') {
        try {
          mr.requestData();
        } catch {
          /* ignore */
        }
        try {
          mr.stop();
        } catch {
          /* ignore */
        }
      }
      // Nettoyer les éléments audio ajoutés au body
      document.querySelectorAll('audio[data-lk-audio]').forEach((el) => el.remove());
    };
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // WAITING ROOM — Panneau hôte (salle d'attente)
  // ───────────────────────────────────────────────────────────────────────────
  const [waitingEntries, setWaitingEntries] = useState([]);
  const [showWaitingPanel, setShowWaitingPanel] = useState(false);
  /** Journal événements — colonne Notifications (hôte, Arena desktop) */
  const [arenaHostActivityFeed, setArenaHostActivityFeed] = useState([]);
  const hostSfxCtxRef = useRef(null);
  const hostSfxArmedRef = useRef(false);
  const arenaFeedBootRef = useRef(false);
  const prevArenaRemotesRef = useRef(new Set());
  const prevArenaPromotedRef = useRef(null);
  const prevArenaHandsRef = useRef(new Set());
  const prevArenaWaitingIdsRef = useRef(new Set());
  const participantNamesRef = useRef({});
  const arenaHostAlertSoundRef = useRef(true);
  const neuronqFeedPrimedRef = useRef(false);
  const prevNeuronqPendingIdsRef = useRef(new Set());

  useEffect(() => {
    arenaHostAlertSoundRef.current = arenaDesktopHostAlertSoundOn;
  }, [arenaDesktopHostAlertSoundOn]);

  useEffect(() => {
    setArenaHostActivityFeed([]);
    arenaFeedBootRef.current = false;
    neuronqFeedPrimedRef.current = false;
    prevArenaRemotesRef.current = new Set();
    prevArenaPromotedRef.current = null;
    prevArenaHandsRef.current = new Set();
    prevArenaWaitingIdsRef.current = new Set();
    prevNeuronqPendingIdsRef.current = new Set();
  }, [sessionId]);

  useEffect(() => {
    if (phase !== PHASE.LIVE) {
      arenaFeedBootRef.current = false;
      neuronqFeedPrimedRef.current = false;
    }
  }, [phase]);

  useEffect(() => {
    if (!isHost || arenaLayoutCompact) return undefined;
    const arm = () => {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!hostSfxCtxRef.current) {
        try {
          hostSfxCtxRef.current = new Ctx();
        } catch {
          return;
        }
      }
      hostSfxArmedRef.current = true;
      hostSfxCtxRef.current?.resume?.().catch(() => {});
    };
    window.addEventListener('pointerdown', arm, { passive: true });
    window.addEventListener('keydown', arm, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
    };
  }, [isHost, arenaLayoutCompact]);

  // Charger + écouter les entrées en salle d'attente (hôte seulement)
  useEffect(() => {
    if (!isHost || !sessionId) return;

    const loadEntries = async () => {
      const { data: rows, error } = await supabase
        .from('live_waiting_room_entries')
        .select('id, user_id, status, invitation_type, joined_waiting_at')
        .eq('live_session_id', sessionId)
        .eq('status', 'waiting')
        .order('joined_waiting_at', { ascending: true });
      if (error) {
        setWaitingEntries([]);
        return;
      }
      const uids = [...new Set((rows || []).map((r) => r.user_id).filter(Boolean))];
      const { data: profs } = uids.length
        ? await supabase.from('profiles').select('id, name, avatar_url').in('id', uids)
        : { data: [] };
      const pmap = Object.fromEntries((profs || []).map((p) => [p.id, p]));
      setWaitingEntries(
        (rows || []).map((r) => ({ ...r, profiles: pmap[r.user_id] || null }))
      );
    };

    loadEntries();

    const ch = supabase
      .channel(`waiting_host_${sessionId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'live_waiting_room_entries',
        filter: `live_session_id=eq.${sessionId}`,
      }, () => { loadEntries(); })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [isHost, sessionId]);

  // Ouvrir le panneau quand quelqu'un entre en salle d'attente
  useEffect(() => {
    if (waitingEntries.length > 0 && isHost) setShowWaitingPanel(true);
  }, [waitingEntries.length, isHost]);

  const approveWaiting = useCallback(async (entryId, options = {}) => {
    const { videoOff = false, audioOff = false, audioOnly = false } = options;
    await supabase
      .from('live_waiting_room_entries')
      .update({
        status:                audioOnly ? 'audio_only' : 'accepted',
        accepted_at:           new Date().toISOString(),
        granted_publish_video: !videoOff && !audioOnly,
        granted_publish_audio: !audioOff,
      })
      .eq('id', entryId);
    setWaitingEntries((prev) => prev.filter((e) => e.id !== entryId));
  }, []);

  const rejectWaiting = useCallback(async (entryId) => {
    await supabase
      .from('live_waiting_room_entries')
      .update({ status: 'rejected', rejected_at: new Date().toISOString() })
      .eq('id', entryId);
    setWaitingEntries((prev) => prev.filter((e) => e.id !== entryId));
  }, []);

  // COMPUTED
  // ───────────────────────────────────────────────────────────────────────────
  const uxState = drawerOpen ? 'message-drawer-open' : 'focus-video';

  const liriUiMocks = shouldMergeLiriHostMocks(isHost, slides.length);
  const displaySlides = useMemo(() => {
    const normalized = (slides || []).map((s) => normalizeLiveSceneToSlide(s)).filter(Boolean);
    if (normalized.length > 0) return normalized;
    if (liriUiMocks) return getMockSlidesNormalized();
    return [];
  }, [slides, liriUiMocks]);

  const nativeSlides = useMemo(
    () => (displaySlides || []).filter((s) => s?.ia_data),
    [displaySlides],
  );
  const importSlides = useMemo(
    () => (displaySlides || []).filter((s) => s && !s.ia_data),
    [displaySlides],
  );

  useEffect(() => {
    setNativeSlideIndex((i) => Math.min(i, Math.max(0, nativeSlides.length - 1)));
  }, [nativeSlides.length]);
  useEffect(() => {
    setImportSlideIndex((i) => Math.min(i, Math.max(0, importSlides.length - 1)));
  }, [importSlides.length]);

  const safeNativeIdx = Math.min(nativeSlideIndex, Math.max(0, nativeSlides.length - 1));
  const safeImportIdx = Math.min(importSlideIndex, Math.max(0, importSlides.length - 1));

  const parallaxSlide = useMemo(() => {
    if (activeScene === 'smartboard') return nativeSlides[safeNativeIdx] || null;
    if (activeScene === 'diapo') return importSlides[safeImportIdx] || null;
    const combinedIdx = Math.min(slideIndex, Math.max(0, displaySlides.length - 1));
    return displaySlides[combinedIdx] || null;
  }, [activeScene, nativeSlides, importSlides, safeNativeIdx, safeImportIdx, displaySlides, slideIndex]);

  const slideParallaxKey = `${nativeSlideIndex}-${importSlideIndex}-${slideIndex}`;

  useEffect(() => {
    if (!isHost || phase !== PHASE.LIVE) return;
    sbTacticalSyncRef.current = null;
    sendSmartboardPayload({ sbTacticalSync: null });
  }, [slideParallaxKey, activeScene, isHost, phase, sendSmartboardPayload]);
  /** Annotations slide : seulement quand smartboard ou diapo — pas quand on quitte pour le tableau blanc. */
  const slideAnnotationKey =
    activeScene === 'smartboard' || activeScene === 'diapo'
      ? `${activeScene}-${slideParallaxKey}`
      : null;
  const slideAnnotationContextRef = useRef(null);
  useEffect(() => {
    slideAnnotationContextRef.current = null;
    setAnnotationStrokes([]);
    annotationStrokesRef.current = [];
    setSecureAppShareState(null);
    secureAppShareStateRef.current = null;
    const wb = [[]];
    setWhiteboardPages(wb);
    setWhiteboardPageIndex(0);
    whiteboardPagesRef.current = wb;
    whiteboardPageIndexRef.current = 0;
    whiteboardStrokesRef.current = [];
  }, [sessionId]);
  useEffect(() => {
    if (!isHost) return;
    if (slideAnnotationKey === null) return;
    if (slideAnnotationContextRef.current === null) {
      slideAnnotationContextRef.current = slideAnnotationKey;
      return;
    }
    if (slideAnnotationContextRef.current === slideAnnotationKey) return;
    slideAnnotationContextRef.current = slideAnnotationKey;
    setAnnotationStrokes([]);
    annotationStrokesRef.current = [];
    sendSmartboardPayload({ annotationStrokes: [] });
  }, [slideAnnotationKey, isHost, sendSmartboardPayload]);

  const sharedImageSrc = useMemo(() => {
    const g = sharedImageGallery;
    if (!g?.length) return '';
    const i = Math.min(sharedImageIdx, g.length - 1);
    return g[i]?.url || '';
  }, [sharedImageGallery, sharedImageIdx]);

  useEffect(() => {
    setSharedImageIdx((i) => Math.min(i, Math.max(0, sharedImageGallery.length - 1)));
  }, [sharedImageGallery.length]);

  useEffect(() => {
    if (!isHost || activeScene !== 'image' || !sharedImageLoop || sharedImageGallery.length < 2) return undefined;
    const t = window.setInterval(() => {
      setSharedImageIdx((i) => {
        const next = (i + 1) % sharedImageGallery.length;
        queueMicrotask(() => sendSmartboardPayload({ sharedImageIdx: next }));
        return next;
      });
    }, 7000);
    return () => window.clearInterval(t);
  }, [isHost, activeScene, sharedImageLoop, sharedImageGallery.length, sendSmartboardPayload]);

  useEffect(() => {
    const ids = navigatorSceneIds(smartboardSceneFlags);
    if (ids.length > 0 && !ids.includes(activeScene)) {
      setActiveScene(ids[0]);
    }
  }, [smartboardSceneFlags, nativeSlides.length, importSlides.length, activeScene]);

  const changeSlide = useCallback((newIndex) => {
    if (activeScene === 'smartboard') {
      const n = Math.max(0, Math.min(nativeSlides.length - 1, newIndex));
      setNativeSlideIndex(n);
      setSlideIndex(n);
      sendSmartboardPayload({ slideIndex: n, nativeSlideIndex: n });
      return;
    }
    if (activeScene === 'diapo') {
      const n = Math.max(0, Math.min(importSlides.length - 1, newIndex));
      setImportSlideIndex(n);
      setSlideIndex(n);
      sendSmartboardPayload({ slideIndex: n, importSlideIndex: n });
      return;
    }
    const n = Math.max(0, Math.min(displaySlides.length - 1, newIndex));
    setSlideIndex(n);
    sendSmartboardPayload({ slideIndex: n });
  }, [activeScene, nativeSlides.length, importSlides.length, displaySlides.length, sendSmartboardPayload]);

  const goPrevParallaxSlide = useCallback(() => {
    if (activeScene === 'smartboard') {
      changeSlide(Math.max(0, nativeSlideIndex - 1));
    } else if (activeScene === 'diapo') {
      changeSlide(Math.max(0, importSlideIndex - 1));
    } else {
      changeSlide(Math.max(0, slideIndex - 1));
    }
  }, [activeScene, nativeSlideIndex, importSlideIndex, slideIndex, changeSlide]);

  const goNextParallaxSlide = useCallback(() => {
    if (activeScene === 'smartboard') {
      changeSlide(Math.min(Math.max(nativeSlides.length, 1) - 1, nativeSlideIndex + 1));
    } else if (activeScene === 'diapo') {
      changeSlide(Math.min(Math.max(importSlides.length, 1) - 1, importSlideIndex + 1));
    } else {
      changeSlide(Math.min(Math.max(displaySlides.length, 1) - 1, slideIndex + 1));
    }
  }, [activeScene, nativeSlideIndex, importSlideIndex, slideIndex, nativeSlides.length, importSlides.length, displaySlides.length, changeSlide]);

  const changeScene = useCallback((scene) => {
    setActiveScene(scene);
    sendSmartboardPayload({ activeScene: scene });
  }, [sendSmartboardPayload]);

  const goPrevParallaxSlideDebated = useCallback(() => {
    if (debateNavLocked) return;
    goPrevParallaxSlide();
  }, [debateNavLocked, goPrevParallaxSlide]);

  const goNextParallaxSlideDebated = useCallback(() => {
    if (debateNavLocked) return;
    goNextParallaxSlide();
  }, [debateNavLocked, goNextParallaxSlide]);

  const changeSlideDebated = useCallback(
    (newIndex) => {
      if (debateNavLocked) return;
      changeSlide(newIndex);
    },
    [debateNavLocked, changeSlide],
  );

  const changeSceneDebated = useCallback(
    (scene) => {
      if (debateNavLocked) return;
      changeScene(scene);
    },
    [debateNavLocked, changeScene],
  );

  const goToScriptSlide = useCallback(
    (slideIndex) => {
      if (!isHost || debateNavLocked) return;
      const len = nativeSlides.length;
      if (len === 0) return;
      const idx = Math.min(len - 1, Math.max(0, Number(slideIndex) || 0));
      setActiveScene('smartboard');
      setNativeSlideIndex(idx);
      setSlideIndex(idx);
      sendSmartboardPayload({
        activeScene: 'smartboard',
        slideIndex: idx,
        nativeSlideIndex: idx,
      });
    },
    [isHost, debateNavLocked, nativeSlides.length, sendSmartboardPayload],
  );

  const coursePlanSplit = useMemo(
    () => ({
      native: { slides: nativeSlides, index: nativeSlideIndex },
      import: { slides: importSlides, index: importSlideIndex },
    }),
    [nativeSlides, importSlides, nativeSlideIndex, importSlideIndex],
  );

  const onAnnotationStrokesChange = useCallback(
    (update) => {
      if (!isHost) return;
      setAnnotationStrokes((prev) => {
        const p = Array.isArray(prev) ? prev : [];
        const next = typeof update === 'function' ? update(p) : update;
        const raw = Array.isArray(next) ? next : [];
        const { strokes, truncated, removed } = sanitizeAnnotationStrokesForBroadcast(raw);
        if (truncated && removed > 0) {
          queueMicrotask(() => {
            toast({
              title: 'Annotations limitées',
              description:
                removed <= 1
                  ? `Le trait le plus ancien a été retiré (plafond ${ANNOTATION_BROADCAST_MAX_STROKES}). Vous pouvez effacer le calque ou changer de slide.`
                  : `Les ${removed} traits les plus anciens ont été retirés (plafond ${ANNOTATION_BROADCAST_MAX_STROKES}). Effacez le calque ou changez de slide si besoin.`,
              duration: 8000,
            });
          });
        }
        annotationStrokesRef.current = strokes;
        queueMicrotask(() => sendSmartboardPayload({ annotationStrokes: strokes }));
        return strokes;
      });
    },
    [isHost, sendSmartboardPayload, toast],
  );

  const onWhiteboardStrokesChange = useCallback(
    (update) => {
      if (!isHost) return;
      setWhiteboardPages((pagesPrev) => {
        const idx = whiteboardPageIndexRef.current;
        const pages = normalizeWhiteboardPages(pagesPrev);
        const cur = [...(pages[idx] || [])];
        const nextCur = typeof update === 'function' ? update(cur) : update;
        const raw = Array.isArray(nextCur) ? nextCur : [];
        const { strokes, truncated, removed } = sanitizeAnnotationStrokesForBroadcast(raw);
        if (truncated && removed > 0) {
          queueMicrotask(() => {
            toast({
              title: 'Tableau blanc limité',
              description:
                removed <= 1
                  ? `L'élément le plus ancien a été retiré (plafond ${ANNOTATION_BROADCAST_MAX_STROKES}).`
                  : `Les ${removed} éléments les plus anciens ont été retirés (plafond ${ANNOTATION_BROADCAST_MAX_STROKES}).`,
              duration: 8000,
            });
          });
        }
        const nextPages = [...pages];
        nextPages[idx] = strokes;
        whiteboardPagesRef.current = nextPages;
        const patch = whiteboardBroadcastPatch(nextPages, idx);
        whiteboardStrokesRef.current = patch.whiteboardStrokes;
        queueMicrotask(() => sendSmartboardPayload(patch));
        return nextPages;
      });
    },
    [isHost, sendSmartboardPayload, toast],
  );

  const goWhiteboardPrevPage = useCallback(() => {
    if (!isHost) return;
    const pages = whiteboardPagesRef.current;
    const i = whiteboardPageIndexRef.current;
    if (i <= 0) return;
    const next = i - 1;
    whiteboardPageIndexRef.current = next;
    setWhiteboardPageIndex(next);
    const patch = whiteboardBroadcastPatch(pages, next);
    whiteboardStrokesRef.current = patch.whiteboardStrokes;
    queueMicrotask(() => sendSmartboardPayload(patch));
  }, [isHost, sendSmartboardPayload]);

  const goWhiteboardNextPage = useCallback(() => {
    if (!isHost) return;
    const pages = whiteboardPagesRef.current;
    const i = whiteboardPageIndexRef.current;
    if (i >= pages.length - 1) return;
    const next = i + 1;
    whiteboardPageIndexRef.current = next;
    setWhiteboardPageIndex(next);
    const patch = whiteboardBroadcastPatch(pages, next);
    whiteboardStrokesRef.current = patch.whiteboardStrokes;
    queueMicrotask(() => sendSmartboardPayload(patch));
  }, [isHost, sendSmartboardPayload]);

  const addWhiteboardPage = useCallback(() => {
    if (!isHost) return;
    const prev = whiteboardPagesRef.current;
    if (prev.length >= WHITEBOARD_MAX_PAGES) return;
    const next = [...prev, []];
    const newIdx = next.length - 1;
    whiteboardPagesRef.current = next;
    whiteboardPageIndexRef.current = newIdx;
    setWhiteboardPages(next);
    setWhiteboardPageIndex(newIdx);
    const patch = whiteboardBroadcastPatch(next, newIdx);
    whiteboardStrokesRef.current = patch.whiteboardStrokes;
    queueMicrotask(() => sendSmartboardPayload(patch));
  }, [isHost, sendSmartboardPayload]);

  const removeWhiteboardPage = useCallback(() => {
    if (!isHost) return;
    const prev = whiteboardPagesRef.current;
    if (prev.length <= 1) return;
    const idx = whiteboardPageIndexRef.current;
    const next = prev.filter((_, j) => j !== idx);
    const newIdx = Math.min(idx, next.length - 1);
    whiteboardPagesRef.current = next;
    whiteboardPageIndexRef.current = newIdx;
    setWhiteboardPages(next);
    setWhiteboardPageIndex(newIdx);
    const patch = whiteboardBroadcastPatch(next, newIdx);
    whiteboardStrokesRef.current = patch.whiteboardStrokes;
    queueMicrotask(() => sendSmartboardPayload(patch));
  }, [isHost, sendSmartboardPayload]);

  const pickCoursePlanSlideDebated = useCallback(
    (kind, idx) => {
      if (debateNavLocked || !isHost) return;
      if (kind === 'native') {
        setActiveScene('smartboard');
        const n = Math.max(0, Math.min(Math.max(nativeSlides.length, 1) - 1, idx));
        setNativeSlideIndex(n);
        setSlideIndex(n);
        sendSmartboardPayload({ slideIndex: n, nativeSlideIndex: n, activeScene: 'smartboard' });
        return;
      }
      setActiveScene('diapo');
      const n = Math.max(0, Math.min(Math.max(importSlides.length, 1) - 1, idx));
      setImportSlideIndex(n);
      setSlideIndex(n);
      sendSmartboardPayload({ slideIndex: n, importSlideIndex: n, activeScene: 'diapo' });
    },
    [
      debateNavLocked,
      isHost,
      nativeSlides.length,
      importSlides.length,
      sendSmartboardPayload,
    ],
  );

  const onSharedImagePrev = useCallback(() => {
    if (!isHost) return;
    const next = Math.max(0, sharedImageIdx - 1);
    setSharedImageIdx(next);
    sendSmartboardPayload({ sharedImageIdx: next });
  }, [isHost, sharedImageIdx, sendSmartboardPayload]);

  const onSharedImageNext = useCallback(() => {
    if (!isHost) return;
    const next = Math.min(Math.max(sharedImageGallery.length, 1) - 1, sharedImageIdx + 1);
    setSharedImageIdx(next);
    sendSmartboardPayload({ sharedImageIdx: next });
  }, [isHost, sharedImageIdx, sharedImageGallery.length, sendSmartboardPayload]);

  const onToggleSharedImageLoop = useCallback((v) => {
    if (!isHost) return;
    setSharedImageLoop(v);
    sendSmartboardPayload({ sharedImageLoop: v });
  }, [isHost, sendSmartboardPayload]);

  const displayParticipants = useMemo(
    () => mergeParticipantsWithMocks(participants, liriUiMocks),
    [participants, liriUiMocks]
  );
  const zone3Members = useMemo(
    () => (displayParticipants || []).map((p) => ({
      userId: String(p.id),
      name: p.name || p.id,
      avatar_url: p.avatar_url || null,
      role: p.isHost ? 'hôte' : 'membre',
    })),
    [displayParticipants],
  );

  const displayParticipantsRef = useRef(displayParticipants);
  useEffect(() => {
    displayParticipantsRef.current = displayParticipants;
  }, [displayParticipants]);

  const arenaMobileWhisperIncomingRef = useRef(null);
  useEffect(() => {
    arenaMobileWhisperIncomingRef.current = ({ fromId, text }) => {
      const list = displayParticipantsRef.current || [];
      const row = list.find((x) => String(x.id) === String(fromId));
      const name = row?.name || 'Un membre';
      const raw = String(text || '');
      const snippet = raw.length > 80 ? `${raw.slice(0, 77)}…` : raw;
      toast({
        title: `Message privé — ${name}`,
        description: snippet,
        duration: 8500,
        action: (
          <ToastAction
            altText="Ouvrir la conversation privée"
            onClick={() => {
              useMobileLiriStore.getState().openWhisperChat({
                id: String(fromId),
                name,
                avatar: row?.avatar_url,
                isHost: Boolean(row?.isHost),
              });
            }}
          >
            Ouvrir
          </ToastAction>
        ),
      });
    };
  }, [toast]);

  const { threads: arenaMobileWhisperThreads, sendWhisper: arenaMobileSendWhisper } = useLiveSessionWhispers(
    phase === PHASE.LIVE && arenaLayoutCompact && user?.id && sessionId ? sessionId : null,
    user?.id,
    arenaMobileWhisperIncomingRef,
  );

  const displayRaisedHands = useMemo(
    () => mergeRaisedHandsWithMocks(zone3RaisedHands, liriUiMocks),
    [zone3RaisedHands, liriUiMocks]
  );

  useEffect(() => {
    const m = { ...participantNamesRef.current };
    for (const p of displayParticipants || []) {
      m[String(p.id)] = p.name || 'Membre';
    }
    participantNamesRef.current = m;
  }, [displayParticipants]);

  const pushArenaHostFeed = useCallback((text, kind = 'default') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setArenaHostActivityFeed((prev) => [{ id, at: Date.now(), text, kind }, ...prev].slice(0, 100));
    if (
      arenaHostAlertSoundRef.current
      && hostSfxArmedRef.current
      && hostSfxCtxRef.current
    ) {
      playLiriHostEventChime(hostSfxCtxRef.current, kind);
    }
  }, []);

  useEffect(() => {
    if (!isHost || phase !== PHASE.LIVE || arenaLayoutCompact) return;
    const remotes = (displayParticipants || []).filter((p) => !p.isLocal);
    const ids = new Set(remotes.map((p) => String(p.id)));

    if (!arenaFeedBootRef.current) {
      arenaFeedBootRef.current = true;
      prevArenaRemotesRef.current = ids;
      prevArenaPromotedRef.current = promotedId;
      prevArenaHandsRef.current = new Set(
        (displayRaisedHands || []).map((h) => String(h.userId)),
      );
      prevArenaWaitingIdsRef.current = new Set((waitingEntries || []).map((e) => e.id));
      return;
    }

    for (const id of ids) {
      if (!prevArenaRemotesRef.current.has(id)) {
        const p = remotes.find((r) => String(r.id) === id);
        pushArenaHostFeed(`${p?.name || 'Un membre'} vient de rejoindre le panel`, 'join');
      }
    }
    for (const id of prevArenaRemotesRef.current) {
      if (!ids.has(id)) {
        const name = participantNamesRef.current[id];
        pushArenaHostFeed(`${name || 'Un membre'} vient de quitter le panel`, 'leave');
      }
    }
    prevArenaRemotesRef.current = ids;

    const prevP = prevArenaPromotedRef.current;
    const curP = promotedId;
    if (String(prevP ?? '') !== String(curP ?? '')) {
      if (curP != null) {
        const p = (displayParticipants || []).find((x) => String(x.id) === String(curP));
        pushArenaHostFeed(`${p?.name || 'Un membre'} est à l'antenne`, 'promote');
      } else if (prevP != null) {
        pushArenaHostFeed("L'antenne est libérée", 'default');
      }
    }
    prevArenaPromotedRef.current = curP;

    const handSet = new Set((displayRaisedHands || []).map((h) => String(h.userId)));
    for (const uid of handSet) {
      if (!prevArenaHandsRef.current.has(uid)) {
        const h = (displayRaisedHands || []).find((x) => String(x.userId) === uid);
        pushArenaHostFeed(`${h?.name || 'Un membre'} a levé la main`, 'hand');
      }
    }
    prevArenaHandsRef.current = handSet;

    for (const e of waitingEntries || []) {
      if (!prevArenaWaitingIdsRef.current.has(e.id)) {
        const n = e.profiles?.name || 'Un participant';
        pushArenaHostFeed(`${n} vient de rejoindre la file d'attente`, 'waiting');
      }
    }
    prevArenaWaitingIdsRef.current = new Set((waitingEntries || []).map((w) => w.id));
  }, [
    isHost,
    phase,
    arenaLayoutCompact,
    displayParticipants,
    displayRaisedHands,
    promotedId,
    waitingEntries,
    pushArenaHostFeed,
  ]);

  useEffect(() => {
    if (!isHost || phase !== PHASE.LIVE || arenaLayoutCompact || !debateNeuronqEnabled) return;
    const pending = (neuronqQuestions || []).filter((q) => q.status === 'pending');
    const ids = pending.map((q) => q.id).filter(Boolean);
    if (!neuronqFeedPrimedRef.current) {
      neuronqFeedPrimedRef.current = true;
      prevNeuronqPendingIdsRef.current = new Set(ids);
      return;
    }
    for (const q of pending) {
      if (!q.id || prevNeuronqPendingIdsRef.current.has(q.id)) continue;
      const raw = String(q.reformulated_text || q.raw_text || '').trim() || 'Nouvelle question';
      const snippet = raw.length > 72 ? `${raw.slice(0, 69)}…` : raw;
      pushArenaHostFeed(`Q&R : ${snippet}`, 'default');
    }
    prevNeuronqPendingIdsRef.current = new Set(ids);
  }, [
    neuronqQuestions,
    isHost,
    phase,
    arenaLayoutCompact,
    debateNeuronqEnabled,
    pushArenaHostFeed,
  ]);

  const displayScriptSections = useMemo(() => {
    if (configScriptSections.length > 0) return configScriptSections;
    if (liriUiMocks) return LIRI_MOCK_SCRIPT_SECTIONS;
    return [];
  }, [configScriptSections, liriUiMocks]);

  /** Section MasterScript alignée sur la diapo active (slide_index ou ordre). */
  const scriptCurrentSection = useMemo(() => {
    const list = displayScriptSections;
    if (!Array.isArray(list) || list.length === 0) return null;
    let idxForScript = slideIndex;
    if (activeScene === 'smartboard') idxForScript = safeNativeIdx;
    else if (activeScene === 'diapo') idxForScript = safeImportIdx;
    const match = list.find((s) => Number(s.slide_index) === Number(idxForScript));
    if (match) return match;
    return list[Math.min(idxForScript, list.length - 1)] ?? null;
  }, [displayScriptSections, slideIndex, activeScene, safeNativeIdx, safeImportIdx]);

  const localParticipantRow = useMemo(
    () => displayParticipants.find((p) => p.isLocal) || null,
    [displayParticipants],
  );
  const incomingMainRow = useMemo(() => {
    const byPromo = displayParticipants.find(
      (p) => String(p.id) === String(promotedId) && !p.isLocal,
    );
    if (byPromo) return byPromo;
    return displayParticipants.find((p) => !p.isLocal) || null;
  }, [displayParticipants, promotedId]);

  const arenaMainDisplayParticipant = incomingMainRow
    ? {
        name: incomingMainRow.name,
        panelLabel: incomingMainRow.isHost ? 'Hôte' : 'Flux entrant',
        panelSubtitle: String(incomingMainRow.id),
      }
    : {
        name: 'Salle',
        panelLabel: 'Flux entrant',
        panelSubtitle: 'En attente de participants',
      };

  const arenaMiniDisplayParticipant = localParticipantRow
    ? {
        name: localParticipantRow.name,
        panelLabel: 'Prévisualisation locale',
        panelSubtitle: String(localParticipantRow.id),
      }
    : null;

  const arenaRemoteWaiting = !displayParticipants.some((p) => !p.isLocal);

  const slideBarCurrent =
    activeScene === 'smartboard'
      ? safeNativeIdx + 1
      : activeScene === 'diapo'
        ? safeImportIdx + 1
        : slideIndex + 1;
  const slideBarTotal =
    activeScene === 'smartboard'
      ? Math.max(1, nativeSlides.length)
      : activeScene === 'diapo'
        ? Math.max(1, importSlides.length)
        : Math.max(1, displaySlides.length);
  const slideRailCount =
    activeScene === 'smartboard'
      ? Math.max(1, nativeSlides.length)
      : activeScene === 'diapo'
        ? Math.max(1, importSlides.length)
        : Math.max(1, displaySlides.length);
  const shellSlideIndex =
    activeScene === 'smartboard'
      ? nativeSlideIndex
      : activeScene === 'diapo'
        ? importSlideIndex
        : slideIndex;

  const arenaLiriMobileMembers = useMemo(() => {
    const byId = new Map();
    for (const p of displayParticipants || []) {
      const id = String(p.id ?? '');
      if (!id) continue;
      let lastActiveLabel = 'Récemment actif';
      if (p.isLocal) {
        lastActiveLabel = 'Vous · dans le live';
      } else if (p.liveJoinedAtMs) {
        try {
          lastActiveLabel = `En ligne depuis ${formatDistanceToNow(new Date(p.liveJoinedAtMs), { addSuffix: true, locale: fr })}`;
        } catch {
          lastActiveLabel = 'Récemment actif';
        }
      }
      byId.set(id, {
        id,
        name: p.name || 'Participant',
        avatar_url: p.avatar_url || null,
        isHost: Boolean(p.isHost),
        lastActiveLabel,
        locationLabel: p.locationLabel || null,
      });
    }
    for (const z of zone3Members || []) {
      const id = String(z.userId || '');
      if (!id || byId.has(id)) continue;
      byId.set(id, {
        id,
        name: z.name || 'Membre',
        avatar_url: z.avatar_url || null,
        isHost: false,
        role: z.role,
        lastActiveLabel: 'Récemment actif',
        locationLabel: null,
      });
    }
    return [...byId.values()];
  }, [displayParticipants, zone3Members]);

  const arenaLiriSmartboardPlan = useMemo(
    () => ({
      plan: buildMaquettePlanRibbon({
        activeScene,
        coursePlanSplit,
        slideIndex: shellSlideIndex,
        totalSlides: slideRailCount,
      }),
      sceneCaption: buildMaquetteSceneLineCaption({
        activeScene,
        compositorSlide: parallaxSlide,
        scriptCurrentSection,
      }),
    }),
    [activeScene, coursePlanSplit, shellSlideIndex, slideRailCount, parallaxSlide, scriptCurrentSection],
  );

  useEffect(() => {
    const n = displaySlides.length;
    if (n === 0) return;
    setSlideIndex((idx) => Math.min(idx, n - 1));
  }, [displaySlides.length]);

  // ───────────────────────────────────────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────────────────────────────────────

  // Phases loading / error / ended
  const recoveryAsHost = Boolean(user?.id && liveSession?.teacher_id === user?.id);
  if (phase !== PHASE.LIVE) {
    return (
      <PhaseScreen
        phase={phase}
        error={error}
        sessionId={sessionId}
        isHost={isHost}
        recoveryAsHost={recoveryAsHost}
        joinCode={liveSession?.join_code}
      />
    );
  }

  const recordingIndicator = isHost ? recording : hostRecordingActive;

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden select-none"
      data-school-shell="live-arena"
      data-tenant-brand={branding.slug}
      style={{
        ...cssVars,
        background: 'var(--school-background, #0a0908)',
        fontFamily: 'var(--school-font-family, Inter, sans-serif)',
      }}
    >

      {/* ── Indicateur statut ── */}
      <LiveStatusBadge
        phase={phase}
        duration={duration}
        participantCount={displayParticipants.length}
        recording={recordingIndicator}
      />

      <LiveHostLayoutPreviewModal
        open={layoutPreviewModalOpen}
        onOpenChange={setLayoutPreviewModalOpen}
        mobilePreviewActive={previewMobileMaquette}
        onMobilePreviewChange={setPreviewMobileMaquette}
        projectorPreviewActive={previewProjectorLayout}
        onProjectorPreviewChange={setPreviewProjectorLayout}
        cinemaModeReal={cinemaMode}
      />

      {isHost && arenaLiriCompact && !previewMobileMaquette && !previewProjectorLayout ? (
        <button
          type="button"
          onClick={() => setLayoutPreviewModalOpen(true)}
          className="pointer-events-auto fixed bottom-[5.5rem] right-3 z-[305] rounded-full border border-white/15 bg-[#14131c]/90 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-white/75 shadow-lg backdrop-blur-md transition hover:border-violet-400/35 hover:text-violet-100 sm:right-4"
        >
          Aperçu vues
        </button>
      ) : null}

      {isHost && previewMobileMaquette && !arenaLiriCompact ? (
        <div className="pointer-events-auto fixed left-1/2 top-3 z-[305] flex max-w-[min(92vw,420px)] -translate-x-1/2 items-center gap-2 rounded-full border border-violet-400/35 bg-[#0c0a18]/95 px-3 py-1.5 text-[11px] text-violet-100 shadow-lg backdrop-blur-md">
          <span className="truncate font-medium text-white/85">Vue mobile (aperçu)</span>
          <button
            type="button"
            onClick={() => setPreviewMobileMaquette(false)}
            className="shrink-0 rounded-lg bg-violet-500/25 px-2 py-0.5 text-[10px] font-semibold hover:bg-violet-500/40"
          >
            Fermer
          </button>
        </div>
      ) : null}

      {isHost && previewProjectorLayout && !cinemaMode ? (
        <div className="pointer-events-auto fixed left-1/2 top-3 z-[305] flex max-w-[min(92vw,420px)] -translate-x-1/2 items-center gap-2 rounded-full border border-amber-400/40 bg-[#14100c]/95 px-3 py-1.5 text-[11px] text-amber-100 shadow-lg backdrop-blur-md">
          <span className="truncate font-medium text-white/85">Vue projecteur (aperçu)</span>
          <button
            type="button"
            onClick={() => setPreviewProjectorLayout(false)}
            className="shrink-0 rounded-lg bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold hover:bg-amber-500/35"
          >
            Fermer
          </button>
        </div>
      ) : null}

      <DebateModeBanner debate={debateArena} liveVoteCounts={debateLiveVoteCounts} />

      {isHost && debateArena ? (
        <DebateModeratorPanel
          debate={debateArena}
          busy={debateModBusy}
          onPatch={debatePatch}
          roundStatus={debateCurrentRoundStatus}
          onOpenVoting={debateOpenVoting}
          onCloseVoting={debateCloseVoting}
          liveVoteCounts={debateLiveVoteCounts}
          aiJudgeEnabled={debateArena.aiJudgeEnabled}
          aiJudgeBusy={debateAiJudgeBusy}
          aiReportPreview={debateAiReportPreview}
          onRunAiJudge={debateRunAiJudge}
        />
      ) : null}

      {debateArena && user?.id ? (
        <DebateVoteStrip
          debate={debateArena}
          userId={user.id}
          isHost={isHost}
          voteBusy={debateVoteBusy}
          setVoteBusy={setDebateVoteBusy}
          onAfterVote={() => void refreshDebateRounds(debateArena.debateId)}
          liveVoteCounts={debateLiveVoteCounts}
          compact={arenaLayoutCompact}
        />
      ) : null}

      {/* ── Barre enregistrement en cours ── */}
      <RecordingBar recording={recordingIndicator} onToggle={stopRecording} canStopRecording={isHost} />

      {/* ── Salle immersive principale ── */}
      <LiveRoomShell
        active={phase === PHASE.LIVE}
        mainVideoRef={mainVideoRef}
        miniVideoRef={miniVideoRef}
        mainDisplayParticipant={arenaMainDisplayParticipant}
        miniDisplayParticipant={arenaMiniDisplayParticipant}
        participants={displayParticipants}
        zone3Members={zone3Members}
        hostParticipant={displayParticipants.find((p) => p.isLocal) || displayParticipants[0]}
        promotedParticipantId={promotedId}
        onPromoteParticipant={setPromotedId}
        remoteWaiting={arenaRemoteWaiting}
        slides={displaySlides}
        coursePlanSplit={coursePlanSplit}
        onPickCoursePlanSlide={pickCoursePlanSlideDebated}
        slideRailCount={slideRailCount}
        slideIndex={shellSlideIndex}
        onPrevSlide={goPrevParallaxSlideDebated}
        onNextSlide={goNextParallaxSlideDebated}
        onSetSlideIndex={changeSlideDebated}
        parallaxSlide={parallaxSlide}
        slideParallaxKey={slideParallaxKey}
        sceneFlags={smartboardSceneFlags}
        sharedImageSrc={sharedImageSrc}
        sharedGalleryLength={sharedImageGallery.length}
        sharedImageIndex={sharedImageIdx}
        onSharedImagePrev={onSharedImagePrev}
        onSharedImageNext={onSharedImageNext}
        sharedImageLoop={sharedImageLoop}
        onToggleSharedImageLoop={onToggleSharedImageLoop}
        spotlight={spotlight}
        onToggleSpotlight={() => setSpotlight((v) => !v)}
        progressivePlayback={progressivePlayback}
        tacticalSyncRole={phase === PHASE.LIVE ? (isHost ? 'host' : 'viewer') : undefined}
        remoteTacticalSync={isHost ? null : sbTacticalSyncRemote}
        onTacticalSyncChange={isHost && phase === PHASE.LIVE ? handleSbTacticalSync : undefined}
        onSmartboardImageExpand={isHost ? openSmartboardImageModal : undefined}
        onMasterScriptNavigateToSlide={isHost ? goToScriptSlide : undefined}
        drawerOpen={drawerOpen}
        unreadCount={unreadCount}
        onToggleDrawer={() => { setDrawerOpen((v) => !v); setUnreadCount(0); }}
        drawerMessages={drawerForumMessages}
        onSendForumMessage={sendForumMessage}
        forumSending={forumSending}
        currentUserId={user?.id}
        muted={muted}
        cameraOff={cameraOff}
        sharingScreen={sharingScreen}
        screenShareVideoRef={screenVideoRef}
        camera2VideoRef={camera2Ref}
        camera2Active={camera2Active}
        onStartCamera2={handleCamera2Start}
        camera2FluxParticipants={displayParticipants}
        camera2Placeholder={
          !isHost && activeScene === 'camera2'
          && (camera2Source?.type === 'local_aux' || camera2Source?.type === 'local_display')
            ? "L'hôte montre une 2ᵉ caméra ou l'écran de son appareil (SmartBoard). Ce flux reste local — pour le voir, qu'il bascule sur « Moi (caméra principale) » ou un 2ᵉ appareil dans la liste."
            : null
        }
        camera2WaitingRemote={
          !isHost && activeScene === 'camera2' && camera2Source?.type === 'remote_camera' && !camera2Active
        }
        activeScene={activeScene}
        onChangeScene={changeSceneDebated}
        annotationStrokes={annotationStrokes}
        onAnnotationStrokesChange={isHost ? onAnnotationStrokesChange : undefined}
        whiteboardStrokes={whiteboardStrokes}
        onWhiteboardStrokesChange={isHost ? onWhiteboardStrokesChange : undefined}
        whiteboardPageIndex={whiteboardPageIndex}
        whiteboardPageCount={whiteboardPages.length}
        onWhiteboardPrevPage={isHost ? goWhiteboardPrevPage : undefined}
        onWhiteboardNextPage={isHost ? goWhiteboardNextPage : undefined}
        onWhiteboardAddPage={isHost ? addWhiteboardPage : undefined}
        onWhiteboardRemovePage={isHost ? removeWhiteboardPage : undefined}
        secureAppShareState={secureAppShareState}
        onSecureAppShareStateChange={isHost ? onSecureAppShareStateChange : undefined}
        uxState={uxState}
        onToggleMuted={toggleMuted}
        onToggleCamera={toggleCamera}
        onToggleShare={toggleScreenShare}
        onStopLive={handleStopLive}
        ambientTracks={ambientTracks}
        ambientAudioEnabled={arenaLayoutCompact ? arenaMobileAmbientOn : true}
        sceneTransitionSoundEnabled={arenaLayoutCompact ? arenaMobileSoundFxOn : true}
        shopProducts={shopProducts}
        onShopProductClick={(product) => {
          const url = product.payUrl || product.url;
          if (url) window.open(url.startsWith('/') ? window.location.origin + url : url, '_blank', 'noopener');
        }}
        isHost={isHost}
        zone3RaisedHands={displayRaisedHands}
        scriptSections={displayScriptSections}
        scriptCurrentSection={scriptCurrentSection}
        zone3PrivilegedSeats={zone3PrivilegedSeats}
        zone3MyHandRaised={myHandRaised}
        onZone3RaiseHand={raiseHand}
        onZone3LowerHand={zone3LowerHand}
        onZone3GrantSeat={zone3GrantSeat}
        onZone3RevokeSeat={zone3RevokeSeat}
        neuronqFeatureEnabled={debateNeuronqEnabled}
        neuronqQuestions={debateNeuronqEnabled ? neuronqQuestions : []}
        neuronqPendingCount={
          debateNeuronqEnabled ? neuronqQuestions.filter((q) => q.status === 'pending').length : 0
        }
        neuronqQaMode={debateNeuronqEnabled && neuronqQaMode}
        onNeuronqToggleQa={() => debateNeuronqEnabled && setNeuronqQaMode((v) => !v)}
        onNeuronqMarkAnswered={neuronqMarkAnswered}
        onNeuronqMarkSkipped={neuronqMarkSkipped}
        onNeuronqReformulate={neuronqReformulate}
        onNeuronqSubmit={neuronqSubmit}
        neuronqReformulating={neuronqReformulating}
        neuronqSubmitting={neuronqSubmitting}
        videoBlur={videoBlur}
        videoBeauty={videoBeauty}
        videoVbg={videoVbg}
        videoFilterCSS={videoFilterCSS}
        videoChromaKey={videoChromaKey}
        videoChromaColor={videoChromaColor}
        videoChromaSens={videoChromaSens}
        pipStream={arenaPipStream}
        onPipCanvasRef={handleArenaPipCanvasRef}
        immersiveVideoGlass
        cinemaMode={arenaCinemaEffective}
        onToggleCinema={handleCinemaToggle}
        liveKitRoomRef={roomRef}
        liveWhisperSessionKey={phase === PHASE.LIVE ? sessionId : null}
        liveSessionWhisperBridge={
          arenaLayoutCompact && phase === PHASE.LIVE && user?.id && sessionId
            ? { threads: arenaMobileWhisperThreads, sendWhisper: arenaMobileSendWhisper }
            : null
        }
        liriAudioScenes={liriAudioScenes}
        showLiriAudioScenePanel={liriAudioScenes.length > 0}
        liriAudioInitialSceneIndex={liriAudioInitialSceneIndex}
        liriAudioSessionKey={sessionId ?? null}
        onLiriAudioSceneIndexChange={isHost ? persistLiriSceneIndex : undefined}
        liriAudioRemoteSmartboardPayload={!isHost ? guestLiriAudioSmartboard : undefined}
        liriAudioRemoteSceneName={!isHost ? guestLiriAudioSceneName : undefined}
        liriMobileMaquette={arenaLayoutCompact}
        liriMobileSmartboardFull={smartboardFullMobile}
        liveArenaMotherboardFrame={!arenaLayoutCompact}
        immersiveBackdropVariant={arenaLayoutCompact ? 'default' : 'liriHost'}
        arenaWaitingEntries={waitingEntries}
        onArenaApproveWaiting={approveWaiting}
        onArenaRejectWaiting={rejectWaiting}
        arenaHostActivityFeed={arenaHostActivityFeed}
        onArenaHostActivityFeedClear={() => setArenaHostActivityFeed([])}
        lockedHostMembersColumn={isHost && !arenaLayoutCompact ? arenaLockedHostMembersColumn : false}
        onLockedHostMembersColumnChange={
          isHost && !arenaLayoutCompact ? setArenaLockedHostMembersColumn : undefined
        }
        onOpenLiveSettings={isHost ? () => setShowSettings(true) : undefined}
        smartboardSceneDockPlacement="footer"
      />

      {arenaLayoutCompact ? (
        <>
          <GestureOverlayController
            enabled
            liveActive
            onRequestExit={() => navigate('/studio')}
          />
          <LiriMobileOverlaysRoot
            members={arenaLiriMobileMembers}
            currentUserId={user?.id}
            onOpenLiveSettings={() => setShowSettings(true)}
            onSendForumLine={(t) => void sendForumMessage(t)}
            forumSending={forumSending}
            onConfirmExitLive={() => void leaveSession()}
            smartboardFullPlan={arenaLiriSmartboardPlan}
            liveSettingsPanel={{
              muted,
              onMutedChange: (v) => void applyMuted(v),
              ambientMusicEnabled: arenaMobileAmbientOn,
              onAmbientMusicChange: setArenaMobileAmbientOn,
              subtitlesEnabled: arenaMobileSubtitlesOn,
              onSubtitlesChange: setArenaMobileSubtitlesOn,
              soundEffectsEnabled: arenaMobileSoundFxOn,
              onSoundEffectsChange: setArenaMobileSoundFxOn,
            }}
            whisperSessionKey={arenaLayoutCompact && phase === PHASE.LIVE ? sessionId : null}
            whisperThreads={arenaMobileWhisperThreads}
            sendWhisper={arenaMobileSendWhisper}
          />
        </>
      ) : null}

      {/* ── Réactions flottantes ── */}
      <div className="fixed inset-x-0 bottom-20 pointer-events-none z-[290]">
        <AnimatePresence>
          {floatingReactions.map((r) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ opacity: 0, y: -140, scale: 1.8 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.8, ease: 'easeOut' }}
              style={{ position: 'absolute', left: `${r.x}%`, bottom: 0 }}
              className="text-4xl select-none"
            >
              {r.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Barre de contrôle — masquée en mode cinéma sauf au survol ── */}
      <div className={cn(
        'transition-opacity duration-300',
        arenaCinemaEffective && 'opacity-0 hover:opacity-100 focus-within:opacity-100',
      )}>
      <LiveControlsBar
        muted={muted}
        cameraOff={cameraOff}
        sharingScreen={sharingScreen}
        spotlight={spotlight}
        isHost={isHost}
        onToggleMuted={toggleMuted}
        onToggleCamera={toggleCamera}
        onToggleShare={!isHost && !studentPerms.canScreen ? undefined : toggleScreenShare}
        onToggleSpotlight={() => setSpotlight((v) => !v)}
        progressivePlayback={progressivePlayback}
        onToggleProgressiveReading={isHost ? toggleProgressivePlayback : undefined}
        slideCurrent={slideBarCurrent}
        slideTotal={slideBarTotal}
        onPrevSlide={goPrevParallaxSlideDebated}
        onNextSlide={goNextParallaxSlideDebated}
        onStopLive={handleStopLive}
        onOpenSettings={openSettings}
        premiumHostDock={isHost && !arenaLayoutCompact && phase === PHASE.LIVE}
        onHostInstructionSubmit={isHost && !arenaLayoutCompact ? sendForumMessage : undefined}
        instructionSending={forumSending}
        inviteUrl={isHost ? `${window.location.origin}/live/${sessionId}` : ''}
        handRaised={myHandRaised}
        onRaiseHand={raiseHand}
        onLowerHand={lowerHand}
        onSendReaction={sendReaction}
        onLeave={leaveSession}
        cinemaMode={arenaCinemaEffective}
        onToggleCinema={handleCinemaToggle}
        forumDrawerOpen={drawerOpen}
        forumUnreadCount={unreadCount}
        onToggleForum={() => {
          setDrawerOpen((v) => !v);
          setUnreadCount(0);
        }}
        participantsOpen={isHost && !arenaLayoutCompact ? arenaLockedHostMembersColumn : false}
        onToggleParticipants={
          isHost && !arenaLayoutCompact
            ? () => setArenaLockedHostMembersColumn((v) => !v)
            : undefined
        }
        onOpenLayoutPreview={
          isHost && !arenaLiriCompact ? () => setLayoutPreviewModalOpen(true) : undefined
        }
        footerSceneDock={(
          <SmartboardSceneDockHorizontal
            scenes={arenaSmartboardNavigatorScenes}
            currentScene={activeScene}
            onChangeScene={isHost ? changeSceneDebated : undefined}
            readOnly={!isHost}
            premiumArenaHostTray={isHost}
          />
        )}
      />
      </div>

      {/* ── Panneau Paramètres Studio (remplace l'ancien modal) ── */}
      <LiveStudioSettingsPanel
        open={showSettings}
        onClose={() => setShowSettings(false)}
        beauty={videoBeauty}                    onBeautyChange={setVideoBeauty}
        chromaKey={videoChromaKey}              onChromaKeyChange={handleArenaChromaKeyChange}
        chromaColor={videoChromaColor}          onChromaColorChange={setVideoChromaColor}
        chromaSensitivity={videoChromaSens}     onChromaSensitivityChange={setVideoChromaSens}
        videoBlur={videoBlur}                   onVideoBlurChange={setVideoBlur}
        videoVbg={videoVbg}                     onVideoVbgChange={handleArenaVbgChange}
        customBgUrl={videoCustomBgUrl}          onCustomBgChange={setVideoCustomBgUrl}
        brightness={videoBrightness}            onBrightnessChange={setVideoBrightness}
        contrast={videoContrast}                onContrastChange={setVideoContrast}
        saturation={videoSaturation}            onSaturationChange={setVideoSaturation}
        hue={videoHue}                          onHueChange={setVideoHue}
        micGain={micGain}                       onMicGainChange={setMicGain}
        noiseReduction={noiseReduction}         onNoiseReductionChange={setNoiseReduction}
        videoDevices={videoDevices}
        audioDevices={audioDevices}
        activeVideoId={activeVideoId}
        activeAudioId={activeAudioId}
        onSwitchVideo={switchVideoDevice}
        onSwitchAudio={switchAudioDevice}
        arenaHostAlertSoundsEnabled={
          isHost && !arenaLiriCompact ? arenaDesktopHostAlertSoundOn : undefined
        }
        onArenaHostAlertSoundsChange={
          isHost && !arenaLiriCompact ? setArenaDesktopHostAlertSoundOn : undefined
        }
      />

      {sbImageModal?.url && (isHost || !sbImageModalGuestDismissed) ? (
        <div
          className="fixed inset-0 z-[6200] flex flex-col items-center justify-center gap-2 bg-black/88 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Image agrandie"
        >
          <div className="relative flex max-h-[min(88vh,900px)] max-w-[min(96vw,1200px)] flex-1 items-center justify-center">
            <button
              type="button"
              onClick={() => {
                if (isHost) closeSbImageModal();
                else setSbImageModalGuestDismissed(true);
              }}
              className="absolute -top-1 right-0 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white/80 hover:bg-white/10 hover:text-white sm:-right-2 sm:-top-2"
              aria-label={isHost ? 'Fermer pour tout le monde' : 'Masquer pour moi'}
            >
              <XIcon className="h-5 w-5" />
            </button>
            <img
              src={sbImageModal.url}
              alt={sbImageModal.label || ''}
              className="max-h-full max-w-full rounded-lg border border-white/10 object-contain shadow-2xl"
            />
          </div>
          {sbImageModal.label ? (
            <p className="max-w-xl text-center text-sm text-white/70">{sbImageModal.label}</p>
          ) : null}
          {!isHost ? (
            <p className="text-center text-[10px] text-white/35">
              Masquer n&apos;affecte que votre écran — l&apos;hôte ferme pour tous.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ── Panneau salle d'attente (hôte seulement) ── */}
      <AnimatePresence>
        {isHost && showWaitingPanel && waitingEntries.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 320 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 320 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute top-20 right-4 z-50 w-72 rounded-2xl border border-white/10 bg-[#080c14]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400/60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                </span>
                <p className="text-xs font-semibold text-white">
                  Salle d'attente · {waitingEntries.length}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowWaitingPanel(false)}
                className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <XIcon className="w-2.5 h-2.5 text-white/40" />
              </button>
            </div>

            {/* Liste */}
            <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.04]">
              {waitingEntries.map((entry) => (
                <div key={entry.id} className="px-4 py-3 space-y-2.5">
                  {/* Identité */}
                  <div className="flex items-center gap-2.5">
                    {entry.profiles?.avatar_url ? (
                      <img src={entry.profiles.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10 flex-shrink-0" />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-full border flex items-center justify-center text-[11px] font-bold text-[var(--school-accent,#D4AF37)] flex-shrink-0"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 20%, transparent)',
                          borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 30%, transparent)',
                        }}
                      >
                        {(entry.profiles?.name || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">
                        {entry.profiles?.name || 'Participant'}
                      </p>
                      <p className="text-[10px] text-white/40 capitalize">
                        {entry.invitation_type || 'individuel'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => approveWaiting(entry.id)}
                      className="flex-1 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold hover:bg-emerald-500/30 transition-colors"
                    >
                      Accepter
                    </button>
                    <button
                      type="button"
                      onClick={() => approveWaiting(entry.id, { videoOff: true })}
                      className="h-7 px-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-[10px] hover:text-white transition-colors"
                      title="Accepter sans caméra"
                    >
                      📷✗
                    </button>
                    <button
                      type="button"
                      onClick={() => approveWaiting(entry.id, { audioOnly: true })}
                      className="h-7 px-2 rounded-lg border text-[10px] text-[var(--school-accent,#D4AF37)] hover:bg-white/[0.06] transition-colors"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 10%, transparent)',
                        borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 25%, transparent)',
                      }}
                      title="Auditeur seulement"
                    >
                      🎧
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectWaiting(entry.id)}
                      className="h-7 px-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] hover:bg-red-500/20 transition-colors"
                    >
                      Refuser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Badge cloche salle d'attente (si panneau fermé) */}
      {isHost && !showWaitingPanel && waitingEntries.length > 0 && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          type="button"
          onClick={() => setShowWaitingPanel(true)}
          className="absolute top-20 right-4 z-50 w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center hover:bg-amber-500/30 transition-colors"
          title={`${waitingEntries.length} personne(s) en attente`}
        >
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center text-[9px] font-bold text-black">
            {waitingEntries.length}
          </span>
          <Users className="w-4 h-4 text-amber-400" />
        </motion.button>
      )}

      {/* ── Bouton enregistrement (hôte seulement) ── */}
      {isHost && !recording && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute bottom-20 right-4 z-50 flex flex-col items-end gap-1.5"
        >
          {recError && (
            <div className="bg-red-900/80 border border-red-500/40 rounded-lg px-3 py-1.5 text-xs text-red-300 max-w-48 text-right">
              {recError}
            </div>
          )}
          <label className="flex items-center justify-end gap-1.5 text-[10px] text-white/55 cursor-pointer select-none max-w-56 text-right leading-tight">
            <input
              type="checkbox"
              checked={captureStudioTab}
              onChange={(e) => setCaptureStudioTab(e.target.checked)}
              className="rounded border-white/30 shrink-0"
            />
            Capturer l'onglet studio (interface complète, recommandé pour l\'IA)
          </label>
          <motion.button
            type="button"
            onClick={startRecording}
            disabled={recStarting}
            className="flex items-center gap-1.5 h-8 px-4 rounded-full bg-black/60 border border-white/15 text-white/60 text-xs hover:border-orange-500/40 hover:text-orange-300 transition-all backdrop-blur-xl disabled:opacity-50 disabled:cursor-wait"
            title="Démarrer l'enregistrement"
          >
            {recStarting
              ? <Loader2 className="w-2.5 h-2.5 animate-spin text-orange-400" />
              : <Circle className="w-2.5 h-2.5 text-orange-400" />}
            {recStarting ? 'Démarrage…' : 'Enregistrer'}
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}
