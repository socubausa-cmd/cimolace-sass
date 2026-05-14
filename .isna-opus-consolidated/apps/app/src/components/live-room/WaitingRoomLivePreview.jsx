/**
 * Aperçu vidéo LiveKit depuis la salle d'attente : flux distant muet, durée limitée (token subscribe-only).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { Loader2, Video, VideoOff } from 'lucide-react';
import { getStableLiveKitRoomOptions, stableLiveKitConnectOptions } from '@/lib/livekitStableClient';
import { getLiveKitWaitingPreviewToken } from '@/services/livekitApi';
import { cn } from '@/lib/utils';

export default function WaitingRoomLivePreview({
  sessionId,
  hostUserId,
  previewSeconds = 12,
  enabled = true,
  className = '',
}) {
  const videoRef = useRef(null);
  const roomRef = useRef(null);
  const attachedTrackRef = useRef(null);
  const attachedIsHostRef = useRef(false);
  const timerRef = useRef(null);
  const [phase, setPhase] = useState('idle'); // idle | connecting | playing | ended | error
  const [message, setMessage] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(null);

  const cleanupRoom = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const t = attachedTrackRef.current;
    if (t && videoRef.current) {
      try {
        t.detach(videoRef.current);
      } catch {
        /* ignore */
      }
    }
    attachedTrackRef.current = null;
    attachedIsHostRef.current = false;
    const r = roomRef.current;
    roomRef.current = null;
    if (r) {
      try {
        r.disconnect(true);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const attachVideoTrack = useCallback(
    (track, participant) => {
      const el = videoRef.current;
      if (!el || track.kind !== Track.Kind.Video) return;

      let meta = {};
      try {
        meta = participant?.metadata ? JSON.parse(participant.metadata) : {};
      } catch {
        /* ignore */
      }
      const uid = String(meta.userId || meta.user_id || '');
      const role = String(meta.role || '').toLowerCase();
      const isHostTrack =
        role === 'host' || (hostUserId && uid === String(hostUserId));

      const prev = attachedTrackRef.current;
      const hadHost = attachedIsHostRef.current;
      if (prev === track) return;
      if (isHostTrack) {
        /* toujours privilégier le flux hôte */
      } else if (hadHost) {
        return;
      } else if (prev) {
        /* premier flux non-hôte conservé jusqu’à l’arrivée de l’hôte */
        return;
      }

      if (prev && el) {
        try {
          prev.detach(el);
        } catch {
          /* ignore */
        }
      }

      track.attach(el);
      el.muted = true;
      el.playsInline = true;
      el.play().catch(() => {});
      attachedTrackRef.current = track;
      attachedIsHostRef.current = isHostTrack;
      setPhase('playing');
    },
    [hostUserId],
  );

  useEffect(() => {
    if (!enabled || !sessionId || previewSeconds <= 0) {
      setPhase('idle');
      return undefined;
    }

    let cancelled = false;

    const run = async () => {
      setPhase('connecting');
      setMessage('');
      try {
        const { token, livekitUrl } = await getLiveKitWaitingPreviewToken(sessionId);
        if (cancelled) return;

        const room = new Room(
          getStableLiveKitRoomOptions({
            adaptiveStream: true,
            dynacast: true,
          }),
        );
        roomRef.current = room;

        const onTrackSubscribed = (track, _pub, participant) => {
          if (cancelled || participant.isLocal) return;
          if (track.kind === Track.Kind.Audio) {
            if (typeof track.setVolume === 'function') track.setVolume(0);
            return;
          }
          if (track.kind === Track.Kind.Video) {
            attachVideoTrack(track, participant);
          }
        };

        room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);

        room.remoteParticipants.forEach((participant) => {
          participant.trackPublications.forEach((pub) => {
            if (pub.track && pub.kind === Track.Kind.Video) {
              onTrackSubscribed(pub.track, pub, participant);
            }
            if (pub.track && pub.kind === Track.Kind.Audio && typeof pub.track.setVolume === 'function') {
              pub.track.setVolume(0);
            }
          });
        });

        await room.connect(livekitUrl, token, stableLiveKitConnectOptions);
        if (cancelled) {
          cleanupRoom();
          return;
        }

        const cap = Math.min(60, Math.max(4, Number(previewSeconds) || 12));
        let left = cap;
        setSecondsLeft(left);
        timerRef.current = setInterval(() => {
          left -= 1;
          setSecondsLeft(left);
          if (left <= 0) {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            cleanupRoom();
            setPhase('ended');
            setSecondsLeft(null);
          }
        }, 1000);

        setTimeout(() => {
          if (!attachedTrackRef.current && roomRef.current === room && !cancelled) {
            setMessage('Aucune vidéo distante pour l’instant (le formateur n’a peut‑être pas encore activé la caméra).');
          }
        }, 4000);
      } catch (e) {
        if (!cancelled) {
          setPhase('error');
          setMessage(String(e?.message || e || 'Erreur'));
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      cleanupRoom();
    };
  }, [enabled, sessionId, previewSeconds, attachVideoTrack, cleanupRoom]);

  if (!enabled) return null;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-white/12 bg-black/50 shadow-[0_16px_45px_rgba(0,0,0,0.35)]',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-[#D4AF37]/90">
          <Video className="h-3.5 w-3.5" />
          Aperçu du direct
        </div>
        {secondsLeft != null ? (
          <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-200/95">
            {secondsLeft}s · sans son
          </span>
        ) : phase === 'ended' ? (
          <span className="text-[10px] text-white/45">Aperçu terminé</span>
        ) : null}
      </div>
      <div className="relative aspect-video w-full bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-contain"
          playsInline
          muted
          autoPlay
        />
        {phase === 'connecting' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/65 text-white/70">
            <Loader2 className="h-7 w-7 animate-spin text-[#D4AF37]" />
            <p className="text-[11px]">Connexion à l’aperçu…</p>
          </div>
        ) : null}
        {phase === 'error' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/75 px-4 text-center">
            <VideoOff className="h-8 w-8 text-red-400/80" />
            <p className="text-[11px] text-white/65">{message || 'Aperçu indisponible'}</p>
          </div>
        ) : null}
        {phase === 'ended' ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <p className="text-center text-[11px] text-white/55">
              Fin de l’aperçu. Rejoignez le live quand votre accès est ouvert.
            </p>
          </div>
        ) : null}
        {phase === 'playing' && message ? (
          <div className="absolute bottom-2 left-2 right-2 rounded-lg border border-amber-500/25 bg-black/70 px-2 py-1 text-[10px] text-amber-100/90">
            {message}
          </div>
        ) : null}
      </div>
    </div>
  );
}
