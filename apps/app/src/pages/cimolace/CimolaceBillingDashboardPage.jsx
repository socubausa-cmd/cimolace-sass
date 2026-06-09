import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CreditCard, CheckCircle, Clock, FileText, RefreshCw,
  AlertCircle, Zap, ChevronLeft, Loader2,
} from 'lucide-react';
import { billingApi, tenantMembersApi } from '@/lib/api';
import { authStore } from '@/lib/auth-store';

const eur = (cents, cur = 'EUR') => {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur }).format((Number(cents) || 0) / 100);
  } catch {
    return `${((Number(cents) || 0) / 100).toFixed(2)} ${cur}`;
  }
};
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

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

export default function CimolaceBillingDashboardPage() {
  const [subs, setSubs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [payingId, setPayingId] = useState(null);
  const [params, setParams] = useSearchParams();

  // Pose X-Tenant-Slug (sinon l'API billing ignore quel tenant interroger).
  const ensureTenant = useCallback(async () => {
    let slug = authStore.getTenantSlug ? authStore.getTenantSlug() : '';
    if (!slug) {
      const mine = await tenantMembersApi.getMyTenants().catch(() => []);
      slug = (Array.isArray(mine) && mine[0] && (mine[0].slug || mine[0].tenant?.slug)) || '';
      if (slug && authStore.setTenantSlug) authStore.setTenantSlug(slug);
    }
    return slug;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureTenant();
      const data = await billingApi.getPlan();
      setSubs(Array.isArray(data?.subscriptions) ? data.subscriptions : []);
      setInvoices(Array.isArray(data?.invoices) ? data.invoices : []);
    } catch (e) {
      setError(e?.message || 'Chargement de la facturation impossible');
    } finally {
      setLoading(false);
    }
  }, [ensureTenant]);

  // Retour depuis Stripe Checkout (success/cancel), puis chargement.
  useEffect(() => {
    const card = params.get('card');
    const subId = params.get('sub');
    const clean = () => {
      ['card', 'sub', 'session_id'].forEach((k) => params.delete(k));
      setParams(params, { replace: true });
    };
    if (card === 'success' && subId) {
      (async () => {
        try {
          await ensureTenant();
          const r = await billingApi.cardConfirm(subId);
          setNotice(r?.paid ? '✅ Paiement confirmé — votre forfait est actif.' : 'Paiement reçu, confirmation en cours…');
        } catch {
          setNotice('Paiement reçu, confirmation en cours…');
        } finally {
          clean();
          load();
        }
      })();
    } else if (card === 'cancel') {
      setNotice('Paiement annulé.');
      clean();
      load();
    } else {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pay = async (sub) => {
    setPayingId(sub.id);
    setError(null);
    try {
      await ensureTenant();
      const { url } = await billingApi.cardCheckout(sub.id);
      if (url) window.location.href = url;
      else throw new Error('Lien de paiement indisponible');
    } catch (e) {
      setError(e?.message || 'Impossible de démarrer le paiement');
      setPayingId(null);
    }
  };

  const planName = (s) =>
    s?.metadata?.label || s?.plan_id || 'Abonnement';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050507] text-white flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Facturation | CIMOLACE</title>
        <meta name="description" content="Gérez votre abonnement et payez par carte" />
      </Helmet>

      <div className="min-h-screen bg-[#050507] text-white">
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-xl bg-[#050507]/80 border-b border-white/[0.04]">
          <Link to="/cimolace" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-black tracking-tight">CIMOLACE</span>
          </Link>
          <button
            onClick={load}
            className="text-xs text-white/40 hover:text-white/80 transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Rafraîchir
          </button>
        </nav>

        <div className="pt-24 pb-12 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-black mb-2">Facturation & Abonnement</h1>
              <p className="text-white/60">Payez et activez vos services Cimolace par carte.</p>
            </div>

            {notice && (
              <div className="mb-6 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> {notice}
              </div>
            )}
            {error && (
              <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}

            {/* Abonnements */}
            <h2 className="text-lg font-bold mb-3">Vos abonnements</h2>
            {subs.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 text-white/60">
                Aucun abonnement pour le moment.
              </div>
            ) : (
              <div className="space-y-4 mb-8">
                {subs.map((s) => {
                  const b = badge(s.status);
                  const payable = s.status === 'pending' || s.status === 'past_due';
                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6"
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl font-black capitalize">{planName(s)}</span>
                            <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${b.cls}`}>{b.label}</span>
                          </div>
                          <div className="text-sm text-white/60">
                            {eur(s.amount_cents, s.currency)} / mois
                            {s.current_period_end ? ` · échéance ${fmtDate(s.current_period_end)}` : ''}
                            {s.provider ? ` · ${s.provider}` : ''}
                          </div>
                        </div>
                        {payable && (
                          <button
                            onClick={() => pay(s)}
                            disabled={payingId === s.id}
                            className="px-5 py-3 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                          >
                            {payingId === s.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                            Payer par carte
                          </button>
                        )}
                        {s.status === 'active' && (
                          <span className="flex items-center gap-1 text-green-400 text-sm font-medium">
                            <CheckCircle className="w-4 h-4" /> Service actif
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Factures */}
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5" /> Factures
            </h2>
            {invoices.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 text-white/60">
                Aucune facture.
              </div>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv) => {
                  const b = badge(inv.status);
                  return (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] gap-3 flex-wrap"
                    >
                      <div className="flex items-center gap-3">
                        {inv.status === 'paid' ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Clock className="w-5 h-5 text-amber-400" />}
                        <div>
                          <p className="font-medium">{inv.invoice_number || inv.description || 'Facture'}</p>
                          <p className="text-xs text-white/50">
                            {inv.paid_at ? `Payée le ${fmtDate(inv.paid_at)}` : `Échéance ${fmtDate(inv.due_date)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{eur(inv.amount_cents, inv.currency)}</span>
                        <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${b.cls}`}>{b.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="mt-8 text-xs text-white/40">
              Paiement sécurisé par Stripe. En mode test, utilisez la carte <code className="text-white/60">4242 4242 4242 4242</code>, date future, CVC quelconque.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
