/**
 * StudentDashboardPage — "Madrasa Numérique"
 *
 * Direction esthétique : Éditorial académique islamique.
 * Inspiré des madrasas classiques, des manuscrits enluminés et de
 * l'édition universitaire de prestige. Sobre, intemporel, savant.
 *
 * Choix typographiques :
 *   Display  → Cormorant Garamond (sérif expressif, autorité intellectuelle)
 *   Body     → Crimson Pro (sérif lisible, chaleur académique)
 *   Évitent  → Inter, Poppins, Space Grotesk (trop SaaS génériques)
 *
 * Palette (warm ink + parchment + manuscript gold) :
 *   --ink          #0D0B08  fond chaud quasi-noir (vs cold tech black)
 *   --surface-1    #141210  cartes
 *   --surface-2    #1C1916  cartes secondaires
 *   --gold         #C9A84C  or manuscrit — accent primaire
 *   --emerald      #1E6B45  vert islamique — accent secondaire
 *   --cream        #F0E6CE  texte principal (chaud, pas blanc froid)
 *   --muted        #7A7065  texte secondaire
 *   --rule         #2A2520  diviseurs subtils
 *
 * Layout : Grille éditoriale 2 colonnes sur desktop.
 *   Colonne gauche sticky (programme + progression)
 *   Colonne droite scrollable (live, modules, agenda)
 *   Éléments qui "cassent" intentionnellement la grille (numéros flottants)
 */

import React, { useEffect, useState, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { getEffectiveRole } from '@/lib/accountRoleMode';
import { forumCommunityUrlForRole } from '@/lib/forumDashboardPaths';

/* ─── Injection polices Google Fonts ────────────────────────────── */
function useFonts() {
  useEffect(() => {
    const id = 'madrasa-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600&family=Crimson+Pro:wght@300;400;500;600&display=swap';
    document.head.appendChild(link);
  }, []);
}

/* ─── CSS design tokens (injectés en global) ────────────────────── */
const CSS_TOKENS = `
  .madrasa-shell {
    --ink:       #0D0B08;
    --srf-1:     #141210;
    --srf-2:     #1C1916;
    --srf-3:     #252118;
    --gold:      #C9A84C;
    --gold-dim:  #8A6F2E;
    --emerald:   #1E6B45;
    --cream:     #F0E6CE;
    --muted:     #7A7065;
    --rule:      rgba(201,168,76,0.15);
    --radius-sm: 4px;
    --radius-md: 8px;
    --radius-lg: 12px;
    --font-display: 'Cormorant Garamond', Georgia, serif;
    --font-body:    'Crimson Pro', 'Georgia', serif;
    --ease-out:     cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* Focus styles accessibles */
  .madrasa-shell *:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 3px;
    border-radius: var(--radius-sm);
  }

  /* Ornement séparateur */
  .madrasa-rule {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0;
  }
  .madrasa-rule::before,
  .madrasa-rule::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--rule);
  }

  /* Grain texture overlay — profondeur visuelle subtile */
  .madrasa-grain::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 0;
    border-radius: inherit;
  }

  /* Hover lift — transform GPU-accelerated */
  .madrasa-lift {
    transition: transform 200ms var(--ease-out), box-shadow 200ms var(--ease-out);
    will-change: transform;
  }
  .madrasa-lift:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 40px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,168,76,0.2);
  }

  /* Numéro flottant — casse la grille intentionnellement */
  .float-num {
    font-family: var(--font-display);
    font-weight: 300;
    font-style: italic;
    color: rgba(201,168,76,0.12);
    line-height: 1;
    pointer-events: none;
    user-select: none;
  }

  /* Scrollbar discrète */
  .madrasa-shell ::-webkit-scrollbar { width: 4px; }
  .madrasa-shell ::-webkit-scrollbar-track { background: transparent; }
  .madrasa-shell ::-webkit-scrollbar-thumb { background: var(--rule); border-radius: 2px; }
`;

/* ─── Mock data ─────────────────────────────────────────────────── */
const STUDENT = {
  name: 'Khalid Mansouri',
  initials: 'KM',
  cycle: 'Fondements',
  year: 1,
  weekNumber: 12,
  modulesCompleted: 3,
  totalModules: 21,
  progressPct: 14,
  streak: 7,
  points: 1240,
  nextExam: '18 mai 2025',
};

const WEEK = {
  weekNumber: 12,
  trimester: 'T1',
  moduleNumber: 3,
  moduleTitle: 'La Connaissance du Créateur',
  theme: "L'Unicité divine — Tawḥīd al-Rubūbiyya",
  objective: "Maîtriser les 3 dimensions du Tawḥīd et les distinguer avec clarté.",
  sessions: [
    { day: 'Lun', time: '18h00', type: 'Cours magistral', done: true },
    { day: 'Mer', time: '18h00', type: 'Atelier & Q/R',   done: false },
    { day: 'Ven', time: '20h00', type: 'Neuron IA',       done: false },
  ],
  assignments: [
    { label: 'Fiche de lecture — Chapitre 3', due: 'Jeu 23h59', done: true },
    { label: 'Quiz Tawḥīd (20 questions)',    due: 'Dim 23h59', done: false },
  ],
};

const NEXT_LIVE = {
  title: 'Module 3 — Atelier & Q/R',
  teacher: 'Shaykh Mansour Al-Faris',
  date: 'Mercredi 7 mai · 18h00–19h30',
  enrolled: 38,
  isLive: false,
};

const MODULES = [
  { num: 1,  title: 'Introduction à la Science Islamique', pct: 100, status: 'done'    },
  { num: 2,  title: 'Les Fondements de la Foi',            pct: 100, status: 'done'    },
  { num: 3,  title: 'La Connaissance du Créateur',         pct: 40,  status: 'current' },
  { num: 4,  title: 'Les Anges et le Monde Invisible',     pct: 0,   status: 'locked'  },
  { num: 5,  title: 'Les Prophètes et les Messagers',      pct: 0,   status: 'locked'  },
];

const AGENDA = [
  { type: 'live', when: 'Mer 7 mai · 18h00',  label: 'Atelier Module 3 — Q/R',   urgent: false },
  { type: 'exam', when: 'Dim 11 mai · 23h59', label: 'Quiz Tawḥīd à rendre',     urgent: true  },
  { type: 'live', when: 'Lun 12 mai · 18h00', label: 'Module 4 — Cours magistral',urgent: false },
];

/* ─── Composants atomiques ──────────────────────────────────────── */

/** Ornement géométrique islamique simplifié — étoile à 8 branches SVG */
function StarOrnament({ size = 16, color = 'var(--gold)', opacity = 0.5 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 32 32"
      aria-hidden="true" focusable="false"
      style={{ opacity, flexShrink: 0 }}
    >
      <path
        d="M16 2 L18.8 11.2 L28 8 L22.8 16 L28 24 L18.8 20.8 L16 30 L13.2 20.8 L4 24 L9.2 16 L4 8 L13.2 11.2 Z"
        fill={color}
      />
    </svg>
  );
}

/** Section title avec ornement éditorial */
function EditorialTitle({ children, sub, action, actionTo, floatNum }) {
  return (
    <div className="relative mb-6">
      {floatNum && (
        <span
          className="float-num absolute -left-8 -top-4 text-7xl select-none pointer-events-none"
          aria-hidden="true"
        >
          {floatNum}
        </span>
      )}
      <div className="flex items-end justify-between gap-4">
        <div>
          {sub && (
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--gold)',
              marginBottom: 6,
              fontWeight: 500,
            }}>
              {sub}
            </p>
          )}
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--cream)',
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
          }}>
            {children}
          </h2>
        </div>
        {action && actionTo && (
          <Link
            to={actionTo}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--muted)',
              whiteSpace: 'nowrap',
              textDecoration: 'none',
              transition: 'color 150ms',
              paddingBottom: 2,
              borderBottom: '1px solid var(--rule)',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >
            Voir tout →
          </Link>
        )}
      </div>
      {/* Règle dorée */}
      <div style={{ height: 1, background: 'var(--rule)', marginTop: 12 }} />
    </div>
  );
}

/** Barre de progression — fine, élégante */
function ProgressBar({ pct, color = 'var(--gold)', label }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  return (
    <div ref={ref}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--muted)', letterSpacing: '0.06em' }}>
            {label}
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color, fontWeight: 600 }}>
            {pct}%
          </span>
        </div>
      )}
      <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
        <motion.div
          style={{ height: '100%', background: color, borderRadius: 1, transformOrigin: 'left' }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: inView ? pct / 100 : 0 }}
          transition={{ duration: 1.2, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

/** Carte de stat — minimaliste, chiffres en display font */
function StatBlock({ value, label, sub }) {
  return (
    <div style={{
      padding: '16px 20px',
      background: 'var(--srf-2)',
      border: '1px solid var(--rule)',
      borderRadius: 'var(--radius-md)',
    }}>
      <p style={{
        fontFamily: 'var(--font-display)',
        fontSize: 32,
        fontWeight: 300,
        color: 'var(--cream)',
        lineHeight: 1,
        letterSpacing: '-0.02em',
      }}>
        {value}
      </p>
      <p style={{
        fontFamily: 'var(--font-body)',
        fontSize: 11,
        color: 'var(--muted)',
        marginTop: 4,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>
        {label}
      </p>
      {sub && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--gold)', marginTop: 2 }}>
          {sub}
        </p>
      )}
    </div>
  );
}

/** Module row — ligne éditoriale */
function ModuleRow({ mod, index }) {
  const statusMap = {
    done:    { color: 'var(--emerald)', symbol: '✓',  label: 'Validé' },
    current: { color: 'var(--gold)',    symbol: '◆',  label: 'En cours' },
    locked:  { color: 'var(--rule)',    symbol: '—',   label: 'À venir' },
  };
  const s = statusMap[mod.status];

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="madrasa-lift"
      style={{
        display: 'grid',
        gridTemplateColumns: '24px 1fr auto',
        alignItems: 'center',
        gap: 16,
        padding: '14px 16px',
        background: mod.status === 'current' ? 'rgba(201,168,76,0.06)' : 'var(--srf-2)',
        border: `1px solid ${mod.status === 'current' ? 'rgba(201,168,76,0.25)' : 'var(--rule)'}`,
        borderRadius: 'var(--radius-md)',
        cursor: mod.status === 'locked' ? 'default' : 'pointer',
        textDecoration: 'none',
      }}
    >
      {/* Numéro */}
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: 13,
        fontWeight: 600,
        color: s.color,
        fontStyle: 'italic',
      }}>
        {mod.status === 'done' ? '✓' : mod.status === 'locked' ? '—' : `0${mod.num}`}
      </span>
      {/* Titre + barre */}
      <div>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          color: mod.status === 'locked' ? 'var(--muted)' : 'var(--cream)',
          fontWeight: mod.status === 'current' ? 600 : 400,
          marginBottom: 5,
        }}>
          {mod.title}
        </p>
        <ProgressBar pct={mod.pct} color={s.color} />
      </div>
      {/* Badge statut */}
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: 10,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: s.color,
        whiteSpace: 'nowrap',
        opacity: mod.status === 'locked' ? 0.4 : 1,
      }}>
        {s.label}
      </span>
    </motion.div>
  );
}

/** Ligne agenda */
function AgendaRow({ item, index }) {
  const typeMap = {
    live: { symbol: '◉', color: 'var(--emerald)' },
    exam: { symbol: '◈', color: 'var(--gold)'    },
    rdv:  { symbol: '◇', color: 'var(--muted)'   },
  };
  const t = typeMap[item.type] || typeMap.rdv;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.07, duration: 0.35 }}
      style={{
        display: 'grid',
        gridTemplateColumns: '16px 1fr auto',
        alignItems: 'center',
        gap: 14,
        padding: '12px 0',
        borderBottom: '1px solid var(--rule)',
      }}
    >
      <span style={{ fontFamily: 'var(--font-display)', color: t.color, fontSize: 14, lineHeight: 1 }}>
        {t.symbol}
      </span>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--cream)', fontWeight: item.urgent ? 500 : 400 }}>
        {item.label}
      </span>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: 11,
        color: item.urgent ? 'var(--gold)' : 'var(--muted)',
        whiteSpace: 'nowrap',
        letterSpacing: '0.04em',
      }}>
        {item.when}
      </span>
    </motion.div>
  );
}

/* ─── Page principale ───────────────────────────────────────────── */
export default function StudentDashboardPage() {
  useFonts();

  const { user } = useAuth();
  const forumCommunityTo = forumCommunityUrlForRole(getEffectiveRole(user));
  const rawName = user?.user_metadata?.full_name ?? STUDENT.name;
  const firstName = rawName.split(' ')[0];
  const now = new Date();
  const dayLabel = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      {/* Injection tokens CSS globaux */}
      <style>{CSS_TOKENS}</style>

      <Helmet>
        <title>Mon Espace — {firstName} · ISNA Prorascience</title>
      </Helmet>

      <div
        className="madrasa-shell madrasa-grain"
        style={{
          minHeight: '100vh',
          background: 'var(--ink)',
          color: 'var(--cream)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* ── Halo ambiant discret (pas de dégradé générique) ── */}
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: -200,
            right: -200,
            width: 600,
            height: 600,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 70%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1120, margin: '0 auto', padding: '40px 32px 80px' }}>

          {/* ══════════════════════════════════════════════════ */}
          {/* HERO — Typographie display, asymétrique           */}
          {/* ══════════════════════════════════════════════════ */}
          <motion.header
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{ marginBottom: 48 }}
          >
            {/* Date + cycle — labels small caps */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <StarOrnament size={14} />
              <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--muted)',
              }}>
                {dayLabel} · Cycle {STUDENT.cycle} · Année {STUDENT.year}
              </p>
            </div>

            {/* Titre héroïque */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'end', gap: 24 }}>
              <div>
                <h1 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(40px, 6vw, 72px)',
                  fontWeight: 400,
                  fontStyle: 'italic',
                  color: 'var(--cream)',
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  marginBottom: 8,
                }}>
                  Bonjour,{' '}
                  <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{firstName}</span>
                </h1>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 16,
                  color: 'var(--muted)',
                  letterSpacing: '0.02em',
                }}>
                  Semaine {STUDENT.weekNumber} · Module {WEEK.moduleNumber} en cours
                </p>
              </div>

              {/* Avatar — initiales, sobre */}
              <div
                role="img"
                aria-label={`Avatar de ${rawName}`}
                style={{
                  width: 56,
                  height: 56,
                  border: '1px solid var(--rule)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-display)',
                  fontSize: 18,
                  fontWeight: 600,
                  color: 'var(--gold)',
                  letterSpacing: '0.05em',
                  flexShrink: 0,
                  background: 'var(--srf-2)',
                }}
              >
                {STUDENT.initials}
              </div>
            </div>

            {/* Règle ornementale sous le hero */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 24 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
              <StarOrnament size={12} opacity={0.35} />
              <div style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
            </div>
          </motion.header>

          {/* ══════════════════════════════════════════════════ */}
          {/* GRILLE ÉDITORIALE 2 colonnes                      */}
          {/* ══════════════════════════════════════════════════ */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 40,
          }}
          className="madrasa-grid"
          >

            {/* ── COLONNE GAUCHE ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

              {/* Stats — 2×2 grid */}
              <motion.section
                aria-label="Statistiques"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <StatBlock value={`${STUDENT.progressPct}%`} label="Progression" sub="Cycle Fondements" />
                  <StatBlock value={`${STUDENT.modulesCompleted}/21`} label="Modules" sub="validés" />
                  <StatBlock value={`${STUDENT.streak}j`} label="Série active" sub="sans interruption" />
                  <StatBlock value={STUDENT.points.toLocaleString()} label="Points" sub="ce cycle" />
                </div>

                {/* Barre de progression globale */}
                <div style={{ marginTop: 20, padding: '16px 20px', background: 'var(--srf-1)', border: '1px solid var(--rule)', borderRadius: 'var(--radius-md)' }}>
                  <ProgressBar pct={STUDENT.progressPct} label="Avancement — Cycle Fondements" />
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                    18 modules restants · ~8 mois estimés
                  </p>
                </div>
              </motion.section>

              {/* Programme de la semaine */}
              <motion.section
                aria-labelledby="week-title"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                style={{ position: 'relative' }}
              >
                {/* Numéro flottant — casse la grille */}
                <span className="float-num" style={{ position: 'absolute', top: -24, right: -8, fontSize: 100 }} aria-hidden>
                  {WEEK.weekNumber}
                </span>

                <EditorialTitle
                  id="week-title"
                  sub={`Semaine ${WEEK.weekNumber} · ${WEEK.trimester}`}
                  action="Calendrier"
                  actionTo="/m/eleve/calendrier-annuel"
                >
                  Programme de la semaine
                </EditorialTitle>

                {/* Carte programme */}
                <div style={{
                  padding: 24,
                  background: 'var(--srf-1)',
                  border: '1px solid var(--rule)',
                  borderRadius: 'var(--radius-lg)',
                }}>
                  {/* Module title */}
                  <p style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 11,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--gold)',
                    marginBottom: 8,
                  }}>
                    Module {WEEK.moduleNumber}
                  </p>
                  <h3 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 20,
                    fontWeight: 600,
                    color: 'var(--cream)',
                    lineHeight: 1.2,
                    marginBottom: 4,
                  }}>
                    {WEEK.moduleTitle}
                  </h3>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--muted)', marginBottom: 20, fontStyle: 'italic' }}>
                    {WEEK.theme}
                  </p>

                  {/* Objectif */}
                  <div style={{ paddingLeft: 16, borderLeft: '2px solid var(--gold)', marginBottom: 20 }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 4 }}>
                      Objectif
                    </p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--cream)', lineHeight: 1.5 }}>
                      {WEEK.objective}
                    </p>
                  </div>

                  {/* Sessions */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
                    {WEEK.sessions.map((s, i) => (
                      <div key={i} style={{
                        padding: '10px 12px',
                        background: s.done ? 'rgba(30,107,69,0.15)' : 'var(--srf-2)',
                        border: `1px solid ${s.done ? 'rgba(30,107,69,0.4)' : 'var(--rule)'}`,
                        borderRadius: 'var(--radius-sm)',
                      }}>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: s.done ? 'var(--emerald)' : 'var(--muted)', marginBottom: 3 }}>
                          {s.day}
                        </p>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--cream)', lineHeight: 1 }}>
                          {s.time}
                        </p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                          {s.type}
                        </p>
                        {s.done && (
                          <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--emerald)', marginTop: 4, fontStyle: 'italic' }}>
                            Fait ✓
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Devoirs */}
                  <div style={{ borderTop: '1px solid var(--rule)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {WEEK.assignments.map((a, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontFamily: 'var(--font-display)', color: a.done ? 'var(--emerald)' : 'var(--muted)', fontSize: 14 }}>
                            {a.done ? '✓' : '○'}
                          </span>
                          <span style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: 13,
                            color: a.done ? 'var(--muted)' : 'var(--cream)',
                            textDecoration: a.done ? 'line-through' : 'none',
                          }}>
                            {a.label}
                          </span>
                        </div>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--gold)', whiteSpace: 'nowrap' }}>
                          {a.due}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.section>

              {/* Prochain live */}
              <motion.section
                aria-labelledby="live-title"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <EditorialTitle id="live-title" sub="Cours en direct" action="Tous" actionTo="/m/eleve/live">
                  Prochain live
                </EditorialTitle>

                <div
                  className="madrasa-lift"
                  style={{
                    padding: 24,
                    background: 'var(--srf-1)',
                    border: '1px solid var(--rule)',
                    borderRadius: 'var(--radius-lg)',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 20,
                    alignItems: 'start',
                  }}
                >
                  <div>
                    {/* Status badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: NEXT_LIVE.isLive ? '#ef4444' : 'var(--emerald)',
                        boxShadow: NEXT_LIVE.isLive ? '0 0 8px #ef4444' : 'none',
                      }} />
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                        {NEXT_LIVE.isLive ? 'En direct' : 'Bientôt'}
                      </span>
                    </div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--cream)', marginBottom: 4 }}>
                      {NEXT_LIVE.title}
                    </h3>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 12 }}>
                      avec {NEXT_LIVE.teacher}
                    </p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--cream)' }}>
                      {NEXT_LIVE.date}
                    </p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                      {NEXT_LIVE.enrolled} participants inscrits
                    </p>
                  </div>

                  {/* CTA sobre */}
                  <Link
                    to="/m/eleve/live"
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--ink)',
                      background: 'var(--gold)',
                      padding: '10px 18px',
                      borderRadius: 'var(--radius-sm)',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.04em',
                      transition: 'background 150ms, transform 150ms',
                      display: 'inline-block',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#e0bc5b'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--gold)'; e.currentTarget.style.transform = 'none'; }}
                  >
                    Rejoindre →
                  </Link>
                </div>
              </motion.section>

            </div>

            {/* ── COLONNE DROITE ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

              {/* Mes modules */}
              <motion.section
                aria-labelledby="modules-title"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <EditorialTitle id="modules-title" sub="Cycle Fondements · 21 modules" action="Bibliothèque" actionTo="/m/eleve/bibliotheque">
                  Mes modules
                </EditorialTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {MODULES.map((mod, i) => (
                    <ModuleRow key={mod.num} mod={mod} index={i} />
                  ))}
                </div>
              </motion.section>

              {/* Agenda */}
              <motion.section
                aria-labelledby="agenda-title"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <EditorialTitle id="agenda-title" sub="Prochaines échéances" action="Agenda" actionTo="/student-school-life/agenda">
                  À venir
                </EditorialTitle>
                <div>
                  {AGENDA.map((item, i) => (
                    <AgendaRow key={i} item={item} index={i} />
                  ))}
                </div>
              </motion.section>

              {/* Accès rapide — liste éditoriale (pas des tuiles carrées génériques) */}
              <motion.section
                aria-labelledby="quick-title"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.26, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <EditorialTitle id="quick-title" sub="Navigation">
                  Espaces
                </EditorialTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {[
                    { symbol: '◈', label: 'Évaluations & Notes',    sub: 'Résultats, notation',     to: '/student-school-life/evaluations' },
                    { symbol: '◎', label: 'Forum communauté',      sub: 'Questions & réponses',    to: forumCommunityTo },
                    { symbol: '◉', label: 'Replays de cours',       sub: 'Sessions enregistrées',   to: '/m/eleve/replays' },
                    { symbol: '◆', label: 'Neuron IA',              sub: 'Révision intelligente',   to: '/m/eleve/neuron' },
                    { symbol: '◇', label: 'Calendrier annuel',      sub: 'Programme pédagogique',   to: '/m/eleve/calendrier-annuel' },
                    { symbol: '○', label: 'Documents & Ressources', sub: 'Fiches, supports',        to: '/student-school-life/documents' },
                    { symbol: '◌', label: 'Absences & Assiduité',   sub: 'Suivi de présence',       to: '/student-school-life/absences' },
                  ].map((item, i) => (
                    <Link
                      key={i}
                      to={item.to}
                      className="madrasa-lift"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '20px 1fr',
                        alignItems: 'center',
                        gap: 16,
                        padding: '14px 0',
                        borderBottom: '1px solid var(--rule)',
                        textDecoration: 'none',
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--gold)', opacity: 0.7 }}>
                        {item.symbol}
                      </span>
                      <div>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--cream)', fontWeight: 500 }}>
                          {item.label}
                        </p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--muted)' }}>
                          {item.sub}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </motion.section>

            </div>
          </div>

          {/* ── Footer éditorial ── */}
          <footer style={{ marginTop: 64, paddingTop: 24, borderTop: '1px solid var(--rule)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <StarOrnament size={12} opacity={0.3} />
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--muted)', letterSpacing: '0.06em' }}>
                ISNA · Prorascience · Cycle Fondements 2025–2026
              </p>
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
              «&nbsp;La connaissance n&apos;est pas un privilège, c&apos;est une responsabilité.&nbsp;»
            </p>
          </footer>

        </div>

        {/* ── Responsive styles ── */}
        <style>{`
          @media (max-width: 900px) {
            .madrasa-grid {
              grid-template-columns: 1fr !important;
            }
          }
          @media (max-width: 600px) {
            .madrasa-shell > div > div {
              padding: 24px 16px 60px !important;
            }
          }
        `}</style>

      </div>
    </>
  );
}
