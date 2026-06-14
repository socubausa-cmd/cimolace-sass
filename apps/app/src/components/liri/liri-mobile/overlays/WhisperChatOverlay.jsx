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
      className="fixed inset-y-0 right-0 z-[220] flex w-[min(100%,400px)] flex-col border-l border-[#D4AF37]/35 bg-[#0a0908]/98 shadow-[0_0_40px_-10px_rgba(212,175,55,0.25)] backdrop-blur-2xl"
      data-liri-no-doubletap
    >
      <div className="flex items-center gap-2 border-b border-[#D4AF37]/20 px-3 py-3">
        <button
          type="button"
          onClick={() => {
            clearSelectedMember();
            closeOverlay();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D4AF37]/25 text-[#D4AF37]/70 transition-colors hover:bg-[#D4AF37]/10"
          aria-label="Retour"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-sm font-semibold text-[#D4AF37]">{selectedMember.name}</p>
          <p className="text-[10px] text-[#D4AF37]/50">Message privé · hors fil du live</p>
        </div>
      </div>

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4"
      >
        {whisperMessages.length === 0 ? (
          <p className="text-center text-xs leading-relaxed text-[#D4AF37]/45">
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
                      ? 'border border-[#D4AF37]/35 bg-[#D4AF37]/15 text-[#fff8ed]'
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

      <div className="flex gap-2 border-t border-[#D4AF37]/20 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
          className="min-w-0 flex-1 rounded-xl border border-[#D4AF37]/25 bg-black/40 px-3 py-2 text-sm text-[#f5e6c8] outline-none placeholder:text-[#D4AF37]/35"
        />
        <button
          type="button"
          disabled={!text.trim()}
          onClick={submit}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#D4AF37] text-black disabled:opacity-40"
          aria-label="Envoyer"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
