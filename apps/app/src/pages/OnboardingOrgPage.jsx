import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

const ACCENT = '#d97757'; // terracotta LIRI (cohérent LiriPortalShell / login plateforme)

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
 * C'est l'entrée produit de liri.cimolace.space : aucun rattachement à isna.
 */
export default function OnboardingOrgPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [orgName, setOrgName] = useState('');
  const [slugEdited, setSlugEdited] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [slugState, setSlugState] = useState({ checking: false, available: null, slug: '' });

  // Slug = champ édité s'il existe, sinon dérivé du nom d'organisation.
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
      const payload = body?.data ?? body; // l'API NestJS enveloppe la réponse dans { data: ... }
      setSlugState({ checking: false, available: Boolean(payload?.available), slug: s });
    } catch {
      setSlugState({ checking: false, available: null, slug: s });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!orgName.trim() || !email.trim() || !password) {
      setError('Renseignez le nom de l’organisation, votre e-mail et un mot de passe.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (slug.length < 2) {
      setError('Le nom de l’organisation doit produire un identifiant valide (≥ 2 caractères).');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/signup/tenant`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          platformName: orgName.trim(),
          slug,
          kind: 'liri',
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // L'API enveloppe les erreurs dans { error: { code, message } } ; fallback message direct.
        throw new Error(body?.error?.message || body?.message || 'Création impossible. Réessayez.');
      }
      const payload = body?.data ?? body; // { data: { tenant, user, next_url } }
      const createdSlug = payload?.tenant?.slug || slug;
      const nextUrl = payload?.next_url || `/t/${createdSlug}/admin`;
      // Connecte le nouvel owner (user créé avec email_confirm:true → connexion directe).
      const { error: loginErr } = await login(email.trim(), password);
      if (loginErr) {
        // Compte créé mais connexion échouée → renvoyer vers le login plutôt que bloquer.
        navigate('/login', { replace: true });
        return;
      }
      authStore.setTenantSlug(createdSlug);
      navigate(nextUrl, { replace: true });
    } catch (err) {
      setError(err?.message || 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  };

  const slugBadge = slugState.slug && slugState.slug === slug && slugState.available !== null && !slugState.checking
    ? (slugState.available
        ? <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><Check size={13} /> disponible</span>
        : <span className="inline-flex items-center gap-1 text-xs text-red-400"><X size={13} /> déjà pris</span>)
    : (slugState.checking ? <span className="inline-flex items-center gap-1 text-xs text-white/40"><Loader2 size={13} className="animate-spin" /> vérification…</span> : null);

  const features = [
    { icon: Wand2, title: 'Création par IA' },
    { icon: Video, title: 'Lives & visio' },
    { icon: GraduationCap, title: 'Cours & classe' },
    { icon: Sparkles, title: 'Smartboard IA' },
    { icon: MessagesSquare, title: 'Forum & chat' },
    { icon: CalendarDays, title: 'Agenda' },
  ];

  const inputCls =
    'h-12 rounded-xl border-white/10 bg-white/[0.035] text-white transition-colors placeholder:text-white/30 focus:border-[var(--school-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--school-accent)_22%,transparent)]';
  const labelCls = 'text-[13px] font-medium text-white/70';
  // Entrée = glissement subtil SANS gater la visibilité (pas d'opacity:0 → le contenu
  // reste visible même si rAF est throttlé en arrière-plan / reduced-motion / headless).
  const fade = (delay = 0) => ({
    initial: { y: 16 },
    animate: { y: 0 },
    transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] },
  });

  return (
    <div className="liri-onboarding relative flex min-h-screen bg-[#1f1d1b] text-white" style={{ '--school-accent': ACCENT }}>
      <style>{`.liri-onboarding{--school-accent:${ACCENT} !important}`}</style>
      <Helmet><title>Créer mon organisation | LIRI</title></Helmet>

      {/* ── GAUCHE : marque LIRI + valeur (desktop) ── */}
      <aside className="relative hidden w-[44%] flex-col justify-between overflow-hidden p-12 xl:p-16 lg:flex">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(150deg,#2c2926 0%,#221f1d 55%,#1a1816 100%)' }} />
        <div className="absolute -left-24 top-16 h-[440px] w-[440px] rounded-full blur-[150px]" style={{ background: 'rgba(217,119,87,0.16)' }} />
        <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full blur-[130px]" style={{ background: 'rgba(226,85,63,0.10)' }} />

        <motion.div {...fade()} className="relative z-10">
          <img src="/liri-logo-official.png" alt="LIRI" className="h-24 w-auto object-contain" style={{ filter: 'drop-shadow(0 0 26px rgba(217,119,87,0.45))' }} />
        </motion.div>

        <motion.div {...fade(0.08)} className="relative z-10 max-w-md">
          <h2 className="font-serif text-[2.05rem] font-semibold leading-[1.16] tracking-tight text-white">
            Votre école,<br />
            votre culte,<br />
            vos débats. <span className="text-[var(--school-accent)]">En live.</span>
          </h2>
          <p className="mt-4 text-[15px] text-white/55">Comme Zoom — mais à vous. Augmenté par l’IA.</p>
          <ul className="mt-9 grid max-w-sm grid-cols-2 gap-x-5 gap-y-4">
            {features.map(({ icon: Icon, title }) => (
              <li key={title} className="flex items-center gap-2.5">
                <Icon className="h-[18px] w-[18px] shrink-0 text-[var(--school-accent)]" strokeWidth={2} />
                <span className="text-sm font-medium text-white/80">{title}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        <div className="relative z-10 text-[12px] text-white/35">© {new Date().getFullYear()} LIRI · une plateforme Cimolace</div>
      </aside>

      {/* ── DROITE : formulaire ── */}
      <main className="relative flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="pointer-events-none absolute right-8 top-10 hidden h-72 w-72 rounded-full blur-[140px] lg:block" style={{ background: 'rgba(217,119,87,0.07)' }} />
        <motion.div {...fade()} className="relative z-10 w-full max-w-[420px]">
          {/* logo + nom (mobile) */}
          <div className="mb-8 flex justify-center lg:hidden">
            <img src="/liri-logo-official.png" alt="LIRI" className="h-20 w-auto object-contain" />
          </div>

          <h1 className="text-[1.7rem] font-bold leading-tight tracking-tight text-white">Créez votre organisation</h1>
          <p className="mt-1.5 text-sm text-white/55">Quelques secondes, et votre espace LIRI est à vous.</p>

          {error && (
            <Alert variant="destructive" className="mt-6 border-red-900/50 bg-red-900/20 text-red-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="org" className={labelCls}>Nom de l’organisation</Label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/35" />
                <Input
                  id="org" value={orgName}
                  onChange={(e) => { setOrgName(e.target.value); if (!slugEdited) checkSlug(e.target.value); }}
                  placeholder="Mon Académie, Ma Clinique, Mon Studio…"
                  className={`${inputCls} pl-11`}
                />
              </div>
              <div className="flex items-center justify-between gap-2 pl-1 pt-0.5">
                <span className="truncate text-xs text-white/40">
                  liri.cimolace.space/t/<span className="font-mono text-white/65">{slug || '…'}</span>
                </span>
                {slugBadge}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="slug" className={labelCls}>Identifiant <span className="text-white/35">(modifiable)</span></Label>
              <Input
                id="slug" value={slugEdited || slug}
                onChange={(e) => { setSlugEdited(e.target.value); checkSlug(e.target.value); }}
                placeholder="mon-organisation"
                className={`${inputCls} font-mono`}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className={labelCls}>Votre e-mail <span className="text-white/35">(compte propriétaire)</span></Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/35" />
                <Input
                  id="email" type="email" autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com"
                  className={`${inputCls} pl-11`}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className={labelCls}>Mot de passe <span className="text-white/35">(8 car. min.)</span></Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/35" />
                <Input
                  id="password" type="password" autoComplete="new-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                  className={`${inputCls} pl-11`}
                />
              </div>
            </div>

            <Button
              type="submit" disabled={submitting || slugState.available === false}
              className="group mt-1 h-12 w-full rounded-xl font-semibold text-white shadow-[0_12px_32px_-12px_rgba(217,119,87,0.6)] transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
              style={{ background: 'linear-gradient(90deg,#e2855f 0%,#d97757 50%,#c2683f 100%)' }}
            >
              {submitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Création de votre espace…</>)
                : (<>Créer mon organisation <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>)}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-white/45">
            Déjà une organisation ?{' '}
            <Link to="/login" className="font-semibold text-[var(--school-accent)] hover:underline">Se connecter</Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
