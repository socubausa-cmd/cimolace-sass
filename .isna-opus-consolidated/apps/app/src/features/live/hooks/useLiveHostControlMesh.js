import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { PHASE } from '@/features/live/host/liveHostConstants';
import { nt } from '@/features/live/host/liveHostUtils';
import { broadcastRealtime } from '@/lib/realtimeBroadcast';
import { getProfile } from '@/lib/liriControlMesh/profiles';
import { buildGrantFromRequest, DEFAULT_MESH_GRANT_MS, MESH_GRANT_DURATION_PRESETS } from '@/lib/liriControlMesh/meshTransfer';
import { assertGuestLiveAction } from '@/lib/liriLive/assertGuestPermissionServer';

/**
 * Control Mesh host : gestion des demandes JoyKit, accords/révocations,
 * profils de permission, et état de la session mesh côté invité.
 */
export function useLiveHostControlMesh({
  user,
  isGuestUi,
  sessionId,
  phase,
  permCtxOptional,
  activeMembers,
  setPanels,
  setMeshRequests,
  setMeshGrantsByUserId,
  setMeshGrantClock,
  setGuestMeshGrant,
  guestMeshGrant,
  meshGrantClock,
  persistControlMeshToConfig,
  scheduleMeshHostExpiry,
  guestSmartboardBroadcastRef,
  smartboardChRef,
  meshHostExpiryTimersRef,
}) {
  const meshParticipantsList = useMemo(() => {
    const rows = [];
    if (user?.id) rows.push({ id: `host-${user.id}`, name: user?.full_name || 'Hôte' });
    for (const m of activeMembers) rows.push({ id: m.id, name: m.name });
    return rows;
  }, [user, activeMembers]);

  const addMeshRequest = useCallback(async (kind) => {
    if (!user?.id) return;
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mesh-${Date.now()}`;
    const name = user?.full_name || 'Participant';
    const at = Date.now();
    if (isGuestUi) {
      if (sessionId && permCtxOptional) {
        const ok = await assertGuestLiveAction(supabase, permCtxOptional, {
          liveSessionId: sessionId,
          userId: user.id,
          action: 'canUseJoyKit',
        });
        if (!ok) {
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.warn('[LiriLive Phase6] mesh_request refusé (RPC / permissions)', { sessionId, kind });
          }
          return;
        }
      }
      const ch = guestSmartboardBroadcastRef.current;
      if (ch) void broadcastRealtime(ch, 'mesh_request', { id, name, kind, userId: user.id, at });
      return;
    }
    setMeshRequests((prev) => [...prev, { id, name, kind, at }]);
  }, [user, isGuestUi, sessionId, permCtxOptional, guestSmartboardBroadcastRef, setMeshRequests]);

  const acceptMeshRequest = useCallback((r, durationMs = DEFAULT_MESH_GRANT_MS) => {
    const grantMs = Number(durationMs) > 0 ? Number(durationMs) : DEFAULT_MESH_GRANT_MS;
    const uid = r.userId != null ? String(r.userId) : null;
    setMeshRequests((prev) => prev.filter((x) => x.id !== r.id));
    if (!uid) {
      setPanels((prev) =>
        prev.map((p, i) =>
          i === 2
            ? {
                ...p,
                events: [
                  ...p.events,
                  {
                    avatar: 'Mesh',
                    msg: "Control Mesh : demande sans userId — impossible d'accorder JoyKit.",
                    type: 'message',
                    time: nt(),
                  },
                ],
              }
            : p,
        ),
      );
      return;
    }
    const { profileId, permissions } = buildGrantFromRequest(r.kind || 'control');
    const expiresAt = Date.now() + grantMs;
    const durLabel = MESH_GRANT_DURATION_PRESETS.find((o) => o.ms === grantMs)?.labelFr || `${Math.round(grantMs / 60000)} min`;
    setMeshGrantsByUserId((prev) => {
      const next = { ...prev, [uid]: { profileId, name: r.name, expiresAt } };
      queueMicrotask(() => persistControlMeshToConfig(next));
      return next;
    });
    scheduleMeshHostExpiry(uid, expiresAt);
    const ch = smartboardChRef.current;
    if (ch) {
      void broadcastRealtime(ch, 'mesh_grant', {
        userId: uid,
        profileId,
        permissions,
        requestId: r.id,
        at: Date.now(),
        expiresAt,
        durationMs: grantMs,
      });
    }
    setPanels((prev) =>
      prev.map((p, i) =>
        i === 2
          ? {
              ...p,
              events: [
                ...p.events,
                {
                  avatar: 'Mesh',
                  msg: `Control Mesh : ${r.name} — JoyKit (${getProfile(profileId)?.labelFr || profileId}) accordé pour ${durLabel}.`,
                  type: 'message',
                  time: nt(),
                },
              ],
            }
          : p,
      ),
    );
  }, [setMeshRequests, setPanels, setMeshGrantsByUserId, persistControlMeshToConfig, scheduleMeshHostExpiry, smartboardChRef]);

  const revokeMeshParticipant = useCallback((p) => {
    const s = String(p.id);
    const uid = s.startsWith('host-') ? s.slice(5) : s;
    const existing = meshHostExpiryTimersRef.current.get(uid);
    if (existing) {
      clearTimeout(existing);
      meshHostExpiryTimersRef.current.delete(uid);
    }
    setMeshGrantsByUserId((prev) => {
      const next = { ...prev };
      delete next[uid];
      queueMicrotask(() => persistControlMeshToConfig(next));
      return next;
    });
    const ch = smartboardChRef.current;
    if (ch) void broadcastRealtime(ch, 'mesh_revoke', { userId: uid, at: Date.now() });
  }, [meshHostExpiryTimersRef, setMeshGrantsByUserId, persistControlMeshToConfig, smartboardChRef]);

  const rejectMeshRequest = useCallback((r) => {
    setMeshRequests((prev) => prev.filter((x) => x.id !== r.id));
  }, [setMeshRequests]);

  const applyMeshProfile = useCallback((profileId) => {
    const p = getProfile(profileId);
    const label = p?.labelFr || profileId;
    setPanels((prev) =>
      prev.map((panel, i) =>
        i === 2
          ? {
              ...panel,
              events: [
                ...panel.events,
                {
                  avatar: 'Profil',
                  msg: `Control Mesh : profil « ${label} » sélectionné (Permission Engine).`,
                  type: 'message',
                  time: nt(),
                },
              ],
            }
          : panel,
      ),
    );
  }, [setPanels]);

  const guestMediaDrive = useMemo(() => {
    const p = guestMeshGrant?.permissions;
    if (!p) return false;
    const hasMedia = Boolean(p.manage_music || p.share_audio);
    const hasSmart = Boolean(p.manipulate_active_scene || p.open_smartboard_composer);
    return hasMedia && !hasSmart;
  }, [guestMeshGrant]);

  useEffect(() => {
    const exp = guestMeshGrant?.expiresAt;
    if (!exp) return;
    const id = setInterval(() => {
      setMeshGrantClock((c) => c + 1);
      if (Date.now() >= exp) setGuestMeshGrant(null);
    }, 1000);
    return () => clearInterval(id);
  }, [guestMeshGrant?.expiresAt, setMeshGrantClock, setGuestMeshGrant]);

  const guestMeshRemainSec = useMemo(() => {
    if (!guestMeshGrant?.expiresAt) return null;
    return Math.max(0, Math.floor((guestMeshGrant.expiresAt - Date.now()) / 1000));
  }, [guestMeshGrant?.expiresAt, meshGrantClock]);

  useEffect(() => {
    if (phase !== PHASE.LIVE) setGuestMeshGrant(null);
  }, [phase, setGuestMeshGrant]);

  return {
    meshParticipantsList,
    addMeshRequest,
    acceptMeshRequest,
    revokeMeshParticipant,
    rejectMeshRequest,
    applyMeshProfile,
    guestMediaDrive,
    guestMeshRemainSec,
  };
}
