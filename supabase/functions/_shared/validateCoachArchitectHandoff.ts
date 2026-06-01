/**
 * Validation du contrat Coach → Architect : **v1 obligatoire**, **extension v2 optionnelle** (`architect_extension_v2`).
 * @see coach-to-architect-handoff-v1.json
 * @see coach-architect-handoff-v2-extension.json
 */

export type InterventionLevel = 'light' | 'medium' | 'deep' | 'full';

export type CoachArchitectHandoffV1 = {
  action: 'design_update';
  intervention_level: InterventionLevel;
  context: Record<string, unknown>;
  problems_detected: string[];
  objectives: string[];
  instructions: Record<string, unknown>;
};

/** Champs documentés dans coach-architect-handoff-v2-extension.json ; d’autres clés peuvent être ajoutées pour compatibilité future. */
export type CoachArchitectHandoffV2Extension = {
  render_type?: string;
  applied_operations?: string[];
  layout_actions?: string[];
  visual_actions?: string[];
  photo_actions?: string[];
  asset_generation_requests?: Array<Record<string, unknown>>;
  requires_user_validation?: boolean;
} & Record<string, unknown>;

export type CoachArchitectHandoffValidated = CoachArchitectHandoffV1 & {
  architect_extension_v2?: CoachArchitectHandoffV2Extension;
};

const LEVELS = new Set<InterventionLevel>(['light', 'medium', 'deep', 'full']);

function validateArchitectExtensionV2(
  raw: unknown,
): { ok: true; value: CoachArchitectHandoffV2Extension } | { ok: false; errors: string[] } {
  if (raw === undefined) {
    return { ok: true, value: {} as CoachArchitectHandoffV2Extension };
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['architect_extension_v2 doit être un objet (pas un tableau).'] };
  }
  const e = raw as Record<string, unknown>;
  const errors: string[] = [];

  if (e.render_type !== undefined && typeof e.render_type !== 'string') {
    errors.push('architect_extension_v2.render_type doit être une chaîne.');
  }
  for (const key of ['applied_operations', 'layout_actions', 'visual_actions', 'photo_actions'] as const) {
    if (e[key] !== undefined) {
      if (!Array.isArray(e[key]) || !(e[key] as unknown[]).every((x) => typeof x === 'string')) {
        errors.push(`architect_extension_v2.${key} doit être un tableau de chaînes.`);
      }
    }
  }
  if (e.asset_generation_requests !== undefined) {
    if (!Array.isArray(e.asset_generation_requests)) {
      errors.push('architect_extension_v2.asset_generation_requests doit être un tableau.');
    } else {
      for (const item of e.asset_generation_requests) {
        if (item === null || typeof item !== 'object' || Array.isArray(item)) {
          errors.push('chaque entrée de asset_generation_requests doit être un objet.');
          break;
        }
      }
    }
  }
  if (e.requires_user_validation !== undefined && typeof e.requires_user_validation !== 'boolean') {
    errors.push('architect_extension_v2.requires_user_validation doit être un booléen.');
  }

  if (errors.length) return { ok: false, errors };

  return { ok: true, value: { ...e } as CoachArchitectHandoffV2Extension };
}

export function validateCoachArchitectHandoff(
  raw: unknown,
): { ok: true; value: CoachArchitectHandoffValidated } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['Racine attendue : objet JSON.'] };
  }
  const o = raw as Record<string, unknown>;

  if (o.action !== 'design_update') {
    errors.push(`action doit être "design_update" (reçu : ${JSON.stringify(o.action)}).`);
  }

  const il = o.intervention_level;
  if (typeof il !== 'string' || !LEVELS.has(il as InterventionLevel)) {
    errors.push(`intervention_level invalide (attendu : light | medium | deep | full).`);
  }

  if (!o.context || typeof o.context !== 'object' || Array.isArray(o.context)) {
    errors.push('context doit être un objet.');
  }

  if (!Array.isArray(o.problems_detected) || !o.problems_detected.every((x) => typeof x === 'string')) {
    errors.push('problems_detected doit être un tableau de chaînes.');
  }

  if (!Array.isArray(o.objectives) || !o.objectives.every((x) => typeof x === 'string')) {
    errors.push('objectives doit être un tableau de chaînes.');
  }

  if (!o.instructions || typeof o.instructions !== 'object' || Array.isArray(o.instructions)) {
    errors.push('instructions doit être un objet.');
  }

  if (errors.length) return { ok: false, errors };

  const base: CoachArchitectHandoffV1 = {
    action: 'design_update',
    intervention_level: il as InterventionLevel,
    context: o.context as Record<string, unknown>,
    problems_detected: o.problems_detected as string[],
    objectives: o.objectives as string[],
    instructions: o.instructions as Record<string, unknown>,
  };

  if (!('architect_extension_v2' in o) || o.architect_extension_v2 === undefined) {
    return { ok: true, value: base };
  }

  const ext = validateArchitectExtensionV2(o.architect_extension_v2);
  if (!ext.ok) return { ok: false, errors: ext.errors };

  const keys = Object.keys(ext.value);
  if (keys.length === 0) {
    return { ok: true, value: base };
  }

  return {
    ok: true,
    value: {
      ...base,
      architect_extension_v2: ext.value,
    },
  };
}
