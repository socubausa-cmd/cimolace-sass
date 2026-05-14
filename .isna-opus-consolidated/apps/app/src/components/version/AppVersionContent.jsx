import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { getAppBuildInfo } from '@/lib/appBuildInfo';
import { cn } from '@/lib/utils';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';

function Row({ label, value, mono = false }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 border-b border-white/[0.06] py-3 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4',
      )}
    >
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-white/40">{label}</span>
      <span
        className={cn(
          'min-w-0 break-words text-sm text-white/90',
          mono && 'font-mono text-xs text-white/80',
        )}
      >
        {value || '—'}
      </span>
    </div>
  );
}

/**
 * @param {{ variant?: 'web' | 'eleve' }} props
 */
export function AppVersionContent({ variant = 'web' }) {
  const isEleve = variant === 'eleve';
  const [ua, setUa] = useState('');

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    setUa(navigator.userAgent || '');
  }, []);

  const info = getAppBuildInfo();

  return (
    <div className={cn('w-full', isEleve ? 'max-w-md' : 'max-w-lg')}>
      <div
        className={cn(
          'overflow-hidden rounded-2xl border p-4 sm:p-6',
          isEleve
            ? 'border-white/[0.1] bg-[#16161E]/95'
            : 'border-white/10 bg-[#111318]/90 backdrop-blur-sm',
        )}
      >
        <div className="mb-4 flex items-center gap-3">
          <div
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-xl',
              isEleve ? 'bg-[#7B61FF]/15 text-[#B8A4FF]' : 'bg-amber-500/15 text-amber-200',
            )}
          >
            <Package className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="font-serif text-lg font-bold text-white sm:text-xl">Version & environnement</h2>
            <p className="text-xs text-white/45">
              {isEleve ? 'Application LIRI élève (shell mobile)' : 'Build du front Vite + infos navigateur'}
            </p>
          </div>
        </div>

        <div>
          <Row label="Projet (package)" value={info.packageName} />
          <Row label="Version" value={info.packageVersion} mono />
          <Row label="Mode" value={info.mode} mono />
          <Row label="Base" value={info.baseUrl} mono />
          <Row label="Supabase" value={import.meta.env.VITE_SUPABASE_URL ? 'configuré' : 'non défini'} />
          {info.appName ? <Row label="VITE_APP_NAME" value={String(info.appName)} /> : null}
          <Row label="Environnement" value={info.isDev ? 'développement' : 'production'} />
          {ua ? <Row label="User-Agent" value={ua} mono /> : <Row label="User-Agent" value="(indisponible côté SSR)" />}
        </div>
      </div>

      {isEleve ? (
        <p className="mt-4 text-center text-[11px] text-white/35">
          Équivalent web :{' '}
          <Link to="/version" className="text-[#B8A4FF] underline decoration-[#7B61FF]/50 underline-offset-2">
            /version
          </Link>
        </p>
      ) : (
        <p className="mt-4 text-center text-sm text-white/50">
          Version mobile (shell élève) :{' '}
          <Link
            to={ELEVE_MOBILE.version}
            className="font-medium text-amber-200/90 underline decoration-amber-500/40 underline-offset-2 hover:text-amber-100"
          >
            {ELEVE_MOBILE.version}
          </Link>
        </p>
      )}
    </div>
  );
}
