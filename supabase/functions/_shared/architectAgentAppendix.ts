/**
 * Appendice dérivé de `architect-agent-complete.json` pour les prompts Agent Architect.
 */
import spec from './architect-agent-complete.json' with { type: 'json' };

type ArchitectSpec = typeof spec;

function exampleBriefFr(s: ArchitectSpec): string {
  const ext = s as ArchitectSpec & {
    example_prompt?: { output?: string };
    architect_bridge_examples?: { architect_expected_actions?: string[] }[];
  };
  if (ext.example_prompt?.output) return ext.example_prompt.output;
  const first = ext.architect_bridge_examples?.[0]?.architect_expected_actions;
  if (first?.length) return first.join(' ; ');
  return 'Consigne actionnable selon le niveau d’intervention et le contexte Coach.';
}

function exampleBriefEn(s: ArchitectSpec): string {
  const ext = s as ArchitectSpec & {
    example_prompt?: { output?: string };
    architect_bridge_examples?: { architect_expected_actions?: string[] }[];
  };
  if (ext.example_prompt?.output) return ext.example_prompt.output;
  const first = ext.architect_bridge_examples?.[0]?.architect_expected_actions;
  if (first?.length) return first.join('; ');
  return 'Actionable brief aligned with intervention level and Coach context.';
}

function appendixFr(s: ArchitectSpec): string {
  const levels = Object.entries(s.intervention_levels)
    .map(([k, v]) => `${k} (${(v as { description: string }).description})`)
    .join(' ; ');
  const caps = Object.keys(s.capabilities).join(', ');
  const meta = s.meta as typeof s.meta & { integration_targets?: string[] };
  const targets = Array.isArray(meta.integration_targets) && meta.integration_targets.length
    ? `\n**Intégrations cibles :** ${meta.integration_targets.join(', ')}`
    : '';
  const inputs = s.inputs as typeof s.inputs & { from_vision?: string[] };
  const visionLine = inputs.from_vision?.length
    ? ` ; vision → ${inputs.from_vision.join(', ')}`
    : '';
  const modes =
    'system_modes' in s && s.system_modes && typeof s.system_modes === 'object'
      ? Object.entries(s.system_modes as Record<string, { enabled?: boolean }>)
        .filter(([, v]) => v?.enabled)
        .map(([k]) => k)
        .join(', ')
      : '';
  const modesLine = modes ? `\n**Modes système (activés) :** ${modes}` : '';
  const coachNote =
    'coach_handoff' in s &&
    s.coach_handoff &&
    typeof s.coach_handoff === 'object' &&
    'note_fr' in s.coach_handoff
      ? `\n**Pont Coach (JSON canonique) :** ${String((s.coach_handoff as { note_fr?: string }).note_fr || '')}`
      : '';

  return `

---
## Spécification JSON « ${s.meta.name} » v${s.meta.version}

**Rôle :** ${s.meta.role} — ${s.meta.description}

**Mission :** ${s.identity.mission}

**Entrées typiques :** Coach → ${s.inputs.from_coach.join(', ')} ; utilisateur → ${s.inputs.from_user.join(', ')} ; système → ${s.inputs.from_system.join(', ')}${visionLine}.${targets}${modesLine}${coachNote}

**Niveaux d’intervention :** ${levels}

**Moteurs / capacités :** ${caps}

**Règles de génération —** respecter : ${s.generation_rules.must.join(', ')}. — éviter : ${s.generation_rules.must_not.join(', ')}.

**Exemple de consigne attendue (extrait pont Coach) :** ${exampleBriefFr(s)}
`;
}

function appendixEn(s: ArchitectSpec): string {
  const levels = Object.entries(s.intervention_levels)
    .map(([k, v]) => `${k} (${(v as { description: string }).description})`)
    .join(' ; ');
  const caps = Object.keys(s.capabilities).join(', ');
  const meta = s.meta as typeof s.meta & { integration_targets?: string[] };
  const targets = Array.isArray(meta.integration_targets) && meta.integration_targets.length
    ? `\n**Integration targets:** ${meta.integration_targets.join(', ')}`
    : '';
  const inputs = s.inputs as typeof s.inputs & { from_vision?: string[] };
  const visionLine = inputs.from_vision?.length
    ? ` ; vision → ${inputs.from_vision.join(', ')}`
    : '';
  const modes =
    'system_modes' in s && s.system_modes && typeof s.system_modes === 'object'
      ? Object.entries(s.system_modes as Record<string, { enabled?: boolean }>)
        .filter(([, v]) => v?.enabled)
        .map(([k]) => k)
        .join(', ')
      : '';
  const modesLine = modes ? `\n**System modes (enabled):** ${modes}` : '';
  const coachNote =
    'coach_handoff' in s &&
    s.coach_handoff &&
    typeof s.coach_handoff === 'object' &&
    'note_en' in s.coach_handoff
      ? `\n**Coach bridge (canonical JSON):** ${String((s.coach_handoff as { note_en?: string }).note_en || '')}`
      : '';

  return `

---
## JSON spec « ${s.meta.name} » v${s.meta.version}

**Role:** ${s.meta.role} — ${s.meta.description}

**Mission:** ${s.identity.mission}

**Typical inputs:** Coach → ${s.inputs.from_coach.join(', ')}; user → ${s.inputs.from_user.join(', ')}; system → ${s.inputs.from_system.join(', ')}${visionLine}.${targets}${modesLine}${coachNote}

**Intervention levels:** ${levels}

**Capability engines:** ${caps}

**Generation rules —** must: ${s.generation_rules.must.join(', ')}. — must not: ${s.generation_rules.must_not.join(', ')}.

**Example brief (Coach bridge excerpt):** ${exampleBriefEn(s)}
`;
}

export function buildArchitectAppendixFr(): string {
  return appendixFr(spec as ArchitectSpec);
}

export function buildArchitectAppendixEn(): string {
  return appendixEn(spec as ArchitectSpec);
}
