// Bilan de transformation Zahir → Roue de transformation.
// Source : questionnaire « Programme Détox Zahir » (34 questions).
// Deux roues alimentées par le même bilan :
//  • Hygiène de vie  : 12 domaines (persistés via saveWheel — axes backend figés)
//  • Matrice fonctionnelle : 7 systèmes + 5 processus (modèle Coralie Bessou,
//    calculée côté client car le backend ne stocke que les 12 axes hygiène).

export type QType = 'choice' | 'multi' | 'text';
export type Question = { id: string; n: number; label: string; type: QType; options: string[] };

// ── Questionnaire (ordre du Fillout) ───────────────────────────────────────
export const QUESTIONS: Question[] = [
  { id: 'taille', n: 6, label: 'Taille', type: 'choice', options: ['Moins de 155 cm', '155 – 165 cm', '166 – 175 cm', '176 – 185 cm', 'Plus de 185 cm'] },
  { id: 'activite', n: 7, label: "Niveau d'activité physique actuel", type: 'choice', options: ['Sédentaire (peu ou pas d’exercice)', 'Légèrement actif (1–2 fois/semaine)', 'Modérément actif (3–4 fois/semaine)', 'Très actif (5+ fois/semaine)', 'Athlète / sport intensif'] },
  { id: 'sommeil', n: 8, label: 'Qualité du sommeil', type: 'choice', options: ['Mauvaise (5 – 6h, sommeil perturbé)', 'Moyenne (6 – 7h, parfois difficile)', 'Bonne (7 – 8h, sommeil réparateur)', 'Excellente (8h+, sommeil profond)'] },
  { id: 'stress', n: 9, label: 'Niveau de stress quotidien', type: 'choice', options: ['Très faible – je me sens serein(e)', 'Faible – quelques tensions occasionnelles', 'Modéré – stress gérable', 'Élevé – stress fréquent et pesant', 'Très élevé – je me sens débordé(e)'] },
  { id: 'eau', n: 10, label: "Consommation d'eau quotidienne", type: 'choice', options: ['Moins de 500 ml', '500 ml – 1 litre', '1 – 1,5 litre', '1,5 – 2 litres', 'Plus de 2 litres'] },
  { id: 'alcool', n: 11, label: "Consommation d'alcool", type: 'choice', options: ['Jamais', 'Occasionnellement (fêtes, événements)', '1 – 2 verres par semaine', '3 – 5 verres par semaine', 'Plus de 5 verres par semaine'] },
  { id: 'tabac', n: 12, label: 'Tabagisme', type: 'choice', options: ['Non-fumeur(euse)', 'Ancien(ne) fumeur(euse)', 'Fumeur(euse) occasionnel(le)', 'Fumeur(euse) intensif(ve) (10+ cig/jour)'] },
  { id: 'regime', n: 13, label: 'Régime alimentaire actuel', type: 'choice', options: ['Omnivore (tout)', 'Végétarien(ne)', 'Vegan', 'Flexitarien(ne)', 'Sans gluten', 'Autre régime spécifique'] },
  { id: 'repas', n: 14, label: 'Nombre de repas par jour', type: 'choice', options: ['1 repas', '2 repas', '3 repas', '4 repas ou plus', 'Je grignote toute la journée'] },
  { id: 'sucre', n: 15, label: 'Consommation de sucre raffiné / sucreries', type: 'choice', options: ['Jamais ou très rarement', 'Quelques fois par semaine', 'Tous les jours en petite quantité', 'Tous les jours en grande quantité', 'Je ne peux pas m’en passer'] },
  { id: 'transformes', n: 16, label: "Consommation d'aliments transformés (plats préparés, fast-food)", type: 'choice', options: ['Jamais', 'Rarement (1 fois/mois)', 'Occasionnellement (1 fois/semaine)', 'Régulièrement (3+ fois/semaine)', 'Tous les jours'] },
  { id: 'digestion', n: 17, label: 'Comment se passe votre digestion en général ?', type: 'choice', options: ['Très bien – aucun problème', 'Quelques ballonnements occasionnels', 'Ballonnements et gaz fréquents', 'Transit irrégulier (constipation ou diarrhée)', 'Douleurs et inconforts réguliers'] },
  { id: 'selles', n: 18, label: 'Fréquence des selles', type: 'choice', options: ['Plusieurs fois par jour', 'Une fois par jour', 'Tous les 2 jours', '2 à 3 fois par semaine', 'Moins d’une fois par semaine'] },
  { id: 'energie', n: 19, label: "Niveau d'énergie quotidien", type: 'choice', options: ['Épuisé(e) en permanence', 'Fatigué(e) la plupart du temps', 'Énergie variable selon les jours', 'Généralement bien énergisé(e)', 'Plein(e) d’énergie tous les jours'] },
  { id: 'symptomes', n: 20, label: 'Quels symptômes ressentez-vous régulièrement ?', type: 'multi', options: ['Maux de tête fréquents', 'Fatigue chronique', 'Prise de poids inexpliquée', 'Difficulté à perdre du poids', 'Peau terne ou problèmes cutanés', 'Cheveux et ongles fragilisés', 'Douleurs articulaires', 'Nausées ou maux d’estomac', 'Troubles de l’humeur', 'Aucun de ces symptômes'] },
  { id: 'peau', n: 21, label: 'État de votre peau', type: 'choice', options: ['Peau saine et éclatante', 'Légèrement terne mais correcte', 'Acné ou imperfections occasionnelles', 'Problèmes cutanés réguliers (eczéma, psoriasis...)', 'Peau très réactive et sensible'] },
  { id: 'antecedents', n: 22, label: 'Antécédents médicaux', type: 'multi', options: ['Diabète ou prédiabète', 'Hypertension', 'Problèmes thyroïdiens', 'Maladies auto-immunes', 'Troubles digestifs chroniques (SIBO, Crohn...)', 'Problèmes rénaux ou hépatiques', 'Allergies alimentaires ou intolérances', 'Cancer ou traitement oncologique en cours', 'Aucun'] },
  { id: 'medicaments', n: 23, label: 'Prenez-vous actuellement des médicaments ou suppléments ?', type: 'multi', options: ['Non, aucun', 'Uniquement des vitamines / compléments naturels', 'Médicaments sur ordonnance (hors hormones)', 'Contraception hormonale', 'Traitement hormonal substitutif', 'Plusieurs médicaments combinés'] },
  { id: 'grossesse', n: 24, label: 'Êtes-vous enceinte ou allaitante ?', type: 'choice', options: ['Non', 'Je suis enceinte', 'J’allaite actuellement', 'J’essaie de concevoir', 'NA (Non applicable)'] },
  { id: 'foie', n: 25, label: "Signes possibles d'un foie chargé", type: 'multi', options: ['Digestion lente et lourde après les repas', 'Goût amer dans la bouche le matin', 'Couleur jaunâtre des yeux ou de la peau', 'Intolérance aux graisses', 'Humeur irritable sans raison claire', 'Aucun de ces signes'] },
  { id: 'reins', n: 26, label: 'Signes possibles liés aux reins', type: 'multi', options: ['Urines foncées ou odeur forte', 'Rétention d’eau (chevilles gonflées, visage bouffi)', 'Douleurs dans le bas du dos (hors douleur musculaire)', 'Besoin fréquent d’uriner la nuit', 'Aucun de ces signes'] },
  { id: 'intestin', n: 27, label: "Signes d'un intestin encrassé", type: 'multi', options: ['Ventre souvent gonflé', 'Gaz et flatulences fréquents', 'Envie de sucreries irrésistible', 'Selles malodorantes', 'Sensations de lourdeur après manger', 'Aucun de ces signes'] },
  { id: 'transpiration', n: 28, label: 'Votre peau transpire-t-elle facilement ?', type: 'choice', options: ['Oui, transpiration normale et régulière', 'Peu, je transpire rarement', 'Transpiration excessive', 'Transpiration minimale même à l’effort'] },
  { id: 'lymphe', n: 29, label: "Signes d'un système lymphatique surchargé", type: 'multi', options: ['Ganglions gonflés récurrents', 'Membres lourds et gonflés', 'Infections répétées (ORL, rhumes fréquents)', 'Cellulite importante', 'Sensation de corps poisseux / lourd', 'Aucun de ces signes'] },
  { id: 'objectif', n: 30, label: 'Votre objectif principal avec ce programme', type: 'multi', options: ['Perdre du poids et affiner ma silhouette', 'Retrouver de l’énergie et vitalité', 'Nettoyer et régénérer mes organes', 'Améliorer ma peau et mon éclat', 'Rééquilibrer ma digestion', 'Me libérer d’addictions alimentaires', 'Améliorer mon humeur et mental', 'Accompagnement global bien-être'] },
  { id: 'objectifs_sec', n: 31, label: 'Objectifs secondaires', type: 'multi', options: ['Mieux dormir', 'Réduire l’inflammation', 'Renforcer mon immunité', 'Améliorer ma concentration', 'Réduire mon niveau de stress', 'Prévenir des maladies', 'Améliorer mes résultats sportifs', 'Retrouver confiance en moi'] },
  { id: 'motivation', n: 36, label: 'Votre niveau de motivation pour ce programme', type: 'choice', options: ['Je teste par curiosité', 'Moyennement motivé(e)', 'Motivé(e) mais quelques doutes', 'Très motivé(e)', 'Déterminé(e) à aller au bout'] },
];

// ── Axes de roue ───────────────────────────────────────────────────────────
export type FunctionalAxis = { key: string; label: string; group: 'system' | 'process'; color: string; desc: string };

// 7 systèmes (centre) + 5 processus (couronne) — matrice de médecine fonctionnelle.
export const FUNCTIONAL_AXES: FunctionalAxis[] = [
  { key: 'assimilation', label: 'Assimilation', group: 'system', color: '#e07a4d', desc: 'Digestion, absorption, microbiote' },
  { key: 'defense', label: 'Défense & Réparation', group: 'system', color: '#c44d6a', desc: 'Immunité, inflammation, cicatrisation' },
  { key: 'energy', label: 'Énergie', group: 'system', color: '#d99a2b', desc: 'Production mitochondriale, vitalité' },
  { key: 'biotransformation', label: 'Biotransformation', group: 'system', color: '#6a9a5b', desc: 'Détoxification hépatique, élimination' },
  { key: 'transport', label: 'Transport', group: 'system', color: '#4f8fae', desc: 'Circulation, lymphe, reins' },
  { key: 'communication', label: 'Communication', group: 'system', color: '#7a6fae', desc: 'Hormones, neurotransmetteurs, stress' },
  { key: 'structural', label: 'Intégrité structurelle', group: 'system', color: '#9a7b4f', desc: 'Peau, barrières, membranes' },
  { key: 'oxidation', label: 'Oxydation', group: 'process', color: '#b5532e', desc: 'Stress oxydatif, radicaux libres' },
  { key: 'glycation', label: 'Glycation', group: 'process', color: '#b07b2b', desc: 'Sucre, AGE, charge glycémique' },
  { key: 'inflammation', label: 'Inflammation', group: 'process', color: '#c0392b', desc: 'Inflammation de bas grade' },
  { key: 'methylation', label: 'Méthylation', group: 'process', color: '#4a8a7b', desc: 'Folates, B12, épigénétique' },
  { key: 'detoxification', label: 'Détoxification', group: 'process', color: '#3f7a8f', desc: 'Charge toxinique, élimination' },
];

// Les 12 axes « hygiène de vie » = ceux du backend (WHEEL_LABELS).
export const LIFESTYLE_KEYS = [
  'digestion', 'sleep', 'stress', 'energy', 'inflammation', 'immunity',
  'metabolism', 'hormones', 'physical_activity', 'cognition', 'environment', 'emotions',
];

// ── Scoring ────────────────────────────────────────────────────────────────
type Scored = { kind: 'ordinal'; values: number[]; life: string[]; fn: string[] }
  | { kind: 'signs'; life: string[]; fn: string[] };

// Pour 'ordinal' : score santé (0-100) par index d'option. Pour 'signs' :
// score = 100 - part de signes cochés (« Aucun… » = ~95).
const SCORING: Record<string, Scored> = {
  activite: { kind: 'ordinal', values: [20, 45, 70, 90, 82], life: ['physical_activity', 'energy'], fn: ['energy', 'oxidation'] },
  sommeil: { kind: 'ordinal', values: [25, 55, 80, 95], life: ['sleep', 'hormones', 'energy'], fn: ['communication', 'energy'] },
  stress: { kind: 'ordinal', values: [95, 80, 55, 30, 12], life: ['stress', 'emotions', 'cognition'], fn: ['communication', 'inflammation'] },
  eau: { kind: 'ordinal', values: [20, 45, 65, 85, 95], life: ['environment'], fn: ['transport', 'detoxification'] },
  alcool: { kind: 'ordinal', values: [95, 75, 55, 32, 12], life: ['environment'], fn: ['biotransformation', 'oxidation', 'detoxification'] },
  tabac: { kind: 'ordinal', values: [95, 72, 42, 15], life: ['environment'], fn: ['oxidation', 'inflammation'] },
  regime: { kind: 'ordinal', values: [60, 78, 72, 78, 66, 60], life: [], fn: ['methylation', 'assimilation'] },
  repas: { kind: 'ordinal', values: [52, 72, 88, 70, 25], life: ['metabolism'], fn: [] },
  sucre: { kind: 'ordinal', values: [95, 70, 45, 22, 8], life: ['metabolism'], fn: ['glycation'] },
  transformes: { kind: 'ordinal', values: [95, 80, 55, 28, 10], life: ['inflammation', 'environment'], fn: ['glycation', 'oxidation', 'inflammation'] },
  digestion: { kind: 'ordinal', values: [95, 75, 50, 35, 15], life: ['digestion'], fn: ['assimilation'] },
  selles: { kind: 'ordinal', values: [85, 95, 68, 40, 20], life: ['digestion'], fn: ['assimilation', 'detoxification'] },
  energie: { kind: 'ordinal', values: [15, 35, 60, 85, 95], life: ['energy', 'cognition'], fn: ['energy'] },
  peau: { kind: 'ordinal', values: [95, 75, 55, 30, 28], life: [], fn: ['structural', 'detoxification'] },
  transpiration: { kind: 'ordinal', values: [85, 48, 60, 32], life: [], fn: ['detoxification', 'transport'] },
  symptomes: { kind: 'signs', life: ['inflammation', 'immunity'], fn: ['defense', 'inflammation'] },
  antecedents: { kind: 'signs', life: ['immunity'], fn: ['defense'] },
  foie: { kind: 'signs', life: [], fn: ['biotransformation', 'detoxification'] },
  reins: { kind: 'signs', life: [], fn: ['transport', 'detoxification'] },
  intestin: { kind: 'signs', life: ['digestion'], fn: ['assimilation'] },
  lymphe: { kind: 'signs', life: ['immunity'], fn: ['transport', 'defense'] },
};

export type Answers = Record<string, string | string[]>;
export type WheelScores = { lifestyle: Record<string, number>; functional: Record<string, number> };

export function scoreResponses(answers: Answers): WheelScores {
  const life: Record<string, number[]> = {};
  const fn: Record<string, number[]> = {};
  const push = (bag: Record<string, number[]>, keys: string[], v: number) => keys.forEach((k) => (bag[k] ||= []).push(v));

  for (const q of QUESTIONS) {
    const rule = SCORING[q.id];
    if (!rule) continue;
    const a = answers[q.id];
    if (a == null || (Array.isArray(a) && a.length === 0)) continue;

    let v: number | null = null;
    if (rule.kind === 'ordinal') {
      const i = q.options.indexOf(String(a));
      if (i >= 0 && i < rule.values.length) v = rule.values[i];
    } else {
      const picked = Array.isArray(a) ? a : [a];
      const none = picked.some((p) => /^aucun/i.test(p));
      const signs = q.options.filter((o) => !/^aucun/i.test(o)).length || 1;
      const hit = picked.filter((p) => !/^aucun/i.test(p)).length;
      v = none && hit === 0 ? 92 : Math.max(8, Math.round(100 - (hit / signs) * 100));
    }
    if (v == null) continue;
    push(life, rule.life, v);
    push(fn, rule.fn, v);
  }

  const avg = (xs?: number[]) => (xs && xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
  const lifestyle: Record<string, number> = {};
  const functional: Record<string, number> = {};
  for (const k of LIFESTYLE_KEYS) { const a = avg(life[k]); if (a != null) lifestyle[k] = a; }
  for (const ax of FUNCTIONAL_AXES) { const a = avg(fn[ax.key]); if (a != null) functional[ax.key] = a; }
  return { lifestyle, functional };
}

// Confort : nb de questions scorées renseignées (pour la complétude).
export function answeredCount(answers: Answers): number {
  return QUESTIONS.filter((q) => SCORING[q.id] && answers[q.id] != null && (!Array.isArray(answers[q.id]) || (answers[q.id] as string[]).length > 0)).length;
}
export const SCORED_TOTAL = Object.keys(SCORING).length;
