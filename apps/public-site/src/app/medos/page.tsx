import Link from "next/link";
import type { Metadata } from "next";
import { getOnboardingUrl } from "@/lib/urls";
import { MedOSPageClient } from "./MedOSPageClient";

export const metadata: Metadata = {
  title: "MedOS — L'OS médical des praticiens | Cimolace",
  description: "Dossiers patients, notes SOAP, prescriptions, téléconsultation LiveKit, programmes de soins. Multi-tenant, RGPD natif, paiements Europe & Afrique. À partir de 19€/mois.",
  openGraph: {
    title: "MedOS — L'OS médical des praticiens",
    description: "Cabinet digital complet. EHR, IA, téléconsultation. Conformité RGPD.",
    type: "website",
    locale: "fr_FR",
  },
};

export default function MedOSPage() {
  const onboardingUrl = getOnboardingUrl();
  return <MedOSPageClient onboardingUrl={onboardingUrl} />;
}
