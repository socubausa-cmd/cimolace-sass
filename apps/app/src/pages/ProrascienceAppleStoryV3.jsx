import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import SEO from '@/components/SEO';

/** Scroll : déclenchement plus tolérant (évite contenu bloqué à opacity 0 si l'IO tarde ou échoue). */
const reveal = {
  initial: { opacity: 0, y: 26 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.08, margin: '0px 0px -12% 0px' },
  transition: { duration: 0.75, ease: 'easeOut' },
};

const imageBank = {
  ritual: '/image-pro/isna-pro-rituel-compris-cinematic.png',
  voyage: '/image-pro/isna-pro-voyageur-cinematic.png',
  mondeAvant: '/image-pro/isna-pro-monde-avant-rituel.png',
  histoireCustom: '/image-pro/prorascience-histoire-rites-panels.png',
  devices: '/image-pro/liri-hero-devices.png',
  layout: '/image-pro/liri-layout-showcase.png',
  distance: '/image-pro/aprendre-a-distance.png',
  founder: '/image-pro/isna-fondateur.png',
  builder: '/image-pro/isna-batisseur.png',
};

const pillars = [
  {
    title: 'Classe immersive LIRI',
    desc: 'Présence réelle à distance, interaction en direct et expérience vivante comme en présentiel.',
    icon: '🎥',
  },
  {
    title: 'Smartboard intelligent',
    desc: 'Les concepts deviennent visibles. Les lois et mécanismes cessent d\'être abstraits.',
    icon: '🧠',
  },
  {
    title: 'IA pédagogique',
    desc: 'Reformulation, clarification et accompagnement continu pour comprendre au lieu de seulement écouter.',
    icon: '✨',
  },
  {
    title: 'Traduction multilingue',
    desc: 'Cours vidéo, transcription et coaching pédagogique accessibles dans plusieurs langues.',
    icon: '🌍',
  },
];

const timeline = [
  {
    label: 'Le monde avant',
    title: 'On vous a appris à faire, pas à comprendre.',
    body: 'Libations, prières, rituels: des gestes transmis et répétés, sans toujours accéder aux lois invisibles derrière chaque acte.',
    img: imageBank.histoireCustom,
  },
  {
    label: 'La fracture',
    title: 'Apprendre signifiait voyager et attendre.',
    body: 'Quitter l\'Europe, retourner au village, chercher un initié, attendre des années. Une connaissance souvent fragmentée.',
    img: imageBank.voyage,
  },
  {
    label: 'Le basculement',
    title: 'Aujourd\'hui, le temple est chez vous.',
    body: 'Une connexion suffit pour démarrer un parcours initiatique structuré, en ligne, depuis n\'importe où.',
    img: imageBank.distance,
  },
];

const transforms = [
  { before: 'Pratique répétée', after: 'Compréhension consciente' },
  { before: 'Dépendance', after: 'Autonomie' },
  { before: 'Imitation', after: 'Maîtrise' },
  { before: 'Confusion', after: 'Vision claire' },
];

export default function ProrascienceAppleStoryV3() {
  const reduceMotion = useReducedMotion();
  const heroEnter = reduceMotion
    ? { initial: { opacity: 1, y: 0 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0 } }
    : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.65, ease: 'easeOut' } };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#06070c] text-white">
      <SEO
        title="Prorascience · récit immersif (variante 3)"
        description="Version premium de la landing Prorascience: vision, rupture, pédagogie LIRI et transformation initiatique."
      />

      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_10%_-10%,rgba(59,130,246,0.22),transparent_55%),radial-gradient(900px_500px_at_90%_0%,rgba(139,92,246,0.18),transparent_55%),linear-gradient(to_bottom,#06070c,#04050a)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.09)_1px,transparent_1px)] [background-size:44px_44px]" />
      </div>

      <div className="relative z-10">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#06070c]/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-white/10 font-semibold">P</div>
            <div>
              <p className="text-base font-semibold tracking-tight">Prorascience</p>
              <p className="text-xs text-white/45">ISNA • École initiatique moderne</p>
            </div>
          </div>
          <nav className="hidden items-center gap-7 text-sm text-white/65 lg:flex">
            <a href="#vision" className="hover:text-white">Vision</a>
            <a href="#rupture" className="hover:text-white">Rupture</a>
            <a href="#pedagogie" className="hover:text-white">Pédagogie</a>
            <a href="#architect" className="hover:text-white">Architect</a>
            <a href="#entrer" className="hover:text-white">Entrer</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/ecoles/prorascience" className="hidden rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10 md:inline-flex">
              Voir le système
            </Link>
            <Link to="/signup" className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition hover:bg-white/90">
              Entrer
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section id="vision" className="mx-auto max-w-7xl px-6 pb-20 pt-14 sm:pb-24 sm:pt-20 lg:pt-24">
          <div className="grid items-center gap-10 lg:grid-cols-[1.03fr_0.97fr]">
            <motion.div {...heroEnter}>
              <p className="inline-flex rounded-full border border-blue-300/25 bg-blue-400/10 px-4 py-2 text-xs uppercase tracking-[0.26em] text-blue-100/85">
                Recevez les yeux pour voir
              </p>
              <h1 className="mt-6 text-5xl font-semibold leading-tight tracking-tight sm:text-6xl xl:text-7xl">
                Vous avez pratiqué.
                <span className="mt-2 block text-white/55">Mais avez-vous compris?</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/70">
                Prorascience transforme la spiritualité africaine en connaissance claire, structurée et transmissible. Moins de mystère flou, plus de compréhension profonde.
              </p>
              <div className="mt-9 flex flex-wrap gap-4">
                <Link to="/signup" className="rounded-full bg-white px-7 py-3 text-sm font-medium text-black transition hover:-translate-y-0.5 hover:bg-white/90">
                  Entrer dans l'école
                </Link>
                <Link to="/ecoles/prorascience" className="rounded-full border border-white/20 px-7 py-3 text-sm font-medium text-white transition hover:bg-white/10">
                  Voir une démonstration
                </Link>
              </div>
              <div className="mt-8 grid max-w-xl grid-cols-3 gap-3 text-center text-xs sm:text-sm">
                <div className="rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-white/75">21 sciences</div>
                <div className="rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-white/75">4 cycles</div>
                <div className="rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-white/75">100% en ligne</div>
              </div>
            </motion.div>

            <motion.div
              {...heroEnter}
              transition={{ ...heroEnter.transition, delay: 0.1 }}
            >
              <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] p-3 shadow-[0_30px_100px_rgba(15,23,42,0.45)]">
                <img src={imageBank.devices} alt="LIRI sur plusieurs appareils" className="h-[440px] w-full rounded-[1.4rem] object-cover object-center" />
                <div className="pointer-events-none absolute inset-3 rounded-[1.4rem] bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                <motion.div
                  animate={reduceMotion ? undefined : { y: [0, -10, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute bottom-8 left-8 rounded-2xl border border-white/20 bg-black/35 px-4 py-3 text-sm text-white/85 backdrop-blur"
                >
                  Présence immersive • IA pédagogique • Traduction live
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="rupture" className="border-y border-white/10 bg-white/[0.02] py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-6">
            <motion.div className="text-center" {...reveal}>
              <p className="text-sm uppercase tracking-[0.3em] text-white/45">La rupture</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Avant il fallait voyager. Maintenant une connexion suffit.</h2>
            </motion.div>
            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              <motion.div className="rounded-[1.8rem] border border-white/10 bg-[#0b0d15] p-7" {...reveal}>
                <p className="text-xs uppercase tracking-[0.26em] text-white/40">Avant</p>
                <ul className="mt-6 space-y-4 text-lg text-white/72">
                  <li>Quitter l'Europe</li>
                  <li>Retourner au village</li>
                  <li>Chercher un initié</li>
                  <li>Attendre des années</li>
                  <li>Composer avec une connaissance fragmentée</li>
                </ul>
              </motion.div>
              <motion.div className="relative overflow-hidden rounded-[1.8rem] border border-white/10 p-7" {...reveal}>
                <img src={imageBank.distance} alt="Apprendre à distance avec ISNA" className="absolute inset-0 h-full w-full object-cover opacity-35" />
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(8,10,16,0.55),rgba(8,10,16,0.9))]" />
                <div className="relative">
                  <p className="text-xs uppercase tracking-[0.26em] text-white/45">Aujourd'hui</p>
                  <h3 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Le temple est chez vous.</h3>
                  <p className="mt-5 max-w-xl text-lg leading-8 text-white/75">
                    Depuis votre téléphone ou votre ordinateur, vous accédez à une école initiatique moderne, structurée et accessible partout.
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section id="pedagogie" className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
          <motion.div className="text-center" {...reveal}>
            <p className="text-sm uppercase tracking-[0.3em] text-white/45">Pédagogie du futur</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Une expérience complète pour apprendre autrement.</h2>
          </motion.div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {pillars.map((item) => (
              <motion.article key={item.title} {...reveal} whileHover={{ y: -6 }} className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-lg">
                  {item.icon}
                </div>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight">{item.title}</h3>
                <p className="mt-3 text-base leading-7 text-white/70">{item.desc}</p>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
          <motion.div className="mb-12 text-center" {...reveal}>
            <p className="text-sm uppercase tracking-[0.3em] text-white/45">Le récit</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Ce que vous avez vécu. Ce qui change maintenant.</h2>
          </motion.div>
          <div className="space-y-10">
            {timeline.map((step, index) => (
              <motion.article key={step.title} {...reveal} className="grid gap-6 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 md:p-7 lg:grid-cols-[0.9fr_1.1fr]">
                <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                  <p className="text-xs uppercase tracking-[0.26em] text-white/42">{step.label}</p>
                  <h3 className="mt-3 text-3xl font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-4 text-lg leading-8 text-white/72">{step.body}</p>
                </div>
                <div className="overflow-hidden rounded-[1.5rem] border border-white/10">
                  <img src={step.img} alt={step.title} className="h-72 w-full object-cover sm:h-80" />
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        <section id="architect" className="border-y border-white/10 bg-white/[0.02] py-20 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-8 px-6 lg:grid-cols-[1fr_1fr]">
            <motion.div {...reveal} className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-7">
              <p className="text-sm uppercase tracking-[0.3em] text-white/45">Architect · moteur visuel IA</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight">Générer. Styliser. Insérer.</h2>
              <p className="mt-5 text-lg leading-8 text-white/72">
                Un clic transforme une notion, un rite ou un concept en visuel pédagogique, mystique ou cinématique, directement intégré dans Smartboard Designer.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 text-sm text-white/75">
                {['Mystique', 'Cinématique', 'Pédagogique', 'Afro-futuriste', 'Ancien', 'Premium'].map((tag) => (
                  <span key={tag} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">{tag}</span>
                ))}
              </div>
            </motion.div>
            <motion.div {...reveal} className="overflow-hidden rounded-[1.8rem] border border-white/10">
              <img src={imageBank.layout} alt="Aperçu du Smartboard Designer" className="h-full min-h-[320px] w-full object-cover" />
            </motion.div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
          <motion.div className="text-center" {...reveal}>
            <p className="text-sm uppercase tracking-[0.3em] text-white/45">Transformation</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Ce que l'école change en vous.</h2>
          </motion.div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {transforms.map((item) => (
              <motion.div key={item.before} whileHover={{ y: -5 }} className="rounded-[1.4rem] border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-white/45">Avant</p>
                <p className="mt-2 text-2xl text-white/75">{item.before}</p>
                <div className="my-4 h-px bg-white/12" />
                <p className="text-xs uppercase tracking-[0.24em] text-white/45">Après</p>
                <p className="mt-2 text-2xl font-semibold">{item.after}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section id="entrer" className="mx-auto max-w-6xl px-6 pb-20 sm:pb-28">
          <motion.div {...reveal} className="relative overflow-hidden rounded-[2.2rem] border border-white/10 px-7 py-14 text-center sm:px-10">
            <img src={imageBank.founder} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.88),rgba(49,46,129,0.88))]" />
            <div className="relative">
              <p className="text-sm uppercase tracking-[0.3em] text-white/55">Entrer dans la Prorascience</p>
              <h2 className="mx-auto mt-4 max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">Le temple n'est plus un lieu. C\'est un accès.</h2>
              <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-white/80">
                Une connexion, un esprit ouvert, et le début d'un parcours initiatique conçu pour comprendre, maîtriser et devenir autonome.
              </p>
              <div className="mt-10 flex flex-wrap justify-center gap-4">
                <Link to="/signup" className="rounded-full bg-white px-7 py-3 text-sm font-medium text-black transition hover:-translate-y-0.5 hover:bg-white/90">
                  Entrer dans l'école
                </Link>
                <Link to="/ecoles/prorascience" className="rounded-full border border-white/25 px-7 py-3 text-sm font-medium text-white transition hover:bg-white/12">
                  Voir la démonstration
                </Link>
              </div>
            </div>
          </motion.div>
        </section>
      </main>
      </div>
    </div>
  );
}
