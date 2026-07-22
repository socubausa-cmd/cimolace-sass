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
 * puis on le renvoie vers la connexion.
 *
 * Page PRÉ-CONNEXION AUTONOME (aucun header portail — cf. hideHeaderRoutes) : elle
 * porte sa PROPRE identité. Design « split » type page de connexion : à gauche la
 * marque (logo SANS fond + slogan + citation ISNA/Prorascience), à droite le
 * formulaire. Thème chaud LIRI (coral #d97757 / or #ebca5e / fond #262624).
 */
export default function ActivateAccountPage() {
  const { tenantSlug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const slug = tenantSlug || DEFAULT_TENANT_SLUG;
  const { branding } = useTenantBranding();
  const schoolName = branding?.name || 'Prorascience';
  // Logo SANS fond (PNG blanc transparent) — pas le JPEG à fond noir de la vitrine.
  const logoSrc = '/prorascience-eye.png';

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
      setStatus({ state: 'error', message: err?.message || 'Activation impossible.' });
    }
  }

  const SERIF = "'Fraunces','Cinzel','Playfair Display',Georgia,serif";
  const inputCls =
    'w-full rounded-lg border border-white/12 bg-white/[0.04] px-4 py-2.5 text-[15px] text-white placeholder-white/30 transition-colors focus:border-[#d97757] focus:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-[#d97757]/40';

  return (
    <div
      className="aap-root min-h-[100dvh] w-full bg-[#262624] text-white lg:grid lg:grid-cols-[1.05fr_1fr]"
      style={{ '--school-accent': '#d97757' }}
    >
      <Helmet><title>{`Activer mon accès — ${schoolName}`}</title></Helmet>
      <style>{`
        @keyframes aapUp { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
        .aap-up { animation: aapUp .5s cubic-bezier(.22,.61,.36,1) both }
        .aap-up-2 { animation-delay: .06s }
        .aap-up-3 { animation-delay: .12s }
        @media (prefers-reduced-motion: reduce) { .aap-up { animation: none } }
      `}</style>

      {/* ─── Panneau marque (gauche desktop) ─────────────────────────────── */}
      <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        {/* Fond + halos chauds (pas de violet) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 90% 60% at 15% -10%, rgba(217,119,87,0.20) 0%, transparent 55%),' +
              'radial-gradient(ellipse 80% 60% at 110% 115%, rgba(235,202,94,0.12) 0%, transparent 55%),' +
              'linear-gradient(160deg, #201f1d 0%, #262624 55%, #1b1a18 100%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '46px 46px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 30% 40%, black 0%, transparent 75%)',
          }}
        />

        <header className="relative aap-up flex items-center gap-3">
          <img src={logoSrc} alt="" className="h-11 w-11 object-contain" />
          <div className="leading-tight">
            <p className="text-[19px] font-semibold tracking-tight text-[#f5f4ee]" style={{ fontFamily: SERIF }}>
              {schoolName}
            </p>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[#ebca5e]/85">ISNA · École</p>
          </div>
        </header>

        <div className="relative max-w-[30ch]">
          <h2
            className="aap-up aap-up-2 text-[clamp(1.9rem,3vw,2.9rem)] font-semibold leading-[1.12] text-[#f7f5ef]"
            style={{ fontFamily: SERIF }}
          >
            Intégrer la Science et la Spiritualité pour une transformation authentique.
          </h2>
          <p className="aap-up aap-up-3 mt-5 max-w-[38ch] text-[14.5px] leading-relaxed text-[#c3bdb0]">
            Votre espace personnel vous attend : cours en direct, accompagnement et communauté,
            réunis en un seul lieu.
          </p>
          <div className="aap-up aap-up-3 mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-[#a49d90]">
            {['Cours & lives', 'Accompagnement', 'Communauté'].map((t) => (
              <span key={t} className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#d97757]" />
                {t}
              </span>
            ))}
          </div>
        </div>

        <figure className="relative aap-up aap-up-3 border-l-2 border-[#d97757]/40 pl-4">
          <blockquote className="max-w-[34ch] text-[14px] italic leading-relaxed text-[#d4cec1]">
            « Tout être doit d'abord se laver de ses ombres avant d'espérer briller. »
          </blockquote>
          <figcaption className="mt-1.5 text-[11.5px] uppercase tracking-[0.14em] text-[#8f887b]">— 5ᵉ Manikongo</figcaption>
        </figure>
      </aside>

      {/* ─── Panneau formulaire (droite / plein écran mobile) ─────────────── */}
      <main className="relative flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10 lg:min-h-0 lg:px-14">
        <div className="aap-up w-full max-w-[400px]">
          {/* Marque compacte — visible surtout en mobile (le panneau gauche est masqué) */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <img src={logoSrc} alt="" className="h-9 w-9 object-contain" />
            <div className="leading-tight">
              <span className="block text-[17px] font-semibold tracking-tight text-[#f5f4ee]" style={{ fontFamily: SERIF }}>
                {schoolName}
              </span>
              <span className="block text-[9.5px] font-semibold uppercase tracking-[0.2em] text-[#ebca5e]/80">ISNA · École</span>
            </div>
          </div>

          <div className="mb-7">
            <h1 className="text-[26px] font-semibold leading-tight text-[#f7f5ef]" style={{ fontFamily: SERIF }}>
              Activez votre accès
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[#b0ada3]">
              Saisissez le code reçu par e-mail et choisissez votre mot de passe pour entrer dans votre espace.
            </p>
          </div>

          {status.state === 'success' ? (
            <div className="rounded-xl border border-[#9fbf8f]/30 bg-[#9fbf8f]/10 p-5 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#9fbf8f]/20 text-lg text-[#c9dcbf]">✓</div>
              <p className="text-sm text-[#c9dcbf]">{status.message}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-[#b0ada3]">E-mail</label>
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
                <label className="mb-1.5 block text-[12px] font-medium text-[#b0ada3]">Code d'accès · 8 caractères</label>
                <input
                  type="text"
                  inputMode="text"
                  className={`${inputCls} font-mono text-[16px] tracking-[0.4em] uppercase`}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                  placeholder="XXXXXXXX"
                  maxLength={8}
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-[#b0ada3]">Mot de passe</label>
                <input
                  type="password"
                  className={inputCls}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8 caractères minimum"
                  autoComplete="new-password"
                  required
                />
                {password && !pwOk && <p className="mt-1 text-[11px] text-[#e0b45c]">8 caractères minimum.</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-[#b0ada3]">Confirmer le mot de passe</label>
                <input
                  type="password"
                  className={inputCls}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Retapez votre mot de passe"
                  autoComplete="new-password"
                  required
                />
                {confirm && !match && <p className="mt-1 text-[11px] text-[#e0b45c]">Les mots de passe ne correspondent pas.</p>}
              </div>

              {status.state === 'error' && (
                <div className="rounded-lg border border-[#c96f6f]/30 bg-[#c96f6f]/10 p-3 text-sm text-[#e7b3b3]">
                  {status.message}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="mt-1 w-full cursor-pointer rounded-lg bg-[#d97757] px-5 py-3 text-[15px] font-semibold text-[#1a120d] shadow-[0_8px_24px_-10px_rgba(217,119,87,0.7)] transition-all hover:bg-[#e2854f] hover:shadow-[0_10px_30px_-10px_rgba(217,119,87,0.85)] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
              >
                {status.state === 'submitting' ? 'Activation…' : 'Activer mon accès'}
              </button>

              <p className="text-center text-[12.5px] text-[#82807a]">
                Vous avez déjà un compte ?{' '}
                <Link to={`/t/${slug}/login`} className="font-semibold text-[#d97757] hover:underline">
                  Se connecter
                </Link>
              </p>
            </form>
          )}

          <p className="mt-8 text-center text-[11px] text-[#6f6d67]">
            © {schoolName} · Un espace de l'écosystème LIRI
          </p>
        </div>
      </main>
    </div>
  );
}
