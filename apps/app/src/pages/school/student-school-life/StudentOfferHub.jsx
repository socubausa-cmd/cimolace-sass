/**
 * StudentOfferHub — « Vitrine douce » de conversion pour l'espace élève.
 *
 * POURQUOI : depuis l'audit parcours, un membre fraîchement inscrit atterrit sur le
 * Dashboard élève MÊME sans abonnement. Ce hub se place EN HAUT du dashboard et n'est
 * rendu QUE pour les non-premium (cf. garde `isPremiumActive` dans StudentDashboardPage).
 * Il présente 3 voies de conversion (Temple / Cycles / Consultation) + un rappel doux
 * du contenu verrouillé + un CTA non engageant (entretien gratuit).
 *
 * DESIGN : calque StudentDashboardPage — styles inline, framer-motion, tokens host-aware
 * via le Proxy `T` (themeProxy). En SOMBRE : fond profond + accent OR #D4AF37 (charte ISNA
 * premium). En CLAIR (espace élève) : cartes blanches, accent or lisible. Icônes lucide-react,
 * aucun emoji. Aucun prix en dur (la page /forfaits porte les tarifs).
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame, GraduationCap, Users, Lock, Check, ArrowRight, Calendar } from 'lucide-react';
import { themeProxy as T } from '@/pages/school/student-school-life/sslTheme';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: delay / 1000 },
});

/* ─────────────────────────── Liste à puces (une ligne = un bénéfice) ─────────────────────────── */
const Bullet = ({ accent, children }) => (
  <li style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 9 }}>
    <span style={{
      width: 17, height: 17, borderRadius: 5, marginTop: 1, flexShrink: 0,
      background: accent + '1F', border: `1px solid ${accent}40`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Check size={11} color={accent} strokeWidth={2.5} />
    </span>
    <span style={{ fontSize: 12.5, lineHeight: 1.45, color: T.t2 }}>{children}</span>
  </li>
);

/* ─────────────────────────── Carte d'offre (1 des 3 voies) ─────────────────────────── */
const OfferCard = ({
  icon: Icon, accent, eyebrow, title, subtitle, bullets,
  ctaLabel, onCta, featured = false, badge, delay,
}) => {
  const [hov, setHov] = useState(false);
  return (
    <motion.div
      {...fadeUp(delay)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'relative',
        display: 'flex', flexDirection: 'column',
        background: featured
          ? `linear-gradient(160deg, ${accent}14, ${T.surface2})`
          : T.surface2,
        border: `1px solid ${featured ? accent + '55' : (hov ? T.borderMid : T.border)}`,
        borderRadius: 16,
        padding: '22px 20px 20px',
        transition: 'transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
        transform: hov ? 'translateY(-3px)' : 'none',
        boxShadow: featured
          ? `0 8px 30px ${accent}1A`
          : (hov ? '0 6px 22px rgba(0,0,0,0.10)' : 'none'),
      }}
    >
      {/* Badge « mise en avant » */}
      {badge && (
        <div style={{
          position: 'absolute', top: -11, left: 20,
          fontFamily: T.mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: T.bg,
          background: accent, borderRadius: 20, padding: '4px 10px',
          boxShadow: `0 3px 10px ${accent}55`,
        }}>
          {badge}
        </div>
      )}

      {/* Icône + intitulé court (univers / format) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 13, flexShrink: 0,
          background: accent + '18', border: `1px solid ${accent}38`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={22} color={accent} strokeWidth={1.8} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: T.mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.10em',
            textTransform: 'uppercase', color: T.t3, marginBottom: 3,
          }}>
            {eyebrow}
          </div>
          <h3 style={{
            fontSize: 17, fontWeight: 700, color: T.t1, letterSpacing: '-0.02em', lineHeight: 1.15,
          }}>
            {title}
          </h3>
        </div>
      </div>

      <p style={{ fontSize: 13, color: T.t2, lineHeight: 1.5, marginBottom: 16 }}>
        {subtitle}
      </p>

      {/* Bénéfices */}
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', flex: 1 }}>
        {bullets.map((b, i) => <Bullet key={i} accent={accent}>{b}</Bullet>)}
      </ul>

      {/* CTA voie */}
      <button
        onClick={onCta}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', padding: '11px 16px', borderRadius: 11,
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
          transition: 'all 160ms ease',
          color: featured ? T.bg : accent,
          background: featured ? accent : accent + '14',
          border: `1px solid ${featured ? accent : accent + '40'}`,
        }}
        onMouseEnter={(e) => {
          if (featured) { e.currentTarget.style.opacity = '0.9'; }
          else { e.currentTarget.style.background = accent + '24'; }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
          if (!featured) e.currentTarget.style.background = accent + '14';
        }}
      >
        {ctaLabel}
        <ArrowRight size={15} strokeWidth={2.2} />
      </button>
    </motion.div>
  );
};

/* ═══════════════════════════════ HUB ═══════════════════════════════ */
const StudentOfferHub = () => {
  const navigate = useNavigate();
  const gold = T.gold;
  const violet = T.violet;
  const teal = T.teal;

  return (
    <motion.section
      {...fadeUp(0)}
      aria-label="Choisis ta voie"
      style={{ marginBottom: 32 }}
    >
      {/* ── En-tête ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 3, height: 18, background: gold, borderRadius: 1 }} />
          <span style={{
            fontFamily: T.mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: T.t3,
          }}>
            Démarrer
          </span>
        </div>
        <h2 style={{
          fontSize: 24, fontWeight: 700, color: T.t1, letterSpacing: '-0.025em',
          lineHeight: 1.2, marginBottom: 6,
        }}>
          Bienvenue dans ton espace
        </h2>
        <p style={{ fontSize: 14, color: T.t2, lineHeight: 1.5 }}>
          Choisis ta voie pour débloquer le contenu complet.
        </p>
      </div>

      {/* ── 3 cartes (wrap sur mobile) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
          alignItems: 'stretch',
        }}
      >
        {/* Carte 1 — Le Temple */}
        <OfferCard
          icon={Flame}
          accent={gold}
          eyebrow="Univers spirituel"
          title="Le Temple"
          subtitle="La voie spirituelle et initiatique."
          bullets={[
            'Enseignements & rituels',
            'Communauté initiatique',
            'Guidance de Ngowazulu',
          ]}
          ctaLabel="Découvrir le Temple"
          onCta={() => navigate('/temple-ngowazulu')}
          delay={80}
        />

        {/* Carte 2 — Les Cycles d'initiation (mise en avant) */}
        <OfferCard
          icon={GraduationCap}
          accent={violet}
          eyebrow="École · 4 niveaux"
          title="Les Cycles d'initiation"
          subtitle="De l'autonomie à la transmission."
          bullets={[
            'Autonome → Privilégié',
            'Cours, replays & smartboard',
            'LIRI en direct (dès Académique)',
          ]}
          ctaLabel="Voir les forfaits"
          onCta={() => navigate('/forfaits')}
          featured
          badge="Le plus choisi"
          delay={160}
        />

        {/* Carte 3 — Consultation 90 min */}
        <OfferCard
          icon={Users}
          accent={teal}
          eyebrow="1:1 Ngowazulu"
          title="Consultation 90 min"
          subtitle="Une guidance directe, sans filtre."
          bullets={[
            'Séance privée 90 min',
            'Mentorat 55 → 500 €/mois',
            'RDV à ton rythme',
          ]}
          ctaLabel="Réserver"
          onCta={() => navigate('/t/isna/paiement?plan=ngowazulu-consultation-90min&type=consultation&label=Consultation%2090%20min')}
          delay={240}
        />
      </div>

      {/* ── Bandeau verrouillage doux ── */}
      <motion.div
        {...fadeUp(320)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          marginTop: 16, padding: '13px 18px', borderRadius: 13,
          background: T.surface, border: `1px solid ${T.border}`,
        }}
      >
        <div style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: T.goldDim, border: `1px solid ${T.goldMid}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Lock size={16} color={gold} strokeWidth={1.9} />
        </div>
        <p style={{ fontSize: 12.5, color: T.t2, lineHeight: 1.45 }}>
          Formations, lives et forum — verrouillés tant qu'aucune voie n'est activée.
        </p>
      </motion.div>

      {/* ── CTA gratuit (non engageant) ── */}
      <motion.div
        {...fadeUp(400)}
        style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
          gap: 14, marginTop: 12, padding: '14px 18px', borderRadius: 13,
          background: `linear-gradient(135deg, ${T.goldDim}, ${T.surface})`,
          border: `1px solid ${T.goldMid}`,
        }}
      >
        <span style={{ fontSize: 13, color: T.t1, fontWeight: 500 }}>
          Pas encore prêt à t'engager ?
        </span>
        <button
          onClick={() => navigate('/appointment/request')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 16px', borderRadius: 10,
            fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            color: gold, background: 'transparent',
            border: `1px solid ${gold}`,
            transition: 'all 160ms ease', flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = T.goldDim; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <Calendar size={15} strokeWidth={2} />
          Réserver un entretien gratuit
        </button>
      </motion.div>
    </motion.section>
  );
};

export default StudentOfferHub;
