import React, { useEffect, useState } from 'react';
import { TrendingUp, Target, Trophy, Timer, Layers, Loader2, Wallet } from 'lucide-react';
import { crmApi } from '@/lib/api-v2';
import { useToast } from '@/components/ui/use-toast';

/* ── Tableau de bord sales (#17) — win-rate, forecast pondéré, conversion par étape, leaderboard.
   Charte LIRI : warm dark, accent coral, libellés small-caps, cartes métriques rythmées. */

const ZERO_DEC = new Set(['XAF', 'XOF', 'JPY', 'KRW']);
function money(amount, currency = 'EUR') {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: ZERO_DEC.has(currency) ? 0 : 0 }).format(n);
  } catch { return `${Math.round(n).toLocaleString('fr-FR')} ${currency}`; }
}

function Kpi({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-2xl border lp-line lp-panel70 p-4">
      <div className="flex items-center gap-2">
        <Icon size={15} className="lp-coral" />
        <span className="text-[11px] font-semibold uppercase tracking-[.09em] lp-muted">{label}</span>
      </div>
      <div className="mt-2 text-[26px] font-semibold leading-none lp-ink" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div className="mt-1.5 text-[12px] lp-faint">{sub}</div>}
    </div>
  );
}

export default function CrmAnalytics() {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const a = await crmApi.analytics();
        if (alive) setData(a);
      } catch (e) {
        if (alive) toast({ title: 'CRM', description: String(e?.message || e), variant: 'destructive' });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-1 py-2">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl lp-panel animate-pulse" />)}
        </div>
        <div className="mt-3 h-56 rounded-2xl lp-panel animate-pulse" />
      </div>
    );
  }

  const d = data || {};
  const totals = d.totals || { open: 0, won: 0, lost: 0 };
  const cur = Object.keys(d.pipelineValue || {})[0] || 'EUR';
  const winPct = Math.round((Number(d.winRate) || 0) * 100);
  const stages = d.byStage || [];
  const maxStage = Math.max(1, ...stages.map((s) => s.count || 0));
  const leaders = Object.entries(d.leaderboard || {}).sort((a, b) => (b[1]?.won || 0) - (a[1]?.won || 0)).slice(0, 5);
  const empty = totals.open + totals.won + totals.lost === 0;

  return (
    <div className="mx-auto max-w-5xl px-1 py-2">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi icon={TrendingUp} label="Taux de gain" value={`${winPct}%`} sub={`${totals.won} gagné${totals.won > 1 ? 's' : ''} · ${totals.lost} perdu${totals.lost > 1 ? 's' : ''}`} />
        <Kpi icon={Target} label="Forecast pondéré" value={money(d.forecast, cur)} sub={`${totals.open} deal${totals.open > 1 ? 's' : ''} ouvert${totals.open > 1 ? 's' : ''}`} />
        <Kpi icon={Wallet} label="Panier moyen gagné" value={money(d.avgWonAmount, cur)} />
        <Kpi icon={Timer} label="Cycle moyen" value={d.avgCycleDays != null ? `${d.avgCycleDays} j` : '—'} sub="création → clôture" />
      </div>

      {empty ? (
        <div className="mt-4 rounded-2xl border border-dashed lp-line px-4 py-10 text-center">
          <p className="text-[13.5px] lp-muted">Aucun deal pour l'instant.</p>
          <p className="mt-1 text-[12.5px] lp-faint">Les métriques s'afficheront dès vos premières opportunités dans le pipeline.</p>
        </div>
      ) : (
        <div className="mt-3 grid gap-3 lg:grid-cols-[1.6fr_1fr]">
          {/* Conversion par étape */}
          <section className="rounded-2xl border lp-line lp-panel70 p-4">
            <div className="mb-3.5 flex items-center gap-2">
              <Layers size={14} className="lp-coral" />
              <span className="text-[11px] font-semibold uppercase tracking-[.09em] lp-muted">Pipeline par étape</span>
            </div>
            <div className="space-y-2.5">
              {stages.map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-[12.5px] lp-muted">{s.name}</span>
                  <div className="relative h-6 flex-1 overflow-hidden rounded-lg" style={{ background: 'rgba(245,244,238,.05)' }}>
                    <div className="absolute inset-y-0 left-0 rounded-lg" style={{ width: `${Math.max(4, ((s.count || 0) / maxStage) * 100)}%`, background: 'linear-gradient(90deg,#d97757,#c2683f)' }} />
                    <span className="absolute inset-y-0 left-2.5 flex items-center text-[11.5px] font-medium text-white">{s.count}</span>
                  </div>
                  <span className="w-24 shrink-0 text-right text-[12px] lp-faint" style={{ fontVariantNumeric: 'tabular-nums' }}>{money(s.value, cur)}</span>
                </div>
              ))}
            </div>
            {Object.keys(d.pipelineValue || {}).length > 0 && (
              <div className="mt-3.5 flex flex-wrap gap-x-5 gap-y-1 border-t lp-line pt-3 text-[12px]">
                <span className="lp-faint">Valeur pipeline ouvert :</span>
                {Object.entries(d.pipelineValue).map(([c, v]) => (
                  <span key={c} className="font-medium lp-ink">{money(v, c)}</span>
                ))}
              </div>
            )}
          </section>

          {/* Leaderboard */}
          <section className="rounded-2xl border lp-line lp-panel70 p-4">
            <div className="mb-3.5 flex items-center gap-2">
              <Trophy size={14} className="lp-coral" />
              <span className="text-[11px] font-semibold uppercase tracking-[.09em] lp-muted">Classement (deals gagnés)</span>
            </div>
            {leaders.length === 0 ? (
              <p className="px-1 text-[12.5px] lp-faint">Aucun deal gagné attribué.</p>
            ) : (
              <div className="space-y-1.5">
                {leaders.map(([owner, stat], i) => (
                  <div key={owner} className="flex items-center gap-3 rounded-xl px-2 py-2 lp-tr hover:bg-[rgba(245,244,238,.04)]">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold" style={{ background: i === 0 ? 'rgba(217,119,87,.18)' : 'rgba(245,244,238,.06)', color: i === 0 ? '#e08a63' : 'var(--muted)' }}>{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] lp-ink">{owner === 'non attribué' ? 'Non attribué' : owner.slice(0, 8)}</span>
                    <span className="shrink-0 text-[12px] font-medium lp-ink">{stat.won}</span>
                    <span className="shrink-0 text-[11.5px] lp-faint">{money(stat.amount, cur)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
