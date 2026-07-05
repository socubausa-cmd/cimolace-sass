import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { getOnboardingUrl } from "@/lib/urls";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cimolace — L'OS qui crée des plateformes SaaS",
  description: "Créez votre plateforme SaaS sans coder. Écoles, cliniques, créateurs, boutiques. 40+ moteurs, multi-tenant natif, paiements Europe & Afrique.",
  openGraph: { title: "Cimolace — L'OS qui crée des plateformes SaaS", description: "Votre plateforme. Vos règles. Zéro code.", type: "website", locale: "fr_FR" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const onboardingUrl = getOnboardingUrl();
  return (
    <html lang="fr" className="scroll-smooth">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-slate-900`}>
        <header className="fixed top-0 left-0 right-0 z-50 glass-dark border-b border-white/5">
          <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3.5">
            <Link href="/" className="text-xl font-bold tracking-tight text-white hover:text-[#e6cc92] transition-colors">Cimolace</Link>
            <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
              <Link href="/medos" className="px-3 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors">MedOS</Link>
              <Link href="/engines" className="px-3 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors">Moteurs</Link>
              <Link href="/pricing" className="px-3 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors">Tarifs</Link>
              <Link href="/infrastructures/ecole" className="px-3 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors">Solutions</Link>
              <Link href={onboardingUrl} className="ml-3 bg-white text-black px-4 py-2 rounded-full hover:bg-white/90 transition-colors">Créer ma plateforme</Link>
            </nav>
            <Link href={onboardingUrl} className="md:hidden bg-white text-black text-sm px-4 py-2 rounded-full hover:bg-white/90 transition-colors">Démarrer</Link>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
