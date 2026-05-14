import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronRight,
  Headphones,
  MessageCircle,
  Shield,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useMobileLiriStore } from '@/stores/mobileLiriStore';
import { cn } from '@/lib/utils';

const panelClass =
  'fixed inset-y-0 right-0 z-[210] flex w-[min(100%,380px)] flex-col border-l border-[#D4AF37]/35 bg-[#0a0908]/98 shadow-[0_0_48px_-12px_rgba(212,175,55,0.22)] backdrop-blur-2xl';

const goldNoise =
  'bg-[linear-gradient(180deg,rgba(212,175,55,0.04)_0%,transparent_40%),radial-gradient(ellipse_at_20%_0%,rgba(212,175,55,0.07)_0%,transparent_50%)]';

/**
 * @param {{
 *   onOpenLiveSettings: () => void,
 *   liveSettings?: {
 *     muted?: boolean,
 *     onMutedChange?: (v: boolean) => void,
 *     ambientMusicEnabled?: boolean,
 *     onAmbientMusicChange?: (v: boolean) => void,
 *     subtitlesEnabled?: boolean,
 *     onSubtitlesChange?: (v: boolean) => void,
 *     soundEffectsEnabled?: boolean,
 *     onSoundEffectsChange?: (v: boolean) => void,
 *   },
 * }} props
 */
export function SettingsOverlay({ onOpenLiveSettings, liveSettings }) {
  const navigate = useNavigate();
  const closeOverlay = useMobileLiriStore((s) => s.closeOverlay);
  const openLiveForumChat = useMobileLiriStore((s) => s.openLiveForumChat);
  const openExitConfirm = useMobileLiriStore((s) => s.openExitConfirm);

  const ls = liveSettings || {};

  const [silentLocal, setSilentLocal] = useState(false);
  const [ambLocal, setAmbLocal] = useState(true);
  const [subLocal, setSubLocal] = useState(false);
  const [sfxLocal, setSfxLocal] = useState(true);

  const silent = ls.muted !== undefined ? ls.muted : silentLocal;
  const setSilent = ls.onMutedChange ?? setSilentLocal;

  const ambient = ls.ambientMusicEnabled !== undefined ? ls.ambientMusicEnabled : ambLocal;
  const setAmbient = ls.onAmbientMusicChange ?? setAmbLocal;

  const subtitles = ls.subtitlesEnabled !== undefined ? ls.subtitlesEnabled : subLocal;
  const setSubtitles = ls.onSubtitlesChange ?? setSubLocal;

  const soundFx = ls.soundEffectsEnabled !== undefined ? ls.soundEffectsEnabled : sfxLocal;
  const setSoundFx = ls.onSoundEffectsChange ?? setSfxLocal;

  const rowNav = (label, sub, Icon, onClick) => (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-[#D4AF37]/22 bg-black/30 px-3 py-3 text-left shadow-[inset_0_1px_0_0_rgba(212,175,55,0.08)] transition-colors active:bg-[#D4AF37]/[0.06]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10">
        <Icon className="h-4 w-4 text-[#D4AF37]" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-[#f5e6c8]">{label}</span>
        {sub ? <span className="mt-0.5 block text-[11px] text-[#D4AF37]/55">{sub}</span> : null}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[#D4AF37]/60" />
    </button>
  );

  const rowToggle = (label, checked, onCheckedChange) => (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#D4AF37]/22 bg-black/30 px-3 py-3 shadow-[inset_0_1px_0_0_rgba(212,175,55,0.08)]">
      <span className="text-sm font-medium text-[#f0e6d4]">{label}</span>
      <Switch checked={checked} onCheckedChange={(v) => onCheckedChange(Boolean(v))} />
    </div>
  );

  return (
    <motion.div
      initial={{ x: '105%' }}
      animate={{ x: 0 }}
      exit={{ x: '105%' }}
      transition={{ type: 'spring', damping: 32, stiffness: 360 }}
      className={cn(panelClass, goldNoise)}
      data-liri-no-doubletap
    >
      <div className="flex items-center justify-between border-b border-[#D4AF37]/20 px-4 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 shrink-0 text-[#D4AF37]" strokeWidth={1.75} />
          <h2 className="font-serif text-xl font-semibold tracking-tight text-[#D4AF37]">Paramètres</h2>
        </div>
        <button
          type="button"
          onClick={closeOverlay}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D4AF37]/25 text-[#D4AF37]/70 transition-colors hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]"
          aria-label="Fermer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <div className="space-y-2.5">
          {rowToggle('Mode silencieux', silent, setSilent)}
          {rowToggle('Musique d’ambiance', ambient, setAmbient)}
          {rowToggle('Sous-titres', subtitles, setSubtitles)}
          {rowToggle('Effets sonores', soundFx, setSoundFx)}
        </div>

        <div className="space-y-2 pt-2">
          {rowNav('Chat', null, MessageCircle, () => {
            openLiveForumChat();
          })}
          {rowNav('Notifications', 'Personnalisées', Bell, () => {
            closeOverlay();
            navigate('/settings/notifications');
          })}
          {rowNav('Sécurité', null, Shield, () => {
            closeOverlay();
            navigate('/settings/2fa');
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            onOpenLiveSettings?.();
            closeOverlay();
          }}
          className="mt-2 flex w-full items-center gap-2 rounded-2xl border border-[#D4AF37]/40 bg-[#D4AF37]/[0.08] px-4 py-3 text-left text-sm font-medium text-[#f5dd8a] shadow-[0_0_24px_-8px_rgba(212,175,55,0.35)] transition-colors active:bg-[#D4AF37]/15"
        >
          <SlidersHorizontal className="h-4 w-4 text-[#D4AF37]" />
          Réglages vidéo &amp; SmartBoard
        </button>
      </div>

      <div className="border-t border-[#D4AF37]/20 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => openExitConfirm()}
          className="w-full rounded-2xl border-2 border-[#D4AF37]/50 bg-transparent py-3.5 text-center font-serif text-sm font-semibold text-[#D4AF37] shadow-[0_0_28px_-10px_rgba(212,175,55,0.45)] transition-colors active:bg-[#D4AF37]/10"
        >
          Quitter le cours
        </button>
        <button
          type="button"
          onClick={() => {
            closeOverlay();
            navigate('/support');
          }}
          className="mt-4 flex w-full items-center justify-center gap-2 text-xs font-medium text-[#D4AF37]/75 transition-colors hover:text-[#D4AF37]"
        >
          <Headphones className="h-4 w-4" />
          Assistance
        </button>
      </div>
    </motion.div>
  );
}
