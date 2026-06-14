import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useMobileLiriStore } from '@/stores/mobileLiriStore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function ProfileOverlay() {
  const { selectedMember, closeOverlay } = useMobileLiriStore();

  if (!selectedMember) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className="fixed left-1/2 top-1/2 z-[220] w-[min(92vw,360px)] -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[#0a0908]/96 p-5 shadow-[0_0_40px_-10px_rgba(212,175,55,0.3)] backdrop-blur-2xl"
      data-liri-no-doubletap
    >
      <button
        type="button"
        onClick={closeOverlay}
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] text-[color-mix(in_srgb,var(--school-accent)_60%,transparent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]"
        aria-label="Fermer"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex flex-col items-center text-center">
        <Avatar className="h-20 w-20 border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]">
          {selectedMember.avatar ? <AvatarImage src={selectedMember.avatar} alt="" /> : null}
          <AvatarFallback className="bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-2xl text-[var(--school-accent)]">
            {(selectedMember.name || '?').slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <h2 className="mt-3 font-serif text-lg font-semibold text-[var(--school-accent)]">{selectedMember.name}</h2>
        {selectedMember.role ? (
          <p className="mt-1 text-xs text-[color-mix(in_srgb,var(--school-accent)_60%,transparent)]">{selectedMember.role}</p>
        ) : null}
        {selectedMember.isHost ? (
          <span className="mt-2 rounded-full border border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--school-accent)]">
            Hôte
          </span>
        ) : null}
        <p className="mt-4 text-xs leading-relaxed text-[color-mix(in_srgb,var(--school-accent)_45%,transparent)]">
          Profil détaillé : ouvrez la fiche membre depuis la messagerie hors live pour plus
          d'informations.
        </p>
      </div>
    </motion.div>
  );
}
