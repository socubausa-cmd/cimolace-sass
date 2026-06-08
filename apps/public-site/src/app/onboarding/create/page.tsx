import type { Metadata } from "next";
import { SignupTenantForm } from "./SignupTenantForm";

export const metadata: Metadata = {
  title: "Créer votre plateforme | Cimolace",
  description:
    "Lancez votre LIRI Studio, École en ligne ou MedOS en 1 minute. Compte gratuit, 500 crédits IA offerts.",
};

const PRESETS: Record<
  string,
  { label: string; tagline: string; color: string; gradient: string; nextTab: string }
> = {
  liri: {
    label: "LIRI Studio",
    tagline: "Live + IA · Studio · Masterclass · SmartBoard",
    color: "#6366f1",
    gradient: "from-indigo-500/30 via-violet-500/20 to-transparent",
    nextTab: "lives",
  },
  school: {
    label: "École en ligne",
    tagline: "11 moteurs · Live, cours, IA",
    color: "#10b981",
    gradient: "from-emerald-500/30 via-teal-500/20 to-transparent",
    nextTab: "courses",
  },
  medos: {
    label: "MedOS",
    tagline: "EHR · praticiens · patients",
    color: "#3b82f6",
    gradient: "from-blue-500/30 via-sky-500/20 to-transparent",
    nextTab: "",
  },
};

export default async function CreateTenantPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const params = await searchParams;
  const kind = (params.kind ?? "liri").toLowerCase();
  const preset = PRESETS[kind] ?? PRESETS.liri;

  return (
    <main className="min-h-screen bg-[#0d1117] text-slate-100 flex flex-col items-center justify-center px-6 py-12">
      <div
        className="absolute inset-x-0 top-0 h-[420px] pointer-events-none opacity-60"
        style={{
          background: `radial-gradient(60% 70% at 50% 0%, ${preset.color}26 0%, transparent 60%)`,
        }}
      />

      <div className="relative w-full max-w-[500px]">
        <div className="text-center mb-8">
          <div
            className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3"
            style={{ color: preset.color }}
          >
            Cimolace · {preset.label}
          </div>
          <h1 className="text-white text-[clamp(26px,3.6vw,38px)] font-black leading-tight mb-3">
            Créez votre plateforme.
          </h1>
          <p className="text-slate-400 text-[14px] leading-relaxed">
            {preset.tagline}
            <br />
            <span className="text-slate-500">
              Compte gratuit · 500 crédits IA offerts · prêt en 1 minute.
            </span>
          </p>
        </div>

        <SignupTenantForm kind={kind} color={preset.color} nextTab={preset.nextTab} />
      </div>
    </main>
  );
}
