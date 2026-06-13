import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { fetchTenantContext } from '@/lib/tenant/fetchTenantContext';
import DataTable from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw, CreditCard, Repeat2, Webhook, Link2, Loader2, AlertTriangle } from 'lucide-react';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';

const pill = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'confirmed' || s === 'active') return 'bg-green-500/20 text-green-400 border-green-500/30';
  if (s === 'confirming') return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
  if (s === 'pending') return 'bg-white/10 text-gray-300 border-white/10';
  if (s === 'failed' || s === 'canceled') return 'bg-red-500/20 text-red-300 border-red-500/30';
  if (s === 'expired' || s === 'past_due') return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  return 'bg-white/10 text-gray-300 border-white/10';
};

export default function AdminBillingPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [subs, setSubs] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [dlqLoading, setDlqLoading] = useState(false);
  const [dlqStatus, setDlqStatus] = useState('pending'); // pending | dead | all
  const [dlqItems, setDlqItems] = useState([]);
  const [externalChariowRows, setExternalChariowRows] = useState([]);
  const allowedTabs = ['payments', 'subs', 'webhooks', 'dlq', 'external'];
  const [activeTab, setActiveTab] = useState(() => {
    const q = String(searchParams.get('tab') || '').toLowerCase();
    return allowedTabs.includes(q) ? q : 'payments';
  });
  const [attachLoadingId, setAttachLoadingId] = useState(null);
  const [selectedExternalIds, setSelectedExternalIds] = useState([]);
  const [bulkAttachRunning, setBulkAttachRunning] = useState(false);
  const [bulkAttachReport, setBulkAttachReport] = useState(null);

  const loadDlq = async (nextStatus = dlqStatus) => {
    setDlqLoading(true);
    try {
      const { data: sessData } = await supabase.auth.getSession();
      const token = sessData?.session?.access_token;
      if (!token) throw new Error('Session admin manquante');

      const res = await fetch(
        `/.netlify/functions/billing-webhook-dlq-admin?status=${encodeURIComponent(nextStatus || 'pending')}&limit=200`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Chargement DLQ impossible');
      setDlqItems(Array.isArray(payload?.items) ? payload.items : []);
    } catch (e) {
      toast({ title: 'DLQ', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setDlqLoading(false);
    }
  };

  const dlqAction = async (action, id) => {
    if (!id) return;
    try {
      const { data: sessData } = await supabase.auth.getSession();
      const token = sessData?.session?.access_token;
      if (!token) throw new Error('Session admin manquante');
      const res = await fetch('/.netlify/functions/billing-webhook-dlq-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, id }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Action DLQ impossible');
      await loadDlq();
    } catch (e) {
      toast({ title: 'DLQ action', description: String(e?.message || e), variant: 'destructive' });
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [pRes, sRes, wRes] = await Promise.all([
        supabase
          .from('billing_invoices')
          .select('id,created_at,provider,status,amount_cents,currency,tenant_id,invoice_number,provider_invoice_id,paid_at,subscription_id')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('billing_subscriptions')
          .select('id,created_at,user_id,provider,status,plan_id,current_period_start,current_period_end,metadata')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('billing_webhook_logs')
          .select('id,created_at,provider,event_type,signature_valid,processed,error_message,payload')
          .order('created_at', { ascending: false })
          .limit(400),
      ]);
      if (pRes.error) throw pRes.error;
      if (sRes.error) throw sRes.error;
      if (wRes.error) throw wRes.error;
      setPayments(pRes.data || []);
      setSubs(sRes.data || []);
      setWebhooks(wRes.data || []);
      setExternalChariowRows(
        (wRes.data || []).filter((w) => {
          const provider = String(w?.provider || '').toLowerCase();
          const msg = String(w?.error_message || '').toLowerCase();
          return provider === 'chariow' && (msg.includes('external sale unresolved') || msg.includes('payment not found'));
        })
      );
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Chargement impossible', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab !== 'dlq') return;
    void loadDlq();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    const q = String(searchParams.get('tab') || '').toLowerCase();
    if (allowedTabs.includes(q) && q !== activeTab) setActiveTab(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const current = String(searchParams.get('tab') || '').toLowerCase();
    if (current === activeTab) return;
    const next = new URLSearchParams(searchParams);
    next.set('tab', activeTab);
    setSearchParams(next, { replace: true });
  }, [activeTab, searchParams, setSearchParams]);

  useEffect(() => {
    setSelectedExternalIds((prev) => prev.filter((id) => externalChariowRows.some((row) => row.id === id)));
  }, [externalChariowRows]);

  const paymentColumns = useMemo(() => [
    { key: 'created_at', label: 'Date', render: (v) => new Date(v).toLocaleString() },
    { key: 'provider', label: 'Provider' },
    { key: 'purchase_type', label: 'Type' },
    { key: 'payment_method', label: 'Méthode' },
    { key: 'payment_status', label: 'Statut', render: (v) => <Badge className={pill(v)}>{String(v || '')}</Badge> },
    { key: 'price_amount', label: 'Fiat', render: (v, row) => `${v} ${row.price_currency}` },
    { key: 'pay_amount', label: 'Crypto', render: (v, row) => v ? `${v} ${String(row.pay_currency || '').toUpperCase()}` : '—' },
    { key: 'provider_license_key', label: 'Licence', render: (v) => v ? `${String(v).slice(0, 10)}…` : '—' },
    {
      key: 'provider_license_expires_at',
      label: 'Fin licence',
      render: (v) => (v ? new Date(v).toLocaleString() : '—'),
    },
    {
      key: 'license_activated_at',
      label: 'Activation licence',
      render: (v) => (v ? new Date(v).toLocaleString() : '—'),
    },
    { key: 'order_id', label: 'Order' },
    { key: 'formation_id', label: 'Formation', render: (v) => v ? `${String(v).slice(0, 8)}…` : '—' },
    { key: 'user_id', label: 'User', render: (v) => String(v || '').slice(0, 8) + '…' },
  ], []);

  const subColumns = useMemo(() => [
    { key: 'created_at', label: 'Créé', render: (v) => new Date(v).toLocaleString() },
    { key: 'status', label: 'Statut', render: (v) => <Badge className={pill(v)}>{String(v || '')}</Badge> },
    { key: 'provider', label: 'Provider' },
    { key: 'payment_method', label: 'Méthode' },
    { key: 'started_at', label: 'Début', render: (v) => v ? new Date(v).toLocaleString() : '—' },
    { key: 'current_period_end', label: 'Fin', render: (v) => v ? new Date(v).toLocaleString() : '—' },
    { key: 'provider_license_key', label: 'Licence', render: (v) => v ? `${String(v).slice(0, 10)}…` : '—' },
    { key: 'provider_license_expires_at', label: 'Fin licence', render: (v) => v ? new Date(v).toLocaleString() : '—' },
    { key: 'user_id', label: 'User', render: (v) => String(v || '').slice(0, 8) + '…' },
  ], []);

  const webhookColumns = useMemo(() => [
    { key: 'created_at', label: 'Date', render: (v) => new Date(v).toLocaleString() },
    { key: 'provider', label: 'Provider' },
    { key: 'event_type', label: 'Event' },
    { key: 'signature_valid', label: 'Signature', render: (v) => <Badge className={v ? pill('active') : pill('failed')}>{v ? 'OK' : 'KO'}</Badge> },
    { key: 'processed', label: 'Traitée', render: (v) => <Badge className={v ? pill('active') : pill('pending')}>{v ? 'Oui' : 'Non'}</Badge> },
    { key: 'error_message', label: 'Erreur', render: (v) => v || '—' },
  ], []);

  const extractExternalInfo = (row) => {
    const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {};
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
    const sale = data?.purchase || data?.sale || data || {};
    const email = sale?.customer?.email || data?.customer?.email || '-';
    const phone =
      sale?.customer?.phone?.number ||
      data?.customer?.phone?.number ||
      sale?.customer?.phone ||
      data?.customer?.phone ||
      '-';
    const product = sale?.product?.id || data?.product?.id || '-';
    const variant = sale?.variant?.id || data?.variant?.id || data?.product?.variant_id || '-';
    const providerPaymentId = sale?.id || data?.id || '-';
    return { email, phone, product, variant, providerPaymentId };
  };

  const attachExternalByLogId = async (logId, token, tenantSlug = '') => {
    const slug = tenantSlug ? String(tenantSlug).trim().toLowerCase() : '';
    const res = await fetch('/.netlify/functions/billing/chariow-attach-external', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(slug ? { 'X-Cimolace-Tenant-Slug': slug } : {}),
      },
      body: JSON.stringify({
        logId,
        ...(slug ? { tenant: slug } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Rattachement impossible');
    return data;
  };

  const handleAttachExternal = async (row) => {
    try {
      setAttachLoadingId(row.id);
      const { data: sessData } = await supabase.auth.getSession();
      const token = sessData?.session?.access_token;
      if (!token) throw new Error('Session admin manquante');
      const tenantCtx = await fetchTenantContext().catch(() => null);
      const tenantSlug = tenantCtx?.slug ? String(tenantCtx.slug).trim().toLowerCase() : '';
      const data = await attachExternalByLogId(row.id, token, tenantSlug);
      toast({
        title: 'Rattachement effectué',
        description: `Paiement ${data.paymentId ? String(data.paymentId).slice(0, 8) : ''} rattache avec succes.`,
      });
      await fetchAll();
    } catch (e) {
      toast({
        title: 'Echec rattachement',
        description: String(e?.message || 'Erreur'),
        variant: 'destructive',
      });
    } finally {
      setAttachLoadingId(null);
    }
  };

  const toggleExternalSelection = (id) => {
    setSelectedExternalIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const allExternalSelected = externalChariowRows.length > 0 && selectedExternalIds.length === externalChariowRows.length;

  const toggleSelectAllExternals = () => {
    if (allExternalSelected) {
      setSelectedExternalIds([]);
      return;
    }
    setSelectedExternalIds(externalChariowRows.map((r) => r.id));
  };

  const handleAttachSelectedExternals = async () => {
    if (!selectedExternalIds.length) return;
    setBulkAttachRunning(true);
    setBulkAttachReport(null);
    try {
      const { data: sessData } = await supabase.auth.getSession();
      const token = sessData?.session?.access_token;
      if (!token) throw new Error('Session admin manquante');

      const tenantCtx = await fetchTenantContext().catch(() => null);
      const tenantSlug = tenantCtx?.slug ? String(tenantCtx.slug).trim().toLowerCase() : '';

      const success = [];
      const failed = [];
      for (const logId of selectedExternalIds) {
        try {
          const result = await attachExternalByLogId(logId, token, tenantSlug);
          success.push({ logId, paymentId: result?.paymentId || null });
        } catch (e) {
          failed.push({ logId, error: String(e?.message || 'Erreur inconnue') });
        }
      }

      setBulkAttachReport({
        total: selectedExternalIds.length,
        success,
        failed,
      });
      setSelectedExternalIds([]);
      toast({
        title: 'Rattachement en masse terminé',
        description: `${success.length} succes, ${failed.length} echec(s).`,
        variant: failed.length ? 'destructive' : 'default',
      });
      await fetchAll();
    } catch (e) {
      toast({
        title: 'Echec du mode bulk',
        description: String(e?.message || 'Erreur'),
        variant: 'destructive',
      });
    } finally {
      setBulkAttachRunning(false);
    }
  };

  const handleExportBulkReportCsv = () => {
    if (!bulkAttachReport) return;
    const lines = [
      ['type', 'log_id', 'payment_id', 'error'],
      ...bulkAttachReport.success.map((row) => ['success', row.logId, row.paymentId || '', '']),
      ...bulkAttachReport.failed.map((row) => ['failed', row.logId, '', row.error || '']),
    ];
    const csv = lines
      .map((cols) =>
        cols
          .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chariow-external-bulk-report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRetryFailedFromReport = async () => {
    if (!bulkAttachReport?.failed?.length) return;
    const failedIds = bulkAttachReport.failed.map((f) => f.logId).filter(Boolean);
    if (!failedIds.length) return;
    setSelectedExternalIds(failedIds);
    setTimeout(() => {
      void handleAttachSelectedExternals();
    }, 0);
  };

  return (
    <div className="min-h-screen premium-dashboard-shell text-white p-6 pb-20">
      <Helmet><title>Billing | Admin</title></Helmet>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 premium-panel p-6">
          <div>
            <h1 className="text-2xl font-bold">Billing (Multi‑paiement)</h1>
            <p className="text-sm text-gray-400">CinetPay (Mobile Money) + NOWPayments (Monero).</p>
          </div>
          <Button onClick={fetchAll} variant="outline" className="border-white/10 text-white hover:bg-white/5" disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" /> Actualiser
          </Button>
        </div>

        <PremiumSegmentedSelector
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'payments', label: `Paiements (${payments.length})`, badge: 'Transactions', icon: CreditCard },
            { value: 'subs', label: `Abonnements (${subs.length})`, badge: 'Renouvellements', icon: Repeat2 },
            { value: 'webhooks', label: `Webhooks (${webhooks.length})`, badge: 'Synchronisation', icon: Webhook },
            { value: 'dlq', label: `DLQ (${dlqItems.length})`, badge: 'Rejeu', icon: AlertTriangle },
            { value: 'external', label: `Externes (${externalChariowRows.length})`, badge: 'Chariow hors site', icon: Link2 },
          ]}
          layoutId="admin-billing-segment-pill"
          className="max-w-3xl"
        />

        <div className="mt-4">
          {activeTab === 'payments' ? (
            <DataTable columns={paymentColumns} data={payments} searchFields={['payment_status', 'provider', 'order_id']} actions={false} itemsPerPage={20} />
          ) : null}
          {activeTab === 'subs' ? (
            <DataTable columns={subColumns} data={subs} searchFields={['status', 'provider', 'user_id']} actions={false} itemsPerPage={20} />
          ) : null}
          {activeTab === 'webhooks' ? (
            <DataTable columns={webhookColumns} data={webhooks} searchFields={['provider', 'event_type', 'error_message']} actions={false} itemsPerPage={20} />
          ) : null}
          {activeTab === 'dlq' ? (
            <div className="space-y-3">
              <div className="premium-panel border border-white/10 rounded-xl p-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-400">Statut :</span>
                  {['pending', 'dead', 'all'].map((s) => (
                    <button
                      key={`dlq-${s}`}
                      type="button"
                      onClick={() => {
                        setDlqStatus(s);
                        void loadDlq(s);
                      }}
                      className={`h-9 px-3 rounded-lg border text-sm ${
                        dlqStatus === s
                          ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-white'
                          : 'border-white/10 bg-black/20 text-gray-400 hover:bg-white/5'
                      }`}
                      disabled={dlqLoading}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => loadDlq()}
                    variant="outline"
                    className="border-white/10 text-white hover:bg-white/5"
                    disabled={dlqLoading}
                  >
                    {dlqLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    Actualiser DLQ
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-amber-500/40 text-amber-100 hover:bg-amber-500/10"
                    disabled={dlqLoading}
                    onClick={async () => {
                      try {
                        const { data: sessData } = await supabase.auth.getSession();
                        const token = sessData?.session?.access_token;
                        if (!token) throw new Error('Session admin manquante');
                        const res = await fetch('/.netlify/functions/billing-webhook-dlq-admin', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({ action: 'retry_all_pending', limit: 200 }),
                        });
                        const payload = await res.json().catch(() => ({}));
                        if (!res.ok) throw new Error(payload?.error || 'retry_all_pending failed');
                        toast({
                          title: 'DLQ',
                          description: `${payload.updated || 0} entrée(s) remises en file pour rejeu.`,
                        });
                        await loadDlq();
                      } catch (e) {
                        toast({ title: 'DLQ', description: String(e?.message || e), variant: 'destructive' });
                      }
                    }}
                  >
                    Retry all pending (200 max)
                  </Button>
                </div>
              </div>

              {dlqItems.length === 0 ? (
                <div className="premium-panel p-6 text-sm text-gray-400">Aucune entrée DLQ pour ce filtre.</div>
              ) : (
                <div className="space-y-2">
                  {dlqItems.map((row) => (
                    <div key={row.id} className="premium-panel rounded-xl p-4 border border-white/10">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div className="text-sm">
                          <div className="text-gray-300">
                            <span className="text-gray-500">Provider: </span>
                            <span className="font-semibold">{String(row.provider || '-')}</span>
                            <span className="text-gray-500 ml-3">Status: </span>
                            <Badge className={pill(row.status)}>{String(row.status || '')}</Badge>
                            <span className="text-gray-500 ml-3">Attempts: </span>
                            <span className="text-gray-200">{Number(row.attempts || 0)}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            id: {String(row.id).slice(0, 8)}… · event: {String(row.event_id || '').slice(0, 28)}…
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            next_retry_at: {row.next_retry_at ? new Date(row.next_retry_at).toLocaleString() : '—'}
                          </div>
                          {row.last_error ? (
                            <div className="text-xs text-amber-200 mt-2 break-words">{String(row.last_error).slice(0, 800)}</div>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            className="border-white/10 text-white hover:bg-white/5"
                            onClick={() => dlqAction('retry_now', row.id)}
                            disabled={dlqLoading}
                          >
                            Retry now
                          </Button>
                          <Button
                            variant="outline"
                            className="border-red-500/30 text-red-200 hover:bg-red-500/10"
                            onClick={() => dlqAction('mark_dead', row.id)}
                            disabled={dlqLoading}
                          >
                            Mark dead
                          </Button>
                          <Button
                            variant="outline"
                            className="border-white/10 text-white hover:bg-white/5"
                            onClick={() => dlqAction('delete', row.id)}
                            disabled={dlqLoading}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          {activeTab === 'external' ? (
            <div className="space-y-3">
              <div className="premium-panel border border-white/10 rounded-xl p-4 flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className="border-white/10 text-white hover:bg-white/5"
                  onClick={toggleSelectAllExternals}
                  disabled={bulkAttachRunning || externalChariowRows.length === 0}
                >
                  {allExternalSelected ? 'Tout deselectionner' : 'Tout selectionner'}
                </Button>
                <Button
                  className="bg-[#D4AF37] text-black hover:bg-yellow-500"
                  onClick={handleAttachSelectedExternals}
                  disabled={bulkAttachRunning || selectedExternalIds.length === 0}
                >
                  {bulkAttachRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Rattacher selection ({selectedExternalIds.length})
                </Button>
                <div className="text-xs text-gray-400">
                  Selection: {selectedExternalIds.length}/{externalChariowRows.length}
                </div>
              </div>

              {bulkAttachReport ? (
                <div className="premium-panel border border-white/10 rounded-xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-white font-semibold">
                      Rapport bulk: {bulkAttachReport.success.length} succes, {bulkAttachReport.failed.length} echec(s)
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {bulkAttachReport.failed.length > 0 ? (
                        <Button
                          variant="outline"
                          className="border-red-500/30 text-red-200 hover:bg-red-500/10"
                          onClick={handleRetryFailedFromReport}
                          disabled={bulkAttachRunning}
                        >
                          Retenter uniquement les echecs
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        className="border-white/10 text-white hover:bg-white/5"
                        onClick={handleExportBulkReportCsv}
                      >
                        Export CSV
                      </Button>
                    </div>
                  </div>
                  {bulkAttachReport.failed.length > 0 ? (
                    <div className="mt-2 text-xs text-red-200 space-y-1">
                      {bulkAttachReport.failed.slice(0, 6).map((f) => (
                        <p key={`fail-${f.logId}`}>
                          {String(f.logId).slice(0, 8)}... - {f.error}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {externalChariowRows.length === 0 ? (
                <div className="premium-panel p-6 text-sm text-gray-400">Aucun paiement externe Chariow non rattaché.</div>
              ) : (
                externalChariowRows.map((row) => {
                  const info = extractExternalInfo(row);
                  const isSelected = selectedExternalIds.includes(row.id);
                  return (
                    <div
                      key={row.id}
                      className={`premium-panel rounded-xl p-4 flex flex-col lg:flex-row lg:items-center gap-4 ${
                        isSelected ? 'border border-[#D4AF37]/60' : 'border border-white/10'
                      }`}
                    >
                      <div className="flex items-start pt-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleExternalSelection(row.id)}
                          disabled={bulkAttachRunning}
                          className="h-4 w-4 accent-[#D4AF37]"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-gray-300">
                          <span className="text-gray-500">Date: </span>{new Date(row.created_at).toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-300">
                          <span className="text-gray-500">Email: </span>{String(info.email)}
                          <span className="text-gray-500 ml-3">Téléphone: </span>{String(info.phone)}
                        </div>
                        <div className="text-sm text-gray-300">
                          <span className="text-gray-500">Produit: </span>{String(info.product)}
                          <span className="text-gray-500 ml-3">Variant: </span>{String(info.variant)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Provider payment: {String(info.providerPaymentId)}
                        </div>
                        <div className="text-xs text-amber-300 mt-1">{row.error_message || ''}</div>
                      </div>
                      <div>
                        <Button
                          onClick={() => handleAttachExternal(row)}
                          disabled={attachLoadingId === row.id || bulkAttachRunning}
                          className="bg-[#D4AF37] text-black hover:bg-yellow-500"
                        >
                          {attachLoadingId === row.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                          Rattacher auto
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

