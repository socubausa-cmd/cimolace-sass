import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EV_MUTED, EV_ACCENT, EV_LINE, EV_R, EV_SH } from '@/pages/eleve-mobile/eleveMobileScreensShared';

const GRAD_BTN =
  'flex w-full items-center gap-3 px-4 py-3.5 text-left shadow-lg transition active:scale-[0.99] sm:py-4';
const CTA_GRAD = {
  background: `linear-gradient(90deg, ${EV_ACCENT} 0%, #5B21B6 100%)`,
  boxShadow: EV_SH.cta,
  borderRadius: EV_R.lg,
};
const DARK_BTN =
  'flex w-full items-center gap-3 border px-4 py-3.5 text-left transition active:scale-[0.99] sm:py-4';

/**
 * Ligne d'action type accueil connexion LIRI : pastille + titre + sous-titre + chevron.
 * @param {{ to: string, title: string, sub: string, left: React.ReactNode, bright?: boolean, className?: string, style?: React.CSSProperties, as?: React.ElementType, right?: React.ComponentType<{ className?: string }> }} props
 */
export function LiriActionRow({
  to,
  title,
  sub,
  left,
  bright = false,
  className,
  style,
  as: Comp = Link,
  right: Right = ChevronRight,
}) {
  return (
    <Comp
      to={to}
      className={cn(GRAD_BTN, bright ? '' : DARK_BTN, !bright && 'bg-white/[0.04]', className)}
      style={bright ? { ...CTA_GRAD, ...style } : { borderRadius: EV_R.lg, border: `1px solid ${EV_LINE}`, ...style }}
    >
      <span
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border',
          bright ? 'border-white/25 bg-white/10' : 'border-white/10 bg-white/[0.04]',
        )}
      >
        {left}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold leading-tight text-white">{title}</p>
        <p className="mt-0.5 text-[12px] leading-snug" style={{ color: bright ? 'rgba(255,255,255,0.85)' : EV_MUTED }}>
          {sub}
        </p>
      </div>
      <Right className={cn('h-5 w-5 shrink-0', bright ? 'text-white/90' : 'text-white/45')} />
    </Comp>
  );
}

/** Styles du CTA violet (dégradé) — utile pour `style={}` quand le composant n'est pas un `LiriActionRow` complet. */
export const LIRI_CTA_GRADIENT_STYLE = CTA_GRAD;
