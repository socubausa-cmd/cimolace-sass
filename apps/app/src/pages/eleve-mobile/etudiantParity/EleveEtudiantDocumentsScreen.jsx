import React, { useMemo, useState } from 'react';
import { Download, FileText, Loader2, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { supabase } from '@/lib/customSupabaseClient';
import { LiriPageFooterLine } from '@/components/brand/LiriWordmark';
import { useToast } from '@/components/ui/use-toast';
import { useStudentDocumentsParityData } from '@/hooks/useStudentDocumentsParityData';
import { EV_BG, EV_MUTED, EV_PAGE_AMBIENT, EV_R, listCardSurface } from '@/pages/eleve-mobile/vieScolaire/vieScolaireSharedUI.jsx';

/** Données inchangées dans le hook ; libellé FR pour les tailles type « 12 KB » (comptes rendus). */
function formatDocSizeMobileLabel(size) {
  return typeof size === 'string' && size.endsWith(' KB') ? `${size.slice(0, -3)} Ko` : size;
}

/**
 * Même chargement que `StudentDocumentsPage` (factures, comptes rendus, certificats) + actions facture
 * (RPC + fonction Netlify) quand la session le permet.
 * Route : `/m/eleve/etudiant/documents`
 */
export default function EleveEtudiantDocumentsScreen() {
  const { user, session } = useAuth();
  const { notifications: sync } = useDataSync();
  const { toast } = useToast();
  const inboxUnread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;
  const { docs, loading, refreshInvoices } = useStudentDocumentsParityData(user?.id);
  const { admin, academic, resources } = docs;
  const [reportId, setReportId] = useState(null);
  const [resendId, setResendId] = useState(null);

  const onDownload = (doc) => {
    if (doc.url) window.open(doc.url, '_blank', 'noopener,noreferrer');
  };

  const onReport = async (doc) => {
    if (!doc?.paymentId) return;
    setReportId(doc.paymentId);
    try {
      const { data, error } = await supabase.rpc('report_invoice_not_received', { p_payment_id: doc.paymentId });
      if (error) throw error;
      if (!data?.ok) {
        toast({
          title: 'Action impossible',
          description: data?.error === 'not_found_or_forbidden' ? 'Facture introuvable.' : 'Réessaie plus tard.',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Signalement enregistré', description: 'Le secrétariat en est informé.' });
      await refreshInvoices();
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible.', variant: 'destructive' });
    } finally {
      setReportId(null);
    }
  };

  const onResend = async (doc) => {
    if (!doc?.paymentId || !session?.access_token) return;
    setResendId(doc.paymentId);
    try {
      const res = await fetch('/.netlify/functions/billing-resend-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ paymentId: doc.paymentId }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) {
        toast({
          title: 'Patience',
          description: `Tu pourras redemander dans environ ${body.retryAfterHours || 24} h.`,
          variant: 'destructive',
        });
        return;
      }
      if (!res.ok) {
        toast({ title: 'Renvoi impossible', description: body.error || res.statusText, variant: 'destructive' });
        return;
      }
      toast({ title: 'Facture renvoyée', description: 'Vérifie ta boîte e-mail.' });
      await refreshInvoices();
    } catch (e) {
      toast({ title: 'Erreur réseau', description: e?.message || 'Réessaie plus tard.', variant: 'destructive' });
    } finally {
      setResendId(null);
    }
  };

  const allDocs = useMemo(
    () => [
      { section: 'Administration', key: 'adm', items: admin },
      { section: 'Pédagogie', key: 'aca', items: academic },
      { section: 'Certificats', key: 'res', items: resources },
    ],
    [academic, admin, resources],
  );

  return (
    <EleveMobileShell
      user={user}
      notificationCount={inboxUnread}
      contentClassName="!px-0"
      kicker="Espace étudiant"
      title="Documents"
      subtitle="Aligné sur le portail (billing, lives, certificats)"
    >
      <div
        className="w-full px-4 pb-2"
        style={{ backgroundColor: EV_BG, backgroundImage: EV_PAGE_AMBIENT, minHeight: '50dvh' }}
      >
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-violet-300" />
          </div>
        ) : (
          <div className="space-y-4">
            {allDocs.map((g) => (
              <div key={g.key}>
                <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-violet-300/90">{g.section}</p>
                {g.items.length === 0 ? (
                  <p className="text-sm font-medium" style={{ color: EV_MUTED }}>
                    Aucun document.
                  </p>
                ) : (
                  g.items.map((d) => (
                    <div key={`${g.key}-${d.id}`} className="mb-2 p-3" style={{ borderRadius: EV_R.lg, ...listCardSurface() }}>
                      <div className="flex items-start gap-2">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-bold text-white/95">{d.name}</p>
                          <p className="text-[10.5px] font-medium" style={{ color: EV_MUTED }}>
                            {d.date} · {formatDocSizeMobileLabel(d.size)}
                          </p>
                          {d.kind === 'invoice' ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {d.invoiceSentAt == null ? (
                                <span className="inline-flex items-center gap-0.5 rounded border border-amber-500/30 px-1.5 py-0.5 text-[8px] font-extrabold text-amber-200">
                                  <AlertCircle className="h-3 w-3" />
                                  Pas encore envoyée
                                </span>
                              ) : (
                                <span className="text-[8px] font-extrabold text-emerald-200/90">Envoyée par l'école</span>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {d.url ? (
                          <button
                            type="button"
                            onClick={() => onDownload(d)}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/12 bg-white/[0.05] px-2.5 py-1.5 text-[11px] font-bold text-white/90"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Télécharger
                          </button>
                        ) : null}
                        {d.kind === 'invoice' ? (
                          <>
                            <button
                              type="button"
                              disabled={reportId === d.paymentId}
                              onClick={() => onReport(d)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 px-2.5 py-1.5 text-[11px] font-bold text-rose-200/90"
                            >
                              {reportId === d.paymentId ? '…' : "Pas reçu"}
                            </button>
                            <button
                              type="button"
                              disabled={resendId === d.paymentId}
                              onClick={() => onResend(d)}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 px-2.5 py-1.5 text-[11px] font-bold text-amber-200/90"
                            >
                              {resendId === d.paymentId ? '…' : (
                                <>
                                  <Mail className="h-3.5 w-3.5" />
                                  Renvoyer
                                </>
                              )}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        )}
        <LiriPageFooterLine className="w-full" marginClass="mt-4 mb-2" suffix="Documents" />
      </div>
    </EleveMobileShell>
  );
}
