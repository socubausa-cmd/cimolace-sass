import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { CheckoutSuccessContent } from '@/components/ecommerce/CheckoutSuccessContent';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/eleve-mobile/connection/EleveConnectionLayout';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { EV_ACCENT, EV_BG, EV_PAGE_AMBIENT } from '@/pages/eleve-mobile/eleveMobileScreensShared';

const HEADER_GLASS =
  'linear-gradient(180deg, rgba(24,24,36,0.78) 0%, rgba(14,14,22,0.94) 40%, rgba(11, 11, 15, 0.96) 100%)';

/**
 * Confirmation d'achat e‑commerce dans le shell LIRI élève (retour paiement Stripe, etc.).
 * Route : `/m/eleve/checkout-success`
 */
export default function EleveCheckoutSuccessScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notifications: sync } = useDataSync();
  const inboxUnread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;

  return (
    <EleveMobileShell user={user} notificationCount={inboxUnread} hideHeader hideTabBar contentClassName="!px-0 !pb-0">
      <div
        className="flex w-full min-h-0 flex-1 flex-col"
        style={{
          minHeight: '100dvh',
          backgroundColor: EV_BG,
          backgroundImage: EV_PAGE_AMBIENT,
        }}
      >
        <div className="shrink-0 px-4 pt-[max(0.35rem,env(safe-area-inset-top))]">
          <LiriStatusBar />
        </div>

        <div className="shrink-0 px-4 pb-1 pt-0.5">
          <LiriWordmark size="kicker" className="text-white/40" />
        </div>

        <header
          className="sticky top-0 z-20 grid grid-cols-3 items-center border-b border-white/10 px-2 py-3 shadow-[0_-1px_0_rgba(255,255,255,0.05)_inset] backdrop-blur-2xl backdrop-saturate-150 sm:px-4"
          style={{ background: HEADER_GLASS }}
        >
          <div className="flex min-w-0 justify-start">
            <button
              type="button"
              onClick={() => navigate(ELEVE_MOBILE.home)}
              className="flex min-w-0 items-center gap-1 py-2 pl-0 pr-2 text-[13px] text-white/55 transition hover:bg-white/5 hover:text-white"
            >
              <ChevronLeft className="h-5 w-5 shrink-0" />
              <span className="hidden sm:inline">Accueil</span>
            </button>
          </div>
          <div className="flex justify-center">
            <div className="flex max-w-full items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: EV_ACCENT }} strokeWidth={2} />
              <span className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-white/75">Commande</span>
            </div>
          </div>
          <div className="flex justify-end" />
        </header>

        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
          <CheckoutSuccessContent variant="eleve" />
        </div>
      </div>
    </EleveMobileShell>
  );
}
