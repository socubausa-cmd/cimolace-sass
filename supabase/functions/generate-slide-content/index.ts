/// <reference lib="deno.ns" />

/**
 * generate-slide-content — Transforme une CARTE (nœud mindmap) en contenu de slide
 * pédagogique premium, selon le prompt « Agent expert en ingénierie pédagogique
 * visuelle » : une idée = une slide, titre formulé comme une idée, image qui EXPLIQUE
 * (schéma/nature/science, jamais mystique), carte mentale 3-5 branches, à retenir court.
 *
 * Entrée : { card: {label, summary, childLabels[], time}, courseTitle?, transcript? }
 * Sortie : { slide: { title, subtitle, ideeCentrale, objectif, centerLabel, centerSub,
 *            branches:[{icon,label,sub}], aRetenir, process:[{icon,label}], imagePrompt, niveau } }
 */
import { corsHeaders } from '../_shared/cors.ts';
import { aiChat } from '../_shared/aiClaudeDeepSeekGrok.ts';

const ICONS = ['book','function','leaf','globe','brain','atom','network','search','rocket','flask','chart','wave','link','bulb','target','star'];

const SYSTEM = `Tu es un expert mondial en ingénierie pédagogique visuelle, design d'apprentissage et neurosciences cognitives appliquées.
Tu transformes UNE carte de cours en UNE slide pédagogique extrêmement claire et mémorable.

OBJECTIF : aider l'apprenant à comprendre et retenir l'idée en moins de 10 secondes.

RÈGLES :
- UNE idée = UNE slide. Pas de texte dense. 3 idées maximum.
- TITRE : formulé comme une IDÉE, pas comme une étiquette. Mauvais: "Loi de variance". Bon: "Toute transformation provient d'une variation".
- IDÉE CENTRALE : une phrase simple.
- OBJECTIF : une phrase (ce que l'apprenant saura faire/comprendre).
- CARTE MENTALE : un concept central (centerLabel court + centerSub) et 3 à 5 branches (label + sous-label court).
- À RETENIR : une phrase mémorisable de MOINS DE 15 mots.
- PROCESS : 3 à 4 étapes verbe d'action (ex: Observer, Relier, Comprendre, Appliquer).
- IMAGE (imagePrompt) : décris une image qui EXPLIQUE le concept — schéma, diagramme, phénomène physique, métaphore universelle (rivière, réseau, galaxie, écosystème, horloge, arbre), infographie scientifique. INTERDIT : personnage mystique, gourou, sage, bibliothèque sombre, image ésotérique/abstraite sans signification, cercle lumineux. Style moderne, minimaliste, scientifique (Apple Education / TED-Ed). Rédige l'imagePrompt en français, descriptif et concret.
- ICÔNES : pour chaque branche et chaque étape de process, choisis UNE valeur dans: ${ICONS.join(', ')}.

Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, au format :
{"title":"","subtitle":"","ideeCentrale":"","objectif":"","centerLabel":"","centerSub":"","branches":[{"icon":"","label":"","sub":""}],"aRetenir":"","process":[{"icon":"","label":""}],"imagePrompt":"","niveau":"Débutant|Intermédiaire|Expert"}`;

function extractJson(text: string): unknown {
  const t = String(text || '').trim().replace(/^```(json)?/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(t); } catch { /* try to find a brace block */ }
  const start = t.indexOf('{'); const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(t.slice(start, end + 1)); } catch { /* noop */ }
  }
  return null;
}

const clampIcon = (v: unknown) => (ICONS.includes(String(v)) ? String(v) : '');
const str = (v: unknown, max = 400) => String(v ?? '').trim().slice(0, max);

function normalize(raw: Record<string, unknown>, card: Record<string, unknown>) {
  const branches = Array.isArray(raw.branches) ? raw.branches : [];
  const process = Array.isArray(raw.process) ? raw.process : [];
  return {
    title: str(raw.title, 140) || str(card.label, 140) || 'Carte',
    subtitle: str(raw.subtitle, 160),
    ideeCentrale: str(raw.ideeCentrale, 280) || str(card.summary, 280),
    objectif: str(raw.objectif, 220),
    centerLabel: str(raw.centerLabel, 60) || str(card.label, 60),
    centerSub: str(raw.centerSub, 90),
    branches: branches.slice(0, 5).map((b: Record<string, unknown>) => ({
      icon: clampIcon(b?.icon), label: str(b?.label, 70), sub: str(b?.sub, 90),
    })).filter((b) => b.label),
    aRetenir: str(raw.aRetenir, 160),
    process: process.slice(0, 4).map((p: Record<string, unknown>) => ({
      icon: clampIcon(p?.icon), label: str(p?.label, 40),
    })).filter((p) => p.label),
    imagePrompt: str(raw.imagePrompt, 600),
    niveau: ['Débutant', 'Intermédiaire', 'Expert'].includes(str(raw.niveau)) ? str(raw.niveau) : 'Débutant',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const card = (body?.card || {}) as Record<string, unknown>;
    const label = str(card.label, 140);
    if (!label && !str(card.summary, 280)) {
      return new Response(JSON.stringify({ error: 'card.label ou card.summary requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const childLabels = Array.isArray(card.childLabels) ? (card.childLabels as unknown[]).map((x) => str(x, 70)).filter(Boolean) : [];
    const courseTitle = str(body?.courseTitle, 160);
    const transcript = str(body?.transcript, 1500);

    const userMsg = `COURS : ${courseTitle || '(non précisé)'}
CARTE (concept) : ${label}
RÉSUMÉ ACTUEL : ${str(card.summary, 400) || '(aucun)'}
SOUS-CONCEPTS LIÉS : ${childLabels.length ? childLabels.join(', ') : '(aucun — propose 3 à 4 branches pertinentes)'}
${transcript ? `EXTRAIT DE TRANSCRIPTION :\n${transcript}` : ''}

Produis la slide pédagogique au format JSON demandé.`;

    const res = await aiChat({
      system: SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
      max_tokens: 1200,
      temperature: 0.6,
      claudeModel: 'claude-haiku-4-5',
      mistralModel: 'mistral-large-latest',
    });

    const parsed = extractJson(res.text);
    if (!parsed || typeof parsed !== 'object') {
      return new Response(JSON.stringify({ error: 'Réponse IA non-JSON', raw: String(res.text).slice(0, 300) }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const slide = normalize(parsed as Record<string, unknown>, card);
    return new Response(JSON.stringify({ slide, provider: res.provider }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
