import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  BookOpen, GraduationCap, Library, School,
  ArrowRight, CheckCircle2, Sparkles, X
} from 'lucide-react';
import { activeTenantConfig as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';

const SITE_NAME = `${isnaTenantConfig.branding.name} · LIRI`;

const STEPS = [
  {
    id: 'welcome',
    icon: Sparkles,
    color: '#D4AF37',
    title: (name) => `Bienvenue, ${name} !`,
    subtitle: `Vous faites maintenant partie de ${SITE_NAME}.`,
    description: 'Votre espace élève personnel est prêt. Découvrez en quelques secondes tout ce qui vous attend.',
    visual: (
      <div className="relative flex items-center justify-center w-32 h-32 mx-auto mb-6">
        <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] rounded-full blur-2xl" />
        <div className="w-24 h-24 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-[var(--school-accent)]" />
        </div>
      </div>
    ),
  },
  {
    id: 'tour',
    icon: GraduationCap,
    color: '#7C3AED',
    title: () => 'Votre espace en un coup d\'œil',
    subtitle: 'Tout ce dont vous avez besoin est dans le menu latéral.',
    description: null,
    features: [
      { icon: GraduationCap, label: 'Mes Formations', desc: '21 modules disponibles, suivez votre progression', color: 'text-[var(--school-accent)]', bg: 'bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]' },
      { icon: School,        label: 'Vie Scolaire',   desc: 'Agenda, règlements, absences et annonces',       color: 'text-blue-400',    bg: 'bg-blue-400/10' },
      { icon: Library,       label: 'Bibliothèque',   desc: 'Ouvrages fondateurs du corpus enseigné',         color: 'text-violet-400',  bg: 'bg-violet-400/10' },
      { icon: BookOpen,      label: 'Ressources',     desc: 'Vidéos, PDFs, glossaire, rituels, rapports',    color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    ],
  },
  {
    id: 'start',
    icon: CheckCircle2,
    color: '#22C55E',
    title: () => 'Vous êtes prêt !',
    subtitle: 'Par où souhaitez-vous commencer ?',
    description: null,
    ctas: [
      { label: 'Explorer les formations', path: '/student-school-life/formations', primary: true },
      { label: 'Voir le tableau de bord',  path: '/student-school-life/dashboard',  primary: false },
    ],
  },
];

const OnboardingModal = ({ userName, onClose }) => {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const current = STEPS[step];
  const firstName = (userName || 'Étudiant').split(' ')[0];
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) { onClose(); return; }
    setStep(s => s + 1);
  };

  const handleCTA = (path) => {
    onClose();
    navigate(path);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="relative w-full max-w-lg bg-[#0F1419] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Top accent bar */}
        <div className="h-1 bg-gradient-to-r from-[var(--school-accent)] via-yellow-400 to-[var(--school-accent)]" />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Step indicators */}
        <div className="flex justify-center gap-2 pt-6 pb-2">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === step ? 'w-8 bg-[var(--school-accent)]' : i < step ? 'w-4 bg-[color-mix(in_srgb,var(--school-accent)_40%,transparent)]' : 'w-4 bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="p-8 pt-4"
          >
            {/* Step 0 — Welcome */}
            {step === 0 && (
              <div className="text-center">
                {current.visual}
                <h2 className="text-2xl font-serif font-bold text-white mb-2">
                  {current.title(firstName)}
                </h2>
                <p className="text-[var(--school-accent)] font-medium text-sm mb-3">{current.subtitle}</p>
                <p className="text-gray-400 text-sm leading-relaxed">{current.description}</p>
              </div>
            )}

            {/* Step 1 — Tour */}
            {step === 1 && (
              <div>
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-serif font-bold text-white mb-1">{current.title()}</h2>
                  <p className="text-gray-400 text-sm">{current.subtitle}</p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {current.features.map(({ icon: Icon, label, desc, color, bg }) => (
                    <div key={label} className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all">
                      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-5 h-5 ${color}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-white text-sm">{label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2 — Start */}
            {step === 2 && (
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-green-400" />
                </div>
                <h2 className="text-2xl font-serif font-bold text-white mb-2">{current.title()}</h2>
                <p className="text-gray-400 text-sm mb-8">{current.subtitle}</p>
                <div className="space-y-3">
                  {current.ctas.map(({ label, path, primary }) => (
                    <Button
                      key={path}
                      onClick={() => handleCTA(path)}
                      className={`w-full h-11 font-bold ${
                        primary
                          ? 'bg-[var(--school-accent)] hover:bg-[#bfa345] text-black'
                          : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                      }`}
                    >
                      {label}
                      {primary && <ArrowRight className="ml-2 w-4 h-4" />}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Footer nav */}
        {step < 2 && (
          <div className="px-8 pb-8 flex items-center justify-between">
            <button
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Passer
            </button>
            <Button
              onClick={handleNext}
              className="bg-[var(--school-accent)] hover:bg-[#bfa345] text-black font-bold px-6"
            >
              {step === STEPS.length - 2 ? 'Terminer' : 'Suivant'}
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default OnboardingModal;
