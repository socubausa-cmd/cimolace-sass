import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import LiveHostPage from '@/pages/liri/LiveHostPage';
import { LiriLivePermissionsProvider } from '@/components/liri/liri-live/LiriLivePermissionsContext';
import { useGuestCapabilities } from '@/hooks/useGuestCapabilities';
import { useGuestPermissionGrantsFromSignals } from '@/hooks/useGuestPermissionGrantsFromSignals';
import { useGuestJoyKitGrantFromSignals } from '@/hooks/useGuestJoyKitGrantFromSignals';
import { useLiveSessionGuestCommConfig } from '@/hooks/useLiveSessionGuestCommConfig';
import { mapGuestCapsToPermissionOverride } from '@/lib/liriLive/mapGuestCapsToPermissionOverride';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { insertGuestPermissionRequest } from '@/lib/liriLive/permissionRequestSignals';
import { insertGuestJoyKitRequest } from '@/lib/liriLive/joykitRequestSignals';
import { parseLiveSessionIdFromRouteParam } from '@/lib/liveSessionRouteId';

/**
 * Invité — même moteur que l'hôte (`LiveHostPage`), enveloppé du provider permissions (phase 2).
 * Routes : `/live/:sessionId`, `/live/invit/:sessionId`.
 */
export default function LiveGuestPage() {
  const { sessionId: sessionIdParam } = useParams();
  const sessionId = useMemo(
    () => parseLiveSessionIdFromRouteParam(sessionIdParam),
    [sessionIdParam],
  );
  const { user } = useAuth();
  const { caps } = useGuestCapabilities(sessionId, { enabled: Boolean(sessionId) });
  const comm = useLiveSessionGuestCommConfig(sessionId);
  const signalGrants = useGuestPermissionGrantsFromSignals(sessionId, user?.id, {
    enabled: Boolean(sessionId && user?.id),
  });
  const joyKitGrant = useGuestJoyKitGrantFromSignals(sessionId, user?.id, {
    enabled: Boolean(sessionId && user?.id),
  });

  const sessionOverrides = useMemo(() => {
    const fromCaps = mapGuestCapsToPermissionOverride(caps);
    return {
      permissionsOverride: {
        ...fromCaps,
        canUseMic: comm.student_audio_enabled,
        canUseCamera: comm.student_video_enabled,
        canUseSignals: Boolean(fromCaps.canUseSignals && comm.hand_raise_enabled),
        canUseNeuronQ: Boolean(fromCaps.canUseNeuronQ && comm.neuronq_enabled),
        /** JoyKit : accord explicite via `joykit_request` / `joykit_granted` ou grant générique. */
        canUseJoyKit: false,
      },
      sessionGrants: signalGrants.sessionGrants,
      temporaryGrants: signalGrants.temporaryGrants,
      joyKitGrant,
    };
  }, [caps, comm, signalGrants, joyKitGrant]);

  const requestLogRef = useRef([]);
  const onRequestPermission = useCallback(async (action) => {
    requestLogRef.current.push({ action, at: Date.now() });
    if (!sessionId || !user?.id) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[LiriLive permission_request] ignoré — pas de session ou utilisateur', { sessionId, userId: user?.id, action });
      }
      return;
    }
    if (action === 'canUseJoyKit') {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.info('[LiriLive joykit_request] invité → INSERT', { sessionId, userId: user.id });
      }
      await insertGuestJoyKitRequest(supabase, {
        liveSessionId: sessionId,
        userId: user.id,
        level: 'control',
      });
      return;
    }
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info('[LiriLive permission_request] invité envoi demande → live_session_signals', { sessionId, userId: user.id, action });
    }
    await insertGuestPermissionRequest(supabase, {
      liveSessionId: sessionId,
      userId: user.id,
      action,
    });
  }, [sessionId, user?.id]);

  // Gate d'accès : un invité REJETÉ par l'hôte ne doit pas voir l'arène (UX). La vraie
  // barrière reste le serveur (token LiveKit refusé). Statut initial + rejet en direct.
  const [guestRejected, setGuestRejected] = useState(false);
  useEffect(() => {
    if (!sessionId || !user?.id) return undefined;
    let alive = true;
    supabase
      .from('live_waiting_room_entries')
      .select('status')
      .eq('live_session_id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => { if (alive && data?.status === 'rejected') setGuestRejected(true); })
      .catch(() => {});
    const ch = supabase
      .channel(`guest-gate:${sessionId}:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_waiting_room_entries', filter: `live_session_id=eq.${sessionId}` },
        (payload) => { if (payload?.new?.user_id === user.id && payload?.new?.status === 'rejected') setGuestRejected(true); },
      )
      .subscribe();
    return () => { alive = false; try { supabase.removeChannel(ch); } catch { /* noop */ } };
  }, [sessionId, user?.id]);

  if (guestRejected) {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    return <Navigate to={`/live/waiting/${sessionIdParam || sessionId}${search}`} replace />;
  }

  return (
    <LiriLivePermissionsProvider
      role="guest"
      sessionOverrides={sessionOverrides}
      onRequestPermission={onRequestPermission}
    >
      <LiveHostPage forceGuestRoute joyKitSignalGrant={joyKitGrant} />
    </LiriLivePermissionsProvider>
  );
}
