/**
 * LiveStudioBuilder — Variante Studio pour création de lives
 * Utilise le moteur StudioBuilder avec étapes live
 */
import React from 'react';
import { StudioBuilder } from '../StudioBuilder';
import { LiveStudioPreview } from '@/components/live-studio/LiveStudioPreview';
import { Step1Informations } from '@/components/live-studio/steps/Step1Informations';
import { Step2Couverture } from '@/components/live-studio/steps/Step2Couverture';
import { Step3DateHoraire } from '@/components/live-studio/steps/Step3DateHoraire';
import { Step4Securite } from '@/components/live-studio/steps/Step4Securite';
import { Step5Inviter } from '@/components/live-studio/steps/Step5Inviter';
import { Step6SalleVirtuelle } from '@/components/live-studio/steps/Step6SalleVirtuelle';
import { Step7Interactions } from '@/components/live-studio/steps/Step7Interactions';
import { Step8Validation } from '@/components/live-studio/steps/Step8Validation';
import { LIVE_STUDIO_STEPS as STEPS } from '@/components/live-studio/liveStudioSteps';

const STEP_COMPONENTS = {
  informations: Step1Informations,
  couverture: Step2Couverture,
  date: Step3DateHoraire,
  securite: Step4Securite,
  inviter: Step5Inviter,
  salle: Step6SalleVirtuelle,
  interactions: Step7Interactions,
  validation: Step8Validation,
};

function validateLiveStep({ stepKey, draft }) {
  if (stepKey === 'informations' && !draft?.title?.trim()) {
    return { valid: false, message: 'Le titre du live est requis.' };
  }
  if (stepKey === 'date' && !draft?.scheduled_at) {
    return { valid: false, message: 'La date du live est requise.' };
  }
  return { valid: true };
}

function getLiveStepCompletion({ stepKey, draft }) {
  switch (stepKey) {
    case 'informations':
      return Boolean(draft?.title?.trim());
    case 'couverture':
      return Boolean(draft?.cover_image_url?.trim() || draft?.thumbnail_url?.trim());
    case 'date':
      return Boolean(draft?.scheduled_at && draft?.scheduled_time);
    case 'securite':
      return Boolean(draft?.visibility_mode);
    case 'inviter':
      return Array.isArray(draft?.invited_users);
    case 'salle':
      return true;
    case 'interactions':
      return true;
    case 'validation':
      return false;
    default:
      return false;
  }
}

export function LiveStudioBuilder(props) {
  return (
    <StudioBuilder
      steps={STEPS}
      stepComponents={STEP_COMPONENTS}
      nestedSubStepCounts={{ 6: 3, 7: 3 }}
      liveCreationShell
      title="Live Studio Créateur"
      subtitle="Configuration étape par étape"
      previewComponent={LiveStudioPreview}
      extraStepProps={{
        isStaff: props.isStaff,
        teachers: props.teachers,
        selectedTeacherId: props.selectedTeacherId,
        onTeacherChange: props.onTeacherChange,
        user: props.user,
        clearDraft: props.clearDraft,
        liriAgentImport: props.liriAgentImport,
      }}
      validateStep={validateLiveStep}
      getStepCompletion={getLiveStepCompletion}
      lastStepScrollToActionsId="studio-validation-actions"
      {...props}
    />
  );
}
