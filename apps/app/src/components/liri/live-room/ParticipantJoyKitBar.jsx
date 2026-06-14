import React from 'react';
import { REQUEST_LABELS, PRODUCT_NAMES } from '@/lib/liriControlMesh';

/**
 * Invité / participant — demandes vers le Control Mesh (hôte).
 * Brancher onRequest sur temps réel + Permission / Transfer engines.
 */
export default function ParticipantJoyKitBar({
  disabled = false,
  onRequestControl,
  onRequestScene,
  onRequestJoyKit,
  onRequestMediaLane,
}) {
  const btn = (label, onClick) => (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        borderRadius: '4px',
        border: '1px solid rgba(56,189,248,.28)',
        background: 'rgba(56,189,248,.08)',
        padding: '6px 8px',
        fontSize: '9px',
        fontWeight: 600,
        color: '#7dd3fc',
        cursor: disabled ? 'default' : 'pointer',
        textAlign: 'left',
        lineHeight: 1.35,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        borderRadius: '4px',
        border: '1px solid rgba(167,139,250,.22)',
        background: 'rgba(109,40,217,.06)',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div style={{ fontSize: '10px', fontWeight: 700, color: '#c4b5fd', letterSpacing: '0.06em' }}>
        {PRODUCT_NAMES.joyKit} · {PRODUCT_NAMES.controlMesh}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
        {btn(REQUEST_LABELS.requestControl.fr, onRequestControl)}
        {btn(REQUEST_LABELS.requestSceneAccess.fr, onRequestScene)}
        {btn(REQUEST_LABELS.requestJoyKit.fr, onRequestJoyKit)}
        {btn(REQUEST_LABELS.requestMediaLane.fr, onRequestMediaLane)}
      </div>
      <div style={{ fontSize: '8px', color: 'rgba(255,255,255,.35)', lineHeight: 1.4 }}>
        L'hôte reçoit la demande et peut accepter, refuser ou limiter la durée.
      </div>
    </div>
  );
}
