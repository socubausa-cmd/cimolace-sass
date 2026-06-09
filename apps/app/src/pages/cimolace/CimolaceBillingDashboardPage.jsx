import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CreditCard, CheckCircle, Clock, FileText, RefreshCw, AlertCircle,
  Zap, Loader2, Building2, Boxes, Power,
} from 'lucide-react';
import { billingApi, tenantMembersApi, catalogApi } from '@/lib/api';
import { authStore } from '@/lib/auth-store';

const eur = (cents, cur = 'EUR') => {
  try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur }).format((Number(cents) || 0) / 100); }
  catch { return `${((Number(cents) || 0) / 100).toFixed(2)} ${cur}`; }
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

const STATUS = {
  active: { label: 'Actif', cls: 'bg-green-500/20 border-green-500/30 text-green-400' },
  pending: { label: 'À payer', cls: 'bg-amber-500/20 border-amber-500/30 text-amber-400' },
  past_due: { label: 'En retard', cls: 'bg-orange-500/20 border-orange-500/30 text-orange-400' },
  canceled: { label: 'Annulé', cls: 'bg-white/10 border-white/20 text-white/50' },
  expired: { label: 'Expiré', cls: 'bg-red-500/20 border-red-500/30 text-red-400' },
  paused: { label: 'En pause', cls: 'bg-white/10 border-white/20 text-white/50' },
  paid: { label: 'Payé', cls: 'bg-green-500/20 border-green-500/30 text-green-400' },
  processing: { label: 'En cours', cls: 'bg-amber-500/20 border-amber-500/30 text-amber-400' },
  failed: { label: 'Échoué', cls: 'bg-red-500/20 border-red-500/30 text-red-400' },
};
const badge = (s) => STATUS[String(s)] || { label: String(s || '—'), cls: 'bg-white/10 border-white/20 text-white/60' };
const tslug = (t) => t?.slug || t?.tenant?.slug || '';
const tname = (t) => t?.name || t?.tenant?.name || tslug(t);

const SERVICE_LABELS = {
  med_ehr: 'MEDOS — Dossiers patients', med_notes: 'MEDOS — Notes SOAP', med_health: 'MEDOS — Journal de santé',
  med_forms: 'MEDOS — Formulaires', med_programs: 'MEDOS — Programmes de soins', wellness_engine: 'Wellness Engine',
  mbolo: 'Mbolo — Boutique e-commerce', mbolo_storefront: 'Mbolo — Storefront', twin: 'Bio Digital Twin',
  liri_live: 'LIRI Live', liri_smartboard: 'SmartBoard', school_engine: 'Moteur École',
};
const serviceName = (k) => SERVICE_LABELS[k] || String(k || '').replace(/_/g, ' ');

const TABS = [
  { id: 'abonnement', label: 'Abonnement', icon: CreditCard },
  { id: 'moteurs', label: 'Moteurs', icon: Boxes },
  { id: 'factures', label: 'Factures', icon: FileText },
];

export default function CimolaceBillingDashboardPage() {
  const [tenants, setTenants] = useState([]);
  const [activeSlug, setActiveSlug] = useState('');
  const [tab, setTab] = useState('abonnement');
  const [subs, setSubs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [payingId, setPayingId] = useState(null);
  const [params, setParams] = useSearchParams();

  const loadAll = useCallback(async (slug) => {
    setLoading(true); setError(null);
    try {
      if (slug && authStore.setTenantSlug) authStore.setTenantSlug(slug);
      const [plan, svc] = await Promise.all([
        billingApi.getPlan().catch(() => ({ subscriptions: [], invoices: [] })),
        catalogApi.tenantServices().catch(() => []),
      ]);
      setSubs(Array.isArray(plan?.subscriptions) ? plan.subscriptions : []);
      setInvoices(Array.isArray(plan?.invoices) ? plan.invoices : []);
      setServices(Array.isArray(svc) ? svc : []);
    } catch (e) {
      setError(e?.message || 'Chargement impossible');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    (async () => {
      const mine = await tenantMembersApi.getMyTenants().catch(() => []);
      const list = (Array.isArray(mine) ? mine : []).map((t) => ({ slug: tslug(t), name: tname(t) })).filter((t) => t.slug);
      setTenants(list);
      const stored = authStore.getTenantSlug ? authStore.getTenantSlug() : '';
      const initial = list.find((t) => t.slug === stored)?.slug || list[0]?.slug || stored || '';
      setActiveSlug(initial);

      const card = params.get('card'); const subId = params.get('sub');
      const clean = () => { ['card', 'sub', 'session_id'].forEach((k) => params.delete(k)); setParams(params, { replace: true }); };
      if (card === 'success' && subId) {
        try { if (initial && authStore.setTenantSlug) authStore.setTenantSlug(initial); const r = await billingApi.cardConfirm(subId); setNotice(r?.paid ? '✅ Paiement confirmé — votre forfait est actif.' : 'Paiement reçu, confirmation en cours…'); }
        catch { setNotice('Paiement reçu, confirmation en cours…'); }
        clean();
      } else if (card === 'cancel') { setNotice('Paiement annulé.'); clean(); }
      await loadAll(initial);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTenant = (slug) => { setActiveSlug(slug); setNotice(null); loadAll(slug); };

  const pay = async (sub) => {
    setPayingId(sub.id); setError(null);
    try {
      if (activeSlug && authStore.setTenantSlug) authStore.setTenantSlug(activeSlug);
      const { url } = await billingApi.cardCheckout(sub.id);
      if (url) window.location.href = url; else throw new Error('Lien de paiement indisponible');
    } catch (e) { setError(e?.message || 'Impossible de démarrer le paiement'); setPayingId(null); }
  };

  const planName = (s) => s?.metadata?.label || s?.plan_id || 'Abonnement';
  const activeName = tenants.find((t) => t.slug === activeSlug)?.name || activeSlug || '—';
  const activeSubs = subs.filter((s) => s.status === 'active');

  return (
    <>
      <Helmet><title>Espace {activeName} | CIMOLACE</title></Helmet>
      <div className="min-h-screen bg-[#050507] text-white">
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-xl bg-[#050507]/80 border-b border-white/[0.04]">
          <Link to="/cimolace" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center"><Zap className="w-3.5 h-3.5 text-white" /></div>
            <span className="text-sm font-black tracking-tight">CIMOLACE</span>
          </Link>
          <button onClick={() => loadAll(activeSlug)} className="text-xs text-white/40 hover:text-white/80 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Rafraîchir</button>
        </nav>

        <div className="pt-24 pb-12 px-6">
          <div className="max-w-4xl mx-auto">
            {/* En-tête espace */}
            <div className="mb-6">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-violet-300/80 mb-1"><Building2 className="w-3.5 h-3.5" /> Espace tenant</div>
              <h1 className="text-3xl font-black">{activeName}</h1>
              <p className="text-white/50 text-sm mt-1">Back-office Cimolace · abonnement, moteurs et factures de votre infrastructure.</p>
              {tenants.length > 1 && (
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-white/40">Changer d'espace :</span>
                  {tenants.map((t) => (
                    <button key={t.slug} onClick={() => switchTenant(t.slug)}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${t.slug === activeSlug ? 'bg-violet-500/25 border-violet-500/40 text-white' : 'bg-white/[0.03] border-white/[0.08] text-white/60 hover:text-white'}`}>{t.name}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Onglets */}
            <div className="flex gap-2 border-b border-white/[0.06] mb-6">
              {TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    className={`px-4 py-2.5 text-sm font-semibold flex items-center gap-2 border-b-2 -mb-px ${tab === t.id ? 'border-violet-500 text-white' : 'border-transparent text-white/45 hover:text-white/80'}`}>
                    <Icon className="w-4 h-4" /> {t.label}
                  </button>
                );
              })}
            </div>

            {notice && <div className="mb-6 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> {notice}</div>}
            {error && <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

            {loading ? (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 flex items-center gap-2 text-white/60"><RefreshCw className="w-4 h-4 animate-spin" /> Chargement…</div>
            ) : (
              <>
                {/* ABONNEMENT */}
                {tab === 'abonnement' && (
                  subs.length === 0 ? <Empty>Aucun abonnement pour cet espace.</Empty> : (
                    <div className="space-y-4">
                      {subs.map((s) => {
                        const b = badge(s.status); const payable = s.status === 'pending' || s.status === 'past_due';
                        return (
                          <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div>
                                <div className="flex items-center gap-2 mb-1"><span className="text-xl font-black capitalize">{planName(s)}</span><span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${b.cls}`}>{b.label}</span></div>
                                <div className="text-sm text-white/60">{eur(s.amount_cents, s.currency)} / mois{s.current_period_end ? ` · échéance ${fmtDate(s.current_period_end)}` : ''}{s.provider ? ` · ${s.provider}` : ''}</div>
                              </div>
                              {payable ? (
                                <button onClick={() => pay(s)} disabled={payingId === s.id} className="px-5 py-3 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-violet-500/25 flex items-center gap-2 disabled:opacity-60">
                                  {payingId === s.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />} Payer par carte
                                </button>
                              ) : s.status === 'active' ? <span className="flex items-center gap-1 text-green-400 text-sm font-medium"><CheckCircle className="w-4 h-4" /> Service actif</span> : null}
                            </div>
                          </motion.div>
                        );
                      })}
                      <p className="text-xs text-white/40 pt-1">Paiement sécurisé par Stripe. En mode test : carte <code className="text-white/60">4242 4242 4242 4242</code>, date future, CVC quelconque.</p>
                    </div>
                  )
                )}

                {/* MOTEURS */}
                {tab === 'moteurs' && (
                  services.length === 0 ? <Empty>Aucun moteur activé pour cet espace.</Empty> : (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {services.map((sv) => {
                        const on = sv.active === true || sv.status === 'active';
                        return (
                          <div key={sv.id || sv.service_key} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${on ? 'bg-green-500/15 text-green-400' : 'bg-white/[0.05] text-white/40'}`}><Power className="w-4 h-4" /></div>
                              <div><p className="font-semibold text-sm">{serviceName(sv.service_key)}</p><p className="text-xs text-white/40">{sv.service_key}</p></div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${on ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-white/10 border-white/20 text-white/50'}`}>{on ? 'Activé' : 'Inactif'}</span>
                          </div>
                        );
                      })}
                      <p className="sm:col-span-2 text-xs text-white/40">{activeSubs.length ? 'Moteurs inclus dans votre forfait actif.' : 'Activez un abonnement pour débloquer vos moteurs.'}</p>
                    </div>
                  )
                )}

                {/* FACTURES */}
                {tab === 'factures' && (
                  invoices.length === 0 ? <Empty>Aucune facture.</Empty> : (
                    <div className="space-y-3">
                      {invoices.map((inv) => {
                        const b = badge(inv.status);
                        return (
                          <div key={inv.id} className="flex items-center justify-between p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] gap-3 flex-wrap">
                            <div className="flex items-center gap-3">{inv.status === 'paid' ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Clock className="w-5 h-5 text-amber-400" />}
                              <div><p className="font-medium">{inv.invoice_number || inv.description || 'Facture'}</p><p className="text-xs text-white/50">{inv.paid_at ? `Payée le ${fmtDate(inv.paid_at)}` : `Échéance ${fmtDate(inv.due_date)}`}</p></div>
                            </div>
                            <div className="flex items-center gap-3"><span className="font-medium">{eur(inv.amount_cents, inv.currency)}</span><span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${b.cls}`}>{b.label}</span></div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Empty({ children }) {
  return <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 text-white/60">{children}</div>;
}
