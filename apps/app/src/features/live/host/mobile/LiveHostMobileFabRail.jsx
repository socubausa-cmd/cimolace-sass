import React from 'react';
import {
  MessageCircle,
  Sparkles,
  FileText,
  HelpCircle,
  UserPlus,
  Video,
  MessageSquareDot,
} from 'lucide-react';

/**
 * Rail de boutons flottants droite — TikTok style.
 * Chaque bouton ouvre un bottom sheet.
 */
export function LiveHostMobileFabRail({
  isGuestUi,
  onOpenChat,
  onOpenScript,
  onOpenQA,
  onOpenIA,
  onOpenScenes,
  onOpenWhisper,
  onInvite,
  chatUnread = 0,
  qaCount = 0,
  whisperUnread = 0,
}) {
  const FAB_SIZE = 50;

  const fabs = [
    {
      icon: <MessageCircle size={22} />,
      label: 'Chat',
      badge: chatUnread > 0 ? chatUnread : null,
      onClick: onOpenChat,
      color: '#4299e1',
      show: true,
    },
    {
      icon: <HelpCircle size={22} />,
      label: 'Q&R',
      badge: qaCount > 0 ? qaCount : null,
      onClick: onOpenQA,
      color: '#48bb78',
      show: true,
    },
    {
      icon: <FileText size={22} />,
      label: 'Script',
      onClick: onOpenScript,
      color: '#ed8936',
      show: !isGuestUi,
    },
    {
      icon: <Sparkles size={22} />,
      label: 'IA',
      onClick: onOpenIA,
      color: '#9f7aea',
      show: !isGuestUi,
    },
    {
      icon: <Video size={22} />,
      label: 'Scènes',
      onClick: onOpenScenes,
      color: '#f6ad55',
      show: !isGuestUi,
    },
    {
      icon: <MessageSquareDot size={22} />,
      label: 'Aparté',
      badge: whisperUnread > 0 ? whisperUnread : null,
      onClick: onOpenWhisper,
      color: '#f687b3',
      show: !isGuestUi,
    },
    {
      icon: <UserPlus size={22} />,
      label: 'Inviter',
      onClick: onInvite,
      color: '#38b2ac',
      show: !isGuestUi,
    },
  ].filter((f) => f.show);

  return (
    <div
      style={{
        position: 'absolute',
        right: 12,
        bottom: 130,
        zIndex: 25,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
      }}
    >
      {fabs.map((fab) => (
        <div key={fab.label} style={{ position: 'relative' }}>
          <button
            onClick={fab.onClick}
            style={{
              width: FAB_SIZE,
              height: FAB_SIZE,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.10)',
              border: `1.5px solid rgba(255,255,255,0.18)`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              gap: 1,
              boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
              transition: 'transform 0.15s ease, background 0.15s ease',
              WebkitTapHighlightColor: 'transparent',
              outline: 'none',
            }}
            onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.88)'; e.currentTarget.style.background = `${fab.color}55`; }}
            onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; }}
          >
            <span style={{ color: fab.color }}>{fab.icon}</span>
          </button>
          {/* Label */}
          <span style={{
            display: 'block',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.75)',
            fontSize: 10,
            fontWeight: 600,
            marginTop: 3,
            textShadow: '0 1px 3px rgba(0,0,0,0.9)',
            letterSpacing: 0.3,
          }}>
            {fab.label}
          </span>
          {/* Badge */}
          {fab.badge != null && (
            <div style={{
              position: 'absolute',
              top: -2,
              right: -2,
              background: '#e53e3e',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              width: 18,
              height: 18,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #262624',
            }}>
              {fab.badge > 9 ? '9+' : fab.badge}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
