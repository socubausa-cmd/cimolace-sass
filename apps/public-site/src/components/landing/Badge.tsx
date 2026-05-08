"use client";

type BadgeVariant = "available" | "beta" | "coming-soon" | "default";
const variants: Record<BadgeVariant, string> = {
  available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  beta: "bg-amber-50 text-amber-700 border-amber-200",
  "coming-soon": "bg-slate-100 text-slate-500 border-slate-200",
  default: "bg-indigo-50 text-indigo-700 border-indigo-200",
};
const labels: Record<BadgeVariant, string> = {
  available: "✅ Disponible", beta: "🔧 Bêta", "coming-soon": "📅 Bientôt", default: "",
};

interface BadgeProps { variant?: BadgeVariant; label?: string; className?: string; }

export function Badge({ variant = "default", label, className = "" }: BadgeProps) {
  return <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full border ${variants[variant]} ${className}`}>{label ?? labels[variant]}</span>;
}
