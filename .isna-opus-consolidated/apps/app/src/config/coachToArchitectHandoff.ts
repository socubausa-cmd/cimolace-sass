/**
 * Contrat JSON Coach → Architect : **v1** (base obligatoire) + **v2** optionnelle (`architect_extension_v2`).
 * @see supabase/functions/_shared/coach-to-architect-handoff-v1.json
 * @see supabase/functions/_shared/coach-architect-handoff-v2-extension.json
 * Sync : `npm run sync:config-json`
 */
import coachToArchitectHandoffV1 from './coach-to-architect-handoff-v1.json';
import coachArchitectHandoffV2Extension from './coach-architect-handoff-v2-extension.json';

export type CoachToArchitectHandoffV1 = typeof coachToArchitectHandoffV1;
export type CoachArchitectHandoffV2ExtensionSpec = typeof coachArchitectHandoffV2Extension;

export { coachToArchitectHandoffV1, coachArchitectHandoffV2Extension };
