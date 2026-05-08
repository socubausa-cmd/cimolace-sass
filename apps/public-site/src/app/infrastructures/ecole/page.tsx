import type { Metadata } from "next";
import { InfraPage } from "@/components/landing/InfraPage";

export const metadata: Metadata = { title: "École en ligne — Cimolace", description: "Créez votre école en ligne. Lives payants, formations, certifications." };

const features = [
  { title: "Lives payants", desc: "Sessions LiveKit monétisées. Paiement à l'unité. Token d'accès sécurisé." },
  { title: "SmartBoard", desc: "Générez des slides de formation avec l'IA. Export PDF." },
  { title: "Replay & VOD", desc: "Enregistrement automatique. Stockage Mux/Cloudflare Stream. Disponible 24/7." },
  { title: "Marketing intégré", desc: "Codes promo, popups, bannières. Convertissez vos visiteurs en élèves." },
  { title: "Certificats", desc: "Générez des certificats automatiquement à la fin d'un parcours." },
  { title: "Multi-tenant", desc: "Chaque école a son espace isolé. Branding, domaine, rôles personnalisés." },
];

const plans = [
  { name: "Starter", price: "79€", features: ["SmartBoard","Marketing Creator","50 étudiants","1 live simultané","Replay 7 jours","Email support"] },
  { name: "Pro", price: "199€", features: ["Tout Starter","Lives illimités","Replay permanent","Admin Booking","500 étudiants","Support prioritaire"], highlight: true },
  { name: "Business", price: "349€", features: ["Tout Pro","Neuro Recall IA","White Label","2000 étudiants","API access","Account manager"] },
];

export default function EcolePage() {
  return <InfraPage title="École en ligne" icon="🏫" tagline="Lives payants. Formations. Certificats. Votre école, votre marque." gradient="from-indigo-500 to-purple-600" features={features} plans={plans} />;
}
