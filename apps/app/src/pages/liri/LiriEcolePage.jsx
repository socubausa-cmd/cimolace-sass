/**
 * LiriEcolePage — Module ÉCOLE HORIZONTAL dans le portail LIRI (`/liri/ecole`).
 *
 * « École façon Zoom-app » : un tenant LIRI (créateur / coach SANS site vertical
 * comme ISNA) active l'école DANS le portail LIRI pour vendre ses lives et gérer
 * formations / calendrier / élèves — sans vitrine `/t/:slug`.
 *
 * HORIZONTAL ≠ VERTICAL : le vertical (ISNA) reste un site complet sous `/t/:slug`
 * (infrastructure_type=school). Ici on réutilise le MÊME back-office école, mais
 * monté DANS le portail LIRI, pour un tenant sans site.
 *
 * RÉUTILISE le back-office école existant (tenant-agnostique : scope via JWT/RLS) :
 *   - Aperçu     → SecretariatOverview          (secrétariat-lite : synthèse)
 *   - Formations → OwnerFormationsTab           (création + liste de formations)
 *   - Calendrier → CalendarSection              (calendrier de formation)
 *   - Élèves     → SecretariatStudentDashboard  (gestion élèves)
 *
 * Activation fine par tenant (tenant_services `service_key='school_module'`) =
 * à brancher ensuite ; en attendant la route est gardée par ProtectedLiriRoute.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Calendar, Users } from 'lucide-react';
import LiriDashboardShell from '@/components/shell/LiriDashboardShell';
import OwnerFormationsTab from '@/components/owner/OwnerFormationsTab';
import { CalendarSection } from '@/components/school/school-life/CalendarComponents';
import SecretariatStudentDashboard from '@/components/secretariat/SecretariatStudentDashboard';
// NB: l'onglet « Aperçu » (SecretariatOverview) plante au rendu (recharts conteneur
// 0-size) → retiré pour l'instant ; à rebrancher après fix du sizing du graphique.
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { SslThemeProvider } from '@/pages/school/student-school-life/sslTheme';
import ErrorBoundary from '@/components/ErrorBoundary';

const SCHOOL_ACCENT = {
  color: 'var(--school-accent, #D4AF37)',
  dim: 'rgba(212,175,55,0.12)',
  mid: 'rgba(212,175,55,0.28)',
};

const NAV_GROUPS = [
  {
    section: 'École',
    items: [
      { id: 'formations', label: 'Formations', icon: BookOpen },
      { id: 'calendrier', label: 'Calendrier', icon: Calendar },
      { id: 'eleves', label: 'Élèves', icon: Users },
    ],
  },
];
const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export default function LiriEcolePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  // Défaut = Formations (le cœur : « créer/vendre des formations », composant éprouvé).
  const [activeTab, setActiveTab] = useState('formations');

  const handleLogout = async () => {
    try { await logout?.(); } finally { navigate('/login'); }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'calendrier': return <CalendarSection />;
      case 'eleves': return <SecretariatStudentDashboard />;
      case 'formations':
      default: return <OwnerFormationsTab />;
    }
  };

  return (
    <LiriDashboardShell
      navGroups={NAV_GROUPS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onNavigate={navigate}
      accent={SCHOOL_ACCENT}
      brandTitle="LIRI"
      brandSubtitle="ÉCOLE"
      user={user}
      onLogout={handleLogout}
      title={ALL_ITEMS.find((i) => i.id === activeTab)?.label || 'École'}
      lightContent
    >
      {/* Un onglet qui plante (composant réutilisé) ne doit PAS blanchir tout le
          module : ErrorBoundary PAR onglet → le shell + la nav restent visibles,
          seul l'onglet fautif montre un repli. Les surfaces réutilisées lisent les
          tokens sslTheme → thème clair (comme SecretariatDashboard). */}
      <ErrorBoundary key={activeTab} logTag={`LIRI École · ${activeTab}`}>
        <SslThemeProvider mode="light">
          {renderContent()}
        </SslThemeProvider>
      </ErrorBoundary>
    </LiriDashboardShell>
  );
}
