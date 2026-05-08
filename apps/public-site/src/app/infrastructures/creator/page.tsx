import type { Metadata } from "next";
import { InfraPage } from "@/components/landing/InfraPage";

export const metadata: Metadata = { title: "Créateur de contenu — Cimolace", description: "Studio live, monétisation, VOD. Votre plateforme de créateur." };

const engines = ["🎬 Studio Créateur — Production live avancée","📡 LIRI Live — Broadcast LiveKit","🎬 Replay VOD — Mux/Cloudflare Stream","💳 Pay Engine — Ventes & abonnements","📢 Marketing Creator — Promos, popups","🧠 AI Communication — Génération, résumés IA"];

const plans = [
  { name: "Starter", price: "79€", features: ["Studio basic","5 lives/mois","Replay 7 jours","100 viewers","Chat live","Email support"] },
  { name: "Pro", price: "199€", features: ["Tout Starter","Lives illimités","Replay permanent","1000 viewers","IA + SmartBoard","Support prioritaire"], highlight: true },
  { name: "Business", price: "349€", features: ["Tout Pro","White Label","5000 viewers","API access","Multi-hosts","Account manager"] },
];

export default function CreatorPage() {
  return <InfraPage title="Créateur de contenu" icon="🎬" tagline="Studio, monétisation, communauté. Tout pour vivre de votre contenu." gradient="from-pink-500 to-rose-600" engines={engines} plans={plans} status="beta" />;
}
