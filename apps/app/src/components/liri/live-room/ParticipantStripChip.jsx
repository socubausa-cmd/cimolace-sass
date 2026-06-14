import React, { useRef, useEffect, useCallback, useState } from 'react';
import { RoomEvent, Track } from 'livekit-client';
import { cn } from '@/lib/utils';

/**
 * Vignette caméra pour le bandeau au-dessus du SmartBoard (invités + hôte).
 * Clone le MediaStreamTrack pour ne pas retirer le flux de la grande scène / mini.
 */
export default function ParticipantStripChip({
  roomRef,
  participant,
  isPromoted,
  canPromote,
  onPromote,
  /** Clic vignette → fiche vidéo (LIRI) ; « Mettre à l'antenne » reste dans la modal hôte */
  onOpenPreview,
  /** Remplit une cellule flex du bandeau LIRI (largeur égale) */
  fillSlot = false,
  /** Badge hôte type maquette LIRI (coin sup. gauche violet, statut en bas) */
  seatRole,
}) {
  const videoRef = useRef(null);
  const cloneRef = useRef(null);
  const { id, name, isLocal } = participant;
  const [videoLive, setVideoLive] = useState(false);

  const bindVideo = useCallback(() => {
    const room = roomRef?.current;
    const el = videoRef.current;

    setVideoLive(false);

    if (cloneRef.current) {
      try {
        cloneRef.current.stop();
      } catch {
        /* ignore */
      }
      cloneRef.current = null;
    }
    if (el) {
      el.srcObject = null;
    }

    if (!room || !el) return;

    const lkParticipant = isLocal ? room.localParticipant : room.remoteParticipants.get(id);
    if (!lkParticipant) return;

    const pub = lkParticipant.getTrackPublication(Track.Source.Camera);
    const mediaTrack = pub?.track?.mediaStreamTrack;
    if (!mediaTrack || pub.isMuted) return;

    try {
      const clone = mediaTrack.clone();
      cloneRef.current = clone;
      el.srcObject = new MediaStream([clone]);
      el.play().catch(() => {});
    } catch {
      /* clone indisponible */
    }
  }, [roomRef, id, isLocal]);

  useEffect(() => {
    bindVideo();
    const room = roomRef?.current;
    if (!room) {
      return undefined;
    }

    const onChange = () => bindVideo();
    room.on(RoomEvent.LocalTrackPublished, onChange);
    room.on(RoomEvent.LocalTrackUnpublished, onChange);
    room.on(RoomEvent.LocalTrackMuted, onChange);
    room.on(RoomEvent.LocalTrackUnmuted, onChange);
    room.on(RoomEvent.TrackPublished, onChange);
    room.on(RoomEvent.TrackUnpublished, onChange);
    room.on(RoomEvent.TrackMuted, onChange);
    room.on(RoomEvent.TrackUnmuted, onChange);
    room.on(RoomEvent.TrackSubscribed, onChange);
    room.on(RoomEvent.TrackUnsubscribed, onChange);

    return () => {
      room.off(RoomEvent.LocalTrackPublished, onChange);
      room.off(RoomEvent.LocalTrackUnpublished, onChange);
      room.off(RoomEvent.LocalTrackMuted, onChange);
      room.off(RoomEvent.LocalTrackUnmuted, onChange);
      room.off(RoomEvent.TrackPublished, onChange);
      room.off(RoomEvent.TrackUnpublished, onChange);
      room.off(RoomEvent.TrackMuted, onChange);
      room.off(RoomEvent.TrackUnmuted, onChange);
      room.off(RoomEvent.TrackSubscribed, onChange);
      room.off(RoomEvent.TrackUnsubscribed, onChange);

      if (cloneRef.current) {
        try {
          cloneRef.current.stop();
        } catch {
          /* ignore */
        }
        cloneRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setVideoLive(false);
    };
  }, [roomRef, bindVideo]);

  const initial = (name || 'M').slice(0, 1).toUpperCase();

  const displayName =
    seatRole === 'host' && typeof name === 'string' && name.startsWith('HÔTE · ')
      ? name.slice('HÔTE · '.length).trim() || name
      : name;

  const tile = (
    <div
      className={cn(
        'relative h-[56px] rounded-xl overflow-hidden border transition-colors',
        fillSlot ? 'min-w-0 w-full' : 'w-[80px] shrink-0',
        isPromoted ? 'border-[#D4AF37]/55 ring-1 ring-[#D4AF37]/30' : 'border-white/12',
        seatRole === 'host'
          && 'rounded-[13px] border-2 border-amber-400/40 bg-gradient-to-br from-[#2a1f40]/90 to-[#15102a]/95 shadow-[inset_0_0_24px_-8px_rgba(0,0,0,0.45)]',
        (onOpenPreview || (canPromote && onPromote)) ? 'cursor-pointer hover:border-[#D4AF37]/40' : '',
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={cn(
          'absolute inset-0 h-full w-full object-cover transition-opacity duration-200',
          videoLive ? 'opacity-100 z-[1]' : 'opacity-0 z-0',
        )}
        onPlaying={() => setVideoLive(true)}
        onEmptied={() => setVideoLive(false)}
      />
      <div
        className={cn(
          'absolute inset-0 z-[2] flex items-center justify-center bg-gradient-to-br from-[#1a2540] to-black/55 transition-opacity duration-200',
          videoLive ? 'opacity-0 pointer-events-none' : 'opacity-100',
        )}
      >
        <span className="text-sm font-semibold text-white/85">{initial}</span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 z-[3] bg-gradient-to-t from-black/90 via-black/45 to-transparent px-1 pt-4 pb-0.5 pointer-events-none">
        {seatRole === 'host' ? (
          <span className="flex items-center justify-center gap-1">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            <span className="truncate text-[8px] font-medium text-white/95">{displayName || 'Hôte'}</span>
          </span>
        ) : (
          <span className="block text-[9px] text-white/95 truncate text-center leading-tight font-medium">
            {displayName || 'Membre'}
          </span>
        )}
      </div>
      {seatRole === 'host' && !isPromoted ? (
        <span className="absolute top-1 left-1 z-[4] rounded bg-violet-600/92 px-1 py-0.5 text-[6px] font-bold uppercase tracking-wider text-white shadow-sm ring-1 ring-violet-300/40">
          HÔTE
        </span>
      ) : null}
      {isPromoted && (
        <span className="absolute top-0.5 left-0.5 z-[4] text-[7px] font-bold uppercase tracking-wide px-1 py-0.5 rounded bg-[#D4AF37] text-black">
          Scène
        </span>
      )}
    </div>
  );

  const wrapBtn = (child, titleText, onClick) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'border-0 bg-transparent p-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/50',
        fillSlot ? 'h-full w-full min-w-0' : 'shrink-0',
      )}
      title={titleText}
    >
      {child}
    </button>
  );

  if (onOpenPreview) {
    return wrapBtn(
      tile,
      `Voir ${displayName || 'ce participant'} en grand`,
      () => onOpenPreview({ id, name, isLocal }),
    );
  }

  if (canPromote && onPromote) {
    return wrapBtn(
      tile,
      `Mettre ${displayName || 'ce participant'} sur la grande scène`,
      () => onPromote(id),
    );
  }

  return (
    <div
      className={cn('rounded-xl', fillSlot ? 'h-full w-full min-w-0' : 'shrink-0')}
      title={displayName || 'Participant'}
    >
      {tile}
    </div>
  );
}
