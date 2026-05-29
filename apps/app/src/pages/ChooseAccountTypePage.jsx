import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import {
  hasMultiRoleAccess,
  setSelectedAccountRole,
  getSelectedAccountRole,
  listAvailableAccountRoles,
} from '@/lib/accountRoleMode';
import { CHOOSE_ACCOUNT_ROLE_OPTIONS, ChooseAccountRoleRow } from '@/lib/chooseAccountTypeShared';
import { getChooseAccountTypePath } from '@/lib/chooseAccountTypePath';
import { resolveDashboardPath } from '@/lib/dashboardRoute';

const ChooseAccountTypePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const selectedRole = getSelectedAccountRole();
  const [focusedIndex, setFocusedIndex] = useState(0);

  const nativePath = getChooseAccountTypePath();

  useEffect(() => {
    if (location.pathname !== '/choose-account-type') return;
    if (nativePath === '/choose-account-type') return;
    navigate(nativePath, { replace: true });
  }, [location.pathname, nativePath, navigate]);

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      const n = visibleRoles.length;
      if (n === 0) return;
      if (e.key === 'ArrowLeft') {
        setFocusedIndex((i) => (i > 0 ? i - 1 : n - 1));
      } else if (e.key === 'ArrowRight') {
        setFocusedIndex((i) => (i < n - 1 ? i + 1 : 0));
      } else if (e.key === 'Enter') {
        const i = Math.min(focusedIndex, Math.max(0, n - 1));
        const opt = visibleRoles[i];
        if (opt) chooseRole(opt.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, chooseRole, visibleRoles]);

  if (location.pathname === '/choose-account-type' && nativePath !== '/choose-account-type') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#0B0B0F] text-white">
        <div className="flex flex-col items-center gap-3 text-white/60">
          <LiriWordmark size="compact" className="text-[#D4AF37]/90" />
          <p className="text-[12px]">Ouverture du choix de compte…</p>
        </div>
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

  const CurrentDetailIcon = currentOption.icon;

  return (
    <div className="min-h-screen overflow-hidden bg-[#0F1419] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-1/4 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-[#D4AF37]/5 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-[300px] w-[300px] rounded-full bg-indigo-500/5 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 py-12 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2"
          >
            <Sparkles className="h-4 w-4 text-[#D4AF37]" />
            <span className="text-sm text-gray-400">Multi-rôles</span>
          </motion.div>
          <h1 className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text font-serif text-3xl font-bold text-transparent md:text-5xl">
            Choisir le type de compte
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-400">
            Glissez ou cliquez pour basculer entre vos espaces. Chaque rôle ouvre un tableau de bord dédié.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="relative mb-12"
        >
          <div className="flex flex-wrap justify-center gap-2 rounded-2xl border border-white/5 bg-[#151a21]/80 p-2 backdrop-blur-xl md:gap-3">
            {visibleRoles.map((option, index) => {
              const Icon = option.icon;
              const isFocused = safeIndex === index;

              return (
                <motion.button
                  key={option.id}
                  type="button"
                  onClick={() => setFocusedIndex(index)}
                  className="relative flex min-w-[140px] items-center gap-3 rounded-xl px-5 py-3.5 text-left transition-colors md:min-w-[160px]"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isFocused ? (
                    <motion.div
                      layoutId="role-pill-bg"
                      className="absolute inset-0 rounded-xl border border-[#D4AF37]/30 bg-gradient-to-r from-[#D4AF37]/20 to-[#D4AF37]/5"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  ) : null}
                  <motion.div
                    className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-lg ${
                      isFocused ? 'bg-[#D4AF37] text-black' : 'bg-white/5 text-gray-400'
                    }`}
                    animate={{
                      scale: isFocused ? 1.05 : 1,
                      boxShadow: isFocused ? '0 0 20px rgba(212,175,55,0.3)' : '0 0 0 transparent',
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    <Icon className="h-5 w-5" />
                  </motion.div>
                  <div className="relative z-10 min-w-0 flex-1">
                    <span
                      className={`block truncate font-semibold ${isFocused ? 'text-white' : 'text-gray-400'}`}
                    >
                      {option.title}
                    </span>
                    <span className="block truncate text-xs text-gray-500">{option.badge}</span>
                  </div>
                  {isFocused ? (
                    <motion.div
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="relative z-10 text-[#D4AF37]"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </motion.div>
                  ) : null}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={safeIndex}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${currentOption.gradient}`}
          >
            <div className="absolute inset-0 bg-[#151a21]/90 backdrop-blur-sm" />
            <div className="relative p-8 md:p-10">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex-1">
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-4 flex items-center gap-3"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#D4AF37]/20">
                      <CurrentDetailIcon className="h-7 w-7 text-[#D4AF37]" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">{currentOption.title}</h2>
                      <span className="text-sm font-medium text-[#D4AF37]">{currentOption.badge}</span>
                    </div>
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    className="text-lg leading-relaxed text-gray-400"
                  >
                    {currentOption.description}
                  </motion.p>
                </div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="shrink-0"
                >
                  <Button
                    size="lg"
                    className="group bg-[#D4AF37] px-8 py-6 text-base font-bold text-black shadow-lg shadow-[#D4AF37]/20 transition-all hover:bg-[#bfa345] hover:shadow-[#D4AF37]/30"
                    onClick={() => chooseRole(currentOption.id)}
                  >
                    Ouvrir ce tableau de bord
                    <ChevronRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-6 text-center text-sm text-gray-500"
        >
          <kbd className="rounded bg-white/5 px-2 py-1 text-gray-400">←</kbd>{' '}
          <kbd className="rounded bg-white/5 px-2 py-1 text-gray-400">→</kbd> pour naviguer ·{' '}
          <kbd className="rounded bg-white/5 px-2 py-1 text-gray-400">Entrée</kbd> pour ouvrir
        </motion.p>
      </div>
    </div>
  );
};

export default ChooseAccountTypePage;
