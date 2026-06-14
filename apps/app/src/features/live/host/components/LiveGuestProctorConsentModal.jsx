import React from 'react';
import { Button } from '@/components/ui/button';

export const LiveGuestProctorConsentModal = ({ open, isGuestUi, onAccept, onRefuse }) => {
  if (!open || !isGuestUi) return null;
  return (
    <div
      className="fixed inset-0 z-[230] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="liri-proctor-consent-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-gradient-to-b from-[#141a28] to-[#0a0d14] p-6 shadow-2xl">
        <h2 id="liri-proctor-consent-title" className="text-lg font-semibold text-[#f5dd8a] mb-3">
          Consentement — contrôle caméra (classe surveillée)
        </h2>
        <p className="text-sm text-white/80 leading-relaxed mb-2">
          <strong className="font-semibold text-white/90">Finalité :</strong> permettre au formateur, en
          cours, d'allumer ou d\'éteindre votre caméra depuis son poste lorsque la salle est configurée en
          mode proche d'un examen sous surveillance — par exemple pour vérifier l\'identité ou réagir à un
          incident (comportement inapproprié, trouble à l'ordre du cours).
        </p>
        <p className="text-sm text-white/75 leading-relaxed mb-2">
          <strong className="font-semibold text-white/90">Traçabilité :</strong> chaque demande
          d'activation ou d\'extinction enregistrée par le formateur est conservée côté serveur (horodatage,
          session, comptes concernés), consultable par le formateur et par vous pour les lignes qui vous
          concernent.
        </p>
        <p className="text-xs text-white/45 mb-6 leading-relaxed">
          Vous pouvez refuser : dans ce cas vous ne rejoignez pas la classe avec la vidéo. En cas de doute
          sur le cadre légal (mineurs, établissement, CNIL), rapprochez-vous de votre administration avant
          d'accepter.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-end">
          <Button type="button" variant="ghost" className="text-white/70 hover:text-white" onClick={onRefuse}>
            Refuser et quitter
          </Button>
          <Button type="button" className="bg-[var(--school-accent)] text-black hover:bg-[#e8c85c]" onClick={onAccept}>
            J&apos;accepte et j&apos;entre
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LiveGuestProctorConsentModal;
