import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import {
  composeFromAudienceMetricBus,
  composeFromSecureAppStatusBus,
  createStudentActionDecisionBuffer,
} from '@/lib/longiaDecisionEngine';
import {
  BUS_EVENTS,
  LONGIA_BUS_BROADCAST_EVENT,
  longiaBusChannelName,
  shouldAggregateStudentActionForProf,
  unwrapLongiaBusPayload,
} from '@/lib/longiaRealtimeBus';
import {
  enqueueMultilangBrowserTts,
  stopMultilangBrowserTts,
} from '@/lib/liriMultilangAudioGuest';
import { enqueueMultilangEdgeTts, stopMultilangEdgeTts } from '@/lib/liriMultilangTtsEdge';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Bus `longia-bus-${sessionId}` côté hôte : buffer actions élèves → `flushBusStudentSignalsRef`,
 * métriques audience / secure app → moteur LONGIA.
 */
export function useLiveHostLongiaBusHostRealtime({
  isGuestUi,
  sessionId,
  phase,
  longiaBusHostChRef,
  flushBusStudentSignalsRef,
  applyLongiaEngineDecisionsRef,
}) {
  const studentAggRef = useRef(null);
  useEffect(() => {
    if (isGuestUi || !sessionId || phase !== PHASE.LIVE) {
      studentAggRef.current?.dispose();
      studentAggRef.current = null;
      longiaBusHostChRef.current = null;
      return;
    }
    const name = longiaBusChannelName(sessionId);
    if (!name) return;
    studentAggRef.current?.dispose();
    studentAggRef.current = createStudentActionDecisionBuffer(
      (decisions) => flushBusStudentSignalsRef.current(decisions),
      {
        flushMs: 14_000,
        thresholds: {
          confusedMinForTeacher: 3,
          confusedTopicHigh: 3,
          confusedMassTotal: 6,
          burstImmediateTotal: 6,
        },
      },
    );
    const ch = supabase.channel(name, { config: { broadcast: { self: true } } });
    longiaBusHostChRef.current = ch;
    ch.on('broadcast', { event: LONGIA_BUS_BROADCAST_EVENT }, ({ payload }) => {
      const msg = unwrapLongiaBusPayload(payload);
      if (!msg) return;
      if (shouldAggregateStudentActionForProf(msg)) {
        studentAggRef.current?.ingestBusStudentAction(msg);
        return;
      }
      if (msg.event === BUS_EVENTS.AUDIENCE_METRIC) {
        applyLongiaEngineDecisionsRef.current(composeFromAudienceMetricBus(msg));
        return;
      }
      if (msg.event === BUS_EVENTS.SECURE_APP_STATUS) {
        applyLongiaEngineDecisionsRef.current(composeFromSecureAppStatusBus(msg));
      }
    });
    ch.subscribe();
    return () => {
      studentAggRef.current?.dispose();
      studentAggRef.current = null;
      supabase.removeChannel(ch);
      longiaBusHostChRef.current = null;
    };
  }, [isGuestUi, sessionId, phase]);
}

/**
 * Bus `longia-bus-${sessionId}` côté invité : transcript formateur, multilingue, digests LONGIA,
 * événement legacy `teacher_transcript`.
 */
export function useLiveHostLongiaBusGuestRealtime({
  isGuestUi,
  sessionId,
  phase,
  toast,
  guestLongiaBusChRef,
  guestMultilangAudioPrefsRef,
  setGuestTeacherTranscript,
  setGuestTeacherTranscriptPartial,
  setGuestLongiaSessionDigests,
  setGuestMultilangRolling,
  setGuestMultilangViewLang,
}) {
  useEffect(() => {
    if (!isGuestUi || !sessionId || phase !== PHASE.LIVE) {
      guestLongiaBusChRef.current = null;
      return;
    }
    setGuestTeacherTranscript('');
    setGuestTeacherTranscriptPartial('');
    setGuestLongiaSessionDigests([]);
    setGuestMultilangRolling({});
    setGuestMultilangViewLang('source');
    const name = longiaBusChannelName(sessionId);
    if (!name) return;
    const ch = supabase.channel(name, { config: { broadcast: { self: true } } });
    guestLongiaBusChRef.current = ch;
    const applyLegacyTranscript = (payload) => {
      if (!payload || typeof payload.text !== 'string') return;
      const t = payload.text.trim();
      if (!t) return;
      const isFinal = payload.isFinal === true;
      if (isFinal) {
        setGuestTeacherTranscript((prev) => ((prev ? `${prev} ${t}` : t).trim()));
        setGuestTeacherTranscriptPartial('');
      } else {
        setGuestTeacherTranscriptPartial(t);
      }
    };
    ch.on('broadcast', { event: LONGIA_BUS_BROADCAST_EVENT }, ({ payload }) => {
      const msg = unwrapLongiaBusPayload(payload);
      if (!msg) return;
      if (msg.event === BUS_EVENTS.TRANSCRIPT_FINAL && typeof msg.text === 'string') {
        const t = msg.text.trim();
        if (!t) return;
        setGuestTeacherTranscript((prev) => ((prev ? `${prev} ${t}` : t).trim()));
        setGuestTeacherTranscriptPartial('');
        return;
      }
      if (msg.event === BUS_EVENTS.TRANSCRIPT_PARTIAL && typeof msg.text === 'string') {
        const t = msg.text.trim();
        if (t) setGuestTeacherTranscriptPartial(t);
        return;
      }
      if (msg.event === BUS_EVENTS.MULTILANG_CAPTION) {
        const lang = String(msg.targetLang || '').toLowerCase().slice(0, 12);
        const text = typeof msg.text === 'string' ? msg.text.trim() : '';
        if (!lang || !text) return;
        const isFinal = msg.isFinal === true;
        setGuestMultilangRolling((prev) => {
          const cur = prev[lang] || { final: '', partial: '' };
          if (isFinal) {
            const merged = (cur.final ? `${cur.final} ${text}` : text).trim().slice(0, 12000);
            return { ...prev, [lang]: { final: merged, partial: '' } };
          }
          return { ...prev, [lang]: { ...cur, partial: text.slice(0, 2000) } };
        });
        if (isFinal) {
          const prefs = guestMultilangAudioPrefsRef.current;
          if (prefs.viewLang !== lang || text.length < 2) {
            /* skip audio */
          } else if (prefs.edgeTtsOffered && prefs.edgeTtsOn) {
            enqueueMultilangEdgeTts(supabase, {
              text,
              languageCode: lang,
              tier: 'live',
              onError: (e) => {
                toast?.({
                  title: 'TTS (ElevenLabs / Google)',
                  description: e?.message || String(e),
                  variant: 'destructive',
                });
              },
            });
          } else if (prefs.browserTtsOffered && prefs.browserTtsOn) {
            enqueueMultilangBrowserTts(text, lang);
          }
        }
        return;
      }
      if (msg.event === BUS_EVENTS.LONGIA_SESSION_DIGEST) {
        const headline =
          typeof msg.headline === 'string' && msg.headline.trim()
            ? msg.headline.trim()
            : typeof msg.panelMsg === 'string'
              ? msg.panelMsg.trim().slice(0, 220)
              : '';
        if (!headline) return;
        const detail = typeof msg.detail === 'string' ? msg.detail.trim().slice(0, 500) : '';
        const at = typeof msg.at === 'number' ? msg.at : Date.now();
        const id = `${at}-${headline.slice(0, 40)}-${detail.slice(0, 24)}`;
        setGuestLongiaSessionDigests((prev) => {
          const p = Array.isArray(prev) ? prev : [];
          if (p.some((x) => x.id === id)) return p;
          const next = [
            ...p,
            {
              id,
              headline,
              detail,
              urgent: msg.urgent === true,
              panelMsg: typeof msg.panelMsg === 'string' ? msg.panelMsg : '',
              at,
            },
          ];
          return next.slice(-40);
        });
      }
    });
    ch.on('broadcast', { event: 'teacher_transcript' }, ({ payload }) => {
      applyLegacyTranscript(payload);
    });
    ch.subscribe();
    return () => {
      stopMultilangBrowserTts();
      stopMultilangEdgeTts();
      guestLongiaBusChRef.current = null;
      supabase.removeChannel(ch);
    };
  }, [isGuestUi, sessionId, phase, toast]);
}
