import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Loader2, KeyRound, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBilling } from '@/contexts/BillingContext';
import { supabase } from '@/lib/customSupabaseClient';

export default function LicenseActivationPage() {
  const navigate = useNavigate();
  const { licenseActivation, refresh } = useBilling();
  const [licenseKey, setLicenseKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const suggestedKey = useMemo(() => String(licenseActivation?.providerLicenseKey || ''), [licenseActivation]);

  const handleActivate = async () => {
    const key = String(licenseKey || suggestedKey || '').trim();
    if (!key) {
      setError('Entre ta cle licence pour activer ton compte.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) throw new Error('Session invalide. Reconnecte-toi puis reessaie.');

      const res = await fetch('/.netlify/functions/billing-activate-license', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ licenseKey: key }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Activation impossible');

      await refresh();
      setSuccess('Licence valide. Ton abonnement est maintenant actif.');
      setTimeout(() => navigate('/dashboard'), 1000);
    } catch (e) {
      setError(String(e?.message || 'Activation impossible'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-24 pb-16 px-4">
      <Helmet>
        <title>Activation Licence | PRORASCIENCE</title>
      </Helmet>

      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="bg-[#192734] border-white/10">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <KeyRound className="w-6 h-6 text-[#D4AF37]" />
              Activer mon compte avec une licence
            </CardTitle>
            <CardDescription className="text-gray-300">
              Si ton paiement a ete confirme mais l activation automatique a echoue, colle ta licence pour debloquer l acces.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {licenseActivation?.canActivateByLicense ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                Une licence eligible est detectee. Tu peux lancer l activation manuelle.
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-gray-300">
                Aucune licence en attente detectee automatiquement. Tu peux quand meme saisir une licence.
              </div>
            )}

            <div>
              <label className="text-xs text-gray-400">Cle licence</label>
              <input
                value={licenseKey}
                onChange={(e) => setLicenseKey(String(e.target.value || ''))}
                className="mt-1 w-full h-11 rounded-md bg-[#0F1419] border border-white/10 px-3 text-white"
                placeholder={suggestedKey || 'Ex: LIC-XXXX-XXXX'}
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            ) : null}

            {success ? (
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{success}</span>
              </div>
            ) : null}

            <div className="flex gap-3">
              <Button
                onClick={handleActivate}
                disabled={submitting}
                className="bg-[#D4AF37] text-black hover:bg-[#c4a030] font-bold"
              >
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Activer maintenant
              </Button>
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/5"
                onClick={() => navigate('/dashboard')}
              >
                Retour dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
