import React, { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useBilling } from '@/contexts/BillingContext';
import { supabase } from '@/lib/customSupabaseClient';
import { FileText, Loader2, ShieldCheck, PenLine } from 'lucide-react';

const StudentEnrollmentOnboardingPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { loading: billingLoading, status, inGrace } = useBilling();
  const [submitting, setSubmitting] = useState(false);
  const [legalFullName, setLegalFullName] = useState(user?.name || '');
  const [signature, setSignature] = useState('');
  const [identityDoc, setIdentityDoc] = useState(null);
  const [residenceProof, setResidenceProof] = useState(null);
  const [headshot, setHeadshot] = useState(null);

  const isPremiumActive = useMemo(
    () => status === 'active' || (status === 'past_due' && inGrace),
    [status, inGrace]
  );

  if (!user) return <Navigate to="/login" replace />;
  if (billingLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0F1419] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }
  if (!isPremiumActive) return <Navigate to="/forfaits" replace />;
  if (user?.student_profile_completed) return <Navigate to="/student-school-life/dashboard" replace />;

  const uploadDocument = async (file, label) => {
    const ext = String(file?.name || '').split('.').pop() || 'bin';
    const filename = `${Date.now()}-${label}.${ext}`.toLowerCase();
    const path = `onboarding/${user.id}/${filename}`;
    const { error } = await supabase.storage.from('videos').upload(path, file, { upsert: true });
    if (error) throw new Error(`Upload ${label} impossible: ${error.message}`);
    const { data } = await supabase.storage.from('videos').getPublicUrl(path);
    return data?.publicUrl || path;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!legalFullName.trim()) {
      toast({ title: 'Nom requis', description: 'Indiquez votre nom complet légal.', variant: 'destructive' });
      return;
    }
    if (!identityDoc || !residenceProof || !headshot) {
      toast({ title: 'Documents requis', description: 'Ajoutez les 3 pièces demandées.', variant: 'destructive' });
      return;
    }
    if (!signature.trim() || signature.trim().length < 6) {
      toast({ title: 'Signature invalide', description: 'Signez le consentement (min. 6 caractères).', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const [identityUrl, residenceUrl, headshotUrl] = await Promise.all([
        uploadDocument(identityDoc, 'piece-identite'),
        uploadDocument(residenceProof, 'preuve-residence'),
        uploadDocument(headshot, 'demi-carte-photo'),
      ]);

      const { error } = await supabase
        .from('profiles')
        .update({
          legal_full_name: legalFullName.trim(),
          identity_document_url: identityUrl,
          residence_proof_url: residenceUrl,
          headshot_url: headshotUrl,
          consent_signature: signature.trim(),
          student_profile_completed: true,
          student_profile_completed_at: new Date().toISOString(),
          role: 'student',
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: 'Dossier enregistré',
        description: 'Votre profil élève est activé. Redirection vers votre tableau de bord.',
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err?.message || 'Impossible de valider le dossier élève.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1419] text-white px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card className="premium-panel border border-[#D4AF37]/25 bg-[#151a21]/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ShieldCheck className="h-6 w-6 text-[#D4AF37]" />
              Finaliser mon dossier eleve
            </CardTitle>
            <p className="text-sm text-gray-400">
              Cette etape est obligatoire apres paiement pour activer votre tableau de bord eleve et vos certificats.
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="full-name">Nom complet legal</Label>
                <Input
                  id="full-name"
                  value={legalFullName}
                  onChange={(e) => setLegalFullName(e.target.value)}
                  className="bg-[#0F1419] border-white/10"
                  placeholder="Nom et prenoms"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="identity-doc">Piece d identite valide</Label>
                  <Input id="identity-doc" type="file" accept=".pdf,image/*" onChange={(e) => setIdentityDoc(e.target.files?.[0] || null)} className="bg-[#0F1419] border-white/10" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="residence-doc">Preuve de residence</Label>
                  <Input id="residence-doc" type="file" accept=".pdf,image/*" onChange={(e) => setResidenceProof(e.target.files?.[0] || null)} className="bg-[#0F1419] border-white/10" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="headshot-doc">Demi carte photo</Label>
                  <Input id="headshot-doc" type="file" accept="image/*,.pdf" onChange={(e) => setHeadshot(e.target.files?.[0] || null)} className="bg-[#0F1419] border-white/10" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signature">Signature numerique de consentement</Label>
                <Textarea
                  id="signature"
                  rows={3}
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  className="bg-[#0F1419] border-white/10"
                  placeholder="Je consens a l utilisation de ces informations pour certification et authentification."
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button type="submit" disabled={submitting} className="bg-[#D4AF37] text-black hover:bg-amber-500">
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  Valider mon dossier
                </Button>
                <Link to="/forfaits" className="inline-flex">
                  <Button type="button" variant="outline" className="border-white/15 text-gray-200 hover:bg-white/5">
                    Retour forfaits
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="rounded-xl border border-white/10 bg-[#151a21]/70 p-4 text-sm text-gray-400">
          <p className="flex items-center gap-2 text-gray-200">
            <PenLine className="h-4 w-4 text-[#D4AF37]" />
            Les informations sont utilisees pour l edition de vos certificats et la verification de votre identite.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StudentEnrollmentOnboardingPage;
