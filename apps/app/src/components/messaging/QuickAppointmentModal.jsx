/**
 * QuickAppointmentModal
 * Affiché quand une invitation live est déclinée ou expirée.
 * Permet de proposer un RDV immédiatement, avec deux modes :
 *   A. "Je propose des créneaux" (appelant choisit des horaires)
 *   B. "Je demande les disponibilités" (appelant attend que l'autre propose)
 */
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, Send, X, ChevronRight, HelpCircle } from 'lucide-react';
import { JourneyAmbientInset, JourneySectionLabel } from '@/components/booking/AppointmentJourneyPrimitives';
import { cn } from '@/lib/utils';

const QUICK_SLOTS = [
  { label: 'Dans 1 heure', offset: 60 },
  { label: 'Demain matin', offset: 60 * 20 },
  { label: 'Dans 2 jours', offset: 60 * 44 },
];

function toLocalISO(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export default function QuickAppointmentModal({
  open,
  onClose,
  recipientName,
  onProposeSlots,   // (slots: string[], subject: string) => void
  onRequestAvailability, // (subject: string) => void
}) {
  const [step, setStep] = useState('choice'); // 'choice' | 'propose' | 'request'
  const [subject, setSubject] = useState('');
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [customSlot, setCustomSlot] = useState('');
  const [busy, setBusy] = useState(false);
  const [isMobileSheet, setIsMobileSheet] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const fn = () => setIsMobileSheet(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  const reset = () => {
    setStep('choice');
    setSubject('');
    setSelectedSlots([]);
    setCustomSlot('');
  };

  const handleClose = () => { reset(); onClose(); };

  const toggleQuickSlot = (offset) => {
    const dt = toLocalISO(new Date(Date.now() + offset * 60 * 1000));
    setSelectedSlots((prev) =>
      prev.includes(dt) ? prev.filter((s) => s !== dt) : [...prev, dt]
    );
  };

  const addCustomSlot = () => {
    if (!customSlot || selectedSlots.includes(customSlot)) return;
    setSelectedSlots((prev) => [...prev, customSlot]);
    setCustomSlot('');
  };

  const handlePropose = async () => {
    if (!subject.trim() || selectedSlots.length === 0) return;
    setBusy(true);
    await onProposeSlots(selectedSlots, subject.trim());
    setBusy(false);
    handleClose();
  };

  const handleRequest = async () => {
    if (!subject.trim()) return;
    setBusy(true);
    await onRequestAvailability(subject.trim());
    setBusy(false);
    handleClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/65 backdrop-blur-md sm:items-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 36, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 36, scale: 0.97 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className={cn(
              'relative w-full max-w-md overflow-hidden shadow-2xl',
              'max-h-[min(94dvh,900px)] sm:max-h-none',
              'rounded-t-[1.35rem] border border-[#D4AF37]/20 border-b-0 bg-[#0a0908]/98 sm:rounded-2xl sm:border sm:border-white/10 sm:border-b sm:bg-[#0D1117]',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {isMobileSheet ? <JourneyAmbientInset /> : null}
            <div
              className="relative z-10 max-h-[min(94dvh,900px)] overflow-y-auto p-5 sm:max-h-none"
              style={{
                paddingTop: 'max(1.1rem, env(safe-area-inset-top, 0px))',
                paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
              }}
            >
            <div className="mx-auto mb-3 hidden h-1 w-11 rounded-full bg-white/25 max-lg:block" aria-hidden />
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <JourneySectionLabel className="mb-1">Messagerie</JourneySectionLabel>
                <div className="mb-1 flex items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37]/25 to-amber-600/10 ring-1 ring-[#D4AF37]/30">
                    <Calendar className="h-4 w-4 text-[#D4AF37]" />
                  </div>
                  <h2 className="text-base font-semibold text-white">Organiser un rendez-vous</h2>
                </div>
                <p className="text-xs text-white/45">
                  {recipientName ? `avec ${recipientName}` : 'avec votre interlocuteur'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="shrink-0 rounded-lg p-1.5 text-white/35 transition-colors hover:bg-white/10 hover:text-white/70"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {step === 'choice' && (
              <div className="space-y-3">
                <p className="text-white/50 text-sm mb-4">
                  Comment souhaitez-vous planifier ce rendez-vous ?
                </p>

                <button
                  type="button"
                  onClick={() => setStep('propose')}
                  className="group flex w-full items-center gap-4 rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/8 p-4 text-left transition-all hover:border-[#D4AF37]/45 hover:bg-[#D4AF37]/12 active:scale-[0.99]"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-[#D4AF37]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">Je propose des créneaux</p>
                    <p className="text-white/40 text-xs mt-0.5">Choisissez 1 à 3 horaires disponibles</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
                </button>

                <button
                  type="button"
                  onClick={() => setStep('request')}
                  className="group flex w-full items-center gap-4 rounded-xl border border-white/12 bg-white/[0.04] p-4 text-left transition-all hover:border-white/22 hover:bg-white/[0.07] active:scale-[0.99]"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                    <HelpCircle className="w-5 h-5 text-white/40" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">Je demande ses disponibilités</p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {recipientName || 'Votre interlocuteur'} vous proposera ses créneaux
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
                </button>
              </div>
            )}

            {step === 'propose' && (
              <div className="space-y-4">
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-2">Sujet du rendez-vous</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Ex: Suivi formation, Question spirituelle..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#D4AF37]/40"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-2">Créneaux proposés</label>
                  <div className="space-y-2">
                    {QUICK_SLOTS.map(({ label, offset }) => {
                      const dt = toLocalISO(new Date(Date.now() + offset * 60 * 1000));
                      const active = selectedSlots.includes(dt);
                      return (
                        <button
                          key={offset}
                          onClick={() => toggleQuickSlot(offset)}
                          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm transition-all ${
                            active
                              ? 'border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[#D4AF37]'
                              : 'border-white/10 bg-white/3 text-white/60 hover:border-white/20'
                          }`}
                        >
                          <span>{label}</span>
                          <span className="text-xs opacity-60">
                            {new Date(Date.now() + offset * 60 * 1000).toLocaleString('fr-FR', {
                              weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </button>
                      );
                    })}

                    <div className="flex gap-2">
                      <input
                        type="datetime-local"
                        value={customSlot}
                        onChange={(e) => setCustomSlot(e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#D4AF37]/40"
                      />
                      <button
                        onClick={addCustomSlot}
                        disabled={!customSlot}
                        className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white/80 disabled:opacity-30 text-xs transition-colors"
                      >
                        Ajouter
                      </button>
                    </div>
                  </div>
                </div>

                {selectedSlots.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSlots.map((s) => (
                      <span key={s} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] text-xs">
                        {new Date(s).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        <button onClick={() => setSelectedSlots((p) => p.filter((x) => x !== s))}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={() => setStep('choice')} className="px-4 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:text-white/70 transition-colors">
                    Retour
                  </button>
                  <button
                    type="button"
                    onClick={handlePropose}
                    disabled={busy || !subject.trim() || selectedSlots.length === 0}
                    className="flex min-h-[3rem] flex-1 items-center justify-center gap-2 rounded-xl bg-[#D4AF37] text-sm font-bold text-black transition-colors hover:bg-amber-400 disabled:opacity-40"
                  >
                    <Send className="w-4 h-4" />
                    {busy ? 'Envoi...' : 'Envoyer la proposition'}
                  </button>
                </div>
              </div>
            )}

            {step === 'request' && (
              <div className="space-y-4">
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-2">Sujet du rendez-vous</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Ex: Consultation, Suivi de formation..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#D4AF37]/40"
                    autoFocus
                  />
                </div>

                <div className="rounded-xl border border-white/8 bg-white/3 p-4">
                  <p className="text-white/50 text-sm">
                    {recipientName || 'Votre interlocuteur'} recevra une demande de disponibilité.
                    Dès qu'il proposera un créneau, vous le verrez dans votre tableau de bord.
                  </p>
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => setStep('choice')} className="px-4 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:text-white/70 transition-colors">
                    Retour
                  </button>
                  <button
                    type="button"
                    onClick={handleRequest}
                    disabled={busy || !subject.trim()}
                    className="flex min-h-[3rem] flex-1 items-center justify-center gap-2 rounded-xl border border-white/18 bg-white/10 text-sm font-semibold text-white transition-colors hover:bg-white/14 disabled:opacity-40"
                  >
                    <Send className="w-4 h-4" />
                    {busy ? 'Envoi...' : 'Demander les disponibilités'}
                  </button>
                </div>
              </div>
            )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
