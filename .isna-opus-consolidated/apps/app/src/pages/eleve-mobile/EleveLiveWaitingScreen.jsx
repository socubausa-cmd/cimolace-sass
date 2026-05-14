import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Radio, Users, Sparkles, Clock, Video } from 'lucide-react';
import { EleveConnectionLayout } from '@/pages/eleve-mobile/connection/EleveConnectionLayout';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';

const MUTED = '#8E8E93';
const PURPLE = '#7B61FF';
const LINE = 'rgba(255,255,255,0.08)';
const CARD = '#12121E';

const SPARKS = [
  { l: '10%', t: '14%', s: 1, o: 0.2 },
  { l: '85%', t: '22%', s: 1.1, o: 0.25 },
  { l: '20%', t: '68%', s: 0.9, o: 0.15 },
  { l: '78%', t: '72%', s: 1, o: 0.18 },
];

function SparkleField() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {SPARKS.map((d, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: d.l,
            top: d.t,
            width: d.s,
            height: d.s,
            opacity: d.o,
            background: 'linear-gradient(135deg, rgba(123, 97, 255, 0.5), rgba(59, 130, 246, 0.35))',
            boxShadow: '0 0 8px rgba(123, 97, 255, 0.35)',
          }}
        />
      ))}
    </div>
  );
}

/**
 * Salle d’attente : connexion prête, le formateur n’a pas encore ouvert le live.
 * `/m/eleve/live/waiting?session=uuid` (optionnel, pour le titre / futures redirections).
 */
export default function EleveLiveWaitingScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const session = searchParams.get('session') || '';

  return (
    <EleveConnectionLayout className="relative min-h-[100dvh]">
      <SparkleField />
      <div className="relative z-10 mx-auto w-full max-w-md flex-1 px-4 pb-6">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(ELEVE_MOBILE.live))}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
            aria-label="Retour"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.1} />
          </button>
        </div>

        <div className="mt-2 flex flex-col items-center text-center">
          <div className="mb-3 flex h-[100px] w-[100px] items-center justify-center">
            <div className="absolute h-[100px] w-[100px] rounded-full bg-violet-500/20 blur-2xl" aria-hidden />
            <motion.div
              className="relative flex h-[88px] w-[88px] items-center justify-center rounded-full border-2"
              style={{
                borderColor: 'rgba(123, 97, 255, 0.5)',
                background: 'linear-gradient(145deg, rgba(123, 97, 255, 0.25) 0%, rgba(30, 20, 60, 0.9) 100%)',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 12px 40px -8px rgba(123, 97, 255, 0.4)',
              }}
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Radio className="h-9 w-9 text-violet-200" strokeWidth={2} />
            </motion.div>
          </div>
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 pr-3">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            <span className="text-[11px] font-bold tracking-[0.18em] text-amber-200">EN ATTENTE</span>
          </div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[24px]">Le live bientôt disponible</h1>
          <p className="mt-2 max-w-[19rem] text-[14px] leading-relaxed" style={{ color: MUTED }}>
            Tu es bien connecté. Dès que ton professeur démarre la séance, tu rejoindras automatiquement le studio.
          </p>
        </div>

        <div
          className="mt-6 overflow-hidden rounded-2xl border p-4"
          style={{ background: CARD, borderColor: LINE }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-300/90">Aperçu de la séance</p>
          <div className="mt-3 flex gap-3">
            <div
              className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-violet-800/80 to-slate-900"
            >
              <div className="absolute inset-0 flex items-end justify-center pb-1 text-lg font-bold text-white/30">
                PM
              </div>
              <span
                className="absolute left-1 top-1 rounded px-1 py-0.5 text-[7px] font-extrabold uppercase text-white"
                style={{ background: PURPLE }}
              >
                PROF
              </span>
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: PURPLE }}>
                Physique – Terminale S
              </p>
              <p className="mt-0.5 text-[15px] font-bold text-white">Ondes et lumière</p>
              <p className="mt-0.5 text-[12px]" style={{ color: MUTED }}>
                {session ? `Session rattachée` : 'Chapitre 3 — démo'}
              </p>
            </div>
          </div>
          <div className="mt-3.5 flex flex-col gap-2 border-t border-white/10 pt-3.5 sm:flex-row sm:flex-wrap sm:gap-4">
            <p className="flex items-center gap-1.5 text-[12px]" style={{ color: MUTED }}>
              <Users className="h-3.5 w-3.5 text-white/45" />
              D’autres élèves attendent avec toi
            </p>
            <p className="flex items-center gap-1.5 text-[12px]" style={{ color: MUTED }}>
              <Video className="h-3.5 w-3.5 text-white/45" />
              Vérifie caméra & micro restés autorisés
            </p>
          </div>
        </div>

        <div
          className="mt-4 flex items-start gap-2.5 rounded-2xl border border-violet-500/20 p-3.5"
          style={{ background: 'rgba(123, 97, 255, 0.08)' }}
        >
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" strokeWidth={2.2} />
          <p className="text-left text-[12.5px] leading-relaxed" style={{ color: MUTED }}>
            Reste sur cet écran : tu n’as rien à refaire. Si tu quittes, tu pourras rejoindre via le même lien ou le code
            classe.
          </p>
        </div>

        <div className="mt-5 flex items-start gap-2 text-left">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-400/90" />
          <p className="text-[12px] leading-relaxed" style={{ color: MUTED }}>
            <span className="font-semibold text-violet-300/95">Conseil : </span>
            mets un casque pour l’arrivée dans le studio et réduis les bruits de fond.
          </p>
        </div>

        <div className="mt-8 text-center">
          <Link
            to={ELEVE_MOBILE.live}
            className="text-[13px] font-semibold text-white/50 underline-offset-2 transition hover:text-white/80"
          >
            Quitter la salle d’attente
          </Link>
        </div>
      </div>
    </EleveConnectionLayout>
  );
}
