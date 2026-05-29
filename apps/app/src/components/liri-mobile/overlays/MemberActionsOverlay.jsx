import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Clock, MapPin, MessageCircle, User, X } from 'lucide-react';
import { useMobileLiriStore } from '@/stores/mobileLiriStore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export function MemberActionsOverlay({ whisperEnabled = false, currentUserId }) {
  const {
    selectedMember,
    closeOverlay,
    openProfile,
    openWhisperChat,
    openLiveForumChat,
  } = useMobileLiriStore();

  if (!selectedMember) return null;

  const isSelf = Boolean(currentUserId && String(selectedMember.id) === String(currentUserId));

  const roleLabel = selectedMember.isHost
    ? 'Host'
    : selectedMember.role || 'Participant';
  const lastActive = selectedMember.lastActiveLabel || 'Récemment actif';
  const location = selectedMember.locationLabel;

  return (
    <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className={cn(
          'fixed left-1/2 top-1/2 z-[215] w-[min(92vw,360px)] -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-[#D4AF37]/40',
          'bg-[#0a0908]/95 p-5 shadow-[0_0_48px_-8px_rgba(212,175,55,0.35),inset_0_1px_0_0_rgba(212,175,55,0.12)] backdrop-blur-xl',
        )}
        data-liri-no-doubletap
      >
        <button
          type="button"
          onClick={closeOverlay}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-xl border border-[#D4AF37]/20 text-[#D4AF37]/60 transition-colors hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex gap-3 pr-8">
          <Avatar className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-2xl border-2 border-[#D4AF37]/40 shadow-[0_0_20px_-4px_rgba(212,175,55,0.4)]">
            {selectedMember.avatar ? (
              <AvatarImage src={selectedMember.avatar} alt="" className="object-cover" />
            ) : null}
            <AvatarFallback className="rounded-2xl bg-[#D4AF37]/15 text-2xl font-semibold text-[#D4AF37]">
              {(selectedMember.name || '?').slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="font-serif text-xl font-semibold tracking-tight text-[#D4AF37]">
              {selectedMember.name}
            </h2>
            <p className="mt-0.5 text-sm text-[#D4AF37]/70">{roleLabel}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                ✓ 100% Présent
              </span>
              <span className="text-[11px] text-[#D4AF37]/55">— Actif</span>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl border border-[#D4AF37]/22 bg-black/30 px-3 py-2.5 text-left transition-colors active:bg-[#D4AF37]/[0.06]"
          >
            <span className="flex items-center gap-2.5 text-sm text-[#f0e6d4]">
              <Clock className="h-4 w-4 text-[#D4AF37]" strokeWidth={1.75} />
              {lastActive}
            </span>
            <ChevronRight className="h-4 w-4 text-[#D4AF37]/50" />
          </button>
          {location ? (
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-[#D4AF37]/22 bg-black/30 px-3 py-2.5 text-left transition-colors active:bg-[#D4AF37]/[0.06]"
            >
              <span className="flex items-center gap-2.5 text-sm text-[#f0e6d4]">
                <MapPin className="h-4 w-4 text-[#D4AF37]" strokeWidth={1.75} />
                {location}
              </span>
              <ChevronRight className="h-4 w-4 text-[#D4AF37]/50" />
            </button>
          ) : null}
        </div>

        <div className={cn('mt-5 grid gap-2.5', isSelf ? 'grid-cols-1' : 'grid-cols-2')}>
          <button
            type="button"
            onClick={() => openProfile(selectedMember)}
            className="flex items-center justify-center gap-2 rounded-2xl border border-[#D4AF37]/45 bg-[#D4AF37]/[0.06] py-3 text-xs font-semibold text-[#f5dd8a] shadow-[inset_0_1px_0_0_rgba(212,175,55,0.12)] transition-colors active:bg-[#D4AF37]/12"
          >
            <User className="h-4 w-4 text-[#D4AF37]" />
            Voir le profil
          </button>
          {!isSelf ? (
            <button
              type="button"
              onClick={() => {
                if (whisperEnabled) openWhisperChat(selectedMember);
                else openLiveForumChat();
              }}
              className="flex items-center justify-center gap-2 rounded-2xl border border-[#D4AF37]/45 bg-[#D4AF37]/[0.06] py-3 text-xs font-semibold text-[#f5dd8a] shadow-[inset_0_1px_0_0_rgba(212,175,55,0.12)] transition-colors active:bg-[#D4AF37]/12"
            >
              <MessageCircle className="h-4 w-4 text-[#D4AF37]" />
              {whisperEnabled ? 'Message privé' : 'Chat du live'}
            </button>
          ) : null}
        </div>
      </motion.div>
  );
}
