import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, BookOpen, Landmark, Globe, Map, Star, Sun, Moon, Mail, SendHorizonal } from 'lucide-react';

// Maquette ACCUEIL — récit "Deux univers" (École ISNA ⟷ Temple Ngowazulu).
// Thème Tangerine (Inter + Source Serif 4) + accent OR. Bi-mode clair/sombre via variables CSS.
const TEMPLE = (n) => `/ngowazulu/temple-${String(n).padStart(2, '0')}.jpg`;
const HERO_IMG = '/ngowazulu/hero-liberation.png';
const EASE = [0.22, 1, 0.36, 1];

const METRICS = [
  { icon: Globe, value: '2500+', label: 'INITIÉS' },
  { icon: BookOpen, value: '100+', label: 'MODULES' },
  { icon: Map, value: '30+', label: 'PAYS' },
  { icon: Star, value: '95%', label: 'SATISFACTION' },
];

const THEME_CSS = `
  .mq-root {
    --bg:#f6f3ec; --fg:#1f2430; --muted:#6b6256; --muted2:#8a8276; --gold:#bf9a4f;
    --card:#fbfaf6; --panel:#efe9da; --border:#e6e0d3; --grid:rgba(31,41,55,0.05); --divider:#e2dccd;
    --shadow:0 1px 2px rgba(31,36,48,0.04), 0 18px 36px -18px rgba(31,36,48,0.16);
  }
  .mq-root.mq-dark {
    --bg:#0d0b09; --fg:#f4efe6; --muted:#b3a890; --muted2:#8c8472; --gold:#d8b468;
    --card:rgba(255,255,255,0.045); --panel:#16120c; --border:rgba(255,255,255,0.10); --grid:rgba(255,255,255,0.05); --divider:rgba(255,255,255,0.12);
    --shadow:0 24px 60px -24px rgba(0,0,0,0.75);
  }
  .mq-root, .mq-root * { font-family:'Inter', system-ui, -apple-system, sans-serif; }
  .mq-root .mq-display { font-family:'Fraunces', 'Source Serif 4', Georgia, serif !important; font-optical-sizing:auto; letter-spacing:-0.015em; }
  .mq-root nav a { color:var(--muted); transition:color .2s ease; }
  .mq-root nav a:hover { color:var(--fg); }
  .mq-card { background:var(--card); border:1px solid var(--border); box-shadow:var(--shadow); transition:transform .25s ease, border-color .25s ease; }
  .mq-card:hover { transform:translateY(-2px); border-color:var(--gold); }
  .mq-root input::placeholder { color:var(--muted2); opacity:1; }
  .mq-mail:focus-within { border-color:var(--gold); box-shadow:0 0 0 3px color-mix(in srgb, var(--gold) 22%, transparent); }
`;

export default function MaquetteAccueil() {
  const [dark, setDark] = useState(true);
  const gold = { color: 'var(--gold)' };
  const goldItalic = { color: 'var(--gold)', fontStyle: 'italic' };

  return (
    <div
      className={`mq-root ${dark ? 'mq-dark' : ''} fixed inset-0 z-[100] overflow-y-auto antialiased`}
      style={{ background: 'var(--bg)', color: 'var(--fg)' }}
    >
      <style>{THEME_CSS}</style>

      {/* ============================ HERO ============================ */}
      <section className="relative flex min-h-screen flex-col overflow-hidden">
        {/* Grille subtile */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, var(--grid) 1px, transparent 1px), linear-gradient(to bottom, var(--grid) 1px, transparent 1px)',
            backgroundSize: '54px 54px',
            maskImage: 'radial-gradient(ellipse 60% 55% at 25% 5%, #000 55%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 60% 55% at 25% 5%, #000 55%, transparent 100%)',
          }}
        />

        {/* Nav */}
        <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6">
          <div className="text-lg font-bold tracking-[0.2em]">
            PROR<span style={gold}>A</span>SCIENCE
          </div>
          <nav className="hidden items-center gap-8 text-[12px] font-semibold tracking-[0.18em] lg:flex">
            <a href="#ecole">ÉCOLE</a>
            <a href="#temple">TEMPLE</a>
            <a href="#doctrine">DOCTRINE</a>
            <a href="#fondateur">FONDATEUR</a>
            <a href="#offres">OFFRES</a>
          </nav>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDark((d) => !d)}
              aria-label="Basculer clair / sombre"
              className="flex h-9 w-9 items-center justify-center rounded-full border transition hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--gold)' }}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <a
              href="/app"
              className="rounded-full border px-5 py-2.5 text-[11px] font-semibold tracking-[0.18em] transition hover:bg-[var(--gold)] hover:text-[#0d0b09]"
              style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}
            >
              ACCÈS MEMBRE
            </a>
          </div>
        </header>

        {/* Corps : 2 colonnes (texte / image) */}
        <div className="relative mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-center gap-6 px-6 pb-8 lg:grid-cols-2 lg:gap-4">
          {/* Colonne texte */}
          <div className="relative z-10 max-w-xl py-6">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-5 text-[12px] font-semibold uppercase tracking-[0.4em]"
              style={gold}
            >
              Science africaine totale
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, ease: EASE, delay: 0.1 }}
              className="mq-display text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-[4.4rem]"
            >
              Recevez les yeux pour <span style={goldItalic}>voir</span> et les{' '}
              <span style={goldItalic}>oreilles</span> pour comprendre.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, ease: EASE, delay: 0.25 }}
              className="mt-6 max-w-md text-[15px] leading-relaxed sm:text-base"
              style={{ color: 'var(--muted)' }}
            >
              La science qui unifie le visible et l&apos;invisible. Deux univers, une même exigence —
              l&apos;École pour comprendre, le Temple pour transformer.
            </motion.p>

            {/* Capture e-mail — accès immédiat */}
            <motion.form
              onSubmit={(e) => e.preventDefault()}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, ease: EASE, delay: 0.33 }}
              className="mt-8 max-w-md"
            >
              <div
                className="mq-mail relative grid grid-cols-[1fr_auto] items-center gap-1.5 rounded-2xl border p-1.5 transition"
                style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
              >
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2" style={{ color: 'var(--muted2)' }} />
                  <input
                    type="email"
                    required
                    placeholder="Votre adresse e-mail"
                    aria-label="Adresse e-mail"
                    className="h-12 w-full bg-transparent pl-12 pr-2 text-sm outline-none"
                    style={{ color: 'var(--fg)' }}
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex h-12 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition hover:brightness-110"
                  style={{ background: 'var(--gold)', color: '#0d0b09' }}
                >
                  <span className="hidden sm:block">Commencer</span>
                  <ArrowRight className="hidden h-4 w-4 sm:block" />
                  <SendHorizonal className="h-5 w-5 sm:hidden" />
                </button>
              </div>
              <p className="mt-2 text-xs" style={{ color: 'var(--muted2)' }}>
                Accès immédiat à l&apos;espace membre · sans engagement.
              </p>
            </motion.form>

            {/* Deux portes */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, ease: EASE, delay: 0.4 }}
              className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              {[
                { id: 'ecole', Icon: BookOpen, label: 'École · ISNA', title: 'Comprendre', desc: 'Cursus, LIRI, Smartboard, certification.', cta: "Entrer à l'École" },
                { id: 'temple', Icon: Landmark, label: 'Temple · Ngowazulu', title: 'Transformer', desc: 'Consultations, interventions, hôpital spirituel.', cta: 'Entrer au Temple' },
              ].map(({ id, Icon, label, title, desc, cta }) => (
                <a key={id} href={`#${id}`} className="mq-card group rounded-2xl p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--gold)' }}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={gold}>{label}</span>
                  </div>
                  <div className="mq-display mt-3 text-xl font-semibold">{title}</div>
                  <p className="mt-1 text-sm" style={{ color: 'var(--muted2)' }}>{desc}</p>
                  <div className="mt-3 inline-flex items-center gap-1 text-sm font-semibold" style={gold}>
                    {cta} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                </a>
              ))}
            </motion.div>

            {/* Bandeau de preuve */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.55 }}
              className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4"
            >
              {METRICS.map(({ icon: Icon, value, label }, i) => (
                <React.Fragment key={label}>
                  {i > 0 && <span className="hidden h-8 w-px sm:block" style={{ background: 'var(--divider)' }} />}
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-5 w-5" style={gold} />
                    <div className="leading-tight">
                      <div className="text-lg font-bold">{value}</div>
                      <div className="text-[10px] font-medium uppercase tracking-[0.15em]" style={{ color: 'var(--muted2)' }}>{label}</div>
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </motion.div>
          </div>

          {/* Colonne image */}
          <div className="relative hidden h-full min-h-[82vh] lg:block">
            <div
              className="pointer-events-none absolute right-0 top-1/2 h-[140%] w-[140%] -translate-y-1/2"
              style={{ background: 'radial-gradient(circle at 62% 42%, rgba(191,154,79,0.16), transparent 55%)' }}
            />
            <img
              src={HERO_IMG}
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = TEMPLE(7); }}
              alt="Libération par la connaissance — PRORASCIENCE"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          </div>
        </div>
      </section>

      {/* ===================== DEUX UNIVERS (split) ===================== */}
      <section id="univers" className="relative grid grid-cols-1 md:grid-cols-2">
        {/* École */}
        <a
          id="ecole"
          href="#"
          className="group relative flex min-h-[70vh] flex-col justify-end overflow-hidden p-10 md:border-r"
          style={{ background: 'var(--panel)', borderColor: 'var(--border)' }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(191,154,79,0.18),transparent_55%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(191,154,79,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(191,154,79,0.12)_1px,transparent_1px)] bg-[size:42px_42px] opacity-50 transition duration-700 group-hover:opacity-100" />
          <div className="relative">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.3em]" style={gold}>
              <BookOpen className="h-4 w-4" /> L&apos;univers École
            </div>
            <h2 className="mq-display mt-3 text-4xl font-semibold sm:text-5xl">ISNA — Comprendre</h2>
            <p className="mt-4 max-w-md" style={{ color: 'var(--muted)' }}>
              Passer de « je reproduis des gestes » à « je comprends, j&apos;explique et je transmets ».
              Pédagogie immersive, outils high-tech, certification.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold transition group-hover:gap-3" style={gold}>
              Découvrir l&apos;École <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
        </a>

        {/* Temple */}
        <a id="temple" href="#" className="group relative flex min-h-[70vh] flex-col justify-end overflow-hidden p-10">
          <img src={TEMPLE(1)} alt="Temple Ngowazulu" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#190f07]/90 via-[#190f07]/55 to-[#190f07]/10" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(191,154,79,0.28),transparent_55%)]" />
          <div className="relative">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.3em] text-[#e7c98c]">
              <Landmark className="h-4 w-4" /> L&apos;univers Temple
            </div>
            <h2 className="mq-display mt-3 text-4xl font-semibold text-white sm:text-5xl">Ngowazulu — Transformer</h2>
            <p className="mt-4 max-w-md text-white/85">
              L&apos;hôpital spirituel : consultations, interventions, culte en ligne, voyages
              initiatiques. On vient résoudre une impasse réelle, avec méthode et suivi.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white transition group-hover:gap-3">
              Entrer au Temple <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
        </a>
      </section>

      {/* ============ MANIFESTE — statement éditorial (fusion variante B) ============ */}
      <section id="doctrine" className="relative overflow-hidden border-t py-28" style={{ borderColor: 'var(--border)' }}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(to right, var(--grid) 1px, transparent 1px), linear-gradient(to bottom, var(--grid) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            maskImage: 'radial-gradient(ellipse 75% 70% at 50% 45%, #000 35%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 75% 70% at 50% 45%, #000 35%, transparent 100%)',
          }}
        />
        <div className="relative z-10 mx-auto max-w-7xl px-6 text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>La doctrine</p>
          <h2 className="mq-display mt-5 font-semibold leading-[0.9] tracking-tight text-5xl sm:text-7xl xl:text-[8.5rem]">
            PROR<span style={gold}>A</span>SCIENCE
          </h2>
          <p className="mx-auto mt-6 max-w-2xl font-mono text-xs tracking-wide sm:text-sm" style={{ color: 'var(--muted)' }}>
            NI RELIGION, NI SECTE, NI MAGIE — UNE SCIENCE QUI UNIFIE LE VISIBLE ET L&apos;INVISIBLE.
          </p>

          <div
            className="mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-px overflow-hidden rounded-2xl border text-left sm:grid-cols-3"
            style={{ borderColor: 'var(--border)', background: 'var(--border)' }}
          >
            {[
              { n: '01', t: 'La Raison', d: 'Logique, pensée critique, rejet du dogme aveugle.' },
              { n: '02', t: 'La Science', d: 'Observation, méthode, vérification, modèles.' },
              { n: '03', t: 'Savoirs africains', d: 'Sagesse ancestrale, cosmogonie, technologies spirituelles.' },
            ].map((p) => (
              <div key={p.n} className="p-8" style={{ background: 'var(--bg)' }}>
                <div className="text-sm font-bold" style={gold}>{p.n}</div>
                <div className="mq-display mt-2 text-2xl font-semibold">{p.t}</div>
                <p className="mt-2 text-sm" style={{ color: 'var(--muted2)' }}>{p.d}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex justify-center">
            <a
              href="#"
              className="rounded-full border px-7 py-3 text-sm font-semibold transition hover:bg-[var(--gold)] hover:text-[#0d0b09]"
              style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}
            >
              Découvrir la doctrine
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
