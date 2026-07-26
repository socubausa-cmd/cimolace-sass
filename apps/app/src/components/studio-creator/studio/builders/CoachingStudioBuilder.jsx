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
import { HeartHandshake, Target, Layers3, CheckCircle2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { StudioGenericPreview } from '../StudioGenericPreview';

const STEPS = [
  { id: 1, key: 'informations', label: 'Informations', icon: '📋' },
  { id: 2, key: 'programme', label: 'Programme', icon: '📆' },
  { id: 3, key: 'experience', label: 'Expérience', icon: '✨' },
  { id: 4, key: 'validation', label: 'Validation', icon: '✅' },
];

function StepCoachingInformations({ draft, updateDraft }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-[#f5f4ee] mb-1">Informations du programme</h2>
        <p className="text-[rgba(245,244,238,0.65)]">Accompagnement personnalisé, mentorat ou suivi.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#30302e] p-4 md:col-span-2">
          <Label className="text-[rgba(245,244,238,0.78)]">Titre</Label>
          <Input
            value={draft?.title || ''}
            onChange={(e) => updateDraft({ title: e.target.value })}
            placeholder="Ex: Programme Coaching 1-to-1"
            className="mt-2 bg-[#2b2a27] border-white/10"
          />
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#30302e] p-4 md:col-span-2">
          <Label className="text-[rgba(245,244,238,0.78)]">Description</Label>
          <textarea
            value={draft?.description || ''}
            onChange={(e) => updateDraft({ description: e.target.value })}
            placeholder="Décrivez votre programme..."
            rows={4}
            className="mt-2 w-full rounded-xl bg-[#2b2a27] border border-white/10 px-4 py-3 text-[#f5f4ee] placeholder:text-[rgba(245,244,238,0.55)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--school-accent)_50%,transparent)]"
          />
        </div>
      </div>
    </div>
  );
}

function StepCoachingProgramme({ draft, updateDraft }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-[#f5f4ee] mb-1">Structure du programme</h2>
        <p className="text-[rgba(245,244,238,0.65)]">Cadrez le rythme et les objectifs de progression.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#30302e] p-4">
          <Label className="text-[rgba(245,244,238,0.78)]">Durée du programme (semaines)</Label>
          <Input
            type="number"
            value={draft?.program_weeks || 6}
            onChange={(e) => updateDraft({ program_weeks: parseInt(e.target.value, 10) || 6 })}
            className="mt-2 bg-[#2b2a27] border-white/10"
          />
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#30302e] p-4">
          <Label className="text-[rgba(245,244,238,0.78)]">Sessions par semaine</Label>
          <Input
            type="number"
            value={draft?.sessions_per_week || 1}
            onChange={(e) => updateDraft({ sessions_per_week: parseInt(e.target.value, 10) || 1 })}
            className="mt-2 bg-[#2b2a27] border-white/10"
          />
        </div>
      </div>
    </div>
  );
}

function StepCoachingExperience({ draft, updateDraft }) {
  const options = [
    {
      key: 'journal_enabled',
      title: 'Journal de progression',
      description: 'Permet au coaché de noter ses avancées entre les sessions.',
      icon: Layers3,
    },
    {
      key: 'goals_tracking',
      title: "Suivi d'objectifs",
      description: 'Visualise les objectifs atteints et les prochains jalons.',
      icon: Target,
    },
    {
      key: 'mentor_chat',
      title: 'Canal mentor privé',
      description: 'Messagerie dédiée entre les séances.',
      icon: HeartHandshake,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#f5f4ee] mb-1">Expérience de coaching</h2>
        <p className="text-[rgba(245,244,238,0.65)]">Activez les options d'accompagnement premium.</p>
      </div>
      <div className="space-y-3">
        {options.map(({ key, title, description, icon: Icon }) => (
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

function StepCoachingValidation({ draft }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#f5f4ee] mb-1">Validation</h2>
        <p className="text-[rgba(245,244,238,0.65)]">Contrôlez la cohérence avant création.</p>
      </div>
      <div className="rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] p-5 space-y-2">
        <div className="flex items-center gap-2 text-[var(--school-accent)]">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm font-medium">Programme premium prêt</span>
        </div>
        <p className="text-sm text-[rgba(245,244,238,0.78)]">Titre: {draft?.title || 'A renseigner'}</p>
        <p className="text-sm text-[rgba(245,244,238,0.78)]">Durée: {draft?.program_weeks || 6} semaines</p>
        <p className="text-sm text-[rgba(245,244,238,0.78)]">Cadence: {draft?.sessions_per_week || 1} session/semaine</p>
      </div>
    </div>
  );
}

const STEP_COMPONENTS = {
  informations: StepCoachingInformations,
  programme: StepCoachingProgramme,
  experience: StepCoachingExperience,
  validation: StepCoachingValidation,
};


function validateStep({ stepKey, draft }) {
  if (stepKey === 'informations' && !draft?.title?.trim()) {
    return { valid: false, message: 'Le titre est requis.' };
  }
  if (stepKey === 'programme' && (!draft?.program_weeks || draft?.program_weeks < 1)) {
    return { valid: false, message: 'Indiquez une durée de programme valide.' };
  }
  return { valid: true };
}

function getStepCompletion({ stepKey, draft }) {
  if (stepKey === 'informations') return Boolean(draft?.title?.trim());
  if (stepKey === 'programme') return Boolean(draft?.program_weeks && draft?.sessions_per_week);
  if (stepKey === 'experience') return Boolean(draft?.journal_enabled || draft?.goals_tracking || draft?.mentor_chat);
  if (stepKey === 'validation') return Boolean(draft?.title?.trim() && draft?.program_weeks);
  return false;
}
export function CoachingStudioBuilder(props) {
  /**
   * Accent de l'aperçu : `violet` était un accent FROID (et un mot banni par la charte).
   * On demande `terre` (#d8916a), la teinte de la rampe chaude qui va à l'accompagnement.
   * StudioGenericPreview appartient à un autre lot : si la clé `terre` n'y a pas encore
   * été ajoutée, le composant retombe sur son accent par défaut (`amber`) — chaud dans
   * tous les cas, jamais froid, jamais cassé. C'est le seul point de cette passe qui
   * dépend d'un fichier hors périmètre.
   */
  const previewComponent = (
    <StudioGenericPreview draft={props.draft} studioLabel="Coaching" accent="terre" />
  );

  return (
    <StudioBuilder
      steps={STEPS}
      stepComponents={STEP_COMPONENTS}
      title="Studio de création programme / coaching"
      subtitle="Accompagnement et mentorat"
      showPreview
      previewComponent={previewComponent}
      validateStep={validateStep}
      getStepCompletion={getStepCompletion}
      {...props}
    />
  );
}
