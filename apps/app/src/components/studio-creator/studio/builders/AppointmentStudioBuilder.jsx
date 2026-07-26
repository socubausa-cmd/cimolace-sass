/**
 * COULEURS — purge du froid, lot « builders ». Les cinq builders (formation, cours IA,
 * rendez-vous, événement, coaching) partagent la même grammaire de formulaire : les
 * valeurs ci-dessous sont donc IDENTIQUES d'un fichier à l'autre, c'est volontaire.
 *
 *   · panneau (carte enveloppant libellé + champ, ligne d'option) ...... #30302e
 *   · champ de saisie (Input / Textarea / select / textarea natif) ..... #2b2a27
 *   · aperçu média / bloc récapitulatif ................................ #1f1e1c
 *   · encre .................. #f5f4ee, puis rgba(245,244,238,.78/.65/.55)
 *
 * POURQUOI ce fichier était froid : il posait #0F1419 (bleu nuit) sur TOUTES ses
 * surfaces. Ce hex n'est pas remappé par studioWarm.css — il était donc pleinement
 * visible à l'écran. Le correctif est fait à la source, dans le JSX, jamais par un
 * remap CSS : c'est ce genre de pansement qui a laissé des écrans bleus des mois.
 *
 * POURQUOI l'alpha /50 disparaît sur les panneaux : la coque du studio est #0a0908
 * (studioCreatorShellBg). Un panneau à 50 % y retombait à ~#0d0f11, soit quasiment la
 * couleur de la coque — il ne se lisait plus comme un panneau. La valeur pleine de la
 * charte lui rend son relief, et augmente au passage le contraste du texte posé dessus.
 *
 * POURQUOI les gris Tailwind partent aussi : gray-200/300/400/500 sont des « cool gray »
 * à dominante bleue, ils refroidissent l'écran autant que les hex bannis. On conserve
 * TROIS paliers d'encre chaude pour ne pas écraser la hiérarchie qui existait —
 * .78 (libellés) > .65 (sous-titres) > .55 (descriptions). Bonus : la description des
 * options passe de 3,97:1 (échec WCAG AA) à 4,80:1.
 *
 * CE QUI RESTE INTACT : var(--school-accent) (jeton d'accent du tenant, résolu à
 * l'exécution — le figer casserait le branding client) et border-white/10 (le blanc est
 * achromatique : à 10 % d'opacité il n'apporte aucune froideur perceptible).
 */
import React from 'react';
import { StudioBuilder } from '../StudioBuilder';
import { CalendarDays, Clock3, Users, CheckCircle2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { StudioGenericPreview } from '../StudioGenericPreview';

const STEPS = [
  { id: 1, key: 'informations', label: 'Informations', icon: '📋' },
  { id: 2, key: 'disponibilites', label: 'Disponibilités', icon: '🕐' },
  { id: 3, key: 'experience', label: 'Expérience', icon: '✨' },
  { id: 4, key: 'validation', label: 'Validation', icon: '✅' },
];

function StepAppointmentInformations({ draft, updateDraft }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-[#f5f4ee] mb-1">Informations du rendez-vous</h2>
        <p className="text-[rgba(245,244,238,0.65)]">Type de consultation et durée.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#30302e] p-4 md:col-span-2">
          <Label className="text-[rgba(245,244,238,0.78)]">Titre</Label>
          <Input
            value={draft?.title || ''}
            onChange={(e) => updateDraft({ title: e.target.value })}
            placeholder="Ex: Consultation individuelle"
            className="mt-2 bg-[#2b2a27] border-white/10"
          />
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#30302e] p-4">
          <Label className="text-[rgba(245,244,238,0.78)]">Type de session</Label>
          <select
            value={draft?.session_type || 'individuel'}
            onChange={(e) => updateDraft({ session_type: e.target.value })}
            className="mt-2 w-full rounded-xl bg-[#2b2a27] border border-white/10 px-4 py-2.5 text-[#f5f4ee]"
          >
            <option value="individuel">Individuel</option>
            <option value="groupe">Petit groupe</option>
            <option value="diagnostic">Session diagnostic</option>
          </select>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#30302e] p-4">
          <Label className="text-[rgba(245,244,238,0.78)]">Durée (minutes)</Label>
          <Input
            type="number"
            value={draft?.duration_minutes || 30}
            onChange={(e) => updateDraft({ duration_minutes: parseInt(e.target.value, 10) || 30 })}
            className="mt-2 bg-[#2b2a27] border-white/10"
          />
        </div>
      </div>
    </div>
  );
}

function StepAppointmentDisponibilites({ draft, updateDraft }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-[#f5f4ee] mb-1">Disponibilités</h2>
        <p className="text-[rgba(245,244,238,0.65)]">Cadrez vos créneaux pour simplifier la prise de rendez-vous.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#30302e] p-4">
          <Label className="text-[rgba(245,244,238,0.78)]">Date de démarrage</Label>
          <Input
            type="date"
            value={draft?.date || ''}
            onChange={(e) => updateDraft({ date: e.target.value })}
            className="mt-2 bg-[#2b2a27] border-white/10"
          />
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#30302e] p-4">
          <Label className="text-[rgba(245,244,238,0.78)]">Fenêtre horaire</Label>
          <Input
            value={draft?.time_range || ''}
            onChange={(e) => updateDraft({ time_range: e.target.value })}
            placeholder="Ex: 09:00 - 18:00"
            className="mt-2 bg-[#2b2a27] border-white/10"
          />
        </div>
      </div>
    </div>
  );
}

function StepAppointmentExperience({ draft, updateDraft }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-[#f5f4ee] mb-1">Expérience client</h2>
        <p className="text-[rgba(245,244,238,0.65)]">Définissez les options de réservation et de suivi.</p>
      </div>
      <div className="space-y-3">
        {[
          {
            key: 'confirmation_email',
            title: 'Email de confirmation automatique',
            description: 'Envoie un rappel avec les détails de la session.',
            icon: CalendarDays,
          },
          {
            key: 'allow_reschedule',
            title: 'Autoriser le report',
            description: 'Le client peut déplacer son rendez-vous avant la session.',
            icon: Clock3,
          },
          {
            key: 'waitlist_enabled',
            title: "Liste d'attente intelligente",
            description: 'Propose les créneaux libérés aux personnes en attente.',
            icon: Users,
          },
        ].map(({ key, title, description, icon: Icon }) => (
          <div key={key} className="rounded-xl border border-white/10 bg-[#30302e] p-4 flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Icon className="w-4 h-4 text-[color-mix(in_srgb,var(--school-accent)_80%,transparent)] mt-1" />
              <div>
                <p className="text-sm text-[#f5f4ee] font-medium">{title}</p>
                <p className="text-xs text-[rgba(245,244,238,0.55)]">{description}</p>
              </div>
            </div>
            <Switch
              checked={Boolean(draft?.[key])}
              onCheckedChange={(v) => updateDraft({ [key]: v })}
              className="data-[state=checked]:bg-[var(--school-accent)]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function StepAppointmentValidation({ draft }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#f5f4ee] mb-1">Validation</h2>
        <p className="text-[rgba(245,244,238,0.65)]">Vérifiez le setup avant publication.</p>
      </div>
      <div className="rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] p-5 space-y-3">
        <div className="flex items-center gap-2 text-[var(--school-accent)]">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm font-medium">Checklist studio</span>
        </div>
        <p className="text-sm text-[rgba(245,244,238,0.78)]">Titre: {draft?.title || 'A renseigner'}</p>
        <p className="text-sm text-[rgba(245,244,238,0.78)]">Durée: {draft?.duration_minutes || 30} min</p>
        <p className="text-sm text-[rgba(245,244,238,0.78)]">Disponibilités: {draft?.date ? 'Configurées' : 'A finaliser'}</p>
      </div>
    </div>
  );
}

const STEP_COMPONENTS = {
  informations: StepAppointmentInformations,
  disponibilites: StepAppointmentDisponibilites,
  experience: StepAppointmentExperience,
  validation: StepAppointmentValidation,
};


function validateStep({ stepKey, draft }) {
  if (stepKey === 'informations' && !draft?.title?.trim()) {
    return { valid: false, message: 'Le titre est requis.' };
  }
  if (stepKey === 'disponibilites' && !draft?.date) {
    return { valid: false, message: 'Ajoutez une date de démarrage.' };
  }
  return { valid: true };
}

function getStepCompletion({ stepKey, draft }) {
  if (stepKey === 'informations') return Boolean(draft?.title?.trim());
  if (stepKey === 'disponibilites') return Boolean(draft?.date);
  if (stepKey === 'experience') return Boolean(draft?.confirmation_email || draft?.allow_reschedule || draft?.waitlist_enabled);
  if (stepKey === 'validation') return Boolean(draft?.title?.trim() && draft?.date);
  return false;
}
export function AppointmentStudioBuilder(props) {
  const previewComponent = (
    <StudioGenericPreview draft={props.draft} studioLabel="Rendez-vous" accent="emerald" />
  );

  return (
    <StudioBuilder
      steps={STEPS}
      stepComponents={STEP_COMPONENTS}
      title="Studio de création rendez-vous"
      subtitle="Consultations et créneaux réservables"
      showPreview
      previewComponent={previewComponent}
      validateStep={validateStep}
      getStepCompletion={getStepCompletion}
      {...props}
    />
  );
}
