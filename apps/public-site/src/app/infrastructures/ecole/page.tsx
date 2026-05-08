import type { Metadata } from "next";
import { InfraPage } from "@/components/landing/InfraPage";

export const metadata: Metadata = { title: "École en ligne — Cimolace", description: "Créez votre école en ligne. Lives payants, formations, certifications." };

const engines = ["🧠 SmartBoard — Génération slides IA","📡 LIRI Live — Broadcast LiveKit payant","🎬 Replay VOD — Mux/Cloudflare Stream","📢 Marketing Creator — Promos, popups, bannières","📅 Admin Booking — Agenda & réservations","🧠 Neuro Recall — Rappels mnémotechniques IA","🏷️ White Label — Domaine & branding custom"];

const plans = [
  { name: "Starter", price: "79€", features: ["SmartBoard","Marketing Creator","50 étudiants","1 live simultané","Replay 7 jours","Email support"] },
  { name: "Pro", price: "199€", features: ["Tout Starter","LIRI Live illimité","Replay permanent","Admin Booking","500 étudiants","Support prioritaire"], highlight: true },
  { name: "Business", price: "349€", features: ["Tout Pro","Neuro Recall IA","White Label","2000 étudiants","API access","Account manager"] },
];

export default function EcolePage() {
  return <InfraPage title="École en ligne" icon="🏫" tagline="Vendez vos formations live et vidéo. Votre école, votre marque, vos étudiants." gradient="from-indigo-500 to-purple-600" engines={engines} plans={plans} />;
}
