import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Clock,
  Headphones,
  Home,
  LayoutGrid,
  Mail,
  Shield,
  ShieldCheck,
  UserX,
} from 'lucide-react';
import { EleveConnectionLayout } from '@/pages/school/eleve-mobile/connection/EleveConnectionLayout';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';

const MUTED = '#8E8E93';
const CARD = '#12121E';
const LINE = 'rgba(255,255,255,0.08)';
const PURPLE = '#7B61FF';
const RED = '#F43F5E';
const BLUE = '#3B82F6';
const GREEN = '#22C55E';

const GRAD_CTA = {
  background: 'linear-gradient(90deg, #7B61FF 0%, #5E4BFF 45%, #4F46E5 100%)',
  boxShadow: '0 10px 32px -8px rgba(123, 97, 255, 0.45), 0 4px 12px -4px rgba(79, 70, 229, 0.35)',
};

/** Illustration 3D simplifiée : cadenas + symbole interdit rouge. */
function PadlockDeniedHero() {
  return (
    <div
      className="relative mx-auto flex h-[168px] w-full max-w-[220px] select-none items-end justify-center"
      aria-hidden
    >
      <div
        className="absolute inset-0 overflow-hidden rounded-[2rem] opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(88, 28, 135, 0.25), transparent 60%), radial-gradient(ellipse 50% 40% at 30% 20%, rgba(59, 130, 246, 0.12), transparent 50%)',
        }}
      />
      {['+', '·', '+', '·'].map((c, i) => (
        <span
          key={i}
          className="absolute text-[10px] font-light text-violet-400/30"
          style={{
            left: `${12 + i * 22}%`,
            top: `${18 + (i % 2) * 12}%`,
            transform: `rotate(${i * 12}deg)`,
          }}
        >
          {c}
        </span>
      ))}
      <div
        className="absolute bottom-2 left-1/2 h-10 w-28 -translate-x-1/2 rounded-full opacity-50 blur-2xl"
        style={{ background: 'radial-gradient(ellipse, rgba(123, 97, 255, 0.5) 0%, transparent 70%)' }}
      />
      <div className="relative z-10 flex flex-col items-center pb-1">
        <div
          className="relative flex h-[100px] w-[72px] items-start justify-center pt-1"
          style={{ filter: 'drop-shadow(0 16px 36px rgba(88, 28, 135, 0.55))' }}
        >
          <div
            className="absolute top-0 h-[52px] w-[64px] rounded-2xl"
            style={{
              background: 'linear-gradient(165deg, #8B5CF6 0%, #6D28D9 50%, #4C1D95 100%)',
              boxShadow: `
                inset 0 2px 0 rgba(255,255,255,0.22),
                inset 0 -2px 0 rgba(0,0,0,0.4),
                0 12px 28px rgba(0,0,0,0.45)
              `,
            }}
          />
          <div
            className="absolute top-10 h-14 w-[60px] rounded-b-[1.1rem] rounded-t-sm"
            style={{
              background: 'linear-gradient(180deg, #6D28D9 0%, #4c1d95 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          />
          <div
            className="absolute top-3.5 h-7 w-10 rounded-b-lg"
            style={{
              border: '4px solid rgba(124, 58, 237, 0.95)',
              borderTop: 'none',
              background: 'linear-gradient(180deg, rgba(15,5,30,0.3), rgba(0,0,0,0.5))',
            }}
          />
          <div
            className="absolute top-[2.1rem] flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background: 'radial-gradient(circle at 30% 30%, #3f0d1a 0%, #1a0508 100%)',
              boxShadow: '0 0 0 3px rgba(244, 63, 94, 0.45), 0 0 28px rgba(244, 63, 94, 0.35), inset 0 0 20px rgba(0,0,0,0.5)',
            }}
          >
            <Ban className="h-8 w-8 text-rose-400" strokeWidth={2.4} />
          </div>
        </div>
      </div>
    </div>
  );
}

function WhyRow({ icon: Icon, iconBg, title, sub, iconClass }) {
  return (
    <div className="flex gap-3.5 border-b border-white/[0.06] py-3.5 last:border-b-0 last:pb-0 first:pt-0">
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClass || ''}`}
        style={typeof iconBg === 'object' ? iconBg : { background: iconBg }}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-bold leading-tight text-white">{title}</p>
        <p className="mt-1 text-[12px] leading-snug" style={{ color: MUTED }}>
          {sub}
        </p>
      </div>
    </div>
  );
}

function ActionRow({ to, left, title, sub, chevronClass, iconWrapClass, iconStyle }) {
  return (
    <Link
      to={to}
      className="flex w-full min-h-[72px] items-center gap-3.5 px-4 py-3.5 transition active:scale-[0.99]"
      style={{ background: '#0E0E1F' }}
    >
      <span className={iconWrapClass} style={iconStyle}>
        {left}
      </span>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[15px] font-bold leading-tight tracking-[-0.01em] text-white">{title}</p>
        <p className="mt-1 text-[12px] leading-[1.45]" style={{ color: MUTED }}>
          {sub}
        </p>
      </div>
      <ChevronRight className={`h-5 w-5 shrink-0 ${chevronClass}`} strokeWidth={2.2} />
    </Link>
  );
}

/**
 * Accès refusé au live — aligné sur la maquette (cadenas, raisons, actions, aide).
 */
export default function EleveLiveAccessDeniedScreen() {
  const navigate = useNavigate();
  const codePath = `${ELEVE_MOBILE.connexion}/code`;
  const lienPath = `${ELEVE_MOBILE.connexion}/lien`;

  return (
    <EleveConnectionLayout className="text-white">
      <div className="mx-auto w-full max-w-md px-4 pb-6">
        <div className="mb-1 flex items-center">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(ELEVE_MOBILE.connexion))}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white backdrop-blur transition hover:bg-white/10"
            aria-label="Retour"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <PadlockDeniedHero />
          <h1 className="mt-1 text-center text-[26px] font-extrabold leading-tight tracking-[-0.02em]">
            <span className="text-white">Accès </span>
            <span style={{ color: RED }}>refusé</span>
          </h1>
          <p className="mx-auto mt-2 max-w-[20rem] text-center text-[15px] leading-relaxed" style={{ color: MUTED }}>
            Tu n'as pas l\'autorisation d\'accéder à ce live ou ce contenu.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.35 }}
          className="mt-6 space-y-4"
        >
          <section
            className="overflow-hidden border p-4"
            style={{ background: CARD, borderColor: LINE, borderRadius: 20 }}
          >
            <h2 className="mb-0 text-[16px] font-bold text-white">Pourquoi tu ne peux pas accéder ?</h2>
            <div className="mt-3">
              <WhyRow
                icon={UserX}
                iconBg="rgba(244, 63, 94, 0.18)"
                iconClass="text-rose-400"
                title="Lien invalide ou expiré"
                sub="Le lien d'invitation n'est plus valide."
              />
              <WhyRow
                icon={ShieldCheck}
                iconBg="rgba(123, 97, 255, 0.2)"
                iconClass="text-violet-300"
                title="Accès non autorisé"
                sub="Seuls les élèves invités peuvent rejoindre ce live."
              />
              <WhyRow
                icon={Clock}
                iconBg="rgba(249, 115, 22, 0.2)"
                iconClass="text-orange-300"
                title="Live terminé ou non démarré"
                sub="Ce live n'est plus disponible."
              />
            </div>
          </section>

          <section
            className="overflow-hidden border p-0"
            style={{ background: CARD, borderColor: LINE, borderRadius: 20 }}
          >
            <h2 className="border-b px-4 py-3.5 text-[16px] font-bold" style={{ borderColor: LINE }}>
              Que peux-tu faire ?
            </h2>
            <div className="divide-y divide-white/10">
              <ActionRow
                to={codePath}
                title="Entrer un code de classe"
                sub="Si tu as un code, entre-le ici."
                chevronClass="text-white/35"
                iconWrapClass="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                iconStyle={{ background: PURPLE }}
                left={<LayoutGrid className="h-5 w-5 text-white" strokeWidth={2.2} />}
              />
              <ActionRow
                to={lienPath}
                title="Demander un nouveau lien"
                sub="Contacte ton professeur pour recevoir un nouveau lien."
                chevronClass="text-white/35"
                iconWrapClass="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                iconStyle={{ background: BLUE }}
                left={<Mail className="h-5 w-5 text-white" strokeWidth={2.2} />}
              />
              <ActionRow
                to={ELEVE_MOBILE.home}
                title="Retourner à l'accueil"
                sub="Va sur ton espace pour voir tes cours."
                chevronClass="text-white/35"
                iconWrapClass="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                iconStyle={{ background: GREEN }}
                left={<Home className="h-5 w-5 text-white" strokeWidth={2.2} />}
              />
            </div>
          </section>

          <section
            className="flex flex-col gap-3 border p-4 sm:flex-row sm:items-center"
            style={{ background: CARD, borderColor: LINE, borderRadius: 20 }}
          >
            <div className="flex min-w-0 flex-1 gap-3">
              <div
                className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(123, 97, 255, 0.35), rgba(30, 20, 60, 0.9))',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.1)',
                }}
                aria-hidden
              >
                <div className="absolute bottom-0 left-1/2 h-8 w-10 -translate-x-1/2 rounded-t-full bg-violet-900/60" />
                <div className="absolute left-1/2 top-2 h-7 w-7 -translate-x-1/2 rounded-full bg-amber-800/80" />
                <span className="absolute right-0 top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-violet-200 shadow-sm" style={{ background: PURPLE }}>
                  ?
                </span>
              </div>
              <div>
                <p className="text-[15px] font-bold text-white">Besoin d'aide ?</p>
                <p className="mt-1 text-[12px] leading-relaxed" style={{ color: MUTED }}>
                  Si tu penses qu'il s\'agit d\'une erreur, contacte ton professeur ou le support.
                </p>
              </div>
            </div>
            <Link
              to="/support"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition hover:bg-white/5"
              style={{ borderColor: 'rgba(123, 97, 255, 0.6)', color: PURPLE }}
            >
              <Headphones className="h-4 w-4" strokeWidth={2.2} />
              Contacter le support
            </Link>
          </section>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="mt-6 space-y-4"
        >
          <Link
            to={ELEVE_MOBILE.home}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl py-3.5 text-[16px] font-bold text-white transition active:scale-[0.99]"
            style={GRAD_CTA}
          >
            <Home className="h-5 w-5" strokeWidth={2.2} />
            Aller à mon espace
          </Link>
          <p className="flex items-center justify-center gap-2 text-center text-[11px] leading-relaxed" style={{ color: MUTED }}>
            <Shield className="h-3.5 w-3.5 shrink-0 text-violet-400/90" strokeWidth={2.2} />
            Tes données sont protégées et sécurisées.
          </p>
        </motion.div>
      </div>
    </EleveConnectionLayout>
  );
}
