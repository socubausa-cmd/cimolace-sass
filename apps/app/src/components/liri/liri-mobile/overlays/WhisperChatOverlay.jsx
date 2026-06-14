import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Send } from 'lucide-react';
import { useMobileLiriStore } from '@/stores/mobileLiriStore';
import { cn } from '@/lib/utils';

/**
 * Chuchotements live (Supabase broadcast) — fil 1:1 avec le membre sélectionné.
 * @param {{ whisperMessages: Array<{ id: string, fromId: string, toId: string, text: string, at: number }>, sendWhisper: (toId: string, text: string) => void, currentUserId?: string }} props
 */
export function WhisperChatOverlay({ whisperMessages = [], sendWhisper, currentUserId }) {
  const { selectedMember, closeOverlay, clearSelectedMember } = useMobileLiriStore();
  const [text, setText] = useState('');
  const listRef = useRef(null);

  const peerId = selectedMember?.id ? String(selectedMember.id) : '';

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [whisperMessages.length, peerId]);

  if (!selectedMember || !peerId || peerId === '__live_forum__') return null;

  const submit = () => {
    const t = text.trim();
    if (!t || !sendWhisper) return;
    sendWhisper(peerId, t);
    setText('');
  };

  return (
    <motion.div
      initial={{ x: '105%' }}
      animate={{ x: 0 }}
      exit={{ x: '105%' }}
      transition={{ type: 'spring', damping: 32, stiffness: 360 }}
      className="fixed inset-y-0 right-0 z-[220] flex w-[min(100%,400px)] flex-col border-l border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[#0a0908]/98 shadow-[0_0_40px_-10px_rgba(212,175,55,0.25)] backdrop-blur-2xl"
      data-liri-no-doubletap
    >
      <div className="flex items-center gap-2 border-b border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] px-3 py-3">
        <button
          type="button"
          onClick={() => {
            clearSelectedMember();
            closeOverlay();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)] transition-colors hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]"
          aria-label="Retour"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-sm font-semibold text-[var(--school-accent)]">{selectedMember.name}</p>
          <p className="text-[10px] text-[color-mix(in_srgb,var(--school-accent)_50%,transparent)]">Message privé · hors fil du live</p>
        </div>
      </div>

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4"
      >
        {whisperMessages.length === 0 ? (
          <p className="text-center text-xs leading-relaxed text-[color-mix(in_srgb,var(--school-accent)_45%,transparent)]">
            Aucun message encore. Écrivez ci-dessous — seul {selectedMember.name} et vous voyez cet
            échange.
          </p>
        ) : (
          whisperMessages.map((m) => {
            const mine = currentUserId && String(m.fromId) === String(currentUserId);
            return (
              <div
                key={m.id}
                className={cn('flex', mine ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[88%] rounded-2xl px-3 py-2 text-sm',
                    mine
                      ? 'border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-[#fff8ed]'
                      : 'border border-white/10 bg-black/40 text-white/90',
                  )}
                >
                  {m.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex gap-2 border-t border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Message privé…"
          className="min-w-0 flex-1 rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] bg-black/40 px-3 py-2 text-sm text-[#f5e6c8] outline-none placeholder:text-[color-mix(in_srgb,var(--school-accent)_35%,transparent)]"
        />
        <button
          type="button"
          disabled={!text.trim()}
          onClick={submit}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--school-accent)] text-black disabled:opacity-40"
          aria-label="Envoyer"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
