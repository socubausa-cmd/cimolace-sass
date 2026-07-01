import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Loader2, Users, ArrowRight, AlertCircle, Building2, Check } from 'lucide-react';
import { joinApi } from '@/lib/api-v2';
import { useAuth } from '@/hooks/useAuth';
import { authStore } from '@/lib/auth-store';

const ACCENT = '#d97757'; // terracotta LIRI
const PENDING_JOIN_KEY = 'liri_pending_join_org';

function normalizeSlug(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

/**
 * P3 — Page /rejoindre.
 * Lit ?org=<slug> ; sinon champ de saisie manuelle. Résout le nom+logo de l'org
 * via joinApi.resolveOrg. CTA « Rejoindre » :
 *  - connecté → joinApi.joinTenant + setTenantSlug + /dashboard
 *  - non connecté → persiste le slug en sessionStorage puis /login?redirect=…
 * Au montage, reprend un slug en attente après login.
 */
export default function JoinOrgPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  // Slug initial : ?org=… sinon, si connecté, un slug en attente post-login.
  const initialSlug = useMemo(() => {
    const fromQuery = normalizeSlug(searchParams.get('org') || '');
    if (fromQuery) return fromQuery;
    if (user) {
      try {
        const pending = normalizeSlug(sessionStorage.getItem(PENDING_JOIN_KEY) || '');
        if (pending) {
          sessionStorage.removeItem(PENDING_JOIN_KEY);
          return pending;
        }
      } catch (_) {}
    }
    return '';
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [slugInput, setSlugInput] = useState(initialSlug);
  const [org, setOrg] = useState(null); // { slug, name, logo_url } | null
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState(false); // une résolution a-t-elle eu lieu
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const slug = normalizeSlug(slugInput);

  // Résolution de l'org (nom+logo) — debounce léger.
  useEffect(() => {
    if (slug.length < 2) {
      setOrg(null);
      setResolved(false);
      return;
    }
    let cancelled = false;
    setResolving(true);
    setError('');
    const t = setTimeout(async () => {
      try {
        const data = await joinApi.resolveOrg(slug);
        if (cancelled) return;
        setOrg(data || null);
        setResolved(true);
      } catch (_) {
        if (cancelled) return;
        setOrg(null);
        setResolved(true);
      } finally {
        if (!cancelled) setResolving(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [slug]);

  const handleJoin = async () => {
    if (slug.length < 2) {
      setError("Saisissez le code ou l'identifiant de votre organisation.");
      return;
    }
    if (org?.embedded) {
      // Embarqué : injoignable depuis le host neutre LIRI (on passe par son domaine).
      setError('Aucune organisation ne correspond à cet identifiant.');
      return;
    }
    setError('');

    // Non connecté → mémoriser le slug et router vers /login avec retour.
    if (!user) {
      try { sessionStorage.setItem(PENDING_JOIN_KEY, slug); } catch (_) {}
      navigate(`/login?redirect=${encodeURIComponent('/rejoindre?org=' + slug)}`);
      return;
    }

    // Connecté → self-join idempotent.
    setJoining(true);
    try {
      await joinApi.joinTenant(slug); // { ok, joined, role } — joined=false = déjà membre, on route quand même
      authStore.setTenantSlug(slug);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err?.message || "Cette organisation est introuvable ou inactive.");
      setJoining(false);
    }
  };

  const orgName = org?.name?.trim();
  // Séparation dure : un tenant EMBARQUÉ (site propre) est traité comme INTROUVABLE
  // sur le host neutre LIRI — on ne révèle ni ne rejoint ISNA & co via liri.cimolace.space.
  const isEmbedded = org?.embedded === true;
  const notFound = resolved && !resolving && slug.length >= 2 && (!org || isEmbedded);

  return (
    <div
      className="liri-join relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-12 text-white"
      style={{ '--school-accent': ACCENT, background: '#15130f' }}
    >
      <Helmet><title>Rejoindre une organisation | LIRI</title></Helmet>

      {/* Blobs chauds */}
      <div className="pointer-events-none absolute -left-24 top-12 h-[480px] w-[480px] rounded-full blur-[170px]" style={{ background: 'rgba(217,119,87,0.16)' }} />
      <div className="pointer-events-none absolute bottom-0 right-4 h-72 w-72 rounded-full blur-[150px]" style={{ background: 'rgba(194,104,63,0.10)' }} />

      <motion.div
        initial={{ y: 16 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[420px]"
      >
        <div className="mb-7 flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(217,119,87,0.14)' }}>
            <Users className="h-7 w-7" style={{ color: ACCENT }} strokeWidth={2.1} />
          </span>
        </div>

        <div
          className="w-full rounded-2xl p-7 pt-8 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.07)]"
          style={{ background: '#221f1b' }}
        >
          <h1 className="text-center text-[1.5rem] font-bold leading-tight tracking-tight">
            Rejoindre une organisation
          </h1>
          <p className="mt-1.5 text-center text-[13.5px] text-white/40">
            Entrez le code ou l'identifiant fourni par votre organisation.
          </p>

          {error && (
            <div className="mt-5 flex items-start gap-2 rounded-xl border border-red-900/40 bg-red-950/40 px-3.5 py-2.5 text-[13px] text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Saisie du code/slug */}
          <div className="mt-5 space-y-1.5">
            <label htmlFor="org-slug" className="text-[12.5px] font-medium text-white/60">
              Identifiant de l'organisation
            </label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-[16px] w-[16px] -translate-y-1/2 text-white/28" />
              <input
                id="org-slug"
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
                placeholder="mon-organisation"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className="h-11 w-full rounded-xl border border-white/[0.09] bg-white/[0.04] pl-10 pr-10 font-mono text-white outline-none transition-colors placeholder:text-white/25 focus:border-[var(--school-accent)]"
              />
              {resolving && (
                <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/35" />
              )}
              {!resolving && org && !isEmbedded && (
                <Check className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
              )}
            </div>
          </div>

          {/* Carte org résolue (jamais pour un embarqué → séparation dure) */}
          {orgName && !isEmbedded && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5">
              {org?.logo_url ? (
                <img src={org.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(217,119,87,0.14)' }}>
                  <Building2 className="h-5 w-5" style={{ color: ACCENT }} />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-white">{orgName}</p>
                <p className="truncate font-mono text-[11.5px] text-white/35">/{slug}</p>
              </div>
            </div>
          )}

          {/* Org introuvable */}
          {notFound && (
            <p className="mt-3 text-center text-[12.5px] text-white/40">
              Aucune organisation ne correspond à cet identifiant.
            </p>
          )}

          {/* CTA Rejoindre */}
          <button
            type="button"
            onClick={handleJoin}
            disabled={joining || slug.length < 2}
            className="group mt-5 flex h-11 w-full items-center justify-center rounded-xl font-semibold text-white shadow-[0_10px_28px_-10px_rgba(217,119,87,0.55)] transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-55 disabled:hover:translate-y-0"
            style={{ background: 'linear-gradient(90deg,#e2855f 0%,#d97757 50%,#c2683f 100%)' }}
          >
            {joining
              ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connexion…</>)
              : (<>{user ? 'Rejoindre' : 'Continuer'} <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>)}
          </button>

          {!user && (
            <p className="mt-4 text-center text-[12.5px] text-white/35">
              Vous serez invité à vous connecter, puis ramené ici pour finaliser.
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-[13px] text-white/38">
          Vous voulez plutôt lancer votre espace ?{' '}
          <Link to="/creer-organisation" className="font-semibold hover:underline" style={{ color: ACCENT }}>
            Créer une organisation
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
