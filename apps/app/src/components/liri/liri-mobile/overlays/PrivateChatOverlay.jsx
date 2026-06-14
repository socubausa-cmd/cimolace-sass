import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Send } from 'lucide-react';
import { useMobileLiriStore } from '@/stores/mobileLiriStore';

/**
 * @param {{ onSend: (text: string) => void | Promise<void>, sending?: boolean }} props
 */
export function PrivateChatOverlay({ onSend, sending = false }) {
  const { selectedMember, closeOverlay, clearSelectedMember } = useMobileLiriStore();
  const [text, setText] = useState('');

  if (!selectedMember) return null;

  const isLiveForum = selectedMember.id === '__live_forum__';

  const submit = async () => {
    const t = text.trim();
    if (!t || sending) return;
    await onSend(t);
    setText('');
  };

  return (
    <motion.div
      initial={{ x: '105%' }}
      animate={{ x: 0 }}
      exit={{ x: '105%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 340 }}
      className="fixed inset-y-0 right-0 z-[220] flex w-[min(100%,400px)] flex-col border-l border-white/12 bg-[#080c14]/98 shadow-2xl backdrop-blur-2xl"
      data-liri-no-doubletap
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3">
        <button
          type="button"
          onClick={() => {
            clearSelectedMember();
            closeOverlay();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-white/60 hover:bg-white/10"
          aria-label="Retour"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{selectedMember.name}</p>
          <p className="text-[10px] text-white/40">
            {isLiveForum ? 'Forum de la séance — visible par tous' : 'Message (forum live de la session)'}
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <p className="text-xs leading-relaxed text-white/45">
          {isLiveForum
            ? 'Écrivez ici pour participer au chat du live. Les messages sont partagés avec toute la salle.'
            : 'Les messages envoyés ici sont publiés dans le fil du live pour que tout le monde en session puisse les voir. Pour une conversation privée hors live, revenez à la messagerie classique.'}
        </p>
      </div>
      <div className="flex gap-2 border-t border-white/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Écrire…"
          className="min-w-0 flex-1 rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
        />
        <button
          type="button"
          disabled={sending || !text.trim()}
          onClick={() => void submit()}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#D4AF37] text-black disabled:opacity-40"
          aria-label="Envoyer"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
