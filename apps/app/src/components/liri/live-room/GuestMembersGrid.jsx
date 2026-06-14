/**
 * GuestMembersGrid
 * ----------------
 * Grille "Membres connectés" côté invité (salle de classe virtuelle).
 * Place la carte self-view XL en position #1, puis les autres élèves
 * en grille compacte 2 colonnes en dessous.
 *
 * Props :
 *   - self : props pour GuestSelfVideoCard (si showSelfVideoCard)
 *   - showSelfVideoCard : afficher la carte « MOI » / caméra locale (false si vue prof séparée au-dessus)
 *   - peers : array de { id, displayName, avatarUrl, videoStream?, micOn, camOn, isHost, isSpeaking }
 *   - showPeers (bool)         — fonction du flag show_members_grid
 *   - hostParticipant (object?) — si on veut mettre en avant le prof en haut
 */

import React from 'react';
import { Mic, MicOff, Video, VideoOff, Crown } from 'lucide-react';
import GuestSelfVideoCard from './GuestSelfVideoCard';
import { proColors, proRadii, proShadow, proType } from '@/styles/proTokens';

export default function GuestMembersGrid({
  self,
  showSelfVideoCard = true,
  peers = [],
  showPeers = true,
  hostParticipant = null,
}) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        padding: 8,
        height: '100%', minHeight: 0,
        overflowY: 'auto',
        background: proColors.surface1,
      }}
      className="pro-scroll"
    >
      {/* Carte prof en avant si fournie */}
      {hostParticipant && (
        <PeerCard
          peer={hostParticipant}
          isHost
          size="medium"
        />
      )}

      {showSelfVideoCard && self ? <GuestSelfVideoCard {...self} /> : null}

      {/* Séparateur */}
      {showPeers && peers.length > 0 && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 2px',
            color: proColors.textMuted,
            fontSize: proType.xxs,
            letterSpacing: proType.tracking.label,
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          <span>Autres élèves</span>
          <span style={{ color: proColors.textDisabled }}>{peers.length}</span>
          <span style={{ flex: 1, height: 1, background: proColors.border }} />
        </div>
      )}

      {/* Grille 2 colonnes */}
      {showPeers && peers.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 8,
          }}
        >
          {peers.map((p) => (
            <PeerCard key={p.id} peer={p} size="small" />
          ))}
        </div>
      )}
    </div>
  );
}

function PeerCard({ peer, size = 'small', isHost = false }) {
  const {
    displayName = 'Élève', avatarUrl = null, videoStream = null,
    micOn = false, camOn = false, isSpeaking = false,
  } = peer || {};

  const videoRef = React.useRef(null);
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (videoStream && v.srcObject !== videoStream) v.srcObject = videoStream;
      else if (!videoStream && v.srcObject) v.srcObject = null;
    } catch { /* noop */ }
  }, [videoStream]);

  const initials = (displayName || '?')
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '').join('') || '?';

  const showVideo = Boolean(videoStream) && camOn;
  const ringColor = isSpeaking ? proColors.accent : isHost ? proColors.accent : 'transparent';

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: size === 'medium' ? '16 / 10' : '4 / 3',
        borderRadius: proRadii.md,
        overflow: 'hidden',
        background: proColors.surface0,
        border: `1px solid ${proColors.border}`,
        boxShadow: isSpeaking
          ? `0 0 0 2px ${ringColor}, ${proShadow.panel}`
          : isHost
            ? `0 0 0 1px ${ringColor}, ${proShadow.panel}`
            : proShadow.panel,
        fontFamily: proType.ui,
        color: proColors.textPrimary,
      }}
    >
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
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
              style={{ width: size === 'medium' ? 54 : 42, height: size === 'medium' ? 54 : 42, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: size === 'medium' ? 54 : 42, height: size === 'medium' ? 54 : 42,
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: proColors.surface3,
                color: isHost ? proColors.accent : proColors.textSecondary,
                fontSize: size === 'medium' ? 20 : 16, fontWeight: 700,
              }}
            >
              {initials}
            </div>
          )}
        </div>
      )}

      {/* Nom en bas */}
      <div
        style={{
          position: 'absolute', left: 4, right: 4, bottom: 4,
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '2px 6px',
          background: 'rgba(11,12,14,0.72)',
          backdropFilter: 'blur(4px)',
          borderRadius: proRadii.xs,
          fontSize: proType.xxs,
          color: proColors.textPrimary,
        }}
      >
        {isHost && <Crown size={9} style={{ color: proColors.accent, flexShrink: 0 }} />}
        <span style={{
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontWeight: isHost ? 700 : 500,
          color: isHost ? proColors.accent : proColors.textPrimary,
        }}>
          {isHost ? 'Prof' : displayName}
        </span>
        <span style={{ flex: 1 }} />
        {micOn
          ? <Mic size={9} style={{ color: proColors.ok }} />
          : <MicOff size={9} style={{ color: proColors.textDisabled }} />}
        {camOn
          ? <Video size={9} style={{ color: proColors.ok }} />
          : <VideoOff size={9} style={{ color: proColors.textDisabled }} />}
      </div>
    </div>
  );
}
