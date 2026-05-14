import React from 'react';
import { cn } from '@/lib/utils';
import { designerShellChipGhost } from '@/lib/liriDesignerShellClasses';

const SUB_DRAWER_LABELS = {
  host_coach: 'Coach formateur',
  hands: 'Mains levées',
  permission_requests: 'Demandes d’accès',
  waiting: 'Salle d’attente',
  journal: 'Journal LONGIA',
  mesh: 'Control Mesh',
  zone3: 'Zone 3',
  neuronq: 'NeuronQ',
  layout_preview: 'Aperçu des vues',
};

export const resolveLongiaSubDrawerLabel = (key) => SUB_DRAWER_LABELS[key] || 'Détail';

export const LiveHostLongiaSubDrawerHeader = ({ longiaSignalSubDrawer, onBack }) => {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.08] px-4 py-3">
      <button
        type="button"
        onClick={onBack}
        className={cn(
          designerShellChipGhost,
          '!rounded-xl !px-3 !py-2 !text-[10px] !font-semibold !uppercase !tracking-[0.1em] !text-white/80 hover:!border-white/18 hover:!bg-white/[0.07] hover:!text-white/95',
        )}
      >
        ← Retour
      </button>
      <span
        className="min-w-0 truncate text-[13px] font-semibold leading-snug tracking-[0.04em] text-amber-200/95"
        style={{ fontFamily: 'Georgia, "Times New Roman", ui-serif, serif' }}
      >
        {resolveLongiaSubDrawerLabel(longiaSignalSubDrawer)}
      </span>
    </div>
  );
};

export default LiveHostLongiaSubDrawerHeader;
