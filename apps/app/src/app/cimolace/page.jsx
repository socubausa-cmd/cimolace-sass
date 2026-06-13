"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ArrowRight,
  Package,
  Truck,
  CreditCard,
  LayoutDashboard,
  CalendarDays,
  Video,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Globe2,
  BarChart3,
  X,
  User,
  Mail,
  Phone,
  Wallet,
  Smartphone,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// ─── Data ──────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: Package,
    title: "Smart Packing",
    text: "Prévision des cartons, poids, volume et emballage intelligent avant paiement.",
  },
  {
    icon: Truck,
    title: "Devis livraison",
    text: "Calcul des frais de livraison, transporteurs, taxes et suivi des expéditions.",
  },
  {
    icon: CreditCard,
    title: "Paiement sécurisé",
    text: "Paiement en ligne, liens de paiement, commandes et validation automatique.",
  },
  {
    icon: LayoutDashboard,
    title: "Back-office entreprise",
    text: "Gestion produits, commandes, clients, promotions, SEO, marketing et finance.",
  },
  {
    icon: MessageCircle,
    title: "Relation client",
    text: "Chat, conversations internes, suivi client, notifications et support intégré.",
  },
  {
    icon: BarChart3,
    title: "Croissance",
    text: "SEO, blog, rédaction produit, marketing, analyse ventes et optimisation continue.",
  },
];

const setupItems = [
  "Reprise ou création du front-end boutique",
  "Back-office personnalisé niveau entreprise",
  "Connexion paiement, livraison, taxes et suivi",
  "Nom de domaine, DNS, Google Search Console et Analytics",
  "Déploiement cloud et mise en production",
  "Formation de démarrage à l'utilisation",
];

const plans = [
  {
    name: "Start",
    price: "150€",
    period: "/ mois",
    yearly: "1 500€ / an",
    badge: "Base professionnelle",
    intent: "Faire fonctionner la boutique",
    description:
      "Pour lancer une boutique fiable avec hébergement, maintenance, livraison et logistique intelligente.",
    includes: [
      "Hébergement sécurisé",
      "Maintenance technique",
      "Mises à jour sécurité",
      "Moteur de devis logistique",
      "Emballage intelligent / smart packing",
      "Calcul taxes et livraison",
      "Suivi commandes et expéditions",
      "Support standard",
    ],
    excludes: [
      "Optimisation SEO avancée",
      "Rédaction produit / blog",
      "Processeur comptable avancé",
      "Gestion marketing complète",
      "Chat interne avancé",
    ],
  },
  {
    name: "Business",
    price: "200€",
    period: "/ mois",
    yearly: "2 000€ / an",
    badge: "Recommandé",
    intent: "Vendre mieux et développer le trafic",
    description:
      "Le meilleur équilibre pour transformer la boutique en outil de vente optimisé et suivi.",
    highlighted: true,
    includes: [
      "Tout Start inclus",
      "Optimisation SEO produits",
      "Référencement produit",
      "Assistance rédaction fiches produits",
      "Création et gestion blog",
      "Outils marketing et promotions",
      "Chat / conversations internes",
      "Processeur comptabilité simplifié",
      "Analyse ventes et amélioration continue",
      "Support prioritaire",
    ],
    excludes: [
      "Live intégré (offre Entreprise)",
      "Calendrier intelligent avancé",
      "Application mobile de suivi",
    ],
  },
  {
    name: "Entreprise",
    price: "300€",
    period: "/ mois",
    yearly: "3 000€ / an",
    badge: "Plateforme avancée",
    intent: "Vendre, organiser et automatiser",
    description:
      "Pour créer une plateforme complète avec live, rendez-vous, calendrier intelligent et suivi mobile.",
    includes: [
      "Tout Business inclus",
      "LIRI Live intégré au site",
      "Création de lives depuis le back-office",
      "Rendez-vous vidéo intégrés type Zoom interne",
      "Calendrier intelligent",
      "Suivi client depuis application mobile",
      "Automatisation marketing avancée",
      "Analyse client et accompagnement stratégique",
    ],
    excludes: [],
  },
];

// ─── Payment methods config ─────────────────────────────────────────────────

const PAYMENT_METHODS = [
  {
    id: "stripe",
    label: "Carte bancaire",
    sub: "Visa · Mastercard · CB",
    icon: CreditCard,
    color: "text-violet-300",
    bg: "bg-violet-500/15",
    border: "border-violet-400/30",
    needsForm: false,
  },
  {
    id: "paypal",
    label: "PayPal",
    sub: "Compte PayPal · Carte",
    icon: Wallet,
    color: "text-blue-300",
    bg: "bg-blue-500/15",
    border: "border-blue-400/30",
    needsForm: true,
  },
  {
    id: "chariow",
    label: "Chariow",
    sub: "Mobile Money · Carte locale",
    icon: Smartphone,
    color: "text-emerald-300",
    bg: "bg-emerald-500/15",
    border: "border-emerald-400/30",
    needsForm: true,
  },
];

// ─── Sub-components ─────────────────────────────────────────────────────────

function PlanCard({ plan, selected, onSelect }) {
  const isSelected = selected === plan.name;
  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 240, damping: 18 }}
      className="h-full"
    >
      <Card
        className={[
          "h-full overflow-hidden rounded-3xl border backdrop-blur-xl text-white",
          plan.highlighted
            ? "border-white/30 bg-white/[0.15] shadow-2xl shadow-cyan-500/10"
            : "border-white/10 bg-white/[0.08]",
        ].join(" ")}
      >
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/80">
                {plan.badge}
              </p>
              <h3 className="mt-2 text-3xl font-semibold">{plan.name}</h3>
            </div>
            {plan.highlighted && (
              <span className="shrink-0 rounded-full bg-cyan-300 px-3 py-1 text-xs font-bold text-slate-950">
                Choix conseillé
              </span>
            )}
          </div>

          <div className="mt-6 flex items-end gap-1">
            <span className="text-5xl font-black">{plan.price}</span>
            <span className="pb-2 text-white/70">{plan.period}</span>
          </div>
          <p className="mt-1 text-sm text-cyan-100/80">{plan.yearly}</p>

          <p className="mt-5 font-semibold text-white">{plan.intent}</p>
          <p className="mt-2 text-sm leading-6 text-white/70">{plan.description}</p>

          <button
            onClick={() => onSelect(plan.name)}
            className={[
              "mt-6 w-full rounded-2xl py-3.5 text-base font-bold flex items-center justify-center gap-2 transition-all duration-200",
              isSelected
                ? "bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-400/30"
                : "bg-white text-slate-950 hover:bg-cyan-100",
            ].join(" ")}
          >
            Choisir {plan.name}
            <ArrowRight className="h-4 w-4" />
          </button>

          <div className="mt-6 space-y-3">
            {plan.includes.map((item) => (
              <div key={item} className="flex gap-3 text-sm text-white/85">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          {plan.excludes.length > 0 && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                Non inclus
              </p>
              <div className="mt-3 space-y-2">
                {plan.excludes.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-2 text-xs leading-5 text-white/48"
                  >
                    <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PaymentMethodSelector({ value, onChange }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {PAYMENT_METHODS.map((m) => {
        const Icon = m.icon;
        const active = value === m.id;
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            className={[
              "flex items-center gap-3 rounded-2xl border p-4 text-left transition-all duration-200",
              active
                ? `${m.border} ${m.bg} ring-2 ring-white/20`
                : "border-white/10 bg-white/[0.05] hover:bg-white/[0.08]",
            ].join(" ")}
          >
            <div
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${m.bg}`}
            >
              <Icon className={`h-5 w-5 ${m.color}`} />
            </div>
            <div>
              <p className={`text-sm font-bold ${active ? "text-white" : "text-white/80"}`}>
                {m.label}
              </p>
              <p className="text-xs text-white/45">{m.sub}</p>
            </div>
            {active && (
              <Check className="ml-auto h-4 w-4 shrink-0 text-cyan-300" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function CustomerForm({ data, onChange }) {
  const field =
    "w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 transition";
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden"
    >
      <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
          Informations client
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <User className="absolute left-3 top-3.5 h-4 w-4 text-white/30" />
            <input
              className={`${field} pl-9`}
              placeholder="Prénom"
              value={data.firstName}
              onChange={(e) => onChange({ ...data, firstName: e.target.value })}
            />
          </div>
          <div className="relative">
            <User className="absolute left-3 top-3.5 h-4 w-4 text-white/30" />
            <input
              className={`${field} pl-9`}
              placeholder="Nom"
              value={data.lastName}
              onChange={(e) => onChange({ ...data, lastName: e.target.value })}
            />
          </div>
        </div>
        <div className="relative">
          <Mail className="absolute left-3 top-3.5 h-4 w-4 text-white/30" />
          <input
            className={`${field} pl-9`}
            placeholder="Email"
            type="email"
            value={data.email}
            onChange={(e) => onChange({ ...data, email: e.target.value })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
          <select
            className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-3 text-sm text-white/80 outline-none focus:border-cyan-400/50"
            value={data.phoneCountry}
            onChange={(e) => onChange({ ...data, phoneCountry: e.target.value })}
          >
            <option value="FR">🇫🇷 +33</option>
            <option value="BE">🇧🇪 +32</option>
            <option value="CI">🇨🇮 +225</option>
            <option value="SN">🇸🇳 +221</option>
            <option value="CM">🇨🇲 +237</option>
            <option value="MA">🇲🇦 +212</option>
            <option value="GA">🇬🇦 +241</option>
            <option value="CG">🇨🇬 +242</option>
            <option value="CD">🇨🇩 +243</option>
            <option value="US">🇺🇸 +1</option>
            <option value="GB">🇬🇧 +44</option>
          </select>
          <div className="relative">
            <Phone className="absolute left-3 top-3.5 h-4 w-4 text-white/30" />
            <input
              className={`${field} pl-9`}
              placeholder="Numéro de téléphone"
              value={data.phone}
              onChange={(e) => onChange({ ...data, phone: e.target.value })}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page principale ────────────────────────────────────────────────────────────

export default function CimolaPage() {
  const [selectedPlan, setSelectedPlan] = useState("Business");
  const [paymentMethod, setPaymentMethod] = useState("stripe");
  const [loading, setLoading] = useState(null); // "setup" | "subscription" | null
  const [customer, setCustomer] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    phoneCountry: "FR",
  });

  const selected = useMemo(
    () => plans.find((p) => p.name === selectedPlan),
    [selectedPlan]
  );

  const currentMethod = PAYMENT_METHODS.find((m) => m.id === paymentMethod);
  const needsForm = currentMethod?.needsForm ?? false;

  async function checkout(type) {
    setLoading(type);
    try {
      const body = {
        type,
        plan: type === "subscription" ? selectedPlan : undefined,
        provider: paymentMethod,
        customer: needsForm ? customer : undefined,
      };

      const res = await fetch("/api/checkout/cimolace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        // Placeholder : juste un log tant que Stripe/PayPal/Chariow ne sont pas configurés
        console.log("[CIMOLACE] Checkout response :", data);
        alert(`Mode démo — provider : ${paymentMethod}\n${JSON.stringify(data, null, 2)}`);
      }
    } catch (err) {
      console.error("[CIMOLACE] checkout error", err);
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#070b18] text-white">
      {/* Halos lumineux fond */}
      <div className="pointer-events-none fixed inset-0 opacity-80" aria-hidden>
        <div className="absolute -left-40 top-0 h-96 w-96 rounded-full bg-cyan-500/25 blur-3xl" />
        <div className="absolute right-0 top-24 h-[34rem] w-[34rem] rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-7xl px-5 pb-20 pt-8 md:px-8">
        <nav className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.08] px-5 py-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-500/25">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-black tracking-wide">CIMOLACE</p>
              <p className="text-xs text-white/55">Agence e-commerce intelligente</p>
            </div>
          </div>
          <a
            href="#paiement"
            className="hidden rounded-2xl bg-white px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-100 transition-colors md:inline-flex items-center gap-2"
          >
            Payer maintenant <ArrowRight className="h-4 w-4" />
          </a>
        </nav>

        <div className="grid items-center gap-12 py-20 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-4 py-2 text-sm text-cyan-100">
              <ShieldCheck className="h-4 w-4" />
              Boutique clé en main · hébergement · maintenance
            </div>

            <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[1.04] tracking-tight md:text-6xl lg:text-7xl">
              Créez votre boutique{" "}
              <span className="bg-gradient-to-r from-cyan-300 to-violet-400 bg-clip-text text-transparent">
                professionnelle
              </span>{" "}
              prête à vendre.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/70">
              CIMOLACE transforme votre activité en plateforme e-commerce complète :
              catalogue, paiement, livraison, emballage intelligent, back-office,
              SEO, marketing et live intégré selon l'offre choisie.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#abonnements"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-7 py-4 text-base font-bold text-slate-950 hover:bg-cyan-200 transition-colors"
              >
                Commencer avec Business <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#creation"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-7 py-4 text-base text-white hover:bg-white/10 transition-colors"
              >
                Voir l'offre création
              </a>
            </div>

            {/* Badges méthodes de paiement */}
            <div className="mt-8 flex flex-wrap items-center gap-2">
              <span className="text-xs text-white/40">Paiements acceptés :</span>
              {PAYMENT_METHODS.map((m) => {
                const Icon = m.icon;
                return (
                  <span
                    key={m.id}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${m.border} ${m.bg} ${m.color}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {m.label}
                  </span>
                );
              })}
            </div>
          </motion.div>

          {/* Carte Pack création */}
          <motion.div
            id="creation"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            <div className="rounded-[2rem] border border-white/[0.12] bg-white/10 p-4 shadow-2xl backdrop-blur-2xl">
              <div className="rounded-[1.5rem] border border-white/10 bg-[#0b1225]/90 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/50">Pack création</p>
                    <p className="mt-1 text-5xl font-black">500€</p>
                    <p className="mt-1 text-xs text-white/40">paiement unique</p>
                  </div>
                  <Globe2 className="h-12 w-12 text-cyan-300 opacity-80" />
                </div>

                <div className="mt-6 grid gap-3">
                  {setupItems.map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 rounded-2xl bg-white/[0.07] p-3 text-sm text-white/80"
                    >
                      <Check className="h-4 w-4 shrink-0 text-cyan-300" />
                      {item}
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-50">
                  Ensuite, choisissez l'abonnement pour l\'hébergement, la
                  maintenance et les services de croissance.
                </div>

                <a
                  href="#paiement"
                  className="mt-5 w-full rounded-2xl bg-cyan-300 py-3.5 text-base font-bold text-slate-950 hover:bg-cyan-200 transition-colors flex items-center justify-center gap-2"
                >
                  Payer la création 500€ <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FONCTIONNALITÉS ──────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-7xl px-5 py-16 md:px-8">
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-200/70">
            Fonctionnalités incluses
          </p>
          <h2 className="mt-3 text-4xl font-black md:text-5xl">
            Une vraie plateforme,{" "}
            <span className="text-cyan-300">pas un simple site.</span>
          </h2>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.07 }}
            >
              <Card className="h-full rounded-3xl border-white/10 bg-white/[0.08] text-white backdrop-blur-xl">
                <CardContent className="p-6">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-300/15 text-cyan-200">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-xl font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/65">{text}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── ABONNEMENTS ──────────────────────────────────────────────────────── */}
      <section
        id="abonnements"
        className="relative mx-auto max-w-7xl px-5 py-16 md:px-8"
      >
        <div className="grid items-end gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-200/70">
              Abonnement mensuel ou annuel
            </p>
            <h2 className="mt-3 text-4xl font-black md:text-5xl">
              Choisissez le niveau{" "}
              <span className="text-cyan-300">de croissance.</span>
            </h2>
            <p className="mt-4 max-w-3xl text-white/65">
              Start fait fonctionner la boutique. Business l'aide à vendre.
              Entreprise ajoute live, rendez-vous, calendrier intelligent et
              suivi mobile.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-200/20 bg-cyan-200/10 px-5 py-3 text-sm text-cyan-50 whitespace-nowrap">
            Recommandé :{" "}
            <strong className="font-bold">Business 200€/mois</strong>
          </div>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.name}
              plan={plan}
              selected={selectedPlan}
              onSelect={setSelectedPlan}
            />
          ))}
        </div>
      </section>

      {/* ── PAIEMENT ─────────────────────────────────────────────────────────── */}
      <section
        id="paiement"
        className="relative mx-auto max-w-7xl px-5 pb-24 md:px-8"
      >
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.08] p-6 backdrop-blur-xl md:p-8">
          {/* Titre */}
          <div className="mb-6">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-200/70">
              Paiement
            </p>
            <h2 className="mt-2 text-3xl font-black md:text-4xl">
              Votre sélection :{" "}
              <span className="text-cyan-300">{selected?.name}</span>
            </h2>
            <p className="mt-2 text-sm text-white/55">
              Pack création <strong className="text-white/80">500€</strong> +
              abonnement{" "}
              <strong className="text-white/80">
                {selected?.price}
                {selected?.period}
              </strong>
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_0.75fr]">
            {/* Colonne gauche — méthode + form + boutons */}
            <div>
              <p className="mb-3 text-sm font-semibold text-white/70">
                Choisissez votre moyen de paiement
              </p>
              <PaymentMethodSelector
                value={paymentMethod}
                onChange={setPaymentMethod}
              />

              <AnimatePresence>
                {needsForm && (
                  <CustomerForm data={customer} onChange={setCustomer} />
                )}
              </AnimatePresence>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => checkout("setup")}
                  disabled={loading !== null}
                  className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-7 py-4 font-bold text-slate-950 hover:bg-cyan-200 transition-colors disabled:opacity-60"
                >
                  {loading === "setup" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Payer la création 500€
                </button>
                <button
                  onClick={() => checkout("subscription")}
                  disabled={loading !== null}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-7 py-4 text-white hover:bg-white/10 transition-colors disabled:opacity-60"
                >
                  {loading === "subscription" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Activer {selected?.name}
                </button>
              </div>

              {/* Indicateur méthode active */}
              <div
                className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${currentMethod?.border} ${currentMethod?.bg} ${currentMethod?.color}`}
              >
                {currentMethod && <currentMethod.icon className="h-3.5 w-3.5" />}
                Paiement via {currentMethod?.label}
              </div>
            </div>

            {/* Colonne droite — prochaine étape */}
            <div className="rounded-3xl bg-black/25 p-5">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-6 w-6 text-cyan-300" />
                <p className="font-bold">Prochaine étape</p>
              </div>
              <p className="mt-4 text-sm leading-6 text-white/65">
                Après paiement, CIMOLACE vous contacte pour récupérer logo,
                produits, textes, domaine et préférences. Le projet est
                configuré, déployé puis activé avec l'offre choisie.
              </p>
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/[0.07] p-3 text-sm text-white/75">
                <Video className="h-5 w-5 shrink-0 text-cyan-300" />
                LIRI Live disponible avec l'offre Entreprise.
              </div>

              {/* Sécurité */}
              <div className="mt-4 space-y-2">
                {[
                  "Paiement 100% sécurisé et chiffré",
                  "Aucune donnée carte stockée",
                  "Remboursement 7 jours si non démarré",
                ].map((txt) => (
                  <div
                    key={txt}
                    className="flex items-center gap-2 text-xs text-white/45"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-cyan-300/70" />
                    {txt}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-8 text-center text-xs text-white/30">
        © {new Date().getFullYear()} CIMOLACE — Agence e-commerce intelligente.
        Tous droits réservés.
      </footer>
    </main>
  );
}
