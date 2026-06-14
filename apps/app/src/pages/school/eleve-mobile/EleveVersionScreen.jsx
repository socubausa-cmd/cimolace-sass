import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/school/eleve-mobile/connection/EleveConnectionLayout';
import { AppVersionContent } from '@/components/version/AppVersionContent';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { EV_BG, EV_MUTED, EV_LINE } from '@/pages/school/eleve-mobile/eleveMobileScreensShared';

const PAGE_AMBIENT =
  'radial-gradient(50% 32% at 50% 0%, rgba(123, 97, 255, 0.14), transparent 70%)';

/**
 * Même contenu informatif que {@link VersionPage} (`/version`), en coque LIRI élève.
 * Route : `/m/eleve/version`
 */
export default function EleveVersionScreen() {
  const { user } = useAuth();

  useEffect(() => {
    const prev = typeof document !== 'undefined' ? document.title : '';
    if (typeof document !== 'undefined') {
      document.title = 'Version · LIRI';
    }
    return () => {
      if (typeof document !== 'undefined' && prev) document.title = prev;
    };
  }, []);

  return (
    <EleveMobileShell user={user} hideHeader contentClassName="!px-0">
      <div
        className="flex w-full flex-1 flex-col"
        style={{
          minHeight: '100dvh',
          backgroundColor: EV_BG,
          backgroundImage: PAGE_AMBIENT,
        }}
      >
        <div className="px-4 pt-[max(0.35rem,env(safe-area-inset-top))]">
          <LiriStatusBar />
        </div>

        <div className="px-4 pb-2 pt-0.5">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Système</p>
              <h1 className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-white">
                Version
              </h1>
              <p className="mt-1 text-[13px] font-medium" style={{ color: EV_MUTED }}>
                Build & environnement
              </p>
            </div>
            <Link
              to={ELEVE_MOBILE.profil}
              className="mt-1 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium text-violet-300/90"
              style={{ borderColor: EV_LINE, background: 'rgba(255,255,255,0.05)' }}
            >
              Profil
            </Link>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto w-full max-w-md flex-1 pb-4">
            <AppVersionContent variant="eleve" />
          </div>
          <p className="text-center text-[12px]" style={{ color: EV_MUTED }}>
            <Link to={ELEVE_MOBILE.home} className="text-violet-300/90">
              Accueil LIRI
            </Link>
          </p>
        </div>
      </div>
    </EleveMobileShell>
  );
}
