import React, { useState } from 'react';
import { labelLivePermissionAction } from '@/lib/liriLive/permissionRequestSignals';
import { JOYKIT_LEVEL_CHOICES, normalizeJoyKitLevel } from '@/lib/liriLive/joykitRequestSignals';

const LEVEL_LABEL_FR = {
  light: 'Léger',
  interactive: 'Interactif',
  control: 'Contrôle',
  full: 'Complet',
};

function JoyKitRequestCard({ row, onReject, onApprove5min, onApproveSession }) {
  const [level, setLevel] = useState(() => normalizeJoyKitLevel(row.requestedLevel));
  const initials = (row.name || '?').toString().split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const t = row.createdAt ? new Date(row.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '10px 10px',
        background: 'rgba(200,150,12,.08)',
        border: '1px solid rgba(251,191,36,.28)',
        borderRadius: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'rgba(251,191,36,.18)',
            border: '1px solid rgba(251,191,36,.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9,
            fontWeight: 800,
            color: '#fbbf24',
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.3 }}>{row.name || 'Participant'}</p>
          <p style={{ fontSize: 10, color: 'rgba(253,230,138,.9)', margin: '4px 0 0', lineHeight: 1.35 }}>
            Demande JoyKit · souhaité : <strong style={{ color: '#fde68a' }}>{LEVEL_LABEL_FR[normalizeJoyKitLevel(row.requestedLevel)] || row.requestedLevel}</strong>
            {t ? <span style={{ color: 'rgba(255,255,255,.35)' }}> · {t}</span> : null}
          </p>
          <p style={{ fontSize: 8, color: 'rgba(255,255,255,.32)', margin: '4px 0 0', fontFamily: 'monospace' }}>
            id {String(row.id).slice(0, 8)}…
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {JOYKIT_LEVEL_CHOICES.map((lv) => (
          <button
            key={lv}
            type="button"
            onClick={() => setLevel(lv)}
            style={{
              borderRadius: 6,
              border: level === lv ? '1px solid rgba(251,191,36,.65)' : '1px solid rgba(255,255,255,.12)',
              background: level === lv ? 'rgba(251,191,36,.2)' : 'rgba(0,0,0,.2)',
              padding: '4px 8px',
              color: level === lv ? '#fde68a' : 'rgba(255,255,255,.65)',
              fontSize: 8,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {LEVEL_LABEL_FR[lv] || lv}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button
          type="button"
          onClick={() => onReject?.(row)}
          style={{
            borderRadius: 6,
            border: '1px solid rgba(248,113,113,.45)',
            background: 'rgba(239,68,68,.12)',
            padding: '6px 10px',
            color: '#fca5a5',
            fontSize: 9,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Refuser
        </button>
        <button
          type="button"
          onClick={() => onApprove5min?.(row, level)}
          style={{
            borderRadius: 6,
            border: '1px solid rgba(212,163,106,.4)',
            background: 'rgba(200,148,62,.12)',
            padding: '6px 10px',
            color: '#6ee7b7',
            fontSize: 9,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Autoriser 5 min
        </button>
        <button
          type="button"
          onClick={() => onApproveSession?.(row, level)}
          style={{
            borderRadius: 6,
            border: '1px solid rgba(248,152,56,.4)',
            background: 'rgba(248,152,56,.12)',
            padding: '6px 10px',
            color: '#7dd3fc',
            fontSize: 9,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Autoriser session
        </button>
      </div>
    </div>
  );
}

/**
 * Demandes d'accès + JoyKit (hub Signaux).
 */
export default function HostPermissionRequestsPanel({
  rows = [],
  joyKitRows = [],
  onReject,
  onApprove5min,
  onApproveSession,
  onJoyKitReject,
  onJoyKitApprove5min,
  onJoyKitApproveSession,
}) {
  const hasAny = rows.length > 0 || joyKitRows.length > 0;
  if (!hasAny) {
    return (
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', textAlign: 'center', padding: '20px 8px', lineHeight: 1.5, margin: 0 }}>
        Aucune demande d&apos;accès ni JoyKit en attente.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {joyKitRows.length > 0 ? (
        <div>
          <p style={{ fontSize: 9, fontWeight: 800, color: 'rgba(251,191,36,.85)', margin: '0 0 8px', letterSpacing: '.06em' }}>
            JOYKIT
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {joyKitRows.map((row) => (
              <JoyKitRequestCard
                key={row.id}
                row={row}
                onReject={onJoyKitReject}
                onApprove5min={onJoyKitApprove5min}
                onApproveSession={onJoyKitApproveSession}
              />
            ))}
          </div>
        </div>
      ) : null}
      {rows.length > 0 ? (
        <div>
          {joyKitRows.length > 0 ? (
            <p style={{ fontSize: 9, fontWeight: 800, color: 'rgba(253,224,196,.85)', margin: '4px 0 8px', letterSpacing: '.06em' }}>
              ACCÈS GÉNÉRAUX
            </p>
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((row) => {
              const initials = (row.name || '?').toString().split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
              const actionLabel = labelLivePermissionAction(row.action);
              const t = row.createdAt ? new Date(row.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';

              return (
                <div
                  key={row.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '10px 10px',
                    background: 'rgba(212,163,106,.07)',
                    border: '1px solid rgba(212,163,106,.22)',
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: 'rgba(212,163,106,.2)',
                        border: '1px solid rgba(212,163,106,.45)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 9,
                        fontWeight: 800,
                        color: '#e3c79a',
                        flexShrink: 0,
                      }}
                    >
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.3 }}>{row.name || 'Participant'}</p>
                      <p style={{ fontSize: 10, color: 'rgba(253,224,196,.85)', margin: '4px 0 0', lineHeight: 1.35 }}>
                        Demande : <strong style={{ color: '#f3e8d2' }}>{actionLabel}</strong>
                        {t ? <span style={{ color: 'rgba(255,255,255,.35)' }}> · {t}</span> : null}
                      </p>
                      <p style={{ fontSize: 8, color: 'rgba(255,255,255,.32)', margin: '4px 0 0', fontFamily: 'monospace' }}>
                        id {String(row.id).slice(0, 8)}… · {String(row.action)}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => onReject?.(row)}
                      style={{
                        borderRadius: 6,
                        border: '1px solid rgba(248,113,113,.45)',
                        background: 'rgba(239,68,68,.12)',
                        padding: '6px 10px',
                        color: '#fca5a5',
                        fontSize: 9,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Refuser
                    </button>
                    <button
                      type="button"
                      onClick={() => onApprove5min?.(row)}
                      style={{
                        borderRadius: 6,
                        border: '1px solid rgba(212,163,106,.4)',
                        background: 'rgba(200,148,62,.12)',
                        padding: '6px 10px',
                        color: '#6ee7b7',
                        fontSize: 9,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Autoriser 5 min
                    </button>
                    <button
                      type="button"
                      onClick={() => onApproveSession?.(row)}
                      style={{
                        borderRadius: 6,
                        border: '1px solid rgba(248,152,56,.4)',
                        background: 'rgba(248,152,56,.12)',
                        padding: '6px 10px',
                        color: '#7dd3fc',
                        fontSize: 9,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Autoriser session
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
