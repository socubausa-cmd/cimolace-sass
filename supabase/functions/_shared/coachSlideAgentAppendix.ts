/**
 * Appendice compact dérivé de `coach-slide-agent-complete.json` pour le system prompt Edge.
 * Évite de réinjecter tout le JSON dans le prompt tout en alignant le modèle sur la spec.
 */
import coachSpec from './coach-slide-agent-complete.json' with { type: 'json' };

type CoachSpec = typeof coachSpec;

function appendixFr(spec: CoachSpec): string {
  const trig = Object.entries(spec.architect_bridge.trigger_rules)
    .map(([k, v]) => `${k}→${v}`)
    .join(' ; ');
  const events = spec.event_stream_contract.supported_events.map((e: { event: string }) => e.event).join(', ');
  return `

---
## Annexe — Spécification JSON « ${spec.meta.name} » v${spec.meta.version}

${spec.meta.description}

**Intégrations :** ${spec.meta.integration_targets.join(', ')}.

**Identité :** ${spec.identity.agent_id} — ${spec.identity.core_mission}

**Modes communication :** ${Object.keys(spec.communication_modes).join(', ')}.

**Pont Architect** (niveaux : ${Object.keys(spec.architect_bridge.instruction_levels).join(', ')}) — règles score : ${trig}

**Événements canvas (contrat) :** ${events}

**Question d’évaluation :** ${spec.evaluation_model.primary_question}

**Règles strictes —** toujours : ${spec.hard_rules.must_always.join(', ')}. — jamais : ${spec.hard_rules.must_never.join(', ')}.
`;
}

function appendixEn(spec: CoachSpec): string {
  const trig = Object.entries(spec.architect_bridge.trigger_rules)
    .map(([k, v]) => `${k}→${v}`)
    .join(' ; ');
  const events = spec.event_stream_contract.supported_events.map((e: { event: string }) => e.event).join(', ');
  return `

---
## Annex — JSON spec « ${spec.meta.name} » v${spec.meta.version}

${spec.meta.description}

**Integration targets:** ${spec.meta.integration_targets.join(', ')}.

**Identity:** ${spec.identity.agent_id} — ${spec.identity.core_mission}

**Communication modes:** ${Object.keys(spec.communication_modes).join(', ')}.

**Architect bridge** (levels: ${Object.keys(spec.architect_bridge.instruction_levels).join(', ')}) — score triggers: ${trig}

**Canvas events (contract):** ${events}

**Evaluation question:** ${spec.evaluation_model.primary_question}

**Hard rules —** always: ${spec.hard_rules.must_always.join(', ')}. — never: ${spec.hard_rules.must_never.join(', ')}.
`;
}

export function buildCoachSlideAppendixFr(): string {
  return appendixFr(coachSpec as CoachSpec);
}

export function buildCoachSlideAppendixEn(): string {
  return appendixEn(coachSpec as CoachSpec);
}
