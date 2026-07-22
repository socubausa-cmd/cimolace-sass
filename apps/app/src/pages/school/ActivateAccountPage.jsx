import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { DEFAULT_TENANT_SLUG } from '@/config/platform';
import { studentInviteApi } from '@/lib/api-v2';
import { useTenantBranding } from '@/hooks/useTenantBranding';

/**
 * Activation d'accès élève par CODE OTP (L5). L'élève arrive ici via le lien de
 * l'email (`/t/:slug/activer?email=...&code=...`) OU saisit son code à la main.
 * Il pose son mot de passe → le serveur crée/retrouve son compte + sa membership,
 * puis on le renvoie vers la connexion. Mobile-first, thème chaud LIRI.
 */
export default function ActivateAccountPage() {
  const { tenantSlug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const slug = tenantSlug || DEFAULT_TENANT_SLUG;
  // Page PRÉ-CONNEXION autonome (sans header portail) → elle porte sa PROPRE identité tenant.
  const { branding } = useTenantBranding();

  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [code, setCode] = useState((searchParams.get('code') || '').toUpperCase());
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState({ state: 'idle', message: '' });

  const pwOk = password.length >= 8;
  const match = password === confirm;
  const canSubmit = useMemo(
    () => email.trim() && code.trim().length >= 6 && pwOk && match && status.state !== 'submitting',
    [email, code, pwOk, match, status.state],
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (!pwOk) { setStatus({ state: 'error', message: 'Mot de passe : 8 caractères minimum.' }); return; }
    if (!match) { setStatus({ state: 'error', message: 'Les deux mots de passe ne correspondent pas.' }); return; }
    setStatus({ state: 'submitting', message: '' });
    try {
      await studentInviteApi.redeem({
        tenantSlug: slug,
        email: email.trim(),
        code: code.trim().toUpperCase(),
        password,
      });
      setStatus({ state: 'success', message: 'Accès activé ! Redirection vers la connexion…' });
      setTimeout(() => {
        navigate(`/t/${slug}/login?email=${encodeURIComponent(email.trim())}&activated=1`);
      }, 1400);
    } catch (err) {
      setStatus({ state: 'error', message: err?.message || "Activation impossible." });
    }
  }

  const inputCls =
    'w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder-gray-500 focus:border-[#d97757] focus:outline-none';

  return (
    <div className="min-h-[100dvh] bg-[#262624] text-white" style={{ '--school-accent': '#d97757' }}>
      <Helmet><title>Activer mon accès</title></Helmet>
      <main className="mx-auto w-full max-w-md px-5 py-10">
        <div className="mb-8 flex items-center gap-2.5">
          {branding?.logo ? (
            <img src={branding.logo} alt="" className="h-9 w-9 rounded-lg object-contain" />
          ) : null}
          <span className="text-lg font-bold tracking-tight text-[#f5f4ee]">{branding?.name || 'Prorascience'}</span>
        </div>
        <div className="mb-6">
          <h1 className="text-[22px] font-bold text-[#f5f4ee]">Activer mon accès</h1>
          <p className="mt-1 text-[13px] text-[#b0ada3]">
            Saisissez le code reçu par email et choisissez votre mot de passe pour accéder à votre espace.
          </p>
        </div>

        {status.state === 'success' ? (
          <div className="rounded-xl border border-[#9fbf8f]/30 bg-[#9fbf8f]/10 p-4 text-sm text-[#c9dcbf]">
            {status.message}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#b0ada3]">Email</label>
              <input
                type="email"
                className={inputCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#b0ada3]">Code d'accès (8 caractères)</label>
              <input
                type="text"
                inputMode="text"
                className={`${inputCls} font-mono tracking-[0.35em] uppercase`}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                placeholder="XXXXXXXX"
                maxLength={8}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#b0ada3]">Mot de passe</label>
              <input
                type="password"
                className={inputCls}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8 caractères minimum"
                autoComplete="new-password"
                required
              />
              {password && !pwOk && (
                <p className="mt-1 text-[11px] text-amber-300">8 caractères minimum.</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#b0ada3]">Confirmer le mot de passe</label>
              <input
                type="password"
                className={inputCls}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Retapez votre mot de passe"
                autoComplete="new-password"
                required
              />
              {confirm && !match && (
                <p className="mt-1 text-[11px] text-amber-300">Les mots de passe ne correspondent pas.</p>
              )}
            </div>

            {status.state === 'error' && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                {status.message}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full cursor-pointer rounded-md bg-[#d97757] px-5 py-3 font-semibold text-black hover:bg-[#c2683f] disabled:opacity-50"
            >
              {status.state === 'submitting' ? 'Activation…' : 'Activer mon accès'}
            </button>

            <p className="text-center text-[12px] text-[#82807a]">
              Vous avez déjà un compte ?{' '}
              <Link to={`/t/${slug}/login`} className="font-semibold text-[#d97757] hover:underline">
                Se connecter
              </Link>
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
