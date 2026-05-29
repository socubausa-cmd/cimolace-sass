import { useCallback, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { PHASE } from '@/features/live/host/liveHostConstants';
import { nt } from '@/features/live/host/liveHostUtils';
import { buildLongiaPanelEvent, LONGIA_NOTIF_CATEGORY } from '@/lib/longiaLiveCopilot';
import {
  composeFromChatWindowHeuristic,
  composeFromSecureAppStatusBus,
  composeFromTranscriptFinalStub,
  MODE,
  TARGET,
} from '@/lib/longiaDecisionEngine';
import { persistLongiaRecapDecision } from '@/lib/longiaRecapPersistence';
import {
  BUS_EVENTS,
  LONGIA_BUS_BROADCAST_EVENT,
  wrapLongiaBusPayload,
} from '@/lib/longiaRealtimeBus';
import { mapLongiaRealtimeNotificationsToPanelPayloads } from '@/lib/mapLongiaRealtimeNotification';
import { playLiriHostEventChime } from '@/lib/liriHostEventChime';
import { broadcastRealtime } from '@/lib/realtimeBroadcast';

/**
 * LONGIA decision engine : notifications hôte, décisions moteur, analyse chat,
 * gouverneur, actions UI et push SmartBoard architecte.
 */
export function useLiveHostLongiaDecisionEngine({
  isGuestUi,
  phase,
  sessionId,
  toast,
  setPanels,
  sendSmartboardHostPayload,
  openLongiaHubSignauxHome,
  setNeuronQActive,
  setLongiaGovernorModes,
  chatMessages,
  analyzeLiveContext,
  smartBoardStageRef,
  longiaModesRef,
  arenaHostAlertSoundRef,
  hostSfxCtxRef,
  longiaBusHostChRef,
  longiaSessionDigestBroadcastRef,
  transcriptEngineCooldownRef,
  visibilitySignalCooldownRef,
  longiaChatAnalyzeTimerRef,
  longiaLastChatLenRef,
  longiaSeenRealtimeIdsRef,
  chatHeuristicCooldownRef,
  applyLongiaEngineDecisionsRef,
  flushBusStudentSignalsRef,
}) {
  const pushLongiaHostNotif = useCallback((payload) => {
    if (isGuestUi || phase !== PHASE.LIVE) return;
    const src = payload?.sourceMode;
    if (src != null && src !== '' && longiaModesRef.current[src] === false) return;
    const ev = buildLongiaPanelEvent({
      category: payload.category,
      headline: payload.headline,
      detail: payload.detail,
      urgent: payload.urgent,
      timeLabel: nt(),
      sourceMode: payload.sourceMode,
    });
    if (payload.longiaRealtimeId) ev.longiaRealtimeId = payload.longiaRealtimeId;
    if (payload.longiaRealtimeActions?.length) ev.longiaRealtimeActions = payload.longiaRealtimeActions;
    if (payload.longiaDecision) ev.longiaDecision = payload.longiaDecision;
    setPanels((prev) =>
      prev.map((p, i) => (i === 2 ? { ...p, events: [...p.events, ev].slice(-200) } : p)),
    );
    if (arenaHostAlertSoundRef.current && hostSfxCtxRef.current) {
      try {
        playLiriHostEventChime(hostSfxCtxRef.current, payload.urgent ? 'hand' : 'default');
      } catch {
        /* ignore */
      }
    }
    const digestHead =
      typeof payload.headline === 'string' && payload.headline.trim()
        ? payload.headline.trim().slice(0, 220)
        : typeof ev.msg === 'string'
          ? ev.msg.trim().slice(0, 220)
          : '';
    if (
      sessionId &&
      digestHead &&
      typeof ev?.type === 'string' &&
      ev.type.startsWith('longia_') &&
      longiaBusHostChRef.current
    ) {
      const digestKey = `${ev.type}\n${digestHead}\n${String(payload.detail || '').slice(0, 160)}`;
      const now = Date.now();
      const r = longiaSessionDigestBroadcastRef.current;
      const dup = digestKey === r.key && now - r.keyAt < 4000;
      const tooSoon = now - r.lastEmit < 400;
      if (!dup && !tooSoon) {
        r.key = digestKey;
        r.keyAt = now;
        r.lastEmit = now;
        void broadcastRealtime(
          longiaBusHostChRef.current,
          LONGIA_BUS_BROADCAST_EVENT,
          wrapLongiaBusPayload(BUS_EVENTS.LONGIA_SESSION_DIGEST, {
            headline: digestHead,
            detail: typeof payload.detail === 'string' ? payload.detail.slice(0, 500) : '',
            category: ev.longiaCategory ?? null,
            urgent: Boolean(ev.longiaUrgent),
            panelMsg: typeof ev.msg === 'string' ? ev.msg.slice(0, 400) : '',
            at: now,
          }),
        );
      }
    }
  }, [isGuestUi, phase, sessionId, setPanels, arenaHostAlertSoundRef, hostSfxCtxRef, longiaModesRef, longiaBusHostChRef, longiaSessionDigestBroadcastRef]);

  const applyLongiaEngineDecisions = useCallback(
    (decisions) => {
      if (!Array.isArray(decisions) || !decisions.length) return;
      for (const d of decisions) {
        if (d.target_channel === TARGET.SILENT_STORE) continue;
        if (d.target_channel === TARGET.RECAP_STORE) {
          if (sessionId) void persistLongiaRecapDecision(supabase, sessionId, d);
          continue;
        }
        if (d.target_channel === TARGET.TEACHER_NOTIFICATION && d.mode === MODE.SEND_NOW) {
          const urgent = d.priority === 'high' || d.priority === 'critical';
          const head =
            d.message.length > 80 ? `${d.message.slice(0, 77)}…` : d.message;
          pushLongiaHostNotif({
            category: LONGIA_NOTIF_CATEGORY.AUDIENCE,
            headline: `LONGIA · ${head}`,
            detail: d.message,
            urgent,
            longiaDecision: d,
          });
          continue;
        }
        if (
          d.target_channel === TARGET.SMARTBOARD_SUGGESTION &&
          (d.mode === MODE.REQUIRE_CONFIRMATION || d.mode === MODE.SEND_NOW)
        ) {
          pushLongiaHostNotif({
            category: LONGIA_NOTIF_CATEGORY.CONTENT,
            headline: 'LONGIA · SmartBoard',
            detail: d.message,
            urgent: d.priority === 'critical',
            longiaDecision: d,
          });
        }
      }
    },
    [pushLongiaHostNotif, sessionId],
  );

  useEffect(() => {
    applyLongiaEngineDecisionsRef.current = applyLongiaEngineDecisions;
  }, [applyLongiaEngineDecisionsRef, applyLongiaEngineDecisions]);

  useEffect(() => {
    flushBusStudentSignalsRef.current = applyLongiaEngineDecisions;
  }, [flushBusStudentSignalsRef, applyLongiaEngineDecisions]);

  const handleTranscriptFinalForDecisionEngine = useCallback(
    (text) => {
      const t = String(text || '').trim();
      if (t.length < 40) return;
      const now = Date.now();
      if (now - transcriptEngineCooldownRef.current < 90_000) return;
      const decisions = composeFromTranscriptFinalStub(t);
      if (!decisions.length) return;
      transcriptEngineCooldownRef.current = now;
      applyLongiaEngineDecisions(decisions);
    },
    [applyLongiaEngineDecisions, transcriptEngineCooldownRef],
  );

  useEffect(() => {
    if (isGuestUi || phase !== PHASE.LIVE || !sessionId) return;
    const onVis = () => {
      if (!document.hidden) return;
      const now = Date.now();
      if (now - visibilitySignalCooldownRef.current < 120_000) return;
      visibilitySignalCooldownRef.current = now;
      applyLongiaEngineDecisionsRef.current(
        composeFromSecureAppStatusBus({
          v: 1,
          event: BUS_EVENTS.SECURE_APP_STATUS,
          status: 'host_tab_hidden',
          surface: 'browser_tab',
        }),
      );
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [isGuestUi, phase, sessionId, visibilitySignalCooldownRef, applyLongiaEngineDecisionsRef]);

  /** LONGIA live-realtime : analyse différée du chat session → Edge `longia-live-realtime` → journal hôte. */
  useEffect(() => {
    if (isGuestUi || phase !== PHASE.LIVE || !sessionId) return;
    if (chatMessages.length <= longiaLastChatLenRef.current) return;

    if (longiaChatAnalyzeTimerRef.current) clearTimeout(longiaChatAnalyzeTimerRef.current);
    longiaChatAnalyzeTimerRef.current = setTimeout(async () => {
      longiaChatAnalyzeTimerRef.current = null;
      const len = chatMessages.length;
      if (len <= longiaLastChatLenRef.current) return;

      const recent = chatMessages.slice(-40);
      const chatEvents = recent.map((m) => ({
        message: m.text,
        authorId: m.userId,
        timestampMs: typeof m.time === 'string' ? (Date.parse(m.time) || Date.now()) : Date.now(),
      }));

      const result = await analyzeLiveContext({
        chatEvents,
        audienceMetrics: [],
        roomContext: { sessionId },
      });

      if (!result.ok) return;
      longiaLastChatLenRef.current = len;
      if (result.notifications?.length) {
        const payloads = mapLongiaRealtimeNotificationsToPanelPayloads(result.notifications);
        for (const p of payloads) {
          const id = p.longiaRealtimeId;
          if (id) {
            if (longiaSeenRealtimeIdsRef.current.has(id)) continue;
            longiaSeenRealtimeIdsRef.current.add(id);
          }
          pushLongiaHostNotif(p);
        }
      }

      const nowChat = Date.now();
      if (nowChat - chatHeuristicCooldownRef.current > 90_000) {
        const h = composeFromChatWindowHeuristic(recent);
        if (h.length) {
          chatHeuristicCooldownRef.current = nowChat;
          applyLongiaEngineDecisions(h);
        }
      }
    }, 8000);

    return () => {
      if (longiaChatAnalyzeTimerRef.current) clearTimeout(longiaChatAnalyzeTimerRef.current);
    };
  }, [chatMessages, isGuestUi, phase, sessionId, analyzeLiveContext, pushLongiaHostNotif, applyLongiaEngineDecisions, longiaLastChatLenRef, longiaChatAnalyzeTimerRef, longiaSeenRealtimeIdsRef, chatHeuristicCooldownRef]);

  const toggleLongiaGovernorMode = useCallback((mode) => {
    setLongiaGovernorModes((prev) => ({ ...prev, [mode]: !prev[mode] }));
  }, [setLongiaGovernorModes]);

  const handleLongiaDecisionAction = useCallback(
    (action, decision) => {
      if (isGuestUi) return;
      const a = String(action || '');
      const hintFromEv = () => {
        const s = String(decision?.message || '');
        const i = s.indexOf(' : ');
        return (i >= 0 ? s.slice(i + 3) : s).trim().slice(0, 280);
      };
      switch (a) {
        case 'start_qna':
        case 'launch_interactive_prompt':
          setNeuronQActive(true);
          toast({
            title: 'Interactif',
            description: 'NeuronQ activé — la file de questions est ouverte.',
          });
          return;
        case 'generate_live_example':
          setNeuronQActive(false);
          openLongiaHubSignauxHome();
          toast({
            title: 'LONGIA',
            description: 'Hub ouvert — journal et signaux de salle.',
          });
          return;
        case 'push_point_to_smartboard':
        case 'create_example_slide': {
          setNeuronQActive(false);
          const hint = hintFromEv() || 'Point clé';
          smartBoardStageRef.current?.appendRetenirHint?.(hint);
          queueMicrotask(() => sendSmartboardHostPayload());
          toast({
            title: 'SmartBoard',
            description: 'Point ajouté sur le tableau blanc et diffusé.',
          });
          return;
        }
        case 'answer_cluster_now':
          toast({
            title: 'Chat',
            description: 'Répondez dans le chat de session (cluster de questions).',
            duration: 9000,
          });
          return;
        case 'draft_answer_for_teacher':
          openLongiaHubSignauxHome();
          toast({
            title: 'LONGIA Hub',
            description: 'Hub ouvert — suivez le journal et les signaux.',
          });
          return;
        case 'suggest_smartboard_keypoint': {
          setNeuronQActive(false);
          const hint = hintFromEv() || String(decision?.message || '').slice(0, 280);
          const added = smartBoardStageRef.current?.appendRetenirHint?.(hint);
          queueMicrotask(() => sendSmartboardHostPayload());
          toast({
            title: 'SmartBoard',
            description: added !== false
              ? 'Bloc « à retenir » ajouté sur le tableau blanc (modifiable).'
              : (hint || 'Ouvrez le tableau blanc pour annoter.').slice(0, 220),
          });
          return;
        }
        case 'mark_for_closure':
        case 'recap_store':
          if (sessionId && decision) void persistLongiaRecapDecision(supabase, sessionId, decision);
          toast({
            title: 'Clôture',
            description: 'Point enregistré dans la file recap de session.',
          });
          return;
        case 'open_signals':
          openLongiaHubSignauxHome();
          toast({
            title: 'Hub LONGIA',
            description: 'Journal, mains levées, attente, Zone 3.',
          });
          return;
        case 'answer_now':
          toast({
            title: 'Répondre',
            description: "Répondez à l'oral ou dans le chat de session.",
          });
          return;
        case 'draft_rephrase':
        case 'summarize_chat':
          openLongiaHubSignauxHome();
          toast({
            title: 'LONGIA Hub',
            description: 'Hub ouvert — signaux et journal de salle.',
          });
          return;
        case 'check_share':
          toast({
            title: 'Partage',
            description: 'Vérifiez la fenêtre partagée et la vue côté élèves.',
          });
          return;
        case 'secure_pause_if_configured':
          toast({
            title: 'Pause sécurisée',
            description: "Pas d'arrêt auto configuré — utilisez Stop live si besoin.",
            variant: 'destructive',
          });
          return;
        default:
          toast({
            title: 'LONGIA',
            description: a ? `Action « ${a} »` : 'Action enregistrée.',
          });
      }
    },
    [isGuestUi, sessionId, toast, sendSmartboardHostPayload, openLongiaHubSignauxHome, setNeuronQActive, smartBoardStageRef],
  );

  const mergeLongiaHostSignalActions = useCallback((ev) => {
    const out = [];
    const seen = new Set();
    const push = (label, act) => {
      const action = String(act || '');
      if (!action || seen.has(action)) return;
      seen.add(action);
      out.push({ label: label || action, action });
    };
    if (Array.isArray(ev?.longiaDecision?.actions)) {
      for (const ac of ev.longiaDecision.actions) push(ac.label, ac.action);
    }
    if (Array.isArray(ev?.longiaRealtimeActions)) {
      for (const ac of ev.longiaRealtimeActions) {
        if (ac && typeof ac === 'object') push(ac.label, ac.action);
      }
    }
    return out;
  }, []);

  const pushCoachRendersToSmartboard = useCallback(
    (card) => {
      if (isGuestUi) return;
      const parts = [];
      if (card?.summary) parts.push(`À retenir — ${String(card.summary).trim()}`);
      if (card?.explanation) parts.push(`Reformulation — ${String(card.explanation).trim()}`);
      if (card?.example) parts.push(`Exemple — ${String(card.example).trim()}`);
      let hint = parts.filter(Boolean).join('\n\n');
      if (!hint && card?.message) hint = String(card.message).trim();
      if (!hint) {
        toast({
          title: 'Architecte',
          description: "Pas de rendu coach à afficher — échangez d'abord avec le coach (IA).",
          variant: 'destructive',
        });
        return;
      }
      smartBoardStageRef.current?.appendRetenirHint?.(hint.slice(0, 4000));
      queueMicrotask(() => sendSmartboardHostPayload());
      toast({
        title: 'Architecte',
        description: 'Rendu coach envoyé sur le tableau (bloc à retenir).',
      });
    },
    [isGuestUi, toast, sendSmartboardHostPayload, smartBoardStageRef],
  );

  return {
    pushLongiaHostNotif,
    handleTranscriptFinalForDecisionEngine,
    toggleLongiaGovernorMode,
    handleLongiaDecisionAction,
    mergeLongiaHostSignalActions,
    pushCoachRendersToSmartboard,
  };
}
