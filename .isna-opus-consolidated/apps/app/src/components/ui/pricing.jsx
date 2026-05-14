import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TimelineContent } from "@/components/ui/timeline-animation";
import { VerticalCutReveal } from "@/components/ui/vertical-cut-reveal";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { Briefcase, CheckCheck, Database, Server } from "lucide-react";
import { motion } from "framer-motion";
import { useRef, useState } from "react";

const plans = [
  {
    name: "Starter",
    description: "Pour les entrepreneurs et startups qui démarrent leur aventure IA en Afrique.",
    price: 0,
    yearlyPrice: 0,
    buttonText: "Démarrer gratuitement",
    buttonVariant: "outline",
    features: [
      { text: "3 modules LIRI inclus",          icon: <Briefcase size={20} /> },
      { text: "Jusqu'à 5 Go de stockage",        icon: <Database size={20} /> },
      { text: "Analytics de base",               icon: <Server size={20} /> },
    ],
    includes: [
      "Inclus gratuitement :",
      "Boutique Virtuel Mbolo (limité)",
      "LIRI AI Core (100 requêtes/mois)",
      "Authentification 2 facteurs",
      "1 utilisateur",
      "1 espace de travail",
    ],
  },
  {
    name: "Pro",
    description: "La meilleure valeur pour les business en croissance qui ont besoin de plus de puissance.",
    price: 49,
    yearlyPrice: 399,
    buttonText: "Commencer maintenant",
    buttonVariant: "default",
    popular: true,
    features: [
      { text: "Tous les modules LIRI",            icon: <Briefcase size={20} /> },
      { text: "Stockage illimité (250 Mo/fichier)", icon: <Database size={20} /> },
      { text: "Agents LIRI (500 tâches/mois)",     icon: <Server size={20} /> },
    ],
    includes: [
      "Tout de Starter, plus :",
      "Payflow Africa (12 pays)",
      "LIRI Live Engine",
      "LIRI EDU Core",
      "Jusqu'à 10 utilisateurs",
      "Jusqu'à 5 espaces de travail",
    ],
  },
  {
    name: "Entreprise",
    description: "Infrastructure complète avec sécurité renforcée et accès illimité pour les grandes équipes.",
    price: 199,
    yearlyPrice: 1699,
    buttonText: "Nous contacter",
    buttonVariant: "outline",
    features: [
      { text: "Modules illimités",              icon: <Briefcase size={20} /> },
      { text: "Stockage illimité",               icon: <Database size={20} /> },
      { text: "Agents LIRI illimités",           icon: <Server size={20} /> },
    ],
    includes: [
      "Tout de Pro, plus :",
      "Support dédié 24/7",
      "Déploiement personnalisé",
      "Accès API complet",
      "Rôles et permissions sur mesure",
      "Onboarding équipe inclus",
    ],
  },
];

const PricingSwitch = ({ onSwitch, className }) => {
  const [selected, setSelected] = useState("0");

  const handleSwitch = (value) => {
    setSelected(value);
    onSwitch(value);
  };

  return (
    <div className={cn("flex justify-center", className)}>
      <div className="relative z-10 mx-auto flex w-fit rounded-xl p-1"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(139,92,246,0.2)" }}>
        {[
          { val: "0", label: "Mensuel" },
          { val: "1", label: <>Annuel <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>-20%</span></> },
        ].map(({ val, label }) => (
          <button
            key={val}
            onClick={() => handleSwitch(val)}
            className={cn(
              "relative z-10 w-fit cursor-pointer h-11 rounded-xl sm:px-6 px-3 font-medium transition-colors sm:text-sm text-xs flex items-center gap-2",
              selected === val ? "text-white" : "text-white/40 hover:text-white/70"
            )}
          >
            {selected === val && (
              <motion.span
                layoutId="switch"
                className="absolute inset-0 rounded-xl"
                style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default function PricingSection5() {
  const [isYearly,    setIsYearly]   = useState(false);
  const pricingRef = useRef(null);

  const revealVariants = {
    visible: (i) => ({
      y: 0, opacity: 1, filter: "blur(0px)",
      transition: { delay: i * 0.4, duration: 0.5 },
    }),
    hidden: { filter: "blur(10px)", y: -20, opacity: 0 },
  };

  const togglePricingPeriod = (value) => setIsYearly(Number.parseInt(value) === 1);

  return (
    <div
      className="px-4 pt-20 pb-32 min-h-screen max-w-7xl mx-auto relative"
      ref={pricingRef}
    >
      <article className="text-left mb-10 space-y-5 max-w-2xl">
        <h2 className="md:text-6xl text-4xl capitalize font-black text-white mb-4 leading-tight">
          <VerticalCutReveal
            splitBy="words"
            staggerDuration={0.15}
            staggerFrom="first"
            reverse={true}
            containerClassName="justify-start flex-wrap"
            transition={{ type: "spring", stiffness: 250, damping: 40, delay: 0 }}
          >
            Un plan taillé pour votre ambition.
          </VerticalCutReveal>
        </h2>

        <TimelineContent
          as="p"
          animationNum={0}
          timelineRef={pricingRef}
          customVariants={revealVariants}
          className="md:text-base text-sm w-[80%]"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          Rejoignez des milliers d'entrepreneurs africains. Choisissez le plan qui correspond à votre stade de croissance.
        </TimelineContent>

        <TimelineContent
          as="div"
          animationNum={1}
          timelineRef={pricingRef}
          customVariants={revealVariants}
        >
          <PricingSwitch onSwitch={togglePricingPeriod} className="w-fit" />
        </TimelineContent>
      </article>

      <div className="grid md:grid-cols-3 gap-4 py-6">
        {plans.map((plan, index) => (
          <TimelineContent
            key={plan.name}
            as="div"
            animationNum={2 + index}
            timelineRef={pricingRef}
            customVariants={revealVariants}
          >
            <Card
              className={cn(
                "relative h-full",
                plan.popular
                  ? "ring-2"
                  : ""
              )}
              style={{
                background: plan.popular ? "rgba(124,58,237,0.08)" : "rgba(255,255,255,0.03)",
                border:     plan.popular ? "1px solid rgba(139,92,246,0.4)" : "1px solid rgba(255,255,255,0.07)",
                boxShadow:  plan.popular ? "0 0 40px rgba(124,58,237,0.15)" : "none",
                ...(plan.popular ? { "--tw-ring-color": "rgba(139,92,246,0.5)" } : {}),
              }}
            >
              <CardHeader className="text-left">
                <div className="flex justify-between items-start">
                  <h3 className="xl:text-3xl md:text-2xl text-3xl font-black text-white mb-2">
                    {plan.name}
                  </h3>
                  {plan.popular && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold text-white"
                      style={{ background: "linear-gradient(135deg, #7c3aed, #06b6d4)" }}>
                      Populaire
                    </span>
                  )}
                </div>
                <p className="xl:text-sm md:text-xs text-sm mb-4" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {plan.description}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">
                    {plan.price === 0 ? (
                      <span>Gratuit</span>
                    ) : (
                      <>
                        $
                        <NumberFlow
                          value={isYearly ? plan.yearlyPrice : plan.price}
                          className="text-4xl font-black text-white"
                        />
                      </>
                    )}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                      /{isYearly ? "an" : "mois"}
                    </span>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <button
                  className="w-full mb-3 p-4 text-base font-bold rounded-xl text-white transition-opacity hover:opacity-90"
                  style={
                    plan.popular
                      ? { background: "linear-gradient(135deg, #7c3aed, #06b6d4)", boxShadow: "0 8px 24px rgba(124,58,237,0.3)" }
                      : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }
                  }
                >
                  {plan.buttonText}
                </button>
                <button
                  className="w-full mb-6 p-3 text-sm font-semibold rounded-xl transition-colors"
                  style={{ background: "transparent", border: "1px solid rgba(139,92,246,0.25)", color: "rgba(167,139,250,0.8)" }}
                  onMouseOver={(e) => e.currentTarget.style.background = "rgba(139,92,246,0.08)"}
                  onMouseOut={(e)  => e.currentTarget.style.background = "transparent"}
                >
                  Voir la démo
                </button>

                <div className="space-y-3 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                  <h4 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(167,139,250,0.6)" }}>
                    Fonctionnalités
                  </h4>
                  <p className="text-sm font-semibold text-white/70 mb-2">{plan.includes[0]}</p>
                  <ul className="space-y-2">
                    {plan.includes.slice(1).map((feature, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <span
                          className="h-5 w-5 rounded-full grid place-content-center flex-shrink-0"
                          style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}
                        >
                          <CheckCheck className="h-3 w-3" style={{ color: "#a78bfa" }} />
                        </span>
                        <span className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TimelineContent>
        ))}
      </div>
    </div>
  );
}
