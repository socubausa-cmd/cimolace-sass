import React, { useState } from 'react';
import { Track } from 'livekit-client';
import { Menu, Network, Sparkles } from 'lucide-react';
import LiveHostVideoCell from '@/components/liri/live-room/LiveHostVideoCell';
import LiriMobileMeshControlShell from '@/components/liri/live-room/LiriMobileMeshControlShell';
import { cn } from '@/lib/utils';
import {
  MOBILE_LIVE_AUTHORITY_WIDTH,
  MOBILE_LIVE_AUTHORITY_TEACHER_ZONE,
} from '@/lib/smartboardDesignCanvas';

/**
 * Coque invité mobile — inspiration « feed social » (plein cadre, rail d'action à droite,
 * dégradés, zone formateur en incrustation) + feuille Control Mesh.
 * Si `active` est false, rend uniquement `children`.
 */
export default function LiveGuestMobileAuthorityShell({
  active = false,
  children,
  sessionTitle = '',
  currentSlide = 1,
  totalSlides = 1,
  hostLiveKitParticipant = null,
  liveKitMediaEpoch = 0,
  onOpenSessionMenu,
  onOpenLongiaPanel,
  onMeshRequestControl,
  onMeshRequestJoykit,
  canUseJoyKit = true,
  joyKitGrant = null,
  meshStatusLine = '',
  className,
}) {
  const [meshOpen, setMeshOpen] = useState(false);

  if (!active) {
    return <>{children}</>;
  }

  const showVid =
    hostLiveKitParticipant
    && Array.from(hostLiveKitParticipant.videoTrackPublications?.values?.() || []).some(
      (p) => p.source === Track.Source.Camera && !p.isMuted && p.track,
    );

  const z = MOBILE_LIVE_AUTHORITY_TEACHER_ZONE;
  const total = Math.max(1, totalSlides);
  const cur = Math.min(Math.max(1, currentSlide), total);
  const progress = Math.min(100, Math.max(0, (cur / total) * 100));

  return (
    <div
      data-lh-guest-mobile-authority="1"
      data-lh-guest-tiktok-shell="1"
      className={cn(
        'relative flex min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden bg-black',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-36 bg-gradient-to-b from-black/90 via-black/50 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-32 bg-gradient-to-t from-black/85 via-black/40 to-transparent"
        aria-hidden
      />

      <div
        className="relative z-40 flex shrink-0 items-center justify-between gap-2 px-3 pb-1"
        style={{ paddingTop: 'max(6px, env(safe-area-inset-top, 0px))' }}
      >
        <button
          type="button"
          onClick={onOpenSessionMenu}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-white/90 shadow-lg backdrop-blur-md transition active:scale-95"
          aria-label="Menu session"
        >
          <Menu className="h-5 w-5" strokeWidth={2.2} />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 px-1">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500/70 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
          <p className="truncate text-center text-[13px] font-semibold leading-tight text-white/95">
            {sessionTitle || 'Session LIRI'}
          </p>
        </div>
        <div className="h-10 w-10 shrink-0" aria-hidden />
      </div>

      {totalSlides > 1 ? (
        <div
          className="relative z-10 mx-3 mb-1 h-0.5 shrink-0 overflow-hidden rounded-full bg-white/10"
          style={{ maxWidth: MOBILE_LIVE_AUTHORITY_WIDTH }}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 z-0 flex min-h-0 flex-col">{children}</div>

        <div
          className="absolute z-20 overflow-hidden rounded-2xl border-2 border-white/25 bg-black/40 shadow-[0_12px_40px_rgba(0,0,0,.5)] ring-2 ring-amber-400/15"
          style={{
            right: 10,
            top: 8,
            width: z.width,
            height: z.h,
            boxShadow: '0 0 0 1px rgba(255,255,255,0.12), 0 16px 50px rgba(0,0,0,.55)',
          }}
        >
          {showVid && hostLiveKitParticipant ? (
            <LiveHostVideoCell
              participant={hostLiveKitParticipant}
              mediaEpoch={liveKitMediaEpoch}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-900" aria-hidden />
          )}
        </div>

        <div
          className="absolute bottom-6 right-1.5 z-40 flex flex-col items-center gap-5"
          style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <button
            type="button"
            onClick={() => setMeshOpen(true)}
            className="group flex h-12 w-12 flex-col items-center justify-center"
            aria-label="Control Mesh"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-400/35 bg-[#0c1018]/90 text-amber-200 shadow-lg backdrop-blur-md transition group-active:scale-95 group-hover:border-amber-300/50">
              <Network className="h-5 w-5" strokeWidth={2.2} />
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenLongiaPanel}
            className="group flex h-12 w-12 flex-col items-center justify-center"
            aria-label="LONGIA"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/35 bg-[#120818]/90 text-amber-200 shadow-lg backdrop-blur-md transition group-active:scale-95 group-hover:border-amber-300/50">
              <Sparkles className="h-5 w-5" strokeWidth={2.2} />
            </span>
          </button>
        </div>
      </div>

      <LiriMobileMeshControlShell
        open={meshOpen}
        onOpenChange={setMeshOpen}
        onRequestControl={onMeshRequestControl}
        onRequestJoykit={onMeshRequestJoykit}
        canUseJoyKit={canUseJoyKit}
        joyKitGrant={joyKitGrant}
        statusLine={meshStatusLine}
      />
    </div>
  );
}
