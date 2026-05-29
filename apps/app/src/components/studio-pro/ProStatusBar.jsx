/**
 * ProStatusBar — Barre de statut bas (DaVinci/Premiere-like)
 * Affiche : projet actif, statut connexion, timer, zoom, etc.
 */
import React from 'react';
import { proColors, proSize, proType } from './tokens';

export function ProStatusBar({ left, center, right }) {
  return (
    <div
      style={{
        height: proSize.statusBarHeight,
        minHeight: proSize.statusBarHeight,
        background: proColors.surface1,
        borderTop: `1px solid ${proColors.border}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        fontSize: proType.xxs,
        fontFamily: proType.ui,
        letterSpacing: '0.04em',
        color: proColors.textMuted,
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{left}</div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>{center}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{right}</div>
    </div>
  );
}

export function ProStatusItem({ label, value, tone = 'default', icon: Icon }) {
  const color =
    tone === 'ok' ? proColors.ok :
    tone === 'warn' ? proColors.warn :
    tone === 'error' ? proColors.error :
    tone === 'info' ? proColors.info :
    proColors.textSecondary;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {Icon ? <Icon size={10} strokeWidth={2} style={{ color }} /> : null}
      {label && (
        <span style={{ color: proColors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </span>
      )}
      <span style={{ color }}>{value}</span>
    </span>
  );
}
