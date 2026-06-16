/**
 * DEV — démo screenshotable du LiriDashboardShell (sans login admin).
 * Route : /dev/liri-admin-shell
 */
import React, { useState } from 'react';
import LiriDashboardShell from '@/components/shell/LiriDashboardShell';
import {
  LayoutDashboard, PieChart, Bell, BookOpen, Calendar, HeartHandshake as Handshake,
  Users as UsersIcon, Flame, Award, Library, MessageCircle, Star, HelpCircle, CreditCard,
  ExternalLink, Link2, Sparkles, Megaphone, Database, Building2, Users2, Users, Settings,
} from 'lucide-react';

const ACCENT = {
  violet: { color: '#7C3AED', dim: 'rgba(124,58,237,0.12)', mid: 'rgba(124,58,237,0.28)' },
  gold: { color: 'var(--school-accent)', dim: 'rgba(212,175,55,0.12)', mid: 'rgba(212,175,55,0.28)' },
};

const GROUPS = [
  { section: 'Pilotage', items: [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'reports', icon: PieChart, label: 'Rapports' },
    { id: 'notifications', icon: Bell, label: 'Notifications' },
  ] },
  { section: 'Pédagogie', items: [
    { id: 'formations', icon: BookOpen, label: 'Formations' },
    { id: 'school-life', icon: Calendar, label: 'Vie Scolaire' },
    { id: 'coaching', icon: Handshake, label: 'Coaching & Mentorat' },
    { id: 'workshops', icon: UsersIcon, label: 'Ateliers' },
    { id: 'ngowazulu', icon: Flame, label: 'Ngowazulu Ateliers' },
    { id: 'certificates', icon: Award, label: 'Certificats' },
  ] },
  { section: 'Contenu & communauté', items: [
    { id: 'resources', icon: Library, label: 'Ressources' },
    { id: 'forum', icon: MessageCircle, label: 'Forum communauté' },
    { id: 'reviews', icon: Star, label: 'Avis & Témoignages' },
    { id: 'support', icon: HelpCircle, label: 'Support' },
  ] },
  { section: 'Finances', items: [
    { id: 'payments', icon: CreditCard, label: 'Paiements' },
    { id: 'encaissement', icon: ExternalLink, label: 'Encaissement' },
    { id: 'chariow', icon: Link2, label: 'Chariow Externes' },
  ] },
  { section: 'Croissance', items: [
    { id: 'studio', icon: Sparkles, label: 'Studio Créateur' },
    { id: 'marketing', icon: Megaphone, label: 'Marketing Automation' },
    { id: 'kb', icon: Database, label: 'Base de connaissances' },
  ] },
  { section: 'Administration', items: [
    { id: 'school-info', icon: Building2, label: 'École' },
    { id: 'team', icon: Users2, label: 'Équipe' },
    { id: 'users', icon: Users, label: 'Utilisateurs' },
    { id: 'settings', icon: Settings, label: 'Paramètres' },
  ] },
];

const card = { background: '#192734', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '18px 20px' };

function Metric({ label, value, delta }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 12, color: 'rgba(245,245,247,0.55)', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#F5F5F7' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#5DCAA5', marginTop: 6 }}>{delta}</div>
    </div>
  );
}

export default function LiriAdminShellDemo() {
  const [tab, setTab] = useState('dashboard');
  const [gold, setGold] = useState(false);
  const accent = gold ? ACCENT.gold : ACCENT.violet;
  const label = GROUPS.flatMap((g) => g.items).find((i) => i.id === tab)?.label || 'Dashboard';

  return (
    <LiriDashboardShell
      navGroups={GROUPS}
      activeTab={tab}
      onTabChange={setTab}
      accent={accent}
      brandTitle="PRORASCIENCE"
      brandSubtitle={gold ? 'SECRÉTARIAT' : 'ADMIN'}
      user={{ name: 'Ngowazulu', email: 'owner@prorascience.org' }}
      onLogout={() => {}}
      title={label}
      topbarRight={(
        <button type="button" onClick={() => setGold((g) => !g)}
          style={{ background: '#192734', border: '1px solid rgba(255,255,255,0.12)', color: '#F5F5F7', borderRadius: 9, padding: '7px 12px', fontSize: 12.5, cursor: 'pointer' }}>
          Accent : {gold ? 'or (secrétariat)' : 'violet (owner)'}
        </button>
      )}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 18 }}>
        <Metric label="Élèves actifs" value="128" delta="+12 ce mois" />
        <Metric label="Revenus (mois)" value="4 250 €" delta="+8,4 %" />
        <Metric label="Lives à venir" value="6" delta="cette semaine" />
        <Metric label="Taux de présence" value="92 %" delta="+3 pts" />
      </div>
      <div style={{ ...card, padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#F5F5F7', marginBottom: 4 }}>Aperçu — {label}</div>
        <div style={{ fontSize: 13, color: 'rgba(245,245,247,0.55)', lineHeight: 1.6 }}>
          Démo du shell au langage du back-office élève : sidebar flottante en verre, repli en mode
          icônes via le bouton tiroir, item actif accentué, cartes <code style={{ color: accent.color }}>#192734</code>.
          Toute surface admin (owner / secrétariat / pages internes) hérite de ce shell.
        </div>
      </div>
    </LiriDashboardShell>
  );
}
