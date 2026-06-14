import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Link2, LayoutGrid, GraduationCap, Shield } from 'lucide-react';
import { EleveConnectionLayout } from '@/pages/school/eleve-mobile/connection/EleveConnectionLayout';
import { LiriConnectionHeroAvatar } from '@/pages/school/eleve-mobile/connection/LiriConnectionHeroAvatar';
import { LiriPageFooterLine, LiriWordmark } from '@/components/brand/LiriWordmark';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { EV_MUTED, EV_ACCENT, EV_LAVENDER } from '@/pages/school/eleve-mobile/eleveMobileScreensShared';
import { LiriActionRow } from '@/components/eleve-mobile/LiriActionRow';

export default function EleveConnectionWelcome() {
  const location = useLocation();
  const redirect = new URLSearchParams(location.search).get('redirect') || '/m/eleve';
  const loginQ = new URLSearchParams({ redirect }).toString();
  const signupQ = new URLSearchParams({ redirect }).toString();

  return (
    <EleveConnectionLayout>
      <div className="mx-auto w-full max-w-md flex-1 px-4 pt-1 pb-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pt-1">
          <LiriWordmark variant="official" size="hero" className="flex w-full justify-center" />
        </motion.div>

        <LiriConnectionHeroAvatar />

        <div className="mt-1 text-center">
          <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-tight text-white sm:text-[28px]">
            Ton apprentissage.
            <br />
            <span style={{ color: EV_LAVENDER }}>En direct.</span>
          </h1>
          <p className="mx-auto mt-2 max-w-[300px] text-[14px] leading-relaxed" style={{ color: EV_MUTED }}>
            Rejoins tes cours en live, apprends, échange et progresse.
          </p>
        </div>

        <div className="mt-4 space-y-2.5">
          <LiriActionRow
            to={`${ELEVE_MOBILE.connexion}/lien`}
            left={<Link2 className="h-5 w-5 text-white" strokeWidth={2.2} />}
            title="Rejoindre avec un lien"
            sub="Accès instantané à ton cours"
            bright
            className="!shadow-violet-500/30"
          />
          <LiriActionRow
            to={`${ELEVE_MOBILE.connexion}/code`}
            left={<LayoutGrid className="h-5 w-5 text-white/80" strokeWidth={2.2} />}
            title="Rejoindre avec un code"
            sub="Entre le code de ta classe"
          />
          <LiriActionRow
            to={`${ELEVE_MOBILE.login}?${loginQ}`}
            left={<GraduationCap className="h-5 w-5 text-amber-200/90" strokeWidth={2.1} />}
            title="Se connecter"
            sub="J'ai déjà un compte LIRI"
          />
        </div>

        <div className="mt-6 flex items-center gap-2">
          <div className="h-px flex-1 bg-white/10" />
          <span className="shrink-0 px-1 text-center text-[11px] font-medium" style={{ color: EV_MUTED }}>
            Nouveau sur LIRI ?
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <Link
          to={`${ELEVE_MOBILE.signup}?${signupQ}`}
          className="mt-3 flex h-14 w-full items-center justify-center rounded-[18px] border border-violet-500/40 bg-transparent text-[15px] font-bold transition active:scale-[0.99]"
          style={{ color: EV_ACCENT }}
        >
          Créer un compte élève
        </Link>

        <div className="mt-5 flex items-start justify-center gap-2.5 text-center">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10">
            <Shield className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2} />
          </div>
          <div className="text-left">
            <p className="text-[12px] font-semibold text-white/90">Sécurisé et privé</p>
            <p className="text-[11px] leading-relaxed" style={{ color: EV_MUTED }}>
              Tes données sont protégées
            </p>
          </div>
        </div>

        <LiriPageFooterLine marginClass="mt-5" suffix="Connexion" />
      </div>
    </EleveConnectionLayout>
  );
}
