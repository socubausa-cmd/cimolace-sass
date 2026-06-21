import React, { useEffect, useRef, useState, useMemo } from 'react';

const MAX_VISIBLE = 6; // nb messages affichés simultanément

/**
 * Overlay chat TikTok — messages qui remontent sur le SmartBoard.
 * Position : bas-gauche, au-dessus de la BottomBar.
 * Fond translucide sur le texte uniquement (comme TikTok Live).
 */
export function LiveHostMobileChatOverlay({ chatMessages, user, bottomOffset = 88 }) {
  const [visible, setVisible] = useState([]);
  const prevLen = useRef(chatMessages?.length ?? 0);
  const timersRef = useRef([]);

  // Quand de nouveaux messages arrivent → les ajouter avec un ID unique + ts
  useEffect(() => {
    const msgs = chatMessages ?? [];
    if (msgs.length === prevLen.current) return;

    const newMsgs = msgs.slice(prevLen.current);
    prevLen.current = msgs.length;

    newMsgs.forEach((msg) => {
      const item = { ...msg, _key: `${msg.id || Math.random()}_${Date.now()}` };
      setVisible((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), item]);
    });
  }, [chatMessages]);

  // Nettoyage auto après 8s
  useEffect(() => {
    if (!visible.length) return;
    const oldest = visible[0]?._key;
    const t = setTimeout(() => {
      setVisible((prev) => prev.filter((m) => m._key !== oldest));
    }, 8000);
    timersRef.current.push(t);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible.length) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: 10,
        bottom: bottomOffset,
        width: '68%',
        zIndex: 22,
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        pointerEvents: 'none',
      }}
    >
      {visible.map((msg) => {
        const isMe = msg.user_id === user?.id || msg.userId === user?.id;
        const name = msg.sender_name || msg.displayName || '?';
        const text = msg.message || msg.content || msg.text || '';
        return (
          <div
            key={msg._key}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 5,
              animation: 'chatSlideIn 0.25s ease-out',
            }}
          >
            {/* Avatar mini */}
            <div style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: isMe ? 'rgba(212,163,106,0.7)' : 'rgba(255,255,255,0.25)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              fontWeight: 700,
              color: '#fff',
              backdropFilter: 'blur(4px)',
            }}>
              {name.slice(0, 1).toUpperCase()}
            </div>

            {/* Bulle */}
            <div style={{
              background: 'rgba(0,0,0,0.52)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              borderRadius: '4px 12px 12px 12px',
              padding: '5px 9px',
              maxWidth: '100%',
            }}>
              <span style={{
                color: isMe ? '#e3c79a' : 'rgba(253,230,138,0.95)',
                fontSize: 10,
                fontWeight: 700,
                marginRight: 5,
              }}>
                {isMe ? 'Vous' : name}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, lineHeight: 1.3 }}>
                {text}
              </span>
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes chatSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
