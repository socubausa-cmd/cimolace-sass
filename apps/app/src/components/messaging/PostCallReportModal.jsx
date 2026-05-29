/**
 * PostCallReportModal
 * Affiché après la fin d'un appel immersif.
 * Propose de générer un rapport IA de la session et de l'envoyer.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Mail, Inbox, Sparkles, CheckCircle2, X } from 'lucide-react';

function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0 min';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return s > 0 ? `${m} min ${s}s` : `${m} min`;
}

export default function PostCallReportModal({
  open,
  onClose,
  callDurationSeconds,
  participantName,
  onGenerateReport, // async (sendEmail: bool, sendInbox: bool) => void
}) {
  const [sendEmail, setSendEmail] = useState(true);
  const [sendInbox, setSendInbox] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await onGenerateReport(sendEmail, sendInbox);
      setDone(true);
      setTimeout(() => { setDone(false); onClose(); }, 2000);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0D1117] p-6 shadow-2xl"
          >
            {done ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                <p className="text-white font-medium text-sm">Rapport envoyé</p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                      <h2 className="text-white font-semibold text-sm">Rapport de session</h2>
                    </div>
                    <p className="text-white/40 text-xs">
                      Durée : {formatDuration(callDurationSeconds)}
                      {participantName ? ` · avec ${participantName}` : ''}
                    </p>
                  </div>
                  <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-white/50 text-xs mb-4 leading-relaxed">
                  L'IA peut résumer cette session (durée, thèmes abordés, prochaines étapes)
                  et vous l'envoyer par message ou email.
                </p>

                <div className="space-y-2 mb-5">
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-white/8 bg-white/3 cursor-pointer hover:border-white/15 transition-colors">
                    <input
                      type="checkbox"
                      checked={sendInbox}
                      onChange={(e) => setSendInbox(e.target.checked)}
                      className="w-4 h-4 accent-[#D4AF37] rounded"
                    />
                    <div className="flex items-center gap-2">
                      <Inbox className="w-4 h-4 text-white/40" />
                      <span className="text-white/70 text-sm">Boîte de réception intégrée</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl border border-white/8 bg-white/3 cursor-pointer hover:border-white/15 transition-colors">
                    <input
                      type="checkbox"
                      checked={sendEmail}
                      onChange={(e) => setSendEmail(e.target.checked)}
                      className="w-4 h-4 accent-[#D4AF37] rounded"
                    />
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-white/40" />
                      <span className="text-white/70 text-sm">Par email</span>
                    </div>
                  </label>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:text-white/60 transition-colors"
                  >
                    Ignorer
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={generating || (!sendEmail && !sendInbox)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-sm font-medium disabled:opacity-40 hover:bg-[#D4AF37]/25 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    {generating ? 'Génération...' : 'Générer le rapport'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
