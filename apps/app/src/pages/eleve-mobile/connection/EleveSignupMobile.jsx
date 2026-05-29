import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Mail, Lock, User, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { EleveConnectionLayout } from '@/pages/eleve-mobile/connection/EleveConnectionLayout';
import { LiriPageFooterLine } from '@/components/brand/LiriWordmark';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import {
  EV_ACCENT,
  EV_MUTED,
  EV_LINE,
  EV_R,
  EV_SH,
} from '@/pages/eleve-mobile/eleveMobileScreensShared';
import { useTenantBranding } from '@/hooks/useTenantBranding';

const LIRI_CTA = {
  background: `linear-gradient(90deg, ${EV_ACCENT} 0%, #5B21B6 100%)`,
  boxShadow: EV_SH.cta,
  borderRadius: EV_R.lg,
};

const GOOGLE_BTN = {
  background: 'rgba(255,255,255,0.06)',
  border: `1px solid ${EV_LINE}`,
  borderRadius: EV_R.lg,
};

const FIELD_STYLE = {
  background: 'rgba(255,255,255,0.04)',
  border: `1px solid ${EV_LINE}`,
  borderRadius: EV_R.md,
};

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}

export default function EleveSignupMobile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signup, loginWithOAuth } = useAuth();
  const { branding } = useTenantBranding();

  const redirect = searchParams.get('redirect') || ELEVE_MOBILE.home;

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setError('');
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      localStorage.setItem('oauth_next_path', redirect);
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error: err } = await loginWithOAuth('google', redirectTo);
      if (err) throw err;
    } catch (e) {
      setError(e?.message || 'Erreur connexion Google.');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('Prénom et nom requis.');
    if (!form.email.trim()) return setError('Email requis.');
    if (form.password.length < 6) return setError('Mot de passe : 6 caractères minimum.');
    if (form.password !== form.confirm) return setError('Les mots de passe ne correspondent pas.');
    setLoading(true);
    try {
      const { error: err } = await signup(form.email, form.password, {
        display_name: form.name.trim(),
        full_name: form.name.trim(),
      });
      if (err) throw err;
      navigate(redirect, { replace: true });
    } catch (e) {
      setError(e?.message || 'Erreur lors de la création du compte.');
    } finally {
      setLoading(false);
    }
  };

  const schoolName = branding?.name || 'Mon École';

  return (
    <EleveConnectionLayout>
      <div className="mx-auto w-full max-w-md flex-1 px-4 pb-8">
        {/* Header */}
        <div className="mb-2 flex items-center">
          <Link
            to={ELEVE_MOBILE.connexion}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white transition active:scale-95"
            style={{ border: `1px solid ${EV_LINE}`, background: 'rgba(255,255,255,0.05)' }}
            aria-label="Retour"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
          </Link>
        </div>

        {/* Logo école */}
        <div className="mb-4 flex flex-col items-center gap-1">
          {branding?.logo ? (
            <img src={branding.logo} alt={schoolName} className="h-10 w-auto object-contain" />
          ) : null}
          <p className="text-[13px] font-bold tracking-widest text-white/60 uppercase">
            {schoolName}
          </p>
        </div>

        {/* Titre */}
        <motion.div
          className="mb-6 text-center"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-[24px] font-extrabold leading-[1.2] tracking-tight text-white">
            Créer ton compte
          </h1>
          <p className="mt-1.5 text-[14px]" style={{ color: EV_MUTED }}>
            Inscription gratuite — accès à ton espace d'apprentissage.
          </p>
        </motion.div>

        {/* Bouton Google */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
          className="mb-4 flex w-full items-center justify-center gap-2.5 py-3.5 text-[15px] font-semibold text-white/90 transition active:scale-[0.99] disabled:opacity-60"
          style={GOOGLE_BTN}
        >
          {googleLoading ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin" />
          ) : (
            <GoogleLogo />
          )}
          {googleLoading ? 'Redirection Google…' : 'S\'inscrire avec Google'}
        </button>

        {/* Séparateur */}
        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1" style={{ background: EV_LINE }} />
          <span className="text-[12px]" style={{ color: EV_MUTED }}>ou par email</span>
          <div className="h-px flex-1" style={{ background: EV_LINE }} />
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Nom complet */}
          <div>
            <label className="mb-1.5 block text-[12px] font-medium" style={{ color: EV_MUTED }}>
              Prénom et nom
            </label>
            <div className="flex items-center gap-2.5 px-3 py-3" style={FIELD_STYLE}>
              <User className="h-4 w-4 shrink-0" style={{ color: EV_MUTED }} />
              <input
                type="text"
                autoComplete="name"
                placeholder="Prénom Nom"
                value={form.name}
                onChange={set('name')}
                className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/25"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="mb-1.5 block text-[12px] font-medium" style={{ color: EV_MUTED }}>
              Email
            </label>
            <div className="flex items-center gap-2.5 px-3 py-3" style={FIELD_STYLE}>
              <Mail className="h-4 w-4 shrink-0" style={{ color: EV_MUTED }} />
              <input
                type="email"
                autoComplete="email"
                placeholder="exemple@email.com"
                value={form.email}
                onChange={set('email')}
                className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/25"
              />
            </div>
          </div>

          {/* Mot de passe */}
          <div>
            <label className="mb-1.5 block text-[12px] font-medium" style={{ color: EV_MUTED }}>
              Mot de passe
            </label>
            <div className="flex items-center gap-2.5 px-3 py-3" style={FIELD_STYLE}>
              <Lock className="h-4 w-4 shrink-0" style={{ color: EV_MUTED }} />
              <input
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={form.password}
                onChange={set('password')}
                className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/25"
              />
            </div>
          </div>

          {/* Confirmer */}
          <div>
            <label className="mb-1.5 block text-[12px] font-medium" style={{ color: EV_MUTED }}>
              Confirmer le mot de passe
            </label>
            <div className="flex items-center gap-2.5 px-3 py-3" style={FIELD_STYLE}>
              <Lock className="h-4 w-4 shrink-0" style={{ color: EV_MUTED }} />
              <input
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={form.confirm}
                onChange={set('confirm')}
                className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/25"
              />
            </div>
          </div>

          {/* Erreur */}
          {error ? (
            <p className="text-center text-[12px] text-red-400/95">{error}</p>
          ) : null}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || googleLoading}
            className="flex w-full items-center justify-center gap-2 py-3.5 text-[15px] font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
            style={LIRI_CTA}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <span>S'inscrire gratuitement</span>
                <ChevronRight className="h-5 w-5" strokeWidth={2.2} />
              </>
            )}
          </button>
        </form>

        {/* Déjà inscrit */}
        <p className="mt-5 text-center text-[13px]" style={{ color: EV_MUTED }}>
          Déjà inscrit ?{' '}
          <Link
            to={`${ELEVE_MOBILE.login}?redirect=${encodeURIComponent(redirect)}`}
            className="font-semibold"
            style={{ color: EV_ACCENT }}
          >
            Se connecter
          </Link>
        </p>

        <LiriPageFooterLine marginClass="mt-4" suffix="Inscription" />
      </div>
    </EleveConnectionLayout>
  );
}
