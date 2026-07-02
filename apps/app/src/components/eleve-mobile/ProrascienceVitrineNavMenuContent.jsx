import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { activeTenantConfig as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';

/** Fond + bordure + teinte d'icône par section (aligné coque bleu / indigo / violet). */
function iconPillClass(sectionId) {
  switch (sectionId) {
    case 'principale':
      return 'border-amber-500/40 bg-amber-500/20 text-amber-300';
    case 'accompagnement':
      return 'border-orange-500/40 bg-orange-500/20 text-orange-300';
    case 'institution':
      return 'border-amber-500/40 bg-amber-500/20 text-amber-300';
    case 'communaute':
      return 'border-amber-500/40 bg-amber-500/18 text-amber-300';
    default:
      return 'border-amber-500/35 bg-amber-500/15 text-amber-200';
  }
}

/** Corps du tiroir navigation vitrine — fond noir, pastilles d'icônes en couleur. */
export function ProrascienceVitrineNavMenuContent({ menuSections, onItemNavigate }) {
  return (
    <>
      <SheetTitle className="sr-only">{`Menu de navigation — vitrine ${isnaTenantConfig.branding.name}`}</SheetTitle>
      <nav
        className="max-h-[min(72dvh,calc(100dvh-7rem))] overflow-y-auto overflow-x-hidden bg-black px-2 py-2 pb-8 pt-1"
        aria-label={`Menu vitrine ${isnaTenantConfig.branding.name}`}
      >
        {menuSections.map((section) => (
          <div key={section.id} className="mb-3 last:mb-0">
            <p className="px-1.5 pb-1.5 pt-2 text-[9px] font-bold uppercase tracking-[0.2em] text-white/40 first:pt-0 sm:text-[10px]">
              {section.title}
            </p>
            <div className="mb-1.5 h-px w-full bg-white/10" aria-hidden />
            <ul className="space-y-1.5">
              {section.items.map(({ to, label, sub, Icon }, idx) => (
                <li key={`${section.id}-${idx}-${to}`}>
                  <Link
                    to={to}
                    onClick={() => onItemNavigate?.()}
                    className="group block rounded-xl border border-white/10 bg-zinc-950/80 transition-colors hover:border-white/20 hover:bg-zinc-900/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-white/25 active:bg-neutral-950"
                  >
                    <span className="flex min-h-[2.9rem] items-center gap-2.5 rounded-[11px] px-2.5 py-2">
                      <span
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]',
                          iconPillClass(section.id),
                        )}
                      >
                        <Icon className="h-4 w-4" strokeWidth={2} />
                      </span>
                      <span className="min-w-0 flex-1 pr-0.5">
                        <span className="block text-[12px] font-semibold leading-tight text-white/95 group-hover:text-white">
                          {label}
                        </span>
                        <span className="mt-0.5 block text-[10px] leading-snug text-white/40 group-hover:text-white/50">
                          {sub}
                        </span>
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/25 transition group-hover:text-white/40" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
