import type { Metadata } from "next";
import { InfraPage } from "@/components/landing/InfraPage";

export const metadata: Metadata = { title: "Créateur de contenu — Cimolace", description: "Studio live, monétisation, VOD. Votre plateforme de créateur." };

const features = [
  { title: "Studio Créateur", desc: "Interface de production live avancée. Multi-caméras, overlays, scènes." },
  { title: "Monétisation", desc: "Vendez vos lives, vos replays, vos formations. Abonnements ou paiement à l'unité." },
  { title: "Replay & VOD", desc: "Enregistrement automatique. Chapitrage IA. Transcription. Stockage illimité." },
  { title: "Marketing", desc: "Codes promo, popups, landing pages. Convertissez votre audience." },
  { title: "IA intégrée", desc: "LIRI Brain pour interagir avec vos viewers. SmartBoard pour vos présentations." },
  { title: "Communauté", desc: "Chat live, forums, abonnements. Fidélisez votre audience." },
];

const plans = [
  { name: "Starter", price: "79€", features: ["Studio basic","5 lives/mois","Replay 7 jours","100 viewers","Chat live","Email support"] },
  { name: "Pro", price: "199€", features: ["Tout Starter","Lives illimités","Replay permanent","1000 viewers","IA + SmartBoard","Support prioritaire"], highlight: true },
  { name: "Business", price: "349€", features: ["Tout Pro","White Label","5000 viewers","API access","Multi-hosts","Account manager"] },
];

export default function CreatorPage() {
  return <InfraPage title="Créateur de contenu" icon="🎬" tagline="Studio, monétisation, communauté. Tout pour vivre de votre contenu." gradient="from-pink-500 to-rose-600" features={features} plans={plans} />;
}
