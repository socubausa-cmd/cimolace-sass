import { useCallback, useEffect, useState } from 'react';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';

function mapPaymentRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((p) => ({
    id: p.id,
    name: p.invoice_number || p.provider_invoice_id || `Facture ${String(p.id).slice(0, 8).toUpperCase()}`,
    date: isValid(new Date(p.created_at)) ? format(new Date(p.created_at), 'dd/MM/yyyy', { locale: fr }) : '',
    size: `${Number(p.amount_cents || 0) / 100} ${p.currency || 'XAF'}`,
    url: null,
    kind: 'invoice',
    paymentId: p.id,
    invoiceSentAt: p.paid_at,
    invoiceStudentNotReceivedAt: null,
    invoiceLastEmailedAt: null,
  }));
}

function mapReportRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ({
    id: r.id,
    name: `Compte rendu live ${String(r.live_session_id || '').slice(0, 8)}`,
    date: isValid(new Date(r.created_at)) ? format(new Date(r.created_at), 'dd/MM/yyyy', { locale: fr }) : '',
    size: `${Math.max(1, Math.ceil(String(r.report_text || '').length / 1024))} KB`,
    url: null,
  }));
}

function mapCertificateRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((c) => ({
    id: c.id,
    name: c.title || 'Certificat',
    date: isValid(new Date(c.issued_at || c.created_at))
      ? format(new Date(c.issued_at || c.created_at), 'dd/MM/yyyy', { locale: fr })
      : '',
    size: 'PDF',
    url: c.file_url || null,
  }));
}

const PAYMENT_SELECT =
  'id,invoice_number,provider_invoice_id,created_at,amount_cents,currency,status,paid_at';

/**
 * Factures confirmées, comptes rendus live, certificats — même requêtes et mapping
 * que `StudentDocumentsPage` (web) et `EleveEtudiantDocumentsScreen` (LIRI mobile).
 */
export function useStudentDocumentsParityData(userId) {
  const [docs, setDocs] = useState({ admin: [], academic: [], resources: [] });
  const [loading, setLoading] = useState(!!userId);

  const loadAll = useCallback(async () => {
    if (!userId) {
      setDocs({ admin: [], academic: [], resources: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    // billing_invoices.tenant_id → tenants.id (platform UUID), not profile IDs.
    // Resolve subscription IDs first, then filter invoices by subscription_id.
    const { data: userSubs } = await supabase
      .from('billing_subscriptions').select('id').eq('user_id', userId);
    const subIds = (userSubs || []).map(s => s.id);
    const invoicesQuery = subIds.length > 0
      ? supabase
          .from('billing_invoices')
          .select(PAYMENT_SELECT)
          .in('subscription_id', subIds)
          .in('status', ['paid', 'confirmed'])
          .order('created_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null });
    const [paymentsRes, reportsRes, certsRes] = await Promise.all([
      invoicesQuery,
      supabase
        .from('student_live_reports')
        .select('id,live_session_id,report_text,created_at')
        .eq('student_id', userId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('certificates')
        .select('id,title,file_url,issued_at,created_at,student_id')
        .eq('student_id', userId)
        .order('issued_at', { ascending: false })
        .limit(100),
    ]);

    setDocs({
      admin: mapPaymentRows(paymentsRes.error ? [] : paymentsRes.data),
      academic: mapReportRows(reportsRes.error ? [] : reportsRes.data),
      resources: mapCertificateRows(certsRes.error ? [] : certsRes.data),
    });
    setLoading(false);
  }, [userId]);

  const refreshInvoices = useCallback(async () => {
    if (!userId) return;
    const { data: userSubs } = await supabase
      .from('billing_subscriptions').select('id').eq('user_id', userId);
    const subIds = (userSubs || []).map(s => s.id);
    const paymentsRes = subIds.length > 0
      ? await supabase
          .from('billing_invoices')
          .select(PAYMENT_SELECT)
          .in('subscription_id', subIds)
          .in('status', ['paid', 'confirmed'])
          .order('created_at', { ascending: false })
          .limit(100)
      : { data: [], error: null };
    setDocs((prev) => ({
      ...prev,
      admin: mapPaymentRows(paymentsRes.error ? [] : paymentsRes.data),
    }));
  }, [userId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  return { docs, loading, refresh: loadAll, refreshInvoices };
}
