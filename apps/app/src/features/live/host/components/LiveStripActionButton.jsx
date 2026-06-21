import React from 'react';

const VARIANTS = {
  stop: {
    testId: 'live-host-stop-strip',
    bgIdle: 'linear-gradient(135deg,#c63b3b,#9b2222)',
    bgBusy: 'rgba(100,50,50,.5)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.12)',
    boxShadow: '0 0 12px rgba(198,59,59,.35)',
    label: 'STOP',
    fontSize: '10px',
    letterSpacing: '.08em',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
    ),
  },
  leave: {
    testId: 'live-guest-leave-strip',
    bgIdle: 'linear-gradient(135deg,#a8763a,#5b21b6)',
    bgBusy: 'rgba(88,28,135,.35)',
    color: '#f5f3ff',
    border: '1px solid rgba(212,163,106,.35)',
    boxShadow: '0 0 14px rgba(168,118,58,.35)',
    label: 'QUITTER',
    fontSize: '9px',
    letterSpacing: '.06em',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
      </svg>
    ),
  },
};

export const LiveStripActionButton = ({ variant = 'stop', busy, onClick, title }) => {
  const v = VARIANTS[variant] || VARIANTS.stop;
  return (
    <button
      type="button"
      data-testid={v.testId}
      disabled={busy}
      onClick={onClick}
      title={title}
      style={{
        flexShrink: 0,
        alignSelf: 'stretch',
        minWidth: '52px',
        borderRadius: '6px',
        background: busy ? v.bgBusy : v.bgIdle,
        padding: '6px 8px',
        fontSize: v.fontSize,
        fontWeight: 800,
        letterSpacing: v.letterSpacing,
        color: v.color,
        border: v.border,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2px',
        boxShadow: v.boxShadow,
        cursor: busy ? 'wait' : 'pointer',
        opacity: busy ? 0.75 : 1,
      }}
    >
      {v.icon}
      {v.label}
    </button>
  );
};

export default LiveStripActionButton;
