import React, { useMemo } from 'react';
import { Smartphone, Projector, Users, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSmartboardMobileReadabilitySummary } from '@/lib/smartboardDesignCanvas';

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

      <section className="rounded-xl border border-white/[0.08] bg-black/25 p-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30">
            <Smartphone className="h-4 w-4 text-amber-200/90" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-white/90">Vue mobile</p>
            <p className="mt-1 text-[11px] leading-snug text-white/42">
              Idée de ce que voient les participants sur téléphone — <span className="text-white/55">sans recharger
              ni modifier votre pilotage</span>.
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-3">
          {/* Maquette téléphone statique (indicative) — aucun miroir DOM, aucun basculement de layout. */}
          <div
            aria-hidden
            style={{
              width: 100,
              flexShrink: 0,
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,.12)',
              background: 'var(--lh-stage-bg, #1f1e1c)',
              padding: 6,
              boxShadow: '0 12px 30px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.05)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div
                style={{
                  height: 100,
                  borderRadius: 9,
                  border: '1px solid rgba(212,163,106,.3)',
                  background: 'rgba(212,163,106,.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: '.08em', color: 'rgba(227,199,154,.9)' }}>
                  SMARTBOARD
                </span>
              </div>
              <div style={{ display: 'flex', gap: 3 }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} style={{ flex: 1, height: 14, borderRadius: 5, background: 'rgba(255,255,255,.06)' }} />
                ))}
              </div>
              <div
                style={{
                  height: 16,
                  borderRadius: 7,
                  background: 'rgba(255,255,255,.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: 6, fontWeight: 600, letterSpacing: '.1em', color: 'rgba(255,255,255,.42)' }}>
                  CONTRÔLES
                </span>
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-1 text-[9.5px] leading-snug text-white/40">
            <p className="text-[8px] font-bold uppercase tracking-wider text-white/28">Densité SmartBoard (repère invité)</p>
            <p className={cn('font-medium', readStyle)}>{mobileRead.hint}</p>
            <p className="text-white/32">
              Zone scène ≈ {mobileRead.availableStage.width}×{mobileRead.availableStage.height} px, échelle ≈{' '}
              {mobileRead.scaleContainPercent} %.
            </p>
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
