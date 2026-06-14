import React, { useCallback, useState } from 'react';
import { Headphones, Mic, PhoneOff, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LIVE_COMM_COPY, LIVE_COMM_LAYER } from '@/lib/liveCommLayers';
/**
 * Barre hôte : aparté WebRTC (membre sélectionné) + préécoute casque (URL audio locale).
 */
export default function LiveHostAsideAndMonitorBar({
  forumTarget,
  asideState,
  asideMode,
  startAside,
  endAside,
  monitorBus,
  disabled = false,
  /** Dans le tiroir Paramètres studio (onglet audio) : chrome allégé, sans bandeau titre dupliqué */
  embedded = false,
}) {
  const [previewUrl, setPreviewUrl] = useState('');

  const peerId = forumTarget?.id ? String(forumTarget.id) : null;
  const busy = asideState === 'connecting' || asideState === 'connected';

  const onPreview = useCallback(() => {
    const u = previewUrl.trim();
    if (!u) return;
    monitorBus.playPreviewUrl(u, 'Préécoute');
  }, [previewUrl, monitorBus]);

  return (
    <div
      className={cn(
        'pointer-events-auto flex flex-col gap-2',
        embedded
          ? 'rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-2'
          : 'rounded-lg border border-white/[0.12] bg-[#0c0a12]/95 px-3 py-2.5 shadow-xl backdrop-blur-md',
        disabled && 'opacity-40',
      )}
    >
      {!embedded ? (
        <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45">
          Routage média — aparté & préécoute
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!peerId || disabled || busy}
          onClick={() => peerId && startAside(peerId, 'audio')}
          className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/40 bg-violet-950/50 px-2.5 py-1.5 text-[11px] font-medium text-violet-100 transition-colors hover:bg-violet-900/60 disabled:cursor-not-allowed disabled:opacity-40"
          title={LIVE_COMM_COPY[LIVE_COMM_LAYER.ASIDE_AUDIO]}
        >
          <Mic className="h-3.5 w-3.5" />
          Aparté audio
        </button>
        <button
          type="button"
          disabled={!peerId || disabled || busy}
          onClick={() => peerId && startAside(peerId, 'av')}
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-950/40 px-2.5 py-1.5 text-[11px] font-medium text-amber-100 transition-colors hover:bg-amber-900/50 disabled:cursor-not-allowed disabled:opacity-40"
          title={LIVE_COMM_COPY[LIVE_COMM_LAYER.ASIDE_AV]}
        >
          <Video className="h-3.5 w-3.5" />
          Aparté A/V
        </button>
        {busy ? (
          <button
            type="button"
            onClick={() => void endAside()}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-500/45 bg-red-950/50 px-2.5 py-1.5 text-[11px] font-medium text-red-100 hover:bg-red-900/55"
          >
            <PhoneOff className="h-3.5 w-3.5" />
            Terminer
          </button>
        ) : null}
        {asideState === 'connecting' ? (
          <span className="text-[10px] text-white/50">Connexion…</span>
        ) : null}
        {asideMode ? (
          <span className="text-[10px] text-white/40">
            Mode {asideMode === 'av' ? 'audio + vidéo' : 'audio'}
          </span>
        ) : null}
      </div>

      {!peerId ? (
        <p className="text-[10px] leading-snug text-white/35">
          Sélectionnez un membre (vignette messagerie ou recherche) pour activer l'aparté.
        </p>
      ) : null}

      <div className="border-t border-white/[0.08] pt-2">
        <div className="mb-1 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-200/70">
          <Headphones className="h-3 w-3" />
          Préécoute casque (hors salle)
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="url"
            value={previewUrl}
            onChange={(e) => setPreviewUrl(e.target.value)}
            placeholder="https://… (fichier audio / stream)"
            className="min-w-[180px] flex-1 rounded border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white placeholder:text-white/30"
          />
          <button
            type="button"
            onClick={onPreview}
            disabled={!previewUrl.trim()}
            className="rounded-md bg-emerald-800/50 px-2.5 py-1 text-[11px] text-emerald-50 hover:bg-emerald-700/55 disabled:opacity-40"
          >
            Écouter
          </button>
          <button
            type="button"
            onClick={() => monitorBus.stopPreview()}
            disabled={!monitorBus.isPreviewPlaying}
            className="rounded-md border border-white/15 px-2 py-1 text-[11px] text-white/70 hover:bg-white/5 disabled:opacity-30"
          >
            Stop
          </button>
          <label className="flex items-center gap-1 text-[10px] text-white/50">
            Vol
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={monitorBus.previewVolume}
              onChange={(e) => monitorBus.setPreviewVolume(Number(e.target.value))}
              className="w-20 accent-emerald-500"
            />
          </label>
        </div>
        {monitorBus.lastPreviewLabel && monitorBus.isPreviewPlaying ? (
          <p className="mt-1 text-[10px] text-emerald-200/80">{monitorBus.lastPreviewLabel}</p>
        ) : null}
      </div>
    </div>
  );
}
