/**
 * GuestSelfVideoCard
 * ------------------
 * Vignette "MOI" (self-view) de l'élève, dans le panneau "Membres connectés".
 * Se place en position #1 et occupe ~2× la hauteur des cartes suivantes
 * pour marquer clairement l'espace personnel.
 *
 * Props :
 *   - displayName (string)          — affichage prénom/pseudo
 *   - avatarUrl (string?)           — fallback si vidéo off
 *   - videoStream (MediaStream?)    — flux caméra local à attacher
 *   - micOn (bool), camOn (bool)
 *   - onToggleMic (fn?), onToggleCam (fn?)
 *   - onToggleBlur (fn?)            — active/désactive flou VBG (si cap)
 *   - blurOn (bool)
 *   - canToggleMic, canToggleCam, canToggleBlur (bool)
 *   - networkQuality ('good'|'fair'|'poor'|'unknown')
 */

import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, Sparkles, Wifi } from 'lucide-react';
import { proColors, proRadii, proShadow, proType } from '@/styles/proTokens';

const QUALITY_COLOR = {
  good: proColors.ok,
  fair: proColors.warn,
  poor: proColors.error,
  unknown: proColors.textMuted,
};

export default function GuestSelfVideoCard({
  displayName = 'Moi',
  avatarUrl = null,
  videoStream = null,
  micOn = false,
  camOn = false,
  blurOn = false,
  canToggleMic = true,
  canToggleCam = true,
  canToggleBlur = true,
  onToggleMic = null,
  onToggleCam = null,
  onToggleBlur = null,
  networkQuality = 'unknown',
}) {
  const videoRef = useRef(null);

  // Attache le MediaStream local quand il change
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return undefined;
    try {
      if (videoStream && v.srcObject !== videoStream) {
        v.srcObject = videoStream;
      } else if (!videoStream && v.srcObject) {
        v.srcObject = null;
      }
    } catch {
      // noop
    }
    return undefined;
  }, [videoStream]);

  const initials = (displayName || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || '?';

  const showVideo = Boolean(videoStream) && camOn;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 10',
        borderRadius: proRadii.lg,
        overflow: 'hidden',
        background: proColors.surface0,
        // Liseré accent or pour marquer "c'est moi"
        boxShadow: `0 0 0 2px ${proColors.accentOutline}, ${proShadow.panel}`,
        fontFamily: proType.ui,
        color: proColors.textPrimary,
      }}
    >
      {/* Vidéo ou fallback */}
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)', // miroir naturel pour self-view
            filter: blurOn ? 'blur(0px)' : 'none', // le flou réel est VBG côté track
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `radial-gradient(ellipse at center, ${proColors.surface3} 0%, ${proColors.surface0} 100%)`,
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: 80, height: 80, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: proColors.surface3,
                color: proColors.accent,
                fontSize: 30, fontWeight: 700,
                letterSpacing: 1,
              }}
            >
              {initials}
            </div>
          )}
        </div>
      )}

      {/* Badge "MOI" top-left */}
      <div
        style={{
          position: 'absolute', top: 8, left: 8,
          padding: '3px 8px',
          borderRadius: proRadii.pill,
          background: proColors.accent,
          color: '#000',
          fontSize: proType.xxs,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        MOI
      </div>

      {/* Nom + réseau top-right */}
      <div
        style={{
          position: 'absolute', top: 8, right: 8,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '3px 8px',
          background: 'rgba(11,12,14,0.7)',
          backdropFilter: 'blur(6px)',
          borderRadius: proRadii.pill,
          fontSize: proType.xxs,
          color: proColors.textPrimary,
        }}
      >
        <Wifi size={10} style={{ color: QUALITY_COLOR[networkQuality] || proColors.textMuted }} />
        <span style={{ fontWeight: 600 }}>{displayName}</span>
      </div>

      {/* Barre de contrôles bottom */}
      <div
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          padding: '8px 10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: 'linear-gradient(180deg, transparent 0%, rgba(11,12,14,0.85) 60%)',
        }}
      >
        <ControlBtn
          active={micOn}
          disabled={!canToggleMic}
          onClick={onToggleMic}
          label={micOn ? 'Couper le micro' : 'Activer le micro'}
          iconOn={<Mic size={14} />}
          iconOff={<MicOff size={14} />}
          danger={!micOn}
        />
        <ControlBtn
          active={camOn}
          disabled={!canToggleCam}
          onClick={onToggleCam}
          label={camOn ? 'Couper la caméra' : 'Activer la caméra'}
          iconOn={<Video size={14} />}
          iconOff={<VideoOff size={14} />}
          danger={!camOn}
        />
        {canToggleBlur && (
          <ControlBtn
            active={blurOn}
            disabled={!camOn}
            onClick={onToggleBlur}
            label={blurOn ? 'Désactiver le flou' : 'Activer le flou d\u2019arrière-plan'}
            iconOn={<Sparkles size={14} />}
            iconOff={<Sparkles size={14} />}
            danger={false}
          />
        )}
      </div>
    </div>
  );
}

function ControlBtn({ active, disabled, onClick, label, iconOn, iconOff, danger }) {
  const base = {
    width: 30, height: 30,
    borderRadius: '50%',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    opacity: disabled ? 0.4 : 1,
    transition: 'background 120ms ease',
  };
  const style = active
    ? { ...base, background: proColors.surface4, color: proColors.textPrimary }
    : danger
      ? { ...base, background: proColors.rec, color: '#fff' }
      : { ...base, background: proColors.surface3, color: proColors.textSecondary };
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={style}
    >
      {active ? iconOn : iconOff}
    </button>
  );
}
