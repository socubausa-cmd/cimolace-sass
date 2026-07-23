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
  RefreshCw, ChevronRight, Gauge, ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import TenantAdminShell from '@/components/admin/TenantAdminShell';
import { ADMIN_T as T } from '@/lib/tenantAdminTheme';

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

function GradientCard({ children, style }) {
  return (
    <div style={{
      borderRadius: 18, border: `1px solid ${T.goldMid}`,
      background: 'linear-gradient(135deg, rgba(212,175,55,0.10), rgba(25,39,52,0.5) 55%, rgba(11,11,15,0.9))',
      padding: 24, boxShadow: '0 8px 32px -12px rgba(212,175,55,0.18)',
      ...style,
    }}>
      {children}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = 'gold' }) {
  const accents = {
    gold:   T.gold,
    green:  T.success,
    orange: T.warning,
    red:    T.danger,
  };
  const accent = accents[color] || T.gold;
  return (
    <div style={{
      borderRadius: 14, border: `1px solid ${T.border}`,
      background: T.surfaceCard, padding: 20,
    }}>
      <div className="flex items-center gap-2 mb-2" style={{ color: accent }}>
        <Icon className="w-4 h-4" />
        <span className="text-xs uppercase tracking-wider font-semibold" style={{ opacity: 0.85 }}>{label}</span>
      </div>
      <p className="text-3xl font-bold" style={{ color: T.t1 }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: T.t3 }}>{sub}</p>}
    </div>
  );
}

// ── Dépassement à l'usage (overage postpaid) ────────────────────────────────
function OverageManager({ overage, onToggle, onSaveCap, busy }) {
  const o = overage || {};
  const [cap, setCap] = useState(o.cap_eur ?? 50);
  useEffect(() => { setCap(o.cap_eur ?? 50); }, [o.cap_eur]);

  const price = o.price_eur_per_credit ?? 0.02;
  const accrued = o.accrued_eur ?? 0;
  const capEur = o.cap_eur ?? 50;
  const pct = capEur > 0 ? Math.min(100, (accrued / capEur) * 100) : 0;
  const eligible = o.eligible !== false;

  return (
    <div className="rounded-xl p-5" style={{ background: T.surfaceCard, border: `1px solid ${T.border}` }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold mb-1 flex items-center gap-2" style={{ color: T.t1 }}>
            <Gauge className="w-4 h-4" style={{ color: T.gold }} />
            Dépassement à l'usage
          </h3>
          <p className="text-sm max-w-lg" style={{ color: T.t2 }}>
            Quand votre quota mensuel est épuisé, continuez à utiliser l'IA sans coupure.
            Le dépassement est facturé en fin de mois à <span className="font-semibold" style={{ color: T.gold }}>{price.toFixed(2).replace('.', ',')} €/crédit</span>,
            dans la limite du plafond que vous fixez.
          </p>
        </div>
        {/* Interrupteur opt-in */}
        <button
          type="button"
          disabled={busy || !eligible}
          onClick={() => onToggle(!o.enabled)}
          className="relative inline-flex items-center rounded-full transition"
          style={{
            width: 52, height: 30,
            background: o.enabled ? T.success : T.surface2,
            border: `1px solid ${o.enabled ? T.success : T.border}`,
            opacity: (busy || !eligible) ? 0.5 : 1,
            cursor: (busy || !eligible) ? 'not-allowed' : 'pointer',
          }}
          title={eligible ? (o.enabled ? 'Désactiver' : 'Activer') : 'Réservé aux plans payants'}
        >
          <span style={{
            position: 'absolute', top: 3, left: o.enabled ? 25 : 3,
            width: 22, height: 22, borderRadius: '50%', background: '#fff',
            transition: 'left 160ms cubic-bezier(0.22,1,0.36,1)',
          }} />
        </button>
      </div>

      {!eligible && (
        <p className="text-xs mt-3" style={{ color: T.t3 }}>
          Le dépassement à l'usage est disponible sur les plans <strong>Pro</strong> et <strong>Business</strong>.
        </p>
      )}

      {o.enabled && (
        <div className="mt-5 space-y-4">
          {/* Jauge du dépassement en cours */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1" style={{ color: T.t2 }}>
              <span>Dépassement en cours ce mois</span>
              <span className="font-semibold" style={{ color: pct >= 80 ? T.warning : T.t1 }}>
                {accrued.toFixed(2).replace('.', ',')} € / {capEur.toFixed(0)} €
              </span>
            </div>
            <div className="w-full rounded-full overflow-hidden" style={{ height: 8, background: T.surface2 }}>
              <div style={{
                width: `${pct}%`, height: '100%',
                background: pct >= 80 ? T.warning : T.gold, transition: 'width 300ms ease',
              }} />
            </div>
            <p className="text-xs mt-1" style={{ color: T.t3 }}>
              {(o.overage_credits ?? 0).toLocaleString('fr-FR')} crédits en dépassement — facturés le 1er du mois prochain.
            </p>
          </div>

          {/* Plafond anti-surprise */}
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-xs uppercase tracking-wider font-semibold flex items-center gap-1.5 mb-1.5" style={{ color: T.t2 }}>
                <ShieldCheck className="w-3.5 h-3.5" style={{ color: T.success }} />
                Plafond mensuel (anti-surprise)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min="0" step="10" value={cap}
                  onChange={(e) => setCap(parseFloat(e.target.value))}
                  className="rounded-lg px-3 py-2 text-sm w-28"
                  style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.t1 }}
                />
                <span className="text-sm" style={{ color: T.t2 }}>€</span>
              </div>
            </div>
            <button
              type="button"
              disabled={busy || cap === capEur}
              onClick={() => onSaveCap(cap)}
              className="rounded-lg px-4 py-2 text-sm font-semibold transition"
              style={{
                background: (busy || cap === capEur) ? T.surface2 : T.gold,
                color: (busy || cap === capEur) ? T.t3 : '#0b0b0f',
                cursor: (busy || cap === capEur) ? 'default' : 'pointer',
              }}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer le plafond'}
            </button>
          </div>
        </div>
      )}
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
                stroke="rgba(255,255,255,0.07)" strokeWidth="1" strokeDasharray="2,3" />
        ))}
        {/* Avg line */}
        <line x1="30" x2={width - 10}
              y1={height - (avg / max) * height + 5}
              y2={height - (avg / max) * height + 5}
              stroke={T.warning} strokeWidth="1" strokeDasharray="4,4" opacity="0.6" />
        <text x={width - 12} y={height - (avg / max) * height + 1} fontSize="9" fill={T.warning} textAnchor="end">avg {avg.toFixed(1)}</text>

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
                y={height + 22} fontSize="9" fill={T.t3} textAnchor="middle">
            {data[i]?.day.slice(5)}
          </text>
        ))}

        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={T.gold} />
            <stop offset="100%" stopColor="rgba(212,175,55,0.35)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function ProgressBar({ percent, warning }) {
  const color = warning ? T.warning : percent > 90 ? T.danger : T.gold;
  return (
    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: T.surface2 }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, percent)}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="h-full"
        style={{ background: color }}
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
  const [overage, setOverage] = useState(null);
  const [overageBusy, setOverageBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [topupLoading, setTopupLoading] = useState(null);
  const [tab, setTab] = useState('overview'); // overview | usage | history | packs | plans

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, tx, st, pks, pls, ov] = await Promise.all([
        api('/ai-billing/summary'),
        api('/ai-billing/transactions?limit=30'),
        api('/ai-billing/usage/stats?days=30'),
        api('/ai-billing/topup-packages'),
        api('/ai-billing/plans'),
        api('/ai-billing/overage').catch(() => null),
      ]);
      setSummary(s);
      setTransactions(tx);
      setStats(st);
      setPackages(pks);
      setPlans(pls);
      setOverage(ov);
    } catch (err) {
      toast({ title: 'Erreur chargement', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleOverage = async (body, successMsg) => {
    setOverageBusy(true);
    try {
      const next = await api('/ai-billing/overage', { method: 'POST', body: JSON.stringify(body) });
      setOverage(next);
      toast({ title: successMsg });
    } catch (err) {
      toast({ title: 'Erreur dépassement', description: err.message, variant: 'destructive' });
    } finally {
      setOverageBusy(false);
    }
  };

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
      <TenantAdminShell>
        <div className="flex items-center justify-center" style={{ minHeight: 360 }}>
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: T.gold }} />
        </div>
      </TenantAdminShell>
    );
  }

  return (
    <TenantAdminShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2" style={{ color: T.gold }}>
            <Sparkles className="w-5 h-5" />
            <span className="text-xs uppercase tracking-wider font-semibold">LIRI Credits</span>
          </div>
          <h1 className="text-3xl font-bold" style={{ color: T.t1 }}>Facturation IA</h1>
          <p className="mt-1" style={{ color: T.t2 }}>Suivi de votre consommation et achats de crédits IA</p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg transition"
          style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.t1 }}
          title="Rafraîchir"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Hero — solde + plan */}
      <GradientCard style={{ marginBottom: 32 }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <p className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.gold }}>Solde courant</p>
            <div className="flex items-baseline gap-3">
              <p className="text-5xl font-black" style={{ color: T.t1 }}>
                {formatCredits(summary?.balance)}
              </p>
              <p className="font-medium" style={{ color: T.t2 }}>crédits LIRI</p>
            </div>
            <p className="text-sm mt-1" style={{ color: T.t2 }}>
              Plan <span className="font-semibold uppercase" style={{ color: T.gold }}>{summary?.plan_tier}</span>
              {' • '}
              Quota mensuel {formatCredits(summary?.monthly_quota)} crédits
            </p>

            <div className="mt-6">
              <div className="flex justify-between text-xs mb-2">
                <span style={{ color: T.t2 }}>Consommation ce mois</span>
                <span className="font-semibold" style={{ color: summary?.percent_used > 90 ? T.danger : T.t1 }}>
                  {formatCredits(summary?.consumed_this_month)} / {formatCredits(summary?.monthly_quota)} ({summary?.percent_used}%)
                </span>
              </div>
              <ProgressBar percent={summary?.percent_used || 0} warning={summary?.low_balance_warning} />
              {summary?.low_balance_warning && (
                <div className="flex items-center gap-2 mt-3 text-sm" style={{ color: T.warning }}>
                  <AlertTriangle className="w-4 h-4" />
                  Solde faible — pensez à recharger
                </div>
              )}
            </div>
          </div>
          <div className="pl-6 space-y-3" style={{ borderLeft: `1px solid ${T.border}` }}>
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: T.t3 }}>Prochain refill</p>
              <p className="text-sm flex items-center gap-2" style={{ color: T.t1 }}>
                <Calendar className="w-3.5 h-3.5" style={{ color: T.gold }} />
                {formatDate(summary?.next_refill_at)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: T.t3 }}>Lifetime consommé</p>
              <p className="text-sm" style={{ color: T.t1 }}>{formatCredits(summary?.total_consumed_lifetime)} crédits</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: T.t3 }}>Lifetime acheté</p>
              <p className="text-sm" style={{ color: T.t1 }}>{formatCredits(summary?.total_purchased_lifetime)} crédits</p>
            </div>
            <button
              onClick={() => setTab('packs')}
              className="w-full mt-4 py-2 rounded-lg font-semibold transition flex items-center justify-center gap-2"
              style={{ background: T.gold, color: '#000' }}
            >
              <ShoppingCart className="w-4 h-4" /> Recharger
            </button>
          </div>
        </div>
      </GradientCard>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 rounded-xl p-1 inline-flex" style={{ background: T.surface }}>
        {['overview','usage','history','packs','plans'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition"
            style={tab === t
              ? { background: T.goldDim, border: `1px solid ${T.goldMid}`, color: T.gold }
              : { background: 'transparent', border: '1px solid transparent', color: T.t2 }}
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

          {/* Dépassement à l'usage (overage) */}
          {overage && (
            <OverageManager
              overage={overage}
              busy={overageBusy}
              onToggle={(enabled) => handleOverage({ enabled }, enabled ? 'Dépassement activé' : 'Dépassement désactivé')}
              onSaveCap={(cap_eur) => handleOverage({ cap_eur }, 'Plafond enregistré')}
            />
          )}

          {/* Mini chart consommation par jour (sans dépendance, SVG inline) */}
          {stats.by_day?.length > 0 && (
            <div className="rounded-xl p-5" style={{ background: T.surfaceCard, border: `1px solid ${T.border}` }}>
              <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: T.t1 }}>
                <BarChart3 className="w-4 h-4" style={{ color: T.gold }} />
                Consommation quotidienne (30j)
              </h3>
              <DailyConsumptionChart data={stats.by_day} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl p-5" style={{ background: T.surfaceCard, border: `1px solid ${T.border}` }}>
              <h3 className="font-semibold mb-4" style={{ color: T.t1 }}>Top fonctions IA utilisées</h3>
              <div className="space-y-2">
                {(stats.by_function || []).slice(0, 8).map(f => (
                  <div key={f.name} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs" style={{ color: T.t2 }}>{f.name}</span>
                    <span className="font-semibold" style={{ color: T.gold }}>{formatCredits(f.credits)} ¢</span>
                  </div>
                ))}
                {!stats.by_function?.length && <p className="text-sm" style={{ color: T.t3 }}>Aucun usage encore.</p>}
              </div>
            </div>

            <div className="rounded-xl p-5" style={{ background: T.surfaceCard, border: `1px solid ${T.border}` }}>
              <h3 className="font-semibold mb-4" style={{ color: T.t1 }}>Top modèles IA</h3>
              <div className="space-y-2">
                {(stats.by_model || []).slice(0, 8).map(m => (
                  <div key={m.name} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs" style={{ color: T.t2 }}>{m.name}</span>
                    <span className="font-semibold" style={{ color: T.gold }}>{formatCredits(m.credits)} ¢</span>
                  </div>
                ))}
                {!stats.by_model?.length && <p className="text-sm" style={{ color: T.t3 }}>Aucun usage encore.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab : Usage events détaillés ────────────────────────── */}
      {tab === 'usage' && (
        <div className="rounded-xl overflow-hidden" style={{ background: T.surfaceCard, border: `1px solid ${T.border}` }}>
          <table className="w-full text-sm">
            <thead style={{ background: T.surfaceSoft }}>
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold uppercase text-xs" style={{ color: T.t3 }}>Date</th>
                <th className="px-4 py-3 font-semibold uppercase text-xs" style={{ color: T.t3 }}>Fonction</th>
                <th className="px-4 py-3 font-semibold uppercase text-xs" style={{ color: T.t3 }}>Modèle</th>
                <th className="px-4 py-3 font-semibold uppercase text-xs" style={{ color: T.t3 }}>Unités</th>
                <th className="px-4 py-3 font-semibold uppercase text-xs text-right" style={{ color: T.t3 }}>Coût</th>
              </tr>
            </thead>
            <tbody>
              {(transactions || []).filter(t => t.type === 'ai_usage').slice(0, 20).map(t => (
                <tr key={t.id} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td className="px-4 py-3 text-xs" style={{ color: T.t3 }}>{formatDate(t.created_at)}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: T.t1 }}>{t.description?.split(' ')[0] || '—'}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: T.t2 }}>{t.description?.match(/\(([^)]+)\)/)?.[1] || '—'}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: T.t3 }}>—</td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: T.danger }}>−{formatCredits(Math.abs(t.amount))}</td>
                </tr>
              ))}
              {!transactions.length && (
                <tr><td colSpan="5" className="text-center py-12" style={{ color: T.t3 }}>Aucun usage IA encore.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab : Historique transactions ──────────────────────── */}
      {tab === 'history' && (
        <div className="rounded-xl overflow-hidden" style={{ background: T.surfaceCard, border: `1px solid ${T.border}` }}>
          <table className="w-full text-sm">
            <thead style={{ background: T.surfaceSoft }}>
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold uppercase text-xs" style={{ color: T.t3 }}>Date</th>
                <th className="px-4 py-3 font-semibold uppercase text-xs" style={{ color: T.t3 }}>Type</th>
                <th className="px-4 py-3 font-semibold uppercase text-xs" style={{ color: T.t3 }}>Description</th>
                <th className="px-4 py-3 font-semibold uppercase text-xs text-right" style={{ color: T.t3 }}>Montant</th>
                <th className="px-4 py-3 font-semibold uppercase text-xs text-right" style={{ color: T.t3 }}>Solde</th>
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
                  <tr key={t.id} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td className="px-4 py-3 text-xs" style={{ color: T.t3 }}>{formatDate(t.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs font-medium"
                        style={{ color: isCredit ? T.success : T.warning }}>
                        <TypeIcon className="w-3 h-3" />
                        {typeLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: T.t2 }}>{t.description}</td>
                    <td className="px-4 py-3 text-right font-semibold"
                      style={{ color: isCredit ? T.success : T.danger }}>
                      {isCredit ? '+' : ''}{formatCredits(t.amount)}
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: T.t3 }}>{formatCredits(t.balance_after)}</td>
                  </tr>
                );
              })}
              {!transactions.length && (
                <tr><td colSpan="5" className="text-center py-12" style={{ color: T.t3 }}>Aucune transaction encore.</td></tr>
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
              <div key={p.id} className="rounded-xl p-6 transition"
                style={{
                  background: 'linear-gradient(135deg, rgba(212,175,55,0.10), rgba(25,39,52,0.5))',
                  border: `1px solid ${T.goldMid}`,
                }}>
                {p.bonus_label && (
                  <span className="inline-block text-xs font-bold px-2 py-1 rounded-md mb-3"
                    style={{ background: 'rgba(34,197,94,0.16)', color: T.success }}>
                    {p.bonus_label}
                  </span>
                )}
                <h3 className="font-bold text-lg mb-1" style={{ color: T.t1 }}>{p.label}</h3>
                <p className="text-3xl font-black my-3" style={{ color: T.gold }}>{formatCredits(p.credits_amount)}<span className="text-base font-normal" style={{ color: T.t2 }}> crédits</span></p>
                <p className="text-2xl font-bold mb-1" style={{ color: T.t1 }}>{formatPrice(p.price_cents, p.currency)}</p>
                <p className="text-xs mb-4" style={{ color: T.t3 }}>≈ {(pricePerCredit * 1000).toFixed(2)}€ / 1000 crédits</p>
                <button
                  onClick={() => handleTopup(p.key)}
                  disabled={topupLoading === p.key}
                  className="w-full disabled:opacity-50 py-2.5 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                  style={{ background: T.gold, color: '#000' }}
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
              <div key={p.plan_tier} className="rounded-xl p-6 transition"
                style={isCurrent
                  ? { background: T.goldDim, border: `1px solid ${T.gold}` }
                  : { background: T.surfaceCard, border: `1px solid ${T.border}` }}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-xl capitalize" style={{ color: T.t1 }}>{p.plan_tier}</h3>
                  {isCurrent && <Check className="w-5 h-5" style={{ color: T.gold }} />}
                </div>
                <p className="text-3xl font-black my-3" style={{ color: T.t1 }}>{formatCredits(p.monthly_credits)}</p>
                <p className="text-xs mb-2" style={{ color: T.t3 }}>crédits / mois</p>
                {parseFloat(p.rollover_max) > 0 && (
                  <p className="text-xs" style={{ color: T.success }}>+ {formatCredits(p.rollover_max)} report max</p>
                )}
                {p.allow_overage && (
                  <p className="text-xs mt-1" style={{ color: T.gold }}>✓ Overdraft autorisé</p>
                )}
                <p className="text-xs mt-4" style={{ color: T.t3 }}>{p.description}</p>
                {!isCurrent && (
                  <button
                    onClick={() => handlePlanChange(p.plan_tier)}
                    className="w-full mt-4 py-2 rounded-lg text-sm font-semibold transition"
                    style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.t1 }}
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
        <div className="mt-12 p-4 rounded-xl" style={{ background: 'rgba(245,158,11,0.10)', border: `1px solid rgba(245,158,11,0.30)` }}>
          <p className="text-xs mb-2 font-semibold" style={{ color: T.warning }}>🛠️ Outils dev</p>
          <button
            onClick={handleRefill}
            className="text-xs px-3 py-1 rounded-md"
            style={{ background: 'rgba(245,158,11,0.20)', color: T.warning }}
          >
            Forcer refill mensuel
          </button>
        </div>
      )}
    </TenantAdminShell>
  );
}
