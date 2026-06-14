import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { getLoginPathWithQuery, shouldUseLiriMobileLogin } from '@/lib/loginEntryPath';

const RedeemPrivilegedLinkPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [status, setStatus] = useState('pending'); // pending | success | error
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug || authLoading) return;

    if (!session?.access_token) {
      navigate(getLoginPathWithQuery({ redirect: `/redeem/${slug}` }), { replace: true });
      return;
    }

    const redeem = async () => {
      setLoading(true);
      try {
        const res = await fetch('/.netlify/functions/privileged-link-redeem', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ slug }),
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          setStatus('success');
          setMessage(data.message || 'Accès accordé avec succès.');
        } else {
          setStatus('error');
          setMessage(data.error || 'Ce lien n\'est plus valide.');
        }
      } catch (err) {
        setStatus('error');
        setMessage(err?.message || 'Erreur lors de l\'activation.');
      } finally {
        setLoading(false);
      }
    };

    redeem();
  }, [slug, session?.access_token, authLoading, navigate]);

  useEffect(() => {
    if (status !== 'success' || !shouldUseLiriMobileLogin()) return undefined;
    const id = window.setTimeout(() => navigate(ELEVE_MOBILE.home, { replace: true }), 700);
    return () => window.clearTimeout(id);
  }, [navigate, status]);

  if (authLoading || loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-[var(--school-accent)]" />
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-8">
        <CheckCircle className="w-16 h-16 text-emerald-500" />
        <h1 className="text-2xl font-bold text-white">Accès activé</h1>
        <p className="text-gray-400 text-center max-w-md">{message}</p>
        <Button
          onClick={() => navigate(shouldUseLiriMobileLogin() ? ELEVE_MOBILE.home : '/dashboard')}
          className="bg-[var(--school-accent)] text-black"
        >
          {shouldUseLiriMobileLogin() ? 'Ouvrir LIRI mobile' : 'Aller au tableau de bord'}
        </Button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-8">
        <XCircle className="w-16 h-16 text-red-500" />
        <h1 className="text-2xl font-bold text-white">Lien invalide</h1>
        <p className="text-gray-400 text-center max-w-md">{message}</p>
        <Button onClick={() => navigate('/')} variant="outline">
          Retour à l'accueil
        </Button>
      </div>
    );
  }

  return null;
};

export default RedeemPrivilegedLinkPage;
