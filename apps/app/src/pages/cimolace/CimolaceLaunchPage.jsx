import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap, Stethoscope, ShoppingBag, Users2,
  Zap, ArrowRight, CheckCircle2, Lock, Globe, Shield,
} from 'lucide-react';
import CimolaceHeader from '@/components/cimolace/CimolaceHeader';
import CimolaceFooter from '@/components/cimolace/CimolaceFooter';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#0d1117', panel: '#161b22', border: '#21262d', border2: '#30363d',
  violet: '#7c3aed', violetLt: '#8b5cf6', text: '#f0f6fc', muted: '#8b949e',
  green: '#10b981', blue: '#3b82f6', orange: '#f59e0b', muted2: '#6e7681',
};

// ── Infrastructure types ───────────────────────────────────────────────────────
const INFRA = [
  {
    key: 'school',
    icon: GraduationCap,
    label: 'École',
    tagline: 'Formation & enseignement en ligne',
    desc: 'La solution complète pour créer et gérer votre école numérique. Live, cours, smartboard, IA pédagogique et paiements intégrés.',
    accent: C.green,
    badge: 'Disponible',
    badgeBg: `${C.green}18`,
    badgeBorder: `${C.green}44`,
    engines: ['Live interactif', 'Course Builder', 'Smartboard IA', 'Replay', 'NeuroRecall', 'Marketing', 'Studio', 'Calendrier', 'Paiements', 'Chat', 'Notifications'],
    cta: 'Lancer mon école',
    to: '/cimolace/create-school',
    featured: true,
  },
  {
    key: 'medos',
    icon: Stethoscope,
    label: 'MedOS',
    tagline: 'Plateforme médicale & EHR',
    desc: 'Gestion complète des praticiens, dossiers patients, notes SOAP, prescriptions, formulaires et téléconsultations.',
    accent: C.blue,
    badge: 'Disponible',
    badgeBg: `${C.blue}18`,
    badgeBorder: `${C.blue}44`,
    engines: ['Dossiers patients', 'Notes SOAP', 'Prescriptions', 'Formulaires', 'Téléconsultation', 'Santé', 'Programmes', 'RGPD'],
    cta: 'Créer un tenant MedOS',
    to: '/cimolace/admin/clients',
    featured: false,
  },
  {
    key: 'mbolo',
    icon: ShoppingBag,
    label: 'Virtuel Mbolo',
    tagline: 'Commerce & boutique africaine',
    desc: 'Catalogue produits, panier intelligent, mobile money, logistique, commandes et tableau de bord marchand.',
    accent: C.orange,
    badge: 'Bientôt',
    badgeBg: `${C.orange}18`,
    badgeBorder: `${C.orange}44`,
    engines: ['Catalogue', 'Panier', 'Commandes', 'Inventaire', 'Storefront', 'Mobile Money'],
    cta: "Rejoindre la liste d'attente",
    to: null,
    featured: false,
  },
  {
    key: 'community',
    icon: Users2,
    label: 'Community Hub',
    tagline: 'Espace communautaire & forum',
    desc: "Forum, messagerie temps réel, événements, programme d'ambassadeurs et croissance communautaire pilotée par l'IA.",
    accent: '#a855f7',
    badge: 'Planifié',
    badgeBg: 'rgba(168,85,247,0.10)',
    badgeBorder: 'rgba(168,85,247,0.30)',
    engines: ['Forum', 'Chat temps réel', 'Événements', 'Ambassadeurs', 'Analytics'],
    cta: 'Bientôt disponible',
    to: null,
    featured: false,
  },
];

// ── Feature chip ──────────────────────────────────────────────────────────────
function EngineChip({ label, accent }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '4px 10px', borderRadius: '999px',
      background: `${accent}12`, border: `1px solid ${accent}28`,
      color: accent, fontSize: '11px', fontWeight: 600,
    }}>
      <CheckCircle2 size={9} strokeWidth={3} />
      {label}
    </span>
  );
}

// ── Infra card ────────────────────────────────────────────────────────────────
function InfraCard({ infra }) {
  const [hov, setHov] = useState(false);
  const { icon: Icon, label, tagline, desc, accent, badge, badgeBg, badgeBorder, engines, cta, to, featured } = infra;
  const available = !!to;

  return (
    <div style={{
      background: hov && available ? '#1c2128' : C.panel,
      border: `1px solid ${featured ? accent + '44' : (hov && available ? C.border2 : C.border)}`,
      borderTop: featured ? `3px solid ${accent}` : `1px solid ${featured ? accent + '44' : C.border}`,
      borderRadius: '12px',
      padding: '28px',
      transition: 'all 0.2s ease',
      display: 'flex', flexDirection: 'column', gap: '20px',
      position: 'relative', overflow: 'hidden',
      boxShadow: featured && hov ? `0 0 40px ${accent}18` : 'none',
    }}
    onMouseEnter={() => setHov(true)}
    onMouseLeave={() => setHov(false)}
    >
      {featured && (
        <div style={{
          position: 'absolute', top: 16, right: 16,
          padding: '3px 10px', borderRadius: '999px',
          background: `${accent}20`, border: `1px solid ${accent}44`,
          color: accent, fontSize: '11px', fontWeight: 700,
        }}>
          Recommandé
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '10px', flexShrink: 0,
          background: `${accent}18`, border: `1px solid ${accent}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={24} color={accent} strokeWidth={1.7} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{ color: C.text, fontSize: '18px', fontWeight: 800 }}>{label}</span>
            <span style={{
              padding: '2px 8px', borderRadius: '999px',
              background: badgeBg, border: `1px solid ${badgeBorder}`,
              color: accent, fontSize: '11px', fontWeight: 700,
            }}>{badge}</span>
          </div>
          <div style={{ color: C.muted, fontSize: '13px' }}>{tagline}</div>
        </div>
      </div>

      {/* Description */}
      <p style={{ color: C.muted, fontSize: '13px', lineHeight: 1.65, margin: 0 }}>{desc}</p>

      {/* Engines */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {engines.map(e => <EngineChip key={e} label={e} accent={accent} />)}
      </div>

      {/* CTA */}
      {to ? (
        <Link to={to} style={{ textDecoration: 'none', marginTop: 'auto' }}>
          <button style={{
            width: '100%', padding: '12px 20px',
            background: featured ? accent : (hov ? `${accent}20` : `${accent}12`),
            border: `1px solid ${accent}${featured ? '' : '44'}`,
            borderRadius: '8px',
            color: featured ? '#fff' : accent,
            fontSize: '14px', fontWeight: 700,
            cursor: 'pointer', transition: 'all 0.18s ease',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}>
            {cta}
            <ArrowRight size={16} />
          </button>
        </Link>
      ) : (
        <button disabled style={{
          width: '100%', padding: '12px 20px', marginTop: 'auto',
          background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
          borderRadius: '8px', color: C.muted2, fontSize: '14px', fontWeight: 600,
          cursor: 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}>
          <Lock size={14} />
          {cta}
        </button>
      )}
    </div>
  );
}

// ── Trust signals ──────────────────────────────────────────────────────────────
const TRUST = [
  { icon: Shield,  label: 'Données hébergées en Afrique',     color: C.green },
  { icon: Zap,     label: 'Infrastructure prête en 3 minutes', color: C.violet },
  { icon: Globe,   label: 'Multi-tenant · multi-marque',        color: C.blue },
  { icon: CheckCircle2, label: 'RGPD & conformité locale',    color: C.orange },
];

// ── Main page ──────────────────────────────────────────────────────────────────
export default function CimolaceLaunchPage() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <CimolaceHeader />

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px 64px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 16px', borderRadius: '999px',
            background: `${C.violet}12`, border: `1px solid ${C.violet}30`,
            color: C.violetLt, fontSize: '12px', fontWeight: 700,
            marginBottom: '24px', letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            <Zap size={12} strokeWidth={2.5} />
            Infrastructure prête à l'emploi
          </div>
          <h1 style={{
            color: C.text, fontSize: 'clamp(28px, 5vw, 48px)',
            fontWeight: 900, lineHeight: 1.15, marginBottom: '16px',
          }}>
            Choisissez votre infrastructure
          </h1>
          <p style={{ color: C.muted, fontSize: '16px', lineHeight: 1.7, maxWidth: '560px', margin: '0 auto 16px' }}>
            Chaque infrastructure est un tenant complet, multi-marque, avec tous ses moteurs activés.
            Déployez en 3 minutes depuis le modèle ISNA Prorascience.
          </p>
          <Link to="/cimolace/login" style={{ color: C.violetLt, fontSize: '13px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            Déjà client ? Connectez-vous <ArrowRight size={13} />
          </Link>
        </div>

        {/* Cards grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '20px',
          marginBottom: '64px',
        }}>
          {INFRA.map(infra => <InfraCard key={infra.key} infra={infra} />)}
        </div>

        {/* Trust signals */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '24px', justifyContent: 'center',
          padding: '32px 24px',
          background: C.panel, border: `1px solid ${C.border}`,
          borderRadius: '12px',
        }}>
          {TRUST.map(({ icon: Icon, label, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon size={16} color={color} strokeWidth={2} />
              <span style={{ color: C.muted, fontSize: '13px', fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>

      </main>

      <CimolaceFooter />
    </div>
  );
}
