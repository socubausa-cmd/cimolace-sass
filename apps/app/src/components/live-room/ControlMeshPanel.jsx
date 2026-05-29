import React, { useState } from 'react';
import {
  PRODUCT_NAMES,
  TRANSFER_LABELS,
  SHARED_CONTROL_LABELS,
  CONTROL_PROFILES,
  permissionGroup,
  PERMISSION_GROUPS,
  PERMISSION_IDS,
  DEFAULT_MESH_GRANT_MS,
  MESH_GRANT_DURATION_PRESETS,
} from '@/lib/liriControlMesh';
import { cn } from '@/lib/utils';
import {
  designerShellEmbedPanel,
  designerShellCardInset,
  designerShellMicroLabel,
  designerShellChipAmber,
  designerShellChipViolet,
  designerShellChipGhost,
  designerShellChipEmerald,
  designerShellChipRose,
} from '@/lib/liriDesignerShellClasses';

/**
 * Hôte — panneau d'orchestration : acteurs, file d'attente, profils, transferts.
 * Les actions fines (grant/revoke) se brancheront sur Control Transfer Engine + persistance.
 */
const KIND_FR = {
  control: 'Contrôle',
  scene: 'Scène',
  joykit: 'JoyKit',
  media: 'Piste média',
};

function participantUserId(p) {
  const s = String(p.id);
  return s.startsWith('host-') ? s.slice(5) : s;
}

function minutesLeft(expiresAt) {
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 60000));
}

export default function ControlMeshPanel({
  participants = [],
  pendingRequests = [],
  /** Hôte : { [userId]: { profileId, name? } } */
  grantsByUserId = {},
  onAcceptRequest,
  onRejectRequest,
  onApplyProfile,
  onRevokeParticipant,
  onPassJoyKit,
  compact = false,
}) {
  const [showPerms, setShowPerms] = useState(false);
  const [acceptDurationMs, setAcceptDurationMs] = useState(DEFAULT_MESH_GRANT_MS);

  const selectClass =
    'min-w-[6.25rem] rounded-lg border border-white/12 bg-[#0a0b0f] px-2 py-1.5 text-[10px] leading-tight text-amber-100/95 outline-none focus:border-cyan-500/35 focus:ring-1 focus:ring-cyan-500/15';

  const bodyGap = compact ? 'gap-3' : 'gap-3.5';
  const bodyPad = compact ? 'px-3 pb-3 pt-2' : 'px-4 pb-4 pt-2';
  const headPad = compact ? 'px-3 py-2.5' : 'px-4 py-3';

  return (
    <div
      className={cn(
        designerShellEmbedPanel,
        'flex min-h-0 flex-col',
        compact
          ? 'h-full min-h-0 w-full max-h-[min(94vh,800px)] flex-1'
          : 'max-h-[min(90vh,680px)]',
      )}
    >
      <div
        className={cn(
          'flex shrink-0 flex-col gap-2 border-b border-white/[0.08]',
          headPad,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-amber-200/95">
              {PRODUCT_NAMES.controlMesh}
            </div>
            <p className="text-[8px] leading-snug text-white/38">Outil d'orchestration</p>
          </div>
          <label className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-[7px] font-semibold uppercase tracking-[0.12em] text-white/38">
              Durée si OK
            </span>
            <select
              value={acceptDurationMs}
              onChange={(e) => setAcceptDurationMs(Number(e.target.value))}
              className={selectClass}
              title="Durée du grant JoyKit lorsque vous acceptez une demande"
              aria-label="Durée d'accès JoyKit pour les acceptations"
            >
              {MESH_GRANT_DURATION_PRESETS.map((opt) => (
                <option key={opt.ms} value={opt.ms}>
                  {opt.labelFr}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden',
          bodyGap,
          bodyPad,
        )}
      >
      {/* Demandes */}
      <div className={cn(designerShellCardInset, 'shrink-0 p-2.5')}>
        <div className={designerShellMicroLabel}>Demandes</div>
        {pendingRequests.length === 0 ? (
          <div className="mt-1.5 text-[11px] leading-relaxed italic text-white/32">
            Aucune demande en attente.
          </div>
        ) : (
          <div className="lh-sy mt-1.5 flex max-h-[min(28vh,200px)] flex-col gap-2 overflow-y-auto">
            {pendingRequests.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold text-white">{r.name}</div>
                  <div className="text-[8px] text-white/45">{KIND_FR[r.kind] || r.kind}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => onAcceptRequest?.(r, acceptDurationMs)}
                    className={cn(designerShellChipEmerald, 'cursor-pointer px-2 py-1')}
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => onRejectRequest?.(r)}
                    className={cn(designerShellChipRose, 'cursor-pointer px-2 py-1')}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Occupe le vide vertical entre Demandes et Profils : zone lisible, scroll interne */}
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-1.5',
          compact ? 'min-h-[min(32vh,260px)]' : 'min-h-[12rem]',
        )}
      >
        <div className={designerShellMicroLabel}>Sur scène</div>
        <div
          className={cn(
            'lh-sy flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-y-contain rounded-xl border border-white/[0.07] bg-white/[0.02] px-2 py-2',
            '[scrollbar-width:thin] [scrollbar-color:rgba(251,191,36,0.28)_transparent]',
          )}
        >
          {participants.length === 0 ? (
            <div className="flex min-h-[4.5rem] items-center justify-center px-2 text-center text-[11px] leading-relaxed text-white/32">
              Aucun participant sur scène pour l'instant.
            </div>
          ) : (
            participants.map((p) => {
              const uid = participantUserId(p);
              const grant = grantsByUserId[uid];
              return (
                <div
                  key={String(p.id)}
                  className={cn(
                    'flex items-center justify-between gap-1.5 rounded-xl border px-2 py-1.5',
                    grant
                      ? 'border-amber-500/25 bg-amber-500/[0.08]'
                      : 'border-white/[0.06] bg-white/[0.03]',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-white">
                    <span className="min-w-0 overflow-hidden text-ellipsis">{p.name}</span>
                    {grant ? (
                      <span className="shrink-0 text-[7px] font-extrabold uppercase tracking-[0.06em] text-amber-200/90">
                        JOYKIT
                        {grant.expiresAt ? (
                          <span className="ml-1 font-semibold text-white/45">
                            · {minutesLeft(grant.expiresAt)} min
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      title={TRANSFER_LABELS.transferJoyKit.fr}
                      onClick={() => onPassJoyKit?.(p)}
                      className={cn(designerShellChipAmber, 'cursor-pointer px-1.5 py-0.5')}
                    >
                      JoyKit
                    </button>
                    <button
                      type="button"
                      title="Retirer"
                      onClick={() => onRevokeParticipant?.(p)}
                      className={cn(designerShellChipGhost, 'cursor-pointer px-1.5 py-0.5')}
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div
        className={cn(
          'flex min-h-0 shrink-0 flex-col overflow-y-auto overscroll-y-contain [scrollbar-width:thin]',
          compact ? 'max-h-[min(40vh,340px)]' : 'max-h-[min(45vh,400px)]',
          'space-y-3 pt-0.5',
        )}
      >
      <div className={designerShellMicroLabel}>Profils Control</div>
      <div className="flex flex-wrap gap-1.5">
        {CONTROL_PROFILES.slice(0, 8).map((prof) => (
          <button
            key={prof.id}
            type="button"
            title={prof.labelEn}
            onClick={() => onApplyProfile?.(prof.id)}
            className={cn(designerShellChipViolet, 'cursor-pointer px-2 py-1.5 text-[10px]')}
          >
            {prof.labelFr}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[9px] leading-snug text-white/42">
        <span>{SHARED_CONTROL_LABELS.coControlMode.fr}</span>
        <span className="text-white/25">·</span>
        <span>{PRODUCT_NAMES.splitSmartboard}</span>
      </div>

      <button
        type="button"
        onClick={() => setShowPerms((v) => !v)}
        className={cn(designerShellChipGhost, 'self-start cursor-pointer px-2.5 py-1.5 text-[10px]')}
      >
        {showPerms ? 'Masquer' : 'Voir'} permissions fines ({PERMISSION_IDS.length})
      </button>

      {showPerms ? (
        <div
          className="lh-sy max-h-[min(32vh,240px)] overflow-y-auto text-[9px] leading-relaxed text-white/45"
        >
          {(['smartboard', 'media', 'live', 'orchestration', 'advanced']).map((g) => (
            <div key={g} className="mb-1.5">
              <div className="mb-0.5 text-[8px] font-semibold text-amber-200/85">{PERMISSION_GROUPS[g]}</div>
              {PERMISSION_IDS.filter((id) => permissionGroup(id) === g).map((id) => (
                <div key={id}>· {id}</div>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      <p
        className="shrink-0 border-t border-white/[0.06] pt-2.5 text-[7px] leading-snug text-white/28"
        title="Persistance temps réel et Transfer Engine — prochaine étape (sans changer la durée d'accès ci-dessus)."
      >
        Persistance temps réel · Transfer Engine — à brancher (aperçu produit).
      </p>
      </div>
      </div>
    </div>
  );
}
