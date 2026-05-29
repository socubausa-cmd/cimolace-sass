import React, { useMemo, useState } from 'react';
import { Download, FileText, Mail, Search, Share2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useStudentDocumentsParityData } from '@/hooks/useStudentDocumentsParityData';
import { supabase } from '@/lib/customSupabaseClient';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';
import { useToast } from '@/components/ui/use-toast';

const DocumentCard = ({ doc, restrictedAction, isDemoMode, onDownload }) => (
  <div className="flex items-center justify-between p-4 bg-black/20 rounded-lg hover:bg-black/30 transition-colors border border-white/5">
    <div className="flex items-center gap-4">
      <div className="p-3 bg-[#D4AF37]/10 rounded text-[#D4AF37]">
        <FileText className="w-6 h-6" />
      </div>
      <div>
        <h4 className="text-white font-medium">{doc.name}</h4>
        <p className="text-sm text-gray-500">Ajouté le {doc.date} • {doc.size}</p>
      </div>
    </div>
    <div className="flex gap-2">
      <Button 
        variant="ghost" size="icon" 
        className="text-gray-400 hover:text-white hover:bg-white/10"
        onClick={() => (isDemoMode ? restrictedAction('Partager le document') : navigator?.clipboard?.writeText?.(doc.url || ''))}
      >
        <Share2 className="w-4 h-4" />
      </Button>
      <Button 
        variant="outline" size="sm" 
        className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black"
        onClick={() => (isDemoMode ? restrictedAction('Télécharger le document') : onDownload?.(doc))}
      >
        <Download className="w-4 h-4 mr-2" /> Télécharger
      </Button>
    </div>
  </div>
);

function InvoiceDocumentRow({
  doc,
  isDemoMode,
  restrictedAction,
  onDownload,
  onReportNotReceived,
  onResendEmail,
  reportLoading,
  resendLoading,
}) {
  const sentBySchool = Boolean(doc.invoiceSentAt);
  const studentReported = Boolean(doc.invoiceStudentNotReceivedAt);
  const lastMail = doc.invoiceLastEmailedAt || doc.invoiceSentAt;
  const lastMailLabel =
    lastMail && isValid(new Date(lastMail))
      ? format(new Date(lastMail), "d MMM yyyy 'à' HH:mm", { locale: fr })
      : null;

  return (
    <div className="p-4 bg-black/20 rounded-lg border border-white/5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-[#D4AF37]/10 rounded text-[#D4AF37] shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h4 className="text-white font-medium">{doc.name}</h4>
            <p className="text-sm text-gray-500">Paiement du {doc.date} • {doc.size}</p>
            {lastMailLabel ? (
              <p className="text-xs text-gray-500 mt-1">Dernier envoi e-mail : {lastMailLabel}</p>
            ) : null}
            <div className="flex flex-wrap gap-2 mt-2">
              {!sentBySchool ? (
                <Badge className="bg-amber-500/15 text-amber-200 border-amber-500/30 text-xs">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Facture pas encore envoyée par l&apos;école
                </Badge>
              ) : (
                <Badge className="bg-emerald-500/15 text-emerald-200 border-emerald-500/30 text-xs">
                  Envoyée par l&apos;école
                </Badge>
              )}
              {studentReported ? (
                <Badge className="bg-orange-500/15 text-orange-200 border-orange-500/30 text-xs">
                  Signalement : pas reçue (le secrétariat est informé)
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="border-white/20 text-gray-200 hover:bg-white/10"
            disabled={isDemoMode || reportLoading}
            onClick={() =>
              isDemoMode ? restrictedAction('Signaler facture non reçue') : onReportNotReceived?.(doc)
            }
          >
            <AlertCircle className="w-4 h-4 mr-2" />
            Je n&apos;ai pas reçu
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black"
            disabled={isDemoMode || resendLoading}
            onClick={() => (isDemoMode ? restrictedAction('Renvoyer la facture') : onResendEmail?.(doc))}
          >
            <Mail className="w-4 h-4 mr-2" />
            Renvoyer par e-mail
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-[#D4AF37]/60 text-[#D4AF37] hover:bg-[#D4AF37]/10"
            onClick={() => (isDemoMode ? restrictedAction('Télécharger') : onDownload?.(doc))}
          >
            <Download className="w-4 h-4 mr-2" /> Télécharger
          </Button>
        </div>
      </div>
      <p className="text-xs text-gray-500 pl-[3.25rem]">
        Le renvoi par e-mail est limité à une fois toutes les 24 h. En cas d&apos;urgence, contactez le secrétariat.
      </p>
    </div>
  );
}

const StudentDocumentsPage = () => {
  const { isDemoMode, demoData, restrictedAction } = useDemoMode();
  const { user, session } = useAuth();
  const { toast } = useToast();
  const { docs: realDocs, refreshInvoices } = useStudentDocumentsParityData(isDemoMode ? null : user?.id);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [reportLoadingId, setReportLoadingId] = useState(null);
  const [resendLoadingId, setResendLoadingId] = useState(null);

  const handleReportNotReceived = async (doc) => {
    if (!doc?.paymentId) return;
    setReportLoadingId(doc.paymentId);
    try {
      const { data, error } = await supabase.rpc('report_invoice_not_received', {
        p_payment_id: doc.paymentId,
      });
      if (error) throw error;
      if (!data?.ok) {
        toast({
          title: 'Action impossible',
          description: data?.error === 'not_found_or_forbidden' ? 'Facture introuvable.' : 'Réessaie plus tard.',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Signalement enregistré',
        description: 'Le secrétariat peut voir que tu n\'as pas reçu la facture. Tu peux aussi demander un renvoi par e-mail.',
      });
      await refreshInvoices();
    } catch (e) {
      toast({
        title: 'Erreur',
        description: e?.message || 'Impossible d\'enregistrer le signalement.',
        variant: 'destructive',
      });
    } finally {
      setReportLoadingId(null);
    }
  };

  const handleResendEmail = async (doc) => {
    if (!doc?.paymentId || !session?.access_token) return;
    setResendLoadingId(doc.paymentId);
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
          description: `Tu pourras redemander un renvoi dans environ ${body.retryAfterHours || 24} h.`,
          variant: 'destructive',
        });
        return;
      }
      if (!res.ok) {
        toast({
          title: 'Renvoi impossible',
          description: body.error || res.statusText,
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Facture renvoyée',
        description: body.invoiceNumber ? `Facture ${body.invoiceNumber} envoyée à ton e-mail.` : 'Vérifie ta boîte mail.',
      });
      await refreshInvoices();
    } catch (e) {
      toast({
        title: 'Erreur réseau',
        description: e?.message || 'Réessaie plus tard.',
        variant: 'destructive',
      });
    } finally {
      setResendLoadingId(null);
    }
  };

  const documents = isDemoMode ? demoData.documents : realDocs;
  const allDocs = useMemo(
    () => [...(documents.admin || []), ...(documents.academic || []), ...(documents.resources || [])],
    [documents.academic, documents.admin, documents.resources]
  );
  const filterList = (arr) =>
    (arr || []).filter((d) => !search || String(d.name || '').toLowerCase().includes(search.toLowerCase()));

  const downloadDocument = async (doc) => {
    if (!doc) return;
    if (doc.kind === 'invoice') {
      if (doc.url) {
        window.open(doc.url, '_blank');
        return;
      }
      if (!session?.access_token || !doc.paymentId) return;
      const res = await fetch(`/.netlify/functions/billing-invoice-download?paymentId=${encodeURIComponent(doc.paymentId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `facture-${String(doc.paymentId).slice(0, 8)}.html`;
      link.click();
      URL.revokeObjectURL(link.href);
      return;
    }
    if (doc.url) window.open(doc.url, '_blank');
  };

  const renderDocRow = (doc) => {
    if (doc.kind === 'invoice') {
      return (
        <InvoiceDocumentRow
          key={doc.id}
          doc={doc}
          isDemoMode={isDemoMode}
          restrictedAction={restrictedAction}
          onDownload={downloadDocument}
          onReportNotReceived={handleReportNotReceived}
          onResendEmail={handleResendEmail}
          reportLoading={reportLoadingId === doc.paymentId}
          resendLoading={resendLoadingId === doc.paymentId}
        />
      );
    }
    return (
      <DocumentCard
        key={doc.id}
        doc={doc}
        restrictedAction={restrictedAction}
        isDemoMode={isDemoMode}
        onDownload={downloadDocument}
      />
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-white">Mes Documents</h1>
          <p className="text-gray-400">Accédez à tous vos documents administratifs et pédagogiques.</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input placeholder="Rechercher..." className="pl-9 bg-[#192734] border-white/10 text-white" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <PremiumSegmentedSelector
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'all', label: 'Tous', badge: `${allDocs.length}` },
            { value: 'admin', label: 'Administratifs', badge: `${(documents.admin || []).length}` },
            { value: 'academic', label: 'Pédagogiques', badge: `${(documents.academic || []).length}` },
            { value: 'resources', label: 'Ressources', badge: `${(documents.resources || []).length}` },
          ]}
          layoutId="student-documents-tab-segment-pill"
          className="mb-6"
          compact
          showChevron={false}
        />

        <TabsContent value="all" className="space-y-4">
          <Card className="bg-[#192734] border-white/10">
            <CardContent className="pt-6 space-y-4">
              {filterList(allDocs).length > 0 ? filterList(allDocs).map((doc) => renderDocRow(doc)) : <p className="text-gray-500 text-center">Aucun document.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admin" className="space-y-4">
          <Card className="bg-[#192734] border-white/10">
             <CardContent className="pt-6 space-y-4">
                {filterList(documents.admin).map((doc) => renderDocRow(doc))}
             </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="academic" className="space-y-4">
          <Card className="bg-[#192734] border-white/10">
             <CardContent className="pt-6 space-y-4">
                {filterList(documents.academic).map((doc) => renderDocRow(doc))}
             </CardContent>
          </Card>
        </TabsContent>
        
         <TabsContent value="resources" className="space-y-4">
          <Card className="bg-[#192734] border-white/10">
             <CardContent className="pt-6 space-y-4">
                {filterList(documents.resources).map((doc) => renderDocRow(doc))}
             </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentDocumentsPage;