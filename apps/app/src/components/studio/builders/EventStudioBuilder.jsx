import React from 'react';
import { StudioBuilder } from '../StudioBuilder';
import { MapPin, CalendarDays, Ticket, CheckCircle2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { StudioGenericPreview } from '../StudioGenericPreview';

const STEPS = [
  { id: 1, key: 'informations', label: 'Informations', icon: '📋' },
  { id: 2, key: 'planification', label: 'Planification', icon: '📅' },
  { id: 3, key: 'acces', label: 'Accès', icon: '🎟️' },
  { id: 4, key: 'validation', label: 'Validation', icon: '✅' },
];

function StepEventInformations({ draft, updateDraft }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-1">Informations de l&apos;événement</h2>
        <p className="text-gray-400">Webinaire, atelier ou session en groupe.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#0F1419]/50 p-4 md:col-span-2">
          <Label className="text-gray-300">Titre</Label>
          <Input
            value={draft?.title || ''}
            onChange={(e) => updateDraft({ title: e.target.value })}
            placeholder="Ex: Webinaire Introduction"
            className="mt-2 bg-[#0F1419] border-white/10"
          />
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0F1419]/50 p-4 md:col-span-2">
          <Label className="text-gray-300">Description</Label>
          <textarea
            value={draft?.description || ''}
            onChange={(e) => updateDraft({ description: e.target.value })}
            placeholder="Décrivez votre événement..."
            rows={4}
            className="mt-2 w-full rounded-xl bg-[#0F1419] border border-white/10 px-4 py-3 text-white placeholder:text-gray-500 focus:ring-2 focus:ring-[#D4AF37]/50"
          />
        </div>
      </div>
    </div>
  );
}

function StepEventPlanification({ draft, updateDraft }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-1">Planification</h2>
        <p className="text-gray-400">Organisez la date, la durée et le format de diffusion.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#0F1419]/50 p-4">
          <Label className="text-gray-300">Date</Label>
          <Input
            type="date"
            value={draft?.date || ''}
            onChange={(e) => updateDraft({ date: e.target.value })}
            className="mt-2 bg-[#0F1419] border-white/10"
          />
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0F1419]/50 p-4">
          <Label className="text-gray-300">Durée (minutes)</Label>
          <Input
            type="number"
            value={draft?.duration_minutes || 60}
            onChange={(e) => updateDraft({ duration_minutes: parseInt(e.target.value, 10) || 60 })}
            className="mt-2 bg-[#0F1419] border-white/10"
          />
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0F1419]/50 p-4 md:col-span-2">
          <Label className="text-gray-300">Lieu / URL</Label>
          <Input
            value={draft?.location || ''}
            onChange={(e) => updateDraft({ location: e.target.value })}
            placeholder="Ex: Salle Zoom premium ou adresse physique"
            className="mt-2 bg-[#0F1419] border-white/10"
          />
        </div>
      </div>
    </div>
  );
}

function StepEventAccess({ draft, updateDraft }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-1">Accès et billetterie</h2>
        <p className="text-gray-400">Contrôlez l&apos;accès à votre événement.</p>
      </div>
      <div className="space-y-3">
        {[
          {
            key: 'registration_required',
            title: 'Inscription obligatoire',
            description: "Les participants doivent s'inscrire avant d'accéder.",
            icon: Ticket,
          },
          {
            key: 'waiting_room',
            title: "Salle d'attente",
            description: 'Validez manuellement les entrées sensibles.',
            icon: CalendarDays,
          },
          {
            key: 'share_location',
            title: 'Afficher lieu public',
            description: 'Expose la localisation dans la page événement.',
            icon: MapPin,
          },
        ].map(({ key, title, description, icon: Icon }) => (
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

function StepEventValidation({ draft }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-1">Validation</h2>
        <p className="text-gray-400">Relecture rapide avant publication.</p>
      </div>
      <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-5 space-y-2">
        <div className="flex items-center gap-2 text-[#D4AF37]">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm font-medium">Prêt à publier</span>
        </div>
        <p className="text-sm text-gray-300">Titre: {draft?.title || 'A renseigner'}</p>
        <p className="text-sm text-gray-300">Date: {draft?.date || 'A planifier'}</p>
        <p className="text-sm text-gray-300">Lieu: {draft?.location || 'A renseigner'}</p>
      </div>
    </div>
  );
}

const STEP_COMPONENTS = {
  informations: StepEventInformations,
  planification: StepEventPlanification,
  acces: StepEventAccess,
  validation: StepEventValidation,
};


function validateStep({ stepKey, draft }) {
  if (stepKey === 'informations' && !draft?.title?.trim()) {
    return { valid: false, message: 'Le titre est requis.' };
  }
  if (stepKey === 'planification' && !draft?.date) {
    return { valid: false, message: 'Sélectionnez une date.' };
  }
  return { valid: true };
}

function getStepCompletion({ stepKey, draft }) {
  if (stepKey === 'informations') return Boolean(draft?.title?.trim());
  if (stepKey === 'planification') return Boolean(draft?.date);
  if (stepKey === 'acces') return Boolean(draft?.registration_required || draft?.waiting_room || draft?.share_location);
  if (stepKey === 'validation') return Boolean(draft?.title?.trim() && draft?.date);
  return false;
}
export function EventStudioBuilder(props) {
  const previewComponent = (
    <StudioGenericPreview draft={props.draft} studioLabel="Événement" accent="rose" />
  );

  return (
    <StudioBuilder
      steps={STEPS}
      stepComponents={STEP_COMPONENTS}
      title="Studio de création événement"
      subtitle="Webinaires, ateliers et sessions en groupe"
      showPreview
      previewComponent={previewComponent}
      validateStep={validateStep}
      getStepCompletion={getStepCompletion}
      {...props}
    />
  );
}
