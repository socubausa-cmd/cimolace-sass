import type { Metadata } from "next";
import { InfraPage } from "@/components/landing/InfraPage";

export const metadata: Metadata = { title: "Temple & Spiritualité — Cimolace", description: "Cérémonies, initiations, dons, cercles. Votre communauté spirituelle en ligne." };

const features = [
  { title: "Cérémonies live", desc: "Diffusez vos cérémonies en direct. Privé ou public. LiveKit HD." },
  { title: "Dons & Cotisations", desc: "Recevez des dons en ligne. Cotisations mensuelles. Paiements Afrique & Europe." },
  { title: "Cercles & Groupes", desc: "Créez des cercles privés. Discussions, partages, ressources." },
  { title: "Agenda sacré", desc: "Calendrier des rites, initiations, célébrations. Rappels automatiques." },
  { title: "Bibliothèque", desc: "Textes sacrés, enseignements, méditations. Accessible à votre communauté." },
  { title: "Messagerie", desc: "Chat communautaire. Messages privés. Annonces aux fidèles." },
];

const plans = [
  { name: "Starter", price: "19€", features: ["5 cérémonies/mois","50 membres","Dons activés","Bibliothèque basic","Email support"] },
  { name: "Pro", price: "49€", features: ["Tout Starter","Cérémonies illimitées","500 membres","Cercles privés","Agenda sacré","Support prioritaire"], highlight: true },
];

export default function TemplePage() {
  return <InfraPage title="Temple & Spiritualité" icon="🕌" tagline="Cérémonies, initiations, dons. Votre espace sacré, en ligne." gradient="from-amber-500 to-yellow-600" status="coming-soon" features={features} plans={plans} />;
}
