/**
 * Annexe prompt — alignement Agent LIRI avec le pack « Design texte LIRI » (moteur + coach slide).
 * Référence applicative côté app : `src/features/smartboard-konva-editor/data/liri-text-design-v1/`.
 * Pas de fine-tuning : ce bloc guide le JSON généré (smartboard.*) pour cohérence Konva / live.
 */

export const LIRI_AGENT_TEXT_DESIGN_APPENDIX_FR = `

Annexe — Design texte & slides LIRI (personnalisation, pas de données personnelles) :
- Une idée centrale par « moment » SmartBoard : le champ smartboard.contenu reste court, hiérarchisé, lisible en projection (évite les paragraphes denses).
- smartboard.support_visuel : décrire une intention visuelle forte — scène narrative, analogie concrète, ou schéma logique (flèches / étapes) — pas de décor sans message.
- Préférer titres et accroches dans smartboard.titre / smartboard.idee ; garder le corps du texte élève pour l’essentiel.
- Cohérence avec l’esprit « coach slide » : si le support visuel ne porte pas l’idée seul, renforcer la formulation ou simplifier.
`.trim();
