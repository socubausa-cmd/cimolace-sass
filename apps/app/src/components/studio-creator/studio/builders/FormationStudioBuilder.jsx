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
import { Layers3, BookOpenText, Video, Settings2, CheckCircle2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { StudioGenericPreview } from '../StudioGenericPreview';

const STEPS = [
  { id: 1, key: 'informations', label: 'Informations', icon: '📋' },
  { id: 2, key: 'structure', label: 'Structure', icon: '📚' },
  { id: 3, key: 'pedagogie', label: 'Pédagogie', icon: '🧠' },
  { id: 4, key: 'visuel', label: 'Visuel', icon: '🖼️' },
  { id: 5, key: 'parametres', label: 'Paramètres', icon: '⚙️' },
  { id: 6, key: 'validation', label: 'Validation', icon: '✅' },
];

function StepFormationInformations({ draft, updateDraft }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-[#f5f4ee] mb-1">Informations de la formation</h2>
        <p className="text-[rgba(245,244,238,0.65)]">Définissez le titre et la description de votre formation.</p>
      </div>
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-[#30302e] p-4">
          <Label className="text-[rgba(245,244,238,0.78)]">Titre</Label>
          <Input
            value={draft?.title || ''}
            onChange={(e) => updateDraft({ title: e.target.value })}
            placeholder="Ex: Formation Initiation"
            className="mt-2 bg-[#2b2a27] border-white/10"
          />
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#30302e] p-4">
          <Label className="text-[rgba(245,244,238,0.78)]">Description</Label>
          <textarea
            value={draft?.description || ''}
            onChange={(e) => updateDraft({ description: e.target.value })}
            placeholder="Décrivez votre formation..."
            rows={4}
            className="mt-2 w-full rounded-xl bg-[#2b2a27] border border-white/10 px-4 py-3 text-[#f5f4ee] placeholder:text-[rgba(245,244,238,0.55)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--school-accent)_50%,transparent)]"
          />
        </div>
      </div>
    </div>
  );
}

function StepFormationStructure({ draft, updateDraft }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-[#f5f4ee] mb-1">Structure</h2>
        <p className="text-[rgba(245,244,238,0.65)]">Définissez l'ossature de votre parcours.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#30302e] p-4">
          <Label className="text-[rgba(245,244,238,0.78)]">Modules</Label>
          <Input
            type="number"
            value={draft?.module_count || 4}
            onChange={(e) => updateDraft({ module_count: parseInt(e.target.value, 10) || 1 })}
            className="mt-2 bg-[#2b2a27] border-white/10"
          />
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#30302e] p-4">
          <Label className="text-[rgba(245,244,238,0.78)]">Semaines</Label>
          <Input
            type="number"
            value={draft?.week_count || 6}
            onChange={(e) => updateDraft({ week_count: parseInt(e.target.value, 10) || 1 })}
            className="mt-2 bg-[#2b2a27] border-white/10"
          />
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#30302e] p-4">
          <Label className="text-[rgba(245,244,238,0.78)]">Leçons / semaine</Label>
          <Input
            type="number"
            value={draft?.lessons_per_week || 2}
            onChange={(e) => updateDraft({ lessons_per_week: parseInt(e.target.value, 10) || 1 })}
            className="mt-2 bg-[#2b2a27] border-white/10"
          />
        </div>
      </div>
    </div>
  );
}

function StepFormationPedagogie({ draft, updateDraft }) {
  const options = [
    {
      key: 'mindmap_enabled',
      label: 'Mindmap automatique',
      desc: 'Structure visuelle des concepts clés.',
      icon: Layers3,
    },
    {
      key: 'transcription_enabled',
      label: 'Transcription intelligente',
      desc: 'Texte généré depuis les vidéos.',
      icon: BookOpenText,
    },
    {
      key: 'timestamps_enabled',
      label: 'Horodatage automatique',
      desc: 'Repères temporels pour navigation rapide.',
      icon: Video,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#f5f4ee] mb-1">Pédagogie augmentée</h2>
        <p className="text-[rgba(245,244,238,0.65)]">Activez les briques intelligentes de production.</p>
      </div>
      <div className="space-y-3">
        {options.map(({ key, label, desc, icon: Icon }) => (
          <div key={key} className="rounded-xl border border-white/10 bg-[#30302e] p-4 flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Icon className="w-4 h-4 text-[color-mix(in_srgb,var(--school-accent)_80%,transparent)] mt-1" />
              <div>
                <p className="text-sm text-[#f5f4ee] font-medium">{label}</p>
                <p className="text-xs text-[rgba(245,244,238,0.55)]">{desc}</p>
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

function StepFormationVisuel({ draft, updateDraft }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#f5f4ee] mb-1">Identité visuelle</h2>
        <p className="text-[rgba(245,244,238,0.65)]">Créez une vitrine premium pour votre formation.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#30302e] p-4">
          <Label className="text-[rgba(245,244,238,0.78)]">Image de couverture (URL)</Label>
          <Input
            value={draft?.cover_image_url || ''}
            onChange={(e) => updateDraft({ cover_image_url: e.target.value })}
            placeholder="https://..."
            className="mt-2 bg-[#2b2a27] border-white/10"
          />
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#30302e] p-4">
          <Label className="text-[rgba(245,244,238,0.78)]">Niveau</Label>
          <select
            value={draft?.level || 'intermediaire'}
            onChange={(e) => updateDraft({ level: e.target.value })}
            className="mt-2 w-full rounded-xl bg-[#2b2a27] border border-white/10 px-4 py-2.5 text-[#f5f4ee]"
          >
            <option value="debutant">Débutant</option>
            <option value="intermediaire">Intermédiaire</option>
            <option value="avance">Avancé</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function StepFormationParametres({ draft, updateDraft }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#f5f4ee] mb-1">Paramètres de publication</h2>
        <p className="text-[rgba(245,244,238,0.65)]">Affinez l'accès et le mode de diffusion.</p>
      </div>
      <div className="space-y-3">
        {[
          {
            key: 'is_public',
            label: 'Formation publique',
            desc: 'Visible dans le catalogue public.',
          },
          {
            key: 'certificate_enabled',
            label: 'Certificat de fin',
            desc: 'Génère un certificat en fin de parcours.',
          },
          {
            key: 'drip_content',
            label: 'Contenu progressif',
            desc: 'Débloque les modules au fil du temps.',
          },
        ].map((item) => (
          <div key={item.key} className="rounded-xl border border-white/10 bg-[#30302e] p-4 flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Settings2 className="w-4 h-4 text-[color-mix(in_srgb,var(--school-accent)_80%,transparent)] mt-1" />
              <div>
                <p className="text-sm text-[#f5f4ee] font-medium">{item.label}</p>
                <p className="text-xs text-[rgba(245,244,238,0.55)]">{item.desc}</p>
              </div>
            </div>
            <Switch
              checked={Boolean(draft?.[item.key])}
              onCheckedChange={(v) => updateDraft({ [item.key]: v })}
              className="data-[state=checked]:bg-[var(--school-accent)]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function StepFormationValidation({ draft }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#f5f4ee] mb-1">Validation</h2>
        <p className="text-[rgba(245,244,238,0.65)]">Checklist finale avant création.</p>
      </div>
      <div className="rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] p-5 space-y-2">
        <div className="flex items-center gap-2 text-[var(--school-accent)]">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm font-medium">Formation prête</span>
        </div>
        <p className="text-sm text-[rgba(245,244,238,0.78)]">Titre: {draft?.title || 'A renseigner'}</p>
        <p className="text-sm text-[rgba(245,244,238,0.78)]">Modules: {draft?.module_count || 0}</p>
        <p className="text-sm text-[rgba(245,244,238,0.78)]">Semaines: {draft?.week_count || 0}</p>
      </div>
    </div>
  );
}

const STEP_COMPONENTS = {
  informations: StepFormationInformations,
  structure: StepFormationStructure,
  pedagogie: StepFormationPedagogie,
  visuel: StepFormationVisuel,
  parametres: StepFormationParametres,
  validation: StepFormationValidation,
};


function validateStep({ stepKey, draft }) {
  if (stepKey === 'informations' && !draft?.title?.trim()) {
    return { valid: false, message: 'Le titre est requis.' };
  }
  if (stepKey === 'structure' && (!draft?.module_count || draft?.module_count < 1)) {
    return { valid: false, message: 'Ajoutez au moins un module.' };
  }
  return { valid: true };
}

function getStepCompletion({ stepKey, draft }) {
  if (stepKey === 'informations') return Boolean(draft?.title?.trim());
  if (stepKey === 'structure') return Boolean(draft?.module_count && draft?.week_count);
  if (stepKey === 'pedagogie') return Boolean(draft?.mindmap_enabled || draft?.transcription_enabled || draft?.timestamps_enabled);
  if (stepKey === 'visuel') return Boolean(draft?.cover_image_url || draft?.level);
  if (stepKey === 'parametres') return Boolean(draft?.is_public || draft?.certificate_enabled || draft?.drip_content);
  if (stepKey === 'validation') return Boolean(draft?.title?.trim() && draft?.module_count);
  return false;
}
export function FormationStudioBuilder(props) {
  /**
   * Accent de l'aperçu : `cyan` était un accent FROID (table d'accents de
   * StudioGenericPreview). On passe sur `amber` — c'est la seule clé garantie de la
   * table, puisqu'elle sert aussi de valeur par défaut du composant : quelle que soit
   * la façon dont la table est réchauffée, elle ne peut pas disparaître. Aucun autre
   * builder n'occupait `amber`, donc la différenciation par studio est préservée.
   */
  const previewComponent = (
    <StudioGenericPreview draft={props.draft} studioLabel="Formation" accent="amber" />
  );

  return (
    <StudioBuilder
      steps={STEPS}
      stepComponents={STEP_COMPONENTS}
      title="Studio de création formation"
      subtitle="Cours en ligne et parcours pédagogiques"
      showPreview
      previewComponent={previewComponent}
      validateStep={validateStep}
      getStepCompletion={getStepCompletion}
      {...props}
    />
  );
}
