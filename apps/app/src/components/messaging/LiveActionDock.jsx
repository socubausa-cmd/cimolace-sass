/**
 * LiveActionDock — Mac-style magnifying dock for live session controls.
 * Extracted from MessagingPage.jsx (REQ-FE-004).
 */
import React, { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  MessageSquare, Mic, Video, MonitorUp, Sparkles,
  PhoneOff, Settings, HelpCircle, Smartphone,
} from 'lucide-react';
import { SmartboardNavigatorSceneIcon } from '@/components/liri/live-room/SmartboardNavigatorSceneIcon';
import { cn } from '@/lib/utils';

// ─── DockItem ─────────────────────────────────────────────────────────────────

function DockItem({
  mouseX,
  containerRef,
  icon,
  label,
  /** Infobulle ; par défaut = label */
  hintTitle,
  active,
  danger,
  onClick,
  disabled = false,
}) {
  const tip = hintTitle ?? label;
  const ref = useRef(null);
  const distance = useMotionValue(Infinity);

  useEffect(() => {
    const update = (x) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      distance.set(Math.abs(x - center));
    };
    const el = containerRef?.current;
    if (!el) return;
    const handler = (e) => update(e.clientX);
    const reset = () => distance.set(Infinity);
    el.addEventListener('mousemove', handler);
    el.addEventListener('mouseleave', reset);
    return () => {
      el.removeEventListener('mousemove', handler);
      el.removeEventListener('mouseleave', reset);
    };
  }, [containerRef, distance]);

  const scale = useTransform(distance, [0, 50, 100], [1.65, 1.3, 1], { clamp: true });
  const scaleSpring = useSpring(scale, { stiffness: 300, damping: 22 });

  return (
    <motion.button
      ref={ref}
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      style={{ scale: disabled ? 1 : scaleSpring, originY: 1 }}
      whileHover={disabled ? {} : { y: -4 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      className={cn(
        'flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border text-[9px] font-medium shadow-[0_10px_18px_-16px_rgba(0,0,0,0.9)] transition-colors origin-bottom',
        disabled && 'cursor-not-allowed opacity-40',
        !disabled && danger
          ? 'bg-red-500/20 border-red-400/30 text-red-200 hover:bg-red-500/30'
          : !disabled && active
            ? 'bg-[#D4AF37]/18 border-[#D4AF37]/35 text-[#D4AF37] shadow-[0_10px_24px_-12px_rgba(212,175,55,0.8)]'
            : !disabled
              ? 'bg-white/[0.05] border-white/12 text-white/75 hover:bg-white/10'
              : 'border-white/10 bg-white/[0.04] text-white/40'
      )}
      title={tip}
    >
      {icon}
      <span className="max-w-[3.25rem] truncate leading-none">{label}</span>
    </motion.button>
  );
}

// ─── LiveActionDock ───────────────────────────────────────────────────────────

export function LiveActionDock({
  liveMuted,
  liveCameraOff,
  sharingScreen,
  liveSpotlightOn,
  liveMessageUnread,
  liveMessageDrawerOpen,
  liveSettingsOpen,
  onToggleMute,
  onToggleCamera,
  onToggleShare,
  onToggleSpotlight,
  onToggleChat,
  onToggleSettings,
  onStop,
  showPhoneCompanion,
  onPhoneCompanion,
  /** Messagerie 1:1 : le fil est au centre, pas de panneau chat latéral */
  hideChatDockButton = false,
  /** Invité : NeuronQ à côté du bouton Forum */
  showNeuronQGuest = false,
  liveNeuronqModalOpen = false,
  onToggleNeuronQ,
  /** Boutons scène type joker (SmartBoard) */
  navigatorScenes = [],
  activeScene = 'diapo',
  onSelectScene,
  /** Invité : scènes pilotées par l'hôte */
  scenesLocked = false,
  /** Face-à-face : pas de SmartBoard visible — masquer les raccourcis scène */
  hideSceneNavigator = false,
}) {
  const containerRef = useRef(null);

  const chatButton = {
    icon: (
      <span className="relative inline-flex">
        <MessageSquare className="w-4 h-4" />
        {liveMessageUnread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 h-3.5 min-w-3.5 rounded-full bg-[#D4AF37] text-[8px] font-bold text-black flex items-center justify-center px-0.5">
            {liveMessageUnread > 9 ? '9+' : liveMessageUnread}
          </span>
        )}
      </span>
    ),
    label: 'Forum',
    hintTitle: liveMessageDrawerOpen
      ? 'Fermer le forum (messages publics)'
      : 'Forum live — messages publics pour toute la salle',
    active: liveMessageDrawerOpen,
    onClick: onToggleChat,
  };

  const neuronQDockButton = {
    icon: <HelpCircle className="h-4 w-4 text-amber-200/90" strokeWidth={2} />,
    label: 'NeuronQ',
    hintTitle: liveNeuronqModalOpen
      ? 'Fermer la question pour le formateur'
      : 'Poser une question — reformulation IA pour le formateur',
    active: liveNeuronqModalOpen,
    onClick: onToggleNeuronQ,
  };

  const buttons = [
    { icon: <Mic className="w-4 h-4" />, label: liveMuted ? 'Micro OFF' : 'Micro', active: liveMuted, onClick: onToggleMute },
    { icon: <Video className="w-4 h-4" />, label: liveCameraOff ? 'Cam OFF' : 'Cam', active: liveCameraOff, onClick: onToggleCamera },
    { icon: <MonitorUp className="w-4 h-4" />, label: sharingScreen ? 'Stop Écran' : 'Partager', active: sharingScreen, onClick: onToggleShare },
    ...(showPhoneCompanion
      ? [{ icon: <Smartphone className="w-4 h-4" />, label: 'QR tel.', active: false, onClick: onPhoneCompanion }]
      : []),
    { icon: <Sparkles className="w-4 h-4" />, label: 'Spotlight', active: liveSpotlightOn, onClick: onToggleSpotlight },
    ...(hideChatDockButton ? [] : [chatButton]),
    ...(showNeuronQGuest && typeof onToggleNeuronQ === 'function' ? [neuronQDockButton] : []),
    { icon: <Settings className="w-4 h-4" />, label: 'Param', active: liveSettingsOpen, onClick: onToggleSettings },
    { icon: <PhoneOff className="w-4 h-4" />, label: 'Stop', danger: true, onClick: onStop },
  ];

  return (
    <div
      ref={containerRef}
      className="relative mb-1.5 flex flex-wrap items-end justify-center gap-x-2 gap-y-1.5 rounded-[20px] border border-white/10 bg-[#0c1425]/75 px-3 py-2 backdrop-blur-xl"
    >
      <div className="pointer-events-none absolute inset-0 rounded-[20px] bg-[radial-gradient(circle_at_50%_0%,rgba(212,175,55,0.14),transparent_42%)]" />
      {buttons.map((btn, i) => (
        <DockItem
          key={i}
          mouseX={null}
          containerRef={containerRef}
          icon={btn.icon}
          label={btn.label}
          hintTitle={btn.hintTitle}
          active={btn.active}
          danger={btn.danger}
          onClick={btn.onClick}
        />
      ))}
      {!hideSceneNavigator && navigatorScenes.length > 0 ? (
        <>
          <div className="mx-0.5 hidden h-9 w-px flex-shrink-0 self-center bg-white/15 sm:block" aria-hidden />
          <div className="flex max-w-[min(92vw,560px)] flex-shrink-0 items-end justify-center gap-1.5 overflow-x-auto overflow-y-visible py-0.5 [scrollbar-width:thin]">
            <span className="sr-only">Scènes SmartBoard</span>
            {navigatorScenes.map((scene) => (
              <DockItem
                key={scene.id}
                mouseX={null}
                containerRef={containerRef}
                icon={<SmartboardNavigatorSceneIcon sceneId={scene.id} className="h-4 w-4" />}
                label={scene.label}
                hintTitle={scene.hint ? `${scene.label} — ${scene.hint}` : scene.label}
                active={activeScene === scene.id}
                disabled={scenesLocked}
                onClick={() => onSelectScene?.(scene.id)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
