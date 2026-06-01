import type { Metadata } from "next";
import Link from "next/link";
import { OnboardingPicker } from "./OnboardingPicker";

export const metadata: Metadata = {
  title: "Démarrer — Choisir votre infrastructure | Cimolace",
  description:
    "Lancez votre plateforme en 3 minutes. Choisissez parmi LIRI Studio (live + IA), École en ligne, MedOS médical, Mbolo commerce ou Community Hub.",
};

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center py-16 px-6">
      <div className="text-center mb-12">
        <div className="text-indigo-500 text-[13px] font-bold tracking-[0.08em] uppercase mb-3">
          Cimolace — Démarrer
        </div>
        <h1 className="text-white text-[clamp(28px,4vw,44px)] font-black leading-tight mb-3">
          Quelle infrastructure voulez-vous lancer&nbsp;?
        </h1>
        <p className="text-slate-400 text-[15px] max-w-xl mx-auto leading-relaxed">
          Chaque infrastructure est un tenant complet avec tous ses moteurs activés. Lancez-vous en 3 minutes.
        </p>
      </div>

      <OnboardingPicker />

      <div className="mt-8 text-slate-500 text-xs">
        Déjà un compte ?{" "}
        <Link href="/login" className="text-indigo-400 hover:text-indigo-300 underline">
          Se connecter
        </Link>
      </div>
    </main>
  );
}
