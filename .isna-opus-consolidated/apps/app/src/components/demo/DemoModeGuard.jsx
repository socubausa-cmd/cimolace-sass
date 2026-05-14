import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDemoMode } from '@/contexts/DemoModeContext';
import DemoBadge from './DemoBadge';

const DemoModeGuard = ({ children }) => {
  const { user } = useAuth();
  const isAuthenticated = Boolean(user);
  const { isDemoMode, toggleDemoMode } = useDemoMode();
  const location = useLocation();

  useEffect(() => {
    // If user is accessing student area and NOT authenticated, ensure demo mode logic applies
    // The Context already handles initial state, but this guard reinforces route-specific behavior
    if (!isAuthenticated && location.pathname.startsWith('/student-school-life')) {
      // If demo mode was explicitly turned off by user previously, they might see empty/login state
      // But typically we want to encourage demo or login.
      // Context logic handles "if not exited, auto-enable".
    }
  }, [isAuthenticated, location.pathname]);

  // If authenticated, we just render children (User sees real data)
  // If NOT authenticated, we render children BUT the components inside must respect isDemoMode
  // This Guard wrapper mainly injects the Badge and ensures the provider is available up-tree.

  return (
    <>
      <DemoBadge />
      {children}
    </>
  );
};

export default DemoModeGuard;