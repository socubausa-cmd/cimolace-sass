import React, { useCallback, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { assistantMode } from '@/data/adminDocumentLibrary';
import { composeDocumentFromLibraryTemplate } from '@/lib/adminDocumentTemplateEngine';

const TYPE_TO_TEMPLATE = {
  letter: 'tpl_letter_admin_001',
  contract: 'tpl_contract_001',
  memo: 'tpl_memo_001',
};

/**
 * Assistant guidé — remplace le document par une structure générée (blocs + variables).
 */
export default function AdminDocumentAssistantModal({ open, onClose, onApply }) {
  const [step, setStep] = useState(0);
  const [docType, setDocType] = useState('letter');
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [signature, setSignature] = useState('');

  const reset = useCallback(() => {
    setStep(0);
    setDocType('letter');
    setRecipient('');
    setSubject('');
    setContent('');
    setSignature('');
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleFinish = useCallback(() => {
    const templateId = TYPE_TO_TEMPLATE[docType] || TYPE_TO_TEMPLATE.letter;
    const title = subject.trim() || 'Document assisté';
    const state = composeDocumentFromLibraryTemplate(templateId, {
      recipient: recipient.trim() || 'Nom / Service',
      subject: subject.trim() || '…',
      content: content.trim() || '',
      signature: signature.trim() || 'Nom, prénom — Fonction',
      title,
      sender_block: undefined,
    });
    if (state) onApply(state);
    handleClose();
  }, [docType, recipient, subject, content, signature, onApply, handleClose]);

  if (!open) return null;

  const steps = assistantMode.steps;
  const total = steps.length;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="relative w-full max-w-lg rounded-2xl border border-black/[0.08] bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-assistant-title"
      >
        <div className="flex items-center justify-between border-b border-black/[0.08] px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#8A6D1A]" />
            <h2 id="admin-assistant-title" className="text-sm font-semibold text-[#18181B]">
              Assistant LONGIA — document structuré
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-[#71717A] hover:bg-black/[0.05] hover:text-[#18181B]"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-2">
          <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.08]">
            <div
              className="h-full rounded-full bg-[var(--school-accent)] transition-all"
              style={{ width: `${((step + 1) / total) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-[#71717A]">
            Étape {step + 1} / {total} — {steps[step]?.label}
          </p>
        </div>

        <div className="max-h-[min(60vh,420px)] overflow-y-auto px-4 pb-4">
          {step === 0 && (
            <div className="space-y-2">
              <p className="text-[11px] text-[#52525B]">Type de document (structure + blocs)</p>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[12px] text-[#18181B]"
              >
                <option value="letter">Lettre administrative</option>
                <option value="contract">Contrat / convention</option>
                <option value="memo">Note / mémo interne</option>
              </select>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-2">
              <label className="text-[11px] text-[#52525B]">Destinataire</label>
              <input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Nom, service ou organisation"
                className="w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[12px] text-[#18181B] placeholder:text-[#A1A1AA]"
              />
            </div>
          )}
          {step === 2 && (
            <div className="space-y-2">
              <label className="text-[11px] text-[#52525B]">Objet</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Objet du courrier ou du dossier"
                className="w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[12px] text-[#18181B] placeholder:text-[#A1A1AA]"
              />
            </div>
          )}
          {step === 3 && (
            <div className="space-y-2">
              <label className="text-[11px] text-[#52525B]">Contenu / consigne</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                placeholder="Décrivez le fond : contexte, demande, décision attendue…"
                className="w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[12px] text-[#18181B] placeholder:text-[#A1A1AA]"
              />
            </div>
          )}
          {step === 4 && (
            <div className="space-y-2">
              <label className="text-[11px] text-[#52525B]">Signature (nom / fonction)</label>
              <input
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Ex. : Marie Dupont — Directrice"
                className="w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[12px] text-[#18181B] placeholder:text-[#A1A1AA]"
              />
              <p className="text-[9px] leading-relaxed text-[#A1A1AA]">
                Un document complet sera généré à partir des blocs (en-tête, objet, corps, formule, signatures). Vous
                pourrez le modifier puis utiliser LONGIA pour reformuler des passages.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-black/[0.08] px-4 py-3">
          <button
            type="button"
            onClick={() => (step > 0 ? setStep(step - 1) : handleClose())}
            className="inline-flex items-center gap-1 rounded-lg border border-black/[0.12] bg-white px-3 py-2 text-[11px] text-[#52525B] hover:bg-[#F4F5F7]"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> {step === 0 ? 'Annuler' : 'Précédent'}
          </button>
          {step < total - 1 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--school-accent)] px-3 py-2 text-[11px] font-semibold text-black hover:bg-[#c9a532]"
            >
              Suivant <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--school-accent)] px-3 py-2 text-[11px] font-semibold text-black hover:bg-[#c9a532]"
            >
              Générer le document
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
