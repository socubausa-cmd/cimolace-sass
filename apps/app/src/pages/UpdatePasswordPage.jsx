import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock, AlertCircle } from 'lucide-react';
import { Helmet } from 'react-helmet';
import { isSupabaseConfigured } from '@/lib/supabase';

const authFlow =
  String(import.meta.env.VITE_SUPABASE_AUTH_FLOW || 'pkce').toLowerCase() === 'implicit'
    ? 'implicit'
    : 'pkce';

const UpdatePasswordPage = () => {
  const { updatePassword, supabase } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('loading');
  const [sessionError, setSessionError] = useState('');
  const [formError, setFormError] = useState('');
  const exchangedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    const establishSession = async () => {
      if (authFlow === 'pkce' && code && !exchangedRef.current) {
        exchangedRef.current = true;
        const { data, error: exErr } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (cancelled) return;
        if (exErr) {
          setSessionError(exErr.message || 'Lien invalide ou expiré.');
          setPhase('error');
          return;
        }
        if (data?.session?.user) {
          setPhase('form');
          return;
        }
      }

      for (let i = 0; i < 40; i += 1) {
        if (cancelled) return;
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          setPhase('form');
          return;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      if (cancelled) return;
      setSessionError(
        'Lien expiré ou session introuvable. Demandez un nouveau lien depuis la page « Mot de passe oublié ».',
      );
      setPhase('error');
    };

    establishSession();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (password.length < 6) {
      setFormError('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (password !== confirm) {
      setFormError('Les mots de passe ne correspondent pas.');
      return;
    }
    setBusy(true);
    const { error: err } = await updatePassword(password);
    setBusy(false);
    if (err) {
      setFormError(err.message || 'Impossible de mettre à jour le mot de passe.');
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-[#0F1419] flex items-center justify-center p-6 text-white">
        <Helmet><title>Nouveau mot de passe | PRORASCIENCE</title></Helmet>
        <p className="text-gray-400 text-center">Configuration Supabase manquante.</p>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-[#0F1419] flex items-center justify-center p-6 text-white">
        <Helmet><title>Nouveau mot de passe | PRORASCIENCE</title></Helmet>
        <div className="flex items-center gap-3 text-gray-300">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--school-accent)]" />
          Vérification du lien…
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-[#0F1419] flex items-center justify-center p-6">
        <Helmet><title>Nouveau mot de passe | PRORASCIENCE</title></Helmet>
        <div className="w-full max-w-md space-y-4">
          <Alert variant="destructive" className="bg-red-900/20 border-red-900/50 text-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{sessionError}</AlertDescription>
          </Alert>
          <Link to="/forgot-password" className="block text-center text-[var(--school-accent)] hover:underline text-sm">
            Demander un nouveau lien
          </Link>
          <Link to="/login" className="block text-center text-gray-400 hover:text-white text-sm">
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1419] flex items-center justify-center p-6">
      <Helmet><title>Choisir un mot de passe | PRORASCIENCE ACADEMY</title></Helmet>
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-serif font-bold text-white mb-2">Nouveau mot de passe</h1>
        <p className="text-gray-400 text-sm mb-6">Choisissez un mot de passe pour vous connecter avec votre e-mail.</p>

        {formError ? (
          <Alert variant="destructive" className="mb-5 bg-red-900/20 border-red-900/50 text-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-gray-300 text-sm">Mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Au moins 6 caractères"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-11 bg-[#192734] border-white/10 text-white focus:border-[var(--school-accent)]"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm" className="text-gray-300 text-sm">Confirmer</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Répétez le mot de passe"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="pl-10 h-11 bg-[#192734] border-white/10 text-white focus:border-[var(--school-accent)]"
              />
            </div>
          </div>
          <Button
            type="submit"
            className="w-full h-11 bg-[var(--school-accent)] hover:bg-[#bfa345] text-black font-bold"
            disabled={busy}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement…
              </>
            ) : (
              'Enregistrer le mot de passe'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default UpdatePasswordPage;
