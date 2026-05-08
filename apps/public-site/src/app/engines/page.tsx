import type { Metadata } from "next";
import { EnginesCatalog } from "@/components/landing/EnginesCatalog";

export const metadata: Metadata = { title: "Moteurs — Cimolace", description: "Catalogue des 40+ moteurs Cimolace. IA, Live, Paiements, Communication, Contenu." };

export default function EnginesPage() {
  return <EnginesCatalog />;
}
