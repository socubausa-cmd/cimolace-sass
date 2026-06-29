import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';
import { buildOwnerMenuGroups } from '@/components/owner/ownerMenuGroups';
import { useResolvedTenantSlug } from '@/hooks/useResolvedTenantSlug';
import LiriDashboardShell from '@/components/shell/LiriDashboardShell';
import { useTenantBranding } from '@/hooks/useTenantBranding';

// Accent owner = violet LIRI (le secrétariat garde l'or).
const OWNER_ACCENT = { color: '#7C3AED', dim: 'rgba(124,58,237,0.12)', mid: 'rgba(124,58,237,0.28)' };

const OwnerDashboardLayout = ({ children, activeTab, onTabChange }) => {
  const { user, logout, loading: isLoading } = useAuth();
  const navigate = useNavigate();
  const { slug: payoutTenantSlug } = useResolvedTenantSlug();
  const { branding } = useTenantBranding();

  // 24 entrées regroupées en 6 familles — SOURCE UNIQUE (réutilisée par le portail LIRI).
  const menuGroups = useMemo(() => buildOwnerMenuGroups(payoutTenantSlug), [payoutTenantSlug]);

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
      autoCollapse={false}
      brandTitle={branding?.name || 'LIRI'}
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
