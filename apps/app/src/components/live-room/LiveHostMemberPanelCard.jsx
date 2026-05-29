import React from 'react';
import { Track } from 'livekit-client';
import { cn } from '@/lib/utils';
import { ApplePointerTilt } from '@/components/ui/ApplePointerTilt';
import LiveKitVideoCell from '@/components/live-room/LiveKitVideoCell';
import {
  LIVE_MEMBER_PANEL_TILT_DEG,
  LIVE_MEMBER_PANEL_TILT_HOVER_SCALE,
} from '@/lib/liveCommLayers';

export function liveHostMemberHasCamera(participant) {
  if (!participant) return false;
  try {
    return Array.from(participant.videoTrackPublications?.values?.() || []).some(
      (p) => p.source === Track.Source.Camera && !p.isMuted && p.track,
    );
  } catch {
    return false;
  }
}

/**
 * Vignette membre alignée sur le dock du panneau LiveHost (bandeau sous le header) :
 * bordure couleur / or si antenne ou sélection messagerie, vidéo plein cadre ou pastille initiales, nom en bas, point de statut.
 */
export default function LiveHostMemberPanelCard({
  member,
  liveKitParticipant,
  mediaEpoch = 0,
  /** À l'antenne (dock) — masque la miniature caméra au profit des initiales, badge ANT. */
  isPromoted = false,
  /**
   * Panneau messagerie / aperçus : garder le flux vidéo même si la carte est « à l'antenne »
   * (le dock plateau peut masquer la cam pour l'effet ANT., pas la colonne latérale).
   */
  preferLiveVideo = false,
  /** Fil privé actif (messagerie) — même emphase dorée que l'antenne. */
  isSelected = false,
  onClick,
  disabled = false,
  className,
  /** `div` pour le dock (clic ouvre la fiche) ; `button` pour la messagerie */
  as: Comp = 'div',
  /** Effet inclinaison 3D au survol (style Apple) */
  pointerTilt = true,
  /** Amplitude tilt — alignée dock plateau / messagerie */
  tiltDeg = LIVE_MEMBER_PANEL_TILT_DEG,
  tiltHoverScale = LIVE_MEMBER_PANEL_TILT_HOVER_SCALE,
  ...rootProps
}) {
  const hasCam = liveHostMemberHasCamera(liveKitParticipant);
  const showLiveThumb = hasCam && (!isPromoted || preferLiveVideo);
  const goldBorder = isPromoted || isSelected;
  const accent = member?.color || '#a78bfa';
  const borderColor = goldBorder ? 'rgba(251, 191, 72, 0.72)' : `${accent}55`;
  const avatarUrl = member?.avatar_url || member?.avatarUrl;

  const body = (
    <>
      {showLiveThumb && liveKitParticipant ? (
        <LiveKitVideoCell
          participant={liveKitParticipant}
          mediaEpoch={mediaEpoch}
          className="absolute inset-0 z-[1] h-full w-full"
        />
      ) : (
        <div className="absolute inset-0 z-[1] flex items-center justify-center bg-black/25">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-[38px] w-[38px] rounded-full object-cover shadow-md"
              style={{
                border: `2px solid ${goldBorder ? 'rgba(251, 191, 72, 0.65)' : accent}`,
              }}
              loading="lazy"
            />
          ) : (
            <div
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-[11px] font-bold"
              style={{
                background: `${accent}33`,
                border: `2px solid ${goldBorder ? 'rgba(251, 191, 72, 0.65)' : accent}`,
                color: accent,
              }}
            >
              {member?.init || (member?.name || 'M').slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      )}
      {isPromoted ? (
        <div
          className="pointer-events-none absolute left-[3px] top-[3px] z-[2] text-[7px] font-extrabold uppercase tracking-wide text-[#fde68a]"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
        >
          ANT.
        </div>
      ) : null}
      <div className="pointer-events-none absolute bottom-[3px] left-0 right-0 z-[2] overflow-hidden text-ellipsis whitespace-nowrap bg-black/50 px-1 text-center text-[9px] font-medium text-white backdrop-blur-[2px]">
        {member?.name || 'Membre'}
      </div>
      <div
        className="pointer-events-none absolute right-1 top-1 z-[2] h-1.5 w-1.5 rounded-full"
        style={{
          background: member?.status === 'online' ? '#10b981' : '#f59e0b',
          boxShadow:
            member?.status === 'online'
              ? '0 0 5px rgba(16,185,129,0.8)'
              : '0 0 5px rgba(245,158,11,0.8)',
        }}
      />
    </>
  );

  const style = {
    border: `1px solid ${borderColor}`,
    background: 'rgba(0,0,0,0.4)',
    boxShadow: goldBorder ? '0 0 12px rgba(251, 191, 72, 0.22)' : undefined,
  };

  const buttonInnerClass = cn(
    'relative flex h-full w-full min-h-0 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-[4px] border-0 p-0',
    disabled && 'cursor-not-allowed opacity-40',
  );

  const divInnerClass = cn(
    'relative flex h-full w-full min-h-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-[4px]',
    onClick && !disabled && 'cursor-pointer',
    disabled && 'cursor-not-allowed opacity-40',
  );

  if (Comp === 'button') {
    if (!pointerTilt) {
      return (
        <button
          type="button"
          disabled={disabled}
          onClick={onClick}
          className={cn(
            'relative flex min-w-[78px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-[4px] border-0 p-0',
            disabled && 'cursor-not-allowed opacity-40',
            className,
          )}
          style={style}
          {...rootProps}
        >
          {body}
        </button>
      );
    }
    return (
      <ApplePointerTilt
        className={cn('relative min-w-[78px] shrink-0', className)}
        disabled={disabled}
        tiltDeg={tiltDeg}
        hoverScale={tiltHoverScale}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={onClick}
          className={buttonInnerClass}
          style={style}
          {...rootProps}
        >
          {body}
        </button>
      </ApplePointerTilt>
    );
  }

  const divEl = (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={disabled ? undefined : onClick}
      onKeyDown={
        onClick && !disabled
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
      className={pointerTilt ? divInnerClass : cn(
        'relative flex min-w-[78px] shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-[4px]',
        onClick && !disabled && 'cursor-pointer',
        disabled && 'cursor-not-allowed opacity-40',
        className,
      )}
      style={style}
      {...rootProps}
    >
      {body}
    </div>
  );

  if (!pointerTilt) return divEl;

  return (
    <ApplePointerTilt
      className={cn('relative min-w-[78px] shrink-0', className)}
      disabled={disabled}
      tiltDeg={tiltDeg}
      hoverScale={tiltHoverScale}
    >
      {divEl}
    </ApplePointerTilt>
  );
}
