import React from 'react';
import { ArrowUpRight } from 'lucide-react';

// Vitrine à photos (d'après feature-sections, 21st.dev) — JSX, charte PRORASCIENCE (or/sombre).
// Deux exports : TempleServices (grille image+titre+desc) et TempleFeatured (bloc vedette grande photo + carte).

const gold = { color: 'var(--gold)' };

export function TempleServices({ eyebrow, heading, subheading, items = [] }) {
  return (
    <section className="relative py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        {(eyebrow || heading) && (
          <div className="mx-auto mb-14 max-w-2xl text-center">
            {eyebrow && <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>{eyebrow}</p>}
            {heading && <h2 className="mq-display mt-4 text-4xl font-semibold sm:text-5xl" style={{ color: 'var(--fg)' }}>{heading}</h2>}
            {subheading && <p className="mt-4 text-base" style={{ color: 'var(--muted)' }}>{subheading}</p>}
          </div>
        )}
        <div className="flex flex-wrap items-start justify-center gap-8">
          {items.map((it) => (
            <a key={it.title} href={it.href || '#'} className="group block w-full max-w-80 transition duration-300 hover:-translate-y-1">
              <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border)' }}>
                <img
                  src={it.img}
                  alt={it.title}
                  className="aspect-[4/3] w-full object-cover grayscale transition duration-500 group-hover:scale-105 group-hover:grayscale-0"
                />
              </div>
              <h3 className="mq-display mt-4 text-lg font-semibold" style={{ color: 'var(--fg)' }}>{it.title}</h3>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{it.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TempleFeatured({ eyebrow, lead, bigImg, cardImg, title, text, ctaLabel = 'En savoir plus', ctaHref = '#' }) {
  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      <div className="pointer-events-none absolute -left-24 -top-10 -z-0 size-[420px] rounded-full blur-3xl" style={{ background: 'rgba(216,180,104,0.16)' }} />
      <div className="relative z-10 mx-auto max-w-6xl px-6">
        {eyebrow && <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>{eyebrow}</p>}
        {lead && <p className="mt-4 max-w-3xl text-lg leading-relaxed" style={{ color: 'var(--fg)' }}>{lead}</p>}
        <div className="mt-10 grid grid-cols-1 gap-10 md:grid-cols-3">
          <div className="overflow-hidden rounded-2xl border md:col-span-2" style={{ borderColor: 'var(--border)' }}>
            <img src={bigImg} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="md:col-span-1">
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border)' }}>
              <img src={cardImg} alt="" className="aspect-[4/3] w-full object-cover transition duration-500 hover:scale-105" />
            </div>
            <h3 className="mq-display mt-6 text-2xl font-semibold leading-tight" style={{ color: 'var(--fg)' }}>{title}</h3>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{text}</p>
            <a href={ctaHref} className="group mt-4 inline-flex items-center gap-2 text-sm font-semibold transition hover:brightness-110" style={gold}>
              {ctaLabel}
              <ArrowUpRight className="size-4 transition duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default TempleServices;
