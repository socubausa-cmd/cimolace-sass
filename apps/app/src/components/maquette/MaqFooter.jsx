import React from 'react';
import { MAQ_LINKS } from '@/components/maquette/maqTheme';

// Footer partagé du site maquette.
export function MaqFooter() {
  const gold = { color: 'var(--gold)' };
  return (
    <footer className="relative overflow-hidden border-t pt-20 pb-10" style={{ borderColor: 'var(--border)' }}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, var(--grid) 1px, transparent 1px), linear-gradient(to bottom, var(--grid) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse 70% 80% at 50% 100%, #000 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 80% at 50% 100%, #000 40%, transparent 100%)',
        }}
      />
      <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
        <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>Rejoignez l&apos;ordre</p>
        <h2 className="mq-display mt-4 text-4xl font-semibold leading-[1.05] sm:text-6xl">
          Recevez les yeux pour <span style={{ color: 'var(--gold)', fontStyle: 'italic' }}>voir</span>.
        </h2>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/t/isna/signup"
            className="rounded-full px-7 py-3 text-sm font-semibold transition hover:brightness-110"
            style={{ background: 'var(--gold)', color: '#0d0b09' }}
          >
            Créer un compte
          </a>
          <a
            href="/t/isna/login"
            className="rounded-full border px-7 py-3 text-sm font-semibold transition hover:bg-[var(--gold)] hover:text-[#0d0b09]"
            style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}
          >
            Connexion
          </a>
        </div>
        <nav
          className="mt-12 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[12px] font-medium uppercase tracking-[0.2em]"
          style={{ color: 'var(--muted)' }}
        >
          {MAQ_LINKS.map((l) => (
            <a key={l.label} href={l.href} className="transition hover:text-[var(--gold)]">{l.label}</a>
          ))}
          <a href="/t/isna#acces" className="transition hover:text-[var(--gold)]">Contact</a>
        </nav>
        <div
          className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 text-[11px] tracking-widest sm:flex-row"
          style={{ borderColor: 'var(--border)', color: 'var(--muted2)' }}
        >
          <div>© 2026 PROR<span style={gold}>A</span>SCIENCE · ISNA × NGOWAZULU</div>
          <div>PROPULSÉ PAR <span className="font-bold" style={{ color: 'var(--fg)' }}>LIRI</span></div>
        </div>
      </div>
    </footer>
  );
}

export default MaqFooter;
