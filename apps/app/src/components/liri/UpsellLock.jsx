/**
 * UpsellLock — vend le palier supérieur AU POINT DE DÉSIR (l'élève voit une feature que son
 * forfait ne débloque pas). Pattern « feature lock paywall » : montre ce qui est verrouillé,
 * le palier qui le débloque + son prix, et mène au checkout ÉPROUVÉ. S'auto-masque si l'accès
 * est déjà accordé (ou staff) → on peut l'envelopper autour de n'importe quel contenu gaté.
 *
 *   <UpsellLock feature="coursLive" title="Cours en direct"
 *     benefit="Assistez aux cours en temps réel et posez vos questions au professeur.">
 *     <LiveCourseCard ... />   // rendu tel quel si débloqué
 *   </UpsellLock>
 *
 * `variant="card"` (défaut) : remplace le contenu par une carte de vente. `variant="inline"` :
 * bandeau compact au-dessus. Respecte le « non » : pas de piège, le contenu reste consultable
 * hors-lock si `children` est fourni et l'accès accordé.
 */
import { useEffect, useState } from 'react';
import { Lock, ArrowRight, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { resolveTenantSlug } from '@/lib/tenant/activeBranding';
import { useMemberEntitlements } from '@/hooks/useMemberEntitlements';

const ZERO_DECIMAL = new Set(['XAF', 'XOF', 'XPF', 'JPY', 'KRW', 'RWF', 'GNF', 'KMF', 'BIF', 'DJF', 'UGX']);
const fmt = (cents, cur = 'EUR') => {
  const c = String(cur || 'EUR').toUpperCase();
  const v = ZERO_DECIMAL.has(c) ? Math.round(Number(cents) || 0) : Math.round((Number(cents) || 0) / 100);
  return c === 'EUR' ? `${v} €` : `${v.toLocaleString('fr')} ${c}`;
};

export default function UpsellLock({ feature, title, benefit, variant = 'card', children = null }) {
  const { can, isStaff, cycle, upsellFor } = useMemberEntitlements();
  const u = upsellFor(feature);
  const [price, setPrice] = useState(null);

  // Prix du palier cible (ancrage) — une seule ligne, léger.
  useEffect(() => {
    if (!u.locked || !u.planKey) return undefined;
    let alive = true;
    supabase.from('billing_plans').select('price_cents,currency').eq('key', u.planKey).maybeSingle()
      .then(({ data }) => { if (alive && data) setPrice(fmt(data.price_cents, data.currency)); });
    return () => { alive = false; };
  }, [u.locked, u.planKey]);

  // Accès accordé (ou staff, ou feature inconnue) → on rend le contenu tel quel, aucun lock.
  if (isStaff || can(feature)) return children;

  const slug = resolveTenantSlug();
  const href = (u.planKey && slug)
    ? `/t/${slug}/paiement?plan=${encodeURIComponent(u.planKey)}&type=subscription`
    : '/liri/forfaits';
  const tierLabel = u.minCycleLabel || 'un palier supérieur';

  if (variant === 'inline') {
    return (
      <a href={href} className="group flex items-center gap-3 rounded-xl border border-[#d97757]/30 bg-[#d97757]/[0.08] px-4 py-3 text-sm text-white transition-colors hover:bg-[#d97757]/[0.14]">
        <Lock className="h-4 w-4 shrink-0 text-[#e58a5f]" />
        <span className="min-w-0 flex-1">
          <span className="font-semibold">{title}</span>
          <span className="text-white/60"> — débloqué dès {tierLabel}{price ? ` · ${price}/mois` : ''}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-[#e58a5f]">Passer à {tierLabel} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
      </a>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#d97757]/25 bg-[#2a2724] p-6 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#d97757]/15">
        <Lock className="h-5 w-5 text-[#e58a5f]" />
      </div>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#e58a5f]">Débloqué dès {tierLabel}</p>
      <h3 className="mt-1 text-lg font-bold text-white">{title}</h3>
      {benefit && <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-white/70">{benefit}</p>}
      <a
        href={href}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-[#d97757] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#c9673f]"
      >
        <Sparkles className="h-4 w-4" /> Passer à {tierLabel}{price ? ` · ${price}/mois` : ''} <ArrowRight className="h-4 w-4" />
      </a>
      {cycle && (
        <p className="mt-3 text-xs text-white/45">Votre forfait actuel ne comprend pas cet accès.</p>
      )}
    </div>
  );
}
