import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutGrid, Calendar, Award, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EV_MUTED, EV_R } from '@/pages/school/eleve-mobile/eleveMobileScreensShared';

const TABS = [
  { to: '.', end: true, label: 'Aperçu', short: 'Résumé', icon: LayoutGrid },
  { to: 'calendrier', label: 'Calendrier', short: 'Agenda', icon: Calendar },
  { to: 'resultats', label: 'Résultats', short: 'Notes', icon: Award },
  { to: 'annonces', label: 'Annonces', short: 'Info', icon: Bell },
];

/**
 * Sous-menu interne (routes sous `/m/eleve/vie-scolaire/...`).
 * Scroll horizontal sur petit écran.
 */
export function VieScolaireSubMenu() {
  return (
    <div
      className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#0b0b0a]/90 px-1 py-2 backdrop-blur-md"
      style={{ marginLeft: 0, marginRight: 0 }}
    >
      <div
        className="flex w-full gap-1.5 overflow-x-auto pb-0.5 pl-1 pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Sous-menus vie scolaire"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <NavLink
              key={t.to + (t.end ? 'i' : '')}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn(
                  'flex min-w-0 flex-shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-center text-[12px] font-extrabold leading-none text-white/45 transition hover:text-white/80',
                  isActive && 'text-white',
                  isActive
                    ? 'ring-1 ring-orange-400/45'
                    : 'ring-1 ring-white/[0.08]',
                  isActive
                    ? 'bg-gradient-to-b from-orange-500/35 to-orange-950/40'
                    : 'bg-white/[0.04]',
                )
              }
              style={{ borderRadius: EV_R.md }}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className="h-3.5 w-3.5 shrink-0"
                    strokeWidth={2.1}
                    style={{ color: isActive ? '#eab89a' : EV_MUTED }}
                  />
                  <span className="whitespace-nowrap sm:hidden">{t.short}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}

export default VieScolaireSubMenu;
