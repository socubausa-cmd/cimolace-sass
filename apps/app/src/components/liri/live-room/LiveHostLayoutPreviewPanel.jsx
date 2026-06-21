import React, { useMemo } from 'react';
import { Smartphone, Projector, Users, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSmartboardMobileReadabilitySummary } from '@/lib/smartboardDesignCanvas';
import LiveHostDomMirror from '@/components/liri/live-room/LiveHostDomMirror';

/**
 * Contrôles aperçu mobile / projecteur / lien invité — partagé entre le modal Arena et le sous-tiroir LONGIA.
 */
export default function LiveHostLayoutPreviewPanel({
  mobilePreviewActive,
  onMobilePreviewChange,
  projectorPreviewActive,
  onProjectorPreviewChange,
  cinemaModeReal,
  guestInviteUrl = '',
  /**
   * Ref sur la grille live hôte — active le miroir DOM (simulateur) dans l'encadré téléphone.
   * Absent sur certains conteneurs (ex. Arena) : pas d'emulateur, seuls les repères texte restent.
   */
  emulatorSourceRef = null,
  /** Sous-tiroir hub : intro courte sous l'en-tête « ← Retour ». */
  embedded = false,
  className,
}) {
  const setMobile = (v) => {
    if (v) onProjectorPreviewChange(false);
    onMobilePreviewChange(v);
  };
  const setProjector = (v) => {
    if (v) onMobilePreviewChange(false);
    onProjectorPreviewChange(v);
  };

  const mobileRead = useMemo(() => getSmartboardMobileReadabilitySummary(), []);
  const readStyle =
    mobileRead.status === 'ok'
      ? 'text-amber-200/90'
      : mobileRead.status === 'tight'
        ? 'text-amber-200/85'
        : 'text-amber-200/90';

  return (
    <div className={cn('space-y-4 pt-1', embedded && 'pt-0', className)}>
      {embedded ? (
        <p className="-mt-1 mb-1 text-[11px] leading-relaxed text-white/45">
          Simule ce que voient les participants sur téléphone ou sur écran de projection, sans quitter le pilotage.
        </p>
      ) : null}

      <section
        className={cn(
          'rounded-xl border p-3',
          mobilePreviewActive
            ? 'border-amber-400/35 bg-amber-500/[0.06]'
            : 'border-white/[0.08] bg-black/25',
        )}
      >
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30">
            <Smartphone className="h-4 w-4 text-amber-200/90" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-white/90">Vue mobile</p>
            <p className="mt-1 text-[11px] leading-snug text-white/42">
              Activez l&apos;aperçu : le pilotage passe en mode compact, le plateau se cale sur le{' '}
              <span className="text-white/55">SmartBoard</span> (modes Arène plein écran / NeuronQ sont
              relâchés), puis le cadre reprend la <span className="text-white/55">colonne centrale</span> (miroir
              DOM) comme sur un téléphone.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={mobilePreviewActive}
                onClick={() => setMobile(true)}
                data-testid="live-host-activate-mobile-preview"
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors',
                  mobilePreviewActive
                    ? 'cursor-default bg-white/[0.06] text-white/35'
                    : 'bg-amber-500/25 text-amber-100 hover:bg-amber-500/35',
                )}
              >
                Activer l&apos;aperçu
              </button>
              <button
                type="button"
                disabled={!mobilePreviewActive}
                onClick={() => setMobile(false)}
                data-testid="live-host-deactivate-mobile-preview"
                className={cn(
                  'rounded-lg border border-white/12 px-3 py-1.5 text-[11px] font-medium transition-colors',
                  !mobilePreviewActive
                    ? 'cursor-default text-white/25'
                    : 'text-white/70 hover:bg-white/[0.06]',
                )}
              >
                Désactiver
              </button>
            </div>
            {emulatorSourceRef ? (
              <div className="mt-3">
                <p className="mb-1.5 text-[8px] font-bold uppercase tracking-wider text-white/30">Simulateur (rendu hôte)</p>
                <LiveHostDomMirror
                  sourceRef={emulatorSourceRef}
                  active={mobilePreviewActive}
                  embedded={embedded}
                />
              </div>
            ) : (
              <p className="mt-3 text-[9.5px] leading-snug text-white/32">
                Emulateur visuel hôte : disponible sur la page Live hôte (/live/host/…). En Arène, utilisez le lien
                invité pour comparer la vue spectateur.
              </p>
            )}
            <div className="mt-2.5 space-y-1 text-[9.5px] leading-snug text-white/40">
              <p className="text-[8px] font-bold uppercase tracking-wider text-white/28">Densité SmartBoard (repère invité)</p>
              <p className={cn('font-medium', readStyle)}>{mobileRead.hint}</p>
              <p className="text-white/32">
                Zone scène type téléphone ≈ {mobileRead.availableStage.width}×{mobileRead.availableStage.height} px, échelle
                ≈ {mobileRead.scaleContainPercent} %.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        className={cn(
          'rounded-xl border p-3',
          projectorPreviewActive || cinemaModeReal
            ? 'border-amber-400/35 bg-amber-500/[0.06]'
            : 'border-white/[0.08] bg-black/25',
        )}
      >
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30">
            <Projector className="h-4 w-4 text-amber-200/90" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-white/90">Vue projecteur</p>
            <p className="mt-1 text-[11px] leading-snug text-white/42">
              Zone centrale seule (comme le mode cinéma), sans passer en plein écran navigateur. Pour le vrai plein
              écran, utilisez « Mode cinéma » dans le menu.
            </p>
            {cinemaModeReal ? (
              <p className="mt-2 text-[10px] font-medium text-amber-200/70">
                Le mode cinéma complet est déjà actif — l&apos;aperçu projecteur est inutile.
              </p>
            ) : null}
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={projectorPreviewActive || cinemaModeReal}
                onClick={() => setProjector(true)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors',
                  projectorPreviewActive || cinemaModeReal
                    ? 'cursor-default bg-white/[0.06] text-white/35'
                    : 'bg-amber-500/20 text-amber-100 hover:bg-amber-500/30',
                )}
              >
                Activer l&apos;aperçu
              </button>
              <button
                type="button"
                disabled={!projectorPreviewActive || cinemaModeReal}
                onClick={() => setProjector(false)}
                className={cn(
                  'rounded-lg border border-white/12 px-3 py-1.5 text-[11px] font-medium transition-colors',
                  !projectorPreviewActive || cinemaModeReal
                    ? 'cursor-default text-white/25'
                    : 'text-white/70 hover:bg-white/[0.06]',
                )}
              >
                Désactiver
              </button>
            </div>
          </div>
        </div>
      </section>

      {guestInviteUrl ? (
        <section className="rounded-xl border border-white/[0.08] bg-black/25 p-3">
          <div className="flex items-start gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30">
              <Users className="h-4 w-4 text-amber-200/90" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-white/90">Vue invité</p>
              <p className="mt-1 text-[11px] leading-snug text-white/42">
                Même lien que les participants : disposition spectateur, sans pilotage plateau. Ouvrez un nouvel onglet
                pour comparer à votre vue hôte.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      window.open(guestInviteUrl, '_blank', 'noopener,noreferrer');
                    } catch {
                      /* ignore */
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/22 px-3 py-1.5 text-[11px] font-semibold text-amber-100 transition-colors hover:bg-amber-500/32"
                >
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                  Ouvrir vue invité
                </button>
              </div>
              <p className="mt-2 break-all font-mono text-[9px] leading-snug text-white/35">{guestInviteUrl}</p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
