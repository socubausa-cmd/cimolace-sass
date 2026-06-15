import React, { useState } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';
import { MAQ_NAV } from '@/components/maquette/maqTheme';

// Header collant partagé — menus déroulants (mega-menu) adapté de navigation-menu-4 (21st.dev),
// version légère (pas de @radix-ui) + charte PRORASCIENCE (or/sombre).
export function MaqNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const gold = { color: 'var(--gold)' };

  return (
    <header className="sticky top-0 z-50 border-b backdrop-blur-md" style={{ borderColor: 'var(--border)', background: 'rgba(13,11,9,0.78)' }}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <a href="/t/isna" className="mq-display text-lg font-semibold tracking-tight" style={{ color: 'var(--fg)' }}>
          PROR<span style={gold}>A</span>SCIENCE
        </a>

        {/* Nav desktop — déroulants au survol */}
        <nav className="hidden items-center gap-1 xl:flex">
          {MAQ_NAV.map((group) =>
            group.items ? (
              <div
                key={group.label}
                className="relative"
                onMouseEnter={() => setOpenMenu(group.label)}
                onMouseLeave={() => setOpenMenu(null)}
              >
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.15em] transition hover:text-[var(--gold)]"
                  style={{ color: openMenu === group.label ? 'var(--gold)' : 'var(--muted)' }}
                >
                  {group.label}
                  <ChevronDown className="h-3.5 w-3.5 transition-transform" style={{ transform: openMenu === group.label ? 'rotate(180deg)' : 'none' }} />
                </button>
                {openMenu === group.label && (
                  <div className="absolute left-1/2 top-full w-72 -translate-x-1/2 pt-3">
                    <div className="overflow-hidden rounded-2xl border p-2 shadow-2xl backdrop-blur-xl" style={{ borderColor: 'var(--border)', background: 'rgba(22,18,12,0.97)' }}>
                      {group.items.map((it) => {
                        const Icon = it.icon;
                        return (
                          <a key={it.label} href={it.href} className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-[rgba(216,180,104,0.1)]">
                            {Icon && (
                              <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--gold)' }}>
                                <Icon className="h-4 w-4" />
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold" style={{ color: 'var(--fg)' }}>{it.label}</span>
                              {it.desc && <span className="mt-0.5 block text-xs" style={{ color: 'var(--muted2)' }}>{it.desc}</span>}
                            </span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <a
                key={group.label}
                href={group.href}
                className="rounded-full px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.15em] transition hover:text-[var(--gold)]"
                style={{ color: 'var(--muted)' }}
              >
                {group.label}
              </a>
            ),
          )}
        </nav>

        {/* CTAs */}
        <div className="hidden items-center gap-3 xl:flex">
          <a href="/login" className="text-[13px] font-semibold transition hover:text-[var(--gold)]" style={{ color: 'var(--fg)' }}>
            Connexion
          </a>
          <a href="/t/isna/signup" className="rounded-full px-5 py-2 text-[13px] font-semibold transition hover:brightness-110" style={{ background: 'var(--gold)', color: '#0d0b09' }}>
            Créer un compte
          </a>
        </div>

        <button type="button" onClick={() => setMobileOpen(!mobileOpen)} className="xl:hidden" style={{ color: 'var(--fg)' }} aria-label="Menu">
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Menu mobile — accordéon groupé */}
      {mobileOpen && (
        <div className="border-t xl:hidden" style={{ borderColor: 'var(--border)', background: 'rgba(13,11,9,0.98)' }}>
          <nav className="mx-auto max-w-7xl px-6 py-4">
            {MAQ_NAV.map((group) => (
              <div key={group.label} className="border-b py-2 last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                {group.items ? (
                  <>
                    <div className="px-1 py-1 text-[11px] font-semibold uppercase tracking-[0.25em]" style={gold}>{group.label}</div>
                    {group.items.map((it) => {
                      const Icon = it.icon;
                      return (
                        <a key={it.label} href={it.href} className="flex items-center gap-2.5 py-2 pl-3 text-sm font-medium transition hover:text-[var(--gold)]" style={{ color: 'var(--muted)' }}>
                          {Icon && <Icon className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--gold)' }} />}
                          {it.label}
                        </a>
                      );
                    })}
                  </>
                ) : (
                  <a href={group.href} className="block px-1 py-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] transition hover:text-[var(--gold)]" style={gold}>
                    {group.label}
                  </a>
                )}
              </div>
            ))}
            <div className="mt-4 flex gap-3">
              <a href="/login" className="flex-1 rounded-full border py-2.5 text-center text-sm font-semibold" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>
                Connexion
              </a>
              <a href="/t/isna/signup" className="flex-1 rounded-full py-2.5 text-center text-sm font-semibold" style={{ background: 'var(--gold)', color: '#0d0b09' }}>
                Créer un compte
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export default MaqNav;
