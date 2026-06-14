import React from 'react';
import { cn } from '@/lib/utils';
import { isNativeRuntime } from '@/lib/nativeCapabilities';
import { EV_BG } from '@/pages/school/eleve-mobile/eleveMobileScreensShared';

/** Même atmosphère que les écrans `EleveMobileShell` (Agenda, Accueil, etc.). */
const PAGE_AMBIENT =
  'radial-gradient(50% 32% at 50% 0%, rgba(123, 97, 255, 0.14), transparent 70%)';

/**
 * Barre d'état iOS (maquette) — utile en navigateur. Sur app Capacitor, la vraie status bar
 * système suffit : on ne duplique pas l'heure / signaux.
 */
export function LiriStatusBar() {
  if (isNativeRuntime()) return null;
  return (
    <div
      className="flex h-[28px] items-center justify-between px-1 text-[14px] font-semibold text-white/95"
      aria-hidden
    >
      <span className="pl-1">9:41</span>
      <div className="flex items-center gap-1.5 pr-0.5">
        <svg width="19" height="12" viewBox="0 0 19 12" className="text-white" fill="currentColor">
          <rect x="1" y="8" width="3" height="3" rx="0.6" />
          <rect x="5.5" y="6" width="3" height="5" rx="0.6" />
          <rect x="10" y="3.5" width="3" height="7.5" rx="0.6" />
          <rect x="14.5" y="0.5" width="3" height="10" rx="0.6" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" className="text-white" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <path d="M8 9.5v.5" />
          <path d="M3.5 6.5a6.5 6.5 0 0 1 9 0" />
          <path d="M1 4a9.5 9.5 0 0 1 14 0" />
        </svg>
        <svg width="27" height="12" viewBox="0 0 27 12" className="text-white" fill="currentColor">
          <rect x="1" y="1" width="21" height="10" rx="2.2" fill="none" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.9" />
          <rect x="2.2" y="2.1" width="16" height="7.7" rx="1.2" fill="currentColor" fillOpacity="0.98" />
          <path d="M23.5 3.2h1.1c0.4 0 0.7 0.3 0.7 0.5v3.3c0 0.2-0.3 0.5-0.7 0.5h-1.1" fill="currentColor" fillOpacity="0.55" />
        </svg>
      </div>
    </div>
  );
}

/**
 * Conteneur connexion / live satellite — fond aligné `EV_BG` + halo LIRI.
 * `backgroundColor` optionnel (rare) pour un écran qui doit différer.
 */
export function EleveConnectionLayout({ children, className, backgroundColor = EV_BG }) {
  return (
    <div
      className={cn('relative flex min-h-[100dvh] flex-col overflow-y-auto', className)}
      style={{
        backgroundColor,
        backgroundImage: PAGE_AMBIENT,
      }}
    >
      <div className="pt-[max(0.5rem,env(safe-area-inset-top))]">
        <LiriStatusBar />
      </div>
      {children}
      <div
        className="mx-auto mt-auto h-1 w-[28%] min-w-[96px] max-w-[130px] rounded-full bg-white/30"
        style={{ marginBottom: 'max(8px, env(safe-area-inset-bottom, 0px))' }}
        aria-hidden
      />
    </div>
  );
}
