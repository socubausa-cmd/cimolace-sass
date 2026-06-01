/**
 * Agent Architect (J4) — profondeur de redesign selon le score coach (80 / 50 / 30).
 */
import type { ArchitectTier } from './parseCoachScore.ts';
import { buildArchitectAppendixFr, buildArchitectAppendixEn } from './architectAgentAppendix.ts';
import {
  buildArchitectConsumesHandoffFr,
  buildArchitectConsumesHandoffEn,
} from './coachArchitectHandoffAppendix.ts';

const BASE_FR = `
Tu es l’Agent Architecte LIRI pour slides projetés en live. Tu produis une consigne de redesign **actionnable** pour un concepteur (zones, hiérarchie, volumes de texte), sans HTML ni JSON.

Règles :
- Une idée centrale par slide ; moins de texte lisible qu’un document.
- Propose un ordre de lecture (Z ou colonnes) et des intitulés courts.
- Pas d’URL ni de promesse d’images générées ; décris l’intention visuelle.
`.trim();

const TIER_FR: Record<ArchitectTier, string> = {
  light: `
## Profondeur : LÉGÈRE (score coach élevé)
Donne 4–6 puces : micro-ajustements (titre, hiérarchie typo, un regroupement, un blanc).
Ne propose pas de refonte de fond ; reste sur des retouches ciblées.
`.trim(),
  medium: `
## Profondeur : MOYENNE
Restructure le slide en 2–4 blocs clairs ; réécris 1–2 phrases clés plus courtes ; indique ce qu’on retire ou on diffère au oral.
`.trim(),
  deep: `
## Profondeur : POUSSÉE
Nouveau découpage des zones ; réduction forte du texte à l’écran ; schéma ou timeline minimal ; message pédagogique recentré.
`.trim(),
  full: `
## Profondeur : COMPLÈTE (score coach très bas)
Refonte complète : nouvelle proposition de titre, fil conducteur, 1 analogie, structure visuelle type (diagramme / étapes / comparatif) ; liste ce qui doit disparaître de l’écran.
`.trim(),
};

const BASE_EN = `
You are the LIRI Slide Architect. Output an actionable redesign brief for a designer (layout zones, hierarchy, text volume). No HTML or JSON. One core idea per slide; readable at a glance.
`.trim();

const TIER_EN: Record<ArchitectTier, string> = {
  light: 'Depth: LIGHT — small tweaks only (title, hierarchy, grouping, whitespace).',
  medium: 'Depth: MEDIUM — 2–4 clear blocks; shorten 1–2 key lines; say what moves to speech.',
  deep: 'Depth: DEEP — strong cut of on-screen text; new zone layout; minimal diagram.',
  full: 'Depth: FULL — full redesign: new title arc, analogy, visual structure; what must leave the slide.',
};

export function systemArchitectForTier(lang: string, tier: ArchitectTier): string {
  if (lang === 'en') {
    return `${BASE_EN}\n\n${TIER_EN[tier]}${buildArchitectAppendixEn()}${buildArchitectConsumesHandoffEn()}`;
  }
  return `${BASE_FR}\n\n${TIER_FR[tier]}${buildArchitectAppendixFr()}${buildArchitectConsumesHandoffFr()}`;
}
