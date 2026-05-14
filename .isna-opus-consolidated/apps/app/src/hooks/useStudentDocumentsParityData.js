import { useCallback, useEffect, useState } from 'react';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';

function mapPaymentRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((p) => ({
    id: p.id,
    name: p.provider_invoice_number || `Facture ${String(p.id).slice(0, 8).toUpperCase()}`,
    date: isValid(new Date(p.created_at)) ? format(new Date(p.created_at), 'dd/MM/yyyy', { locale: fr }) : '',
    size: `${Number(p.price_amount || 0)} ${p.price_currency || 'XAF'}`,
    url: p.provider_invoice_url,
    kind: 'invoice',
    paymentId: p.id,
    invoiceSentAt: p.invoice_sent_at,
    invoiceStudentNotReceivedAt: p.invoice_student_not_received_at,
    invoiceLastEmailedAt: p.invoice_last_emailed_at,
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
  'id,provider_invoice_number,provider_invoice_url,created_at,price_amount,price_currency,payment_status,invoice_sent_at,invoice_student_not_received_at,invoice_last_emailed_at';

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
    const [paymentsRes, reportsRes, certsRes] = await Promise.all([
      supabase
        .from('billing_payments')
        .select(PAYMENT_SELECT)
        .eq('user_id', userId)
        .eq('payment_status', 'confirmed')
        .order('created_at', { ascending: false })
        .limit(100),
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
    const paymentsRes = await supabase
      .from('billing_payments')
      .select(PAYMENT_SELECT)
      .eq('user_id', userId)
      .eq('payment_status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(100);
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
