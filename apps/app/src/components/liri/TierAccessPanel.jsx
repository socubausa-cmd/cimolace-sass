/**
 * TierAccessPanel — « Votre forfait & vos accès ». Rend la MATRICE d'accès pour le palier de
 * l'élève (✅ débloqué / 🔒 dès [palier]) + un CTA de montée en gamme. Rendu au-dessus des
 * forfaits (/liri/forfaits) : l'élève VOIT ce qu'il a et ce qui lui manque → moteur d'upsell
 * (best practice paywall : montrer ce qu'on rate). Piloté par useMemberEntitlements (axe membre).
 */
import { Check, Lock, Sparkles, ArrowRight } from 'lucide-react';
import { useMemberEntitlements } from '@/hooks/useMemberEntitlements';
import { nextCycle, CYCLE_LABEL } from '@/lib/liri/memberTier';
import { resolveTenantSlug } from '@/lib/tenant/activeBranding';

const GROUPS = [
  { title: 'Apprentissage', items: [
    ['coursReplay', 'Cours enregistrés — replay illimité'],
    ['coursLive', 'Cours EN DIRECT — temps réel, questions au professeur'],
    ['library', 'Bibliothèque & livres fondamentaux'],
  ] },
  { title: 'Accompagnement', items: [
    ['seancePrivee', 'Séances privées 1:1 incluses'],
    ['dmMentor', 'Messagerie directe avec un mentor'],
    ['mentorat', 'Parcours praticien — mentorat, stages'],
  ] },
  { title: 'Communauté & rituel', items: [
    ['forum', 'Forum & questions'],
    ['temple', 'Temple & cultes en direct'],
    ['cerclePraticien', 'Cercle des praticiens'],
  ] },
];

export default function TierAccessPanel() {
  const { label, cycle, isStaff, hasForfait, upsellFor } = useMemberEntitlements();

  // Sans forfait → le mur d'upgrade gère déjà le cas (on n'affiche pas de doublon).
  if (!hasForfait) return null;

  const next = isStaff ? null : nextCycle(cycle);
  const slug = resolveTenantSlug();
  const upgradeHref = (next && slug)
    ? `/t/${slug}/paiement?plan=${encodeURIComponent(`${next}-monthly`)}&type=subscription`
    : null;

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pt-8 sm:px-8">
      <div className="rounded-2xl border border-white/10 bg-[#2a2724] p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#e58a5f]">Votre forfait</p>
            <h2 className="mt-1 text-xl font-bold text-white">
              {isStaff ? 'Accès équipe — tout débloqué' : (label || 'Membre')}
            </h2>
          </div>
          {next && upgradeHref && (
            <a href={upgradeHref} className="inline-flex items-center gap-2 rounded-xl bg-[#d97757] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#c9673f]">
              <Sparkles className="h-4 w-4" /> Passer à {CYCLE_LABEL[next]} <ArrowRight className="h-4 w-4" />
            </a>
          )}
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-white/45">{g.title}</p>
              <ul className="space-y-2.5">
                {g.items.map(([key, text]) => {
                  const u = upsellFor(key);
                  const unlocked = isStaff || !u.locked;
                  return (
                    <li key={key} className="flex items-start gap-2.5 text-[13px] leading-snug">
                      {unlocked ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#d97757]" />
                      ) : (
                        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" />
                      )}
                      <span className={unlocked ? 'text-white/85' : 'text-white/45'}>
                        {text}
                        {!unlocked && u.minCycleLabel && (
                          <span className="ml-1 text-[#e58a5f]">· dès {u.minCycleLabel}</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {next && upgradeHref && (
          <p className="mt-5 text-xs text-white/45">
            Passez à <span className="text-white/70">{CYCLE_LABEL[next]}</span> pour débloquer les accès verrouillés ci-dessus.
          </p>
        )}
      </div>
    </div>
  );
}
