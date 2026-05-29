import { useCallback, useEffect } from 'react';
import { PHASE } from '@/features/live/host/liveHostConstants';
import { broadcastRealtime } from '@/lib/realtimeBroadcast';

/**
 * Timers d'expiration du Control Mesh hôte : schedule/clear des délais de révocation,
 * restauration des grants pendants au passage en LIVE, nettoyage à la sortie de LIVE.
 */
export function useLiveHostMeshScheduler({
  phase,
  isGuestUi,
  persistControlMeshToConfig,
  setMeshGrantsByUserId,
  meshHostExpiryTimersRef,
  smartboardChRef,
  pendingMeshRestoreRef,
}) {
  const scheduleMeshHostExpiry = useCallback(
    (uid, expiresAt) => {
      const existing = meshHostExpiryTimersRef.current.get(uid);
      if (existing) clearTimeout(existing);
      const delay = Math.max(0, expiresAt - Date.now());
      const tid = setTimeout(() => {
        meshHostExpiryTimersRef.current.delete(uid);
        setMeshGrantsByUserId((prev) => {
          const next = { ...prev };
          delete next[uid];
          queueMicrotask(() => persistControlMeshToConfig(next));
          return next;
        });
        const ch = smartboardChRef.current;
        if (ch) void broadcastRealtime(ch, 'mesh_revoke', { userId: uid, at: Date.now(), reason: 'expired' });
      }, delay);
      meshHostExpiryTimersRef.current.set(uid, tid);
    },
    [persistControlMeshToConfig, setMeshGrantsByUserId, meshHostExpiryTimersRef, smartboardChRef],
  );

  useEffect(() => {
    if (phase !== PHASE.LIVE || isGuestUi) return;
    const pending = pendingMeshRestoreRef.current;
    if (!pending) return;
    pendingMeshRestoreRef.current = null;
    Object.entries(pending).forEach(([uid, v]) => {
      if (v.expiresAt) scheduleMeshHostExpiry(uid, v.expiresAt);
    });
  }, [phase, isGuestUi, scheduleMeshHostExpiry, pendingMeshRestoreRef]);

  useEffect(() => {
    if (phase === PHASE.LIVE) return;
    meshHostExpiryTimersRef.current.forEach((t) => clearTimeout(t));
    meshHostExpiryTimersRef.current.clear();
  }, [phase, meshHostExpiryTimersRef]);

  return { scheduleMeshHostExpiry };
}
