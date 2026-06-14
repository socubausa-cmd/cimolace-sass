import React from 'react';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import LiveHostLayoutPreviewPanel from '@/components/liri/live-room/LiveHostLayoutPreviewPanel';

/**
 * Hôte Arena : aperçu rapide de la maquette mobile et de la vue type projecteur (contenu central seul).
 */
export default function LiveHostLayoutPreviewModal({
  open,
  onOpenChange,
  mobilePreviewActive,
  onMobilePreviewChange,
  projectorPreviewActive,
  onProjectorPreviewChange,
  cinemaModeReal,
  guestInviteUrl = '',
  emulatorSourceRef = null,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,880px)] max-w-2xl overflow-y-auto border border-white/[0.1] bg-[#0c0e14]/97 text-white shadow-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg text-white/95">Aperçu des vues</DialogTitle>
          <DialogDescription className="text-[12px] leading-relaxed text-white/45">
            Simule ce que voient les participants sur téléphone ou sur écran de projection, sans quitter le pilotage.
          </DialogDescription>
        </DialogHeader>

        <LiveHostLayoutPreviewPanel
          emulatorSourceRef={emulatorSourceRef}
          mobilePreviewActive={mobilePreviewActive}
          onMobilePreviewChange={onMobilePreviewChange}
          projectorPreviewActive={projectorPreviewActive}
          onProjectorPreviewChange={onProjectorPreviewChange}
          cinemaModeReal={cinemaModeReal}
          guestInviteUrl={guestInviteUrl}
        />

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] py-2 text-[11px] text-white/55 transition-colors hover:bg-white/[0.04] hover:text-white/75"
        >
          <X className="h-3.5 w-3.5" />
          Fermer
        </button>
      </DialogContent>
    </Dialog>
  );
}
