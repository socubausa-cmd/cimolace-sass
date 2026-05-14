import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, AlertCircle, ArrowLeft } from 'lucide-react';
import { Helmet } from 'react-helmet';
import { Capacitor } from '@capacitor/core';
import { isSupabaseConfigured } from '@/lib/supabase';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    const trimmed = email.trim();
    if (!trimmed) {
      setSubmitError('Indiquez votre adresse e-mail.');
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await resetPassword(trimmed);
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setSubmitError(err.message || 'Impossible d’envoyer l’e-mail.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1419] flex items-center justify-center p-6">
      <Helmet><title>Mot de passe oublié | PRORASCIENCE ACADEMY</title></Helmet>
      <div className="w-full max-w-md">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm text-[#D4AF37] hover:underline mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la connexion
        </Link>

        <h1 className="text-2xl font-serif font-bold text-white mb-2">Mot de passe oublié</h1>
        <p className="text-gray-400 text-sm mb-6">
          Indiquez l’e-mail de votre compte (y compris si vous vous connectez habituellement avec Google).
          Vous recevrez un lien pour <strong className="text-gray-300">choisir un mot de passe</strong>.
        </p>

        {!isSupabaseConfigured ? (
          <Alert className="mb-5 border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#f5e6c8]">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Configuration Supabase absente. Ajoutez les variables dans <code className="text-xs">.env</code> puis
              reconstruisez l’application.
            </AlertDescription>
          </Alert>
        ) : null}

        {Capacitor.isNativePlatform() ? (
          <Alert className="mb-5 border-white/15 bg-white/5 text-gray-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-[#D4AF37]" />
            <AlertDescription className="text-sm">
              Ouvrez le lien reçu par e-mail dans le <strong className="text-white">navigateur</strong> (Chrome, Safari),
              pas dans une mini-fenêtre Google. Après avoir défini le mot de passe, reconnectez-vous dans l’app avec
              e-mail + mot de passe.
            </AlertDescription>
          </Alert>
        ) : null}

        {submitError ? (
          <Alert variant="destructive" className="mb-5 bg-red-900/20 border-red-900/50 text-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}

        {sent ? (
          <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-100">
            <AlertDescription>
              Si un compte existe pour cette adresse, un e-mail avec un lien a été envoyé. Vérifiez votre boîte de
              réception et les courriers indésirables.
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300 text-sm">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="vous@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 bg-[#192734] border-white/10 text-white focus:border-[#D4AF37]"
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-11 bg-[#D4AF37] hover:bg-[#bfa345] text-black font-bold"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Envoi…
                </>
              ) : (
                'Envoyer le lien'
              )}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-gray-500">
          Rien reçu après quelques minutes ? Vérifiez l’orthographe de l’e-mail et le dossier spam.
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
