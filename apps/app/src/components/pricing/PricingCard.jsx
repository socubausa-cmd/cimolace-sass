import React, { useState } from 'react';
import { Check, X, ChevronDown, ChevronUp, ArrowRight, Info, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import EnrollmentModal from './EnrollmentModal';

const PricingCard = ({ pkg }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const val = (v) => (typeof v === 'string' ? v : v?.amount);
  const per = (v, fb) => (typeof v === 'string' ? fb : v?.period || fb);
  const note = (v) => (typeof v === 'string' ? null : v?.note);
  const orig = (v) => (typeof v === 'string' ? null : v?.original);

  const monthly   = { amount: val(pkg?.pricing?.monthly),    period: per(pkg?.pricing?.monthly, '/mois') };
  const quarterly = { amount: val(pkg?.pricing?.quarterly),  period: per(pkg?.pricing?.quarterly, '/trimestre'), note: note(pkg?.pricing?.quarterly) };
  const full      = { amount: val(pkg?.pricing?.full),       original: orig(pkg?.pricing?.full), note: note(pkg?.pricing?.full) };
  const regFee    = pkg?.pricing?.registration;

  const links = pkg?.paymentLinks || {};
  const hasLinks = Boolean(links.full || links.quarterly || links.monthly);

  const theme = {
    blue: {
      border: 'border-blue-500/40',
      headerBg: 'from-blue-600 to-blue-800',
      text: 'text-blue-400',
      accent: 'text-blue-300',
      btn: 'bg-blue-600 hover:bg-blue-500',
      btnOutline: 'border-blue-500/30 text-blue-300 hover:bg-blue-500/10 hover:border-blue-400/50',
      glow: 'shadow-blue-500/10',
      tag: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
      ring: 'ring-blue-500/20',
    },
    yellow: {
      border: 'border-yellow-500/40',
      headerBg: 'from-yellow-600 to-amber-800',
      text: 'text-yellow-400',
      accent: 'text-yellow-300',
      btn: 'bg-yellow-600 hover:bg-yellow-500',
      btnOutline: 'border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/10 hover:border-yellow-400/50',
      glow: 'shadow-yellow-500/10',
      tag: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20',
      ring: 'ring-yellow-500/20',
    },
    red: {
      border: 'border-red-500/40',
      headerBg: 'from-red-600 to-red-900',
      text: 'text-red-400',
      accent: 'text-red-300',
      btn: 'bg-red-600 hover:bg-red-500',
      btnOutline: 'border-red-500/30 text-red-300 hover:bg-red-500/10 hover:border-red-400/50',
      glow: 'shadow-red-500/10',
      tag: 'bg-red-500/15 text-red-300 border-red-500/20',
      ring: 'ring-red-500/20',
    },
    purple: {
      border: 'border-purple-500/40',
      headerBg: 'from-purple-600 to-purple-900',
      text: 'text-purple-400',
      accent: 'text-purple-300',
      btn: 'bg-purple-600 hover:bg-purple-500',
      btnOutline: 'border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:border-purple-400/50',
      glow: 'shadow-purple-500/10',
      tag: 'bg-purple-500/15 text-purple-300 border-purple-500/20',
      ring: 'ring-purple-500/20',
    },
  };
  const t = theme[pkg.color] || theme.blue;

  return (
    <div className={`group relative flex flex-col rounded-2xl border ${t.border} bg-[#111820] shadow-xl ${t.glow} hover:shadow-2xl transition-all duration-500 h-full overflow-hidden`}>

      {/* ========= HEADER WITH GRADIENT ========= */}
      <div className={`relative bg-gradient-to-br ${t.headerBg} px-6 pt-8 pb-10 text-center`}>
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10">
          <span className="text-5xl block mb-3 drop-shadow-lg">{pkg.icon}</span>
          {pkg.badge && (
            <span className="inline-block mb-2 px-3 py-0.5 rounded-full bg-white/15 backdrop-blur-sm text-white text-[11px] font-bold uppercase tracking-widest border border-white/20">
              {pkg.badge}
            </span>
          )}
          <h3 className="text-xl font-bold text-white uppercase tracking-wider font-serif">{pkg.title}</h3>
          <p className="text-white/70 text-xs mt-1 italic">{pkg.subtitle}</p>
        </div>
      </div>

      {/* ========= PRICE BADGE (overlapping header) ========= */}
      <div className="relative -mt-6 mx-6 z-10">
        <div className={`bg-[#1a2130] rounded-xl border ${t.border} p-5 text-center shadow-lg ring-1 ${t.ring}`}>
          <div className="flex items-baseline justify-center gap-1.5">
            <span className="text-3xl font-extrabold text-white">{monthly.amount}</span>
            <span className="text-sm text-gray-400 font-medium">{monthly.period}</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1.5">+ {regFee} frais de configuration (unique)</p>
        </div>
      </div>

      {/* ========= BODY ========= */}
      <div className="flex-grow px-5 pt-5 pb-2 space-y-5">

        {/* Pricing options summary */}
        <div className="space-y-2">
          <p className={`text-xs font-semibold uppercase tracking-wider ${t.text} text-center mb-3`}>Options de paiement</p>

          {full.amount && (
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${t.tag}`}>
              <span className="font-semibold">Intégral</span>
              <span>
                {full.amount}
                {full.original && <span className="line-through opacity-50 ml-1.5">{full.original}</span>}
                {full.note && <span className="ml-1 opacity-75">{full.note}</span>}
              </span>
            </div>
          )}

          {quarterly.amount && (
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${t.tag}`}>
              <span className="font-semibold">Trimestriel</span>
              <span>
                {quarterly.amount}{quarterly.period}
                {quarterly.note && <span className="ml-1 opacity-75">{quarterly.note}</span>}
              </span>
            </div>
          )}

          {monthly.amount && (
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${t.tag}`}>
              <span className="font-semibold">Mensuel</span>
              <span>{monthly.amount}{monthly.period}</span>
            </div>
          )}
        </div>

        {/* ========= EXPANDABLE DETAILS ========= */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="space-y-5 pt-4 border-t border-white/5">
                {/* Target */}
                <div>
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${t.text} flex items-center gap-1.5 mb-2`}>
                    <Info className="w-3.5 h-3.5" /> Public cible
                  </h4>
                  <p className="text-sm text-gray-400 leading-relaxed bg-white/[0.03] p-3 rounded-lg border border-white/5">
                    {pkg.targetAudience}
                  </p>
                </div>

                {/* Inclusions */}
                <div>
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <Check className="w-3.5 h-3.5" /> Inclus
                  </h4>
                  <ul className="space-y-1.5">
                    {pkg.inclusions.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${t.text}`} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Exclusions */}
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <X className="w-3.5 h-3.5 text-red-500/70" /> Non inclus
                  </h4>
                  <ul className="space-y-1.5">
                    {pkg.exclusions.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-500">
                        <X className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-500/40" />
                        <span className="italic">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Advice box */}
                <div className="bg-[#0d1117] rounded-lg border border-white/5 p-3 space-y-2">
                  {pkg.implications && (
                    <p className="text-[11px] text-gray-500">
                      <span className="font-bold text-red-400/80 uppercase">Implique : </span>
                      {pkg.implications}
                    </p>
                  )}
                  <p className="text-[11px] text-gray-400">
                    <span className={`font-bold ${t.text} uppercase`}>Conseil : </span>
                    {pkg.advice}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggle details */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-full flex items-center justify-center gap-1 py-2 text-[11px] uppercase tracking-widest font-medium transition-colors rounded-md ${t.text} hover:bg-white/5`}
        >
          {isExpanded ? <>Masquer <ChevronUp className="w-3.5 h-3.5" /></> : <>Voir les details <ChevronDown className="w-3.5 h-3.5" /></>}
        </button>
      </div>

      {/* ========= CTA ========= */}
      <div className="p-5 pt-0 mt-auto">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={`w-full ${t.btn} text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:shadow-xl`}
        >
          <CreditCard className="w-4 h-4" />
          S'inscrire maintenant
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Enrollment popup — rendered via portal into document.body */}
      {modalOpen && <EnrollmentModal pkg={pkg} onClose={() => setModalOpen(false)} />}
    </div>
  );
};

export default PricingCard;