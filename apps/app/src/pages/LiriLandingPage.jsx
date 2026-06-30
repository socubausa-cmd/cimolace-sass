import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Building2, Users, ArrowRight, Sparkles } from 'lucide-react';

const ACCENT = '#d97757'; // terracotta LIRI

/**
 * P1 — Page d'accueil LIRI NEUTRE « 2 portes ».
 * Affichée à un visiteur NON connecté sur un host neutre (liri.cimolace.space,
 * localhost en dev). Aucune dépendance backend, aucune lecture de tenant.
 * Deux gros CTA : créer mon espace / rejoindre mon organisation.
 */
export default function LiriLandingPage() {
  const [logoFallback, setLogoFallback] = useState(false);

  // Glissement sobre — pas de gating d'opacité (contenu visible même si rAF throttlé).
  const slide = (delay = 0) => ({
    initial: { y: 16 },
    animate: { y: 0 },
    transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] },
  });

  return (
    <div
      className="liri-landing relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 py-12 text-white"
      style={{ '--school-accent': ACCENT, background: '#15130f' }}
    >
      <Helmet><title>LIRI</title></Helmet>

      {/* Blobs chauds */}
      <div className="pointer-events-none absolute -left-24 top-10 h-[520px] w-[520px] rounded-full blur-[170px]" style={{ background: 'rgba(217,119,87,0.18)' }} />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full blur-[150px]" style={{ background: 'rgba(194,104,63,0.12)' }} />

      <motion.div {...slide()} className="relative z-10 w-full max-w-[560px] text-center">
        {/* Logo */}
        <div className="mb-9 flex justify-center">
          <img
            src={logoFallback ? '/lirilogo.png' : '/liri-mark.png'}
            alt="LIRI"
            onError={() => setLogoFallback(true)}
            className="h-24 w-auto object-contain"
            style={{ filter: 'drop-shadow(0 0 32px rgba(217,119,87,0.38))' }}
          />
        </div>

        {/* Titre */}
        <h1 className="font-serif text-[2.3rem] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[2.8rem]" style={{ textWrap: 'balance' }}>
          Votre espace, <span style={{ color: ACCENT }}>en&nbsp;live.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-[420px] text-[15px] leading-relaxed text-white/45">
          Comme Zoom — mais à vous. Lives, cours, débats et communauté, augmentés par l'IA.
        </p>

        {/* Deux portes */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {/* Porte 1 : créer */}
          <Link
            to="/creer-organisation"
            className="group relative flex flex-col items-start gap-3 rounded-2xl p-6 text-left transition-transform duration-200 hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(140deg,#e2855f 0%,#d97757 55%,#c2683f 100%)', boxShadow: '0 18px 40px -16px rgba(217,119,87,0.6)' }}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.18)' }}>
              <Building2 className="h-[22px] w-[22px] text-white" strokeWidth={2.1} />
            </span>
            <span className="text-[16px] font-semibold text-white">Créer mon espace</span>
            <span className="text-[13px] leading-relaxed text-white/80">
              Lancez votre organisation en quelques secondes.
            </span>
            <span className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold text-white">
              Commencer <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>

          {/* Porte 2 : rejoindre */}
          <Link
            to="/rejoindre"
            className="group relative flex flex-col items-start gap-3 rounded-2xl p-6 text-left transition-transform duration-200 hover:-translate-y-0.5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'rgba(217,119,87,0.14)' }}>
              <Users className="h-[22px] w-[22px]" style={{ color: ACCENT }} strokeWidth={2.1} />
            </span>
            <span className="text-[16px] font-semibold text-white">Rejoindre mon organisation</span>
            <span className="text-[13px] leading-relaxed text-white/55">
              Vous avez un lien ou un code d'invitation.
            </span>
            <span className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: ACCENT }}>
              Rejoindre <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>

        {/* Lien secondaire */}
        <p className="mt-9 text-[13.5px] text-white/40">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-[14px] w-[14px]" style={{ color: ACCENT }} />
            Déjà membre ?
          </span>{' '}
          <Link to="/login" className="font-semibold hover:underline" style={{ color: ACCENT }}>
            Se connecter
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
