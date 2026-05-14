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
        <h2 className="text-2xl font-semibold text-white mb-1">Informations du programme</h2>
        <p className="text-gray-400">Accompagnement personnalisé, mentorat ou suivi.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#0F1419]/50 p-4 md:col-span-2">
          <Label className="text-gray-300">Titre</Label>
          <Input
            value={draft?.title || ''}
            onChange={(e) => updateDraft({ title: e.target.value })}
            placeholder="Ex: Programme Coaching 1-to-1"
            className="mt-2 bg-[#0F1419] border-white/10"
          />
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0F1419]/50 p-4 md:col-span-2">
          <Label className="text-gray-300">Description</Label>
          <textarea
            value={draft?.description || ''}
            onChange={(e) => updateDraft({ description: e.target.value })}
            placeholder="Décrivez votre programme..."
            rows={4}
            className="mt-2 w-full rounded-xl bg-[#0F1419] border border-white/10 px-4 py-3 text-white placeholder:text-gray-500 focus:ring-2 focus:ring-[#D4AF37]/50"
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
        <h2 className="text-2xl font-semibold text-white mb-1">Structure du programme</h2>
        <p className="text-gray-400">Cadrez le rythme et les objectifs de progression.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#0F1419]/50 p-4">
          <Label className="text-gray-300">Durée du programme (semaines)</Label>
          <Input
            type="number"
            value={draft?.program_weeks || 6}
            onChange={(e) => updateDraft({ program_weeks: parseInt(e.target.value, 10) || 6 })}
            className="mt-2 bg-[#0F1419] border-white/10"
          />
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0F1419]/50 p-4">
          <Label className="text-gray-300">Sessions par semaine</Label>
          <Input
            type="number"
            value={draft?.sessions_per_week || 1}
            onChange={(e) => updateDraft({ sessions_per_week: parseInt(e.target.value, 10) || 1 })}
            className="mt-2 bg-[#0F1419] border-white/10"
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
        <h2 className="text-2xl font-semibold text-white mb-1">Expérience de coaching</h2>
        <p className="text-gray-400">Activez les options d'accompagnement premium.</p>
      </div>
      <div className="space-y-3">
        {options.map(({ key, title, description, icon: Icon }) => (
          <div key={key} className="rounded-xl border border-white/10 bg-[#0F1419]/50 p-4 flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Icon className="w-4 h-4 text-[#D4AF37]/80 mt-1" />
              <div>
                <p className="text-sm text-white font-medium">{title}</p>
                <p className="text-xs text-gray-500">{description}</p>
              </div>
            </div>
            <Switch
              checked={Boolean(draft?.[key])}
              onCheckedChange={(v) => updateDraft({ [key]: v })}
              className="data-[state=checked]:bg-[#D4AF37]"
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
        <h2 className="text-2xl font-semibold text-white mb-1">Validation</h2>
        <p className="text-gray-400">Contrôlez la cohérence avant création.</p>
      </div>
      <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-5 space-y-2">
        <div className="flex items-center gap-2 text-[#D4AF37]">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm font-medium">Programme premium prêt</span>
        </div>
        <p className="text-sm text-gray-300">Titre: {draft?.title || 'A renseigner'}</p>
        <p className="text-sm text-gray-300">Durée: {draft?.program_weeks || 6} semaines</p>
        <p className="text-sm text-gray-300">Cadence: {draft?.sessions_per_week || 1} session/semaine</p>
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
  const previewComponent = (
    <StudioGenericPreview draft={props.draft} studioLabel="Coaching" accent="violet" />
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
