/**
 * Pont Coach → Architect : **JSON v1 obligatoire**, **extension v2 optionnelle** qui complète v1.
 * @see coach-to-architect-handoff-v1.json
 * @see coach-architect-handoff-v2-extension.json
 */
import handoff from './coach-to-architect-handoff-v1.json' with { type: 'json' };
import extV2 from './coach-architect-handoff-v2-extension.json' with { type: 'json' };

type HandoffSpec = typeof handoff;

function examplePretty(spec: HandoffSpec): string {
  return JSON.stringify(spec.example, null, 2);
}

function extensionV2HintFr(): string {
  const m = extV2.meta as { root_key: string; extends: string };
  return `

**Extension v2 (optionnelle) — complète le v1 sans le remplacer :**
- Clé racine : \`${m.root_key}\` (spéc. \`coach-architect-handoff-v2-extension.json\`, étend \`${m.extends}\`).
- Sert à préciser : type de rendu (affiche, studio, packaging…), listes d’actions layout / visuel / photo, demandes d’assets, \`requires_user_validation\`, etc.
- Le palier **intervention_level** reste celui du **v1** (autoritaire pour l’Architect).
- Quand le besoin touche **photo / affiche / packaging / rendu studio**, ajoute \`architect_extension_v2\` avec \`render_type\`, \`photo_actions\`, etc., en complément des \`instructions\` v1.`;
}

function extensionV2HintEn(): string {
  const m = extV2.meta as { root_key: string; extends: string };
  return `

**Optional v2 extension — completes v1; does not replace it:**
- Root key: \`${m.root_key}\` (\`coach-architect-handoff-v2-extension.json\`, extends \`${m.extends}\`).
- Use for: render type (poster, studio, packaging…), layout/visual/photo action lists, asset requests, \`requires_user_validation\`, etc.
- **intervention_level** stays the v1 field (authoritative for the Architect).
- For **photo / poster / packaging / studio-grade** output, add \`architect_extension_v2\` (\`render_type\`, \`photo_actions\`, …) alongside v1 \`instructions\`.`;
}

/** Bloc à ajouter au prompt Coach (designer chat / coach slide). */
export function buildCoachArchitectHandoffInstructionFr(): string {
  const spec = handoff as HandoffSpec;
  const optKeys = 'optional_root_keys' in spec && Array.isArray((spec as { optional_root_keys?: string[] }).optional_root_keys)
    ? (spec as { optional_root_keys: string[] }).optional_root_keys.join(', ')
    : 'architect_extension_v2';
  return `

---
## Pont Coach → Architect (base v${spec.meta.version} + extension v${extV2.meta.version} optionnelle)

Tu peux transmettre ton intention à l’Architect de **deux façons** :
1. **Prompt texte** court et actionnable (comme aujourd’hui).
2. **Un objet JSON unique** (sortie machine), lorsque tu veux un passage structuré — **base obligatoire v1** ; tu peux **compléter** avec l’extension v2.

**Règles du JSON v1 (obligatoires) :**
- \`action\` doit être \`"${spec.action_value}"\`.
- \`intervention_level\` : une valeur parmi ${JSON.stringify(spec.intervention_levels)}.
- Racine obligatoire : ${spec.required_root_keys.join(', ')}.
- \`context\` : objectif slide, segment, public, type de projet, etc.
- \`problems_detected\` / \`objectives\` : listes de chaînes.
- \`instructions\` : sous-objets optionnels selon le besoin (\`layout\`, \`text\`, \`image\`, \`color\`, etc.).

**Clé(s) racine optionnelle(s) :** ${optKeys}.${extensionV2HintFr()}

**Exemple canonique (structure v1 + extension v2 illustrée) :**
\`\`\`json
${examplePretty(spec)}
\`\`\`

Si tu produis ce JSON, ne mets **pas** de texte hors JSON pour la variante « machine » ; pour le chat humain, tu peux résumer en une phrase au-dessus.`;
}

export function buildCoachArchitectHandoffInstructionEn(): string {
  const spec = handoff as HandoffSpec;
  const optKeys = 'optional_root_keys' in spec && Array.isArray((spec as { optional_root_keys?: string[] }).optional_root_keys)
    ? (spec as { optional_root_keys: string[] }).optional_root_keys.join(', ')
    : 'architect_extension_v2';
  return `

---
## Coach → Architect bridge (v${spec.meta.version} base + optional v${extV2.meta.version} extension)

You can hand off to the Architect in **two ways**:
1. A short, actionable **text prompt** (as today).
2. A **single JSON object** — **v1 base is mandatory**; you may **add** the v2 extension to complete it.

**v1 JSON rules (required):**
- \`action\` must be \`"${spec.action_value}"\`.
- \`intervention_level\`: one of ${JSON.stringify(spec.intervention_levels)}.
- Required root keys: ${spec.required_root_keys.join(', ')}.
- \`context\`: slide goal, segment, audience, project type, etc.
- \`problems_detected\` / \`objectives\`: string arrays.
- \`instructions\`: optional nested objects (\`layout\`, \`text\`, \`image\`, \`color\`, …).

**Optional root key(s):** ${optKeys}.${extensionV2HintEn()}

**Canonical example (v1 structure + illustrated v2 extension):**
\`\`\`json
${examplePretty(spec)}
\`\`\`

For machine output, emit **only** the JSON; for human chat, you may add one line of summary above.`;
}

/** Bloc à ajouter au prompt Agent Architect : comment consommer le JSON Coach. */
export function buildArchitectConsumesHandoffFr(): string {
  const spec = handoff as HandoffSpec;
  return `

---
## Entrée Coach → Architect (JSON v${spec.meta.version} + extension v${extV2.meta.version} optionnelle)

Quand le message ou le contexte contient un objet JSON avec \`action: "${spec.action_value}"\`, **traite-le en priorité** :
- Respecte \`intervention_level\` (${spec.intervention_levels.join(', ')}) — c’est la référence pour la profondeur.
- Adresse \`problems_detected\` et \`objectives\`.
- Décline ta **consigne de redesign** en prose actionnable en suivant \`instructions\` (layout, text, image, color, etc.).
- Si \`architect_extension_v2\` est présent, intègre **en plus** : \`render_type\`, actions photo/layout/visual, \`asset_generation_requests\`, et respecte \`requires_user_validation\` si true (préférer prévisualisation / étapes validables).
- Complète avec ton expertise Creative Director si un champ est partiel.

Si aucun JSON structuré n’est fourni, applique ta méthode habituelle à partir du texte seul.`;
}

export function buildArchitectConsumesHandoffEn(): string {
  const spec = handoff as HandoffSpec;
  return `

---
## Coach → Architect input (JSON v${spec.meta.version} + optional v${extV2.meta.version} extension)

When the user message or context includes a JSON object with \`action: "${spec.action_value}"\`, **prioritize it**:
- Honor \`intervention_level\` (${spec.intervention_levels.join(', ')}) — authoritative for depth.
- Address \`problems_detected\` and \`objectives\`.
- Turn \`instructions\` (layout, text, image, color, …) into an **actionable redesign brief** in prose.
- If \`architect_extension_v2\` is present, also apply: \`render_type\`, photo/layout/visual action lists, \`asset_generation_requests\`, and honor \`requires_user_validation\` when true (prefer preview / user-validatable steps).
- Add senior-DA judgment if some fields are partial.

If no structured JSON is present, use your usual brief from plain text only.`;
}
