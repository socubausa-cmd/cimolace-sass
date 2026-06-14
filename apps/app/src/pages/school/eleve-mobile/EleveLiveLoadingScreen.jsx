import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  Wifi,
  Video,
  Mic,
  Volume2,
  Users,
  Check,
  Lightbulb,
  Loader2,
} from 'lucide-react';
import { EleveConnectionLayout } from '@/pages/school/eleve-mobile/connection/EleveConnectionLayout';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';

const PURPLE = '#7B61FF';
const GREEN = '#27AE60';
const MUTED = '#94A3B8';

const R = 45;
const C = 2 * Math.PI * R;

const CHECKS = [
  { id: 'net', label: 'Connexion internet', sub: 'Excellente connexion', icon: Wifi },
  { id: 'cam', label: 'Caméra', sub: 'Caméra détectée', icon: Video },
  { id: 'mic', label: 'Microphone', sub: 'Micro détecté', icon: Mic },
  { id: 'spk', label: 'Haut-parleurs', sub: 'Audio prêt', icon: Volume2 },
  { id: 'studio', label: 'Accès au studio', sub: 'Autorisation confirmée', icon: Users },
];

const SPARKS = [
  { l: '8%', t: '12%', s: 1.2, o: 0.35 },
  { l: '22%', t: '6%', s: 1, o: 0.2 },
  { l: '78%', t: '18%', s: 1.4, o: 0.28 },
  { l: '90%', t: '28%', s: 1.1, o: 0.22 },
  { l: '12%', t: '42%', s: 0.9, o: 0.18 },
  { l: '55%', t: '8%', s: 1.2, o: 0.3 },
  { l: '70%', t: '55%', s: 1.3, o: 0.25 },
  { l: '5%', t: '70%', s: 1, o: 0.2 },
  { l: '88%', t: '75%', s: 1.1, o: 0.2 },
  { l: '40%', t: '88%', s: 1, o: 0.15 },
];

function SparkleField() {
  const dots = useMemo(() => SPARKS, []);
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {dots.map((d, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: d.l,
            top: d.t,
            width: d.s,
            height: d.s,
            opacity: d.o,
            background: 'linear-gradient(135deg, rgba(123, 97, 255, 0.5), rgba(59, 130, 246, 0.4))',
            boxShadow: '0 0 6px rgba(123, 97, 255, 0.4)',
          }}
        />
      ))}
    </div>
  );
}

function ProgressRing({ pct }) {
  const dash = Math.max(0, (pct / 100) * C);
  return (
    <div className="relative flex h-[200px] w-[200px] items-center justify-center sm:h-[220px] sm:w-[220px]">
      <div
        className="absolute inset-0 rounded-full opacity-40 blur-2xl"
        style={{ background: 'radial-gradient(circle, rgba(123, 97, 255, 0.4) 0%, transparent 70%)' }}
        aria-hidden
      />
      <svg className="relative z-10 h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
        <defs>
          <linearGradient id="llRing" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.9" />
            <stop offset="50%" stopColor={PURPLE} stopOpacity="1" />
            <stop offset="100%" stopColor="#A78BFA" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="5"
        />
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="url(#llRing)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
          className="transition-[stroke-dasharray] duration-150 ease-out"
          style={{ filter: 'drop-shadow(0 0 8px rgba(123, 97, 255, 0.5))' }}
        />
      </svg>
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center">
        <span className="text-[40px] font-extrabold leading-none tracking-tight text-white sm:text-[44px]">
          {Math.round(pct)}%
        </span>
        <span className="mt-1.5 text-[13px] font-medium text-white/90">Connexion en cours</span>
      </div>
    </div>
  );
}

/**
 * Chargement avant entrée dans le live (checklist, progression, aperçu formateur).
 * Route : `/m/eleve/live/loading` (option : `?session=uuid&redirect=1` pour enchaîner vers `/live/:id` plus tard).
 */
export default function EleveLiveLoadingScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetSession = searchParams.get('session');
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPct((p) => (p < 78 ? Math.min(78, p + 1.4) : 78));
    }, 38);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!targetSession) return;
    if (pct < 78) return;
    const t = setTimeout(() => {
      navigate(`/live/${targetSession}`, { replace: true });
    }, 1200);
    return () => clearTimeout(t);
  }, [pct, targetSession, navigate]);

  return (
    <EleveConnectionLayout className="relative">
      <SparkleField />
      <div className="relative z-10 mx-auto w-full max-w-md flex-1 px-4 pb-4">
        <div className="mb-1 flex items-center">
          <Link
            to={ELEVE_MOBILE.live}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.04] text-white transition active:scale-95"
            aria-label="Retour"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.1} />
          </Link>
        </div>

        <div className="mt-2 flex flex-col items-center text-center">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 pr-3">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" />
            <span className="text-[11px] font-bold tracking-[0.2em] text-red-200">LIVE</span>
          </div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[24px]">
            Connexion au live…
          </h1>
          <p className="mt-1.5 text-[14px]" style={{ color: MUTED }}>
            Prépare ton espace d'apprentissage
          </p>
        </div>

        <div className="mt-4 flex w-full items-center justify-center gap-1 sm:gap-2">
          <motion.button
            type="button"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04] text-white/50 backdrop-blur-sm"
            whileTap={{ scale: 0.95 }}
            aria-label="Caméra (aperçu)"
          >
            <Video className="h-5 w-5" strokeWidth={1.8} />
          </motion.button>
          <div className="flex min-w-0 flex-1 justify-center px-0 sm:px-1">
            <ProgressRing pct={pct} />
          </div>
          <motion.button
            type="button"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04] text-white/50 backdrop-blur-sm"
            whileTap={{ scale: 0.95 }}
            aria-label="Micro (aperçu)"
          >
            <Mic className="h-5 w-5" strokeWidth={1.8} />
          </motion.button>
        </div>

        <p className="mt-2 px-1 text-center text-[12.5px] leading-relaxed" style={{ color: MUTED }}>
          Veuillez patienter pendant que nous vous connectons au studio.
        </p>

        <div
          className="mt-5 overflow-hidden rounded-2xl border"
          style={{ background: 'rgba(18, 18, 30, 0.7)', borderColor: 'rgba(255,255,255,0.08)' }}
        >
          {CHECKS.map((row, i) => {
            const Ic = row.icon;
            const isLast = i === CHECKS.length - 1;
            return (
              <div
                key={row.id}
                className={`flex items-center gap-3 px-3.5 py-3 sm:px-4 ${i > 0 ? 'border-t border-white/[0.06]' : ''}`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${row.id === 'net' ? 'bg-emerald-500/15' : 'bg-violet-500/15'}`}
                >
                  {row.id === 'net' ? (
                    <Wifi className="h-5 w-5" style={{ color: GREEN }} strokeWidth={2} />
                  ) : (
                    <Ic className="h-5 w-5 text-violet-300" strokeWidth={1.8} />
                  )}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[14px] font-semibold text-white">{row.label}</p>
                  <p className="text-[12px] leading-tight" style={{ color: MUTED }}>
                    {row.sub}
                  </p>
                </div>
                {isLast ? (
                  <Loader2
                    className="h-5 w-5 shrink-0 animate-spin"
                    style={{ color: PURPLE }}
                    strokeWidth={2}
                  />
                ) : (
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    style={{ background: GREEN, boxShadow: '0 0 10px rgba(39, 174, 96, 0.45)' }}
                  >
                    <Check className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div
          className="mt-3 rounded-2xl border p-3.5"
          style={{
            borderColor: 'rgba(123, 97, 255, 0.35)',
            background: 'linear-gradient(135deg, rgba(123, 97, 255, 0.08) 0%, rgba(15, 15, 25, 0.95) 100%)',
          }}
        >
          <div className="flex gap-3">
            <div
              className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-violet-500/30"
              style={{
                background: 'linear-gradient(145deg, #4c1d95, #1e1b2e)',
                boxShadow: '0 0 20px rgba(123, 97, 255, 0.2)',
              }}
            >
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-violet-100">
                M
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 inline-block rounded border border-violet-500/40 bg-violet-500/20 px-1.5 py-px text-[9px] font-bold text-violet-200">
                PROF
              </div>
              <p className="text-[15px] font-bold text-white">Prof. Manikongo</p>
              <p className="text-[12.5px] text-white/90">Physique – Terminale S</p>
              <p className="text-[12px] leading-tight" style={{ color: MUTED }}>
                Ondes et lumière – Chapitre 3
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end justify-between self-stretch">
              <div className="text-right">
                <div className="flex items-center justify-end gap-1 text-white/80">
                  <Users className="h-3.5 w-3.5" strokeWidth={2} />
                  <span className="text-[13px] font-bold">128</span>
                </div>
                <p className="text-[9px] leading-tight" style={{ color: MUTED }}>
                  élèves connectés
                </p>
              </div>
              <div className="mt-1 flex h-6 items-end justify-end gap-0.5 pr-0.5">
                {[2, 4, 3, 5, 2, 4, 3, 5, 2, 4].map((h, i) => (
                  <div
                    key={i}
                    className="w-[3px] rounded-sm"
                    style={{
                      height: `${4 + h * 2.5}px`,
                      background: `linear-gradient(180deg, ${PURPLE}, rgba(123, 97, 255, 0.3))`,
                      opacity: 0.5 + (i % 3) * 0.15,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-violet-500/15 bg-violet-500/[0.06] p-3.5">
          <div className="mb-1 flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" style={{ color: PURPLE }} strokeWidth={2.1} />
            <span className="text-[12px] font-bold" style={{ color: PURPLE }}>
              Conseil
            </span>
          </div>
          <p className="text-[12.5px] leading-relaxed" style={{ color: MUTED }}>
            Utilise un casque pour une meilleure expérience.
          </p>
        </div>
      </div>
    </EleveConnectionLayout>
  );
}
