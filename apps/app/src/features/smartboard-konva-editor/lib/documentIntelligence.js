/**
 * documentIntelligence.js — l'étage IA de RÉDACTION du mode Document.
 *
 * Répond aux points 1 à 4 du cahier des charges :
 *   1. détection du CONTEXTE (registre + niveau de formalité)
 *   2. SUGGESTIONS tirables / collables / régénérables
 *   3. RÉDACTION intégrale du document
 *   4. MODE CONTRÔLE LIBRE — verrou dur : aucun appel réseau
 *   5. CORRECTION des fautes (orthographe, grammaire, accord, typographie, ponctuation)
 *      — moteur dans `documentCorrection.js`, câblé ici au modèle.
 *
 * MOTEUR : **Mistral** pour toutes les tâches de rédaction (décision fondateur,
 *   2026-08-06). Le front ne choisit pas le fournisseur lui-même — il le DEMANDE
 *   par `context.document_intelligence.moteur = 'mistral'` + un `poids`, et
 *   `studio-longia-chat` met Mistral en tête de sa cascade. Si la clé Mistral
 *   manque côté Edge, la cascade existante (Groq/OpenAI/DeepSeek/Anthropic)
 *   reprend la main : le créateur de document ne tombe jamais pour ça.
 *
 * ⛔ CONTRAINTE FONDATRICE : ce module PROPOSE, il n'écrit jamais sur le canvas.
 *    Aucune fonction ici ne touche au store Konva ni au texte de l'utilisateur.
 *    L'insertion reste un geste explicite de l'utilisateur, côté interface.
 *
 * ⛔ Le navigateur n'a AUCUNE clé de modèle : tout passe par les Edge Functions
 *    déjà déployées. Deux canaux, dans cet ordre :
 *      · `studio-longia-chat` (via invokeLongiaHub) — contrôle total du prompt,
 *        sortie JSON ; c'est le canal principal.
 *      · `longia-admin-document` — repli texte pur, spécialisé administratif,
 *        déjà utilisé par le Secrétariat (LongiaAdminDocumentPanel.jsx).
 *
 * ⚠️ `studio-longia-chat` colle une « enveloppe LONGIA » après le texte visible.
 *    `buildLongiaJsonBody` coupe au marqueur, donc `data.text` ne contient QUE
 *    le texte visible — d'où l'exigence « réponds uniquement par un objet JSON ».
 */
import { supabase } from '@/lib/customSupabaseClient';
import { ensureFreshSession } from '@/lib/supabaseResilience';
import { invokeSupabaseFunction } from '@/lib/supabaseEdgeInvoke';
import {
  invokeLongiaHub,
  buildLongiaHubV1,
  LONGIA_SURFACE,
  LONGIA_ENGINE_ROLE,
} from '@/lib/longiaHub';
import { corriger as corrigerTexte } from '@/features/smartboard-konva-editor/lib/documentCorrection';

/* ══════════════════════════════════════════════════════════════════
   1. MODE D'ASSISTANCE — le verrou du « contrôle libre »
══════════════════════════════════════════════════════════════════ */

/** @typedef {'libre'|'suggestions'|'auto'} ModeAssistance */

export const MODES_ASSISTANCE = [
  {
    id: 'libre',
    label: 'Contrôle libre',
    desc: 'Aucune IA — vous écrivez seul',
    icon: '✋',
  },
  {
    id: 'suggestions',
    label: 'Suggestions',
    desc: "L'IA propose quand vous l'appelez",
    icon: '💡',
  },
  {
    id: 'auto',
    label: 'Rédaction auto',
    desc: "L'IA rédige le document entier",
    icon: '⚡',
  },
];

/**
 * Verrou de module. Il double la garde passée par appel : même un appel oublié
 * quelque part dans l'interface ne peut pas déclencher un aller-retour réseau
 * quand l'utilisateur a demandé « pas d'IA ».
 * @type {ModeAssistance}
 */
let _modeAssistance = 'suggestions';

/** @param {ModeAssistance} mode */
export function definirModeAssistance(mode) {
  _modeAssistance = mode === 'libre' || mode === 'auto' ? mode : 'suggestions';
  return _modeAssistance;
}

/** @returns {ModeAssistance} */
export function lireModeAssistance() {
  return _modeAssistance;
}

export function iaAutorisee() {
  return _modeAssistance !== 'libre';
}

/** Refus explicite : jamais silencieux, l'interface doit pouvoir le dire. */
function refusModeLibre() {
  return {
    ok: false,
    raison: 'mode_libre',
    message: 'Mode contrôle libre : aucune IA n’est appelée. Basculez sur « Suggestions » pour demander de l’aide.',
  };
}

function echec(raison, message, details) {
  return { ok: false, raison, message, details: details ?? null };
}

/* ══════════════════════════════════════════════════════════════════
   2. REGISTRES ET FORMALITÉ — table locale (aucun réseau)
══════════════════════════════════════════════════════════════════ */

/** @typedef {'administratif'|'commercial'|'juridique'|'educatif'|'rh'} Registre */

export const REGISTRES = {
  administratif: {
    label: 'Administratif',
    formaliteDefaut: 4,
    consigne:
      'Style administratif français : phrases complètes, voix impersonnelle ou « je », vocabulaire de l’administration (solliciter, adresser, faire suite à, dans l’attente de). Aucune familiarité, aucun emoji.',
    marqueurs: [
      'administration', 'prefecture', 'mairie', 'usager', 'dossier', 'demande',
      'recours', 'instance', 'courrier', 'piece justificative', 'justificatif',
      'service public', 'guichet', 'formulaire', 'reclamation', 'attestation',
      'accuse de reception', 'delai legal', 'commission',
    ],
  },
  commercial: {
    label: 'Commercial',
    formaliteDefaut: 3,
    consigne:
      'Style commercial professionnel : clair, orienté bénéfice client, chiffres et conditions explicites (montants, quantités, délais, TVA). Courtois sans flagornerie.',
    marqueurs: [
      'devis', 'facture', 'client', 'prestation', 'tarif', 'remise', 'commande',
      'livraison', 'offre', 'bon de commande', 'tva', 'acompte', 'ht', 'ttc',
      'reglement', 'echeance', 'proposition commerciale', 'catalogue', 'prix',
    ],
  },
  juridique: {
    label: 'Juridique',
    formaliteDefaut: 5,
    consigne:
      'Style juridique : rigueur terminologique, articles numérotés, parties désignées explicitement, aucune ambiguïté, aucune promesse hors du champ du document. Ne jamais inventer de référence légale ni de numéro d’article de loi.',
    marqueurs: [
      'contrat', 'clause', 'partie', 'resiliation', 'litige', 'tribunal',
      'article', 'engagement', 'preavis', 'indemnite', 'mise en demeure',
      'convention', 'avenant', 'obligation', 'nonobstant', 'stipule',
      'juridiction', 'penalite', 'force majeure',
    ],
  },
  educatif: {
    label: 'Éducatif',
    formaliteDefaut: 3,
    consigne:
      'Style scolaire et institutionnel : bienveillant, factuel, compréhensible par une famille. Pas de jargon pédagogique inutile.',
    marqueurs: [
      'eleve', 'etudiant', 'classe', 'cours', 'note', 'bulletin', 'professeur',
      'etablissement', 'scolaire', 'inscription', 'trimestre', 'semestre',
      'parent', 'directeur', 'conseil de classe', 'absence', 'formation',
    ],
  },
  rh: {
    label: 'Ressources humaines',
    formaliteDefaut: 4,
    consigne:
      'Style RH : neutre, factuel, respectueux de la personne, prudent sur tout élément sensible (santé, opinions, vie privée). Dates et fonctions précises.',
    marqueurs: [
      'salarie', 'employeur', 'contrat de travail', 'conge', 'embauche', 'poste',
      'candidature', 'entretien', 'demission', 'licenciement', 'cv',
      'recrutement', 'remuneration', 'competence', 'experience professionnelle',
      'periode d essai', 'anciennete',
    ],
  },
};

export const NIVEAUX_FORMALITE = {
  1: { id: 1, label: 'Familier', consigne: 'Ton direct, tutoiement possible, phrases courtes.' },
  2: { id: 2, label: 'Courant', consigne: 'Vouvoiement simple, vocabulaire de tous les jours.' },
  3: { id: 3, label: 'Professionnel', consigne: 'Vouvoiement, vocabulaire métier, phrases construites.' },
  4: { id: 4, label: 'Soutenu', consigne: 'Formules consacrées, aucune contraction, aucun familiarisme.' },
  5: { id: 5, label: 'Solennel', consigne: 'Registre le plus formel : formules protocolaires, terminologie stricte.' },
};

/** Registre par défaut selon le type de document du coach (DOC_TYPE_META). */
export const REGISTRE_PAR_TYPE = {
  letter: 'administratif',
  contract: 'juridique',
  attestation: 'administratif',
  cv: 'rh',
  invoice: 'commercial',
  minutes: 'administratif',
  certificate: 'administratif',
  report: 'administratif',
  internal_policy: 'juridique',
  student_record: 'educatif',
};

/**
 * Lexique du « mot juste » — repli DÉTERMINISTE de `suggererMotTechnique`
 * quand le modèle est injoignable. Chaque entrée : terme courant → terme du
 * domaine. Volontairement court : mieux vaut 6 propositions sûres que 40 approximatives.
 */
const LEXIQUE_REGISTRE = {
  administratif: [
    { courant: ['demander', 'demande de'], terme: 'solliciter', note: 'Verbe consacré des courriers à l’administration.' },
    { courant: ['envoyer', 'envoi'], terme: 'adresser / transmettre', note: 'On adresse un courrier, on transmet une pièce.' },
    { courant: ['repondre', 'reponse'], terme: 'donner suite', note: '« Donner suite à votre courrier du … ».' },
    { courant: ['a cause de', 'parce que'], terme: 'en raison de', note: 'Évite la causalité familière.' },
    { courant: ['joint', 'ci joint', 'avec ce courrier'], terme: 'ci-joint / en pièce jointe', note: 'Formule normalisée.' },
    { courant: ['vite', 'rapidement'], terme: 'dans les meilleurs délais', note: 'Formule administrative usuelle.' },
  ],
  commercial: [
    { courant: ['prix'], terme: 'tarif / montant HT', note: 'Distinguer clairement HT et TTC.' },
    { courant: ['payer'], terme: 's’acquitter du règlement', note: 'Registre des conditions de paiement.' },
    { courant: ['reduction', 'rabais'], terme: 'remise commerciale', note: 'Terme comptable.' },
    { courant: ['travail', 'boulot'], terme: 'prestation', note: 'Terme du devis et de la facture.' },
    { courant: ['delai', 'quand'], terme: 'délai d’exécution', note: 'À chiffrer en jours ouvrés.' },
    { courant: ['avance'], terme: 'acompte', note: 'Acompte : engage les deux parties.' },
  ],
  juridique: [
    { courant: ['annuler', 'arreter le contrat'], terme: 'résilier / dénoncer', note: 'Résilier pour l’avenir, résoudre pour le passé.' },
    { courant: ['les gens', 'les personnes'], terme: 'les parties', note: 'Désignation contractuelle.' },
    { courant: ['promesse', 'promettre'], terme: 'engagement / s’oblige à', note: 'Terminologie des obligations.' },
    { courant: ['prevenir avant'], terme: 'préavis', note: 'Toujours chiffrer la durée du préavis.' },
    { courant: ['amende', 'punition'], terme: 'pénalité contractuelle', note: 'Distinct d’une sanction pénale.' },
    { courant: ['si probleme', 'en cas de souci'], terme: 'en cas de litige', note: 'Introduit la clause attributive de compétence.' },
  ],
  educatif: [
    { courant: ['note'], terme: 'évaluation', note: 'Couvre la note et l’appréciation.' },
    { courant: ['absent', 'pas venu'], terme: 'absence non justifiée', note: 'Qualification exigée par les bulletins.' },
    { courant: ['travail'], terme: 'travail personnel', note: 'Terme des appréciations.' },
    { courant: ['progres'], terme: 'progression', note: 'Se mesure sur une période.' },
    { courant: ['comportement'], terme: 'attitude en classe', note: 'Formulation neutre.' },
    { courant: ['redoubler'], terme: 'maintien dans le niveau', note: 'Formulation institutionnelle.' },
  ],
  rh: [
    { courant: ['virer', 'renvoyer'], terme: 'rupture du contrat de travail', note: 'Ne jamais qualifier le motif sans preuve.' },
    { courant: ['embaucher'], terme: 'recruter / procéder à l’embauche', note: 'Registre RH.' },
    { courant: ['salaire'], terme: 'rémunération brute', note: 'Toujours préciser brut ou net.' },
    { courant: ['essai'], terme: 'période d’essai', note: 'Durée à mentionner.' },
    { courant: ['experience'], terme: 'expérience professionnelle', note: 'Terme attendu sur un CV.' },
    { courant: ['qualites'], terme: 'compétences', note: 'Distinguer compétences et savoir-être.' },
  ],
};

/* ══════════════════════════════════════════════════════════════════
   3. OUTILS INTERNES
══════════════════════════════════════════════════════════════════ */

function normaliser(txt) {
  return String(txt ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['`’]/g, ' ');
}

/** djb2 — identifiant STABLE d'un emplacement de suggestion (permet « Régénérer »). */
function hachage(str) {
  let h = 5381;
  const s = String(str ?? '');
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * Extrait le premier objet JSON complet d'une réponse de modèle.
 *
 * ⚠️ Deux pièges mesurés côté API (comprehension.service.ts) reproduits ici :
 *   · le modèle préfixe parfois « Voici le JSON : » → on part du premier `{` ;
 *   · la réponse peut être TRONQUÉE → on referme les structures ouvertes
 *     plutôt que de tout perdre.
 */
export function extraireJson(brut) {
  const texte = String(brut ?? '')
    .replace(/^```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim();
  const debut = texte.search(/[[{]/);
  if (debut < 0) throw new Error('Réponse sans JSON');

  const pile = [];
  let dansChaine = false;
  let echappe = false;
  let fin = -1;

  for (let i = debut; i < texte.length; i += 1) {
    const c = texte[i];
    if (echappe) { echappe = false; continue; }
    if (c === '\\') { echappe = true; continue; }
    if (c === '"') { dansChaine = !dansChaine; continue; }
    if (dansChaine) continue;
    if (c === '{' || c === '[') pile.push(c === '{' ? '}' : ']');
    else if (c === '}' || c === ']') {
      pile.pop();
      if (pile.length === 0) { fin = i; break; }
    }
  }

  if (fin >= 0) return JSON.parse(texte.slice(debut, fin + 1));

  // Tronqué : on referme ce qui reste ouvert.
  let sortie = texte.slice(debut);
  if (dansChaine) sortie += '"';
  while (pile.length) sortie += pile.pop();
  return JSON.parse(sortie);
}

/**
 * Aucun appel ne doit pouvoir suspendre l'interface indéfiniment.
 * ⛔ Le minuteur est ANNULÉ dans tous les cas : sans `clearTimeout`, chaque appel
 *    laissait un timer de 45 à 120 s vivant après la réponse (fuite mesurée en test).
 */
function avecDelai(promesse, ms, etiquette) {
  let minuteur = null;
  const garde = new Promise((_, rejeter) => {
    minuteur = setTimeout(
      () => rejeter(new Error(`Délai dépassé (${etiquette}, ${Math.round(ms / 1000)} s)`)),
      ms,
    );
  });
  return Promise.race([promesse, garde]).finally(() => {
    if (minuteur !== null) clearTimeout(minuteur);
  });
}

const CONSIGNE_JSON =
  'Réponds UNIQUEMENT par un objet JSON valide conforme au schéma. Aucun texte avant, aucun texte après, aucun bloc de code, aucun commentaire.';

/**
 * Moteur demandé pour toutes les tâches de rédaction documentaire.
 * ⚠️ C'est une DEMANDE, pas une garantie : l'Edge décide, et retombe sur sa
 *    cascade si Mistral est indisponible (clé absente, 5xx). `provider` remonté
 *    dans les résultats dit lequel a réellement répondu — ne pas l'afficher comme
 *    « Mistral » sans le lire.
 */
export const MOTEUR_REDACTION = 'mistral';

/**
 * Poids de la tâche → choix du modèle Mistral côté Edge.
 *   `long`  → mistral-large-latest  (structure, registre, document entier)
 *   `court` → mistral-small-latest  (tâches brèves et répétées)
 * @type {Record<string, 'court'|'long'>}
 */
export const POIDS_TACHE = {
  detecter_contexte: 'court',
  suggerer_mot_technique: 'court',
  corriger_fautes: 'court',
  suggerer_blocs: 'long',
  suggerer_formulation: 'long',
  rediger_document_complet: 'long',
};

/**
 * Canal principal : `studio-longia-chat` (LONGIA Hub), sortie JSON.
 * @param {{ tache: string, prompt: string, mode?: 'coach'|'architect', delaiMs?: number, poids?: 'court'|'long' }} p
 */
async function appelJson(p) {
  const { tache, prompt, mode = 'coach', delaiMs = 60000 } = p;
  const poids = p.poids ?? POIDS_TACHE[tache] ?? 'court';
  await ensureFreshSession(supabase, 300);
  const data = await avecDelai(
    invokeLongiaHub(supabase, {
      mode,
      messages: [{ role: 'user', content: prompt }],
      context: {
        document_intelligence: { tache, sortie: 'json_strict', moteur: MOTEUR_REDACTION, poids },
      },
      longiaHub: buildLongiaHubV1({
        surface: LONGIA_SURFACE.STUDIO_KONVA,
        mode,
        engines: [mode === 'architect' ? LONGIA_ENGINE_ROLE.ARCHITECT : LONGIA_ENGINE_ROLE.COACH],
        capabilities: [],
        features: { document_intelligence: tache },
      }),
    }),
    delaiMs,
    tache,
  );
  const brut = String(data?.text ?? data?.unified?.message ?? '').trim();
  if (!brut) throw new Error('Réponse vide du modèle');
  return { json: extraireJson(brut), provider: data?.provider ?? null };
}

/**
 * Canal de repli : `longia-admin-document` — texte pur, spécialisé administratif.
 * @param {'suggestions'|'compose'|'intelligent'} mode
 */
async function appelAdminDocument(mode, corps, delaiMs = 45000) {
  await ensureFreshSession(supabase, 300);
  return avecDelai(
    invokeSupabaseFunction(supabase, 'longia-admin-document', { body: { mode, ...corps } }),
    delaiMs,
    `admin-document/${mode}`,
  );
}

/** Bloc de contexte réutilisé par tous les prompts. */
function blocContexte(contexte, extra = {}) {
  const reg = REGISTRES[contexte?.registre] ?? REGISTRES.administratif;
  const niv = NIVEAUX_FORMALITE[contexte?.niveauFormalite] ?? NIVEAUX_FORMALITE[4];
  const lignes = [
    `Registre : ${reg.label}`,
    `Niveau de formalité : ${niv.label} (${niv.id}/5) — ${niv.consigne}`,
    `Consigne de style : ${reg.consigne}`,
  ];
  if (contexte?.typeDoc) lignes.push(`Type de document : ${contexte.typeDoc}`);
  if (contexte?.intention) lignes.push(`Intention : ${contexte.intention}`);
  if (extra.titreDocument) lignes.push(`Titre du document : ${extra.titreDocument}`);
  return lignes.join('\n');
}

function reponsesLisibles(reponses) {
  if (!reponses || typeof reponses !== 'object') return '(aucune)';
  const entrees = Object.entries(reponses).filter(([, v]) => String(v ?? '').trim() && String(v).trim() !== '—');
  if (!entrees.length) return '(aucune)';
  return entrees.map(([k, v]) => `- ${k} : ${String(v).trim()}`).join('\n');
}

/* ══════════════════════════════════════════════════════════════════
   4. POINT 1 — DÉTECTION DU CONTEXTE
══════════════════════════════════════════════════════════════════ */

/**
 * Analyse LOCALE, sans réseau. Utilisée telle quelle en mode contrôle libre,
 * et comme socle (puis affinage modèle) dans les autres modes.
 *
 * @param {string} texte
 * @param {string} [typeDoc] — clé DOC_TYPE_META
 */
export function analyserContexteLocal(texte, typeDoc) {
  const n = normaliser(texte);
  const scores = {};
  const indices = [];

  for (const [cle, reg] of Object.entries(REGISTRES)) {
    let score = 0;
    for (const m of reg.marqueurs) {
      if (n.includes(m)) {
        score += 1;
        if (indices.length < 12) indices.push(m);
      }
    }
    scores[cle] = score;
  }

  // Le type choisi par l'utilisateur pèse : c'est une intention déclarée,
  // plus fiable qu'un mot isolé retrouvé dans une phrase.
  const parType = REGISTRE_PAR_TYPE[typeDoc];
  if (parType) scores[parType] += 2.5;

  let registre = parType ?? 'administratif';
  let meilleur = -1;
  for (const [cle, s] of Object.entries(scores)) {
    if (s > meilleur) { meilleur = s; registre = cle; }
  }

  let niveau = REGISTRES[registre].formaliteDefaut;
  if (/\b(salut|coucou|hello|tu peux|t as|ok\b|super|cool)\b/.test(n)) niveau -= 2;
  if (/\b(veuillez|je vous prie|par la presente|nonobstant|il est convenu|soussigne)\b/.test(n)) niveau += 1;
  niveau = Math.max(1, Math.min(5, Math.round(niveau)));

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const confiance = total <= 0 ? 0.25 : Math.min(0.9, 0.3 + (meilleur / total) * 0.6);

  return {
    ok: true,
    source: 'local',
    registre,
    registreLabel: REGISTRES[registre].label,
    niveauFormalite: niveau,
    formaliteLabel: NIVEAUX_FORMALITE[niveau].label,
    consigneStyle: REGISTRES[registre].consigne,
    typeDoc: typeDoc ?? null,
    intention: null,
    indices: Array.from(new Set(indices)),
    vocabulaireCle: [],
    confiance: Number(confiance.toFixed(2)),
  };
}

/**
 * Détecte le registre et le niveau de formalité.
 * Toujours un résultat exploitable : l'analyse locale sert de socle, le modèle
 * ne fait que l'affiner. Une panne réseau ne bloque donc jamais l'écran.
 *
 * @param {string} texte — ce que l'utilisateur a saisi/collé
 * @param {string} [typeDoc]
 * @param {{ forcerLocal?: boolean }} [opts]
 */
export async function detecterContexte(texte, typeDoc, opts = {}) {
  const local = analyserContexteLocal(texte, typeDoc);
  const brut = String(texte ?? '').trim();

  // Mode libre : aucun réseau. L'analyse locale reste rendue (elle n'appelle rien).
  if (!iaAutorisee() || opts.forcerLocal) return local;
  if (brut.length < 25) return local; // trop court pour valoir un aller-retour

  const prompt = `Tu analyses la demande d'un utilisateur qui rédige un document professionnel en français.

Demande de l'utilisateur :
"""${brut.slice(0, 2500)}"""

Type de document déclaré : ${typeDoc || 'non précisé'}
Pré-analyse locale (à confirmer ou corriger) : registre=${local.registre}, formalité=${local.niveauFormalite}/5

Détermine :
- le registre parmi exactement : administratif, commercial, juridique, educatif, rh
- le niveau de formalité de 1 (familier) à 5 (solennel)
- une intention en une phrase courte
- 3 à 8 termes de vocabulaire propres à ce registre, utiles pour ce document précis

${CONSIGNE_JSON}
Schéma : {"registre":"administratif","niveau_formalite":4,"intention":"...","indices":["...","..."],"vocabulaire_cle":["...","..."]}`;

  try {
    const { json, provider } = await appelJson({ tache: 'detecter_contexte', prompt, mode: 'coach', delaiMs: 45000 });
    const registre = REGISTRES[json?.registre] ? json.registre : local.registre;
    let niveau = Number(json?.niveau_formalite);
    if (!Number.isFinite(niveau)) niveau = local.niveauFormalite;
    niveau = Math.max(1, Math.min(5, Math.round(niveau)));

    return {
      ok: true,
      source: 'llm',
      provider,
      registre,
      registreLabel: REGISTRES[registre].label,
      niveauFormalite: niveau,
      formaliteLabel: NIVEAUX_FORMALITE[niveau].label,
      consigneStyle: REGISTRES[registre].consigne,
      typeDoc: typeDoc ?? null,
      intention: typeof json?.intention === 'string' ? json.intention.trim() : null,
      indices: Array.isArray(json?.indices) ? json.indices.map(String).slice(0, 12) : local.indices,
      vocabulaireCle: Array.isArray(json?.vocabulaire_cle) ? json.vocabulaire_cle.map(String).slice(0, 10) : [],
      confiance: 0.85,
    };
  } catch (e) {
    // Panne : on rend l'analyse locale en le DISANT (pas de faux « analysé par l'IA »).
    return { ...local, degrade: true, degradeMessage: e?.message ?? 'Modèle injoignable' };
  }
}

/* ══════════════════════════════════════════════════════════════════
   5. POINT 2 — SUGGESTIONS (tirer / coller / régénérer)
══════════════════════════════════════════════════════════════════ */

/**
 * @typedef {object} Suggestion
 * @property {string} id        identifiant STABLE de l'emplacement (survit à « Régénérer »)
 * @property {number} version   incrémentée à chaque régénération
 * @property {'bloc'|'formulation'|'terme'} famille
 * @property {string} cle       bloc visé / extrait source
 * @property {string} texte     contenu prêt à insérer
 * @property {string} [note]    pourquoi cette proposition
 * @property {string} registre
 * @property {string} source    'llm' | 'admin_document' | 'lexique_local'
 */

function fabriquerSuggestion(famille, cle, index, texte, extra = {}) {
  return {
    id: `sug_${famille}_${hachage(`${famille}|${cle}`)}_${index}`,
    version: extra.version ?? 1,
    famille,
    cle,
    texte: String(texte ?? '').trim(),
    note: extra.note ?? null,
    registre: extra.registre ?? null,
    source: extra.source ?? 'llm',
    genereLe: Date.now(),
  };
}

/**
 * Blocs de texte prêts à insérer pour une zone du document.
 *
 * @param {object} contexte — sortie de detecterContexte
 * @param {string} blocManquant — ex. 'objet', 'formule de politesse', 'corps'
 * @param {{ titreDocument?: string, reponses?: object, nombre?: number, eviter?: string[], version?: number }} [opts]
 * @returns {Promise<{ ok: boolean, propositions?: Suggestion[], raison?: string, message?: string }>}
 */
export async function suggererBlocs(contexte, blocManquant, opts = {}) {
  if (!iaAutorisee()) return refusModeLibre();
  const bloc = String(blocManquant ?? '').trim();
  if (!bloc) return echec('parametre', 'Aucun bloc à rédiger n’a été indiqué.');

  const nombre = Math.max(1, Math.min(5, opts.nombre ?? 3));
  const eviter = Array.isArray(opts.eviter) ? opts.eviter.filter(Boolean).slice(0, 5) : [];

  const prompt = `Tu es LONGIA, rédacteur professionnel francophone. Tu proposes du texte à insérer dans un document ; l'utilisateur choisira.

${blocContexte(contexte, opts)}

Bloc à rédiger : « ${bloc} »
Informations connues :
${reponsesLisibles(opts.reponses)}
${eviter.length ? `\nÉvite de reproduire ces formulations déjà proposées :\n${eviter.map((t) => `- ${String(t).slice(0, 180)}`).join('\n')}` : ''}

Rends ${nombre} propositions RÉELLEMENT différentes (angle, longueur, degré de fermeté) pour ce seul bloc.
Chaque proposition est du texte prêt à coller : pas de titre, pas de numérotation, pas de markdown, pas d'emoji.
Si une information manque, laisse un crochet explicite du type [nom du destinataire] plutôt que d'inventer un fait.

${CONSIGNE_JSON}
Schéma : {"propositions":[{"texte":"...","note":"pourquoi cet angle"}]}`;

  try {
    const { json } = await appelJson({ tache: 'suggerer_blocs', prompt, mode: 'coach', delaiMs: 50000 });
    const brutes = Array.isArray(json?.propositions) ? json.propositions : [];
    const propositions = brutes
      .map((p, i) =>
        fabriquerSuggestion('bloc', bloc, i, typeof p === 'string' ? p : p?.texte, {
          note: typeof p?.note === 'string' ? p.note : null,
          registre: contexte?.registre ?? null,
          source: 'llm',
          version: opts.version ?? 1,
        }),
      )
      .filter((s) => s.texte.length > 0)
      .slice(0, nombre);
    if (propositions.length) return { ok: true, propositions, source: 'llm' };
    throw new Error('Aucune proposition exploitable');
  } catch (ePrincipal) {
    // Repli : le Secrétariat sait déjà produire 5 formulations administratives.
    try {
      const data = await appelAdminDocument('suggestions', {
        documentTitle: opts.titreDocument || `${contexte?.typeDoc || 'Document'} — bloc « ${bloc} »`,
        topicHint: `Bloc « ${bloc} ». Registre ${REGISTRES[contexte?.registre]?.label ?? 'administratif'}. ${reponsesLisibles(opts.reponses)}`,
      });
      const lignes = Array.isArray(data?.suggestions) ? data.suggestions : [];
      const propositions = lignes
        .map((t, i) =>
          fabriquerSuggestion('bloc', bloc, i, t, {
            registre: contexte?.registre ?? null,
            source: 'admin_document',
            version: opts.version ?? 1,
          }),
        )
        .filter((s) => s.texte.length > 0)
        .slice(0, nombre);
      if (propositions.length) return { ok: true, propositions, source: 'admin_document' };
      return echec('vide', 'Le modèle n’a rien retourné d’exploitable.', ePrincipal?.message);
    } catch (eRepli) {
      return echec('reseau', `Suggestions indisponibles : ${eRepli?.message ?? ePrincipal?.message}`);
    }
  }
}

/**
 * 2 à 3 reformulations d'un extrait, dans un registre donné.
 * ⛔ Ne remplace RIEN : l'appelant décide de l'insertion.
 *
 * @param {string} extrait
 * @param {string} registre — clé REGISTRES, ou objet contexte
 * @param {{ intention?: string, nombre?: number, eviter?: string[], niveauFormalite?: number, version?: number }} [opts]
 */
export async function suggererFormulation(extrait, registre, opts = {}) {
  if (!iaAutorisee()) return refusModeLibre();
  const source = String(extrait ?? '').trim();
  if (source.length < 3) return echec('parametre', 'Aucun texte à reformuler.');

  const contexte =
    registre && typeof registre === 'object'
      ? registre
      : { registre: REGISTRES[registre] ? registre : 'administratif', niveauFormalite: opts.niveauFormalite };
  const nombre = Math.max(2, Math.min(4, opts.nombre ?? 3));
  const eviter = Array.isArray(opts.eviter) ? opts.eviter.filter(Boolean).slice(0, 5) : [];

  const prompt = `Tu reformules un extrait de document professionnel français. Tu ne changes AUCUN fait, AUCUN chiffre, AUCUN nom.

${blocContexte(contexte)}
${opts.intention ? `Intention demandée : ${opts.intention}` : ''}

Extrait d'origine :
"""${source.slice(0, 3000)}"""
${eviter.length ? `\nÉvite ces reformulations déjà proposées :\n${eviter.map((t) => `- ${String(t).slice(0, 180)}`).join('\n')}` : ''}

Rends ${nombre} reformulations distinctes. Pour chacune, précise l'angle en 4 mots maximum.
Longueur comparable à l'original sauf si l'intention demande explicitement le contraire.
Pas de markdown, pas de guillemets englobants, pas d'emoji.

${CONSIGNE_JSON}
Schéma : {"propositions":[{"texte":"...","angle":"plus direct"}]}`;

  try {
    const { json } = await appelJson({ tache: 'suggerer_formulation', prompt, mode: 'coach', delaiMs: 50000 });
    const brutes = Array.isArray(json?.propositions) ? json.propositions : [];
    const propositions = brutes
      .map((p, i) =>
        fabriquerSuggestion('formulation', source.slice(0, 80), i, typeof p === 'string' ? p : p?.texte, {
          note: typeof p?.angle === 'string' ? p.angle : null,
          registre: contexte.registre,
          source: 'llm',
          version: opts.version ?? 1,
        }),
      )
      .filter((s) => s.texte.length > 0)
      .slice(0, nombre);
    if (propositions.length) return { ok: true, propositions, source: 'llm', extraitOrigine: source };
    throw new Error('Aucune reformulation exploitable');
  } catch (ePrincipal) {
    try {
      const data = await appelAdminDocument('intelligent', {
        documentTitle: opts.titreDocument || 'Reformulation',
        selection: source.slice(0, 4000),
        topicHint: `Registre ${REGISTRES[contexte.registre]?.label ?? 'administratif'}.${opts.intention ? ` Intention : ${opts.intention}.` : ''}`,
      });
      const texte = String(data?.result ?? '').trim();
      if (!texte) return echec('vide', 'Le modèle n’a rien retourné.', ePrincipal?.message);
      return {
        ok: true,
        source: 'admin_document',
        extraitOrigine: source,
        propositions: [
          fabriquerSuggestion('formulation', source.slice(0, 80), 0, texte, {
            registre: contexte.registre,
            source: 'admin_document',
            version: opts.version ?? 1,
          }),
        ],
        // Une seule proposition ici : le repli ne sait pas en produire plusieurs.
        partiel: true,
      };
    } catch (eRepli) {
      return echec('reseau', `Reformulation indisponible : ${eRepli?.message ?? ePrincipal?.message}`);
    }
  }
}

/**
 * Le « mot juste » du domaine pour un extrait.
 * Repli déterministe sur LEXIQUE_REGISTRE si le modèle est injoignable.
 *
 * @param {string} extrait
 * @param {string|object} registre
 * @param {{ nombre?: number, version?: number }} [opts]
 */
export async function suggererMotTechnique(extrait, registre, opts = {}) {
  if (!iaAutorisee()) return refusModeLibre();
  const source = String(extrait ?? '').trim();
  if (source.length < 3) return echec('parametre', 'Aucun texte à analyser.');

  const cleRegistre =
    registre && typeof registre === 'object'
      ? (REGISTRES[registre.registre] ? registre.registre : 'administratif')
      : (REGISTRES[registre] ? registre : 'administratif');
  const contexte = { registre: cleRegistre, niveauFormalite: REGISTRES[cleRegistre].formaliteDefaut };
  const nombre = Math.max(2, Math.min(6, opts.nombre ?? 4));

  const prompt = `Tu es terminologue. Tu proposes le TERME JUSTE du domaine pour remplacer des mots trop courants dans un document professionnel français.

${blocContexte(contexte)}

Extrait :
"""${source.slice(0, 2000)}"""

Repère jusqu'à ${nombre} mots ou expressions du texte qui gagneraient à être remplacés par le terme consacré du domaine.
Pour chacun : le mot d'origine tel qu'il apparaît, le terme juste, et une justification d'une phrase.
N'invente aucune référence légale, aucun numéro d'article, aucune norme.
Si le texte est déjà correct, rends une liste vide.

${CONSIGNE_JSON}
Schéma : {"termes":[{"remplace":"demander","terme":"solliciter","justification":"..."}]}`;

  try {
    const { json } = await appelJson({ tache: 'suggerer_mot_technique', prompt, mode: 'coach', delaiMs: 45000 });
    const brutes = Array.isArray(json?.termes) ? json.termes : [];
    const propositions = brutes
      .map((t, i) =>
        fabriquerSuggestion('terme', `${cleRegistre}:${String(t?.remplace ?? i)}`, i, t?.terme, {
          note: [t?.remplace ? `remplace « ${t.remplace} »` : null, t?.justification].filter(Boolean).join(' — '),
          registre: cleRegistre,
          source: 'llm',
          version: opts.version ?? 1,
        }),
      )
      .filter((s) => s.texte.length > 0)
      .slice(0, nombre);
    return { ok: true, propositions, source: 'llm', registre: cleRegistre };
  } catch (e) {
    const n = normaliser(source);
    const propositions = (LEXIQUE_REGISTRE[cleRegistre] ?? [])
      .filter((entree) => entree.courant.some((c) => n.includes(normaliser(c))))
      .slice(0, nombre)
      .map((entree, i) =>
        fabriquerSuggestion('terme', `${cleRegistre}:${entree.courant[0]}`, i, entree.terme, {
          note: `remplace « ${entree.courant[0]} » — ${entree.note}`,
          registre: cleRegistre,
          source: 'lexique_local',
          version: opts.version ?? 1,
        }),
      );
    if (propositions.length) {
      return { ok: true, propositions, source: 'lexique_local', degrade: true, degradeMessage: e?.message ?? null, registre: cleRegistre };
    }
    return echec('reseau', `Terminologie indisponible : ${e?.message ?? 'modèle injoignable'}`);
  }
}

/**
 * Régénère UNE suggestion en conservant son identifiant d'emplacement.
 * L'ancien texte est passé en `eviter` : « Régénérer » doit donner autre chose.
 *
 * @param {Suggestion} suggestion
 * @param {{ contexte?: object, reponses?: object, titreDocument?: string, extraitOrigine?: string }} [opts]
 */
export async function regenererSuggestion(suggestion, opts = {}) {
  if (!iaAutorisee()) return refusModeLibre();
  if (!suggestion || typeof suggestion !== 'object') return echec('parametre', 'Suggestion inconnue.');

  const version = (Number(suggestion.version) || 1) + 1;
  const eviter = [suggestion.texte, ...(Array.isArray(opts.eviter) ? opts.eviter : [])];
  const contexte = opts.contexte ?? { registre: suggestion.registre ?? 'administratif' };

  let res;
  if (suggestion.famille === 'bloc') {
    res = await suggererBlocs(contexte, suggestion.cle, { ...opts, nombre: 1, eviter, version });
  } else if (suggestion.famille === 'formulation') {
    const extrait = opts.extraitOrigine ?? suggestion.cle;
    res = await suggererFormulation(extrait, contexte, { ...opts, nombre: 2, eviter, version });
  } else {
    res = await suggererMotTechnique(opts.extraitOrigine ?? suggestion.cle, contexte, { ...opts, version });
  }

  if (!res?.ok || !res.propositions?.length) return res;
  // L'emplacement garde son id : l'interface remplace la carte, elle n'en empile pas une nouvelle.
  const remplacante = { ...res.propositions[0], id: suggestion.id, version };
  return { ...res, propositions: [remplacante] };
}

/* ══════════════════════════════════════════════════════════════════
   6. POINT 3 — RÉDACTION INTÉGRALE
══════════════════════════════════════════════════════════════════ */

/**
 * Rédige TOUS les blocs requis du document.
 *
 * ⛔ `blocsRequis` est passé par l'appelant (DOC_TYPE_META[type].requiredBlocks) :
 *    ce module ne doit pas importer le store, sinon import circulaire.
 * ⛔ Un bloc requis absent de la réponse n'est jamais escamoté : il revient avec
 *    un texte « [À compléter] » et un avertissement. Mieux vaut un trou visible
 *    qu'un document amputé en silence.
 *
 * @param {string} typeDoc
 * @param {object} contexte — sortie de detecterContexte
 * @param {object} reponses — réponses du questionnaire guidé (peut être vide)
 * @param {{ blocsRequis?: string[], titreDocument?: string, modeleNom?: string, longueur?: string }} [opts]
 */
export async function redigerDocumentComplet(typeDoc, contexte, reponses, opts = {}) {
  if (!iaAutorisee()) return refusModeLibre();

  const blocsRequis = Array.isArray(opts.blocsRequis) && opts.blocsRequis.length
    ? opts.blocsRequis.map(String)
    : ['objet', 'corps', 'signature'];

  const prompt = `Tu es LONGIA, rédacteur professionnel francophone. Tu rédiges un document COMPLET, prêt à être mis en page.

${blocContexte(contexte, opts)}
${opts.modeleNom ? `Modèle de référence : ${opts.modeleNom}` : ''}
${opts.longueur ? `Longueur souhaitée : ${opts.longueur}` : ''}

Informations fournies par l'utilisateur :
${reponsesLisibles(reponses)}

Rédige EXACTEMENT ces blocs, dans cet ordre, sans en ajouter ni en retirer :
${blocsRequis.map((b, i) => `${i + 1}. ${b}`).join('\n')}

Règles impératives :
- N'INVENTE aucun fait, aucun montant, aucune date, aucune référence légale. Toute information absente devient un crochet explicite : [montant], [date], [nom du signataire].
- Chaque bloc est du texte prêt à coller : pas de markdown, pas de puce automatique, pas d'emoji.
- Le bloc « signature » ne comporte que la formule et les mentions de signature, jamais le corps.
- Respecte le registre et le niveau de formalité indiqués plus haut.

${CONSIGNE_JSON}
Schéma : {"titre_document":"...","blocs":[{"cle":"objet","titre":"Objet","texte":"..."}],"notes":["point de vigilance"]}`;

  try {
    // Rédaction longue → chaîne lourde (architect) et budget de temps large.
    const { json, provider } = await appelJson({
      tache: 'rediger_document_complet',
      prompt,
      mode: 'architect',
      delaiMs: 120000,
    });

    const rendus = Array.isArray(json?.blocs) ? json.blocs : [];
    const parCle = new Map();
    for (const b of rendus) {
      const cle = String(b?.cle ?? b?.titre ?? '').trim();
      const texte = String(b?.texte ?? '').trim();
      if (cle && texte) parCle.set(normaliser(cle), { cle, titre: String(b?.titre ?? cle), texte });
    }

    const avertissements = [];
    const blocs = blocsRequis.map((requis) => {
      const trouve =
        parCle.get(normaliser(requis)) ??
        [...parCle.values()].find((b) => normaliser(b.cle).includes(normaliser(requis)) || normaliser(requis).includes(normaliser(b.cle)));
      if (trouve) return { cle: requis, titre: trouve.titre, texte: trouve.texte, complet: true };
      avertissements.push(`Bloc « ${requis} » non rédigé par le modèle — à compléter à la main.`);
      return { cle: requis, titre: requis, texte: `[À compléter — ${requis}]`, complet: false };
    });

    if (Array.isArray(json?.notes)) {
      for (const n of json.notes.slice(0, 6)) if (String(n ?? '').trim()) avertissements.push(String(n).trim());
    }

    return {
      ok: true,
      source: 'llm',
      provider,
      titreDocument: typeof json?.titre_document === 'string' ? json.titre_document.trim() : (opts.titreDocument ?? null),
      typeDoc: typeDoc ?? null,
      registre: contexte?.registre ?? null,
      niveauFormalite: contexte?.niveauFormalite ?? null,
      blocs,
      blocsIncomplets: blocs.filter((b) => !b.complet).map((b) => b.cle),
      avertissements,
    };
  } catch (e) {
    return echec('reseau', `Rédaction impossible : ${e?.message ?? 'modèle injoignable'}`);
  }
}

/* ══════════════════════════════════════════════════════════════════
   7. POINT 5 — CORRECTION DES FAUTES
══════════════════════════════════════════════════════════════════ */

/**
 * Relève les fautes d'un texte : liste située, typée, expliquée, acceptable une
 * par une. Le moteur est `documentCorrection.js` ; on ne fait ici que lui brancher
 * le modèle (Mistral, tâche courte).
 *
 * ⛔ Verrou mode libre : en contrôle libre, `appelModele` n'est même pas
 *    construit — le module de correction est alors physiquement incapable
 *    d'atteindre le réseau. La passe déterministe locale reste rendue, et le
 *    résultat porte `modeLibre: true` pour que l'interface le dise.
 * ⛔ Le texte n'est JAMAIS modifié ici : `appliquerCorrections` (documentCorrection.js)
 *    est appelé par l'interface, sur les seules corrections acceptées.
 *
 * @param {string} texte
 * @param {{ langue?: string, registre?: string|object, termesProteges?: string[], forcerLocal?: boolean }} [opts]
 */
export async function corrigerFautes(texte, opts = {}) {
  const registre =
    opts.registre && typeof opts.registre === 'object'
      ? (REGISTRES[opts.registre.registre] ? opts.registre.registre : 'administratif')
      : (REGISTRES[opts.registre] ? opts.registre : 'administratif');

  const base = {
    langue: opts.langue ?? 'fr',
    registre,
    termesProteges: Array.isArray(opts.termesProteges) ? opts.termesProteges : [],
  };

  if (!iaAutorisee() || opts.forcerLocal) {
    const local = await corrigerTexte(texte, base);
    return {
      ...local,
      modeLibre: !iaAutorisee(),
      message: iaAutorisee()
        ? null
        : 'Mode contrôle libre : seules les règles locales sont appliquées, aucune IA n’est appelée.',
    };
  }

  return corrigerTexte(texte, {
    ...base,
    appelModele: ({ prompt, tache, poids }) =>
      appelJson({ tache, prompt, mode: 'coach', delaiMs: 45000, poids }),
  });
}
