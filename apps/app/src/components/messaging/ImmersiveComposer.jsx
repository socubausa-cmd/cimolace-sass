/**
 * ImmersiveComposer — message input bar for the immersive chat.
 * Supports text, images, audio recording, quick-share links,
 * live-video toggle, and auto-correction.
 * Extracted from MessagingPage.jsx (REQ-FE-004).
 */
import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, Users, Mic, Video, Settings, Send, Link2, Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { applyAutoCorrection } from '@/lib/messagingUtils';
import { UserAvatar } from './atoms';

export function ImmersiveComposer({
  onSend,
  onOpenPicker,
  selectedRecipient,
  onClearRecipient,
  onTyping,
  onToggleVideo,
  liveActive,
  liveEnabled,
  liveActionsOpen,
  onToggleLiveActions,
  liveSettingsOpen,
  onToggleLiveSettings,
  /** false = masque la rangée « Partager live / produit / … » (live immersif type arène) */
  showQuickShareLinks = true,
  /** Placeholder du champ (ex. live face-à-face) */
  messagePlaceholder,
  /** Envoi vers le forum live (barre du bas) — désactive le champ pendant l'envoi */
  forumSending = false,
  /** Séparateur lumineux type maquette au-dessus de la barre */
  immersiveLiveComposerChrome = false,
}) {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [pendingAudioSrc, setPendingAudioSrc] = useState('');
  const [pendingImageSrc, setPendingImageSrc] = useState('');
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const insertText = (snippet) => {
    const next = text ? `${text}\n${snippet}` : snippet;
    setText(next);
    onTyping?.(next);
  };

  const makeAbsolute = (path) => {
    if (typeof window === 'undefined') return path;
    return `${window.location.origin}${path}`;
  };

  const quickLinks = [
    { id: 'live',    label: 'Partager un live',    value: makeAbsolute('/classroom/live') },
    { id: 'module',  label: 'Partager un module',  value: makeAbsolute('/modules') },
    { id: 'payment', label: 'Partager paiement',   value: makeAbsolute('/paiements/tarifs') },
    { id: 'product', label: 'Partager produit',    value: makeAbsolute('/boutique') },
    { id: 'page',    label: 'Partager cette page', value: typeof window !== 'undefined' ? window.location.href : '' },
  ];

  const handleImagePick = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || '');
      setPendingImageSrc(src);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const toggleAudioRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      setRecordingSec(0);
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          const src = String(reader.result || '');
          setPendingAudioSrc(src);
          setPendingImageSrc('');
        };
        reader.readAsDataURL(blob);
        streamRef.current?.getTracks?.().forEach((t) => t.stop());
        streamRef.current = null;
      };
      rec.start();
      mediaRecorderRef.current = rec;
      streamRef.current = stream;
      setRecording(true);
    } catch {
      setRecording(false);
    }
  };

  useEffect(() => {
    if (!recording) return undefined;
    const id = setInterval(() => setRecordingSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  useEffect(() => {
    return () => {
      try {
        mediaRecorderRef.current?.stop?.();
      } catch {
        // ignore
      }
      streamRef.current?.getTracks?.().forEach((t) => t.stop());
    };
  }, []);

  const handleSend = async () => {
    const trimmed = text.trim();
    const payload =
      pendingAudioSrc
        ? `[audio]${pendingAudioSrc}`
        : pendingImageSrc
          ? `[image]${pendingImageSrc}`
          : trimmed;
    if (!payload) return;
    if (!selectedRecipient) {
      onOpenPicker?.();
      return;
    }
    const corrected =
      pendingAudioSrc || pendingImageSrc ? payload : applyAutoCorrection(payload);
    const sent = await onSend(corrected);
    if (!sent) return;
    setText('');
    setPendingAudioSrc('');
    setPendingImageSrc('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const canSend = Boolean(text.trim() || pendingAudioSrc || pendingImageSrc) && !forumSending;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);
    onTyping?.(val);
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }
  };

  return (
    <div
      className={cn(
        'relative z-30 px-4 pb-1 pt-1.5 md:px-8',
        immersiveLiveComposerChrome &&
          'border-t border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] bg-gradient-to-t from-black/50 via-[#070a10]/80 to-transparent pt-3 shadow-[0_-12px_40px_-28px_rgba(212,175,55,0.35)]',
      )}
    >
      {/* Recipient chip */}
      <AnimatePresence>
        {selectedRecipient && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.18 }}
            className="mb-1.5 flex items-center gap-2"
          >
            <div className="inline-flex items-center gap-2 h-7 pl-1.5 pr-3 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]">
              <UserAvatar user={selectedRecipient} size="sm" />
              <span className="text-xs font-medium text-[var(--school-accent)]">{selectedRecipient.name}</span>
              <button onClick={onClearRecipient} className="ml-1 text-[color-mix(in_srgb,var(--school-accent)_60%,transparent)] hover:text-[var(--school-accent)]">
                <X className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick-share link chips */}
      {showQuickShareLinks ? (
        <div className="mb-1.5 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {quickLinks.map((item) => (
            <motion.button
              key={item.id}
              type="button"
              onClick={() => insertText(item.value)}
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'flex-shrink-0 h-7 px-3 rounded-full text-[11px] border backdrop-blur-md transition-all whitespace-nowrap',
                item.id === 'payment'
                  ? 'text-[var(--school-accent)] border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)] shadow-[0_8px_20px_-14px_rgba(212,175,55,0.8)]'
                  : 'text-gray-400 border-white/10 bg-white/[0.03] hover:border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] hover:text-[var(--school-accent)] hover:bg-white/5'
              )}
            >
              <Link2 className="w-3 h-3 inline mr-1 opacity-60" />
              {item.label}
            </motion.button>
          ))}
        </div>
      ) : null}

      {/* Pending media chip */}
      <AnimatePresence>
        {(pendingAudioSrc || pendingImageSrc) && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="mb-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-2 py-1 flex items-center justify-between gap-2"
          >
            <p className="text-[11px] text-gray-300 truncate">
              {pendingAudioSrc ? 'Audio prêt' : 'Image prête'} à envoyer
            </p>
            <button
              type="button"
              onClick={() => { setPendingAudioSrc(''); setPendingImageSrc(''); }}
              className="h-6 px-2 rounded-lg text-[10px] text-gray-400 border border-white/10 hover:bg-white/5 flex-shrink-0"
            >
              Retirer
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording indicator */}
      <AnimatePresence>
        {recording && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="mb-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              <span className="text-[11px] text-red-200 font-medium">REC {recordingSec}s</span>
            </div>
            <div className="flex items-end gap-1 h-3.5">
              {[0, 1, 2, 3, 4].map((b) => (
                <motion.span
                  key={b}
                  className="w-1 rounded bg-red-300/80"
                  animate={{ height: [3, 10, 5, 12, 4] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: b * 0.08 }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main toolbar */}
      <div className="relative flex items-center gap-1.5 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.09] via-white/[0.04] to-white/[0.03] backdrop-blur-xl px-2.5 py-2 focus-within:border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] shadow-[0_16px_40px_-24px_rgba(0,0,0,0.95)] transition-colors">
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_70%_0%,rgba(212,175,55,0.12),transparent_38%)]" />

        <button
          type="button"
          onClick={onOpenPicker}
          className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-[var(--school-accent)] hover:bg-white/5 transition-all"
          aria-label="Membres"
          title="Sélectionner un membre"
        >
          <Users className="w-4 h-4" />
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
          spellCheck
          autoCorrect="on"
          autoCapitalize="sentences"
          placeholder={
            messagePlaceholder
              || (selectedRecipient
                ? `Message à ${selectedRecipient.name}…`
                : 'Commencer une conversation…')
          }
          disabled={forumSending}
          className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-500 resize-none outline-none max-h-36 py-1 leading-relaxed disabled:opacity-50"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all"
          aria-label="Partager une image"
          title="Envoyer une image"
        >
          <ImageIcon className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={toggleAudioRecording}
          className={cn(
            'flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all',
            recording ? 'bg-red-500/15 text-red-300' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
          )}
          aria-label="Message audio"
          title="Enregistrer un message audio"
        >
          <Mic className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => { if (!liveEnabled) return; onToggleVideo?.(); }}
          disabled={!liveEnabled}
          className={cn(
            'flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all',
            !liveEnabled
              ? 'bg-white/[0.03] text-gray-700 cursor-not-allowed'
              : liveActive
                ? 'bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)] ring-1 ring-[color-mix(in_srgb,var(--school-accent)_35%,transparent)]'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
          )}
          aria-label="Live vidéo"
          title={
            liveEnabled
              ? 'Basculer en live vidéo'
              : 'Sélectionnez une conversation pour lancer le live'
          }
        >
          <Video className="w-4 h-4" />
        </button>

        {liveActive ? (
          <button
            type="button"
            onClick={onToggleLiveSettings}
            className={cn(
              'flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all',
              liveSettingsOpen
                ? 'bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)] ring-1 ring-[color-mix(in_srgb,var(--school-accent)_35%,transparent)]'
                : 'text-gray-400 hover:text-[var(--school-accent)] hover:bg-white/5'
            )}
            aria-label="Paramètres live"
            title="Paramètres vidéo, audio, SmartBoard"
          >
            <Settings className="w-4 h-4" />
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!canSend}
          className={cn(
            'flex h-8 w-8 flex-shrink-0 items-center justify-center transition-all',
            immersiveLiveComposerChrome ? 'h-9 w-9 rounded-full' : 'rounded-xl',
            canSend
              ? immersiveLiveComposerChrome
                ? 'bg-[var(--school-accent)] text-black shadow-[0_0_22px_-6px_rgba(212,175,55,0.85)] hover:bg-[#e5c04a]'
                : 'bg-[var(--school-accent)] text-black hover:bg-[#e5c04a]'
              : 'bg-white/5 text-gray-600',
          )}
          aria-label="Envoyer"
          title="Envoyer le message"
        >
          <Send className="w-4 h-4" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImagePick}
        />
      </div>
    </div>
  );
}
