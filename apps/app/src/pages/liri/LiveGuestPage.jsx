import React, { useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
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
