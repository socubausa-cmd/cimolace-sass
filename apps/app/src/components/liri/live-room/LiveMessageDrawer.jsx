import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Send } from 'lucide-react';
import { normalizeLiveForumMessage } from '@/lib/normalizeLiveForumMessage';
import { cn } from '@/lib/utils';
import {
  LIVE_DRAWER_BACKDROP_TRANSITION,
  liveDrawerAsideRight,
  liveDrawerSheetBottom,
} from '@/lib/liveDrawerMotion';

/** Aligné sur LiveRoomShell — cadre arène premium */
const immersiveArenaPanelClass =
  'rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] bg-[#070a10]/92 shadow-[0_0_42px_-14px_rgba(212,175,55,0.28),inset_0_1px_0_0_rgba(212,175,55,0.12)] backdrop-blur-md';

const immersiveArenaStarfieldClass =
  'bg-[#05070c] bg-[radial-gradient(ellipse_at_50%_0%,rgba(212,175,55,0.12),transparent_55%),radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.04),transparent_2px),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.03),transparent_2px),radial-gradient(circle_at_40%_80%,rgba(255,255,255,0.025),transparent_2px)] bg-[length:100%_100%,120px_120px,180px_180px,140px_140px]';

function renderContent(content = '') {
  if (String(content).includes('[image]')) return 'Image';
  if (String(content).includes('[audio]')) return 'Audio';
  return content;
}

export default function LiveMessageDrawer({
  open,
  messages = [],
  currentUserId,
  onClose,
  /** Titre du panneau (forum public) */
  title = 'Forum live',
  /** Sous-titre explicatif */
  subtitle = 'Messages publics — visibles par tous les participants',
  /** Envoi vers live_session_chat ou immersive_live_chat_messages */
  onSendForumMessage = null,
  forumSending = false,
  /** drawer = panneau coulissant ; inline = colonne centrale (studio messagerie 1:1) */
  variant = 'drawer',
  /** `side` = carte à droite ; `sheet` = feuille basse (viewport étroit) */
  drawerLayout = 'side',
  /** Style maquette studio (or, starfield) ; la saisie est dans la barre du bas (MessagingPage) */
  immersiveArena = false,
}) {
  const [draft, setDraft] = useState('');
  const listRef = useRef(null);
  const isInline = variant === 'inline';
  const isSheetDrawer = variant === 'drawer' && drawerLayout === 'sheet';
  const hideForumComposer = Boolean(immersiveArena && isInline);
  const canSend = Boolean(onSendForumMessage) && String(draft).trim().length > 0 && !forumSending;
  const effectiveOpen = isInline || open;

  const normalized = messages.map((m) => normalizeLiveForumMessage(m)).filter(Boolean);

  useEffect(() => {
    if (!effectiveOpen) setDraft('');
  }, [effectiveOpen]);

  useEffect(() => {
    const el = listRef.current;
    if (!el || !effectiveOpen) return;
    el.scrollTop = el.scrollHeight;
  }, [normalized.length, effectiveOpen]);

  const submit = useCallback(async () => {
    const t = String(draft || '').trim();
    if (!t || !onSendForumMessage || forumSending) return;
    try {
      await onSendForumMessage(t);
      setDraft('');
    } catch {
      /* parent toast si besoin */
    }
  }, [draft, onSendForumMessage, forumSending]);

  const body = (
    <>
      <div
        className={cn(
          'flex flex-shrink-0 items-center border-b',
          immersiveArena ? 'border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] bg-black/40 px-3 py-2' : 'border-white/15 bg-white/[0.04]',
          isInline && !immersiveArena ? 'h-11 px-3 py-1' : null,
          !isInline ? 'h-12 px-4' : null,
          immersiveArena && isInline ? 'min-h-[52px]' : null,
        )}
      >
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate text-xs font-semibold',
              immersiveArena ? 'font-serif text-sm text-[var(--school-accent)] md:text-base' : 'text-white/90',
            )}
          >
            {title}
          </p>
          <p className={cn('truncate text-[10px] leading-tight', immersiveArena ? 'text-[color-mix(in_srgb,var(--school-accent)_55%,transparent)]' : 'text-white/45')}>
            {subtitle}
          </p>
        </div>
        {!isInline ? (
          <button type="button" onClick={onClose} className="h-8 w-8 flex-shrink-0 rounded-full text-gray-300 hover:bg-white/10">
            <X className="mx-auto h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div
        ref={listRef}
        className={cn(
          'min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3',
          immersiveArena
            ? immersiveArenaStarfieldClass
            : 'bg-[radial-gradient(circle_at_10%_8%,rgba(255,255,255,0.08),transparent_34%)]',
        )}
      >
        {normalized.length === 0 ? (
          <p className={cn('px-2 py-8 text-center text-[11px]', immersiveArena ? 'text-[color-mix(in_srgb,var(--school-accent)_45%,transparent)]' : 'text-white/40')}>
            {isInline
              ? immersiveArena
                ? 'Forum public — les messages s\'affichent ici. Écrivez depuis la barre du bas (messagerie live).'
                : 'Écrivez ici en parallèle de la vidéo — le fil est partagé à deux.'
              : 'Aucun message pour l&apos;instant. Le fil est partagé avec toute la salle.'}
          </p>
        ) : (
          normalized.map((m) => {
            const own = String(m.sender_id) === String(currentUserId);
            const label = m.sender_name || (own ? 'Vous' : 'Participant');
            return (
              <div key={m.id} className={cn('max-w-[92%]', own ? 'ml-auto' : '')}>
                {!own ? (
                  <p
                    className={cn(
                      'mb-0.5 px-0.5 text-[9px] uppercase tracking-wide',
                      immersiveArena ? 'text-[color-mix(in_srgb,var(--school-accent)_50%,transparent)]' : 'text-white/40',
                    )}
                  >
                    {label}
                  </p>
                ) : null}
                <div
                  className={cn(
                    'rounded-2xl border px-3 py-2 text-xs backdrop-blur-md',
                    own
                      ? 'border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_14%,transparent)] text-[#f6e8b3] shadow-[0_0_20px_-8px_rgba(212,175,55,0.45)]'
                      : immersiveArena
                        ? 'border-white/12 bg-black/50 text-gray-100'
                        : 'border-white/15 bg-white/[0.08] text-gray-100',
                  )}
                >
                  {renderContent(m.content)}
                </div>
              </div>
            );
          })
        )}
      </div>
      {onSendForumMessage && !hideForumComposer ? (
        <div
          className={cn(
            'flex-shrink-0 border-t p-2',
            immersiveArena ? 'border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] bg-black/45' : 'border-white/12 bg-black/20',
            isSheetDrawer && 'pb-[max(0.5rem,env(safe-area-inset-bottom))]',
          )}
        >
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder={isInline ? 'Message à votre interlocuteur…' : 'Message au forum…'}
              rows={isInline ? 3 : 2}
              className={cn(
                'flex-1 rounded-xl border border-white/12 bg-black/35 px-3 py-2 text-xs text-white placeholder:text-white/35 outline-none resize-y',
                isInline ? 'min-h-[52px] max-h-32' : 'min-h-[44px] max-h-24',
              )}
              disabled={forumSending}
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSend}
              className={cn(
                'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors',
                canSend
                  ? 'bg-[var(--school-accent)] text-black shadow-[0_0_24px_-6px_rgba(212,175,55,0.75)] hover:bg-[#e5c04a]'
                  : 'cursor-not-allowed border border-white/10 bg-white/[0.06] text-white/30',
              )}
              aria-label="Envoyer"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );

  if (isInline) {
    return (
      <div
        className={cn(
          'flex h-full min-h-0 flex-col overflow-hidden',
          immersiveArena
            ? immersiveArenaPanelClass
            : 'rounded-2xl border border-white/14 bg-[#0a101c]/90 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-xl',
        )}
      >
        {body}
      </div>
    );
  }

  if (isSheetDrawer) {
    return (
      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              aria-label="Fermer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={LIVE_DRAWER_BACKDROP_TRANSITION}
              className="fixed inset-0 z-[55] cursor-default border-0 bg-black/65 p-0 backdrop-blur-[3px]"
              onClick={onClose}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="live-forum-sheet-title"
              {...liveDrawerSheetBottom}
              onClick={(e) => e.stopPropagation()}
              className="fixed inset-x-0 bottom-0 top-[10vh] z-[56] flex flex-col overflow-hidden rounded-t-[26px] border border-white/18 bg-white/[0.06] shadow-[0_-28px_90px_-30px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
            >
              <div className="flex flex-shrink-0 justify-center pb-1 pt-2" aria-hidden>
                <div className="h-1 w-10 rounded-full bg-white/20" />
              </div>
              <span id="live-forum-sheet-title" className="sr-only">
                {title}
              </span>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{body}</div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          {...liveDrawerAsideRight}
          className="absolute top-20 right-4 bottom-20 z-40 w-[min(92vw,380px)] rounded-3xl border border-white/18 bg-white/[0.06] backdrop-blur-2xl overflow-hidden shadow-[0_28px_90px_-30px_rgba(0,0,0,0.85)] flex flex-col"
        >
          {body}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
