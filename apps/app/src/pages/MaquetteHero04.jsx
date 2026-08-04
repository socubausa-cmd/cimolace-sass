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
import DeuxUnivers from '@/components/ui/spatial-product-showcase';
import ProrascienceCyclesEcole from '@/components/prorascience/ProrascienceCyclesEcole';
import ProrascienceFaq from '@/components/prorascience/ProrascienceFaq';
import ProrascienceContactBloc from '@/components/prorascience/ProrascienceContactBloc';
import {
  CHEMIN_BOUTIQUE,
  CHEMIN_CONSULTATION,
  CHEMIN_CONTACT,
  CHEMIN_SERVICES_TEMPLE,
  OFFRES_MENTORAT,
  cheminPaiement,
} from '@/components/prorascience/prorascienceOffres';
import { isLaunchTrialActive, LAUNCH_TRIAL_ENDS_AT } from '@/lib/liri/memberTier';
import { PRORASCIENCE_KNOWLEDGE } from '@/lib/agent/prorascienceKnowledge';

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

// Bénéfices propres au site pour chaque palier de mentorat. ⛔ Le NOM, le SOUS-TITRE, la FRÉQUENCE
// et le PRIX ne sont plus recopiés ici : ils viennent de `ngowazuluMentoratOffers` (via
// OFFRES_MENTORAT) — une copie littérale de moins à maintenir.
const BENEFICES_MENTORAT = {
  'ngowazulu-mentorat-1x-month': ['Suivi de fond espacé', 'Accès cours & lives LIRI', 'Stabilisation, budget maîtrisé'],
  'ngowazulu-mentorat-1x-week': ['Suivi continu personnalisé', 'Accès cours & lives LIRI', 'Communauté encadrée'],
  'ngowazulu-mentorat-2x-week': ['Lecture fine (songes, aura)', 'Dynamiques lourdes & transitions', 'Accompagnement rapproché'],
  'ngowazulu-mentorat-urgent-3x-week': ['Priorité & urgences', 'Interventions dédiées', 'Accompagnement total'],
};
const MENTORAT_MIS_EN_AVANT = 'ngowazulu-mentorat-1x-week';

// Gamme TEMPLE (consultation + mentorats). La gamme ÉCOLE (les 4 cycles) est rendue à part par
// <ProrascienceCyclesEcole>, avec ses prix lus en base — les deux familles sont désormais
// affichées côte à côte, comme dans la navigation immersive.
const OFFRES = [
  {
    planName: 'Consultation',
    description: 'Diagnostic & orientation',
    // ⚠️ 50 € = le prix public affiché partout dans le dépôt (ServicesSpirituelsPage, catalogue
    // du Temple). La page de paiement, elle, laisse aujourd'hui le montant LIBRE pour ce slug tant
    // que la ligne billing_plans `ngowazulu-consultation-90min` (category='consultation',
    // price_cents=5000) n'existe pas. À créer en base — sinon l'affiché et l'encaissé divergent.
    price: '50', priceSuffix: '/90 min', currency: '€',
    features: ['Lecture des blocages', "Plan d'action personnalisé", 'Séance de 90 minutes', 'Compte-rendu & suivi'],
    buttonText: 'Réserver une séance', buttonVariant: 'secondary',
    onCtaClick: () => { window.location.href = CHEMIN_CONSULTATION; },
  },
  ...OFFRES_MENTORAT.map((o) => ({
    planName: o.nom,
    description: o.sousTitre,
    price: o.prix, priceSuffix: '/mois', currency: '€',
    isPopular: o.slug === MENTORAT_MIS_EN_AVANT,
    features: [o.frequence, ...(BENEFICES_MENTORAT[o.slug] || [])],
    buttonText: 'Choisir ce parcours',
    buttonVariant: o.slug === MENTORAT_MIS_EN_AVANT ? 'primary' : 'secondary',
    onCtaClick: () => {
      window.location.href = cheminPaiement({
        plan: o.slug, type: 'subscription', label: o.nom, priceLabel: `${o.prix} € / mois`,
      });
    },
  })),
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
  // « Gratuit pour commencer » n'est vrai que pendant l'essai de lancement : la phrase est donc
  // liée à la SOURCE UNIQUE (memberTier), jamais à une date réécrite dans la maquette.
  const essaiOuvert = isLaunchTrialActive();
  const finEssai = new Date(LAUNCH_TRIAL_ENDS_AT).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
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
            {/* Un SEUL clamp continu : la variante sm: faisait bondir le titre de 62 à 96 px pile à
                640 px de large et débordait entre 640 et ~800 px (iPad Mini, fenêtres réduites). */}
            <h1 className="mq-display relative z-20 text-center font-semibold leading-[0.9] tracking-tight text-[clamp(2.25rem,9.5vw,9.5rem)]">
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em]" style={gold}>Rejoindre l&apos;École en ligne</p>
                <p className="mt-2 text-sm leading-snug" style={{ color: 'var(--fg)' }}>
                  Sciences africaines en ligne&nbsp;: cours, lives en groupe et accompagnement personnalisé.
                </p>
                {/* L'adresse saisie est TRANSMISE à /signup (?email=…) : exiger une adresse valide
                    puis la jeter obligeait le visiteur à la retaper au premier pas du tunnel. */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const email = String(new FormData(e.currentTarget).get('email') || '').trim();
                    window.location.href = email ? `/signup?email=${encodeURIComponent(email)}` : '/signup';
                  }}
                  className="mt-4"
                >
                  <div className="relative grid grid-cols-[1fr_auto] items-center gap-1.5 rounded-2xl border p-1.5" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2" style={{ color: 'var(--muted2)' }} />
                      <input type="email" name="email" required placeholder="Votre adresse e-mail" aria-label="Adresse e-mail" className="h-12 w-full bg-transparent pl-12 pr-2 text-sm outline-none" style={{ color: 'var(--fg)' }} />
                    </div>
                    <button type="submit" aria-label="Créer mon compte" className="inline-flex h-12 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition hover:brightness-110 sm:px-5" style={{ background: 'var(--gold)', color: '#0d0b09' }}>
                      {/* Le libellé reste visible en mobile : une flèche seule ne dit pas ce qui va se passer. */}
                      <span className="sm:hidden">Créer</span>
                      <span className="hidden sm:block">Créer mon compte</span>
                      <ArrowRight className="hidden h-4 w-4 sm:block" />
                      <SendHorizonal className="h-5 w-5 sm:hidden" />
                    </button>
                  </div>
                </form>
                <p className="mt-2.5 text-sm" style={{ color: 'var(--muted2)' }}>
                  {essaiOuvert
                    ? `Accès complet offert jusqu’au ${finEssai} · sans engagement.`
                    : 'Création de compte gratuite · vous choisissez ensuite votre cycle.'}
                </p>
                <div className="mt-4 text-sm">
                  {/* ⚠️ Les sous-pages (/ecole, /temple…) sont AUJOURD'HUI redirigées vers l'accueil
                      par App.jsx : on vise donc les sections de cette page, qui, elles, répondent. */}
                  <a href="#ecole" className="inline-flex items-center gap-1 font-medium transition hover:text-[var(--gold)]" style={{ color: 'var(--muted)' }}>
                    Découvrir l&apos;École et le Temple <ArrowRight className="h-4 w-4" />
                  </a>
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
          <p className="mx-auto mt-28 max-w-2xl text-center text-base font-medium leading-relaxed sm:text-lg" style={{ color: 'var(--fg)' }}>
            L&apos;école en ligne des sciences africaines&nbsp;: cours structurés, lives en groupe et accompagnement personnalisé, jusqu&apos;à la maîtrise validée.
          </p>
          <p className="mx-auto mt-5 max-w-2xl text-center font-mono text-xs tracking-wide sm:text-sm" style={{ color: 'var(--muted)' }}>
            RECEVEZ LES YEUX POUR VOIR
            <br />
            ET LES OREILLES POUR COMPRENDRE —
            <br />
            LA SCIENCE QUI UNIFIE <Highlight className="text-[#0d0b09]">LE VISIBLE ET L&apos;INVISIBLE</Highlight>.
          </p>
          <div className="mt-7 flex justify-center">
            <a
              href={CHEMIN_CONTACT}
              className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium underline-offset-4 transition hover:underline"
              style={{ color: 'var(--muted)' }}
            >
              Besoin d&apos;un accompagnement&nbsp;? Écrivez-nous
              <ArrowRight className="h-4 w-4" />
            </a>
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
            <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>Choisir sa porte</p>
            <h2 className="mq-display text-4xl font-semibold leading-[1.05] sm:text-5xl">Commencez votre initiation.</h2>
            <p className="max-w-md text-sm leading-relaxed sm:text-base" style={{ color: 'var(--muted)' }}>
              Deux chemins, un même socle&nbsp;: l&apos;École pour comprendre, le Temple pour traverser. Choisissez par où entrer.
            </p>
            <div className="mt-1 flex flex-col gap-3 sm:flex-row">
              <a href="#cycles" className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-7 py-3 text-sm font-semibold transition hover:brightness-110" style={{ background: 'var(--gold)', color: '#0d0b09' }}>
                Entrer à l&apos;École <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#offres" className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border px-7 py-3 text-sm font-semibold transition hover:bg-[var(--gold)] hover:text-[#0d0b09]" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>
                Entrer au Temple <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted2)' }}>
              Vous préférez créer votre compte tout de suite&nbsp;?{' '}
              <a href="/signup" className="font-semibold underline-offset-4 transition hover:underline" style={gold}>Créer mon compte</a>
            </p>
          </div>
        </div>
      </section>

      {/* ===== Deux univers — switcher École ⟷ Temple (choisis ta porte) ===== */}
      <DeuxUnivers />

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
            ctaLabel="Voir les cycles de l'École"
            ctaHref="#cycles"
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
              <a href="#offres" className="inline-flex min-h-[48px] items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold transition hover:brightness-110" style={{ background: 'var(--gold)', color: '#0d0b09' }}>
                Voir les offres du Temple <ArrowRight className="h-4 w-4" />
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
        // Chaque carte mène désormais à un chemin QUI RÉPOND (checkout, page du service, contact) —
        // elles pointaient toutes vers /temple, redirigé vers l'accueil.
        items={[
          { title: 'Consultation', desc: 'Diagnostic des blocages & orientation. 50 € · 1h30.', img: TEMPLE(2), href: CHEMIN_CONSULTATION },
          { title: 'Culte & communion', desc: 'Le rythme communautaire en live : on ouvre le mois le 1er dimanche, on le ferme le dernier vendredi.', img: TEMPLE(6), href: CHEMIN_SERVICES_TEMPLE },
          // ⚠️ Ce n'est PAS une boutique : c'est le MATÉRIEL requis pour entrer en
          // initiation. Un pack indivisible, pas un catalogue où l'on pioche.
          { title: 'Matériel initiatique', desc: 'Le nécessaire de celui qui entre en initiation : 9 instruments sacrés, indivisibles. 700 €, activation et suivi 3 mois inclus.', img: TEMPLE(3), href: CHEMIN_BOUTIQUE },
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
            {/* Les 3 piliers + leur détail viennent de la MÊME source que l'agent immersif
                (prorascienceKnowledge.vision.pillars) : plus de triade divergente entre les pages. */}
            {PRORASCIENCE_KNOWLEDGE.vision.pillars.map((p, i) => (
              <div key={p.title} className="p-8" style={{ background: 'var(--bg)' }}>
                <div className="text-sm font-bold" style={gold}>{String(i + 1).padStart(2, '0')}</div>
                <div className="mq-display mt-2 text-2xl font-semibold">{p.title}</div>
                <ul className="mt-3 space-y-1.5 text-sm" style={{ color: 'var(--muted)' }}>
                  {p.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2">
                      <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: 'var(--gold)' }} />
                      {pt}
                    </li>
                  ))}
                </ul>
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

      {/* ===== Famille 1 — les cycles de l'École (prix lus dans billing_plans) ===== */}
      <ProrascienceCyclesEcole />

      {/* ===== Famille 2 — les offres du Temple (consultation + mentorats) ===== */}
      {/* ⛔ Le sous-titre ne cite plus « communion mensuelle à 15 € » : aucune offre à 15 € n'est
          achetable dans cette grille. La communion est présentée à sa vraie place, sur la page
          des services du Temple (/services-spirituels), qui la décrit. */}
      <section id="offres" className="relative border-t py-12" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
        <ModernPricingPage
          title="Le Temple · accompagnement personnel"
          subtitle="L'École enseigne, le Temple accompagne. De la première consultation au mentorat souverain — un chemin gradué, au rythme que vous choisissez."
          plans={OFFRES}
        />
        <div className="mx-auto mt-8 max-w-3xl px-5 text-center sm:px-6">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--muted2)' }}>
            Vous cherchez la communion mensuelle, le matériel initiatique ou un voyage initiatique&nbsp;?{' '}
            <a href={CHEMIN_SERVICES_TEMPLE} className="font-semibold underline underline-offset-4" style={gold}>
              Voir tous les services du Temple
            </a>.
          </p>
        </div>
      </section>

      {/* ===== FAQ — mêmes réponses que l'agent immersif ===== */}
      <ProrascienceFaq />

      {/* ===== Contact & rendez-vous — le site n'avait aucun canal entrant ===== */}
      <ProrascienceContactBloc />

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
            {/* ⛔ C'était un href="#" : le dernier bouton de la page ne faisait littéralement rien.
                Il mène désormais au seul chemin de prise de contact qui fonctionne (ContactPage). */}
            <a href={CHEMIN_CONTACT} className="inline-flex min-h-[48px] items-center rounded-full px-7 py-3 text-sm font-semibold transition hover:brightness-110" style={{ background: 'var(--gold)', color: '#0d0b09' }}>
              Demander un rendez-vous
            </a>
            <a href="/login" className="inline-flex min-h-[48px] items-center rounded-full border px-7 py-3 text-sm font-semibold transition hover:bg-[var(--gold)] hover:text-[#0d0b09]" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>
              Accès membre
            </a>
          </div>
          <nav className="mt-12 flex flex-wrap items-center justify-center gap-x-7 gap-y-1 text-[13px] font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--muted)' }}>
            {[
              { l: 'École', h: '#cycles' },
              { l: 'Temple', h: '#offres' },
              { l: 'Doctrine', h: '#doctrine' },
              { l: 'Questions', h: '#faq' },
              { l: 'Témoignages', h: '#temoignages' },
              { l: 'Contact', h: CHEMIN_CONTACT },
            ].map(({ l, h }) => (
              <a key={l} href={h} className="inline-flex min-h-[44px] items-center px-1 transition hover:text-[var(--gold)]">{l}</a>
            ))}
          </nav>
          {/* Vente à distance : les informations précontractuelles doivent être atteignables
              depuis le tunnel. Les deux pages existaient déjà, orphelines. */}
          <nav className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-[13px]" style={{ color: 'var(--muted2)' }}>
            <a href="/mentions-legales" className="inline-flex min-h-[44px] items-center px-1 underline-offset-4 transition hover:text-[var(--gold)] hover:underline">Mentions légales</a>
            <a href="/politique-confidentialite" className="inline-flex min-h-[44px] items-center px-1 underline-offset-4 transition hover:text-[var(--gold)] hover:underline">Confidentialité</a>
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
