/**
 * Spec JSON Agent Architect — alignée sur
 * `supabase/functions/_shared/architect-agent-complete.json`.
 * Après édition côté Edge : `npm run sync:config-json`.
 */
import architectAgentComplete from './architect-agent-complete.json';

export type ArchitectAgentSpec = typeof architectAgentComplete;

export { architectAgentComplete };
