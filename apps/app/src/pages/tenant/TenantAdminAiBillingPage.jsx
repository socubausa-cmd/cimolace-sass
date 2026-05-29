/**
 * TenantAdminAiBillingPage — Page de gestion des crédits IA LIRI
 *
 * URL : /t/:tenantSlug/admin/ai-billing
 *
 * Fonctionnalités :
 *   - Affiche le solde courant + quota mensuel + barre de progression
 *   - Liste les transactions (achats, refills, débits)
 *   - Stats d'usage par fonction / par modèle / par jour
 *   - Achat de packs supplémentaires
 *   - Changement de plan (admin)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Coins, TrendingDown, ShoppingCart, Calendar, Zap, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Loader2, Check, Sparkles, BarChart3,
  RefreshCw, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

// ── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

function formatCredits(n) {
  const v = parseFloat(n);
  if (isNaN(v)) return '0';
  if (v >= 1000) return v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  return v.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

function formatPrice(cents, currency = 'EUR') {
  const v = (cents / 100).toFixed(2);
  return `${v} ${currency === 'EUR' ? '€' : currency}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

async function api(path, options = {}) {
  const session = (await supabase.auth.getSession()).data.session;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || data?.message || 'Erreur');
  return data.data ?? data;
}

// ── Composants UI ──────────────────────────────────────────────────────────

function GradientCard({ children, className }) {
  return (
    <div className={cn(
      'rounded-2xl border border-white/10 bg-gradient-to-br from-violet-900/40 via-slate-900 to-slate-950',
      'p-6 shadow-[0_8px_32px_-12px_rgba(124,58,237,0.3)]',
      className,
    )}>
      {children}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = 'violet' }) {
  const colors = {
    violet: 'from-violet-500/10 to-violet-500/0 border-violet-500/20 text-violet-400',
    green:  'from-emerald-500/10 to-emerald-500/0 border-emerald-500/20 text-emerald-400',
    orange: 'from-orange-500/10 to-orange-500/0 border-orange-500/20 text-orange-400',
    red:    'from-red-500/10 to-red-500/0 border-red-500/20 text-red-400',
  };
  return (
    <div className={cn('rounded-xl border bg-gradient-to-br p-5', colors[color] || colors.violet)}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-xs uppercase tracking-wider font-semibold opacity-80">{label}</span>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function DailyConsumptionChart({ data, height = 140 }) {
  // data = [{ day: '2026-05-28', credits: 12.5 }, ...]
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => parseFloat(d.credits) || 0), 1);
  const width = 720;
  const barWidth = Math.max(4, (width - 40) / data.length - 2);
  const total = data.reduce((s, d) => s + parseFloat(d.credits || 0), 0);
  const avg = total / data.length;

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height + 30} className="w-full" preserveAspectRatio="xMidYMid meet" viewBox={`0 0 ${width} ${height + 30}`}>
        {/* Grid horizontal */}
        {[0, 0.25, 0.5, 0.75, 1].map(p => (
          <line key={p} x1="30" x2={width - 10} y1={height - p * height + 5} y2={height - p * height + 5}
                stroke="#1e293b" strokeWidth="1" strokeDasharray="2,3" />
        ))}
        {/* Avg line */}
        <line x1="30" x2={width - 10}
              y1={height - (avg / max) * height + 5}
              y2={height - (avg / max) * height + 5}
              stroke="#f59e0b" strokeWidth="1" strokeDasharray="4,4" opacity="0.6" />
        <text x={width - 12} y={height - (avg / max) * height + 1} fontSize="9" fill="#f59e0b" textAnchor="end">avg {avg.toFixed(1)}</text>

        {/* Bars */}
        {data.map((d, i) => {
          const credits = parseFloat(d.credits) || 0;
          const h = (credits / max) * height;
          const x = 32 + i * (barWidth + 2);
          const y = height - h + 5;
          return (
            <g key={d.day}>
              <rect x={x} y={y} width={barWidth} height={h}
                    fill="url(#barGradient)" rx="2" />
              <title>{d.day}: {credits.toFixed(2)} LCR</title>
            </g>
          );
        })}

        {/* Labels x-axis (first, mid, last) */}
        {[0, Math.floor(data.length / 2), data.length - 1].map(i => (
          <text key={i} x={32 + i * (barWidth + 2) + barWidth / 2}
                y={height + 22} fontSize="9" fill="#64748b" textAnchor="middle">
            {data[i]?.day.slice(5)}
          </text>
        ))}

        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#6d28d9" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function ProgressBar({ percent, warning }) {
  const color = warning ? 'bg-orange-500' : percent > 90 ? 'bg-red-500' : 'bg-gradient-to-r from-violet-500 to-fuchsia-500';
  return (
    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, percent)}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={cn('h-full', color)}
      />
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────

export default function TenantAdminAiBillingPage() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams();
  const { toast } = useToast();

  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [packages, setPackages] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [topupLoading, setTopupLoading] = useState(null);
  const [tab, setTab] = useState('overview'); // overview | usage | history | packs | plans

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, tx, st, pks, pls] = await Promise.all([
        api('/ai-billing/summary'),
        api('/ai-billing/transactions?limit=30'),
        api('/ai-billing/usage/stats?days=30'),
        api('/ai-billing/topup-packages'),
        api('/ai-billing/plans'),
      ]);
      setSummary(s);
      setTransactions(tx);
      setStats(st);
      setPackages(pks);
      setPlans(pls);
    } catch (err) {
      toast({ title: 'Erreur chargement', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleTopup = async (packKey) => {
    setTopupLoading(packKey);
    try {
      const result = await api('/ai-billing/topup/checkout', {
        method: 'POST',
        body: JSON.stringify({ pack_key: packKey }),
      });
      if (result.dev_mode) {
        toast({
          title: 'Crédits ajoutés (mode dev)',
          description: `Solde : ${formatCredits(result.balance)} crédits`,
        });
        await load();
      } else if (result.checkout_url) {
        window.location.href = result.checkout_url;
      }
    } catch (err) {
      toast({ title: 'Erreur achat', description: err.message, variant: 'destructive' });
    } finally {
      setTopupLoading(null);
    }
  };

  const handlePlanChange = async (planTier) => {
    if (!confirm(`Passer au plan ${planTier} ?`)) return;
    try {
      await api('/ai-billing/plan', {
        method: 'POST',
        body: JSON.stringify({ plan_tier: planTier }),
      });
      toast({ title: `Plan changé : ${planTier}` });
      await load();
    } catch (err) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  };

  const handleRefill = async () => {
    try {
      const r = await api('/ai-billing/refill', { method: 'POST' });
      toast({ title: 'Refill effectué', description: `+${formatCredits(r.credited)} crédits` });
      await load();
    } catch (err) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-violet-400" />
              <span className="text-xs uppercase tracking-wider text-violet-400 font-semibold">LIRI Credits</span>
            </div>
            <h1 className="text-3xl font-bold">Facturation IA</h1>
            <p className="text-slate-400 mt-1">Suivi de votre consommation et achats de crédits IA</p>
          </div>
          <button
            onClick={load}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
            title="Rafraîchir"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Hero — solde + plan */}
        <GradientCard className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <p className="text-xs uppercase tracking-wider text-violet-300 font-semibold mb-2">Solde courant</p>
              <div className="flex items-baseline gap-3">
                <p className="text-5xl font-black text-white">
                  {formatCredits(summary?.balance)}
                </p>
                <p className="text-slate-400 font-medium">crédits LIRI</p>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Plan <span className="text-violet-400 font-semibold uppercase">{summary?.plan_tier}</span>
                {' • '}
                Quota mensuel {formatCredits(summary?.monthly_quota)} crédits
              </p>

              <div className="mt-6">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-slate-400">Consommation ce mois</span>
                  <span className={cn('font-semibold', summary?.percent_used > 90 ? 'text-red-400' : 'text-white')}>
                    {formatCredits(summary?.consumed_this_month)} / {formatCredits(summary?.monthly_quota)} ({summary?.percent_used}%)
                  </span>
                </div>
                <ProgressBar percent={summary?.percent_used || 0} warning={summary?.low_balance_warning} />
                {summary?.low_balance_warning && (
                  <div className="flex items-center gap-2 mt-3 text-orange-400 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    Solde faible — pensez à recharger
                  </div>
                )}
              </div>
            </div>
            <div className="border-l border-slate-700/50 pl-6 space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Prochain refill</p>
                <p className="text-sm text-white flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-violet-400" />
                  {formatDate(summary?.next_refill_at)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Lifetime consommé</p>
                <p className="text-sm text-white">{formatCredits(summary?.total_consumed_lifetime)} crédits</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Lifetime acheté</p>
                <p className="text-sm text-white">{formatCredits(summary?.total_purchased_lifetime)} crédits</p>
              </div>
              <button
                onClick={() => setTab('packs')}
                className="w-full mt-4 bg-violet-600 hover:bg-violet-500 text-white py-2 rounded-lg font-semibold transition flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" /> Recharger
              </button>
            </div>
          </div>
        </GradientCard>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-900 rounded-xl p-1 inline-flex">
          {['overview','usage','history','packs','plans'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition',
                tab === t ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white',
              )}
            >
              {{overview:'Vue d\'ensemble', usage:'Usage détaillé', history:'Historique', packs:'Recharger', plans:'Plans'}[t]}
            </button>
          ))}
        </div>

        {/* ── Tab : Overview (stats) ─────────────────────────────── */}
        {tab === 'overview' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard icon={Zap} label="30 derniers jours" value={formatCredits(stats.total_credits_used)} sub="crédits consommés" />
              <StatCard icon={BarChart3} label="Appels IA" value={stats.events_count} sub="opérations comptabilisées" color="green" />
              <StatCard icon={TrendingDown} label="Coût moyen" value={stats.events_count ? (stats.total_credits_used / stats.events_count).toFixed(2) : '0'} sub="crédits par appel" color="orange" />
            </div>

            {/* Mini chart consommation par jour (sans dépendance, SVG inline) */}
            {stats.by_day?.length > 0 && (
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-violet-400" />
                  Consommation quotidienne (30j)
                </h3>
                <DailyConsumptionChart data={stats.by_day} />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                <h3 className="font-semibold mb-4">Top fonctions IA utilisées</h3>
                <div className="space-y-2">
                  {(stats.by_function || []).slice(0, 8).map(f => (
                    <div key={f.name} className="flex items-center justify-between text-sm">
                      <span className="text-slate-300 font-mono text-xs">{f.name}</span>
                      <span className="text-violet-400 font-semibold">{formatCredits(f.credits)} ¢</span>
                    </div>
                  ))}
                  {!stats.by_function?.length && <p className="text-slate-500 text-sm">Aucun usage encore.</p>}
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                <h3 className="font-semibold mb-4">Top modèles IA</h3>
                <div className="space-y-2">
                  {(stats.by_model || []).slice(0, 8).map(m => (
                    <div key={m.name} className="flex items-center justify-between text-sm">
                      <span className="text-slate-300 font-mono text-xs">{m.name}</span>
                      <span className="text-violet-400 font-semibold">{formatCredits(m.credits)} ¢</span>
                    </div>
                  ))}
                  {!stats.by_model?.length && <p className="text-slate-500 text-sm">Aucun usage encore.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab : Usage events détaillés ────────────────────────── */}
        {tab === 'usage' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold text-slate-400 uppercase text-xs">Date</th>
                  <th className="px-4 py-3 font-semibold text-slate-400 uppercase text-xs">Fonction</th>
                  <th className="px-4 py-3 font-semibold text-slate-400 uppercase text-xs">Modèle</th>
                  <th className="px-4 py-3 font-semibold text-slate-400 uppercase text-xs">Unités</th>
                  <th className="px-4 py-3 font-semibold text-slate-400 uppercase text-xs text-right">Coût</th>
                </tr>
              </thead>
              <tbody>
                {(transactions || []).filter(t => t.type === 'ai_usage').slice(0, 20).map(t => (
                  <tr key={t.id} className="border-t border-slate-800">
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(t.created_at)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{t.description?.split(' ')[0] || '—'}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{t.description?.match(/\(([^)]+)\)/)?.[1] || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">—</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-400">−{formatCredits(Math.abs(t.amount))}</td>
                  </tr>
                ))}
                {!transactions.length && (
                  <tr><td colSpan="5" className="text-center text-slate-500 py-12">Aucun usage IA encore.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Tab : Historique transactions ──────────────────────── */}
        {tab === 'history' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold text-slate-400 uppercase text-xs">Date</th>
                  <th className="px-4 py-3 font-semibold text-slate-400 uppercase text-xs">Type</th>
                  <th className="px-4 py-3 font-semibold text-slate-400 uppercase text-xs">Description</th>
                  <th className="px-4 py-3 font-semibold text-slate-400 uppercase text-xs text-right">Montant</th>
                  <th className="px-4 py-3 font-semibold text-slate-400 uppercase text-xs text-right">Solde</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => {
                  const isCredit = parseFloat(t.amount) > 0;
                  const typeLabel = {
                    subscription_refill: 'Refill abonnement',
                    topup_purchase: 'Achat pack',
                    ai_usage: 'Usage IA',
                    refund: 'Remboursement',
                    adjustment: 'Ajustement',
                  }[t.type] || t.type;
                  const TypeIcon = isCredit ? ArrowUpRight : ArrowDownRight;
                  return (
                    <tr key={t.id} className="border-t border-slate-800">
                      <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(t.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex items-center gap-1 text-xs font-medium',
                          isCredit ? 'text-emerald-400' : 'text-orange-400',
                        )}>
                          <TypeIcon className="w-3 h-3" />
                          {typeLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-xs">{t.description}</td>
                      <td className={cn(
                        'px-4 py-3 text-right font-semibold',
                        isCredit ? 'text-emerald-400' : 'text-red-400',
                      )}>
                        {isCredit ? '+' : ''}{formatCredits(t.amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400">{formatCredits(t.balance_after)}</td>
                    </tr>
                  );
                })}
                {!transactions.length && (
                  <tr><td colSpan="5" className="text-center text-slate-500 py-12">Aucune transaction encore.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Tab : Packs achat ────────────────────────────────────── */}
        {tab === 'packs' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {packages.map(p => {
              const pricePerCredit = (p.price_cents / 100) / parseFloat(p.credits_amount);
              return (
                <div key={p.id} className="bg-gradient-to-br from-violet-900/40 to-slate-900 rounded-xl border border-violet-500/20 p-6 hover:border-violet-500/40 transition">
                  {p.bonus_label && (
                    <span className="inline-block bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2 py-1 rounded-md mb-3">
                      {p.bonus_label}
                    </span>
                  )}
                  <h3 className="font-bold text-lg mb-1">{p.label}</h3>
                  <p className="text-3xl font-black text-violet-400 my-3">{formatCredits(p.credits_amount)}<span className="text-base text-slate-400 font-normal"> crédits</span></p>
                  <p className="text-2xl font-bold text-white mb-1">{formatPrice(p.price_cents, p.currency)}</p>
                  <p className="text-xs text-slate-400 mb-4">≈ {(pricePerCredit * 1000).toFixed(2)}€ / 1000 crédits</p>
                  <button
                    onClick={() => handleTopup(p.key)}
                    disabled={topupLoading === p.key}
                    className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                  >
                    {topupLoading === p.key ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> En cours...</>
                    ) : (
                      <>Acheter <ChevronRight className="w-4 h-4" /></>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Tab : Plans abonnement ──────────────────────────────── */}
        {tab === 'plans' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map(p => {
              const isCurrent = summary?.plan_tier === p.plan_tier;
              return (
                <div key={p.plan_tier} className={cn(
                  'rounded-xl border p-6 transition',
                  isCurrent
                    ? 'bg-violet-900/30 border-violet-500'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700',
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-xl capitalize">{p.plan_tier}</h3>
                    {isCurrent && <Check className="w-5 h-5 text-violet-400" />}
                  </div>
                  <p className="text-3xl font-black text-white my-3">{formatCredits(p.monthly_credits)}</p>
                  <p className="text-xs text-slate-400 mb-2">crédits / mois</p>
                  {parseFloat(p.rollover_max) > 0 && (
                    <p className="text-xs text-emerald-400">+ {formatCredits(p.rollover_max)} report max</p>
                  )}
                  {p.allow_overage && (
                    <p className="text-xs text-violet-400 mt-1">✓ Overdraft autorisé</p>
                  )}
                  <p className="text-xs text-slate-500 mt-4">{p.description}</p>
                  {!isCurrent && (
                    <button
                      onClick={() => handlePlanChange(p.plan_tier)}
                      className="w-full mt-4 bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm font-semibold transition"
                    >
                      Passer à ce plan
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Dev tools */}
        {import.meta.env.DEV && (
          <div className="mt-12 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-xl">
            <p className="text-xs text-yellow-400 mb-2 font-semibold">🛠️ Outils dev</p>
            <button
              onClick={handleRefill}
              className="text-xs bg-yellow-700 hover:bg-yellow-600 px-3 py-1 rounded-md"
            >
              Forcer refill mensuel
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
