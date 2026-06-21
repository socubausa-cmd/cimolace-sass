import React, { useState } from 'react';

/**
 * Boutons flottants style TikTok Live — colonne verticale droite.
 * Semi-transparents, posés sur le SmartBoard.
 * Chaque bouton = action directe ou ouvre un mini-drawer bas.
 */

const BTN = 48; // taille bouton

export function LiveHostMobileFabStack({
  isGuestUi,
  // Scènes
  sbActiveScene,
  setSbActiveScene,
  smartboardSceneFlags,
  // JoyKit
  onOpenJoyKit,
  hostJoyKitRequests,
  // IA rapide
  onOpenIA,
  // Inviter
  copyInviteLink,
  inviteCopied,
  // Rec
  isRecording,
  startRecording,
  stopRecording,
  recStarting,
  // Spotlight
  spotlightOn,
  toggleSpotlight,
}) {
  const [scenesOpen, setScenesOpen] = useState(false);

  // Mini liste scènes rapides (les 5 principales)
  const QUICK_SCENES = [
    { id: 'smartboard', emoji: '🧠', label: 'Smart' },
    { id: 'diapo',      emoji: '📽️', label: 'Diapo' },
    { id: 'screen',     emoji: '🖥️', label: 'Écran' },
    { id: 'board',      emoji: '✏️',  label: 'Crayon' },
    { id: 'image',      emoji: '🖼️', label: 'Images' },
  ];

  const joyKitPending = hostJoyKitRequests?.length ?? 0;

  const buttons = [
    // JoyKit — réactions / quiz / sondages
    {
      id: 'joykit',
      emoji: '🎮',
      label: 'JoyKit',
      badge: joyKitPending > 0 ? joyKitPending : null,
      color: '#d4a36a',
      onPress: () => onOpenJoyKit?.(),
      show: !isGuestUi,
    },
    // Scènes rapides
    {
      id: 'scenes',
      emoji: '🎭',
      label: 'Scènes',
      badge: null,
      color: '#c084fc',
      onPress: () => setScenesOpen((v) => !v),
      show: !isGuestUi,
    },
    // Spotlight
    {
      id: 'spotlight',
      emoji: spotlightOn ? '🔦' : '💡',
      label: 'Focus',
      badge: null,
      color: spotlightOn ? '#fbbf24' : 'rgba(255,255,255,0.6)',
      onPress: () => toggleSpotlight?.(),
      show: !isGuestUi,
    },
    // Inviter
    {
      id: 'invite',
      emoji: inviteCopied ? '✅' : '🔗',
      label: inviteCopied ? 'Copié' : 'Inviter',
      badge: null,
      color: '#38bdf8',
      onPress: () => copyInviteLink?.(),
      show: !isGuestUi,
    },
    // Enregistrement
    {
      id: 'rec',
      emoji: isRecording ? '⏹️' : '🔴',
      label: isRecording ? 'Stop' : 'Rec',
      badge: null,
      color: isRecording ? '#f87171' : 'rgba(255,255,255,0.55)',
      onPress: () => isRecording ? stopRecording?.() : startRecording?.(),
      show: !isGuestUi,
      pulsing: isRecording,
    },
  ].filter((b) => b.show);

  return (
    <>
      {/* Mini scènes picker — apparaît à gauche des boutons */}
      {scenesOpen && (
        <div style={{
          position: 'absolute',
          right: BTN + 20,
          bottom: 200,
          zIndex: 27,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          {QUICK_SCENES.map((s) => {
            const active = sbActiveScene === s.id;
            return (
              <button
                key={s.id}
                onClick={() => { setSbActiveScene?.(s.id); setScenesOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '7px 12px',
                  borderRadius: 20,
                  background: active
                    ? 'rgba(192,132,252,0.35)'
                    : 'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: `1px solid ${active ? 'rgba(192,132,252,0.6)' : 'rgba(255,255,255,0.12)'}`,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: active ? 700 : 400,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                }}
              >
                <span style={{ fontSize: 16 }}>{s.emoji}</span>
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Colonne de boutons */}
      <div style={{
        position: 'absolute',
        right: 8,
        bottom: 100,
        zIndex: 26,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
      }}>
        {buttons.map((btn) => (
          <div key={btn.id} style={{ position: 'relative' }}>
            <button
              onClick={btn.onPress}
              style={{
                width: BTN,
                height: BTN,
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.52)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.15)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0,
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                WebkitTapHighlightColor: 'transparent',
                outline: 'none',
                animation: btn.pulsing ? 'fabPulse 1.4s ease-in-out infinite' : 'none',
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>{btn.emoji}</span>
            </button>

            {/* Label sous le bouton */}
            <span style={{
              display: 'block',
              textAlign: 'center',
              color: btn.color,
              fontSize: 9,
              fontWeight: 700,
              marginTop: 3,
              textShadow: '0 1px 4px rgba(0,0,0,0.9)',
              letterSpacing: 0.2,
              whiteSpace: 'nowrap',
            }}>
              {btn.label}
            </span>

            {/* Badge */}
            {btn.badge != null && (
              <div style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: '#e53e3e',
                color: '#fff',
                fontSize: 8,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid rgba(0,0,0,0.6)',
              }}>
                {btn.badge}
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes fabPulse {
          0%, 100% { box-shadow: 0 4px 16px rgba(0,0,0,0.4), 0 0 0 0 rgba(248,113,113,0.6); }
          50% { box-shadow: 0 4px 16px rgba(0,0,0,0.4), 0 0 0 8px rgba(248,113,113,0); }
        }
      `}</style>
    </>
  );
}
