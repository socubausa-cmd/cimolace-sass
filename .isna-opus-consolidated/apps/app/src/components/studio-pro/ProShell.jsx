/**
 * ProShell — Layout canonique "logiciel d'édition pro"
 *
 *   +----------------------------------------------------+
 *   |                 ProTopBar                          |
 *   +------+----------------------------------+----------+
 *   |      |                                  |          |
 *   | SIDE |           MAIN (viewport)        | INSPECTOR|
 *   | RAIL |                                  |          |
 *   |      |                                  |          |
 *   +------+----------------------------------+----------+
 *   |                  ProStatusBar                      |
 *   +----------------------------------------------------+
 *
 * Tout est optionnel. N'impose aucun contenu — c'est une shell pure.
 */
import React from 'react';
import { proColors, proType } from './tokens';

export function ProShell({
  topBar = null,
  sideRail = null,
  inspector = null,
  statusBar = null,
  dock = null,
  children,
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: proColors.surface0,
        color: proColors.textPrimary,
        fontFamily: proType.ui,
        fontSize: proType.base,
        overflow: 'hidden',
      }}
    >
      {/* Inject subtle pro scrollbar + keyframes once */}
      <style>{`
        @keyframes proPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        .pro-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .pro-scroll::-webkit-scrollbar-track { background: transparent; }
        .pro-scroll::-webkit-scrollbar-thumb { background: ${proColors.surface4}; border-radius: 4px; }
        .pro-scroll::-webkit-scrollbar-thumb:hover { background: ${proColors.surface5}; }
      `}</style>
      {topBar}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        {sideRail}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
            <div
              className="pro-scroll"
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                background: proColors.surface0,
                overflow: 'auto',
              }}
            >
              {children}
            </div>
            {inspector}
          </div>
          {dock}
        </div>
      </div>
      {statusBar}
    </div>
  );
}
