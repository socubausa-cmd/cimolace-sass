/**
 * ProPanel — Panneau de base d'un logiciel pro (DaVinci/Premiere-like).
 * Header avec titre en majuscules + actions ; body scrollable.
 */
import React from 'react';
import { proColors, proRadii, proShadow, proSize, proType } from './tokens';

export function ProPanel({
  title,
  actions = null,
  children,
  dense = false,
  noHeader = false,
  className = '',
  bodyClassName = '',
  style,
}) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: proColors.surface1,
        border: `1px solid ${proColors.border}`,
        borderRadius: proRadii.md,
        boxShadow: proShadow.panel,
        color: proColors.textPrimary,
        fontFamily: proType.ui,
        overflow: 'hidden',
        ...(style || {}),
      }}
    >
      {!noHeader && (
        <div
          style={{
            height: proSize.panelHeaderHeight,
            minHeight: proSize.panelHeaderHeight,
            background: proColors.surface2,
            borderBottom: `1px solid ${proColors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 10px',
            userSelect: 'none',
          }}
        >
          <span
            style={{
              fontSize: proType.xs,
              fontWeight: 600,
              letterSpacing: proType.tracking.label,
              textTransform: 'uppercase',
              color: proColors.textSecondary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </span>
          {actions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{actions}</div>
          )}
        </div>
      )}
      <div
        className={bodyClassName}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: dense ? 6 : 10,
          fontSize: proType.base,
          color: proColors.textPrimary,
          scrollbarWidth: 'thin',
          scrollbarColor: `${proColors.surface4} transparent`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Petit bouton d'action à placer dans le header du panneau (24×22). */
export function ProPanelAction({ icon: Icon, label, onClick, active = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      style={{
        width: 22,
        height: 22,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: proRadii.xs,
        background: active ? proColors.accentSoft : 'transparent',
        border: `1px solid ${active ? proColors.borderAccent : 'transparent'}`,
        color: active ? proColors.accent : proColors.textSecondary,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 120ms, color 120ms, border-color 120ms',
      }}
      onMouseEnter={(e) => {
        if (disabled || active) return;
        e.currentTarget.style.background = proColors.surface3;
        e.currentTarget.style.color = proColors.textPrimary;
      }}
      onMouseLeave={(e) => {
        if (disabled || active) return;
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = proColors.textSecondary;
      }}
    >
      {Icon ? <Icon size={14} strokeWidth={1.75} /> : null}
    </button>
  );
}
