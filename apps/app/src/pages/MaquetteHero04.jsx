import React from 'react';
import { ArrowDownRight, ArrowRight, Mail, SendHorizonal } from 'lucide-react';
import { InteractiveImageAccordion } from '@/components/ui/interactive-image-accordion';
import { CircularTestimonials } from '@/components/ui/circular-testimonials';
import ThreeDMarquee from '@/components/ui/3d-marquee';
import { ModernPricingPage } from '@/components/ui/animated-glassy-pricing';
import { Highlight } from '@/components/ui/hero-highlight';
import { MaqNav } from '@/components/maquette/MaqNav';
import { CTAQuestionsMarquee } from '@/components/ui/cta-with-text-marquee';
import { FeaturesAtouts } from '@/components/ui/features-8';
import { TempleServices } from '@/components/ui/feature-sections';

// Variante B — hero éditorial/brutaliste (d'après hero-04), adapté PRORASCIENCE + charte Tangerine (Fraunces/or, sombre).
const TEMPLE = (n) => `/ngowazulu/temple-${String(n).padStart(2, '0')}.jpg`;
const TECH = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=700&q=80`;
const ECOLE_ITEMS = [
  { id: 1, title: 'LIRI Live Immersion', badge: 'Live', color: '#bf9a4f', description: 'Cours à distance en immersion, interaction directe, suivi contextuel.', imageUrl: TECH('1531297484001-80022131f5a1') },
  { id: 2, title: 'Smartboard Scientifique', badge: 'Visuel', color: '#bf9a4f', description: 'Visualiser les mécanismes invisibles : schémas, causalité, séquences.', imageUrl: TECH('1518770660439-4636190af475') },
  { id: 3, title: 'Chat Immersif', badge: 'IA', color: '#bf9a4f', description: 'Un guide conversationnel vers la bonne action au bon moment.', imageUrl: TECH('1517180102446-f3ece451e9d8') },
  { id: 4, title: 'Neuron QR', badge: 'Terrain', color: '#bf9a4f', description: 'Pont QR entre cours, capsule, exercice et validation terrain.', imageUrl: TECH('1498050108023-c5249f4df085') },
  { id: 5, title: 'Certification', badge: 'Preuve', color: '#bf9a4f', description: 'Progression structurée jusqu’à la maîtrise validée.', imageUrl: TECH('1460925895917-afdab827c52f') },
];

const TESTIMONIALS = [
  { name: 'Karim D.', designation: 'Initié · ISNA', quote: "J'ai enfin compris le pourquoi derrière les gestes. Je ne reproduis plus : je comprends, j'explique, je transmets.", src: TEMPLE(4) },
  { name: 'Aïcha M.', designation: 'Membre · Ngowazulu', quote: 'Une impasse réelle, traitée avec méthode, cadre et suivi. Le temple m’a remise debout.', src: TEMPLE(6) },
  { name: 'Joseph N.', designation: 'Mentorat Souverain', quote: "La rigueur d'une école et la profondeur d'un temple, réunies. Rien de comparable ailleurs.", src: TEMPLE(9) },
];

// Galerie Temple — 9 photos réelles dupliquées (18) pour densifier le mur 3D (6 par colonne).
const TEMPLE_NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const TEMPLE_GALLERY = [...TEMPLE_NUMS, ...TEMPLE_NUMS].map(TEMPLE);

// Offres Ngowazulu — consultation + mentorat (paliers réels), thème or.
const OFFRES = [
  {
    planName: 'Consultation',
    description: 'Diagnostic & orientation',
    price: '50', priceSuffix: '/90 min', currency: '€',
    features: ['Lecture des blocages', "Plan d'action personnalisé", 'Séance de 90 minutes', 'Compte-rendu & suivi'],
    buttonText: 'Réserver une séance', buttonVariant: 'secondary',
    onCtaClick: () => { window.location.href = '/t/isna/paiement?plan=ngowazulu-consultation-90min'; },
  },
  {
    planName: 'Mentorat Confort',
    description: 'Accompagnement régulier',
    price: '180', priceSuffix: '/mois', currency: '€', isPopular: true,
    features: ['1 rencontre / semaine', 'Suivi continu personnalisé', 'Accès cours & lives LIRI', 'Communauté encadrée'],
    buttonText: 'Choisir ce parcours', buttonVariant: 'primary',
    onCtaClick: () => { window.location.href = '/t/isna/paiement?plan=ngowazulu-mentorat-1x-week'; },
  },
  {
    planName: 'Mentorat Souverain',
    description: 'Transformation intensive',
    price: '500', priceSuffix: '/mois', currency: '€',
    features: ["Jusqu'à 3 rencontres / semaine", 'Priorité & urgences', 'Interventions dédiées', 'Accompagnement total'],
    buttonText: 'Choisir ce parcours', buttonVariant: 'secondary',
    onCtaClick: () => { window.location.href = '/t/isna/paiement?plan=ngowazulu-mentorat-urgent-3x-week'; },
  },
];

const THEME = `
  .mq2 {
    --bg:#0d0b09; --fg:#f4efe6; --muted:#b3a890; --muted2:#8c8472; --gold:#d8b468;
    --panel:#16120c; --border:rgba(255,255,255,0.10); --grid:rgba(255,255,255,0.06);
  }
  .mq2, .mq2 * { font-family:'Inter', system-ui, -apple-system, sans-serif; }
  .mq2 .mq-display { font-family:'Fraunces', 'Source Serif 4', Georgia, serif !important; font-optical-sizing:auto; letter-spacing:-0.02em; }
  .mq2 input::placeholder { color:var(--muted2); opacity:1; }
  .mq2 section, .mq2 footer { border-top-color:transparent !important; border-bottom-color:transparent !important; }
  .mq2 header { border-bottom-color:rgba(255,255,255,0.05) !important; }
  .mq2 { background: radial-gradient(48% 38% at 12% 8%, rgba(216,180,104,0.06), transparent 60%), radial-gradient(44% 38% at 88% 84%, rgba(191,154,79,0.05), transparent 60%), var(--bg) !important; }
`;

export default function MaquetteHero04() {
  const gold = { color: 'var(--gold)' };
  return (
    <div className="mq2 fixed inset-0 z-[100] overflow-y-auto" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      <style>{THEME}</style>
      <MaqNav active="accueil" />

      <section className="relative min-h-screen overflow-hidden py-20">
        {/* Grille pointillée masquée */}
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            backgroundImage: 'linear-gradient(to right, var(--grid) 1px, transparent 1px), linear-gradient(to bottom, var(--grid) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, #000 55%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, #000 55%, transparent 100%)',
          }}
        />

        <div className="relative z-20 mx-auto max-w-7xl px-6">
          {/* Titre géant */}
          <div className="relative pt-10">
            <p className="absolute -top-2 left-4 text-xs font-semibold tracking-[0.3em] sm:left-16" style={gold}>
              SCIENCE AFRICAINE TOTALE
            </p>
            <h1 className="mq-display relative z-20 text-center font-semibold leading-[0.9] tracking-tight text-6xl sm:text-8xl xl:text-[9.5rem]">
              PROR<span style={gold}>A</span>SCIENCE
            </h1>
            <p className="absolute -bottom-9 right-6 hidden text-3xl font-light tracking-[0.18em] xl:block" style={{ color: 'var(--muted)' }}>
              × NGOWAZULU
            </p>
          </div>

          {/* Services + portrait */}
          <div className="relative mt-28 flex justify-center">
            <div
              className="relative flex w-full max-w-2xl items-end gap-6 rounded-2xl border p-8 sm:p-10"
              style={{ background: 'var(--panel)', borderColor: 'var(--border)' }}
            >
              <div className="w-full max-w-md">
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em]" style={gold}>Espace membre</p>
                <form onSubmit={(e) => e.preventDefault()} className="mt-4">
                  <div className="relative grid grid-cols-[1fr_auto] items-center gap-1.5 rounded-2xl border p-1.5" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2" style={{ color: 'var(--muted2)' }} />
                      <input type="email" required placeholder="Votre adresse e-mail" aria-label="Adresse e-mail" className="h-12 w-full bg-transparent pl-12 pr-2 text-sm outline-none" style={{ color: 'var(--fg)' }} />
                    </div>
                    <button type="submit" className="inline-flex h-12 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition hover:brightness-110" style={{ background: 'var(--gold)', color: '#0d0b09' }}>
                      <span className="hidden sm:block">Commencer</span>
                      <ArrowRight className="hidden h-4 w-4 sm:block" />
                      <SendHorizonal className="h-5 w-5 sm:hidden" />
                    </button>
                  </div>
                </form>
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <a href="/t/isna/ecole" className="inline-flex items-center gap-1 font-semibold" style={gold}>Entrer à l&apos;École <ArrowRight className="h-4 w-4" /></a>
                  <a href="/t/isna/temple" className="inline-flex items-center gap-1 font-semibold" style={gold}>Entrer au Temple <ArrowRight className="h-4 w-4" /></a>
                </div>
              </div>
              <div
                className="absolute -top-16 -right-6 hidden w-40 overflow-hidden rounded-md border shadow-xl sm:block lg:-right-16"
                style={{ borderColor: 'var(--border)', background: 'linear-gradient(180deg, #16120c 0%, #0d0b09 100%)' }}
              >
                <div className="pointer-events-none absolute inset-0 z-0" style={{ background: 'radial-gradient(circle at 50% 38%, rgba(216,180,104,0.22), transparent 62%)' }} />
                <img
                  src="/ngowazulu/hero-liberation.png"
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = TEMPLE(1); }}
                  alt="Briser les chaînes — la connaissance libère"
                  className="relative z-10 h-60 w-full object-cover object-top grayscale"
                />
                <div className="absolute bottom-2 right-1 z-20 text-[10px] font-medium tracking-widest [writing-mode:vertical-rl] rotate-180" style={{ color: 'var(--muted2)' }}>
                  BASÉ EN AFRIQUE
                </div>
              </div>
            </div>
          </div>

          {/* Manifeste */}
          <p className="mx-auto mt-28 max-w-2xl text-center font-mono text-sm tracking-wide sm:text-base" style={{ color: 'var(--muted)' }}>
            RECEVEZ LES YEUX POUR VOIR
            <br />
            ET LES OREILLES POUR COMPRENDRE —
            <br />
            LA SCIENCE QUI UNIFIE <Highlight className="text-[#0d0b09]">LE VISIBLE ET L&apos;INVISIBLE</Highlight>.
          </p>
          <div className="mt-7 flex justify-center">
            <button
              type="button"
              className="rounded-full px-8 py-3.5 text-sm font-semibold transition hover:brightness-110"
              style={{ background: 'var(--gold)', color: '#0d0b09' }}
            >
              Prendre rendez-vous
            </button>
          </div>

          {/* Bas : cartes + intitulé */}
          <div className="mt-24 flex flex-col gap-12 md:flex-row md:items-end md:justify-between">
            <div className="relative h-40 w-72">
              {[3, 2, 1].map((t, i) => (
                <div
                  key={t}
                  className="absolute h-36 w-60 overflow-hidden rounded-md border shadow-lg"
                  style={{ left: i * 26, top: -i * 26, borderColor: 'var(--border)' }}
                >
                  <img src={TEMPLE(t)} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-2 md:justify-end" style={gold}>
                <span className="text-sm font-semibold tracking-widest">DERNIERS ENSEIGNEMENTS</span>
                <ArrowDownRight className="size-5" />
              </div>
              <h2 className="mq-display mt-3 text-4xl font-semibold md:text-right md:text-5xl">Comprendre sans limites</h2>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Accès immédiat : image « briser les chaînes » + capture e-mail + 2 portes ===== */}
      <section id="acces" className="relative border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto grid max-w-7xl grid-cols-1 lg:grid-cols-2">
          <div className="relative min-h-[56vh] overflow-hidden border-b lg:border-b-0 lg:border-r" style={{ borderColor: 'var(--border)' }}>
            <div className="pointer-events-none absolute inset-0 z-10" style={{ background: 'radial-gradient(circle at 55% 45%, rgba(216,180,104,0.16), transparent 60%)' }} />
            <img
              src="/ngowazulu/hero-liberation.png"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = TEMPLE(7); }}
              alt="Libération par la connaissance — PRORASCIENCE"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          </div>
          <div className="flex flex-col justify-center gap-5 px-8 py-16 sm:px-14">
            <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>Accès immédiat</p>
            <h2 className="mq-display text-4xl font-semibold leading-[1.05] sm:text-5xl">Commencez votre initiation.</h2>
            <p className="max-w-md text-sm leading-relaxed sm:text-base" style={{ color: 'var(--muted)' }}>
              Entrez votre e-mail : accès à l&apos;espace membre, suivi personnalisé — sans engagement.
            </p>
            <form onSubmit={(e) => e.preventDefault()} className="mt-1 max-w-md">
              <div className="relative grid grid-cols-[1fr_auto] items-center gap-1.5 rounded-2xl border p-1.5" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2" style={{ color: 'var(--muted2)' }} />
                  <input type="email" required placeholder="Votre adresse e-mail" aria-label="Adresse e-mail" className="h-12 w-full bg-transparent pl-12 pr-2 text-sm outline-none" style={{ color: 'var(--fg)' }} />
                </div>
                <button type="submit" className="inline-flex h-12 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition hover:brightness-110" style={{ background: 'var(--gold)', color: '#0d0b09' }}>
                  <span className="hidden sm:block">Commencer</span>
                  <ArrowRight className="hidden h-4 w-4 sm:block" />
                  <SendHorizonal className="h-5 w-5 sm:hidden" />
                </button>
              </div>
            </form>
            <div className="mt-1 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <a href="/t/isna/ecole" className="inline-flex items-center gap-1 font-semibold" style={gold}>Entrer à l&apos;École <ArrowRight className="h-4 w-4" /></a>
              <a href="/t/isna/temple" className="inline-flex items-center gap-1 font-semibold" style={gold}>Entrer au Temple <ArrowRight className="h-4 w-4" /></a>
            </div>
          </div>
        </div>
      </section>

      {/* ===== L'univers École — pédagogie high-tech (accordéon d'images) ===== */}
      <section id="ecole" className="relative border-t py-24" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-7xl px-6">
          <InteractiveImageAccordion
            heading={
              <>
                <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>
                  L&apos;univers École · ISNA
                </p>
                <h2 className="mq-display mt-4 text-4xl font-semibold leading-[1.05] sm:text-5xl">
                  Comprendre avant d&apos;agir.
                </h2>
              </>
            }
            subheading="De « je reproduis des gestes » à « je comprends, j'explique, je transmets ». Pédagogie immersive, outils high-tech et certification progressive."
            ctaLabel="Découvrir l'École"
            ctaHref="/t/isna/ecole"
            items={ECOLE_ITEMS}
          />
        </div>
      </section>

      {/* ===== Le Temple Ngowazulu — galerie 3D des photos réelles ===== */}
      <section id="temple" className="relative overflow-hidden border-t py-24" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>L&apos;univers Temple · Ngowazulu</p>
            <h2 className="mq-display mt-4 text-4xl font-semibold leading-[1.05] sm:text-5xl">L&apos;hôpital de l&apos;âme.</h2>
            <p className="mt-6 max-w-md text-sm leading-relaxed sm:text-base" style={{ color: 'var(--muted)' }}>
              Là où l&apos;École fait comprendre, le Temple fait traverser. Consultation, diagnostic,
              intervention, communion — un parcours encadré pour dénouer les impasses réelles de la vie.
            </p>
            <ul className="mt-7 grid grid-cols-2 gap-x-6 gap-y-3 text-sm" style={{ color: 'var(--muted)' }}>
              {['Consultation & diagnostic', 'Voyance lucide', 'Intervention dédiée', 'Culte & communion'].map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: 'var(--gold)' }} />
                  {s}
                </li>
              ))}
            </ul>
            <div className="mt-9">
              <a href="/t/isna/temple" className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold transition hover:brightness-110" style={{ background: 'var(--gold)', color: '#0d0b09' }}>
                Entrer au Temple <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
            <div className="pointer-events-none absolute inset-0 z-10" style={{ background: 'radial-gradient(ellipse at center, transparent 48%, rgba(13,11,9,0.9) 100%)' }} />
            <ThreeDMarquee images={TEMPLE_GALLERY} />
          </div>
        </div>
      </section>

      {/* ===== Aperçu services Temple ===== */}
      <TempleServices
        eyebrow="Au Temple · Ngowazulu"
        heading="Les services du Temple."
        items={[
          { title: 'Consultation', desc: 'Diagnostic des blocages & orientation. 50 € · 1h30.', img: TEMPLE(2), href: '/t/isna/temple' },
          { title: 'Culte & communion', desc: 'Le rythme communautaire en live. Dès 15 €/mois.', img: TEMPLE(6), href: '/t/isna/temple' },
          { title: 'Interventions', desc: 'Exorcisme, rééquilibrage, hospitalisation spirituelle.', img: TEMPLE(3), href: '/t/isna/temple' },
        ]}
      />

      {/* ===== Doctrine — 3 piliers ===== */}
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
          <h2 className="mq-display mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">Ni religion, ni secte, ni magie.</h2>
          <p className="mx-auto mt-6 max-w-2xl font-mono text-xs tracking-wide sm:text-sm" style={{ color: 'var(--muted)' }}>
            UNE SCIENCE QUI UNIFIE LE VISIBLE ET L&apos;INVISIBLE — ON NE DEMANDE PAS DE CROIRE, MAIS DE COMPRENDRE ET DE VÉRIFIER.
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
        </div>
      </section>

      {/* ===== Ce qui nous distingue — grille d'atouts ===== */}
      <FeaturesAtouts />

      {/* ===== Témoignages ===== */}
      <section id="temoignages" className="relative border-t py-24" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-6 text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>Témoignages</p>
            <h2 className="mq-display mt-4 text-4xl font-semibold sm:text-5xl">Des vies transformées.</h2>
          </div>
          <div className="flex justify-center">
            <CircularTestimonials
              testimonials={TESTIMONIALS}
              autoplay
              colors={{
                name: 'var(--fg)',
                designation: 'var(--muted)',
                testimony: 'var(--muted)',
                arrowBackground: 'rgba(255,255,255,0.06)',
                arrowForeground: '#f4efe6',
                arrowHoverBackground: '#d8b468',
              }}
              fontSizes={{ name: '1.6rem', designation: '0.9rem', quote: '1.15rem' }}
            />
          </div>
        </div>
      </section>

      {/* ===== Offres & accompagnement — pricing or ===== */}
      <section id="offres" className="relative border-t py-12" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
        <ModernPricingPage
          title="Offres & accompagnement"
          subtitle="De la première consultation au mentorat souverain — un chemin gradué vers la maîtrise. Communion mensuelle à 15 €."
          plans={OFFRES}
        />
      </section>

      {/* ===== Les grandes questions — CTA + marquee vertical ===== */}
      <CTAQuestionsMarquee />

      {/* ===== Footer ===== */}
      <footer className="relative overflow-hidden border-t pt-20 pb-10" style={{ borderColor: 'var(--border)' }}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(to right, var(--grid) 1px, transparent 1px), linear-gradient(to bottom, var(--grid) 1px, transparent 1px)',
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
            <a href="#" className="rounded-full px-7 py-3 text-sm font-semibold transition hover:brightness-110" style={{ background: 'var(--gold)', color: '#0d0b09' }}>
              Prendre rendez-vous
            </a>
            <a href="/app" className="rounded-full border px-7 py-3 text-sm font-semibold transition hover:bg-[var(--gold)] hover:text-[#0d0b09]" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>
              Accès membre
            </a>
          </div>
          <nav className="mt-12 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[12px] font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--muted)' }}>
            {[
              { l: 'École', h: '#ecole' },
              { l: 'Temple', h: '#temple' },
              { l: 'Doctrine', h: '#doctrine' },
              { l: 'Offres', h: '#offres' },
              { l: 'Témoignages', h: '#temoignages' },
              { l: 'Contact', h: '#acces' },
            ].map(({ l, h }) => (
              <a key={l} href={h} className="transition hover:text-[var(--gold)]">{l}</a>
            ))}
          </nav>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 text-[11px] tracking-widest sm:flex-row" style={{ borderColor: 'var(--border)', color: 'var(--muted2)' }}>
            <div>© 2026 PROR<span style={gold}>A</span>SCIENCE · ISNA × NGOWAZULU</div>
            <div>PROPULSÉ PAR <span className="font-bold" style={{ color: 'var(--fg)' }}>LIRI</span></div>
          </div>
        </div>
      </footer>
    </div>
  );
}
