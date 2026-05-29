import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getProrascienceVitrineTabBarItems } from '@/lib/prorascienceVitrineMenu';

function VitrineSideTab({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={Boolean(end)}
      className={({ isActive }) =>
        cn(
          'flex min-w-0 flex-col items-center justify-end gap-1 rounded-xl py-1.5 transition-colors',
          isActive ? 'text-violet-400' : 'text-white/50 hover:text-white/85',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className="h-[22px] w-[22px] shrink-0"
            strokeWidth={isActive ? 2.4 : 1.9}
          />
          <span className={cn('max-w-full truncate px-0.5 text-center text-[10px] font-medium', isActive && 'font-semibold')}>
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

function VitrineCenterRdvTab({ to, label, shortLabel, icon: Icon }) {
  const { pathname } = useLocation();
  const isRdv = pathname === to || pathname.startsWith(`${to}/`);
  return (
    <div className="relative flex min-w-0 flex-col items-center justify-end -mt-8">
      <NavLink to={to} className="group relative flex min-w-0 flex-col items-center" aria-label={label}>
        {() => (
          <>
            <span
              aria-hidden
              className={cn(
                'pointer-events-none absolute -inset-3 rounded-full blur-2xl transition-opacity',
                isRdv ? 'opacity-100' : 'opacity-75 group-hover:opacity-100',
              )}
              style={{
                background:
                  'radial-gradient(circle, rgba(56,189,248,0.88) 0%, rgba(124,92,255,0.55) 38%, rgba(123,97,255,0.2) 55%, transparent 72%)',
              }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-1 rounded-full opacity-60 blur-md transition-opacity"
              style={{
                background:
                  'radial-gradient(circle, rgba(255,255,255,0.35) 0%, rgba(200,220,255,0.12) 45%, transparent 70%)',
              }}
            />
            <span
              className="relative flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full shadow-[0_12px_40px_-6px_rgba(123,97,255,0.55),0_0_0_1px_rgba(255,255,255,0.14),inset_0_1px_0_rgba(255,255,255,0.32),inset_0_-1px_0_rgba(0,0,0,0.2),0_0_0_0.5px_rgba(123,97,255,0.4)] transition-transform active:scale-95"
              style={{
                background: 'linear-gradient(165deg, #7B61FF 0%, #6D28D9 40%, #5B21B6 100%)',
              }}
            >
              <Icon className="h-7 w-7 text-white" strokeWidth={2.2} />
            </span>
            <span
              className={cn(
                'mt-1.5 line-clamp-2 max-w-[4.8rem] text-center text-[8px] font-semibold leading-tight',
                isRdv ? 'text-violet-300' : 'text-white/50',
              )}
            >
              {shortLabel}
            </span>
          </>
        )}
      </NavLink>
    </div>
  );
}

/**
 * Barre d'onglets **vitrine** (raccourcis marketing) — remplace l'onglet LIRI (Accueil, Cours, Live…)
 * quand l'utilisateur parcourt `/m/eleve/prorascience/...`.
 */
export function ProrascienceVitrineBottomTabBar() {
  const { left, center, right } = getProrascienceVitrineTabBarItems();
  return (
    <nav aria-label="Raccourcis vitrine Prorascience" className="fixed inset-x-0 bottom-0 z-40">
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-0 border-t border-white/[0.1] shadow-[0_-8px_32px_rgba(0,0,0,0.5),0_-20px_48px_-12px_rgba(99,102,241,0.12),0_-1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl backdrop-saturate-150"
          style={{
            background:
              'linear-gradient(180deg, rgba(24,24,36,0.78) 0%, rgba(14,14,22,0.94) 40%, rgba(11, 11, 15, 0.96) 100%)',
          }}
        />
        <div className="relative mx-auto grid max-w-lg grid-cols-5 items-end gap-0.5 px-0.5 pb-1.5 pt-2 sm:px-2">
          {left.map((item) => (
            <VitrineSideTab key={item.to} to={item.to} label={item.label} icon={item.Icon} end={item.end} />
          ))}
          <VitrineCenterRdvTab
            to={center.to}
            label={center.label}
            shortLabel={center.shortLabel}
            icon={center.Icon}
          />
          {right.map((item) => (
            <VitrineSideTab key={item.to} to={item.to} label={item.label} icon={item.Icon} end={item.end} />
          ))}
        </div>
        <div
          className="mx-auto mt-0.5 h-1 w-[28%] min-w-[96px] max-w-[130px] rounded-full bg-white/30 opacity-80"
          style={{ marginBottom: 'max(4px, env(safe-area-inset-bottom, 0px))' }}
          aria-hidden
        />
      </div>
    </nav>
  );
}
