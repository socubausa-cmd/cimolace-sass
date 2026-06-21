import React, { useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';

/**
 * Bande horizontale scrollable de participants — TikTok/Stories style.
 * Affiche des cercles avec avatar/initiales, état mic, et speaking ring.
 * Tap → onSelectParticipant(participant)
 */
export function LiveHostMobileParticipantStrip({
  liveParticipants = [],
  onSelectParticipant,
  user,
}) {
  const scrollRef = useRef(null);

  if (!liveParticipants || liveParticipants.length === 0) return null;

  const getInitials = (name = '') => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (name[0] || '?').toUpperCase();
  };

  const getColor = (id = '') => {
    const colors = ['#4299e1', '#48bb78', '#ed8936', '#9f7aea', '#f6ad55', '#38b2ac', '#fc8181', '#76e4f7'];
    let hash = 0;
    for (let i = 0; i < String(id).length; i++) hash += String(id).charCodeAt(i);
    return colors[hash % colors.length];
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 88,
        left: 0,
        right: 0,
        zIndex: 22,
        paddingLeft: 12,
        paddingRight: 12,
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          gap: 10,
          paddingBottom: 4,
          alignItems: 'flex-end',
          width: 'max-content',
        }}
      >
        {liveParticipants.slice(0, 20).map((p) => {
          const name = p.displayName || p.name || p.full_name || p.user_id || '?';
          const isSelf = p.user_id === user?.id || p.userId === user?.id;
          const accentColor = getColor(p.user_id || p.userId || name);
          const isSpeaking = Boolean(p.isSpeaking || p.speaking);
          const micEnabled = p.micOn !== false && p.mic !== false;

          return (
            <button
              key={p.user_id || p.userId || name}
              onClick={() => onSelectParticipant?.(p)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                WebkitTapHighlightColor: 'transparent',
                outline: 'none',
                flexShrink: 0,
              }}
            >
              {/* Avatar circle */}
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: `${accentColor}30`,
                border: isSpeaking
                  ? `2.5px solid ${accentColor}`
                  : isSelf
                    ? '2px solid rgba(255,255,255,0.5)'
                    : '1.5px solid rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isSpeaking ? `0 0 12px ${accentColor}60` : '0 2px 8px rgba(0,0,0,0.4)',
                position: 'relative',
                transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
              }}>
                {/* Initials or avatar */}
                {p.avatar_url ? (
                  <img
                    src={p.avatar_url}
                    alt={name}
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{
                    color: accentColor,
                    fontWeight: 700,
                    fontSize: 16,
                    letterSpacing: -0.5,
                  }}>
                    {getInitials(name)}
                  </span>
                )}

                {/* Mic indicator */}
                <div style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: micEnabled ? 'rgba(72,187,120,0.9)' : 'rgba(229,62,62,0.9)',
                  border: '2px solid #262624',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {micEnabled
                    ? <Mic size={9} color="#fff" />
                    : <MicOff size={9} color="#fff" />
                  }
                </div>
              </div>

              {/* Name */}
              <span style={{
                color: isSelf ? '#fff' : 'rgba(255,255,255,0.72)',
                fontSize: 10,
                fontWeight: isSelf ? 700 : 500,
                maxWidth: 52,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textShadow: '0 1px 3px rgba(0,0,0,0.9)',
              }}>
                {isSelf ? 'Moi' : name.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Hide scrollbar */}
      <style>{`.lh-strip::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
