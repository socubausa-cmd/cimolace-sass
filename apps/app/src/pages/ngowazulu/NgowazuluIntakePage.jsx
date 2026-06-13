import React, { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/customSupabaseClient';
import { CheckCircle2, FileText, Loader2, ShieldAlert, Clock3, ListChecks, Landmark } from 'lucide-react';

const OPENING_PLAN_SLUG = 'ngowazulu-ouverture-recouvrement';

export default function NgowazuluIntakePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loadingGate, setLoadingGate] = useState(true);
  const [openingPaymentId, setOpeningPaymentId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  const [fullName, setFullName] = useState(user?.name || '');
  const [age, setAge] = useState('');
  const [originCountry, setOriginCountry] = useState('');
  const [issueSummary, setIssueSummary] = useState('');
  const [dreamNotes, setDreamNotes] = useState('');
  const [preferredSessions, setPreferredSessions] = useState('2x_week');
  const [serviceDurationMonths, setServiceDurationMonths] = useState('1');
  const [urgencyLevel, setUrgencyLevel] = useState('standard');
  const [signature, setSignature] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [identityDoc, setIdentityDoc] = useState(null);
  const [residenceProof, setResidenceProof] = useState(null);
  const [secrecyOathAccepted, setSecrecyOathAccepted] = useState(false);
  const [nonDisclosureAccepted, setNonDisclosureAccepted] = useState(false);
  const [medicalDisclaimerAccepted, setMedicalDisclaimerAccepted] = useState(false);

  const checklistValid = useMemo(
    () =>
      fullName.trim() &&
      Number(age) > 0 &&
      originCountry.trim() &&
      issueSummary.trim() &&
      signature.trim().length >= 6 &&
      profilePhoto &&
      identityDoc &&
      residenceProof &&
      secrecyOathAccepted &&
      nonDisclosureAccepted &&
      medicalDisclaimerAccepted,
    [
      age,
      fullName,
      identityDoc,
      issueSummary,
      medicalDisclaimerAccepted,
      nonDisclosureAccepted,
      originCountry,
      profilePhoto,
      residenceProof,
      secrecyOathAccepted,
      signature,
    ]
  );

  React.useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!user?.id) return;
      try {
        // billing_invoices.tenant_id → tenants.id (platform UUID), not profile IDs.
        // billing_subscriptions.plan_id is text matching the plan slug constants directly.
        // No FK from billing_subscriptions.plan_id → billing_plans.id, so skip billing_plans lookup.

        // Check opening plan access via subscriptions
        const { data: openingSubs } = await supabase
          .from('billing_subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .eq('plan_id', OPENING_PLAN_SLUG);
        const openingSubIds = (openingSubs || []).map(s => s.id);
        if (openingSubIds.length === 0) {
          // No subscription at all — check bundled mentorat before concluding no access
        }

        const openingPay = openingSubIds.length > 0
          ? (await supabase
              .from('billing_invoices')
              .select('id,status')
              .in('subscription_id', openingSubIds)
              .eq('status', 'paid')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()).data
          : null;

        // Check bundled opening inside mentorat subscriptions
        const { data: mentoratSubs } = await supabase
          .from('billing_subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .like('plan_id', 'ngowazulu-mentorat%');
        const mentoratSubIds = (mentoratSubs || []).map(s => s.id);
        const { data: mentoratRows } = mentoratSubIds.length > 0
          ? await supabase
              .from('billing_invoices')
              .select('id, meta, ipn_payload, subscription_id')
              .in('subscription_id', mentoratSubIds)
              .eq('status', 'paid')
          : { data: [] };
        const bundledOpening = (mentoratRows || []).find(
          (row) => row?.ipn_payload?.ngowazulu_opening_included === true
        );

        if (!alive) return;
        const accessId = openingPay?.id || bundledOpening?.id;
        setHasAccess(Boolean(accessId));
        setOpeningPaymentId(accessId || '');
        setLoadingGate(false);
      } catch {
        if (!alive) return;
        setHasAccess(false);
        setLoadingGate(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  if (!user) return <Navigate to="/login" replace />;
  if (loadingGate) {
    return (
      <div className="min-h-screen bg-[#0F1419] text-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  const uploadDocument = async (file, label) => {
    const ext = String(file?.name || '').split('.').pop() || 'bin';
    const filename = `${Date.now()}-${label}.${ext}`.toLowerCase();
    const path = `ngowazulu/${user.id}/${filename}`;
    const { error } = await supabase.storage.from('videos').upload(path, file, { upsert: true });
    if (error) throw new Error(`Upload ${label} impossible: ${error.message}`);
    const { data } = await supabase.storage.from('videos').getPublicUrl(path);
    return data?.publicUrl || path;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!checklistValid) {
      toast({ title: 'Informations incomplètes', description: 'Complète tous les champs et consentements.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const [profilePhotoUrl, identityDocumentUrl, residenceProofUrl] = await Promise.all([
        uploadDocument(profilePhoto, 'photo'),
        uploadDocument(identityDoc, 'piece-identite'),
        uploadDocument(residenceProof, 'preuve-habitation'),
      ]);

      const payload = {
        user_id: user.id,
        opening_payment_id: openingPaymentId || null,
        legal_full_name: fullName.trim(),
        age: Number(age),
        origin_country: originCountry.trim(),
        issue_summary: issueSummary.trim(),
        dream_notes: dreamNotes.trim() || null,
        preferred_sessions: preferredSessions,
        service_duration_months: Number(serviceDurationMonths || 1),
        urgency_level: urgencyLevel,
        profile_photo_url: profilePhotoUrl,
        identity_document_url: identityDocumentUrl,
        residence_proof_url: residenceProofUrl,
        secrecy_oath_accepted: true,
        non_disclosure_accepted: true,
        medical_disclaimer_accepted: true,
        consent_signature: signature.trim(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('ngowazulu_patient_intakes')
        .upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;

      toast({
        title: 'Dossier transmis',
        description: 'Votre dossier Ngowazulu est enregistré. Le maître peut lancer la prise en charge.',
      });
      navigate('/services-spirituels#ngowazulu', { replace: true });
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err?.message || "Impossible d'enregistrer le dossier.",
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-[#0F1419] text-white px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <Card className="premium-panel border border-amber-500/30 bg-[#151a21]/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <ShieldAlert className="h-6 w-6 text-amber-400" />
                Première étape : souscrire au mentorat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-gray-300">
              <p>
                Le dossier patient s&apos;ouvre après un <span className="text-white font-medium">premier paiement mentorat</span>. Les{' '}
                <span className="text-[#D4AF37]">frais de configuration</span> (100 EUR, uniques — cérémonie d&apos;inauguration et mise en place du service de protection) sont{' '}
                <span className="text-white font-medium">calculés et ajoutés automatiquement</span> à ce premier règlement ; ce n&apos;est pas un produit séparé dans le catalogue.
              </p>
              <p className="text-xs text-gray-500">
                Chariow : vous serez guidé en deux étapes de paiement si nécessaire. Mobile Money / Monero : souvent une seule transaction avec le détail sur la facture.
              </p>
              <Button asChild className="bg-[#D4AF37] text-black hover:bg-amber-500">
                <a href="/services-spirituels#ngowazulu">Choisir un contrat mentorat</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1419] text-white px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <Card className="premium-panel border border-[#D4AF37]/25 bg-[#151a21]/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <CheckCircle2 className="h-6 w-6 text-[#D4AF37]" />
              Dossier de prise en charge NGOWAZULU
            </CardTitle>
            <p className="text-sm text-gray-400">
              Ce formulaire formalise la tutelle spirituelle et la prise en charge. Le maître n&apos;est pas médecin. Le travail spirituel n&apos;exclut pas un suivi médical.
            </p>
          </CardHeader>
          <CardContent>
            <div className="mb-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-[#D4AF37] text-sm font-semibold mb-2">
                  <Clock3 className="h-4 w-4" /> Délais indicatifs
                </div>
                <ul className="text-xs text-gray-300 space-y-1.5">
                  <li>Validation admin dossier : 24 h à 72 h</li>
                  <li>Première lecture spirituelle : 3 à 7 jours</li>
                  <li>Début des séances : selon urgence et disponibilité</li>
                </ul>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-[#D4AF37] text-sm font-semibold mb-2">
                  <ListChecks className="h-4 w-4" /> Procédure du temple
                </div>
                <ol className="text-xs text-gray-300 space-y-1.5 list-decimal list-inside">
                  <li>Ouverture de recouvrement payée</li>
                  <li>Dépôt du dossier complet + consentements</li>
                  <li>Qualification par le secrétariat</li>
                  <li>Orientation du maître et protocole</li>
                </ol>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-[#D4AF37] text-sm font-semibold mb-2">
                  <Landmark className="h-4 w-4" /> Règles du temple
                </div>
                <ul className="text-xs text-gray-300 space-y-1.5">
                  <li>Confidentialité absolue des échanges</li>
                  <li>Aucun partage public des protocoles</li>
                  <li>Suivi médical maintenu si nécessaire</li>
                </ul>
              </div>
            </div>
            <form className="space-y-5" onSubmit={submit}>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-2">
                  <Label>Nom complet</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="bg-[#0F1419] border-white/10" />
                </div>
                <div className="space-y-2">
                  <Label>Âge</Label>
                  <Input type="number" min={1} max={120} value={age} onChange={(e) => setAge(e.target.value)} className="bg-[#0F1419] border-white/10" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Pays d&apos;origine</Label>
                <Input value={originCountry} onChange={(e) => setOriginCountry(e.target.value)} className="bg-[#0F1419] border-white/10" />
              </div>

              <div className="space-y-2">
                <Label>Problèmes expliqués par le patient</Label>
                <Textarea rows={4} value={issueSummary} onChange={(e) => setIssueSummary(e.target.value)} className="bg-[#0F1419] border-white/10" />
              </div>

              <div className="space-y-2">
                <Label>Songes et signes observés</Label>
                <Textarea rows={3} value={dreamNotes} onChange={(e) => setDreamNotes(e.target.value)} className="bg-[#0F1419] border-white/10" />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Rythme souhaité</Label>
                  <select value={preferredSessions} onChange={(e) => setPreferredSessions(e.target.value)} className="h-10 w-full rounded-md bg-[#0F1419] border border-white/10 px-3 text-white">
                    <option value="1x_month">1 fois / mois</option>
                    <option value="1x_week">1 fois / semaine</option>
                    <option value="2x_week">2 fois / semaine</option>
                    <option value="3x_week">3 fois / semaine (urgent)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Durée du mentorat</Label>
                  <select
                    value={serviceDurationMonths}
                    onChange={(e) => setServiceDurationMonths(e.target.value)}
                    className="h-10 w-full rounded-md bg-[#0F1419] border border-white/10 px-3 text-white"
                  >
                    <option value="1">1 mois</option>
                    <option value="3">3 mois</option>
                    <option value="6">6 mois</option>
                    <option value="9">9 mois</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Niveau d&apos;urgence</Label>
                  <select value={urgencyLevel} onChange={(e) => setUrgencyLevel(e.target.value)} className="h-10 w-full rounded-md bg-[#0F1419] border border-white/10 px-3 text-white">
                    <option value="standard">Standard</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Photo</Label>
                  <Input type="file" accept="image/*,.pdf" onChange={(e) => setProfilePhoto(e.target.files?.[0] || null)} className="bg-[#0F1419] border-white/10" />
                </div>
                <div className="space-y-2">
                  <Label>Pièce d&apos;identité</Label>
                  <Input type="file" accept="image/*,.pdf" onChange={(e) => setIdentityDoc(e.target.files?.[0] || null)} className="bg-[#0F1419] border-white/10" />
                </div>
                <div className="space-y-2">
                  <Label>Preuve d&apos;habitation</Label>
                  <Input type="file" accept="image/*,.pdf" onChange={(e) => setResidenceProof(e.target.files?.[0] || null)} className="bg-[#0F1419] border-white/10" />
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-gray-300">
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={secrecyOathAccepted} onChange={(e) => setSecrecyOathAccepted(e.target.checked)} />
                  <span>Je jure la confidentialité et l&apos;engagement de ne pas divulguer le travail spirituel exécuté.</span>
                </label>
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={nonDisclosureAccepted} onChange={(e) => setNonDisclosureAccepted(e.target.checked)} />
                  <span>J&apos;accepte la clause de non-divulgation des méthodes, outils et protocoles du maître.</span>
                </label>
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={medicalDisclaimerAccepted} onChange={(e) => setMedicalDisclaimerAccepted(e.target.checked)} />
                  <span>Je comprends que le maître n&apos;est pas médecin, ne promet pas de miracle, et que ce travail n&apos;exclut pas un suivi médical.</span>
                </label>
              </div>

              <div className="space-y-2">
                <Label>Signature numérique</Label>
                <Textarea rows={2} value={signature} onChange={(e) => setSignature(e.target.value)} className="bg-[#0F1419] border-white/10" placeholder="Nom complet + mention « lu et approuvé »" />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button type="submit" disabled={submitting || !checklistValid} className="bg-[#D4AF37] text-black hover:bg-amber-500">
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  Enregistrer mon dossier
                </Button>
                <Button type="button" variant="outline" className="border-white/15 text-gray-200 hover:bg-white/5" onClick={() => navigate('/services-spirituels#ngowazulu')}>
                  Retour à Ngowazulu
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
