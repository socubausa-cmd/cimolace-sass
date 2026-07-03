/**
 * Étapes du Studio de création live — icônes Lucide + libellés stepper (maquette).
 */
import {
  FileText,
  Image,
  CalendarDays,
  Shield,
  UserPlus,
  Monitor,
  Sparkles,
  CheckCircle2,
  Stethoscope,
} from 'lucide-react';

export const LIVE_STUDIO_STEPS = [
  { id: 1, key: 'informations', label: 'Informations', progressLabel: 'INFORMATIONS', icon: FileText },
  { id: 2, key: 'couverture', label: 'Couverture', progressLabel: 'COUVERTURE', icon: Image },
  { id: 3, key: 'date', label: 'Date & horaire', progressLabel: 'DATE & HORAIRE', icon: CalendarDays },
  { id: 4, key: 'securite', label: 'Sécurité', progressLabel: 'SÉCURITÉ', icon: Shield },
  { id: 5, key: 'inviter', label: 'Inviter', progressLabel: 'INVITER', icon: UserPlus },
  { id: 6, key: 'salle', label: 'Salle virtuelle', progressLabel: 'SALLE VIRTUELLE', icon: Monitor },
  { id: 7, key: 'interactions', label: 'Interactions & IA', progressLabel: 'INTERACTIONS & IA', icon: Sparkles },
  { id: 8, key: 'validation', label: 'Validation', progressLabel: 'VALIDATION', icon: CheckCircle2 },
];

// Étape « Dossier MEDOS » (Live santé) — insérée AVANT Validation en mode medos.
export const MEDOS_DOSSIER_STEP = {
  id: 8, key: 'dossier_medos', label: 'Dossier MEDOS', progressLabel: 'DOSSIER MEDOS', icon: Stethoscope,
};

/**
 * Liste ordonnée des étapes selon le mode. En Live santé (MEDOS) on insère
 * « Dossier MEDOS » en id 8 et Validation passe en id 9. Les étapes 1..7 (et leurs
 * sous-étapes 6/7 câblées en dur dans StudioBuilder) restent inchangées → aucune
 * numérotation existante n'est cassée. Les id restent séquentiels 1..N (requis par
 * la navigation de StudioBuilder : currentStep ∈ [1, steps.length]).
 * @param {boolean} medosMode
 */
export function getLiveStudioSteps(medosMode) {
  if (!medosMode) return LIVE_STUDIO_STEPS;
  const validation = LIVE_STUDIO_STEPS[LIVE_STUDIO_STEPS.length - 1]; // id 8
  return [
    ...LIVE_STUDIO_STEPS.slice(0, -1), // 1..7 inchangées
    MEDOS_DOSSIER_STEP,                // 8
    { ...validation, id: 9 },          // Validation → 9
  ];
}
