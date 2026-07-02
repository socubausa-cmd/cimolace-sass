import React from 'react';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EV_LINE, EV_MUTED, EV_SH } from '@/pages/school/eleve-mobile/eleveMobileScreensShared';
import { cn } from '@/lib/utils';

export { EV_BG, EV_PAGE_AMBIENT, EV_R, EV_SH, EV_ACCENT, EV_MUTED, EV_LINE } from '@/pages/school/eleve-mobile/eleveMobileScreensShared';

export function pagePanelSurface() {
  return {
    background: [
      'radial-gradient(ellipse 100% 80% at 0% 0%, rgba(217, 119, 87, 0.12) 0%, transparent 55%)',
      'linear-gradient(195deg, rgba(20,16,12,0.96) 0%, rgba(12,10,8,0.98) 100%)',
    ].join(', '),
    border: '1px solid rgba(240, 200, 175, 0.14)',
    boxShadow: ['inset 0 1px 0 rgba(255,255,255,0.05)', EV_SH.sm].join(', '),
  };
}

export function listCardSurface() {
  return {
    background: [
      'radial-gradient(ellipse 90% 70% at 8% 0%, rgba(217, 119, 87, 0.1) 0%, transparent 50%)',
      'linear-gradient(198deg, rgba(22,18,13,0.95) 0%, rgba(15,11,9,0.99) 100%)',
    ].join(', '),
    border: `1px solid ${EV_LINE}`,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 14px -4px rgba(0,0,0,0.4)',
  };
}

export function safeFormat(iso, fmt) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isValid(d) ? format(d, fmt, { locale: fr }) : '—';
}

const TONE = {
  amber: {
    bar: 'from-amber-500/50 to-amber-600/10',
    icon: 'text-amber-200',
    glow: '0 0 22px -5px rgba(245, 158, 11, 0.28), inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 14px -4px rgba(0,0,0,0.4)',
  },
  emerald: {
    bar: 'from-emerald-500/45 to-emerald-600/5',
    icon: 'text-emerald-200',
    glow: '0 0 22px -5px rgba(52, 211, 153, 0.22), inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 14px -4px rgba(0,0,0,0.4)',
  },
  rose: {
    bar: 'from-rose-500/45 to-rose-600/5',
    icon: 'text-rose-200',
    glow: '0 0 22px -5px rgba(251, 113, 133, 0.22), inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 14px -4px rgba(0,0,0,0.4)',
  },
  sky: {
    bar: 'from-amber-500/45 to-amber-600/5',
    icon: 'text-amber-200',
    glow: '0 0 22px -5px rgba(230, 160, 110, 0.22), inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 14px -4px rgba(0,0,0,0.4)',
  },
};

export function StatBox({ label, value, icon: Icon, tone }) {
  const t = TONE[tone] || TONE.sky;
  const s = listCardSurface();
  return (
    <div
      className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[18px] p-2.5"
      style={{ ...s, boxShadow: t.glow, borderRadius: 18 }}
    >
      <div
        className={cn('pointer-events-none absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b', t.bar)}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-1.5 pl-1.5">
        <span
          className="line-clamp-2 text-[7.5px] font-extrabold uppercase leading-tight tracking-wide"
          style={{ color: EV_MUTED }}
        >
          {label}
        </span>
        <Icon className={cn('h-4 w-4 shrink-0', t.icon)} strokeWidth={2.1} />
      </div>
      <p className="mt-1.5 truncate pl-1.5 font-serif text-xl font-extrabold tabular-nums leading-none tracking-tight text-[#fbf3df]">
        {value}
      </p>
    </div>
  );
}
