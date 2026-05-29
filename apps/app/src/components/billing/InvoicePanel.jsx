/**
 * InvoicePanel
 * Shows all confirmed payment invoices for the authenticated user.
 * Accessible from the student dashboard or billing page.
 */
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { FileText, Download, Loader2, AlertTriangle, ExternalLink, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const CURRENCY_LABEL = { XAF: 'FCFA', EUR: '€', USD: '$', MAD: 'MAD' };
function fmtAmount(amount, currency = 'XAF') {
  const sym = CURRENCY_LABEL[String(currency).toUpperCase()] || currency;
  if (currency === 'EUR') return `${Number(amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${sym}`;
  return `${Number(amount || 0).toLocaleString('fr-FR')} ${sym}`;
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
}
function typeLabel(purchaseType) {
  const t = String(purchaseType || '').toLowerCase();
  if (t === 'formation_one_time') return 'Formation';
  if (t === 'renewal') return 'Renouvellement';
  if (t.includes('subscription') || t.includes('abonnement')) return 'Abonnement';
  return 'Service';
}

export default function InvoicePanel() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    if (!session?.access_token) return;
    setLoading(true);
    setError('');
    fetch('/.netlify/functions/billing-my-invoices', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setInvoices(data.invoices || []);
      })
      .catch((e) => setError(e.message || 'Impossible de charger les factures'))
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  const openInvoice = async (paymentId, invoiceNumber) => {
    if (!session?.access_token) return;
    setDownloadingId(paymentId);
    try {
      const res = await fetch(`/.netlify/functions/billing-invoice-download?paymentId=${encodeURIComponent(paymentId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Impossible de télécharger la facture');
      }
      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `facture-${invoiceNumber}.html`;
      a.target = '_blank';
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Facture téléchargée', description: `${invoiceNumber} — ouverture dans le navigateur.` });
    } catch (e) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setDownloadingId(null);
    }
  };

  if (!session?.access_token) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/15 flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4 text-[#D4AF37]" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">Mes factures</h2>
          <p className="text-xs text-gray-500">Historique de vos paiements confirmés</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10 text-gray-500 gap-2 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-[#D4AF37]" /> Chargement…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-center gap-2 text-red-300 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {!loading && !error && invoices.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/3 px-5 py-8 text-center">
          <FileText className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Aucune facture pour l&apos;instant</p>
          <p className="text-xs text-gray-600 mt-1">Vos factures apparaîtront ici après chaque paiement confirmé.</p>
        </div>
      )}

      {!loading && invoices.length > 0 && (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          {invoices.map((inv, idx) => (
            <div
              key={inv.paymentId}
              className={`flex items-center gap-4 px-4 py-3.5 ${idx < invoices.length - 1 ? 'border-b border-white/8' : ''} hover:bg-white/3 transition-colors`}
            >
              {/* Icon */}
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-[#D4AF37] font-semibold">{inv.invoiceNumber}</span>
                  <span className="text-[10px] bg-white/8 text-gray-400 px-1.5 py-0.5 rounded-full">
                    {typeLabel(inv.purchaseType)}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {inv.formationTitle || inv.planName || 'Service LIRI'} · {fmtDate(inv.paidAt)}
                </p>
              </div>

              {/* Amount */}
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-white">{fmtAmount(inv.amount, inv.currency)}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">{inv.paymentMethod || '—'}</p>
              </div>

              {/* Download */}
              <Button
                size="sm"
                variant="ghost"
                className="flex-shrink-0 border border-white/10 hover:border-[#D4AF37]/40 hover:text-[#D4AF37] text-gray-400 h-8 px-2"
                onClick={() => openInvoice(inv.paymentId, inv.invoiceNumber)}
                disabled={downloadingId === inv.paymentId}
                title="Télécharger la facture"
              >
                {downloadingId === inv.paymentId
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Download className="w-3.5 h-3.5" />
                }
              </Button>
            </div>
          ))}
        </div>
      )}

      {!loading && invoices.length > 0 && (
        <p className="text-[11px] text-gray-600 text-center">
          Les factures sont générées automatiquement et également envoyées à votre adresse email.
        </p>
      )}
    </div>
  );
}
