import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { PHASE } from '@/features/live/host/liveHostConstants';
import { isLiveProfileUuid, randomCorrelationUuid } from '@/features/live/host/liveHostUtils';
import { broadcastRealtime } from '@/lib/realtimeBroadcast';

/**
 * Surveillance caméra (proctor) : historique des commandes hôte, journal invité,
 * canaux Realtime de mise à jour, et diffusion des commandes caméra distantes.
 */
export function useLiveHostProctor({
  sessionId,
  userId,
  isGuestUi,
  phase,
  teacherId,
  sessionCommFlags,
  showSettings,
  guestProctorOwnRefreshRef,
  toast,
}) {
  const [proctorCamHistoryRows, setProctorCamHistoryRows] = useState([]);
  const [proctorCamHistoryLoading, setProctorCamHistoryLoading] = useState(false);
  const [guestProctorOwnRows, setGuestProctorOwnRows] = useState([]);
  const [guestProctorOwnLoading, setGuestProctorOwnLoading] = useState(false);

  const fetchProctorCamHistory = useCallback(async () => {
    if (!sessionId || isGuestUi) return;
    setProctorCamHistoryLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from('live_session_proctor_camera_events')
        .select(
          'id, target_user_id, camera_enabled, created_at, correlation_id, guest_ack_success, guest_ack_at, guest_ack_error',
        )
        .eq('live_session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(80);
      if (error) throw error;
      const list = rows || [];
      const uids = [
        ...new Set(
          list
            .map((r) => String(r.target_user_id || ''))
            .filter((id) => isLiveProfileUuid(id)),
        ),
      ];
      let nameById = {};
      if (uids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, name').in('id', uids);
        nameById = Object.fromEntries((profs || []).map((p) => [p.id, p.name]));
      }
      setProctorCamHistoryRows(
        list.map((r) => ({
          ...r,
          targetName: nameById[r.target_user_id] || null,
        })),
      );
    } catch (e) {
      console.warn('[LiveHost] proctor history', e?.message);
      setProctorCamHistoryRows([]);
    } finally {
      setProctorCamHistoryLoading(false);
    }
  }, [sessionId, isGuestUi]);

  useEffect(() => {
    if (!showSettings || isGuestUi || !sessionId || phase !== PHASE.LIVE) return;
    void fetchProctorCamHistory();
  }, [showSettings, isGuestUi, sessionId, phase, fetchProctorCamHistory]);

  const fetchGuestProctorOwnHistory = useCallback(async () => {
    if (!sessionId || !isGuestUi || !userId) return;
    if (sessionCommFlags.proctoring_camera_consent_required !== true) return;
    setGuestProctorOwnLoading(true);
    try {
      const { data, error } = await supabase
        .from('live_session_proctor_camera_events')
        .select(
          'id, camera_enabled, created_at, guest_ack_success, guest_ack_at, guest_ack_error, correlation_id',
        )
        .eq('live_session_id', sessionId)
        .eq('target_user_id', String(userId))
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      setGuestProctorOwnRows(data || []);
    } catch (e) {
      console.warn('[LiveHost] guest proctor history', e?.message);
      setGuestProctorOwnRows([]);
    } finally {
      setGuestProctorOwnLoading(false);
    }
  }, [sessionId, isGuestUi, userId, sessionCommFlags.proctoring_camera_consent_required]);

  useEffect(() => {
    guestProctorOwnRefreshRef.current = () => { void fetchGuestProctorOwnHistory(); };
  }, [guestProctorOwnRefreshRef, fetchGuestProctorOwnHistory]);

  useEffect(() => {
    if (!isGuestUi || phase !== PHASE.LIVE || !userId) return;
    if (sessionCommFlags.proctoring_camera_consent_required !== true) return;
    void fetchGuestProctorOwnHistory();
  }, [
    isGuestUi,
    phase,
    userId,
    sessionId,
    sessionCommFlags.proctoring_camera_consent_required,
    fetchGuestProctorOwnHistory,
  ]);

  useEffect(() => {
    if (isGuestUi || !sessionId || phase !== PHASE.LIVE) return;
    const ch = supabase
      .channel(`proctor-camera-events-host-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_session_proctor_camera_events', filter: `live_session_id=eq.${sessionId}` },
        () => { void fetchProctorCamHistory(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isGuestUi, sessionId, phase, fetchProctorCamHistory]);

  useEffect(() => {
    if (!isGuestUi || !sessionId || phase !== PHASE.LIVE || !userId) return;
    if (sessionCommFlags.proctoring_camera_consent_required !== true) return;
    const ch = supabase
      .channel(`proctor-camera-events-guest-${sessionId}-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_session_proctor_camera_events', filter: `live_session_id=eq.${sessionId}` },
        () => { void fetchGuestProctorOwnHistory(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [
    isGuestUi,
    sessionId,
    phase,
    userId,
    sessionCommFlags.proctoring_camera_consent_required,
    fetchGuestProctorOwnHistory,
  ]);

  const broadcastHostCameraCommand = useCallback(
    (targetUserId, enabled) => {
      if (!sessionId || !teacherId || isGuestUi) return;
      if (!sessionCommFlags.host_remote_camera_enabled || !sessionCommFlags.proctoring_camera_consent_required) {
        toast({
          title: 'Contrôle caméra indisponible',
          description: 'Activez le consentement « type examen surveillé » et le contrôle distant dans les réglages salle (Studio → Salle & IA).',
          variant: 'destructive',
        });
        return;
      }
      const tid = String(targetUserId);
      const correlationId = randomCorrelationUuid();
      void (async () => {
        const { error } = await supabase.from('live_session_proctor_camera_events').insert({
          live_session_id: sessionId,
          teacher_id: userId ?? teacherId,
          target_user_id: tid,
          camera_enabled: Boolean(enabled),
          correlation_id: correlationId,
        });
        if (error) {
          console.warn('[LiveHost] proctor audit:', error.message);
          toast({
            title: 'Commande bloquée',
            description: "L'audit serveur doit réussir avant l'envoi à l'élève. Vérifiez la migration Supabase et vos droits.",
            variant: 'destructive',
          });
          return;
        }
        await fetchProctorCamHistory();
        const ch = supabase.channel(`live-smartboard-${sessionId}`);
        ch.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            void broadcastRealtime(ch, 'host_camera_command', {
              targetUserId: tid,
              enabled: Boolean(enabled),
              teacherId: String(teacherId),
              correlationId,
              at: Date.now(),
            });
            supabase.removeChannel(ch);
          }
        });
      })();
    },
    [
      sessionId,
      teacherId,
      userId,
      isGuestUi,
      sessionCommFlags.host_remote_camera_enabled,
      sessionCommFlags.proctoring_camera_consent_required,
      toast,
      fetchProctorCamHistory,
    ],
  );

  return {
    proctorCamHistoryRows,
    proctorCamHistoryLoading,
    guestProctorOwnRows,
    guestProctorOwnLoading,
    fetchProctorCamHistory,
    fetchGuestProctorOwnHistory,
    broadcastHostCameraCommand,
  };
}
