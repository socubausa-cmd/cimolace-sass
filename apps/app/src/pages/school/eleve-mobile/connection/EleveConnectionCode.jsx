import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, LayoutGrid, X } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { LiriPageFooterLine } from '@/components/brand/LiriWordmark';
import { EleveConnectionLayout } from '@/pages/school/eleve-mobile/connection/EleveConnectionLayout';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { eleveAccessCodeFromPaste, eleveJoinTargetFromPaste } from '@/pages/school/eleve-mobile/connection/eleveJoinTargetFromPaste';
import { buildEleveJoinCodeUrl, redeemEleveAccessCode } from '@/lib/eleveMobileJoinAccess';
import { resolveLiveJoinCodeFromPaste } from '@/lib/liveJoinCode';
import { EV_MUTED, EV_ACCENT, EV_LINE, EV_R, EV_SH } from '@/pages/school/eleve-mobile/eleveMobileScreensShared';

const LAV_SOFT = 'rgb(232, 183, 154)';

const GRAD_STYLE = {
  background: `linear-gradient(90deg, ${EV_ACCENT} 0%, #a94f33 100%)`,
  boxShadow: EV_SH.cta,
  borderRadius: EV_R.lg,
};

export default function EleveConnectionCode() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, session } = useAuth();
  const [value, setValue] = useState('');
  const [err, setErr] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const goLive = useCallback(
    (sessionId) => {
      const path = `${ELEVE_MOBILE.liveLoading}?${new URLSearchParams({ session: sessionId }).toString()}`;
      if (user) {
        navigate(path, { replace: true });
        return;
      }
      navigate(`${ELEVE_MOBILE.login}?${new URLSearchParams({ redirect: path }).toString()}`, { replace: false });
    },
    [navigate, user],
  );

  const redeemCode = useCallback(async (code) => {
    const clean = eleveAccessCodeFromPaste(code);
    if (!clean) {
      setErr('Code invalide. Saisis le code exact reçu ou colle le lien d\'accès.');
      return;
    }
    if (!user || !session?.access_token) {
      const redirect = buildEleveJoinCodeUrl(clean, location.pathname);
      navigate(`${ELEVE_MOBILE.login}?${new URLSearchParams({ redirect }).toString()}`, { replace: false });
      return;
    }
    setSubmitting(true);
    setStatus('Vérification du code…');
    try {
      const result = await redeemEleveAccessCode({ code: clean, accessToken: session.access_token });
      if (!result.ok) throw new Error(result.error || 'Code invalide.');
      setStatus(result.already_redeemed ? 'Accès déjà actif. Ouverture de LIRI…' : 'Accès activé. Ouverture de LIRI…');
      window.setTimeout(() => navigate(ELEVE_MOBILE.home, { replace: true }), 500);
    } catch (e) {
      setErr(e?.message || 'Impossible d\'activer ce code.');
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
      void redeemCode(value);
    })();
  }, [value, goLive, redeemCode]);

  useEffect(() => {
    const pending = searchParams.get('join') || searchParams.get('code');
    if (!pending) return;
    setValue(pending);
    if (user && session?.access_token) void redeemCode(pending);
  }, [redeemCode, searchParams, session?.access_token, user]);

  return (
    <EleveConnectionLayout>
      <div className="mx-auto w-full max-w-md flex-1 px-4 pb-6">
        <div className="mb-1 flex items-center">
          <Link
            to={ELEVE_MOBILE.connexion}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white transition active:scale-95"
            style={{ border: `1px solid ${EV_LINE}`, background: 'rgba(255,255,255,0.05)' }}
            aria-label="Retour"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
          </Link>
        </div>

        <div className="mt-1 flex flex-col items-center">
          <div
            className="relative flex h-20 w-20 items-center justify-center rounded-full border border-amber-500/30"
            style={{
              background: 'radial-gradient(circle, rgba(226, 133, 79,0.2) 0%, rgba(18,13,9,0.85) 70%)',
              boxShadow: '0 0 40px -8px rgba(226, 133, 79, 0.5)',
            }}
          >
            <LayoutGrid className="h-9 w-9 text-amber-200" strokeWidth={2.2} />
          </div>
        </div>

        <motion.div
          className="mt-5 text-center"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-[24px] font-extrabold leading-[1.2] tracking-tight text-white sm:text-[26px]">
            Rejoins ton cours
            <br />
            <span style={{ color: LAV_SOFT }}>avec un code</span>
          </h1>
          <p className="mx-auto mt-2 max-w-[300px] text-[14px] leading-relaxed" style={{ color: EV_MUTED }}>
            Entre le code d'accès LIRI ou colle le lien complet reçu.
          </p>
        </motion.div>

        <div className="mt-6">
          <label className="mb-1.5 block pl-0.5 text-[12px] font-medium" style={{ color: EV_MUTED }}>
            Code d'accès ou lien
          </label>
          <div
            className="flex items-stretch gap-0 overflow-hidden pl-3 pr-1.5"
            style={{ minHeight: 52, borderRadius: EV_R.md, border: `1px solid ${EV_LINE}`, background: 'rgba(255,255,255,0.03)' }}
          >
            <input
              className="min-w-0 flex-1 bg-transparent py-3 text-[16px] font-mono text-white tracking-wide outline-none placeholder:text-white/30"
              placeholder="Code LIRI ou lien"
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
                className="flex h-12 w-10 shrink-0 items-center justify-center text-white/40 transition hover:text-white/70"
                aria-label="Effacer"
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
          </div>
          {err ? <p className="mt-2 text-center text-[12px] text-red-400/95">{err}</p> : null}
          {status ? <p className="mt-2 text-center text-[12px] text-emerald-300/95">{status}</p> : null}
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-[18px] py-3.5 pl-4 pr-4 text-[15px] font-bold text-white transition active:scale-[0.99] sm:py-4"
          style={GRAD_STYLE}
        >
          <span>{submitting ? 'Vérification…' : 'Rejoindre LIRI'}</span>
          <ChevronRight className="h-5 w-5" strokeWidth={2.2} />
        </button>

        <p className="mt-5 text-center text-[13px]" style={{ color: EV_MUTED }}>
          <Link to="/support" className="font-semibold" style={{ color: EV_ACCENT }}>
            Contacter le support
          </Link>
        </p>

        <LiriPageFooterLine marginClass="mt-4" suffix="Connexion" />
      </div>
    </EleveConnectionLayout>
  );
}
