import { useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import {
  applyHostPermissionDecision,
} from '@/lib/liriLive/permissionRequestSignals';
import {
  resolveHostJoyKitRequest,
  normalizeJoyKitLevel,
} from '@/lib/liriLive/joykitRequestSignals';
import { assertGuestLiveAction } from '@/lib/liriLive/assertGuestPermissionServer';

/**
 * Résolution des signaux hôte : permission_request (accès caméra/micro/…) et
 * joykit_request ; assertion des actions invité LONGIA.
 */
export function useLiveHostSignalResolution({
  sessionId,
  isGuestUi,
  userId,
  permCtxOptional,
  toast,
  setHostPermissionRequests,
  setHostJoyKitRequests,
}) {
  const resolveHostPermissionSignal = useCallback(async (row, decision) => {
    if (!row?.id || !row?.action) return;
    const d = decision === 'reject' ? 'reject' : decision === 'approve_5min' ? 'approve_5min' : 'approve_session';
    const { error } = await applyHostPermissionDecision(supabase, {
      signalId: row.id,
      action: row.action,
      decision: d,
    });
    if (error) {
      toast({
        title: "Demande d'accès",
        description: error.message || 'Mise à jour impossible',
        variant: 'destructive',
      });
      return;
    }
    setHostPermissionRequests((prev) => prev.filter((p) => p.id !== row.id));
  }, [toast, setHostPermissionRequests]);

  const resolveHostJoyKitSignal = useCallback(async (row, decision, grantLevel) => {
    if (!sessionId || !row?.id || !row?.userId) return;
    const level = normalizeJoyKitLevel(grantLevel || row.requestedLevel || 'control');
    const d = decision === 'reject' ? 'reject' : decision === 'approve_5min' ? 'approve_5min' : 'approve_session';
    const { error } = await resolveHostJoyKitRequest(supabase, {
      liveSessionId: sessionId,
      guestUserId: row.userId,
      requestSignalId: row.id,
      level,
      decision: d,
    });
    if (error) {
      toast({
        title: 'JoyKit',
        description: error.message || 'Mise à jour impossible',
        variant: 'destructive',
      });
      return;
    }
    setHostJoyKitRequests((prev) => prev.filter((p) => p.id !== row.id));
  }, [sessionId, toast, setHostJoyKitRequests]);

  const assertGuestLongiaSignal = useCallback(
    async (action) => {
      if (!isGuestUi || !sessionId || !userId || !permCtxOptional) return true;
      return assertGuestLiveAction(supabase, permCtxOptional, {
        liveSessionId: sessionId,
        userId,
        action,
      });
    },
    [isGuestUi, sessionId, userId, permCtxOptional],
  );

  return { resolveHostPermissionSignal, resolveHostJoyKitSignal, assertGuestLongiaSignal };
}
