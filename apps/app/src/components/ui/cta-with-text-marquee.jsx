import React, { useEffect, useRef } from 'react';

// CTA + marquee vertical (d'après cta-with-text-marquee, 21st.dev), adapté JSX + charte PRORASCIENCE (or/sombre).
// Le marquee fait défiler les 8 grandes questions de la doctrine ; l'item central est net, les bords s'estompent.
const QUESTIONS = [
  'La vie & l’origine',
  'La mort & l’après',
  'Le karma & la causalité',
  'La réincarnation',
  'La conscience & l’esprit',
  'La mémoire ancestrale',
  'Les rites & rituels',
  'L’identité & la culture',
];

const STYLE = `
  @keyframes mqMarqueeV { from { transform: translateY(0); } to { transform: translateY(-100%); } }
  .mq-marquee-track { animation: mqMarqueeV 28s linear infinite; }
  .mq-marquee-wrap:hover .mq-marquee-track { animation-play-state: paused; }
`;

export function CTAQuestionsMarquee() {
  const wrapRef = useRef(null);
  const gold = { color: 'var(--gold)' };

  // Fondu de l'opacité selon la distance au centre (effet "focus" sur l'item central).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    let raf;
    const update = () => {
      const items = el.querySelectorAll('.mq-item');
      const r = el.getBoundingClientRect();
      const cy = r.top + r.height / 2;
      items.forEach((it) => {
        const ir = it.getBoundingClientRect();
        const icy = ir.top + ir.height / 2;
        const dist = Math.abs(cy - icy);
        const max = r.height / 2 || 1;
        const n = Math.min(dist / max, 1);
        it.style.opacity = String(1 - n * 0.82);
      });
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, []);

  const items = (keyPrefix) =>
    QUESTIONS.map((q, i) => (
      <div
        key={keyPrefix + i}
        className="mq-item mq-display whitespace-nowrap py-5 text-3xl font-semibold tracking-tight sm:text-5xl"
        style={{ color: 'var(--fg)' }}
      >
        {q}
      </div>
    ));

  return (
    <section id="questions" className="relative border-t py-24" style={{ borderColor: 'var(--border)' }}>
      <style>{STYLE}</style>
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-2 lg:gap-20">
        {/* Texte + CTA */}
        <div className="max-w-xl">
          <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>Les grandes questions</p>
          <h2 className="mq-display mt-5 text-4xl font-semibold leading-[1.05] sm:text-6xl">Comprendre les réalités totales.</h2>
          <p className="mt-6 text-base leading-relaxed sm:text-lg" style={{ color: 'var(--muted)' }}>
            PRORASCIENCE étudie, sans tabou, les réalités visibles et invisibles. Huit domaines, une seule
            méthode : observer, modéliser, vérifier, transmettre.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href="/t/isna/signup"
              className="rounded-full px-7 py-3 text-sm font-semibold transition hover:brightness-110"
              style={{ background: 'var(--gold)', color: '#0d0b09' }}
            >
              Créer un compte
            </a>
            <a
              href="/t/isna/programme"
              className="rounded-full border px-7 py-3 text-sm font-semibold transition hover:bg-[var(--gold)] hover:text-[#0d0b09]"
              style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}
            >
              Le plan du cours
            </a>
          </div>
        </div>

        {/* Marquee vertical */}
        <div ref={wrapRef} className="mq-marquee-wrap relative h-[440px] overflow-hidden sm:h-[560px]">
          <div className="flex flex-col items-center text-center lg:items-end lg:text-right">
            <div className="mq-marquee-track flex shrink-0 flex-col">{items('a')}</div>
            <div className="mq-marquee-track flex shrink-0 flex-col" aria-hidden="true">{items('b')}</div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40" style={{ background: 'linear-gradient(to bottom, var(--bg), transparent)' }} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-40" style={{ background: 'linear-gradient(to top, var(--bg), transparent)' }} />
        </div>
      </div>
    </section>
  );
}

export default CTAQuestionsMarquee;
