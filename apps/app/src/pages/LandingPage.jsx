import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { activeTenantConfig as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';
import { ngowazuluMentoratOffers } from '@/config/ngowazuluMentoratOffers';
import { NGOWAZULU_CONSULTATION_NEXT_PATH } from '@/config/ngowazuluConsultation';
import { HeroParallax } from '@/components/ui/hero-parallax';
import InfiniteGallery from '@/components/ui/3d-gallery-photography';

// Cartes du hero parallaxe — vraies photos du Temple Ngowazulu (apps/app/public/ngowazulu/).
const TEMPLE_IMG = (n) => `/ngowazulu/temple-${String(n).padStart(2, '0')}.jpg`;
// Galerie 3D immersive — mêmes photos du temple.
const TEMPLE_GALLERY = Array.from({ length: 9 }, (_, i) => ({ src: TEMPLE_IMG(i + 1), alt: 'Temple Ngowazulu' }));
const PARALLAX_PRODUCTS = [
  { title: 'Communauté Ngowazulu', link: '#ngowazulu', thumbnail: TEMPLE_IMG(1) },
  { title: 'Cérémonie initiatique', link: '#ngowazulu', thumbnail: TEMPLE_IMG(2) },
  { title: 'Rite de purification', link: '#ngowazulu', thumbnail: TEMPLE_IMG(3) },
  { title: 'Tambour sacré', link: '#ngowazulu', thumbnail: TEMPLE_IMG(4) },
  { title: 'Voyage initiatique', link: '#ngowazulu', thumbnail: TEMPLE_IMG(5) },
  { title: 'Procession rituelle', link: '#ngowazulu', thumbnail: TEMPLE_IMG(6) },
  { title: 'Immersion spirituelle', link: '#ngowazulu', thumbnail: TEMPLE_IMG(7) },
  { title: 'Bénédiction des eaux', link: '#ngowazulu', thumbnail: TEMPLE_IMG(8) },
  { title: 'Culte communautaire', link: '#ngowazulu', thumbnail: TEMPLE_IMG(9) },
  { title: 'Consultations', link: '#ngowazulu-side', thumbnail: TEMPLE_IMG(1) },
  { title: 'Interventions mystiques', link: '#ngowazulu-side', thumbnail: TEMPLE_IMG(7) },
  { title: 'Temple moderne', link: '#ngowazulu', thumbnail: TEMPLE_IMG(2) },
  { title: 'Hôpital traditionnel', link: '#ngowazulu-side', thumbnail: TEMPLE_IMG(4) },
  { title: 'Accompagnement', link: '#institution', thumbnail: TEMPLE_IMG(5) },
  { title: 'Transmission', link: '#produits', thumbnail: TEMPLE_IMG(6) },
];

const commercialMenu = [
  { href: '#hero', label: 'Accueil' },
  { href: '#univers', label: 'Deux univers' },
  { href: '#prorascience-side', label: 'Doctrine & science' },
  { href: '#ngowazulu-side', label: 'NGOWAZULU' },
  { href: '#hightech', label: 'High-Tech' },
  { href: '#science', label: 'Science' },
  { href: '#produits', label: 'Produits' },
  { href: '#institution', label: 'Institution' },
  { href: '#isna', label: 'ISNA' },
  { href: '#ngowazulu', label: 'Ngowazulu' },
  { href: '#fondateur', label: 'Fondateur' },
  { href: '#temoignages', label: 'Témoignages' },
  { href: '#cta', label: 'Accès' },
];

const SOURCE_OPTIONS = [
  { value: 'isna', label: 'ISNA' },
  { value: 'ngowazulu', label: 'Ngowazulu' },
];

const TRUST_METRICS = [
  { label: 'Étudiants formés', value: '2500+' },
  { label: 'Modules structurés', value: '100+' },
  { label: 'Pays touchés', value: '30+' },
  { label: 'Satisfaction déclarée', value: '95%' },
];

const PRODUCT_HIGHLIGHTS = [
  {
    title: 'Deux pôles, une architecture',
    text: 'ISNA pour comprendre et Ngowazulu pour transformer, dans un parcours cohérent.',
  },
  {
    title: 'Expérience membre premium',
    text: 'Interface immersive, progression lisible et accompagnement humain assisté.',
  },
  {
    title: 'Exécution mesurable',
    text: 'Rendez-vous, suivi, opérations et indicateurs de progression traçables.',
  },
  {
    title: 'Accès sécurisé',
    text: 'Le site vitrine informe, l\'application complète est réservée aux membres connectés.',
  },
];

const HIGH_TECH_LEARNING_STACK = [
  {
    title: 'LIRI Live Remote Immersion',
    text: 'Cours à distance en immersion, interaction directe, pédagogie active et suivi contextuel.',
  },
  {
    title: 'Chat Immersif',
    text: 'Assistant conversationnel de parcours pour guider l\'élève vers la bonne action au bon moment.',
  },
  {
    title: 'Smartboard Scientifique',
    text: 'Visualisation des mécanismes invisibles avec schémas, logique causale et séquences explicatives.',
  },
  {
    title: 'Neuron QR',
    text: 'Pont QR intelligent entre support de cours, capsule explicative, exercice et validation terrain.',
  },
  {
    title: 'Pipeline de Certification',
    text: 'Progression structurée: fondations, compréhension, consolidation, maîtrise et validation.',
  },
  {
    title: 'Traçabilité pédagogique',
    text: 'Données de progression, modules suivis, retours et preuves de montée en compétence.',
  },
];

const SCIENCE_NARRATIVE = [
  {
    title: 'Avant',
    text: 'Beaucoup pratiquaient des gestes (libation, kola, rites) sans explication claire du “pourquoi”.',
  },
  {
    title: 'Rupture avec la répétition',
    text: 'Nous passons de la répétition à la compréhension: méthode, logique, vérification, transmission.',
  },
  {
    title: 'Résultat',
    text: 'L\'élève devient autonome: il comprend, explique, applique et encadre avec responsabilité.',
  },
];

const NGOWAZULU_UNIVERSE = [
  {
    title: 'Consultations',
    text: 'Diagnostic des blocages et orientation stratégique des cas.',
  },
  {
    title: 'Interventions mystiques',
    text: 'Actions ciblées, pilotées par niveau de gravité et suivi des résultats.',
  },
  {
    title: 'Culte en ligne',
    text: 'Ouverture dominicale, fermeture du vendredi, rythme communautaire encadré.',
  },
  {
    title: 'Hôpital traditionnel',
    text: 'Prise en charge profonde des cas lourds avec protocole et continuité.',
  },
  {
    title: 'Voyages initiatiques',
    text: 'Rites de passage, sortie des anciens pactes et progression de conscience.',
  },
  {
    title: 'Communauté & règlement',
    text: 'Cadre protégé, discipline collective, règles actives et responsabilité mutuelle.',
  },
];

const PRORASCIENCE_PRODUCTS = [
  {
    title: 'Académie ISNA',
    text: 'Programme structuré pour apprendre, comprendre et transmettre avec rigueur.',
  },
  {
    title: 'LIRI Classe immersive',
    text: 'Apprentissage à distance premium avec interaction active et accompagnement réel.',
  },
  {
    title: 'Smartboard Initiatique',
    text: 'Visualisation claire des lois, des causes et des mécanismes invisibles.',
  },
  {
    title: 'Neuron QR Learning',
    text: 'Parcours connecté entre théorie, exercice terrain et validation de progression.',
  },
  {
    title: 'Chat immersif d\'orientation',
    text: 'Guidage contextuel pour accélérer la prise de décision et la réussite.',
  },
  {
    title: 'Certification & preuves',
    text: 'Montée en compétence traçable avec validation progressive des acquis.',
  },
];

const NGOWAZULU_PRODUCTS = [
  {
    title: 'Consultations',
    text: 'Lecture des blocages, diagnostic priorisé et plan d\'action personnalisé.',
  },
  {
    title: 'Interventions spécialisées',
    text: 'Actions ciblées avec suivi des effets et ajustements continus.',
  },
  {
    title: 'Culte en ligne',
    text: 'Rythme d\'ouverture/fermeture pour renforcer l\'ancrage collectif.',
  },
  {
    title: 'Hôpital traditionnel',
    text: 'Prise en charge des cas lourds avec protocole et continuité.',
  },
  {
    title: 'Voyages initiatiques',
    text: 'Rites de passage, réalignement et progression de conscience.',
  },
  {
    title: 'Communauté & règlement',
    text: 'Cadre protégé, discipline collective et stabilité des résultats.',
  },
];

const DYNAMIC_PROMPTS = [
  'Créer une séquence LIRI sur la causalité rituelle.',
  'Générer un module Smartboard sur libation et structure énergétique.',
  'Produire un parcours mentorat avec validation Neuron QR.',
  'Composer un protocole Ngowazulu de suivi consultation + intervention.',
];

function renderStars(rating) {
  return '★'.repeat(Math.max(0, Math.min(5, Number(rating) || 0)));
}

const LandingPage = () => {
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState({ global: { total: 0, average: 0 } });
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewForm, setReviewForm] = useState({
    source: 'isna',
    authorName: '',
    authorRole: '',
    rating: 5,
    reviewText: '',
    website: '',
  });
  const [submitState, setSubmitState] = useState({ status: 'idle', message: '' });
  const [formStartedAt, setFormStartedAt] = useState(() => Date.now());
  const [activePromptIndex, setActivePromptIndex] = useState(0);
  const [dynamicLevel, setDynamicLevel] = useState({ immersion: 0, guidance: 0, execution: 0 });
  const [billingCycle, setBillingCycle] = useState('monthly');

  const featuredReviews = useMemo(() => reviews.slice(0, 6), [reviews]);

  useEffect(() => {
    let alive = true;
    const loadReviews = async () => {
      setLoadingReviews(true);
      try {
        const res = await fetch('/.netlify/functions/public-reviews-list?limit=12');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Impossible de charger les avis');
        if (!alive) return;
        setReviews(Array.isArray(data?.reviews) ? data.reviews : []);
        setReviewSummary(data?.summary || { global: { total: 0, average: 0 } });
      } catch {
        if (!alive) return;
        setReviews([]);
      } finally {
        if (alive) setLoadingReviews(false);
      }
    };
    loadReviews();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActivePromptIndex((prev) => (prev + 1) % DYNAMIC_PROMPTS.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDynamicLevel((prev) => {
        const newImmersion = prev.immersion >= 96 ? 96 : prev.immersion + 4;
        const newGuidance = prev.guidance >= 93 ? 93 : prev.guidance + 3;
        const newExecution = prev.execution >= 98 ? 98 : prev.execution + 5;
        const newState = {
          immersion: newImmersion,
          guidance: newGuidance,
          execution: newExecution,
        };
        // Arrêter l'intervalle une fois toutes les valeurs maximales atteintes
        if (newImmersion === 96 && newGuidance === 93 && newExecution === 98) {
          clearInterval(timer);
        }
        return newState;
      });
    }, 90);
    return () => window.clearInterval(timer);
  }, []);

  const onSubmitReview = async (e) => {
    e.preventDefault();
    setSubmitState({ status: 'submitting', message: '' });
    try {
      const res = await fetch('/.netlify/functions/public-reviews-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...reviewForm,
          filledInMs: Date.now() - formStartedAt,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Soumission impossible');
      setSubmitState({ status: 'success', message: data?.message || 'Avis envoyé avec succès.' });
      setReviewForm({
        source: 'isna',
        authorName: '',
        authorRole: '',
        rating: 5,
        reviewText: '',
        website: '',
      });
      setFormStartedAt(Date.now());
    } catch (err) {
      setSubmitState({ status: 'error', message: String(err?.message || 'Erreur inconnue') });
    }
  };

  return (
    <div className="min-h-screen bg-[#060910] text-white">
    <Helmet>
        <title>{`LIRI · ${isnaTenantConfig.branding.name} & Ngowazulu — plateforme`}</title>
        <meta
          name="description"
          content={`${isnaTenantConfig.branding.fullName} — initiation en ligne, Smartboard, LIRI, chat immersif, certifications et réseau Ngowazulu. L'application membre est accessible après connexion.`}
        />
        <link rel="canonical" href="https://prorascience.com/" />
    </Helmet>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#060910]/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link to="/" className="text-sm font-semibold tracking-[0.2em] uppercase text-[var(--school-accent)]">
              {isnaTenantConfig.branding.name}
            </Link>
            <nav className="hidden items-center gap-6 text-sm text-gray-300 lg:flex">
              {commercialMenu.map((item) => (
                <a key={item.href} href={item.href} className="hover:text-white transition-colors">
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <Link to="/nous-contacter" className="rounded-lg border border-white/20 px-3 py-2 text-xs sm:text-sm hover:bg-white/5">
                Nous contacter
              </Link>
              <Link to="/app" className="rounded-lg bg-[var(--school-accent)] px-3 py-2 text-xs font-semibold text-black sm:text-sm hover:bg-[#e5c04a]">
                Accès membre
              </Link>
            </div>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {commercialMenu.map((item) => (
              <a
                key={`mobile-${item.href}`}
                href={item.href}
                className="shrink-0 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <section id="hero" className="relative overflow-hidden border-b border-white/10 bg-[#060910]">
        <HeroParallax
          products={PARALLAX_PRODUCTS}
          header={
            <div className="relative z-10 mx-auto max-w-7xl px-4 w-full">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--school-accent)]">Plateforme africaine premium</p>
              <h1 className="mt-5 max-w-5xl text-4xl font-semibold leading-tight text-white sm:text-6xl lg:text-7xl">
                Recevez les yeux pour voir et les oreilles pour comprendre.
              </h1>
              <p className="mt-6 max-w-3xl text-base text-gray-200 sm:text-xl">
                PRORASCIENCE redéfinit l&apos;initiation en ligne et l&apos;accompagnement de transformation: Smartboard initiatique,
                classes LIRI, chat immersif, certification et temple moderne Ngowazulu dans une expérience digitale afro-futuriste.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <a href="#produits" className="rounded-xl bg-[var(--school-accent)] px-6 py-3 font-semibold text-black hover:bg-[#e5c04a] inline-flex items-center gap-2">
                  Découvrir la plateforme <ArrowRight className="w-4 h-4" />
                </a>
                <Link to="/app" className="rounded-xl border border-white/20 px-6 py-3 hover:bg-white/10">
                  Entrer dans l&apos;espace membre
                </Link>
                <Link to="/nous-contacter" className="rounded-xl border border-white/20 px-6 py-3 hover:bg-white/10">
                  Parler à un conseiller
                </Link>
              </div>
              <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {TRUST_METRICS.map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-2xl font-semibold text-[var(--school-accent)]">{item.value}</p>
                    <p className="text-xs uppercase tracking-wider text-gray-400">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          }
        />
      </section>

      <section id="univers" className="border-b border-white/10 bg-[#070d18] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--school-accent)]">Site public complet</p>
          <h2 className="mt-4 text-3xl font-semibold sm:text-5xl">Deux univers, deux promesses, une même exigence</h2>
          <p className="mt-4 max-w-4xl text-gray-300">
            Le site grand public PRORASCIENCE s'articule en deux côtés distincts:
            l'univers école (compréhension, maîtrise, certification) et l\'univers temple
            (résolution, transformation, intervention). Chaque visiteur choisit sa porte d'entrée.
          </p>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <article className="rounded-3xl border border-blue-500/25 bg-blue-500/10 p-7">
              <p className="text-xs uppercase tracking-[0.2em] text-blue-200">Côté PRORASCIENCE</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">Comprendre avant d'agir</h3>
              <p className="mt-3 text-sm text-gray-200">
                Formation structurée, pédagogie immersive, outils high-tech et preuves de progression.
              </p>
              <a href="#prorascience-side" className="mt-5 inline-block rounded-lg bg-white/10 px-5 py-2.5 font-semibold hover:bg-white/20">
                Explorer le côté PRORASCIENCE
              </a>
            </article>
            <article className="rounded-3xl border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] p-7">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--school-accent)]">Côté NGOWAZULU</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">Transformer ce qui vous bloque</h3>
              <p className="mt-3 text-sm text-gray-200">
                Consultations, interventions, culte, hôpital traditionnel et communauté encadrée.
              </p>
              <a href="#ngowazulu-side" className="mt-5 inline-block rounded-lg bg-black/50 px-5 py-2.5 font-semibold hover:bg-black/70">
                Explorer le côté NGOWAZULU
              </a>
            </article>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#060b14] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--school-accent)]">Get the highlights</p>
          <h2 className="mt-4 text-3xl font-semibold sm:text-5xl">Les points essentiels à retenir en 20 secondes</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PRODUCT_HIGHLIGHTS.map((item) => (
              <article key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-300">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="hightech" className="border-b border-white/10 bg-[#070d18] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--school-accent)]">Acte I · Technologie d'apprentissage</p>
          <h2 className="mt-4 text-3xl font-semibold sm:text-5xl">L'apprentissage à distance, version haute intensité</h2>
          <p className="mt-4 max-w-4xl text-gray-300">
            PRORASCIENCE commence par une base technologique forte: LIRI, chat immersif, Smartboard, Neuron QR
            et certification pilotée. L'objectif n\'est pas l\'effet “outil”, mais une progression claire, profonde et mesurable.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {HIGH_TECH_LEARNING_STACK.map((item) => (
              <article key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-300">{item.text}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] p-6">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--school-accent)]">Dynamic prompt engine</p>
              <p className="mt-3 text-sm text-gray-200">Simulation d'expérience “AI studio” inspirée des pages SaaS dynamiques.</p>
              <div className="mt-4 rounded-xl border border-white/15 bg-black/30 p-4 text-sm text-white min-h-[72px] flex items-center">
                {DYNAMIC_PROMPTS[activePromptIndex]}
              </div>
              <p className="mt-3 text-xs text-gray-400">
                Prompt {activePromptIndex + 1}/{DYNAMIC_PROMPTS.length}
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--school-accent)]">Dynamic performance bars</p>
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <div className="mb-1 flex items-center justify-between text-gray-300">
                    <span>Immersion pédagogique</span>
                    <span>{dynamicLevel.immersion}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-[var(--school-accent)] transition-all duration-500" style={{ width: `${dynamicLevel.immersion}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-gray-300">
                    <span>Guidage intelligent</span>
                    <span>{dynamicLevel.guidance}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-blue-400 transition-all duration-500" style={{ width: `${dynamicLevel.guidance}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-gray-300">
                    <span>Exécution opérationnelle</span>
                    <span>{dynamicLevel.execution}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-emerald-400 transition-all duration-500" style={{ width: `${dynamicLevel.execution}%` }} />
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="science" className="border-b border-white/10 bg-[#090f1a] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--school-accent)]">Acte II · Narration scientifique</p>
          <h2 className="mt-4 text-3xl font-semibold sm:text-5xl">Expliquer ce qui était fait dans l'ignorance</h2>
          <p className="mt-4 max-w-4xl text-gray-300">
            La promesse PRORASCIENCE est simple: on ne vous demande pas de croire, on vous apprend à comprendre.
            Ce qui était flou devient lisible, ce qui était répétition devient méthode.
          </p>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {SCIENCE_NARRATIVE.map((item) => (
              <article key={item.title} className="rounded-2xl border border-white/10 bg-black/20 p-6">
                <p className="text-xs uppercase tracking-wider text-[var(--school-accent)]">{item.title}</p>
                <p className="mt-3 text-sm text-gray-200">{item.text}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] p-6">
            <p className="text-sm text-gray-200">
              Exemple de rupture pédagogique: libation, kola, gestes rituels et causalité énergétique sont abordés avec une grille
              rationnelle, des modèles explicatifs et une mise en pratique encadrée.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#070b14] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'Discours clair',
              text: 'Une promesse lisible: comprendre, exécuter, transformer.',
            },
            {
              title: 'Expérience premium',
              text: 'Design sobre, fort, cinématique et orienté conversion.',
            },
            {
              title: 'Exécution réelle',
              text: 'Au-delà du marketing: workflows, rendez-vous, opérations et suivi.',
            },
          ].map((item) => (
            <article key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-white">{item.title}</p>
              <p className="mt-2 text-sm text-gray-300">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="produits" className="border-b border-white/10 bg-[#080d17] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--school-accent)]">Présentation produit</p>
          <h2 className="mt-4 text-3xl sm:text-5xl font-semibold">Take a closer look</h2>
          <p className="mt-4 max-w-3xl text-gray-300">
            Une présentation en style “product page” : un bloc = une capacité business, avec bénéfice clair.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { title: 'Smartboard Initiatique', text: 'Décomposer les concepts complexes en logique visuelle simple, transmissible et mémorable.' },
              { title: 'LIRI Live Class', text: 'Classe immersive orientée compréhension active et mise en pratique en temps réel.' },
              { title: 'Chat Immersif', text: 'Guidage contextuel intelligent pour orienter le membre vers la bonne action.' },
              { title: 'Certification', text: 'Validation progressive des acquis avec trajectoire lisible et crédible.' },
            ].map((item) => (
              <article key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-300">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="institution" className="border-b border-white/10 bg-[#0b111b] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--school-accent)]">Socle institutionnel</p>
          <h2 className="mt-4 text-3xl sm:text-5xl font-semibold">Une école initiatique documentée, structurée et transmissible</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-semibold text-white">Mission PRORASCIENCE</h3>
              <p className="mt-2 text-sm text-gray-300">
                Restaurer la dignité intellectuelle et spirituelle par une approche qui unit science, tradition et méthode.
              </p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-semibold text-white">Axes ISNA</h3>
              <p className="mt-2 text-sm text-gray-300">
                Cursus, modules, pratique guidée, coaching et progression certifiante pour passer de la croyance à la maîtrise.
              </p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-semibold text-white">Ngowazulu</h3>
              <p className="mt-2 text-sm text-gray-300">
                Consultations, interventions, hôpital traditionnel, rites en ligne et communauté encadrée.
              </p>
            </article>
          </div>
          <div className="mt-8 rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--school-accent)]">Positionnement de marque</p>
            <p className="mt-3 max-w-5xl text-sm text-gray-200 sm:text-base">
              PRORASCIENCE n&apos;est ni une simple école en ligne, ni un service spirituel générique. C&apos;est une architecture
              de transformation qui relie la compréhension (ISNA) et l&apos;intervention (Ngowazulu), avec des standards
              de qualité, de traçabilité et de responsabilité.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/a-propos" className="rounded-lg border border-white/20 px-5 py-2.5 hover:bg-white/10">
              Lire la présentation complète
            </Link>
            <Link to="/a-propos/fondateur" className="rounded-lg border border-white/20 px-5 py-2.5 hover:bg-white/10">
              Vision du fondateur
            </Link>
          </div>
        </div>
      </section>

      <section id="prorascience-side" className="border-b border-white/10 bg-[#060b14] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs uppercase tracking-[0.24em] text-blue-300">Côté PRORASCIENCE</p>
          <h2 className="mt-4 text-3xl font-semibold sm:text-5xl">Narration produit PRORASCIENCE</h2>
          <p className="mt-4 max-w-4xl text-gray-300">
            Ici, la promesse est cognitive et opérationnelle: transformer l'ignorance en compréhension,
            puis la compréhension en compétence mesurable.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {PRORASCIENCE_PRODUCTS.map((item) => (
              <article key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-300">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="isna" className="border-b border-white/10 bg-[#090d16] px-4 py-20 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--school-accent)]">ISNA · École initiatique</p>
            <h2 className="mt-4 text-3xl font-semibold sm:text-5xl">Former des profils qui comprennent avant d'agir</h2>
            <p className="mt-5 text-gray-300">
              ISNA transforme les pratiques en expertise transmissible: pédagogie structurée, suivi, outils immersifs, et résultats mesurables.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-gray-200">
              {[
                'Parcours pédagogique structuré',
                'Cours immersifs et mentorat',
                'Smartboard pour visualiser les principes',
                'Certification progressive des compétences',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--school-accent)]" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-7 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wider text-[var(--school-accent)]">Promesse ISNA</p>
              <p className="mt-2 text-sm text-gray-300">
                Passer de &quot;je reproduis des gestes&quot; à &quot;je comprends, j&apos;explique et je transmets&quot;.
              </p>
            </div>
            <Link to="/isna" className="mt-8 inline-block rounded-lg bg-[var(--school-accent)] px-5 py-2.5 font-semibold text-black hover:bg-[#e5c04a]">
              Voir toute l'offre ISNA
            </Link>
          </div>
          <img
            src="https://images.unsplash.com/photo-1529390079861-591de354faf5?auto=format&fit=crop&w=1600&q=80"
            alt="Salle de classe africaine moderne"
            className="w-full h-[420px] object-cover rounded-3xl border border-white/10"
          />
        </div>
      </section>

      <section id="ngowazulu" className="border-b border-white/10 px-4 py-20 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2 items-center">
          <img
            src="https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?auto=format&fit=crop&w=1600&q=80"
            alt="Temple africain moderne et spirituel"
            className="w-full h-[420px] object-cover rounded-3xl border border-white/10"
          />
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--school-accent)]">Ngowazulu · Temple moderne</p>
            <h2 className="mt-4 max-w-4xl text-3xl font-semibold sm:text-5xl">
              Un espace de transformation profonde, ancré dans une vision africaine contemporaine
            </h2>
            <p className="mt-5 text-gray-300">
              Ngowazulu opère sur des problématiques réelles avec cadre, confidentialité et suivi : consultations, interventions,
              rituels en ligne, accompagnement communautaire.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                'Consultations orientées résolution',
                'Interventions ciblées',
                'Rituels en ligne (vendredi/dimanche)',
                'Suivi dossier et traçabilité',
              ].map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-gray-200">
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-7 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wider text-[var(--school-accent)]">Promesse Ngowazulu</p>
              <p className="mt-2 text-sm text-gray-300">
                Vous venez pour résoudre une impasse réelle, avec une méthode, une équipe et un suivi responsable.
              </p>
            </div>
            <Link to="/temple-ngowazulu" className="mt-8 inline-block rounded-lg bg-[var(--school-accent)] px-5 py-2.5 font-semibold text-black hover:bg-[#e5c04a]">
              Voir toute l'offre Ngowazulu
            </Link>
          </div>
        </div>
      </section>

      <section id="temple-galerie" className="relative h-[88vh] w-full overflow-hidden border-b border-white/10 bg-black">
        <InfiniteGallery
          images={TEMPLE_GALLERY}
          speed={1.2}
          visibleCount={9}
          className="h-full w-full"
        />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center mix-blend-exclusion">
          <p className="text-xs uppercase tracking-[0.3em] text-white/90">Temple Ngowazulu</p>
          <h2 className="mt-3 font-semibold text-4xl text-white sm:text-6xl">Entrez dans le temple</h2>
        </div>
        <div className="pointer-events-none absolute bottom-6 left-0 right-0 text-center font-mono text-[11px] uppercase tracking-wider text-white/60">
          Molette, flèches ou tactile pour naviguer · défilement auto après 3s
        </div>
      </section>

      <section id="ngowazulu-side" className="border-b border-white/10 bg-[#090d16] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--school-accent)]">Côté NGOWAZULU</p>
          <h2 className="mt-4 text-3xl font-semibold sm:text-5xl">Narration produit NGOWAZULU</h2>
          <p className="mt-4 max-w-4xl text-gray-300">
            Ici, la promesse est transformationnelle: traiter des cas réels, avec confidentialité,
            méthode, suivi opérationnel et appui communautaire.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {NGOWAZULU_PRODUCTS.map((item) => (
              <article key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-300">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#0b111b] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--school-accent)]">Acte III · Univers Ngowazulu</p>
          <h2 className="mt-4 text-3xl font-semibold sm:text-5xl">Temple, communauté, culte, hôpital : un système vivant</h2>
          <p className="mt-4 max-w-4xl text-gray-300">
            Ngowazulu ne se limite pas à une consultation ponctuelle. C&apos;est un pôle d&apos;intervention continue
            avec protocole, communauté active, discipline collective et accompagnement de transformation.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {NGOWAZULU_UNIVERSE.map((item) => (
              <article key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-300">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="innovation" className="border-b border-white/10 bg-[#090d16] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--school-accent)]">Innovation & avantages</p>
          <h2 className="mt-4 text-3xl font-semibold sm:text-5xl">Fast runs in the family — version PRORASCIENCE</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="text-sm font-semibold text-white">Produit unifié</p>
              <p className="mt-2 text-sm text-gray-300">Un seul écosystème pour l'apprentissage, le suivi et la transformation.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="text-sm font-semibold text-white">Expérience premium</p>
              <p className="mt-2 text-sm text-gray-300">UI immersive, workflow intelligent, et accompagnement humain assisté par la donnée.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="text-sm font-semibold text-white">Résultats traçables</p>
              <p className="mt-2 text-sm text-gray-300">SLA, timelines, rendez-vous, certifications et preuves de progression.</p>
            </div>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {[
              {
                title: '1. Diagnostic',
                text: 'Évaluation du besoin, qualification du niveau et orientation vers le bon pôle.',
              },
              {
                title: '2. Exécution',
                text: 'Activation du parcours ISNA ou du protocole Ngowazulu, avec rendez-vous et jalons.',
              },
              {
                title: '3. Traçabilité',
                text: 'Suivi des décisions, des interventions, des progrès et des retours membres.',
              },
            ].map((item) => (
              <article key={item.title} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <h3 className="text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-300">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#0a0f19] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--school-accent)]">Expérience client</p>
          <h2 className="mt-4 text-3xl font-semibold sm:text-5xl">Ce que ressent un membre en entrant dans l'écosystème</h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            {[
              'Clarté immédiate sur l\'offre adaptée à son besoin.',
              'Accompagnement guidé, sans confusion entre école et temple.',
              'Sentiment d\'expertise, de méthode et de sérieux.',
              'Passage naturel vers l\'espace membre pour exécution.',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-gray-200">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#070b14] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--school-accent)]">Comparatif de valeur</p>
          <h2 className="mt-4 text-3xl font-semibold sm:text-5xl">Ancien modèle vs PRORASCIENCE</h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-red-500/25 bg-red-500/5 p-6">
              <h3 className="text-lg font-semibold text-white">Ancienne approche</h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-300">
                <li>- Pratique répétée sans explication.</li>
                <li>- Peu de structure et faible mesure des progrès.</li>
                <li>- Expérience fragmentée entre contenu, support et action.</li>
              </ul>
            </article>
            <article className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-6">
              <h3 className="text-lg font-semibold text-white">Approche PRORASCIENCE</h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-200">
                <li>- Compréhension systémique avant exécution.</li>
                <li>- Parcours structuré, suivi et standards de qualité.</li>
                <li>- Écosystème complet : apprentissage, transformation, preuve.</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section id="fondateur" className="border-b border-white/10 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl grid gap-8 lg:grid-cols-2 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--school-accent)]">Le fondateur</p>
            <h2 className="mt-4 text-3xl sm:text-5xl font-semibold">Une vision : relier connaissance, conscience et impact</h2>
            <p className="mt-5 text-gray-300">
              Le fondateur de PRORASCIENCE porte une ambition claire : structurer l'initiation africaine dans un modèle moderne,
              compréhensible et transmissible, tout en préservant sa profondeur.
            </p>
            <Link to="/a-propos/fondateur" className="mt-7 inline-block rounded-lg border border-white/20 px-5 py-2.5 hover:bg-white/10">
              Lire le profil du fondateur
            </Link>
          </div>
          <img
            src="/founder.jpg"
            alt="Portrait du fondateur"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/founder.png';
            }}
            className="w-full h-[420px] object-cover rounded-3xl border border-white/10"
          />
        </div>
      </section>

    <section id="temoignages" className="border-b border-white/10 bg-[#090d16] px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--school-accent)]">Preuve sociale réelle</p>
            <h2 className="mt-4 text-3xl font-semibold sm:text-5xl">Témoignages vérifiables de nos membres</h2>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-wider text-gray-400">Note moyenne</p>
            <p className="text-2xl font-semibold text-[var(--school-accent)]">
              {Number(reviewSummary?.global?.average || 0).toFixed(1)} / 5
            </p>
            <p className="text-xs text-gray-400">{Number(reviewSummary?.global?.total || 0)} avis publiés</p>
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 grid gap-4 md:grid-cols-2">
            {loadingReviews ? (
              <p className="text-sm text-gray-400">Chargement des témoignages...</p>
            ) : featuredReviews.length ? (
              featuredReviews.map((item) => (
                <article key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-[var(--school-accent)]">{renderStars(item.rating)}</p>
                  <p className="mt-3 text-sm text-gray-200">"{item.review_text}"</p>
                  <div className="mt-4 text-xs text-gray-400">
                    <p className="font-medium text-white">
                      {item.author_name}
                      {item.is_verified ? <span className="ml-2 text-emerald-300">• Vérifié</span> : null}
                    </p>
                    <p>{item.author_role || 'Membre PRORASCIENCE'} • {String(item.source || '').toUpperCase()}</p>
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm text-gray-400">Aucun témoignage publié pour le moment.</p>
            )}
          </div>

          <form onSubmit={onSubmitReview} className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
            <p className="text-sm font-semibold text-white">Laisser un avis réel</p>
            <p className="text-xs text-gray-400">Votre témoignage est modéré avant publication.</p>
            <select
              value={reviewForm.source}
              onChange={(e) => setReviewForm((prev) => ({ ...prev, source: e.target.value }))}
              className="w-full rounded-lg border border-white/20 bg-[#0b1220] px-3 py-2 text-sm"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <input
              value={reviewForm.authorName}
              onChange={(e) => setReviewForm((prev) => ({ ...prev, authorName: e.target.value }))}
              className="w-full rounded-lg border border-white/20 bg-[#0b1220] px-3 py-2 text-sm"
              placeholder="Votre nom"
              required
            />
            <input
              value={reviewForm.authorRole}
              onChange={(e) => setReviewForm((prev) => ({ ...prev, authorRole: e.target.value }))}
              className="w-full rounded-lg border border-white/20 bg-[#0b1220] px-3 py-2 text-sm"
              placeholder="Votre fonction (optionnel)"
            />
            <input
              type="number"
              min="1"
              max="5"
              value={reviewForm.rating}
              onChange={(e) => setReviewForm((prev) => ({ ...prev, rating: Number(e.target.value) || 5 }))}
              className="w-full rounded-lg border border-white/20 bg-[#0b1220] px-3 py-2 text-sm"
            />
            <textarea
              value={reviewForm.reviewText}
              onChange={(e) => setReviewForm((prev) => ({ ...prev, reviewText: e.target.value }))}
              className="w-full rounded-lg border border-white/20 bg-[#0b1220] px-3 py-2 text-sm"
              placeholder="Votre retour d'expérience..."
              rows={4}
              required
            />
            <input
              value={reviewForm.website}
              onChange={(e) => setReviewForm((prev) => ({ ...prev, website: e.target.value }))}
              className="hidden"
              tabIndex={-1}
              autoComplete="off"
              placeholder="Website"
            />
            <button
              type="submit"
              disabled={submitState.status === 'submitting'}
              className="w-full rounded-lg bg-[var(--school-accent)] px-4 py-2 text-sm font-semibold text-black hover:bg-[#e5c04a] disabled:opacity-60"
            >
              {submitState.status === 'submitting' ? 'Envoi...' : 'Envoyer mon témoignage'}
            </button>
            {submitState.message ? (
              <p className={`text-xs ${submitState.status === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>
                {submitState.message}
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </section>

      <section id="offres" className="px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--school-accent)]">Tarifs & accès</p>
        <h2 className="mt-4 text-3xl font-semibold sm:text-5xl">Choisissez votre accompagnement</h2>
        <p className="mt-4 max-w-3xl text-gray-300">
          ISNA pour apprendre et structurer, Ngowazulu pour être accompagné et transformer.
          Paiement sécurisé par Mobile Money (PawaPay) ou carte.
        </p>

        {/* Pôle École — ISNA + Consultation Ngowazulu */}
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <article className="flex flex-col rounded-3xl border border-white/10 bg-white/5 p-7">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--school-accent)]">Pôle École — ISNA</p>
            <h3 className="mt-2 text-2xl font-semibold">Académie ISNA</h3>
            <p className="mt-3 text-sm text-gray-300">Programmes structurés, modules, progression encadrée et accompagnement pédagogique.</p>
            <p className="mt-4 text-3xl font-semibold text-white">
              {billingCycle === 'monthly' ? '49€' : '39€'}
              <span className="ml-1 text-sm font-normal text-gray-400">/ mois</span>
            </p>
            <div className="mt-4 inline-flex w-fit rounded-full border border-white/20 bg-white/5 p-1 text-xs">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`rounded-full px-3 py-1 transition-colors ${billingCycle === 'monthly' ? 'bg-[var(--school-accent)] text-black' : 'text-gray-300 hover:text-white'}`}
              >
                Mensuel
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`rounded-full px-3 py-1 transition-colors ${billingCycle === 'annual' ? 'bg-[var(--school-accent)] text-black' : 'text-gray-300 hover:text-white'}`}
              >
                Annuel
              </button>
            </div>
            <div className="mt-auto pt-6">
              <Link to="/t/isna/signup" className="inline-block rounded-lg bg-[var(--school-accent)] px-5 py-2.5 font-semibold text-black hover:bg-[#e5c04a]">
                Rejoindre l'académie
              </Link>
            </div>
          </article>
          <article className="flex flex-col rounded-3xl border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] p-7">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--school-accent)]">Pôle Temple — Ngowazulu</p>
            <h3 className="mt-2 text-2xl font-semibold">Consultation individuelle</h3>
            <p className="mt-3 text-sm text-gray-200">Séance de 90 minutes : diagnostic des blocages, priorisation des urgences et plan d'action personnalisé.</p>
            <p className="mt-4 text-3xl font-semibold text-white">90 min<span className="ml-1 text-sm font-normal text-gray-300"> · sur rendez-vous</span></p>
            <div className="mt-auto flex flex-wrap gap-3 pt-6">
              <Link to={NGOWAZULU_CONSULTATION_NEXT_PATH} className="inline-block rounded-lg bg-[var(--school-accent)] px-5 py-2.5 font-semibold text-black hover:bg-[#e5c04a]">
                Réserver une consultation
              </Link>
              <Link to="/t/isna/paiement?type=don" className="inline-block rounded-lg border border-white/20 px-5 py-2.5 font-semibold hover:bg-white/10">
                Faire une offrande
              </Link>
            </div>
          </article>
        </div>

        {/* Pôle Temple — Mentorat Ngowazulu (abonnement mensuel) */}
        <div className="mt-12">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--school-accent)]">Mentorat Ngowazulu — abonnement mensuel</p>
          <h3 className="mt-2 text-2xl font-semibold sm:text-3xl">Quatre paliers d'accompagnement</h3>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ngowazuluMentoratOffers.map((offer) => (
              <article
                key={offer.slug}
                className={`flex flex-col rounded-3xl border bg-gradient-to-b p-6 ${offer.accent}`}
              >
                <span className={`self-start rounded-full border px-3 py-1 text-xs font-semibold ${offer.badgeClass}`}>
                  {offer.commercialName}
                </span>
                <h4 className="mt-3 text-lg font-semibold text-white">{offer.subtitle}</h4>
                <p className="mt-3 text-2xl font-semibold text-white">{offer.priceLabel}</p>
                <p className="mt-1 text-sm text-gray-300">{offer.frequencyShort}</p>
                <p className="mt-3 flex-1 text-xs leading-relaxed text-gray-400">{offer.detailIntro}</p>
                <Link
                  to={`/t/isna/paiement?plan=${offer.slug}`}
                  className="mt-5 inline-block rounded-lg bg-[var(--school-accent)] px-4 py-2.5 text-center text-sm font-semibold text-black hover:bg-[#e5c04a]"
                >
                  S'abonner
                </Link>
              </article>
            ))}
          </div>
          <p className="mt-4 text-xs text-gray-500">
            Contrat mensuel renouvelable. La fréquence des rencontres correspond au palier choisi ; le calendrier précis se valide avec le temple.
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-gray-300">
          <p className="font-semibold text-white">Important</p>
          <p className="mt-2">
            Le site public présente la solution et ses offres. L'application complète (cours, outils internes,
            dossiers, opérations) est volontairement accessible uniquement après connexion dans l'espace membre.
          </p>
        </div>
      </div>
      </section>

      <section id="cta" className="border-y border-white/10 bg-[#090d16] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="text-3xl sm:text-5xl font-semibold">Le site vitrine présente. L'application exécute.</h2>
          <p className="mt-4 text-gray-300">
            Accédez à l'espace applicatif uniquement via connexion membre.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link to="/app" className="rounded-xl bg-[var(--school-accent)] px-6 py-3 font-semibold text-black hover:bg-[#e5c04a]">
              Aller à l'accès membre
            </Link>
            <Link to="/signup" className="rounded-xl border border-white/20 px-6 py-3 hover:bg-white/10">
              Créer un compte
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-black px-4 py-10 sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-4 text-sm text-gray-400 sm:grid-cols-2 lg:grid-cols-5">
        <p className="font-semibold text-white">{isnaTenantConfig.branding.name}</p>
        <Link to="/a-propos" className="hover:text-white">À propos</Link>
        <Link to="/faq" className="hover:text-white">FAQ</Link>
        <Link to="/nous-contacter" className="hover:text-white">Contact</Link>
          <Link to="/app" className="hover:text-white">Accès membre</Link>
      </div>
    </footer>
    </div>
  );
};

export default LandingPage;
