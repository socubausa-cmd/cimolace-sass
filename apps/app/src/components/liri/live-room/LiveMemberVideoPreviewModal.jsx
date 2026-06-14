/**
 * Aperçu membre plein écran — vidéo LiveKit, identité, vie scolaire (dock plateau + messagerie).
 */
import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import LiveKitVideoCell from '@/components/liri/live-room/LiveKitVideoCell';
import { liveHostMemberHasCamera } from '@/components/liri/live-room/LiveHostMemberPanelCard';
import { MemberSchoolLifeInlinePanel } from '@/components/liri/live-room/MemberSchoolLifeInlinePanel';
import { designerShellCloseBtn } from '@/lib/liriDesignerShellClasses';

export default function LiveMemberVideoPreviewModal({
  member,
  onClose,
  liveKitMediaEpoch = 0,
  getLiveKitParticipant,
  memberSchoolLifeEnabled = true,
}) {
  const resolveLk = typeof getLiveKitParticipant === 'function' ? getLiveKitParticipant : () => null;
  const lk = member ? resolveLk(member) : null;
  const hasVideo = liveHostMemberHasCamera(lk);
  const avatar = member?.avatar_url || member?.avatarUrl || null;

  useEffect(() => {
    if (!member) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [member, onClose]);

  return (
    <AnimatePresence>
      {member ? (
        <motion.div
          key="live-member-video-fs"
          role="dialog"
          aria-modal="true"
          aria-label={`Membre — ${member.name}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[320] flex items-center justify-center bg-black/88 p-3 backdrop-blur-md sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="relative flex max-h-[min(92vh,900px)] w-full max-w-[min(96vw,1080px)] flex-col overflow-hidden rounded-2xl border border-white/[0.12] bg-[#06070f] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.85)] ring-1 ring-inset ring-white/[0.04] sm:max-h-[min(88vh,860px)] sm:flex-row sm:flex-nowrap"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className={cn(designerShellCloseBtn, 'absolute right-3 top-3 z-20')}
              aria-label="Fermer l'aperçu"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.09] bg-[#0a0b0f]/98 px-4 py-3 pr-14">
                {avatar ? (
                  <img
                    src={avatar}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-full border-2 border-[#C8960C]/35 object-cover shadow-md"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                    style={{
                      background: `${member.color}30`,
                      border: `2px solid ${member.color}`,
                      color: member.color,
                    }}
                  >
                    {member.init}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-white">{member.name}</p>
                  {member.grade ? (
                    <p className="truncate text-[11px] text-white/45">{member.grade}</p>
                  ) : (
                    <p className="text-[11px] text-white/35">Conversation privée — aperçu caméra live</p>
                  )}
                </div>
              </div>
              <div className="relative min-h-[200px] flex-1 bg-black sm:min-h-0">
                {hasVideo && lk ? (
                  <LiveKitVideoCell
                    participant={lk}
                    mediaEpoch={liveKitMediaEpoch}
                    className="h-full w-full"
                  />
                ) : (
                  <div
                    className="flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-2 p-8"
                    style={{
                      background: `linear-gradient(160deg, ${member.color}18, #0a0b0f)`,
                    }}
                  >
                    {avatar ? (
                      <img
                        src={avatar}
                        alt=""
                        className="h-24 w-24 rounded-full border-2 border-white/20 object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold"
                        style={{
                          background: `${member.color}28`,
                          border: `2px solid ${member.color}`,
                          color: member.color,
                        }}
                      >
                        {member.init}
                      </div>
                    )}
                    <p className="text-center text-sm text-white/75">Caméra non disponible pour ce membre</p>
                  </div>
                )}
              </div>
              <p className="pointer-events-none shrink-0 border-t border-white/[0.06] bg-gradient-to-t from-black/80 to-transparent px-4 py-2 text-center text-[10px] text-white/40 sm:hidden">
                Fermez pour continuer à lire le fil sous l'aperçu
              </p>
            </div>

            {memberSchoolLifeEnabled ? (
              <div className="flex max-h-[38vh] w-full shrink-0 flex-col overflow-hidden border-t border-white/[0.1] bg-[#080910]/98 sm:max-h-none sm:w-[min(100%,340px)] sm:border-l sm:border-t-0">
                <div className="shrink-0 border-b border-white/[0.06] px-3 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#D4AF37]/95">Vie scolaire</p>
                  <p className="text-[9px] text-white/35">Résumé, présences, événements</p>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(200,150,12,0.2)_transparent]">
                  <MemberSchoolLifeInlinePanel
                    studentId={String(member.id)}
                    studentName={member.name}
                    embedded
                  />
                </div>
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
