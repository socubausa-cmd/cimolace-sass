/**
 * MODÈLE de la « Roue de Transformation » du Temple (Espace Ngowazulu).
 * ────────────────────────────────────────────────────────────────────
 * DONNÉES ÉDITABLES — pensé pour qu'un maître spirituel affine le modèle complet
 * SANS toucher au code : il suffit d'éditer AXES / QUESTIONS ci-dessous.
 *
 * Le pendant spirituel de la roue Détox de MEDOS : le client répond au questionnaire,
 * chaque réponse alimente 1..n axes, on obtient un score 0→10 par axe (niveau de
 * travail requis : 0 = serein, 10 = à traiter en priorité). Le praticien ajuste ensuite.
 */

export const POLES = [
  { id: 'A', name: 'Héritage & liens', accent: '#d97757' },
  { id: 'B', name: 'Énergie & protection', accent: '#cf8a4a' },
  { id: 'C', name: 'Guidance & voie', accent: '#c4694f' },
];

// 12 axes (3 pôles × 4). id = clé stable, n = numéro affiché, pole = groupe.
export const AXES = [
  { id: 'karma',        n: 1,  pole: 'A', name: 'Karma',              desc: 'Dettes karmiques, cycles & schémas qui se répètent.' },
  { id: 'lignee',       n: 2,  pole: 'A', name: 'Lignée',             desc: 'Héritage ancestral — bénédictions & malédictions de lignée.' },
  { id: 'pactes',       n: 3,  pole: 'A', name: 'Pactes & liens',     desc: "Attachements, liens d'âme, pactes anciens à dénouer." },
  { id: 'conflits',     n: 4,  pole: 'A', name: 'Conflits',           desc: 'Guerres intérieures et extérieures, relations toxiques.' },
  { id: 'purification', n: 5,  pole: 'B', name: 'Purification',       desc: 'État vibratoire, souillures, nettoyage énergétique.' },
  { id: 'protection',   n: 6,  pole: 'B', name: 'Protection',         desc: 'Bouclier spirituel, vulnérabilité aux attaques.' },
  { id: 'energie',      n: 7,  pole: 'B', name: "Centres d'énergie",  desc: 'Équilibre des chakras / centres, blocages.' },
  { id: 'memoire',      n: 8,  pole: 'B', name: "Mémoire de l'âme",   desc: 'Traumas, blessures et mémoires à libérer.' },
  { id: 'astral',       n: 9,  pole: 'C', name: 'Astral',             desc: 'Influences planétaires, thème natal (horoscope).' },
  { id: 'tirage',       n: 10, pole: 'C', name: 'Tirage',             desc: 'Guidance des cartes & oracles, messages reçus.' },
  { id: 'voie',         n: 11, pole: 'C', name: 'Voie & mission',     desc: 'Alignement au chemin, initiation, appel.' },
  { id: 'divin',        n: 12, pole: 'C', name: 'Connexion au divin', desc: 'Foi, prière, culte, relation au sacré.' },
];

// Échelle de réponse 0→3 (partagée). Modifiable.
export const SCALE = [
  { label: 'Jamais', value: 0 },
  { label: 'Parfois', value: 1 },
  { label: 'Souvent', value: 2 },
  { label: 'En permanence', value: 3 },
];

/**
 * Questionnaire d'intake. Chaque question alimente `axes` (ids). `invert: true` inverse
 * le score (ex. une forte connexion au divin = FAIBLE besoin de travail sur cet axe).
 */
export const QUESTIONS = [
  { id: 'q1',  text: 'Ressens-tu des schémas qui se répètent dans ta vie (mêmes échecs, mêmes personnes, mêmes blocages) ?', axes: ['karma', 'lignee'] },
  { id: 'q2',  text: 'As-tu le sentiment de porter un poids qui ne vient pas de toi (histoires de famille, dettes du passé) ?', axes: ['lignee', 'karma'] },
  { id: 'q3',  text: "Te sens-tu lié(e) à quelqu'un ou à quelque chose dont tu n'arrives pas à te détacher ?", axes: ['pactes'] },
  { id: 'q4',  text: 'Vis-tu des conflits récurrents (entourage, travail) ou une guerre intérieure ?', axes: ['conflits'] },
  { id: 'q5',  text: 'Te sens-tu « sali(e) », lourd(e) ou vidé(e) de ton énergie sans raison claire ?', axes: ['purification', 'energie'] },
  { id: 'q6',  text: "As-tu l'impression d'être exposé(e), sans protection, ou la cible d'attaques ?", axes: ['protection'] },
  { id: 'q7',  text: 'Ressens-tu des blocages physiques ou énergétiques (sommeil, gorge, ventre, cœur) ?', axes: ['energie', 'memoire'] },
  { id: 'q8',  text: 'Des blessures ou souvenirs anciens remontent-ils et te gouvernent-ils encore ?', axes: ['memoire'] },
  { id: 'q9',  text: 'Sens-tu que des cycles (temps, saisons, dates) influencent fortement ta vie ?', axes: ['astral'] },
  { id: 'q10', text: 'Cherches-tu une guidance, un signe ou une direction pour tes choix ?', axes: ['tirage', 'voie'] },
  { id: 'q11', text: "As-tu le sentiment de ne pas être à ta place / de ne pas vivre ta vraie mission ?", axes: ['voie'] },
  { id: 'q12', text: 'Ta connexion au divin (prière, culte, foi) est-elle vivante et nourrie ?', axes: ['divin'], invert: true },
];

/** answers: { [questionId]: 0..3 } → { [axisId]: 0..10 } (arrondi 1 décimale). */
export function scoreAnswers(answers) {
  const acc = {};
  AXES.forEach((a) => { acc[a.id] = { sum: 0, count: 0 }; });
  QUESTIONS.forEach((q) => {
    const raw = answers ? answers[q.id] : undefined;
    if (raw == null) return;
    const val = q.invert ? (3 - raw) : raw;
    const score = (val / 3) * 10;
    (q.axes || []).forEach((axId) => { if (acc[axId]) { acc[axId].sum += score; acc[axId].count += 1; } });
  });
  const out = {};
  AXES.forEach((a) => { out[a.id] = acc[a.id].count ? Math.round((acc[a.id].sum / acc[a.id].count) * 10) / 10 : 0; });
  return out;
}

/** Les axes les plus « chargés » (à travailler en priorité). */
export function topAxes(scores, n = 3) {
  return [...AXES].map((a) => ({ ...a, v: scores[a.id] ?? 0 }))
    .sort((x, y) => y.v - x.v).slice(0, n);
}
