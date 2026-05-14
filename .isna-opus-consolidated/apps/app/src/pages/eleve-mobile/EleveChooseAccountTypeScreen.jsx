import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { motion } from 'framer-motion';
import { Sparkles, ChevronRight } from 'lucide-react';
import { LiriPageFooterLine, LiriWordmark } from '@/components/brand/LiriWordmark';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import {
  hasMultiRoleAccess,
  setSelectedAccountRole,
  getSelectedAccountRole,
  listAvailableAccountRoles,
} from '@/lib/accountRoleMode';
import { CHOOSE_ACCOUNT_ROLE_OPTIONS, ChooseAccountRoleRow } from '@/lib/chooseAccountTypeShared';
import { resolveDashboardPath } from '@/lib/dashboardRoute';
import { LiriStatusBar } from '@/pages/eleve-mobile/connection/EleveConnectionLayout';
import { EV_MUTED, EV_PAGE_AMBIENT } from '@/pages/eleve-mobile/eleveMobileScreensShared';

/**
 * Multi-rôles — version coque LIRI (Capacitor / mobile).
 * Route : `/m/eleve/choisir-compte`
 */
export default function EleveChooseAccountTypeScreen() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const selectedRole = getSelectedAccountRole();
  const [focusedIndex, setFocusedIndex] = useState(0);

  const shouldStayOnNative = useMemo(() => {
    if (typeof window === 'undefined') return true;
    return (
      Capacitor.isNativePlatform() ||
      (window.matchMedia?.('(max-width: 767px)').matches ?? window.innerWidth < 768)
    );
  }, []);

  useEffect(() => {
    if (shouldStayOnNative) return;
    navigate('/choose-account-type', { replace: true });
  }, [shouldStayOnNative, navigate]);

  const visibleRoles = useMemo(() => {
    if (!user) return CHOOSE_ACCOUNT_ROLE_OPTIONS;
    const ids = listAvailableAccountRoles(user);
    if (!ids.length) return CHOOSE_ACCOUNT_ROLE_OPTIONS;
    return CHOOSE_ACCOUNT_ROLE_OPTIONS.filter((o) => ids.includes(o.id));
  }, [user]);

  useEffect(() => {
    const idx = visibleRoles.findIndex((r) => r.id === selectedRole);
    if (idx >= 0) setFocusedIndex(idx);
  }, [selectedRole, visibleRoles]);

  useEffect(() => {
    if (focusedIndex >= visibleRoles.length) {
      setFocusedIndex(0);
    }
  }, [visibleRoles.length, focusedIndex]);

  const chooseRole = useCallback(
    (role) => {
      if (!user) return;
      setSelectedAccountRole(role);
      navigate(resolveDashboardPath({ ...user, role }), { replace: true });
    },
    [user, navigate],
  );

  const safeIndex = Math.min(focusedIndex, Math.max(0, visibleRoles.length - 1));
  const currentOption = visibleRoles[safeIndex];

  const mobilePrimary = visibleRoles.slice(0, 3);
  const mobileSecondary = visibleRoles.slice(3);

  const setFocusById = (id) => {
    const idx = visibleRoles.findIndex((r) => r.id === id);
    if (idx >= 0) setFocusedIndex(idx);
  };

  if (!shouldStayOnNative) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#0B0B0F] text-white/50">
        <p className="text-[12px]">Redirection…</p>
      </div>
    );
  }

  if (!loading && !user) {
    return <Navigate to="/login" replace />;
  }

  if (!loading && user && !hasMultiRoleAccess(user)) {
    return <Navigate to={resolveDashboardPath(user)} replace />;
  }

  if (!currentOption) {
    return null;
  }

  return (
    <EleveMobileShell user={user} notificationCount={0} hideHeader hideTabBar contentClassName="!px-0">
      <div
        className="relative flex w-full flex-1 flex-col"
        style={{
          minHeight: '100dvh',
          backgroundColor: '#0B0B0F',
          backgroundImage: EV_PAGE_AMBIENT,
        }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/4 h-[320px] w-[500px] -translate-x-1/2 rounded-full bg-[#D4AF37]/5 blur-[100px]" />
        </div>

        <div className="px-4 pt-[max(0.35rem,env(safe-area-inset-top))]">
          <LiriStatusBar />
        </div>

        <div className="relative px-4 pb-2 pt-0.5">
          <div className="mb-1 flex min-w-0 flex-wrap items-end justify-between gap-x-3 gap-y-1">
            <LiriWordmark size="kicker" className="shrink-0 text-white/40" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Espaces</span>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 text-center"
          >
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
              <span className="text-[11px] text-white/55">Multi-rôles</span>
            </div>
            <h1 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-white">
              Choisir le type de compte
            </h1>
            <p className="mt-2 text-[13px] font-medium" style={{ color: EV_MUTED }}>
              Touchez un rôle pour le sélectionner, puis ouvrez son tableau de bord.
            </p>
          </motion.div>

          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto">
            {mobilePrimary.map((option) => (
              <ChooseAccountRoleRow
                key={option.id}
                option={option}
                isSelected={visibleRoles[safeIndex]?.id === option.id}
                onSelect={setFocusById}
              />
            ))}

            {mobileSecondary.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                {mobileSecondary.map((option) => (
                  <ChooseAccountRoleRow
                    key={option.id}
                    option={option}
                    compact
                    isSelected={visibleRoles[safeIndex]?.id === option.id}
                    onSelect={setFocusById}
                  />
                ))}
              </div>
            ) : null}

            <p className="pt-2 text-center text-[12px] leading-relaxed" style={{ color: EV_MUTED }}>
              {currentOption.description}
            </p>

            <LiriPageFooterLine marginClass="mt-4" suffix="Multi-rôles" />
          </div>
        </div>

        <div
          className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/[0.07] bg-[#0B0B0F]/95 px-4 pt-3 backdrop-blur-md"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <Button
            type="button"
            className="h-12 w-full bg-[#D4AF37] font-bold text-black hover:bg-[#bfa345]"
            onClick={() => chooseRole(currentOption.id)}
          >
            Ouvrir ce tableau de bord
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </EleveMobileShell>
  );
}
