import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarClock, Video, Phone } from 'lucide-react';

/** Date → valeur d'un <input type="datetime-local"> (heure locale). */
function toLocalInput(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Programmer un appel (façon « Schedule call ») depuis une conversation.
 * Collecte titre / description / début / fin / type (vidéo|audio) / approbation,
 * puis remonte le tout via `onSchedule(payload)` — le parent crée le live programmé
 * et envoie le lien dans la conversation.
 */
export default function ScheduleCallModal({ open, onClose, recipientName, onSchedule }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [includeEnd, setIncludeEnd] = useState(true);
  const [callType, setCallType] = useState('video');
  const [requireApproval, setRequireApproval] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // (Ré)initialise les champs à chaque ouverture : début dans 1h (heure ronde), fin +30 min.
  useEffect(() => {
    if (!open) return;
    const s = new Date(Date.now() + 60 * 60 * 1000);
    s.setMinutes(0, 0, 0);
    const e = new Date(s.getTime() + 30 * 60 * 1000);
    setTitle(`Appel avec ${recipientName || 'un membre'}`);
    setDescription('');
    setStart(toLocalInput(s));
    setEnd(toLocalInput(e));
    setIncludeEnd(true);
    setCallType('video');
    setRequireApproval(false);
    setError('');
    setSubmitting(false);
  }, [open, recipientName]);

  const submit = async () => {
    if (submitting) return;
    if (!title.trim()) { setError('Donnez un titre à l’appel.'); return; }
    if (!start) { setError('Choisissez une date de début.'); return; }
    if (includeEnd && end && new Date(end) <= new Date(start)) { setError('La fin doit être après le début.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await onSchedule?.({
        title: title.trim(),
        description: description.trim(),
        startISO: new Date(start).toISOString(),
        endISO: includeEnd && end ? new Date(end).toISOString() : null,
        callType,
        requireApproval,
      });
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Impossible de programmer l’appel.');
    } finally {
      setSubmitting(false);
    }
  };

  const card = 'rounded-2xl border border-white/10 bg-white/[0.03]';
  const dtInput = 'bg-transparent text-sm text-gray-100 outline-none [color-scheme:dark]';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[220] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0b0f16] shadow-2xl sm:max-w-lg sm:rounded-3xl"
            initial={{ y: 48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 48, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0b0f16] px-4 py-3">
              <button type="button" onClick={onClose} className="text-sm text-gray-400 transition-colors hover:text-gray-200">Annuler</button>
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-100">
                <CalendarClock className="h-4 w-4 text-[var(--school-accent)]" /> Programmer un appel
              </div>
              <button
                type="button" onClick={submit} disabled={submitting}
                className="text-sm font-semibold text-[var(--school-accent)] transition-opacity disabled:opacity-50"
              >
                {submitting ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>

            <div className="space-y-4 p-4">
              {/* Titre + description */}
              <div className={`${card} px-4 py-3`}>
                <input
                  type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="Titre de l'appel"
                  className="w-full bg-transparent text-[15px] font-medium text-gray-100 placeholder-gray-500 outline-none"
                />
                <textarea
                  value={description} onChange={(e) => setDescription(e.target.value.slice(0, 2048))}
                  placeholder="Ajouter une description (optionnel)" rows={2}
                  className="mt-2 w-full resize-none bg-transparent text-sm text-gray-300 placeholder-gray-500 outline-none"
                />
              </div>

              {/* Début / Fin */}
              <div className={`${card} divide-y divide-white/10`}>
                <label className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm text-gray-200">Début</span>
                  <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={dtInput} />
                </label>
                {includeEnd && (
                  <label className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-sm text-gray-200">Fin</span>
                    <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={dtInput} />
                  </label>
                )}
                <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm text-gray-200">Inclure l'heure de fin</span>
                  <input type="checkbox" checked={includeEnd} onChange={(e) => setIncludeEnd(e.target.checked)} className="h-4 w-4 accent-[var(--school-accent)]" />
                </label>
              </div>

              {/* Type + approbation */}
              <div className={`${card} divide-y divide-white/10`}>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm text-gray-200">Type d'appel</span>
                  <div className="flex items-center gap-1 rounded-full bg-white/5 p-0.5">
                    <button
                      type="button" onClick={() => setCallType('video')}
                      className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs transition-colors ${callType === 'video' ? 'bg-[var(--school-accent)] font-semibold text-black' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                      <Video className="h-3.5 w-3.5" /> Vidéo
                    </button>
                    <button
                      type="button" onClick={() => setCallType('audio')}
                      className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs transition-colors ${callType === 'audio' ? 'bg-[var(--school-accent)] font-semibold text-black' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                      <Phone className="h-3.5 w-3.5" /> Audio
                    </button>
                  </div>
                </div>
                <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm text-gray-200">Exiger l'approbation pour rejoindre</span>
                  <input type="checkbox" checked={requireApproval} onChange={(e) => setRequireApproval(e.target.checked)} className="h-4 w-4 accent-[var(--school-accent)]" />
                </label>
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}
              <p className="text-[11px] leading-relaxed text-gray-500">
                L'appel programmé crée un salon LIRI et envoie automatiquement le lien (date + heure) dans la conversation.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
