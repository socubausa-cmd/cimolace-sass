import React, { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Receipt,
  CreditCard,
  Repeat,
  LifeBuoy,
  User,
  ShoppingBag,
  Calendar,
  CalendarClock,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
  LiriMobileScreenShell,
  LiriGoldCard,
  LiriSectionLabel,
} from '@/components/mobile-liri/LiriMobileScreenShell';
import { LIRI_MOBILE, liriClientHubHref, LIRI_CLIENT_TAB_IDS } from '@/lib/liriMobileRoutes';
import { cn } from '@/lib/utils';

const items = [
  { id: 'orders', short: 'Commandes', to: LIRI_MOBILE.orders, title: 'Commandes', sub: 'Factures & historique', icon: Receipt },
  { id: 'subscriptions', short: 'Abonnements', to: LIRI_MOBILE.subscriptions, title: 'Abonnements', sub: 'Forfaits & renouvellement', icon: Repeat },
  { id: 'payments', short: 'Paiements', to: '/paiements/facturation', title: 'Paiements', sub: 'Facturation', icon: CreditCard },
  { id: 'shop', short: 'Boutique', to: LIRI_MOBILE.shop, title: 'Boutique', sub: 'Produits', icon: ShoppingBag },
  { id: 'booking', short: 'RDV', to: LIRI_MOBILE.booking, title: 'Rendez-vous', sub: 'Prendre un créneau', icon: Calendar },
  { id: 'appointments', short: 'Sessions', to: LIRI_MOBILE.appointments, title: 'Mes rendez-vous', sub: 'Coaching & sessions', icon: CalendarClock },
  { id: 'support', short: 'Support', to: LIRI_MOBILE.support, title: 'Support', sub: 'Aide', icon: LifeBuoy },
  { id: 'profile', short: 'Profil', to: LIRI_MOBILE.profile, title: 'Profil', sub: 'Compte membre', icon: User },
];

export default function MobileClientHubScreen() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') || '';
  const validTab = LIRI_CLIENT_TAB_IDS.includes(tab) ? tab : '';

  useEffect(() => {
    if (!validTab) return;
    const id = requestAnimationFrame(() => {
      document.getElementById(`liri-client-${validTab}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => cancelAnimationFrame(id);
  }, [validTab]);

  return (
    <LiriMobileScreenShell contentClassName="overflow-y-auto pb-8">
      <div className="pt-2 pb-3">
        <LiriSectionLabel>Espace membre</LiriSectionLabel>
        <h1 className="mt-1 font-serif text-xl text-[#faf3e6] tracking-tight">Espace client</h1>
        <p className="mt-1 text-sm text-white/48">Commandes, abonnements, RDV et profil.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <Link
            key={item.id}
            to={liriClientHubHref(item.id)}
            replace
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all duration-200',
              validTab === item.id
                ? 'border-[#D4AF37]/55 bg-gradient-to-r from-[#D4AF37]/22 to-[#8a7018]/12 text-[#fff4dc] shadow-[0_0_16px_-6px_rgba(212,175,55,0.35)]'
                : 'border-white/[0.1] bg-black/40 text-white/50',
            )}
          >
            {item.short}
          </Link>
        ))}
      </div>

      {!user ? (
        <LiriGoldCard className="p-4 mb-4">
          <p className="text-sm text-white/70">Connectez-vous pour accéder à vos commandes et abonnements.</p>
          <div className="mt-3 flex gap-2">
            <Link
              to="/login"
              className="flex-1 flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#c9a227] text-sm font-semibold text-black"
            >
              Connexion
            </Link>
            <Link
              to="/signup"
              className="flex-1 flex h-10 items-center justify-center rounded-xl border border-white/20 text-sm font-semibold"
            >
              Créer un compte
            </Link>
          </div>
        </LiriGoldCard>
      ) : null}

      <ul className="flex flex-col gap-2">
        {items.map((item, i) => (
          <motion.li
            key={item.id}
            id={`liri-client-${item.id}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i }}
            className={cn(
              'scroll-mt-28 rounded-2xl transition-shadow',
              validTab === item.id && 'ring-2 ring-[#D4AF37]/45 ring-offset-2 ring-offset-[#0a0908]',
            )}
          >
            <Link to={item.to}>
              <LiriGoldCard className="flex items-center gap-3 p-3.5 active:scale-[0.99] transition-transform border-[#D4AF37]/26">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D4AF37]/32 bg-[#D4AF37]/12">
                  <item.icon className="h-5 w-5 text-[#e8c547]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white/95">{item.title}</p>
                  <p className="text-[11px] text-white/40">{item.sub}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-white/25 shrink-0" />
              </LiriGoldCard>
            </Link>
          </motion.li>
        ))}
      </ul>
    </LiriMobileScreenShell>
  );
}
