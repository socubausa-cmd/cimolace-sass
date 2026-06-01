import Link from "next/link";
import type { Metadata } from "next";
import { getOnboardingUrl } from "@/lib/urls";

export const metadata: Metadata = {
  title: "LIRI — Le moteur live & IA universel | Cimolace",
  description:
    "Live HD, IA temps réel, Studio, Smartboard, Masterclass Factory, multilingue, recall. Intégrable dans WordPress, Wix ou tout site via SDK, embed ou API. À partir de 0 €/mois.",
  openGraph: {
    title: "LIRI — Le moteur live & IA universel pour tout site",
    description:
      "Zoom-level live + IA dans n'importe quel site. SDK, embed widget, API REST publique, webhooks.",
    type: "website",
    locale: "fr_FR",
  },
};

const FEATURES = [
  {
    emoji: "🎥",
    title: "Live HD multi-participants",
    desc: "LiveKit WebRTC. Jusqu'à 1000 participants. Enregistrement automatique, replay illimité.",
  },
  {
    emoji: "🎨",
    title: "Studio créateur",
    desc: "Construis une présentation live en temps réel. Slides, médias, annotations IA.",
  },
  {
    emoji: "📝",
    title: "Smartboard interactif",
    desc: "Tableau blanc collaboratif avec assistant IA. Reconnaissance d'écriture, OCR, formules.",
  },
  {
    emoji: "🎓",
    title: "Masterclass Factory",
    desc: "Génère un cours complet en 30 sec à partir d'un sujet. Groq + DeepSeek + GPT.",
  },
  {
    emoji: "🧑‍🏫",
    title: "Coach Slide & Formation Engine",
    desc: "Coaching slide-par-slide, narration IA, quiz auto, mind-maps.",
  },
  {
    emoji: "🌍",
    title: "Multilingue temps réel",
    desc: "Traduction live, sous-titres 30+ langues. Pour réunions internationales.",
  },
  {
    emoji: "🔁",
    title: "Recall & Transcription",
    desc: "Whisper Groq. Transcripts horodatés, résumés IA, points-clés extraits.",
  },
  {
    emoji: "🔊",
    title: "TTS & STT premium",
    desc: "ElevenLabs Flash + Google Studio voices. 30+ langues, latence < 200 ms.",
  },
  {
    emoji: "🧩",
    title: "SDK universel",
    desc: "Une ligne dans WordPress, Wix, Shopify, code custom. Inclut UI prête à brancher.",
  },
  {
    emoji: "🪟",
    title: "Embed widget",
    desc: "iframe sécurisée embed.cimolace.space. Pour les CMS qui bloquent les scripts tiers.",
  },
  {
    emoji: "🛰️",
    title: "API REST publique",
    desc: "api.cimolace.space — créer sessions, tokens, exports, webhooks. Authent X-API-Key.",
  },
  {
    emoji: "💳",
    title: "LIRI Credits intégrés",
    desc: "Facturation IA à l'usage. Quotas mensuels + packs de recharge. Stripe Checkout natif.",
  },
];

const USE_CASES = [
  {
    icon: "🏫",
    title: "Écoles & Universités",
    desc: "Cours live, masterclasses, Smartboard pédagogique, présence auto, replay sécurisé.",
  },
  {
    icon: "💼",
    title: "Webinaires & Marketing",
    desc: "Lancements produits, démos, conférences. Embed dans landing page, capture leads.",
  },
  {
    icon: "🩺",
    title: "Consultations & Téléconsult",
    desc: "Avec MedOS : visio HD chiffrée, notes SOAP auto, ordonnances numériques.",
  },
  {
    icon: "🎤",
    title: "Coaching & Mentorat",
    desc: "1-to-1 ou 1-to-many. Coach slide IA, follow-up auto, paiement par session.",
  },
  {
    icon: "🏛️",
    title: "Conférences & Événements",
    desc: "Streaming HD, multilingue temps réel, billetterie Stripe intégrée.",
  },
  {
    icon: "🎙️",
    title: "Podcasts & Talk-shows live",
    desc: "Enregistrement multi-piste, transcripts auto, clips highlights IA.",
  },
];

export default function LiriPage() {
  const onboard = getOnboardingUrl();
  return (
    <>
      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-black min-h-[80vh] flex flex-col justify-center">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-500/15 rounded-full blur-[100px]" />
        </div>
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-12 text-center">
          <p className="text-sm font-semibold tracking-[0.2em] uppercase text-indigo-400/60 mb-6">
            Cimolace OS
          </p>
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight text-white mb-6">
            LIRI<span className="text-indigo-400">.</span>
          </h1>
          <p className="text-xl md:text-2xl text-white/50 max-w-2xl mx-auto mb-4 font-medium">
            Le moteur live & IA universel.
          </p>
          <p className="text-base md:text-lg text-white/40 max-w-xl mx-auto mb-4">
            Live HD, Studio, Smartboard, Masterclass Factory, multilingue, recall.
            <br />
            Intégrable dans <span className="text-white/60">WordPress</span>,{" "}
            <span className="text-white/60">Wix</span>, ou n&apos;importe quel site.
          </p>
          <p className="text-sm text-white/30 mb-8">
            À partir de <span className="text-white/60 font-semibold">0 €/mois</span> — Plan gratuit avec 500 crédits IA
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={onboard}
              className="inline-flex items-center justify-center gap-2 bg-indigo-500 text-white px-10 py-4 rounded-full text-lg font-semibold hover:bg-indigo-600 transition-all"
            >
              Créer mon espace LIRI →
            </Link>
            <Link
              href="/liri/integration"
              className="inline-flex items-center justify-center gap-2 border border-white/20 text-white px-10 py-4 rounded-full text-lg font-medium hover:bg-white/10 transition-all"
            >
              Doc d&apos;intégration
            </Link>
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section className="relative bg-white py-28">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm font-semibold tracking-[0.2em] uppercase text-slate-400 mb-4">
            12 modes LIRI
          </p>
          <h2 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6">
            Un moteur. Toutes les expériences live.
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            LIRI réunit tout ce dont tu as besoin pour faire du live moderne : vidéo,
            IA, présentations, multilingue, replay, facturation. Une seule intégration.
          </p>
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto mt-12">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-left hover:border-indigo-200 hover:shadow-sm transition-all"
              >
                <div className="text-2xl mb-3">{f.emoji}</div>
                <h3 className="font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── USE CASES ─────────────────────────────────────────────────────── */}
      <section className="relative bg-slate-50 py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-indigo-600 mb-4">
              Cas d&apos;usage
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Pensé pour ton métier.
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              LIRI s&apos;adapte à n&apos;importe quel scénario live, IA-augmenté.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {USE_CASES.map((uc) => (
              <div
                key={uc.title}
                className="bg-white border border-slate-200 rounded-2xl p-7"
              >
                <div className="text-3xl mb-3">{uc.icon}</div>
                <h3 className="font-bold text-slate-900 mb-2 text-lg">{uc.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{uc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INTÉGRATION QUICK PEEK ────────────────────────────────────────── */}
      <section className="relative bg-slate-900 py-28">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-sm font-semibold tracking-[0.2em] uppercase text-indigo-400/80 mb-4">
            Intégration
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            6 lignes. C&apos;est tout.
          </h2>
          <p className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto">
            Colle ce snippet dans ton site WordPress, Wix, Shopify ou code custom. LIRI
            se charge du reste.
          </p>
          <div className="text-left bg-slate-950 border border-slate-800 rounded-2xl p-6 font-mono text-sm overflow-x-auto">
            <pre className="text-slate-300 leading-relaxed">{`<script src="https://cimolace.space/liri-sdk.js"></script>
<div id="liri-live" data-tenant="mon-ecole" data-mode="live"></div>
<script>
  LIRI.init({ tenant: "mon-ecole", apiKey: "lk_pub_..." });
  LIRI.start("liri-live");
</script>`}</pre>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/liri/integration"
              className="inline-flex items-center justify-center gap-2 bg-indigo-500 text-white px-8 py-3 rounded-full text-base font-semibold hover:bg-indigo-600 transition-all"
            >
              Lire la doc complète →
            </Link>
            <a
              href="https://api.cimolace.space/docs"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 border border-white/20 text-white px-8 py-3 rounded-full text-base font-medium hover:bg-white/10 transition-all"
            >
              Swagger API
            </a>
          </div>
        </div>
      </section>

      {/* ── PRICING TEASER ────────────────────────────────────────────────── */}
      <section className="relative bg-white py-24">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-sm font-semibold tracking-[0.2em] uppercase text-slate-400 mb-4">
            LIRI Credits
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Paye uniquement ce que tu consommes.
          </h2>
          <p className="text-lg text-slate-500 mb-10 max-w-2xl mx-auto">
            Quota mensuel inclus dans ton plan + packs de recharge à la demande. Tout
            via Stripe.
          </p>
          <div className="grid md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { label: "Pack Starter", credits: "1 000", price: "15 €", bonus: "" },
              { label: "Pack Pro", credits: "5 500", price: "70 €", bonus: "+10 %" },
              { label: "Pack Business", credits: "24 000", price: "250 €", bonus: "+20 %" },
              { label: "Pack Entreprise", credits: "130 000", price: "1 000 €", bonus: "+30 %" },
            ].map((p) => (
              <div
                key={p.label}
                className="border border-slate-200 rounded-2xl p-5 text-left hover:border-indigo-300 transition-all"
              >
                <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">
                  {p.label}
                </p>
                <p className="text-3xl font-bold text-slate-900">{p.credits}</p>
                <p className="text-xs text-slate-500 mb-3">crédits LIRI</p>
                <p className="text-lg font-semibold text-indigo-600">{p.price}</p>
                {p.bonus && (
                  <p className="text-xs text-emerald-600 font-medium mt-1">
                    {p.bonus} bonus
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-400 mt-8">
            1 LIRI Credit ≈ 0,001 €. 1 minute TTS premium ≈ 1 crédit. 1 min Whisper STT
            ≈ 0,5 crédit. Détails dans la doc.
          </p>
        </div>
      </section>

      {/* ── CTA FINAL ─────────────────────────────────────────────────────── */}
      <section className="relative bg-indigo-500 py-20 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Prêt à brancher LIRI à ton site ?
          </h2>
          <p className="text-indigo-100 mb-8">
            Compte gratuit en 1 min. 500 crédits IA offerts pour tester.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={onboard}
              className="inline-flex items-center justify-center gap-2 bg-white text-indigo-600 px-10 py-4 rounded-full text-lg font-semibold hover:bg-indigo-50 transition-all"
            >
              Créer mon espace LIRI →
            </Link>
            <Link
              href="/liri/integration"
              className="inline-flex items-center justify-center gap-2 border border-white/40 text-white px-10 py-4 rounded-full text-lg font-medium hover:bg-white/10 transition-all"
            >
              Lire la doc
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
