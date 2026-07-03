import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Loader2, Building2, Mail, Lock, Check, X, AlertCircle, ArrowRight, Video, Sparkles, MessagesSquare, CalendarDays, Wand2, GraduationCap } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getApiBaseUrl } from '@/lib/apiBase';
import { useAuth } from '@/hooks/useAuth';
import { authStore } from '@/lib/auth-store';

// SVG Google officiel (Simple Icons)
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const ACCENT = '#d97757'; // terracotta LIRI

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

/**
 * « Créer mon organisation » — onboarding SELF-SERVICE LIRI (façon Zoom).
 * Consomme l'endpoint public POST /signup/tenant (crée compte + tenant + membership
 * owner), connecte l'utilisateur, puis le redirige vers son back-office /t/{slug}/admin.
 */
const PENDING_ORG_KEY = 'liri_pending_org';

export default function OnboardingOrgPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithOAuth, user, session } = useAuth();

  // Détecte le retour OAuth (?oauth=1) : l'user est déjà authentifié via Google.
  const isOAuthReturn = new URLSearchParams(location.search).get('oauth') === '1';

  const [orgName, setOrgName] = useState('');
  const [slugEdited, setSlugEdited] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [slugState, setSlugState] = useState({ checking: false, available: null, slug: '' });

  // Au retour OAuth : restaurer l'org pré-remplie et déclencher la création automatique.
  useEffect(() => {
    if (!isOAuthReturn || !session) return;
    try {
      const pending = JSON.parse(sessionStorage.getItem(PENDING_ORG_KEY) || 'null');
      if (pending?.orgName) {
        setOrgName(pending.orgName);
        setSlugEdited(pending.slug || '');
        // Auto-soumettre si les données sont complètes (org + slug valide)
        if (pending.orgName.length >= 2) {
          setSubmitting(true);
          (async () => {
            try {
              const res = await fetch(`${getApiBaseUrl()}/signup/tenant-from-oauth`, {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ platformName: pending.orgName, slug: pending.slug || undefined, kind: 'liri' }),
              });
              const body = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(body?.error?.message || body?.message || 'Création impossible.');
              const payload = body?.data ?? body;
              sessionStorage.removeItem(PENDING_ORG_KEY);
              authStore.setTenantSlug(payload?.tenant?.slug);
              navigate(payload?.next_url || '/liri', { replace: true });
            } catch (err) {
              setError(err?.message || 'Une erreur est survenue après la connexion Google.');
            } finally {
              setSubmitting(false);
            }
          })();
        }
      }
    } catch (_) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOAuthReturn, session]);

  const slug = useMemo(() => (slugEdited.trim() ? slugify(slugEdited) : slugify(orgName)), [slugEdited, orgName]);

  const checkSlug = async (value) => {
    const s = slugify(value);
    if (s.length < 2) { setSlugState({ checking: false, available: null, slug: s }); return; }
    setSlugState({ checking: true, available: null, slug: s });
    try {
      const res = await fetch(`${getApiBaseUrl()}/signup/tenant/check-slug`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: s }),
      });
      const body = await res.json().catch(() => ({}));
      const payload = body?.data ?? body;
      setSlugState({ checking: false, available: Boolean(payload?.available), slug: s });
    } catch {
      setSlugState({ checking: false, available: null, slug: s });
    }
  };

  const handleGoogleSignup = async () => {
    if (!orgName.trim() || slug.length < 2) {
      setError('Renseignez d\'abord le nom de l\'organisation avant de continuer avec Google.');
      return;
    }
    setError('');
    setGoogleLoading(true);
    try {
      // Sauvegarder l'org en sessionStorage avant la redirection OAuth.
      sessionStorage.setItem(PENDING_ORG_KEY, JSON.stringify({ orgName: orgName.trim(), slug }));
      const { error: oauthErr } = await loginWithOAuth('google', '/creer-organisation?oauth=1');
      if (oauthErr) throw new Error(oauthErr.message || 'Erreur connexion Google.');
      // loginWithOAuth fait window.location.assign → cette ligne n'est atteinte qu'en cas d'erreur.
    } catch (err) {
      setError(err?.message || 'Impossible de se connecter avec Google.');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!orgName.trim() || !email.trim() || !password) {
      setError('Renseignez le nom de l\'organisation, votre e-mail et un mot de passe.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (slug.length < 2) {
      setError('Le nom de l\'organisation doit produire un identifiant valide (≥ 2 caractères).');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/signup/tenant`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, platformName: orgName.trim(), slug, kind: 'liri' }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message || body?.message || 'Création impossible. Réessayez.');
      const payload = body?.data ?? body;
      const createdSlug = payload?.tenant?.slug || slug;
      const nextUrl = payload?.next_url || `/t/${createdSlug}/admin`;
      authStore.setTenantSlug(createdSlug);
      const { error: loginErr } = await login(email.trim(), password);
      if (loginErr) { navigate('/login', { replace: true }); return; }
      navigate(nextUrl, { replace: true });
    } catch (err) {
      setError(err?.message || 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  };

  const slugBadge = slugState.slug && slugState.slug === slug && slugState.available !== null && !slugState.checking
    ? (slugState.available
        ? <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><Check size={12} /> disponible</span>
        : <span className="inline-flex items-center gap-1 text-xs text-red-400"><X size={12} /> déjà pris</span>)
    : (slugState.checking ? <span className="inline-flex items-center gap-1 text-xs text-white/35"><Loader2 size={12} className="animate-spin" /> vérification…</span> : null);

  const features = [
    { icon: Wand2, title: 'Création par IA' },
    { icon: Video, title: 'Lives & visio' },
    { icon: GraduationCap, title: 'Cours & classe' },
    { icon: Sparkles, title: 'Smartboard IA' },
    { icon: MessagesSquare, title: 'Forum & chat' },
    { icon: CalendarDays, title: 'Agenda' },
  ];

  const inputCls = 'h-11 rounded-xl border-white/[0.09] bg-white/[0.04] text-white transition-colors placeholder:text-white/25 focus:border-[var(--school-accent)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--school-accent)_25%,transparent)]';
  const labelCls = 'text-[12.5px] font-medium text-white/60';

  // Glissement sans gater l'opacité — contenu visible même si rAF est throttlé.
  const slide = (delay = 0) => ({
    initial: { y: 14 },
    animate: { y: 0 },
    transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] },
  });

  return (
    <div
      className="liri-onboarding relative flex min-h-screen text-white"
      style={{ '--school-accent': ACCENT, background: '#15130f' }}
    >
      <style>{`.liri-onboarding{--school-accent:${ACCENT} !important}`}</style>
      <Helmet><title>Créer mon organisation | LIRI</title></Helmet>

      {/* ── GAUCHE : marque + valeur ── */}
      <aside className="relative hidden w-[50%] flex-col overflow-hidden lg:flex" style={{ background: 'linear-gradient(145deg,#1d1b17 0%,#17150f 60%,#131008 100%)' }}>
        {/* Blobs chauds */}
        <div className="pointer-events-none absolute -left-24 top-12 h-[520px] w-[520px] rounded-full blur-[160px]" style={{ background: 'rgba(217,119,87,0.20)' }} />
        <div className="pointer-events-none absolute bottom-0 right-10 h-72 w-72 rounded-full blur-[130px]" style={{ background: 'rgba(194,104,63,0.12)' }} />
        {/* Séparateur vertical subtil */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px" style={{ background: 'linear-gradient(to bottom,transparent,rgba(255,255,255,0.05) 20%,rgba(255,255,255,0.05) 80%,transparent)' }} />

        <div className="relative z-10 flex flex-1 flex-col justify-between p-10 xl:p-14">
          {/* Logo */}
          <motion.div {...slide()}>
            <img
              src="/liri-logo-official.png"
              alt="LIRI"
              className="h-52 w-auto object-contain xl:h-64"
              style={{ filter: 'drop-shadow(0 0 36px rgba(217,119,87,0.38))' }}
            />
          </motion.div>

          {/* Pitch central */}
          <motion.div {...slide(0.07)} className="mt-2 flex-1 flex flex-col justify-center py-6">
            <h2
              className="font-serif text-[2.2rem] font-semibold leading-[1.13] tracking-[-0.02em] text-white xl:text-[2.6rem]"
              style={{ textWrap: 'balance' }}
            >
              Votre école,<br />
              votre culte,<br />
              vos débats.{' '}
              <span style={{ color: ACCENT }}>En&nbsp;live.</span>
            </h2>
            <p className="mt-4 text-[14.5px] leading-relaxed text-white/45">
              Comme Zoom — mais à vous. Augmenté par l'IA.
            </p>

            {/* Box features — inspiré Murf stats card */}
            <div
              className="mt-8 rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <p className="mb-4 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/30">
                Inclus dans votre espace
              </p>
              <ul className="grid grid-cols-2 gap-x-5 gap-y-3.5">
                {features.map(({ icon: Icon, title }) => (
                  <li key={title} className="flex items-center gap-2.5">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: 'rgba(217,119,87,0.14)' }}
                    >
                      <Icon className="h-[14px] w-[14px]" style={{ color: ACCENT }} strokeWidth={2.1} />
                    </span>
                    <span className="text-[13px] font-medium text-white/72">{title}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* Bas : social proof */}
          <motion.div {...slide(0.14)} className="flex items-center gap-3">
            {/* Avatars factices */}
            <div className="flex -space-x-2">
              {[
                'from-[#e2855f]/70 to-[#d97757]/40',
                'from-[#c2683f]/60 to-[#a85530]/35',
                'from-[#d97757]/50 to-[#b86040]/30',
              ].map((grad, i) => (
                <span
                  key={i}
                  className={`block h-7 w-7 rounded-full bg-gradient-to-br ${grad}`}
                  style={{ border: '2px solid #17150f' }}
                />
              ))}
            </div>
            <p className="text-[12.5px] text-white/38">
              Des centaines d'organisations déjà actives
            </p>
          </motion.div>
        </div>
      </aside>

      {/* ── DROITE : carte flottante ── */}
      <main className="relative flex flex-1 items-center justify-center px-5 py-12">
        {/* Blob droit subtil */}
        <div className="pointer-events-none absolute right-4 top-1/3 h-80 w-80 rounded-full blur-[160px]" style={{ background: 'rgba(217,119,87,0.06)' }} />

        <motion.div {...slide()} className="relative z-10 w-full max-w-[410px]">
          {/* Logo mobile (hors carte, au-dessus) */}
          <div className="mb-7 flex justify-center lg:hidden">
            <img
              src="/liri-logo-official.png"
              alt="LIRI"
              className="h-36 w-auto object-contain"
              style={{ filter: 'drop-shadow(0 0 24px rgba(217,119,87,0.35))' }}
            />
          </div>

          {/* Carte flottante */}
          <div
            className="w-full rounded-2xl p-7 pt-8 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.07)]"
            style={{ background: '#221f1b' }}
          >
            <h1 className="text-[1.5rem] font-bold leading-tight tracking-tight text-white">
              Créez votre organisation
            </h1>
            <p className="mt-1.5 text-[13.5px] text-white/40">
              Quelques secondes et votre espace LIRI est prêt.
            </p>

            {error && (
              <Alert variant="destructive" className="mt-5 border-red-900/40 bg-red-950/40 text-red-300">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-[13px]">{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
              {/* Nom */}
              <div className="space-y-1.5">
                <Label htmlFor="org" className={labelCls}>Nom de l'organisation</Label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-[16px] w-[16px] -translate-y-1/2 text-white/28" />
                  <Input
                    id="org" value={orgName}
                    onChange={(e) => { setOrgName(e.target.value); if (!slugEdited) checkSlug(e.target.value); }}
                    placeholder="Mon Académie, Ma Clinique…"
                    className={`${inputCls} pl-10`}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 px-0.5">
                  <span className="truncate text-[11px] text-white/30">
                    /t/<span className="font-mono text-white/50">{slug || '…'}</span>
                  </span>
                  {slugBadge}
                </div>
              </div>

              {/* Slug */}
              <div className="space-y-1.5">
                <Label htmlFor="slug" className={labelCls}>
                  Identifiant <span className="text-white/28">(modifiable)</span>
                </Label>
                <Input
                  id="slug" value={slugEdited || slug}
                  onChange={(e) => { setSlugEdited(e.target.value); checkSlug(e.target.value); }}
                  placeholder="mon-organisation"
                  className={`${inputCls} font-mono`}
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className={labelCls}>
                  E-mail <span className="text-white/28">(compte propriétaire)</span>
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[16px] w-[16px] -translate-y-1/2 text-white/28" />
                  <Input
                    id="email" type="email" autoComplete="email" value={email}
                    onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com"
                    className={`${inputCls} pl-10`}
                  />
                </div>
              </div>

              {/* Mot de passe */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className={labelCls}>
                  Mot de passe <span className="text-white/28">(8 car. min.)</span>
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[16px] w-[16px] -translate-y-1/2 text-white/28" />
                  <Input
                    id="password" type="password" autoComplete="new-password" value={password}
                    onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                    className={`${inputCls} pl-10`}
                  />
                </div>
              </div>

              {/* CTA */}
              <Button
                type="submit"
                disabled={submitting || slugState.available === false}
                className="group mt-1 h-11 w-full rounded-xl font-semibold text-white shadow-[0_10px_28px_-10px_rgba(217,119,87,0.55)] transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-55 disabled:hover:translate-y-0"
                style={{ background: 'linear-gradient(90deg,#e2855f 0%,#d97757 50%,#c2683f 100%)' }}
              >
                {submitting
                  ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Création en cours…</>)
                  : (<>Créer mon organisation <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>)}
              </Button>
            </form>

            {/* OR divider */}
            <div className="mt-5 flex items-center gap-3">
              <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <span className="text-[11px] font-medium text-white/25">OU</span>
              <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {/* Bouton Google */}
            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={googleLoading || submitting}
              className="mt-3 flex h-11 w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border font-medium text-white/85 transition-colors duration-150 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}
            >
              {googleLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <GoogleIcon />}
              <span className="text-[13.5px]">Continuer avec Google</span>
            </button>

            <p className="mt-4 text-center text-[13px] text-white/38">
              Déjà une organisation ?{' '}
              <Link to="/login" className="font-semibold hover:underline" style={{ color: ACCENT }}>
                Se connecter
              </Link>
            </p>
          </div>

          {/* Mention légale sous la carte */}
          <p className="mt-5 text-center text-[11px] leading-relaxed text-white/22">
            En créant votre espace, vous acceptez les{' '}
            <Link to="/conditions-utilisation" className="hover:text-white/40 transition-colors">Conditions d'utilisation</Link>
            {' '}et la{' '}
            <Link to="/politique-confidentialite" className="hover:text-white/40 transition-colors">Politique de confidentialité</Link>.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
