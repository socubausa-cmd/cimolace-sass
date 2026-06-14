import React from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Briefcase,
  GraduationCap,
  Building2,
  ChevronRight,
  Presentation,
} from 'lucide-react';

export const CHOOSE_ACCOUNT_ROLE_OPTIONS = [
  {
    id: 'student',
    title: 'Élève',
    description: 'Vue apprenant avec progression, cours et renouvellement.',
    icon: GraduationCap,
    badge: 'Apprentissage',
    gradient: 'from-emerald-500/20 to-cyan-500/10',
    accent: '#10b981',
  },
  {
    id: 'owner',
    title: 'Propriétaire',
    description: 'Vue complète de pilotage global de la plateforme.',
    icon: ShieldCheck,
    badge: 'Global',
    gradient: 'from-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] to-amber-500/10',
    accent: '#D4AF37',
  },
  {
    id: 'secretariat',
    title: 'Secrétaire',
    description: 'Gestion administrative, inscriptions et suivi quotidien.',
    icon: Briefcase,
    badge: 'Administration',
    gradient: 'from-violet-500/20 to-purple-500/10',
    accent: '#8b5cf6',
  },
  {
    id: 'teacher',
    title: 'Professeur',
    description: 'Suivi pédagogique, cours et progression des apprenants.',
    icon: Presentation,
    badge: 'Pédagogie',
    gradient: 'from-blue-500/20 to-indigo-500/10',
    accent: '#3b82f6',
  },
  {
    id: 'admin',
    title: 'Admin',
    description: 'Configuration système et supervision technique.',
    icon: Building2,
    badge: 'Système',
    gradient: 'from-rose-500/20 to-red-500/10',
    accent: '#f43f5e',
  },
];

export function ChooseAccountRoleRow({ option, isSelected, onSelect, compact }) {
  const Icon = option.icon;
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(option.id)}
      whileTap={{ scale: 0.98 }}
      className={`relative flex w-full items-center gap-3 rounded-2xl border px-4 text-left transition-colors ${
        compact ? 'py-3' : 'py-4'
      } ${
        isSelected
          ? 'border-[color-mix(in_srgb,var(--school-accent)_60%,transparent)] bg-[var(--school-accent)] text-black shadow-lg shadow-[color-mix(in_srgb,var(--school-accent)_25%,transparent)]'
          : 'border-white/10 bg-[#151a21]/95 text-white active:bg-white/10'
      }`}
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          isSelected ? 'bg-black/15 text-black' : 'bg-white/5 text-gray-400'
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <span className={`block font-semibold ${isSelected ? 'text-black' : 'text-white'}`}>
          {option.title}
        </span>
        <span className={`block text-xs ${isSelected ? 'text-black/70' : 'text-gray-500'}`}>
          {option.badge}
        </span>
      </div>
      <ChevronRight className={`h-5 w-5 shrink-0 ${isSelected ? 'text-black/60' : 'text-gray-600'}`} />
    </motion.button>
  );
}
