/**
 * ProTopBar — Barre supérieure type DaVinci (menu, workspace switcher, actions à droite).
 */
import React from 'react';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import activeTenantConfig from '@/lib/tenant/activeTenantConfig';
import { proColors, proRadii, proSize, proShadow, proType } from './tokens';

// Marque blanche : sur le domaine d'un tenant (ex. prorascience.org), la barre Studio
// porte le nom du tenant et n'expose JAMAIS « LIRI » ; sur l'hôte produit LIRI
// (liri.cimolace.space) elle garde le wordmark LIRI. activeTenantConfig = résolu par l'hôte.
const PROBAR_IS_TENANT = !!(activeTenantConfig && activeTenantConfig.slug);
const PROBAR_BRAND =
  (activeTenantConfig && activeTenantConfig.branding && activeTenantConfig.branding.name) || 'LIRI';

/** @param {object} props
 *  @param {React.ReactNode} [props.logo] — défaut : wordmark LIRI seul ; sinon ex. mot « Studio » à côté */
export function ProTopBar({ left, center, right, logo }) {
  return (
    <div
      style={{
        height: proSize.topBarHeight,
        minHeight: proSize.topBarHeight,
        background: proColors.surface1,
        borderBottom: `1px solid ${proColors.border}`,
        boxShadow: proShadow.toolbar,
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        gap: 14,
        fontFamily: proType.ui,
        color: proColors.textPrimary,
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingRight: 10,
          borderRight: `1px solid ${proColors.border}`,
          height: '100%',
        }}
      >
        {logo != null ? logo : (
          PROBAR_IS_TENANT ? (
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.01em', color: '#e8e0d8' }}>
              {PROBAR_BRAND}
            </span>
          ) : (
            <LiriWordmark size="compact" className="text-[#e8e0d8]" />
          )
        )}
      </div>
      {left && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{left}</div>}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>{center}</div>
      {right && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{right}</div>}
    </div>
  );
}

/** Bouton de menu de la barre supérieure ("Fichier", "Édition", ...) */
export function ProMenuButton({ label, onClick, active = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 26,
        padding: '0 10px',
        background: active ? proColors.surface3 : 'transparent',
        border: 'none',
        borderRadius: proRadii.sm,
        color: active ? proColors.textPrimary : proColors.textSecondary,
        fontSize: proType.sm,
        fontFamily: proType.ui,
        cursor: 'pointer',
        transition: 'background 120ms, color 120ms',
      }}
      onMouseEnter={(e) => {
        if (active) return;
        e.currentTarget.style.background = proColors.surface2;
        e.currentTarget.style.color = proColors.textPrimary;
      }}
      onMouseLeave={(e) => {
        if (active) return;
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = proColors.textSecondary;
      }}
    >
      {label}
    </button>
  );
}

/** Segmented "workspace switcher" (Edit / Cut / Color / Deliver style) */
export function ProWorkspaceSwitcher({ items, activeId, onChange }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        background: proColors.surface0,
        border: `1px solid ${proColors.border}`,
        borderRadius: proRadii.sm,
        padding: 2,
        gap: 2,
      }}
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange?.(item.id)}
            style={{
              height: 26,
              padding: '0 12px',
              background: isActive ? proColors.surface3 : 'transparent',
              border: 'none',
              borderRadius: proRadii.xs,
              color: isActive ? proColors.accent : proColors.textSecondary,
              fontSize: proType.xs,
              fontWeight: 600,
              letterSpacing: proType.tracking.caps,
              textTransform: 'uppercase',
              fontFamily: proType.ui,
              cursor: 'pointer',
              transition: 'background 120ms, color 120ms',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
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
            {item.icon ? <item.icon size={12} strokeWidth={1.75} /> : null}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** Pastille REC / état live — placée à droite */
export function ProRecPill({ state = 'idle', label }) {
  const isLive = state === 'live';
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 22,
        padding: '0 8px',
        borderRadius: proRadii.pill,
        background: isLive ? 'rgba(224,75,63,0.14)' : proColors.surface3,
        border: `1px solid ${isLive ? 'rgba(224,75,63,0.45)' : proColors.border}`,
        color: isLive ? '#F87171' : proColors.textSecondary,
        fontSize: proType.xs,
        fontWeight: 600,
        letterSpacing: proType.tracking.caps,
        textTransform: 'uppercase',
        fontFamily: proType.ui,
        userSelect: 'none',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: isLive ? proColors.rec : proColors.textMuted,
          boxShadow: isLive ? '0 0 8px rgba(224,75,63,0.6)' : 'none',
          animation: isLive ? 'proPulse 1.4s infinite' : 'none',
        }}
      />
      {label || (isLive ? 'Live' : 'Idle')}
    </div>
  );
}
