import type { Metadata } from "next";
import { InfraPage } from "@/components/landing/InfraPage";

export const metadata: Metadata = { title: "Bien-être & Coaching — Cimolace", description: "Programmes de coaching, suivis santé, communautés bien-être." };

const engines = ["🎯 Care Programs — Programmes de soins J+N","📊 Health Tracking — Suivi humeur, sommeil, activité","📅 Calendar — Disponibilités & RDV en ligne","💬 Chat Engine — Messagerie privée + groupes","👥 Forum — Communautés privées par programme","💳 Pay Engine — Abonnements & séances à l'unité"];

const plans = [
  { name: "Starter", price: "19€", features: ["10 clients","2 programmes","Trackers santé","Chat illimité","Email support"] },
  { name: "Pro", price: "49€", features: ["Tout Starter","50 clients","Programmes illimités","Agenda intégré","Communauté privée","Support prioritaire"], highlight: true },
];

export default function WellnessPage() {
  return <InfraPage title="Bien-être & Coaching" icon="🌿" tagline="Programmes, suivis, RDV, communautés. Accompagnez chaque client de A à Z." gradient="from-green-500 to-emerald-600" engines={engines} plans={plans} status="beta" />;
}
