import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Loader2, Building2, Mail, Lock, Check, X, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LiriBrandIcon } from '@/components/brand/LiriWordmark';
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
      setSlugState({ checking: false, available: Boolean(body?.available), slug: s });
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
        throw new Error(body?.message || 'Création impossible. Réessayez.');
      }
      const createdSlug = body?.tenant?.slug || slug;
      const nextUrl = body?.next_url || `/t/${createdSlug}/admin`;
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070b14] px-4 py-10" style={{ '--school-accent': ACCENT }}>
      <Helmet><title>Créer mon organisation | LIRI</title></Helmet>
      <div className="w-full max-w-md">
        <div className="mb-7 flex flex-col items-center text-center">
          <LiriBrandIcon className="h-14 w-14" style={{ filter: 'drop-shadow(0 0 22px rgba(217,119,87,0.45))' }} />
          <h1 className="mt-4 text-2xl font-bold text-white">Créez votre organisation LIRI</h1>
          <p className="mt-1.5 text-sm text-gray-400">
            Votre espace live, smartboard IA, forum et agenda — prêt en une minute. Comme Zoom, mais à vous.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-5 border-red-900/50 bg-red-900/20 text-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org" className="text-sm text-gray-300">Nom de l’organisation</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <Input
                id="org" value={orgName}
                onChange={(e) => { setOrgName(e.target.value); if (!slugEdited) checkSlug(e.target.value); }}
                placeholder="Mon Académie, Ma Clinique, Mon Studio…"
                className="h-11 border-white/10 bg-[#111a26] pl-10 text-white focus:border-[var(--school-accent)]"
              />
            </div>
            <div className="flex items-center justify-between pl-1">
              <span className="text-xs text-white/40">
                URL : <span className="font-mono text-white/70">liri.cimolace.space/t/{slug || '…'}</span>
              </span>
              {slugBadge}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug" className="text-sm text-gray-300">Identifiant (modifiable)</Label>
            <Input
              id="slug" value={slugEdited || slug}
              onChange={(e) => { setSlugEdited(e.target.value); checkSlug(e.target.value); }}
              placeholder="mon-organisation"
              className="h-11 border-white/10 bg-[#111a26] font-mono text-white focus:border-[var(--school-accent)]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm text-gray-300">Votre e-mail (compte propriétaire)</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <Input
                id="email" type="email" autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com"
                className="h-11 border-white/10 bg-[#111a26] pl-10 text-white focus:border-[var(--school-accent)]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm text-gray-300">Mot de passe (8 caractères min.)</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <Input
                id="password" type="password" autoComplete="new-password" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                className="h-11 border-white/10 bg-[#111a26] pl-10 text-white focus:border-[var(--school-accent)]"
              />
            </div>
          </div>

          <Button
            type="submit" disabled={submitting || slugState.available === false}
            className="mt-2 h-12 w-full font-bold text-white"
            style={{ background: `linear-gradient(90deg, ${ACCENT} 0%, #b85c3e 100%)` }}
          >
            {submitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Création de votre espace…</>)
              : (<>Créer mon organisation <ArrowRight className="ml-1 h-4 w-4" /></>)}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          Déjà une organisation ?{' '}
          <Link to="/login" className="font-medium hover:underline" style={{ color: ACCENT }}>Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
