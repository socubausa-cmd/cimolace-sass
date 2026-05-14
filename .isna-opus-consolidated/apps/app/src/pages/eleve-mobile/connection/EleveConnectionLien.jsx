import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Link2,
  X,
  Zap,
  Shield,
  ShieldCheck,
  LayoutGrid,
  User,
  Lock,
  ScanLine,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { LiriPageFooterLine } from '@/components/brand/LiriWordmark';
import { EleveConnectionLayout } from '@/pages/eleve-mobile/connection/EleveConnectionLayout';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { eleveAccessCodeFromPaste, eleveJoinTargetFromPaste } from '@/pages/eleve-mobile/connection/eleveJoinTargetFromPaste';
import { buildEleveJoinCodeUrl, redeemEleveAccessCode } from '@/lib/eleveMobileJoinAccess';
import { resolveLiveJoinCodeFromPaste } from '@/lib/liveJoinCode';
import {
  EV_BG,
  EV_CARD,
  EV_CARD_INNER,
  EV_MUTED,
  EV_ACCENT,
  EV_LINE,
  EV_R,
  EV_SH,
} from '@/pages/eleve-mobile/eleveMobileScreensShared';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const LAV_TITLE = 'rgb(196, 181, 253)';

const GRAD_CTA = {
  background: `linear-gradient(90deg, ${EV_ACCENT} 0%, #5B21B6 100%)`,
  boxShadow: EV_SH.cta,
};

function LienChainHero3d() {
  return (
    <div
      className="relative flex h-[120px] w-[112px] shrink-0 select-none items-end justify-center"
      aria-hidden
    >
      <div
        className="absolute bottom-3 left-1/2 h-10 w-24 -translate-x-1/2 rounded-full opacity-60 blur-2xl"
        style={{ background: 'radial-gradient(ellipse, rgba(123, 97, 255, 0.55) 0%, transparent 70%)' }}
      />
      <div
        className="absolute bottom-2.5 left-1/2 h-3 w-[4.2rem] -translate-x-1/2 rounded-full"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, #2e1064 0%, #0a0514 80%)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 6px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)',
        }}
      />
      <div
        className="relative z-10 mb-4 flex h-[76px] w-[88px] items-center justify-center"
        style={{ filter: 'drop-shadow(0 14px 32px rgba(88, 28, 135, 0.55))' }}
      >
        <div
          className="flex h-[3.2rem] w-[4.5rem] items-center justify-center rounded-2xl"
          style={{
            background: 'linear-gradient(150deg, #7B61FF 0%, #5E4BFF 45%, #4c1d95 100%)',
            boxShadow: `
              inset 0 2px 0 rgba(255,255,255,0.2),
              inset 0 -2px 0 rgba(0,0,0,0.35),
              0 10px 24px rgba(0,0,0,0.45)
            `,
          }}
        >
          <Link2 className="h-9 w-9 text-white" strokeWidth={2.25} />
        </div>
      </div>
    </div>
  );
}

function SecondaryRow({ to, left, title, sub, chevronClass, iconWrapClass, iconStyle }) {
  return (
    <Link
      to={to}
      className="flex w-full min-h-[72px] items-center gap-3.5 px-4 py-3.5 transition active:scale-[0.99]"
      style={{
        background: EV_CARD_INNER,
        border: `1px solid ${EV_LINE}`,
        borderRadius: EV_R.lg,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <span className={iconWrapClass} style={iconStyle}>
        {left}
      </span>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[15px] font-bold leading-tight tracking-[-0.01em] text-white">{title}</p>
        <p className="mt-1 text-[12px] leading-[1.45]" style={{ color: EV_MUTED }}>
          {sub}
        </p>
      </div>
      <ChevronRight className={`h-5 w-5 shrink-0 ${chevronClass}`} strokeWidth={2.2} />
    </Link>
  );
}

/**
 * Écran « détail live (avant entrée) » — aligné maquette (fonds #16161E, CTA bleu → violet, etc.)
 */
export default function EleveConnectionLien() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, session } = useAuth();
  const [value, setValue] = useState('');
  const [err, setErr] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loginQ = new URLSearchParams({ redirect: `${ELEVE_MOBILE.connexion}/lien` }).toString();
  const signupQ = new URLSearchParams({ redirect: '/m/eleve' }).toString();

  const goLive = useCallback(
    (sessionId) => {
      const path = `${ELEVE_MOBILE.liveLoading}?${new URLSearchParams({ session: sessionId }).toString()}`;
      if (user) {
        navigate(path, { replace: true });
        return;
      }
      const q = new URLSearchParams({ redirect: path }).toString();
      navigate(`${ELEVE_MOBILE.login}?${q}`, { replace: false });
    },
    [navigate, user],
  );

  const redeemLinkCode = useCallback(async (raw) => {
    const code = eleveAccessCodeFromPaste(raw);
    if (!code) {
      setErr('Lien non reconnu. Colle le lien d’accès complet ou le code reçu.');
      return;
    }
    if (!user || !session?.access_token) {
      const redirect = buildEleveJoinCodeUrl(code, location.pathname);
      navigate(`${ELEVE_MOBILE.login}?${new URLSearchParams({ redirect }).toString()}`, { replace: false });
      return;
    }
    setSubmitting(true);
    setStatus('Vérification du lien…');
    try {
      const result = await redeemEleveAccessCode({ code, accessToken: session.access_token });
      if (!result.ok) throw new Error(result.error || 'Lien invalide.');
      setStatus(result.already_redeemed ? 'Accès déjà actif. Ouverture de LIRI…' : 'Accès activé. Ouverture de LIRI…');
      window.setTimeout(() => navigate(ELEVE_MOBILE.home, { replace: true }), 500);
    } catch (e) {
      setErr(e?.message || 'Impossible d’activer ce lien.');
      setStatus('');
    } finally {
      setSubmitting(false);
    }
  }, [location.pathname, navigate, session?.access_token, user]);

  const submit = useCallback(() => {
    setErr('');
    setStatus('');
    const id = eleveJoinTargetFromPaste(value);
    if (id) {
      goLive(id);
      return;
    }
    void (async () => {
      const resolvedId = await resolveLiveJoinCodeFromPaste(value);
      if (resolvedId) {
        goLive(resolvedId);
        return;
      }
      void redeemLinkCode(value);
    })();
  }, [value, goLive, redeemLinkCode]);

  useEffect(() => {
    const pending = searchParams.get('join') || searchParams.get('code');
    if (!pending) return;
    setValue(pending);
    if (user && session?.access_token) void redeemLinkCode(pending);
  }, [redeemLinkCode, searchParams, session?.access_token, user]);

  return (
    <EleveConnectionLayout>
      <div
        className="mx-auto w-full max-w-md flex-1 px-4 pb-6"
        style={{ color: '#F8FAFC' }}
      >
        <div className="mb-1 flex items-center justify-between gap-2 pt-0.5">
          <Link
            to={ELEVE_MOBILE.connexion}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.1] bg-[#1a1a22] text-white transition active:scale-95"
            aria-label="Retour"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.1} />
          </Link>
          <Link
            to="/support"
            className="inline-flex max-w-[min(100%,210px)] items-center gap-1 rounded-full border px-2.5 py-1.5 text-[12px] font-medium text-white/80"
            style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(22,22,30,0.8)' }}
          >
            <HelpCircle className="h-3.5 w-3.5 shrink-0 text-violet-300/90" strokeWidth={2} />
            <span className="leading-tight">Besoin d’aide ?</span>
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3"
        >
          <span
            className="inline-flex w-fit items-center gap-1.5 rounded-full border border-violet-500/25 px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: 'rgba(91, 33, 182, 0.15)', color: '#DDD6FE' }}
          >
            <Zap className="h-3.5 w-3.5 text-amber-200" strokeWidth={2} />
            Accès instantané
          </span>

          <div className="mt-3.5 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-1">
            <div className="min-w-0 flex-1">
              <h1 className="text-[25px] font-extrabold leading-[1.18] tracking-[-0.02em] text-white sm:text-[26px]">
                Rejoins ton cours
                <br />
                <span className="font-extrabold" style={{ color: LAV_TITLE }}>
                  en quelques secondes.
                </span>
              </h1>
              <p className="mt-2.5 text-[14px] leading-[1.5]" style={{ color: EV_MUTED }}>
                Colle le lien d’invitation ou le lien d’accès LIRI reçu.
              </p>
            </div>
            <div className="flex justify-end pl-1 sm:justify-center sm:pt-0.5">
              <LienChainHero3d />
            </div>
          </div>
        </motion.div>

        {/* Section carte « Rejoindre avec un lien » — specs maquette: carte #0E0E1F, rayons ~28px, CTA dégradé violet, input ~16px */}
        <div
          className="mt-5 border px-[18px] pb-5 pt-[18px] sm:px-5 sm:pb-[22px] sm:pt-[20px]"
            style={{
            background: EV_CARD,
            border: `1px solid ${EV_LINE}`,
            borderRadius: EV_R.xl,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 20px -8px rgba(0,0,0,0.35)',
          }}
        >
          <div className="mb-4 flex gap-3.5 sm:mb-[18px] sm:gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
              style={{
                background: `linear-gradient(180deg, ${EV_ACCENT} 0%, #6344E5 100%)`,
                boxShadow: '0 2px 8px rgba(123, 97, 255, 0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
              }}
            >
              <Link2 className="h-[22px] w-[22px] text-white" strokeWidth={2.1} />
            </div>
            <div className="min-w-0 pt-0.5">
              <h2 className="text-[16px] font-bold leading-tight tracking-[-0.01em] text-white">
                Rejoindre avec un lien
              </h2>
              <p
                className="mt-1.5 text-[12.5px] leading-[1.45] sm:mt-2"
                style={{ color: EV_MUTED }}
              >
                Colle le lien d’invitation ou d’accès reçu
              </p>
            </div>
          </div>

          <div
            className="flex min-h-[56px] items-stretch overflow-hidden border pl-3 pr-1.5"
            style={{
              borderColor: 'rgba(255,255,255,0.07)',
              background: '#08080E',
              borderRadius: 16,
            }}
          >
            <div className="flex shrink-0 items-center" style={{ color: EV_MUTED, opacity: 0.45 }}>
              <Link2 className="h-4 w-4" strokeWidth={2} />
            </div>
            <input
              className="min-w-0 flex-1 bg-transparent py-3.5 pl-2.5 text-[15px] leading-tight text-white placeholder:text-[#8E8E93] placeholder:opacity-90 outline-none"
              style={{ caretColor: EV_ACCENT }}
              placeholder={`${isnaTenantConfig.branding.publicSiteOrigin}/redeem/code-ou-lien-live`}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setErr('');
              }}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {value ? (
              <button
                type="button"
                onClick={() => {
                  setValue('');
                  setErr('');
                }}
                className="flex w-9 shrink-0 items-center justify-center transition"
                style={{ color: EV_MUTED }}
                aria-label="Effacer"
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.2} />
                </span>
              </button>
            ) : null}
          </div>
          {err ? <p className="mt-2 text-[12px] text-red-400/95">{err}</p> : null}
          {status ? <p className="mt-2 text-[12px] text-emerald-300/95">{status}</p> : null}

          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="relative mt-4 flex w-full items-center py-[15px] text-[16px] font-bold tracking-[-0.01em] text-white transition active:scale-[0.99] active:opacity-95 sm:mt-[18px] sm:py-4"
            style={{ ...GRAD_CTA, borderRadius: EV_R.lg }}
          >
            <span className="w-full pr-8 text-center">{submitting ? 'Vérification…' : 'Rejoindre LIRI'}</span>
            <ChevronRight
              className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/95"
              strokeWidth={2.4}
            />
          </button>

          <p
            className="mt-3.5 flex items-center justify-center gap-1.5 px-0.5 text-center text-[11px] leading-relaxed sm:mt-4"
            style={{ color: EV_MUTED }}
          >
            <Shield className="h-3.5 w-3.5 shrink-0 text-emerald-500/80" strokeWidth={2} />
            <span>Accès sécurisé • Seuls les invités autorisés peuvent rejoindre.</span>
          </p>
        </div>

        <div className="my-4 flex items-center gap-2">
          <div className="h-px flex-1 bg-white/[0.08]" />
          <span
            className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-full border text-[10px] font-bold tracking-wide text-white/40"
            style={{ borderColor: 'rgba(255,255,255,0.1)', background: EV_BG }}
          >
            OU
          </span>
          <div className="h-px flex-1 bg-white/[0.08]" />
        </div>

        <div className="space-y-3">
          <SecondaryRow
            to={`${ELEVE_MOBILE.connexion}/code`}
            title="Entrer un code de classe"
            sub="Reçois un code de ton professeur ?"
            chevronClass="text-[#4ADE80]"
            iconWrapClass="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
            iconStyle={{ background: 'rgba(5, 46, 32, 0.85)' }}
            left={<LayoutGrid className="h-[22px] w-[22px] text-[#4ADE80]" strokeWidth={2.1} />}
          />
          <SecondaryRow
            to={`${ELEVE_MOBILE.login}?${loginQ}`}
            title="Se connecter"
            sub="J'ai déjà un compte LIRI"
            chevronClass="text-[#60A5FA]"
            iconWrapClass="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
            iconStyle={{ background: 'rgba(23, 37, 84, 0.9)' }}
            left={<User className="h-[22px] w-[22px] text-sky-300" strokeWidth={2.1} />}
          />
        </div>

        <div
          className="mt-3 flex min-h-[88px] items-stretch gap-2 p-4 sm:gap-3"
          style={{
            background: EV_CARD_INNER,
            border: `1px solid ${EV_LINE}`,
            borderRadius: EV_R.lg,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center self-center rounded-full"
            style={{ background: 'rgba(50, 15, 80, 0.65)' }}
          >
            <Lock className="h-[22px] w-[22px] text-[#C4B5FD]" strokeWidth={1.9} />
          </div>
          <div className="min-w-0 flex-1 self-center">
            <h3 className="text-[14px] font-bold leading-tight text-white">Tes données sont protégées</h3>
            <p className="mt-1.5 text-[12px] leading-[1.45]" style={{ color: EV_MUTED }}>
              LIRI protège ta vie privée.
            </p>
            <p className="mt-0.5 text-[12px] leading-[1.45]" style={{ color: EV_MUTED }}>
              Aucune donnée n&apos;est partagée sans ton accord.
            </p>
          </div>
          <div className="flex shrink-0 items-center self-center pl-0.5">
            <ShieldCheck
              className="h-20 w-20 sm:h-[5.5rem] sm:w-[5.5rem]"
              style={{ color: 'rgba(255,255,255,0.12)' }}
              strokeWidth={0.9}
            />
          </div>
        </div>

        <p className="mt-6 text-center text-[14px] leading-normal" style={{ color: EV_MUTED }}>
          Pas encore de compte ?{' '}
          <Link
            to={`/signup?${signupQ}`}
            className="font-semibold hover:underline"
            style={{ color: EV_ACCENT }}
          >
            Créer un compte élève
          </Link>
        </p>

        <Link
          to={`${ELEVE_MOBILE.connexion}/code`}
          className="fixed z-40 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-[0_4px_20px_rgba(0,0,0,0.45)] transition active:scale-95"
          style={{
            right: 16,
            bottom: 'calc(36px + env(safe-area-inset-bottom, 0px))',
            border: `1px solid ${EV_LINE}`,
            background: 'rgba(255,255,255,0.06)',
          }}
          aria-label="Saisir un code ou scanner"
        >
          <ScanLine className="h-5 w-5" strokeWidth={2} />
        </Link>

        <LiriPageFooterLine suffix="Connexion" />
      </div>
    </EleveConnectionLayout>
  );
}
