import React, { useCallback } from 'react';
import {
  ArrowRight,
  CheckCircle,
  ExternalLink,
  Flame,
  Package,
  Shield,
  Sparkles,
} from 'lucide-react';
import { LiriPageFooterLine, LiriWordmark } from '@/components/brand/LiriWordmark';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  activationSteps,
  conditions,
  GAMMA_URL,
  galleryItems,
  guarantees,
  packCore,
  phases,
  rituals,
  valueTable,
} from '@/lib/boutiqueSacreeContent';
import { openPaymentCheckoutUrl } from '@/lib/eleveMobilePaymentOpenUrl';
import { LiriStatusBar } from '@/pages/eleve-mobile/connection/EleveConnectionLayout';
import { EV_MUTED, EV_PAGE_AMBIENT } from '@/pages/eleve-mobile/eleveMobileScreensShared';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';

const GOLD = '#D4AF37';

function SectionCard({ className, children, ...rest }) {
  return (
    <div
      className={cn(
        'rounded-[20px] border border-white/[0.08] bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * Boutique Sacrée NGOWAZULU — version native (Capacitor) alignée sur la coque élève.
 * Route : `/m/eleve/boutique`
 */
export default function EleveBoutiqueSacreeScreen() {
  const { user } = useAuth();
  const { notifications: sync } = useDataSync();
  const unreadInbox = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;
  const buyUrl = import.meta?.env?.VITE_BOUTIQUE_BUY_URL;

  const openBuy = useCallback(() => {
    if (buyUrl) openPaymentCheckoutUrl(buyUrl);
  }, [buyUrl]);

  const openGamma = useCallback(() => {
    openPaymentCheckoutUrl(GAMMA_URL);
  }, []);

  return (
    <EleveMobileShell user={user} notificationCount={unreadInbox} hideHeader contentClassName="!px-0">
      <div
        className="relative flex w-full flex-1 flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
        style={{
          minHeight: '100dvh',
          backgroundColor: '#0B0B0F',
          backgroundImage: EV_PAGE_AMBIENT,
        }}
      >
        <div className="px-4 pt-[max(0.35rem,env(safe-area-inset-top))]">
          <LiriStatusBar />
        </div>

        <div className="px-4 pb-2 pt-0.5">
          <div className="mb-1 flex min-w-0 flex-wrap items-end justify-between gap-x-3 gap-y-1">
            <LiriWordmark size="kicker" className="shrink-0 text-white/40" />
            <h1 className="min-w-0 flex-1 text-right text-[20px] font-extrabold leading-tight tracking-[-0.02em] text-white sm:text-[22px]">
              Boutique Sacrée
            </h1>
          </div>
          <p className="mt-1 text-[13px] font-medium" style={{ color: EV_MUTED }}>
            Temple du Feu, de la Lumière et de la Purification Ancestrale
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-2">
          <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/85">
            <Flame className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
            <span className="truncate">BOUTIQUE SACRÉE NGOWAZULU</span>
          </div>

          <SectionCard
            className="border-[#D4AF37]/20"
            style={{
              background: `linear-gradient(165deg, ${GOLD}18 0%, rgba(9, 10, 16, 0.96) 55%)`,
            }}
          >
            <p className="text-[14px] italic leading-relaxed text-white/90">
              « Tout être doit d&apos;abord se laver de ses ombres avant d&apos;espérer briller. »
            </p>
            <p className="mt-2 text-[11px] text-white/45">— 5ᵉ Manikongo</p>
          </SectionCard>

          <SectionCard>
            <h2 className="text-[16px] font-bold text-white">Présentation</h2>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: EV_MUTED }}>
              La Boutique Sacrée NGOWAZULU n&apos;est pas une boutique ordinaire. Chaque objet est un instrument rituel
              activé, consacré par le 5ᵉ Manikongo — mémoire spirituelle, travail de trois mois, lien au Temple.
            </p>
            <div className="mt-3 flex gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3">
              <Shield className="mt-0.5 h-4 w-4 shrink-0" style={{ color: GOLD }} />
              <p className="text-[12px] leading-snug text-white/85">
                Aucun produit ne peut être vendu séparément : l&apos;efficacité réside dans l&apos;harmonie de
                l&apos;ensemble.
              </p>
            </div>
          </SectionCard>

          <div>
            <h2 className="mb-2 flex items-center gap-2 text-[15px] font-bold text-white">
              <Sparkles className="h-4 w-4" style={{ color: GOLD }} />
              Instruments
            </h2>
            <div className="flex touch-pan-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {galleryItems.map((name) => (
                <div
                  key={name}
                  className="shrink-0 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-[11px] font-medium text-white/90"
                >
                  {name}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-[15px] font-bold text-white">Rituels</h2>
            <div className="space-y-2">
              {rituals.map((r) => (
                <SectionCard key={r.title} className="!p-3.5">
                  <p className="text-[13px] font-semibold text-white">{r.title}</p>
                  <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: EV_MUTED }}>
                    {r.description}
                  </p>
                </SectionCard>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-[15px] font-bold text-white">Pack (aperçu)</h2>
            <div className="space-y-2">
              {packCore.map((item) => (
                <SectionCard key={item.number} className="!p-3.5">
                  <div className="flex gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold"
                      style={{ background: `${GOLD}22`, color: GOLD }}
                    >
                      {item.number}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-white">{item.title}</p>
                      <p className="text-[11px] font-medium" style={{ color: GOLD }}>
                        {item.subtitle}
                      </p>
                      <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: EV_MUTED }}>
                        {item.description}
                      </p>
                      <p className="mt-2 text-[11px] text-white/70">
                        <span className="text-white/45">Action :</span> {item.action}
                      </p>
                    </div>
                  </div>
                </SectionCard>
              ))}
            </div>
          </div>

          <SectionCard>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Prix unique</div>
            <div className="mt-1 text-3xl font-extrabold text-white">700 €</div>
            <p className="text-[12px] text-white/50">(activation incluse)</p>
            <ul className="mt-3 space-y-1.5">
              {guarantees.map((g) => (
                <li key={g} className="flex gap-2 text-[12px] text-white/85">
                  <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
                  {g}
                </li>
              ))}
            </ul>
          </SectionCard>

          <div>
            <h2 className="mb-2 text-[15px] font-bold text-white">Phases (3 mois)</h2>
            <div className="space-y-2">
              {phases.map((p) => (
                <SectionCard key={p.title} className="!p-3.5">
                  <p className="text-[12px] font-bold" style={{ color: GOLD }}>
                    {p.title}
                  </p>
                  <p className="text-[13px] font-semibold text-white">{p.subtitle}</p>
                  <p className="mt-1 text-[12px] leading-relaxed" style={{ color: EV_MUTED }}>
                    {p.description}
                  </p>
                </SectionCard>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-2 flex items-center gap-2 text-[15px] font-bold text-white">
              <Package className="h-4 w-4" style={{ color: GOLD }} />
              Contenu du pack
            </h2>
            <div className="overflow-hidden rounded-2xl border border-white/10">
              {valueTable.map((row) => (
                <div
                  key={row.element}
                  className="grid grid-cols-1 gap-0.5 border-b border-white/[0.06] p-3 last:border-b-0 sm:grid-cols-3"
                >
                  <div className="text-[12px] font-semibold text-white">{row.element}</div>
                  <div className="text-[11px] text-white/65">{row.function}</div>
                  <div className="text-[11px] text-white/50">{row.nature}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-[15px] font-bold text-white">Activation</h2>
            <div className="space-y-2">
              {activationSteps.map((s) => (
                <SectionCard key={s.number} className="!p-3.5">
                  <div className="flex gap-2">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold"
                      style={{ background: `${GOLD}22`, color: GOLD }}
                    >
                      {s.number}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-white">{s.title}</p>
                      <p className="mt-1 text-[12px] leading-relaxed" style={{ color: EV_MUTED }}>
                        {s.description}
                      </p>
                    </div>
                  </div>
                </SectionCard>
              ))}
            </div>
          </div>

          <SectionCard>
            <p className="text-[12px] font-semibold text-white/90">Conditions d&apos;efficacité</p>
            <ul className="mt-2 space-y-1.5">
              {conditions.map((c) => (
                <li key={c} className="text-[11px] leading-snug" style={{ color: EV_MUTED }}>
                  — {c}
                </li>
              ))}
            </ul>
          </SectionCard>

          <LiriPageFooterLine marginClass="mt-2" suffix="Boutique sacrée" />
        </div>

        <div
          className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/[0.07] bg-[#0B0B0F]/95 px-4 py-3 backdrop-blur-md"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto flex max-w-lg flex-col gap-2">
            {buyUrl ? (
              <Button
                type="button"
                className="h-11 w-full font-bold"
                style={{ background: GOLD, color: '#0a0a0a' }}
                onClick={openBuy}
              >
                Commander le pack
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" className="h-11 w-full font-bold" disabled>
                Commander le pack
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full border-white/20 text-white hover:bg-white/5"
              onClick={openGamma}
            >
              Voir la présentation complète
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
            {!buyUrl ? (
              <p className="text-center text-[10px] text-white/40">Lien d&apos;achat à configurer (VITE_BOUTIQUE_BUY_URL)</p>
            ) : null}
          </div>
        </div>
      </div>
    </EleveMobileShell>
  );
}
