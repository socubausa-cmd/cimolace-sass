import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { PHASE } from '@/features/live/host/liveHostConstants';
import { devLogLiveHostEnded } from '@/features/live/host/liveHostUtils';
import { mergeSmartboardSceneFlags } from '@/lib/smartboardNavigatorScenes';
import {
  serializeGuestPermissions,
  GUEST_CAPABILITIES_DEFAULTS,
} from '@/hooks/useGuestCapabilities';
import { parseLangList } from '@/lib/liriMultilangApi';

/**
 * Invité : `live_sessions` en temps réel (config + fin de session).
 * Attend `teacherId` pour éviter un faux « invité » avant chargement session.
 */
export function useLiveHostGuestSessionConfigRealtime({
  sessionId,
  isGuestUi,
  teacherId,
  toast,
  phaseRef,
  roomRef,
  setAmbientTracks,
  setPhase,
  setSessionQuickIaFlags,
  setSessionCommFlags,
  setSessionGuestPermissions,
  setSmartboardSceneFlags,
  setGuestMultilangConfig,
  setGuestMultilangRolling,
  setGuestMultilangViewLang,
}) {
  const liveSessionEndedHandledRef = useRef(false);

  useEffect(() => {
    liveSessionEndedHandledRef.current = false;
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !isGuestUi || teacherId == null) return;
    const ch = supabase
      .channel(`live-session-config-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          const st = payload.new?.status;
          if ((st === 'ended' || st === 'cancelled') && phaseRef.current !== PHASE.ENDED) {
            if (liveSessionEndedHandledRef.current) return;
            liveSessionEndedHandledRef.current = true;
            setAmbientTracks([]);
            try {
              if (roomRef.current) {
                void roomRef.current.disconnect();
                roomRef.current = null;
              }
            } catch {
              /* ignore */
            }
            devLogLiveHostEnded('realtime_guest_session_ended', { status: st }, sessionId);
            setPhase(PHASE.ENDED);
            toast({
              title: 'Live terminé',
              description: 'Le formateur a mis fin à la session.',
            });
            return;
          }
          let cfg = payload.new?.config;
          if (cfg == null) return;
          if (typeof cfg === 'string') {
            try {
              cfg = JSON.parse(cfg);
            } catch {
              return;
            }
          }
          if (typeof cfg !== 'object' || cfg === null) return;
          setSessionQuickIaFlags({
            quiz_enabled: cfg.quiz_enabled === true,
            polls_enabled: cfg.polls_enabled === true,
            ai_summary_enabled: cfg.ai_summary_enabled === true,
            ai_mindmap_enabled: cfg.ai_mindmap_enabled === true,
            neuronq_enabled: cfg.neuronq_enabled !== false,
            neuro_recall_enabled: cfg.neuro_recall_enabled === true,
          });
          setSessionCommFlags({
            chat_enabled: cfg.chat_enabled !== false,
            hand_raise_enabled: cfg.hand_raise_enabled !== false,
            screen_share_enabled: cfg.screen_share_enabled !== false,
            student_audio_enabled: cfg.student_audio_enabled !== false,
            student_video_enabled: cfg.student_video_enabled !== false,
            guest_member_inspect_enabled: cfg.guest_member_inspect_enabled === true,
            proctoring_camera_consent_required: cfg.proctoring_camera_consent_required === true,
            host_remote_camera_enabled: cfg.host_remote_camera_enabled === true,
          });
          if (cfg.guest_permissions && typeof cfg.guest_permissions === 'object') {
            setSessionGuestPermissions({
              ...serializeGuestPermissions(GUEST_CAPABILITIES_DEFAULTS),
              ...cfg.guest_permissions,
            });
          }
          if (cfg.smartboard_scenes) {
            setSmartboardSceneFlags(mergeSmartboardSceneFlags(cfg.smartboard_scenes));
          }
          const gml = cfg.liri_multilang;
          if (gml && typeof gml === 'object') {
            const gEnabled = gml.enabled === true;
            const gSource = String(gml.source_lang || 'fr').slice(0, 12).toLowerCase();
            const gTargets = Array.isArray(gml.target_langs)
              ? gml.target_langs.map((x) => String(x).toLowerCase().slice(0, 12)).filter(Boolean).slice(0, 12)
              : parseLangList(String(gml.target_langs || ''));
            const gLangs = gTargets.length ? gTargets : ['en'];
            setGuestMultilangConfig({
              enabled: gEnabled,
              sourceLang: gSource,
              targetLangs: gLangs,
              guest_browser_tts_offered: gml.guest_browser_tts_offered !== false,
              guest_edge_tts_offered: gml.guest_edge_tts_offered === true,
              livekit_interpreter_enabled: gml.livekit_interpreter_enabled === true,
            });
            if (!gEnabled) {
              setGuestMultilangRolling({});
              setGuestMultilangViewLang('source');
            }
          } else {
            setGuestMultilangConfig({
              enabled: false,
              sourceLang: 'fr',
              targetLangs: [],
              guest_browser_tts_offered: true,
              guest_edge_tts_offered: false,
              livekit_interpreter_enabled: false,
            });
            setGuestMultilangRolling({});
            setGuestMultilangViewLang('source');
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setters + refs stables ; aligné historique LiveHostPage
  }, [sessionId, isGuestUi, teacherId, toast]);
}
