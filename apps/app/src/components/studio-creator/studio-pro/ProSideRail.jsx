/**
 * ProSideRail — Rail vertical d'icônes type Premiere Pro / DaVinci (onglets latéraux).
 */
import React from 'react';
import { proColors, proRadii, proSize, proType } from './tokens';

export function ProSideRail({ items, activeId, onSelect, width = proSize.sideRailWidth }) {
  return (
    <div
      style={{
        width,
        flexShrink: 0,
        background: proColors.surface1,
        borderRight: `1px solid ${proColors.border}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 0',
        gap: 4,
        overflowY: 'auto',
        scrollbarWidth: 'none',
      }}
    >
      {items.map((item, index) => {
        if (item.divider) {
          return (
            <div
              key={`divider-${index}`}
              style={{
                width: '60%',
                height: 1,
                background: proColors.border,
                margin: '6px 0',
              }}
            />
          );
        }
        const isActive = item.id === activeId;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect?.(item.id, item)}
            title={item.label}
            aria-label={item.label}
            style={{
              width: 42,
              height: 42,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              background: isActive ? proColors.accentSoft : 'transparent',
              border: `1px solid ${isActive ? proColors.borderAccent : 'transparent'}`,
              borderRadius: proRadii.sm,
              color: isActive ? proColors.accent : proColors.textSecondary,
              cursor: 'pointer',
              transition: 'background 120ms, color 120ms, border-color 120ms',
              position: 'relative',
              fontFamily: proType.ui,
            }}
            onMouseEnter={(e) => {
              if (isActive) return;
              e.currentTarget.style.background = proColors.surface2;
              e.currentTarget.style.color = proColors.textPrimary;
            }}
            onMouseLeave={(e) => {
              if (isActive) return;
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = proColors.textSecondary;
            }}
          >
            {isActive && (
              <span
                style={{
                  position: 'absolute',
                  left: -1,
                  top: 8,
                  bottom: 8,
                  width: 2,
                  borderRadius: 1,
                  background: proColors.accent,
                }}
              />
            )}
            {Icon && <Icon size={18} strokeWidth={1.75} />}
            {item.shortLabel && (
              <span
                style={{
                  fontSize: 9,
                  letterSpacing: proType.tracking.caps,
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                {item.shortLabel}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
