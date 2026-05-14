import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, Video, MonitorUp, Sparkles, PhoneOff, PhoneOutgoing,
  ChevronLeft, ChevronRight, Users, Settings2, Link2, Check,
  Hand, SmilePlus, X, Maximize, Minimize, Keyboard, MessageSquare,
  Layers, RefreshCw, MoreHorizontal, Eye,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// ─── Réactions emoji ───────────────────────────────────────────────────────────
const REACTIONS = ['👏', '❤️', '🔥', '😮', '😂', '🙏', '⚡', '✨'];

function ReactionsPopup({ onReact, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.9 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-white/15 bg-[#0c1225]/95 backdrop-blur-xl shadow-2xl"
    >
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => { onReact(emoji); onClose(); }}
          className="w-9 h-9 rounded-xl hover:bg-white/10 flex items-center justify-center text-xl transition-colors hover:scale-110"
        >
          {emoji}
        </button>
      ))}
      <button
        type="button"
        onClick={onClose}
        className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center ml-1"
      >
        <X className="w-3 h-3 text-white/40" />
      </button>
    </motion.div>
  );
}

// ─── Floating emoji burst (réaction visuelle) ─────────────────────────────────
function ReactionBurst({ bursts }) {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 pointer-events-none z-[300] flex flex-col-reverse items-center gap-1">
      <AnimatePresence>
        {bursts.map((b) => (
          <motion.div
            key={b.id}
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: -120, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease: 'easeOut' }}
            className="text-4xl select-none"
          >
            {b.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default function LiveControlsBar({
  // Commun
  muted,
  cameraOff,
  onToggleMuted,
  onToggleCamera,
  onOpenSettings,
  // Hôte uniquement
  isHost = false,
  sharingScreen,
  spotlight,
  onToggleShare,
  onToggleSpotlight,
  /** Lecture progressive SmartBoard (révélation pas à pas) — hôte uniquement si callback fourni */
  progressivePlayback = true,
  onToggleProgressiveReading,
  participantsOpen,
  onToggleParticipants,
  inviteUrl = '',
  slideCurrent = 1,
  slideTotal = 1,
  onPrevSlide,
  onNextSlide,
  onStopLive,
  // Élève uniquement
  handRaised = false,
  onRaiseHand,
  onLowerHand,
  onSendReaction,
  onLeave,
  // Mode Cinéma
  cinemaMode = false,
  onToggleCinema,
  /** Forum live (tiroir public) — optionnel */
  forumDrawerOpen = false,
  forumUnreadCount = 0,
  onToggleForum,
  /** Dock bas type maquette LIRI hôte (pilule large, champ instruction, STOP) */
  premiumHostDock = false,
  /** Envoi depuis le champ « instruction » (ex. forum hôte) */
  onHostInstructionSubmit,
  instructionSending = false,
  /** Actualiser la vue / données (optionnel) */
  onHostDockRefresh,
  /** Arena / barre compacte : ligne sous les actions — navigateur de scènes SmartBoard horizontal */
  footerSceneDock,
  /** Arena hôte : ouvrir le modal d’aperçu mobile / projecteur */
  onOpenLayoutPreview,
}) {
  const [copied, setCopied] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [bursts, setBursts] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [hostDockMoreOpen, setHostDockMoreOpen] = useState(false);
  const [instructionDraft, setInstructionDraft] = useState('');
  const hostDockMoreRef = useRef(null);
  const burstId = useRef(0);

  useEffect(() => {
    if (!hostDockMoreOpen) return undefined;
    const close = (e) => {
      if (hostDockMoreRef.current && !hostDockMoreRef.current.contains(e.target)) {
        setHostDockMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [hostDockMoreOpen]);

  const submitInstruction = useCallback(() => {
    const t = instructionDraft.trim();
    if (!t || instructionSending) return;
    onHostInstructionSubmit?.(t);
    setInstructionDraft('');
  }, [instructionDraft, instructionSending, onHostInstructionSubmit]);

  // ── Fullscreen API ──────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    if (!shortcutsOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setShortcutsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcutsOpen]);

  const copyInviteLink = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };

  const handleReact = (emoji) => {
    onSendReaction?.(emoji);
    const id = ++burstId.current;
    setBursts((prev) => [...prev, { id, emoji }]);
    setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), 1800);
  };

  return (
    <>
      <ReactionBurst bursts={bursts} />

      {shortcutsOpen && (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="live-shortcuts-title"
          onClick={() => setShortcutsOpen(false)}
        >
          <div
            className="max-w-md w-full rounded-2xl border border-white/15 bg-[#0c1225]/96 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center gap-3 mb-4">
              <h2 id="live-shortcuts-title" className="text-sm font-semibold text-white">
                Raccourcis clavier
              </h2>
              <button
                type="button"
                onClick={() => setShortcutsOpen(false)}
                className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/10"
                aria-label="Fermer l’aide raccourcis"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ul className="text-[11px] text-white/80 space-y-2.5 leading-relaxed">
              <li>
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 font-mono text-[10px]">F</kbd>
                {' '}— Mode cinéma / plein écran (hors champ de saisie)
              </li>
              {isHost ? (
                <>
                  <li>
                    <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 font-mono text-[10px]">←</kbd>
                    {' / '}
                    <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 font-mono text-[10px]">→</kbd>
                    {' '}— Diapositive précédente / suivante (vue diapo)
                  </li>
                  <li>Molette sur l&apos;écran intelligent — diapos (hôte, vue diapo)</li>
                  <li>
                    <kbd className="px-1 py-0.5 rounded bg-white/10 border border-white/15 font-mono text-[9px]">Alt</kbd>
                    {' + '}
                    <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 font-mono text-[10px]">←</kbd>
                    {' / '}
                    <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 font-mono text-[10px]">→</kbd>
                    {' '}— Scènes Smart Board (hôte)
                  </li>
                </>
              ) : (
                <li className="text-white/60">Diapos et scènes suivent l&apos;hôte en temps réel.</li>
              )}
            </ul>
          </div>
        </div>
      )}

      <div
        className={cn(
          'absolute bottom-4 z-40 flex justify-center px-2',
          premiumHostDock && isHost ? 'left-0 right-0' : 'left-1/2 -translate-x-1/2',
        )}
      >
        <AnimatePresence>
          {showReactions && (
            <ReactionsPopup onReact={handleReact} onClose={() => setShowReactions(false)} />
          )}
        </AnimatePresence>

        {premiumHostDock && isHost ? (
          <div className="relative flex w-full max-w-[min(98vw,1180px)] flex-col items-stretch gap-2 rounded-[14px] border border-white/[0.08] bg-[rgba(6,7,18,0.88)] px-2 py-2 shadow-[0_8px_40px_-20px_rgba(124,58,237,0.25),0_4px_28px_-16px_rgba(251,191,36,0.12)] backdrop-blur-xl">
            <div className="flex min-h-[52px] w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3 sm:py-0 sm:pl-1 sm:pr-0.5">
            <div className="flex shrink-0 flex-wrap items-center gap-0.5 sm:flex-nowrap">
              <button
                type="button"
                onClick={onToggleMuted}
                className={cn('h-9 w-9 rounded-full transition-colors', muted ? 'bg-red-500/30 text-red-100' : 'text-white/88 hover:bg-white/10')}
                title={muted ? 'Réactiver micro' : 'Couper micro'}
                aria-pressed={muted}
              >
                <Mic className="mx-auto h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onToggleCamera}
                className={cn('h-9 w-9 rounded-full transition-colors', cameraOff ? 'bg-red-500/30 text-red-100' : 'text-white/88 hover:bg-white/10')}
                title={cameraOff ? 'Réactiver caméra' : 'Couper caméra'}
                aria-pressed={cameraOff}
              >
                <Video className="mx-auto h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="h-9 w-9 rounded-full text-white/88 transition-colors hover:bg-white/10"
                title="Paramètres caméra / micro"
              >
                <Settings2 className="mx-auto h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => { onToggleParticipants?.(); setHostDockMoreOpen(false); }}
                className={cn(
                  'h-9 w-9 rounded-full transition-colors',
                  participantsOpen ? 'bg-violet-500/25 text-violet-100' : 'text-white/88 hover:bg-white/10',
                )}
                title={participantsOpen ? 'Revenir au pilotage cours' : 'Membres & sièges'}
                aria-pressed={Boolean(participantsOpen)}
              >
                <Users className="mx-auto h-4 w-4" />
              </button>
              {typeof onHostDockRefresh === 'function' ? (
                <button
                  type="button"
                  onClick={() => { onHostDockRefresh(); setHostDockMoreOpen(false); }}
                  className="h-9 w-9 rounded-full text-white/88 transition-colors hover:bg-white/10"
                  title="Actualiser"
                >
                  <RefreshCw className="mx-auto h-4 w-4" />
                </button>
              ) : null}
              {typeof onOpenLayoutPreview === 'function' ? (
                <button
                  type="button"
                  onClick={() => { onOpenLayoutPreview(); setHostDockMoreOpen(false); }}
                  className="h-9 w-9 rounded-full text-white/88 transition-colors hover:bg-white/10"
                  title="Aperçu vue mobile et projecteur"
                >
                  <Eye className="mx-auto h-4 w-4" />
                </button>
              ) : null}
              <div className="relative" ref={hostDockMoreRef}>
                <button
                  type="button"
                  onClick={() => setHostDockMoreOpen((v) => !v)}
                  className={cn(
                    'h-9 w-9 rounded-full transition-colors',
                    hostDockMoreOpen ? 'bg-[#D4AF37]/20 text-[#f5dd8a]' : 'text-white/88 hover:bg-white/10',
                  )}
                  title="Plus d’actions"
                >
                  <MoreHorizontal className="mx-auto h-4 w-4" />
                </button>
                {hostDockMoreOpen ? (
                  <div className="absolute bottom-full left-0 z-[60] mb-2 w-52 overflow-hidden rounded-2xl border border-white/12 bg-[#0c1018]/96 py-1 shadow-2xl backdrop-blur-xl">
                    <button
                      type="button"
                      onClick={() => { onToggleShare(); setHostDockMoreOpen(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-white/85 hover:bg-white/[0.06]"
                    >
                      <MonitorUp className="h-3.5 w-3.5 shrink-0" />
                      {sharingScreen ? 'Arrêter écran' : 'Partager écran'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { onToggleSpotlight(); setHostDockMoreOpen(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-white/85 hover:bg-white/[0.06]"
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      Spotlight
                    </button>
                    {onToggleProgressiveReading ? (
                      <button
                        type="button"
                        onClick={() => { onToggleProgressiveReading(); setHostDockMoreOpen(false); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-white/85 hover:bg-white/[0.06]"
                      >
                        <Layers className="h-3.5 w-3.5 shrink-0" />
                        Lecture progressive
                      </button>
                    ) : null}
                    {inviteUrl ? (
                      <button
                        type="button"
                        onClick={() => { copyInviteLink(); setHostDockMoreOpen(false); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-white/85 hover:bg-white/[0.06]"
                      >
                        <Link2 className="h-3.5 w-3.5 shrink-0" />
                        {copied ? 'Lien copié' : 'Copier invitation'}
                      </button>
                    ) : null}
                    {typeof onToggleForum === 'function' ? (
                      <button
                        type="button"
                        onClick={() => { onToggleForum(); setHostDockMoreOpen(false); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-white/85 hover:bg-white/[0.06]"
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                        Forum live
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => { (onToggleCinema ?? toggleFullscreen)(); setHostDockMoreOpen(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-white/85 hover:bg-white/[0.06]"
                    >
                      {cinemaMode || isFullscreen ? (
                        <Minimize className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <Maximize className="h-3.5 w-3.5 shrink-0" />
                      )}
                      {cinemaMode ? 'Quitter cinéma' : 'Mode cinéma'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShortcutsOpen(true); setHostDockMoreOpen(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-white/85 hover:bg-white/[0.06]"
                    >
                      <Keyboard className="h-3.5 w-3.5 shrink-0" />
                      Raccourcis
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            <input
              type="text"
              value={instructionDraft}
              onChange={(e) => setInstructionDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitInstruction();
                }
              }}
              placeholder="Écrire une question ou une instruction…"
              disabled={instructionSending || typeof onHostInstructionSubmit !== 'function'}
              className="min-h-9 min-w-0 w-full flex-1 rounded-full border border-white/10 bg-black/45 px-4 text-xs text-white placeholder:text-white/35 focus:border-[#D4AF37]/45 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/25 disabled:cursor-not-allowed disabled:opacity-45"
            />
            <div className="flex shrink-0 items-center justify-between gap-0.5 sm:justify-start">
              <button
                type="button"
                onClick={onPrevSlide}
                className="h-9 w-9 rounded-full text-white/80 transition-colors hover:bg-white/10"
                title="Diapositive précédente"
              >
                <ChevronLeft className="mx-auto h-4 w-4" />
              </button>
              <span className="min-w-[3.25rem] px-1 text-center text-xs font-semibold tabular-nums text-[#E8D5A3]">
                {String(slideCurrent).padStart(2, '0')} / {String(slideTotal).padStart(2, '0')}
              </span>
              <button
                type="button"
                onClick={onNextSlide}
                className="h-9 w-9 rounded-full text-white/80 transition-colors hover:bg-white/10"
                title="Diapositive suivante"
              >
                <ChevronRight className="mx-auto h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onStopLive}
                className="ml-1 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-red-400/50 bg-gradient-to-b from-red-500/95 to-red-700/90 px-4 text-xs font-bold uppercase tracking-wide text-white shadow-[0_0_20px_-4px_rgba(239,68,68,0.55)] transition hover:from-red-500 hover:to-red-600"
                title="Arrêter le live"
              >
                <PhoneOff className="h-3.5 w-3.5" />
                Stop
              </button>
            </div>
            </div>
            {footerSceneDock ? (
              <div className="w-full min-w-0 pb-0.5">{footerSceneDock}</div>
            ) : null}
          </div>
        ) : (
        <div className="flex w-full max-w-[min(98vw,1180px)] flex-col items-stretch gap-1">
        <div className="mx-auto h-12 max-w-[96vw] overflow-x-auto px-2.5 rounded-full border border-white/20 bg-[#11183a]/72 backdrop-blur-xl inline-flex items-center gap-1.5 shadow-[0_15px_46px_-30px_rgba(88,118,255,0.95)]">

          {/* ── Commun : Micro + Caméra + Settings ── */}
          <button
            type="button"
            onClick={onToggleMuted}
            className={cn('h-8 w-8 rounded-full', muted ? 'bg-red-500/25 text-red-200' : 'text-white/85 hover:bg-white/10')}
            title={muted ? 'Réactiver micro' : 'Couper micro'}
            aria-label={muted ? 'Réactiver le microphone' : 'Couper le microphone'}
            aria-pressed={muted}
          >
            <Mic className="w-4 h-4 mx-auto" />
          </button>
          <button
            type="button"
            onClick={onToggleCamera}
            className={cn('h-8 w-8 rounded-full', cameraOff ? 'bg-red-500/25 text-red-200' : 'text-white/85 hover:bg-white/10')}
            title={cameraOff ? 'Réactiver caméra' : 'Couper caméra'}
            aria-label={cameraOff ? 'Réactiver la caméra' : 'Couper la caméra'}
            aria-pressed={cameraOff}
          >
            <Video className="w-4 h-4 mx-auto" />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="h-8 w-8 rounded-full text-white/85 hover:bg-white/10"
            title="Choisir caméra / micro"
            aria-label="Paramètres caméra et micro"
          >
            <Settings2 className="w-4 h-4 mx-auto" />
          </button>
          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            className="h-8 w-8 rounded-full text-white/85 hover:bg-white/10"
            title="Raccourcis clavier"
            aria-label="Afficher les raccourcis clavier"
          >
            <Keyboard className="w-4 h-4 mx-auto" />
          </button>

          {typeof onToggleForum === 'function' ? (
            <button
              type="button"
              onClick={onToggleForum}
              className={cn(
                'h-8 px-2 sm:px-2.5 rounded-full text-xs inline-flex items-center gap-1.5 transition-colors',
                forumDrawerOpen
                  ? 'bg-[#D4AF37]/22 text-[#D4AF37] border border-[#D4AF37]/35'
                  : 'text-white/85 hover:bg-white/10 border border-transparent',
              )}
              title={forumDrawerOpen ? 'Fermer le forum' : 'Forum live — messages publics'}
              aria-pressed={forumDrawerOpen}
              aria-label={forumDrawerOpen ? 'Fermer le forum live' : 'Ouvrir le forum live'}
            >
              <span className="relative inline-flex">
                <MessageSquare className="w-4 h-4" />
                {forumUnreadCount > 0 && !forumDrawerOpen ? (
                  <span className="absolute -top-1.5 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#D4AF37] px-0.5 text-[8px] font-bold text-black">
                    {forumUnreadCount > 9 ? '9+' : forumUnreadCount}
                  </span>
                ) : null}
              </span>
              <span className="hidden min-[380px]:inline font-medium">Forum</span>
            </button>
          ) : null}

          <div className="w-px h-5 bg-white/15 mx-0.5" />

          {isHost ? (
            /* ── Contrôles HÔTE ── */
            <>
              <button
                type="button"
                onClick={onToggleShare}
                className={cn('h-8 w-8 rounded-full text-white/85 hover:bg-white/10', sharingScreen && 'bg-[#D4AF37]/20 text-[#D4AF37]')}
                title={sharingScreen ? 'Arrêter partage écran' : 'Partager écran'}
              >
                <MonitorUp className="w-4 h-4 mx-auto" />
              </button>
              <button
                type="button"
                onClick={() => onToggleParticipants?.()}
                className={cn('h-8 w-8 rounded-full text-white/85 hover:bg-white/10', participantsOpen && 'bg-[#D4AF37]/20 text-[#D4AF37]')}
                title={
                  participantsOpen
                    ? 'Afficher le plan de cours (mindmap, script, caméra)'
                    : 'Membres et sièges privilégiés (remplace le panneau cours)'
                }
                aria-pressed={Boolean(participantsOpen)}
                aria-label={
                  participantsOpen
                    ? 'Revenir au panneau de pilotage du cours'
                    : 'Afficher membres et sièges privilégiés à la place du panneau cours'
                }
              >
                <Users className="w-4 h-4 mx-auto" />
              </button>

              {inviteUrl && (
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className={cn(
                    'h-8 px-2.5 rounded-full text-xs inline-flex items-center gap-1.5 transition-colors',
                    copied
                      ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/30'
                      : 'text-white/85 hover:bg-white/10 border border-transparent'
                  )}
                  title="Copier le lien d'invitation"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                  {copied ? 'Copié !' : 'Inviter'}
                </button>
              )}

              <div className="w-px h-5 bg-white/15 mx-0.5" />

              <button type="button" onClick={onPrevSlide} className="h-8 w-8 rounded-full text-white/85 hover:bg-white/10" title="Slide précédente">
                <ChevronLeft className="w-4 h-4 mx-auto" />
              </button>
              <span className="px-2 text-base font-semibold text-white tabular-nums">
                {String(slideCurrent).padStart(2, '0')} / {String(slideTotal).padStart(2, '0')}
              </span>
              <button type="button" onClick={onNextSlide} className="h-8 w-8 rounded-full text-white/85 hover:bg-white/10" title="Slide suivante">
                <ChevronRight className="w-4 h-4 mx-auto" />
              </button>
              <button
                type="button"
                onClick={onToggleSpotlight}
                className={cn('h-8 px-2 rounded-full text-xs', spotlight ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'text-white/85 hover:bg-white/10')}
                title="Activer spotlight"
              >
                <Sparkles className="w-4 h-4" />
              </button>
              {onToggleProgressiveReading ? (
                <button
                  type="button"
                  onClick={onToggleProgressiveReading}
                  className={cn(
                    'h-8 px-2 rounded-full text-xs inline-flex items-center gap-1',
                    progressivePlayback
                      ? 'bg-sky-500/20 text-sky-200 border border-sky-500/25'
                      : 'text-white/85 hover:bg-white/10 border border-transparent',
                  )}
                  title={
                    progressivePlayback
                      ? 'Lecture progressive : la slide se dévoile par étapes (clic). Cliquer pour afficher toute la slide d’un coup.'
                      : 'Lecture intégrale : toute la slide est visible. Cliquer pour revenir au dévoilement par étapes.'
                  }
                >
                  <Layers className="w-4 h-4" />
                  <span className="hidden min-[380px]:inline">Prog.</span>
                </button>
              ) : null}
              {/* ── Mode Cinéma (SmartBoard plein écran) ── */}
              <button
                type="button"
                onClick={onToggleCinema ?? toggleFullscreen}
                className={cn(
                  'h-8 w-8 rounded-full transition-colors',
                  (cinemaMode || isFullscreen)
                    ? 'bg-[#D4AF37]/20 text-[#D4AF37]'
                    : 'text-white/75 hover:bg-white/10'
                )}
                title={cinemaMode ? 'Quitter le mode cinéma (F)' : 'Mode cinéma — SmartBoard plein écran (F)'}
              >
                {cinemaMode
                  ? <Minimize className="w-4 h-4 mx-auto" />
                  : <Maximize className="w-4 h-4 mx-auto" />
                }
              </button>

              <button
                type="button"
                onClick={onStopLive}
                className="h-8 px-3 rounded-full bg-red-500/25 border border-red-500/35 text-red-200 hover:bg-red-500/35 text-xs inline-flex items-center gap-1.5"
                title="Arrêter le live"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                STOP
              </button>
            </>
          ) : (
            /* ── Contrôles ÉLÈVE ── */
            <>
              {/* Lever la main */}
              <button
                type="button"
                onClick={() => handRaised ? onLowerHand?.() : onRaiseHand?.()}
                className={cn(
                  'h-8 px-2.5 rounded-full text-xs inline-flex items-center gap-1.5 transition-all',
                  handRaised
                    ? 'bg-amber-500/25 border border-amber-500/40 text-amber-300'
                    : 'text-white/85 hover:bg-white/10'
                )}
                title={handRaised ? 'Baisser la main' : 'Lever la main'}
              >
                <Hand className="w-4 h-4" />
                {handRaised && <span className="text-[10px] font-medium">Levée</span>}
              </button>

              {/* Réactions */}
              <button
                type="button"
                onClick={() => setShowReactions((v) => !v)}
                className={cn(
                  'h-8 w-8 rounded-full text-white/85 hover:bg-white/10',
                  showReactions && 'bg-[#D4AF37]/20 text-[#D4AF37]'
                )}
                title="Envoyer une réaction"
              >
                <SmilePlus className="w-4 h-4 mx-auto" />
              </button>

              {/* Mode cinéma élève */}
              <button
                type="button"
                onClick={onToggleCinema ?? toggleFullscreen}
                className={cn('h-8 w-8 rounded-full transition-colors', (cinemaMode || isFullscreen) ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'text-white/75 hover:bg-white/10')}
                title={(cinemaMode || isFullscreen) ? 'Quitter le plein écran' : 'Plein écran'}
              >
                {(cinemaMode || isFullscreen) ? <Minimize className="w-4 h-4 mx-auto" /> : <Maximize className="w-4 h-4 mx-auto" />}
              </button>

              <div className="w-px h-5 bg-white/15 mx-0.5" />
              <span
                className="px-2 text-xs font-semibold text-white/85 tabular-nums max-sm:max-w-[4.5rem] max-sm:truncate"
                title="Diapositive suivie (synchronisée avec l&apos;hôte)"
              >
                {String(slideCurrent).padStart(2, '0')} / {String(slideTotal).padStart(2, '0')}
              </span>

              {/* Quitter */}
              <button
                type="button"
                onClick={onLeave}
                className="h-8 px-3 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 text-xs inline-flex items-center gap-1.5"
                title="Quitter la session"
              >
                <PhoneOutgoing className="w-3.5 h-3.5" />
                Quitter
              </button>
            </>
          )}
        </div>
        {footerSceneDock ? (
          <div className="w-full min-w-0 px-0.5 pb-0.5">{footerSceneDock}</div>
        ) : null}
        </div>
        )}
      </div>
    </>
  );
}
