import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
  LayoutDashboard, BookOpen, HeartHandshake as Handshake, Calendar, Library, CreditCard,
  Building2, Users, Settings, Bell, HelpCircle, Users as UsersIcon, Award, PieChart,
  Database, Users2, Sparkles, Link2, Megaphone, Flame, Star, ExternalLink, MessageCircle, Tags,
} from 'lucide-react';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';
import { useResolvedTenantSlug } from '@/hooks/useResolvedTenantSlug';
import LiriDashboardShell from '@/components/shell/LiriDashboardShell';

// Accent owner = violet LIRI (le secrétariat garde l'or).
const OWNER_ACCENT = { color: '#7C3AED', dim: 'rgba(124,58,237,0.12)', mid: 'rgba(124,58,237,0.28)' };

const OwnerDashboardLayout = ({ children, activeTab, onTabChange }) => {
  const { user, logout, loading: isLoading } = useAuth();
  const navigate = useNavigate();
  const { slug: payoutTenantSlug } = useResolvedTenantSlug();

  // 24 entrées regroupées en 6 familles (chunking) — chaque id/href est inchangé.
  const menuGroups = useMemo(
    () => [
      {
        section: 'Pilotage',
        items: [
          // Label descriptif (aligné sur le secrétariat « Gestion élèves ») au lieu
          // du générique « Dashboard » : évite une topbar redondante « Dashboard ».
          { id: 'dashboard', icon: LayoutDashboard, label: "Vue d'ensemble" },
          { id: 'reports', icon: PieChart, label: 'Rapports' },
          { id: 'notifications', icon: Bell, label: 'Notifications' },
        ],
      },
      {
        section: 'Pédagogie',
        items: [
          { id: 'formations', icon: BookOpen, label: 'Formations' },
          { id: 'school-life', icon: Calendar, label: 'Vie Scolaire' },
          { id: 'coaching-mentoring', icon: Handshake, label: 'Coaching & Mentorat' },
          { id: 'workshops', icon: UsersIcon, label: 'Ateliers' },
          { id: 'ngowazulu-mentorat', icon: Flame, label: 'Ngowazulu Ateliers' },
          { id: 'certificates', icon: Award, label: 'Certificats' },
        ],
      },
      {
        section: 'Contenu & communauté',
        items: [
          { id: 'resources', icon: Library, label: 'Ressources' },
          { id: 'forum', icon: MessageCircle, label: 'Forum communauté' },
          { id: 'reviews', icon: Star, label: 'Avis & Témoignages' },
          { id: 'support', icon: HelpCircle, label: 'Support' },
        ],
      },
      {
        section: 'Finances',
        items: [
          { id: 'catalog', icon: Tags, label: 'Catalogue & tarifs' },
          { id: 'payments', icon: CreditCard, label: 'Paiements' },
          { id: 'tenant-encaissement', icon: ExternalLink, label: 'Encaissement (URL tenant)', href: `/t/${payoutTenantSlug}/admin/settings` },
          { id: 'chariow-externes', icon: Link2, label: 'Chariow Externes', href: '/admin/billing?tab=external' },
        ],
      },
      {
        section: 'Croissance',
        items: [
          { id: 'studio-creator', icon: Sparkles, label: 'Studio Créateur', href: '/studio' },
          { id: 'marketing-automation', icon: Megaphone, label: 'Marketing Automation', href: '/admin/marketing?tab=automation' },
          { id: 'ngowazulu-operations', icon: Flame, label: 'Ngowazulu Opérations' },
          { id: 'knowledge-base', icon: Database, label: 'Base de connaissances', href: '/owner-dashboard/knowledge-base' },
        ],
      },
      {
        section: 'Administration',
        items: [
          { id: 'school-info', icon: Building2, label: 'École' },
          { id: 'team', icon: Users2, label: 'Équipe' },
          { id: 'users', icon: Users, label: 'Utilisateurs' },
          { id: 'settings', icon: Settings, label: 'Paramètres' },
        ],
      },
    ],
    [payoutTenantSlug],
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
      accent={OWNER_ACCENT}
      brandTitle="PRORASCIENCE"
      brandSubtitle="ADMIN"
      user={user}
      onLogout={handleLogout}
      title={allItems.find((i) => i.id === activeTab)?.label}
      topbarRight={<NotificationDropdown />}
      lightContent
    >
      {children}
    </LiriDashboardShell>
  );
};

export default OwnerDashboardLayout;
