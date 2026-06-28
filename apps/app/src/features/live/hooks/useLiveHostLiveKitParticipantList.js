import { useCallback } from 'react';
import { parseLiveKitMetadata } from '@/features/live/host/liveHostUtils';

/**
 * Construit la liste dock / messagerie à partir d'une `Room` LiveKit (local + distants).
 */
export function useLiveHostLiveKitParticipantList({
  user,
  antennaSoloModeRef,
  setLiveParticipants,
  setPromotedId,
}) {
  return useCallback((room) => {
    const all = [];
    if (room.localParticipant) {
      const lp = room.localParticipant;
      const lpMeta = parseLiveKitMetadata(lp.metadata);
      const lpIsHost = lpMeta.role === 'host';
      const lpId = lpMeta.userId || lp.identity || lp.sid || 'local';
      all.push({
        id: lpId,
        name: lp.name || user?.full_name || 'Hôte',
        isLocal: true,
        isHost: lpIsHost,
        color: '#C8960C',
        init: (lp.name || 'PL').substring(0, 2).toUpperCase(),
        status: 'online',
        grade: lpIsHost ? 'Hôte' : '',
        avg: '—',
        att: '—',
        note: lpIsHost ? 'Hôte de la session' : '',
        bio: '',
        avatar_url: lpMeta.avatarUrl || lpMeta.avatar_url || null,
      });
    }
    room.remoteParticipants.forEach((p) => {
      const name = p.name || p.identity || 'Participant';
      const rMeta = parseLiveKitMetadata(p.metadata);
      const rIsHost = rMeta.role === 'host';
      const rid = rMeta.userId || p.identity || p.sid;
      all.push({
        id: rid,
        name,
        isLocal: false,
        isHost: rIsHost,
        color: `hsl(${(name.charCodeAt(0) * 37) % 360}, 65%, 55%)`,
        init: name.substring(0, 2).toUpperCase(),
        status: 'online',
        grade: rIsHost ? 'Hôte' : '',
        avg: '—',
        att: '—',
        note: rIsHost ? 'Formateur / hôte' : '',
        bio: '',
        avatar_url: rMeta.avatarUrl || rMeta.avatar_url || null,
      });
    });
    const strip = all.filter(
      (p) => !(p.isLocal && p.isHost) && !String(p.id || '').startsWith('liri_mobile'),
    );
    setLiveParticipants(strip);
    setPromotedId((prev) => {
      const remotes = all.filter((p) => !p.isLocal);
      if (remotes.length === 0) return null;
      const solo = antennaSoloModeRef.current;
      if (solo) {
        if (prev && remotes.some((x) => String(x.id) === String(prev))) return prev;
        return null;
      }
      if (prev && remotes.some((x) => String(x.id) === String(prev))) return prev;
      const hostRemote = remotes.find((r) => r.isHost);
      return hostRemote?.id ?? remotes[0]?.id ?? null;
    });
  }, [user, antennaSoloModeRef, setLiveParticipants, setPromotedId]);
}
