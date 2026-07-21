import React, { useState, useLayoutEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Lock, AlertCircle, BookOpen, Users, GraduationCap, Sparkles, ChevronLeft, Radio, Globe } from 'lucide-react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { clearSelectedAccountRole } from '@/lib/accountRoleMode';
import { Capacitor } from '@capacitor/core';
import { isSupabaseConfigured } from '@/lib/supabase';
import { formatLoginErrorMessage } from '@/lib/authNetworkMessage';
import { EleveConnectionLayout } from '@/pages/school/eleve-mobile/connection/EleveConnectionLayout';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { shouldUseLiriMobileLogin, FORCE_DESKTOP_LOGIN_PARAM } from '@/lib/loginEntryPath';
import { shouldShowStudentInstallGate } from '@/lib/studentWebPlatform';
import { LiriPageFooterLine } from '@/components/brand/LiriWordmark';
import { InstallAppGate } from '@/components/eleve-mobile/InstallAppGate';
import { EV_ACCENT, EV_MUTED, EV_LINE, EV_CARD, EV_CARD_INNER, EV_R, EV_SH } from '@/pages/school/eleve-mobile/eleveMobileScreensShared';
import { useTenantBranding } from '@/hooks/useTenantBranding';
import { isPlatformOrDevHost } from '@/lib/tenantResolver';
import { FOUNDER_SLUG } from '@/lib/tenant/activeTenantConfig';
import { Ripple, AnimatedForm } from '@/components/ui/animated-sign-in';

const LIRI_CTA = {
  // Coral → clay du PORTAIL LIRI (--coral #d97757 / --clay #c2683f). JAMAIS de violet
  // (#5B21B6) : LIRI = terracotta, cohérent avec LiriPortalShell / lirilogo.png.
  background: `linear-gradient(90deg, #d97757 0%, #c2683f 100%)`,
  boxShadow: EV_SH.cta,
  borderRadius: EV_R.lg,
};

const LoginPage = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [submitError, setSubmitError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  /** Re-render après opt-in « web limité » (localStorage mis à jour dans InstallAppGate). */
  const [, bumpInstallGate] = useState(0);
  const tenantCtx = useTenantBranding();
  const branding = tenantCtx.branding;
  // Le DOMAINE décide de l'identité (doc CIMOLACE_ARCHITECTURE_SOURCE_OF_TRUTH) :
  // - Hôte PLATEFORME (liri.cimolace.space, app.cimolace.space, localhost) sans tenant résolu
  //   = le PRODUIT LIRI neutre → identité LIRI (terracotta, logo LIRI, « Intelligence Live Augmentée »).
  // - Domaine de TENANT (prorascience.org) → identité du tenant (ISNA = or + Œil d'Horus + Manikongo).
  // prorascience.org ne doit JAMAIS afficher « LIRI » : LIRI est le moteur invisible (façon Shopify).
  const isPlatformLiri =
    typeof window !== 'undefined' && isPlatformOrDevHost(window.location.hostname) && !tenantCtx.slug;
  // FONDATEUR (isna) = habillage LITTÉRAL historique (or, Œil d'Horus, Institut Nocturne,
  // NGOWAZULU). TOUT AUTRE tenant = SON branding DB (nom/logo/couleurs) — jamais
  // l'habillage d'ISNA (cloison : chaque org a son identité, réf audit multi-tenant).
  const isFounderTenant = !isPlatformLiri && String(tenantCtx.slug || '') === FOUNDER_SLUG;
  // Login CHAUD (directive artistique : bannir navy/or, fond #262624) pour LIRI ET le fondateur
  // (prorascience) — l'ancien habillage or/navy « Academy » est déprécié. Tenant tiers = inchangé.
  const warmLogin = isPlatformLiri || isFounderTenant;
  const schoolBrand = isPlatformLiri ? 'LIRI' : (branding.name || 'École');
  const schoolAcademyTitle = isPlatformLiri ? 'LIRI — Intelligence Live Augmentée' : schoolBrand;
  // LIRI = terracotta du PORTAIL (--coral #d97757), pas un violet inventé. Cohérent avec
  // LiriPortalShell / le logo lirilogo.png. ISNA (tenant fondateur) = or #D4AF37.
  // Tenant tiers = SON accent (brand_colors), repli terracotta produit.
  const accentColor = isPlatformLiri
    ? '#d97757'
    : isFounderTenant
      ? '#d97757'
      : (branding.accentColor || branding.primaryColor || '#d97757');
  const brandTagline = isPlatformLiri
    ? 'Intelligence Live Augmentée'
    : isFounderTenant
      ? 'Institut Nocturne'
      : 'Espace membre';
  const footerOrg = isPlatformLiri ? 'Cimolace' : isFounderTenant ? 'NGOWAZULU' : schoolBrand;
  // Logo : Œil d'Horus pour le FONDATEUR uniquement ; tenant tiers = SON logo DB
  // (repli : aucun logo → on garde le rond neutre côté rendu). Sur LIRI : <LiriBrandIcon/>.
  const logo = isFounderTenant ? '/prorascience-logo-2.jpeg' : (branding.logo || '');
  const STATS = isPlatformLiri || !isFounderTenant
    ? [
        { icon: Radio, value: 'HD', label: 'Live' },
        { icon: Sparkles, value: 'IA', label: 'Tableau' },
        { icon: Globe, value: '∞', label: 'Écoles' },
      ]
    : [
        { icon: GraduationCap, value: '21', label: 'Modules' },
        { icon: BookOpen, value: '∞', label: 'Ressources' },
        { icon: Users, value: '5ᵉ', label: 'Manikongo' },
      ];
  const quote = isPlatformLiri
    ? { text: 'Enseignez, animez et diffusez en direct — augmenté par l’IA.', author: 'LIRI · par Cimolace' }
    : { text: 'La connaissance n’est pas un privilège, c’est une responsabilité.', author: '5ᵉ Manikongo' };
  // Sur un domaine tenant (prorascience.org), on n'expose JAMAIS la marque « LIRI » à l'utilisateur
  // final (LIRI = moteur invisible, façon Shopify) → copy 100% école.
  const subCopy = isPlatformLiri
    ? (<>Connectez-vous à votre espace <strong className="font-semibold text-white/90">LIRI</strong>.</>)
    : (<>Connectez-vous à votre espace membre <strong className="font-semibold text-white/90">{schoolBrand}</strong>.</>);

  const { login, loginWithOAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isLiriMobileAuth = location.pathname.startsWith('/m/eleve/login');
  const spLogin = new URLSearchParams(location?.search || '');
  const redirectParam = spLogin.get('redirect') || spLogin.get('next');

  // B — LA CONNEXION PASSE PAR L'OS IMMERSIF (l'OS possède l'identité — décision fondateur). Sur
  // prorascience.org, /login n'est qu'un REPLI : on renvoie vers la home OS avec l'intention
  // « login » → l'OS ouvre son formulaire inline. Échappatoire debug : ?legacy=1. Autres hosts inchangés.
  useLayoutEffect(() => {
    if (typeof window === 'undefined' || isLiriMobileAuth) return;
    const h = window.location.hostname.toLowerCase();
    if (h !== 'prorascience.org' && h !== 'www.prorascience.org') return;
    if (spLogin.get('legacy') === '1') return;
    const back = redirectParam || location.state?.from?.pathname || '';
    navigate(`/?auth=login${back ? `&redirect=${encodeURIComponent(back)}` : ''}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Défaut post-login : sur l'hôte PLATEFORME LIRI (localhost / liri.cimolace.space, sans
  // tenant résolu) → le PORTAIL LIRI (/liri), surtout PAS /dashboard qui retombe sur la
  // chrome ISNA Academy. Sur un domaine de tenant → son /dashboard (son académie).
  const from = redirectParam || location.state?.from?.pathname
    || (isLiriMobileAuth ? ELEVE_MOBILE.home : (isPlatformLiri ? '/liri' : '/dashboard'));

  // Sur petit écran, `/login` (liens, ProtectedRoute, e-mails…) envoie vers le parcours LIRI.
  useLayoutEffect(() => {
    if (isLiriMobileAuth) return;
    const sp = new URLSearchParams(location.search);
    if (sp.get(FORCE_DESKTOP_LOGIN_PARAM) === '1') return;
    if (!shouldUseLiriMobileLogin()) return;
    const next = new URLSearchParams(sp);
    if (!next.get('redirect') && !next.get('next') && location.state?.from?.pathname && location.state.from.pathname !== '/login') {
      next.set('redirect', location.state.from.pathname);
    }
    const q = next.toString();
    navigate(`${ELEVE_MOBILE.login}${q ? `?${q}` : ''}`, { replace: true, state: location.state });
  }, [isLiriMobileAuth, location.pathname, location.search, location.state, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (!formData.email || !formData.password) {
      setSubmitError('Veuillez remplir tous les champs.');
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await login(formData.email, formData.password);
      if (error) throw error;
      clearSelectedAccountRole();
      navigate(from, { replace: true });
    } catch (err) {
      if (err.message?.includes('Invalid login credentials')) {
        const base = 'E-mail ou mot de passe incorrect.';
        setSubmitError(
          Capacitor.isNativePlatform()
            ? `${base} Si vous utilisiez Google sur le site, créez d'abord un mot de passe avec le bouton ci‑dessous (même adresse e-mail).`
            : base,
        );
      } else {
        setSubmitError(formatLoginErrorMessage(err, { isNative: Capacitor.isNativePlatform() }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGoogleLogin = async () => {
    setSubmitError('');
    setIsLoading(true);
    try {
      clearSelectedAccountRole();
      const { error } = await loginWithOAuth('google', from);
      if (error) throw error;
    } catch (err) {
      setSubmitError(err.message || 'Erreur connexion Google.');
      setIsLoading(false);
    }
  };

  if (isLiriMobileAuth && shouldShowStudentInstallGate()) {
    return (
      <EleveConnectionLayout className="text-white">
        <Helmet>
          <title>{`Installer LIRI | ${schoolBrand}`}</title>
        </Helmet>
        <div className="mx-auto w-full max-w-md px-4 pb-8 pt-1">
          <div className="mb-2 flex items-center">
            <Link
              to={ELEVE_MOBILE.connexion}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white transition active:scale-95"
              style={{ border: `1px solid ${EV_LINE}`, background: 'rgba(255,255,255,0.05)' }}
              aria-label="Retour"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.1} />
            </Link>
          </div>
          <InstallAppGate
            onContinueWeb={() => {
              bumpInstallGate((n) => n + 1);
            }}
          />
        </div>
      </EleveConnectionLayout>
    );
  }

  const formBlock = (
    <>
      <div className={isLiriMobileAuth ? 'mb-6 text-center' : 'mb-8'}>
        <h1
          className={
            isLiriMobileAuth
              ? 'text-[24px] font-extrabold leading-tight tracking-tight text-white sm:text-[26px]'
              : 'text-3xl font-serif font-bold text-white mb-2'
          }
        >
          Bon retour
        </h1>
        <p className={isLiriMobileAuth ? 'mt-1.5 text-[14px] leading-relaxed' : 'text-sm text-gray-400'} style={isLiriMobileAuth ? { color: EV_MUTED } : undefined}>
          {isLiriMobileAuth ? (
            <>Accédez à votre espace d&apos;apprentissage.</>
          ) : (
            subCopy
          )}
        </p>
      </div>

      {submitError && (
        <Alert
          variant="destructive"
          className={isLiriMobileAuth ? 'mb-4 border-red-500/30 bg-red-500/10 text-red-100' : 'mb-6 bg-red-900/20 border-red-900/50 text-red-200'}
        >
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {!isSupabaseConfigured ? (
        <Alert className={isLiriMobileAuth ? 'mb-4 border-amber-500/30 bg-amber-500/10' : 'mb-5 border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[#f5e6c8]'}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Configuration serveur absente (variables Supabase). Reconstruisez l&apos;app avec un fichier .env correct.
          </AlertDescription>
        </Alert>
      ) : null}

      {Capacitor.isNativePlatform() ? (
        <>
          <Alert
            className={
              isLiriMobileAuth
                ? 'mb-3 border border-white/10 bg-white/[0.04] text-white/90'
                : 'mb-4 border-white/15 bg-white/5 text-gray-200'
            }
          >
            <AlertCircle className="h-4 w-4 shrink-0" style={{ color: accentColor }} />
            <AlertDescription className="text-sm space-y-2">
              <p>
                Sur l&apos;application Android / iOS, utilisez <strong className="text-white">e-mail et mot de passe</strong>.
                La connexion Google ne fonctionne pas dans la WebView intégrée.
              </p>
              <p>
                Compte Google sans mot de passe ? Utilisez le bouton ci‑dessous, puis ouvrez le lien reçu par e‑mail
                dans <strong className="text-white">Chrome ou Safari</strong> (pas dans une fenêtre Google dans
                l&apos;app).
              </p>
            </AlertDescription>
          </Alert>
          <Button
            type="button"
            variant="outline"
            className={
              isLiriMobileAuth
                ? 'mb-4 h-12 w-full border-[#d97757]/40 text-[#e8b6a3] hover:bg-[#d97757]/10'
                : 'w-full mb-5 h-12 border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] text-[#f5e6c8] hover:bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)]'
            }
            asChild
          >
            <Link to="/forgot-password">Créer ou réinitialiser mon mot de passe</Link>
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          className={
            isLiriMobileAuth
              ? 'mb-4 h-11 w-full text-white border-white/10 hover:bg-white/5'
              : 'w-full border-white/10 text-white hover:bg-white/5 mb-5 h-11'
          }
          style={isLiriMobileAuth ? { background: EV_CARD_INNER } : undefined}
          onClick={handleGoogleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Redirection Google...
            </>
          ) : (
            <>
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continuer avec Google
            </>
          )}
        </Button>
      )}

      <div className="mb-4 flex items-center gap-3">
        <div
          className={`h-px flex-1 ${isLiriMobileAuth ? '' : 'bg-white/10'}`}
          style={isLiriMobileAuth ? { backgroundColor: EV_LINE } : undefined}
        />
        <span className="text-xs" style={isLiriMobileAuth ? { color: EV_MUTED } : undefined}>
          {Capacitor.isNativePlatform() ? 'Connexion email' : 'ou par email'}
        </span>
        <div
          className={`h-px flex-1 ${isLiriMobileAuth ? '' : 'bg-white/10'}`}
          style={isLiriMobileAuth ? { backgroundColor: EV_LINE } : undefined}
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className={isLiriMobileAuth ? 'text-[13px] text-white' : 'text-gray-300 text-sm'}>
            Email
          </Label>
          <div className="relative">
            <Mail
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
            />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="exemple@email.com"
              value={formData.email}
              onChange={handleChange}
              className={
                isLiriMobileAuth
                  ? 'h-12 border pl-10 text-white placeholder:text-white/35 focus:border-[#d97757]/60 focus:ring-[#d97757]/25'
                  : 'pl-10 h-11 bg-[#2f2b28] border-white/10 text-white focus:border-[var(--school-accent)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]'
              }
              style={isLiriMobileAuth ? { background: EV_CARD, borderColor: EV_LINE } : undefined}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="password"
              className={isLiriMobileAuth ? 'text-[13px] text-white' : 'text-gray-300 text-sm'}
            >
              Mot de passe
            </Label>
            <Link
              to="/forgot-password"
              className={isLiriMobileAuth ? 'text-xs font-medium text-[#d97757] hover:underline' : 'text-xs text-[var(--school-accent)] hover:underline'}
            >
              Oublié ?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              className={
                isLiriMobileAuth
                  ? 'h-12 border pl-10 text-white placeholder:text-white/35 focus:border-[#d97757]/60 focus:ring-[#d97757]/25'
                  : 'pl-10 h-11 bg-[#2f2b28] border-white/10 text-white focus:border-[var(--school-accent)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]'
              }
              style={isLiriMobileAuth ? { background: EV_CARD, borderColor: EV_LINE } : undefined}
            />
          </div>
        </div>

        <Button
          type="submit"
          className={isLiriMobileAuth ? 'h-12 w-full border-0 font-bold text-white shadow-lg' : 'w-full h-11 bg-[var(--school-accent)] hover:bg-[#bfa345] text-black font-bold text-base tracking-wide'}
          style={isLiriMobileAuth ? { ...LIRI_CTA } : undefined}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connexion...
            </>
          ) : (
            'Se connecter'
          )}
        </Button>
      </form>

      <p
        className={isLiriMobileAuth ? 'mt-6 text-center text-[13px]' : 'mt-6 text-center text-sm text-gray-400'}
        style={isLiriMobileAuth ? { color: EV_MUTED } : undefined}
      >
        Pas encore inscrit ?{' '}
        <Link
          to="/signup"
          className={isLiriMobileAuth ? 'font-medium text-[#d97757] hover:underline' : 'text-[var(--school-accent)] hover:underline font-medium'}
        >
          Créer un compte
        </Link>
      </p>
    </>
  );

  if (isLiriMobileAuth) {
    return (
      <EleveConnectionLayout className="text-white">
        <Helmet>
          <title>Connexion | LIRI Élève</title>
        </Helmet>
        <div className="mx-auto w-full max-w-md px-4 pb-8 pt-1">
          <div className="mb-2 flex items-center">
            <Link
              to={ELEVE_MOBILE.connexion}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white transition active:scale-95"
              style={{ border: `1px solid ${EV_LINE}`, background: 'rgba(255,255,255,0.05)' }}
              aria-label="Retour"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.1} />
            </Link>
          </div>

          <div className="mb-6 text-center">
            <Link to={ELEVE_MOBILE.home} className="inline-flex flex-col items-center gap-2">
              {logo ? (
                <img
                  src={logo}
                  alt={schoolBrand}
                  className="h-12 w-auto max-w-[min(260px,88vw)] object-contain px-1 py-2 drop-shadow-[0_0_28px_rgba(123,97,255,0.25)]"
                />
              ) : (
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-black text-white"
                  style={{ background: accentColor }}
                >
                  {(schoolBrand || 'É').slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="font-sans text-[24px] font-extrabold tracking-tight text-white">{schoolBrand}</span>
              <span
                className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#e8b6a3]/95"
                style={{ color: EV_ACCENT }}
              >
                {brandTagline}
              </span>
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="p-4 sm:p-5"
            style={{ background: EV_CARD_INNER, border: `1px solid ${EV_LINE}`, borderRadius: EV_R.lg, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
          >
            {formBlock}
          </motion.div>

          <p className="mt-5 text-center text-[11px] leading-relaxed" style={{ color: EV_MUTED }}>
            Version complète (site web) :{' '}
            <Link
              to={`/login?${FORCE_DESKTOP_LOGIN_PARAM}=1`}
              className="font-semibold underline-offset-2 hover:underline"
              style={{ color: EV_ACCENT }}
            >
              connexion classique
            </Link>
          </p>
          <LiriPageFooterLine marginClass="mt-4" suffix="Connexion" />
        </div>
      </EleveConnectionLayout>
    );
  }

  return (
    <div
      className={warmLogin ? 'liri-neutral-login flex min-h-screen bg-[#262624]' : 'flex min-h-screen bg-[#070b14]'}
      style={warmLogin ? { '--school-accent': accentColor } : undefined}
    >
      {warmLogin && <style>{`.liri-neutral-login{--school-accent:${accentColor} !important}`}</style>}
      <Helmet>
        <title>{`Connexion | ${schoolAcademyTitle}`}</title>
      </Helmet>

      {/* ── PANNEAU GAUCHE – branding ── */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 lg:flex">
        <div
          className={warmLogin ? 'absolute inset-0' : 'absolute inset-0 bg-gradient-to-br from-[#070b14] via-[#192734] to-[#070b14]'}
          style={warmLogin ? { background: 'linear-gradient(to bottom right, #2b2926, #262624 45%, #1f1e1c)' } : undefined}
        />
        <div className="absolute left-1/4 top-1/4 h-[500px] w-[500px] rounded-full blur-[150px]" style={{ backgroundColor: `${accentColor}0d` }} />
        <div className="absolute bottom-1/4 right-1/4 h-[300px] w-[300px] rounded-full blur-[120px]" style={{ backgroundColor: warmLogin ? 'rgba(217,119,87,0.08)' : 'rgba(212,175,55,0.07)' }} />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMC4yIiBzdHJva2Utb3BhY2l0eT0iMC4wNSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==\")",
          }}
        />

        {/* Titre haut */}
        <div className="relative z-10">
          <Link to="/">
            <span className="font-serif text-2xl font-bold tracking-wider text-white">{schoolBrand}</span>
            <span className="mt-0.5 block text-[0.65rem] uppercase tracking-[0.4em]" style={{ color: accentColor }}>{brandTagline}</span>
          </Link>
        </div>

        {/* Logo centré + anneaux ripple dorés (science nocturne) */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative grid h-72 w-72 place-items-center">
            <Ripple mainCircleSize={118} numCircles={7} />
            <div className="absolute h-40 w-40 scale-110 rounded-full blur-2xl" style={{ backgroundColor: `${accentColor}33` }} />
            {isPlatformLiri ? (
              <img src="/lirilogo.png" alt="LIRI" className="relative z-10 h-48 w-48 object-contain" style={{ filter: 'drop-shadow(0 0 42px rgba(217,119,87,0.5))' }} />
            ) : logo ? (
              <img
                src={logo}
                alt={schoolBrand}
                className="relative z-10 h-44 w-44 rounded-full border-2 bg-black object-contain shadow-2xl"
                style={{ borderColor: `${accentColor}80` }}
              />
            ) : (
              <span
                className="relative z-10 grid h-44 w-44 place-items-center rounded-full border-2 bg-black text-6xl font-black text-white shadow-2xl"
                style={{ borderColor: `${accentColor}80`, color: accentColor }}
              >
                {(schoolBrand || 'É').slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Citation + stats */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-2">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: accentColor }} />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: accentColor }}>Citation du jour</span>
            </div>
            <blockquote className="font-serif text-2xl leading-relaxed text-white">
              &ldquo;{quote.text}&rdquo;
            </blockquote>
            <p className="mt-3 text-sm text-gray-400">— {quote.author}</p>
          </div>

          <div className="flex gap-8 border-t border-white/5 pt-4">
            {STATS.map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <Icon className="mb-1 h-5 w-5" style={{ color: accentColor }} />
                <span className="font-serif text-xl font-bold text-white">{value}</span>
                <span className="text-xs uppercase tracking-wider text-gray-500">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pied de page */}
        <div className="relative z-10">
          <p className="text-xs text-gray-600">© {new Date().getFullYear()} {schoolBrand} · {footerOrg}</p>
        </div>
      </div>

      {/* ── PANNEAU DROIT – formulaire animé ── */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-6 lg:p-16">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Logo mobile uniquement */}
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <Link to="/" className="inline-flex flex-col items-center gap-2">
              {isPlatformLiri ? (
                <img src="/lirilogo.png" alt="LIRI" className="h-24 w-24 object-contain" style={{ filter: 'drop-shadow(0 0 24px rgba(217,119,87,0.5))' }} />
              ) : logo ? (
                <img src={logo} alt={schoolBrand} className="h-20 w-20 rounded-full border-2 bg-black object-contain" style={{ borderColor: `${accentColor}80` }} />
              ) : (
                <span className="grid h-20 w-20 place-items-center rounded-full border-2 bg-black text-3xl font-black" style={{ borderColor: `${accentColor}80`, color: accentColor }}>
                  {(schoolBrand || 'É').slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="font-serif text-2xl font-bold tracking-wider text-white">{schoolBrand}</span>
              <span className="text-[0.6rem] uppercase tracking-[0.3em]" style={{ color: accentColor }}>{brandTagline}</span>
            </Link>
          </div>

          <AnimatedForm
            header="Bon retour"
            subHeader={subCopy}
            fields={[
              { label: 'Email', name: 'email', type: 'email', placeholder: 'exemple@email.com', value: formData.email, onChange: handleChange },
              { label: 'Mot de passe', name: 'password', type: 'password', placeholder: '••••••••', value: formData.password, onChange: handleChange },
            ]}
            submitButton="Se connecter"
            submitting={isLoading}
            errorField={submitError}
            onSubmit={handleSubmit}
            googleLogin={isSupabaseConfigured ? 'Continuer avec Google' : undefined}
            onGoogle={handleGoogleLogin}
            forgotLabel="Oublié ?"
            onForgot={() => navigate('/forgot-password')}
            footer={<>Pas encore inscrit ?{' '}<Link to={isPlatformLiri ? '/creer-organisation' : '/signup'} className="font-medium text-[var(--school-accent)] hover:underline">{isPlatformLiri ? 'Créer mon organisation' : 'Créer un compte'}</Link></>}
          />
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
