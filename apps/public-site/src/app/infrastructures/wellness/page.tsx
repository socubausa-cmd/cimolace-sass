import type { Metadata } from "next";
import { InfraPage } from "@/components/landing/InfraPage";

export const metadata: Metadata = { title: "Bien-être & Coaching — Cimolace", description: "Programmes de coaching, suivis santé, communautés bien-être." };

const features = [
  { title: "Programmes de soins", desc: "Créez des programmes personnalisés J+N. Automatisations email/SMS." },
  { title: "Trackers santé", desc: "Humeur, sommeil, activité, repas. Vos clients trackent, vous analysez." },
  { title: "Agenda & RDV", desc: "Prise de rendez-vous en ligne. Rappels automatiques. Paiement intégré." },
  { title: "Messagerie", desc: "Chat sécurisé avec vos clients. Groupes de coaching. Fichiers." },
  { title: "Communauté", desc: "Forums privés par programme. Événements live. Défis collectifs." },
  { title: "Paiements", desc: "Stripe, CinetPay, Orange Money. Abonnements ou séances à l'unité." },
];

const plans = [
  { name: "Starter", price: "19€", features: ["10 clients","2 programmes","Trackers santé","Chat illimité","Email support"] },
  { name: "Pro", price: "49€", features: ["Tout Starter","50 clients","Programmes illimités","Agenda intégré","Communauté privée","Support prioritaire"], highlight: true },
];

export default function WellnessPage() {
  return <InfraPage title="Bien-être & Coaching" icon="🌿" tagline="Programmes, suivis, communautés. Accompagnez vos clients de A à Z." gradient="from-green-500 to-emerald-600" features={features} plans={plans} />;
}
