import React, { useState } from 'react';
import { Hand, Clock, ShieldCheck, X, Check, Ban } from 'lucide-react';
import { LiveHostMobileBottomSheet } from './LiveHostMobileBottomSheet';

/**
 * Badges de signaux flottants côté gauche — levées de main, salle d'attente, permissions.
 * Chaque badge ouvre un bottom sheet dédié avec les actions.
 */
export function LiveHostMobileSignalBadges({
  // Levées de main
  lastHandEv,
  hostAccessRequestCount = 0,
  resolveHandRaise,
  zone3RaisedHands = [],

  // Salle d'attente
  waitingEntries = [],
  approveWaiting,
  rejectWaiting,

  // Demandes de permission
  hostPermissionRequests = [],
  resolveHostPermissionSignal,

  // JoyKit
  hostJoyKitRequests = [],
  resolveHostJoyKitSignal,

  // Participants (pour afficher les noms)
  liveParticipants = [],
}) {
  const [openSheet, setOpenSheet] = useState(null); // 'hands' | 'waiting' | 'perms'

  const handCount = zone3RaisedHands?.length ?? hostAccessRequestCount ?? 0;
  const waitingCount = waitingEntries?.length ?? 0;
  const permCount = hostPermissionRequests?.length ?? 0;

  const getParticipantName = (userId) => {
    const p = liveParticipants.find(
      (m) => m.user_id === userId || m.userId === userId || m.id === userId,
    );
    return p?.full_name || p?.displayName || p?.name || userId || '?';
  };

  const BADGE_H = 38;

  const badge = (icon, count, color, onClick) => {
    if (!count) return null;
    return (
      <button
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: BADGE_H,
          paddingLeft: 10,
          paddingRight: 12,
          borderRadius: 20,
          background: `${color}22`,
          border: `1.5px solid ${color}55`,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          cursor: 'pointer',
          color,
          fontSize: 13,
          fontWeight: 700,
          boxShadow: `0 4px 14px ${color}30`,
          WebkitTapHighlightColor: 'transparent',
          animation: 'lh-badge-pulse 2s ease-in-out infinite',
        }}
      >
        {icon}
        <span>{count}</span>
      </button>
    );
  };

  const total = handCount + waitingCount + permCount;
  if (total === 0) return null;

  return (
    <>
      {/* Badges flottants côté gauche, au-dessus de la barre bottom */}
      <div style={{
        position: 'absolute',
        left: 12,
        bottom: 100,
        zIndex: 25,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'flex-start',
      }}>
        {badge(<Hand size={16} />, handCount, '#f6ad55', () => setOpenSheet('hands'))}
        {badge(<Clock size={16} />, waitingCount, '#cca34a', () => setOpenSheet('waiting'))}
        {badge(<ShieldCheck size={16} />, permCount, '#d4a36a', () => setOpenSheet('perms'))}
      </div>

      {/* ── Sheet levées de main ───────────────────────────────────────── */}
      <LiveHostMobileBottomSheet
        isOpen={openSheet === 'hands'}
        onClose={() => setOpenSheet(null)}
        title={`Levées de main (${handCount})`}
        maxHeightVh={65}
      >
        <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {handCount === 0 && (
            <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontSize: 13, paddingTop: 20 }}>
              Aucune levée de main
            </p>
          )}
          {zone3RaisedHands?.map?.((hand, i) => {
            const userId = hand.user_id || hand.userId || hand.id || hand;
            const name = getParticipantName(userId);
            return (
              <div key={userId || i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 12,
                background: 'rgba(246,173,85,0.08)',
                border: '1px solid rgba(246,173,85,0.2)',
              }}>
                <Hand size={16} color="#f6ad55" style={{ flexShrink: 0 }} />
                <span style={{ color: '#fff', fontSize: 14, flex: 1 }}>{name}</span>
                <button
                  onClick={() => resolveHandRaise?.(userId, 'grant')}
                  style={actionBtn('#cca34a')}
                >
                  <Check size={14} />
                  <span>Micro</span>
                </button>
                <button
                  onClick={() => resolveHandRaise?.(userId, 'lower')}
                  style={actionBtn('rgba(255,255,255,0.3)')}
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </LiveHostMobileBottomSheet>

      {/* ── Sheet salle d'attente ─────────────────────────────────────── */}
      <LiveHostMobileBottomSheet
        isOpen={openSheet === 'waiting'}
        onClose={() => setOpenSheet(null)}
        title={`Salle d'attente (${waitingCount})`}
        maxHeightVh={65}
      >
        <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {waitingCount === 0 && (
            <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontSize: 13, paddingTop: 20 }}>
              Personne en attente
            </p>
          )}
          {waitingEntries?.map?.((entry, i) => {
            const userId = entry.user_id || entry.userId || entry.id;
            const name = entry.full_name || entry.displayName || entry.name || getParticipantName(userId) || '?';
            return (
              <div key={userId || i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 12,
                background: 'rgba(120,96,72,0.08)',
                border: '1px solid rgba(120,96,72,0.2)',
              }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'rgba(120,96,72,0.15)',
                  border: '1px solid rgba(120,96,72,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#cca34a',
                  fontWeight: 700,
                  fontSize: 14,
                  flexShrink: 0,
                }}>
                  {(name[0] || '?').toUpperCase()}
                </div>
                <span style={{ color: '#fff', fontSize: 14, flex: 1, fontWeight: 500 }}>{name}</span>
                <button
                  onClick={() => { approveWaiting?.(userId || entry); setOpenSheet(null); }}
                  style={actionBtn('#cca34a')}
                >
                  <Check size={14} />
                  <span>Accepter</span>
                </button>
                <button
                  onClick={() => rejectWaiting?.(userId || entry)}
                  style={actionBtn('#e53e3e')}
                >
                  <Ban size={14} />
                </button>
              </div>
            );
          })}
          {waitingCount > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                onClick={() => { waitingEntries.forEach((e) => approveWaiting?.(e.user_id || e.userId || e.id || e)); setOpenSheet(null); }}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 24,
                  background: 'rgba(120,96,72,0.15)',
                  border: '1px solid rgba(120,96,72,0.4)',
                  color: '#cca34a',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Check size={14} /> Tous accepter
              </button>
              <button
                onClick={() => { waitingEntries.forEach((e) => rejectWaiting?.(e.user_id || e.userId || e.id || e)); setOpenSheet(null); }}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 24,
                  background: 'rgba(229,62,62,0.12)',
                  border: '1px solid rgba(229,62,62,0.3)',
                  color: '#fc8181',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Ban size={14} /> Tous refuser
              </button>
            </div>
          )}
        </div>
      </LiveHostMobileBottomSheet>

      {/* ── Sheet demandes de permission ──────────────────────────────── */}
      <LiveHostMobileBottomSheet
        isOpen={openSheet === 'perms'}
        onClose={() => setOpenSheet(null)}
        title={`Demandes (${permCount})`}
        maxHeightVh={65}
      >
        <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {permCount === 0 && (
            <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontSize: 13, paddingTop: 20 }}>
              Aucune demande
            </p>
          )}
          {hostPermissionRequests?.map?.((req, i) => {
            const userId = req.user_id || req.userId;
            const name = getParticipantName(userId);
            const type = req.type || req.permission || 'accès';
            return (
              <div key={req.id || i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 12,
                background: 'rgba(234,196,159,0.08)',
                border: '1px solid rgba(234,196,159,0.2)',
              }}>
                <ShieldCheck size={16} color="#d4a36a" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: '#fff', fontSize: 14, margin: 0, fontWeight: 500 }}>{name}</p>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, margin: 0 }}>{type}</p>
                </div>
                <button
                  onClick={() => resolveHostPermissionSignal?.(req.id || req, 'grant')}
                  style={actionBtn('#d4a36a')}
                >
                  <Check size={14} />
                  <span>OK</span>
                </button>
                <button
                  onClick={() => resolveHostPermissionSignal?.(req.id || req, 'deny')}
                  style={actionBtn('rgba(255,255,255,0.3)')}
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </LiveHostMobileBottomSheet>

      <style>{`
        @keyframes lh-badge-pulse {
          0%, 100% { box-shadow: 0 0 0 0 transparent; }
          50% { box-shadow: 0 0 0 4px rgba(246,173,85,0.15); }
        }
      `}</style>
    </>
  );
}

function actionBtn(color) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 10px',
    borderRadius: 16,
    background: `${color}22`,
    border: `1px solid ${color}55`,
    color,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
    WebkitTapHighlightColor: 'transparent',
  };
}
