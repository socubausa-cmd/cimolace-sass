import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
  LayoutDashboard, BookOpen, HeartHandshake as Handshake, Calendar, CalendarClock, Bell,
  HelpCircle, Users as UsersIcon, Award, PieChart, Inbox, FileCheck, FileText, GraduationCap,
  Library, Video, Megaphone, CreditCard, Flame, Star, MessageCircle,
} from 'lucide-react';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';
import LiriDashboardShell from '@/components/shell/LiriDashboardShell';

// Accent secrétariat = OR (identité distincte conservée). Owner = violet.
const SECRETARIAT_ACCENT = { color: 'var(--school-accent)', dim: 'rgba(212,175,55,0.12)', mid: 'rgba(212,175,55,0.28)' };

const SecretariatDashboardLayout = ({ children, activeTab, onTabChange }) => {
  const { user, logout, loading: isLoading } = useAuth();
  const navigate = useNavigate();

  // 27 entrées regroupées en 6 familles (métier secrétariat) — chaque id/href inchangé.
  const menuGroups = useMemo(
    () => [
      {
        section: 'Élèves & rendez-vous',
        items: [
          { id: 'dashboard', icon: LayoutDashboard, label: 'Gestion élèves' },
          { id: 'rendez-vous', icon: CalendarClock, label: 'Rendez-vous actifs' },
          { id: 'calendrier', icon: Calendar, label: 'Calendrier rendez-vous' },
          { id: 'messagerie', icon: Inbox, label: 'Messagerie' },
        ],
      },
      {
        section: 'Pilotage',
        items: [
          { id: 'apercu', icon: PieChart, label: 'Aperçu général' },
          { id: 'reports', icon: FileCheck, label: 'Rapports' },
          { id: 'notifications', icon: Bell, label: 'Notifications' },
        ],
      },
      {
        section: 'Pédagogie',
        items: [
          { id: 'formations', icon: BookOpen, label: 'Formations' },
          { id: 'school-life', icon: Calendar, label: 'Vie Scolaire' },
          { id: 'courses', icon: Library, label: 'Catalogue des cours' },
          { id: 'coaching-mentoring', icon: Handshake, label: 'Coaching & Mentorat' },
          { id: 'workshops', icon: UsersIcon, label: 'Ateliers' },
          { id: '_sessions-live', icon: Video, label: 'Sessions Live', href: '/teacher-space/agenda' },
          { id: 'certificates', icon: Award, label: 'Certificats' },
        ],
      },
      {
        section: 'Cycles & équipe',
        items: [
          { id: 'cycles-disciple', icon: GraduationCap, label: 'Cycle Disciple' },
          { id: 'cycles-initie', icon: GraduationCap, label: 'Cycle Initié' },
          { id: 'cycles-maitre', icon: GraduationCap, label: 'Cycle Maître' },
          { id: 'teachers', icon: GraduationCap, label: 'Équipe pédagogique' },
        ],
      },
      {
        section: 'Communauté & croissance',
        items: [
          { id: 'forum', icon: MessageCircle, label: 'Communication' },
          { id: 'reviews', icon: Star, label: 'Avis & Témoignages' },
          { id: 'marketing', icon: Megaphone, label: 'Marketing' },
          { id: 'ngowazulu-mentorat', icon: Flame, label: 'Ngowazulu Ateliers' },
          { id: 'ngowazulu-operations', icon: Flame, label: 'Ngowazulu Opérations' },
        ],
      },
      {
        section: 'Finances & admin',
        items: [
          { id: 'paiements', icon: CreditCard, label: 'Paiements' },
          { id: 'document-admin', icon: FileText, label: 'Documents admin (A4)' },
          { id: 'how-it-works', icon: FileCheck, label: 'Fonctionnement' },
          { id: 'support', icon: HelpCircle, label: 'Support' },
        ],
      },
    ],
    [],
  );

  const allItems = useMemo(() => menuGroups.flatMap((g) => g.items), [menuGroups]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100dvh', background: '#0B0B0F', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ width: '100%', maxWidth: 760, height: 180, borderRadius: 18, background: 'rgba(255,255,255,0.05)', animation: 'pulse 1.4s ease-in-out infinite' }} />
        <style>{`@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}`}</style>
      </div>
    );
  }

  return (
    <LiriDashboardShell
      navGroups={menuGroups}
      activeTab={activeTab}
      onTabChange={onTabChange}
      onNavigate={navigate}
      accent={SECRETARIAT_ACCENT}
      autoCollapse={false}
      lightContent
      brandTitle="PRORASCIENCE"
      brandSubtitle="SECRÉTARIAT"
      user={user}
      onLogout={handleLogout}
      title={allItems.find((i) => i.id === activeTab)?.label}
      topbarRight={<NotificationDropdown />}
    >
      {children}
    </LiriDashboardShell>
  );
};

export default SecretariatDashboardLayout;
