/**
 * documentCorrection.js — CORRECTION DES FAUTES du mode Document (capacité neuve).
 *
 * Ce que ce module rend : une LISTE de corrections, chacune située dans le texte,
 * typée et expliquée. Jamais un texte réécrit en bloc. L'utilisateur accepte ou
 * refuse chaque correction, une par une, comme dans un traitement de texte.
 *
 * ⛔ CONTRAINTE 1 — une correction ne change JAMAIS le sens.
 *    « faute » et « suggestion de style » sont deux listes séparées : `corrections`
 *    (fautes) et `suggestionsStyle`. Le style est le métier d'« Améliorer »
 *    (DocumentTextAiActions), pas du correcteur.
 *
 * ⛔ CONTRAINTE 2 — un correcteur qui souligne le nom de l'entreprise est
 *    inutilisable. Noms propres, sigles (XAF, SIRET, RCCM), montants, adresses
 *    e-mail, URL, crochets [à compléter] et jetons {{page}} sont des ZONES
 *    PROTÉGÉES : toute proposition du modèle qui les touche est écartée, et la
 *    raison du rejet est rendue (`rejets`) — jamais un silence.
 *
 * ⛔ CONTRAINTE 3 — aucun import d'alias `@/…` ici. Le module reste PUR :
 *    le modèle arrive par injection (`opts.appelModele`). C'est ce qui permet de
 *    le tester sous `node --test` avec un modèle simulé, sans réseau.
 *    Le câblage réel (Mistral via studio-longia-chat) vit dans documentIntelligence.js.
 *
 * ⚠️ PIÈGE mesuré sur les autres étages IA du Document : le modèle invente des
 *    positions. On ne lui fait donc JAMAIS confiance sur `debut`/`fin` : on
 *    relocalise nous-mêmes la chaîne `avant` dans le texte, et si elle n'y est
 *    pas littéralement, la correction est rejetée (`introuvable`).
 */

/* ══════════════════════════════════════════════════════════════════
   1. TYPES DE CORRECTION
══════════════════════════════════════════════════════════════════ */

export const TYPES_CORRECTION = {
  orthographe: { id: 'orthographe', label: 'Orthographe', desc: 'Le mot n’existe pas ou s’écrit autrement.' },
  grammaire: { id: 'grammaire', label: 'Grammaire', desc: 'Construction fautive de la phrase.' },
  accord: { id: 'accord', label: 'Accord', desc: 'Genre, nombre ou personne mal accordés.' },
  typographie: { id: 'typographie', label: 'Typographie', desc: 'Usage typographique français (espaces, apostrophe, majuscule).' },
  ponctuation: { id: 'ponctuation', label: 'Ponctuation', desc: 'Signe de ponctuation absent, en trop ou mal placé.' },
};

export const TYPES_CORRECTION_IDS = Object.keys(TYPES_CORRECTION);

/** Catégories : ce que l'utilisateur voit dans deux colonnes distinctes. */
export const CATEGORIE_FAUTE = 'faute';
export const CATEGORIE_STYLE = 'style';

/* ══════════════════════════════════════════════════════════════════
   2. OUTILS
══════════════════════════════════════════════════════════════════ */

/** Frontière de mot compatible accents : `\b` de JS ne connaît que l'ASCII. */
const AVANT_MOT = '(?<![\\p{L}\\p{N}])';
const APRES_MOT = '(?![\\p{L}\\p{N}])';

function echapper(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Motif d'une entrée de lexique : espaces souples, apostrophe droite OU courbe. */
function motifLexique(expression) {
  const brut = echapper(expression).replace(/ /g, '\\s+').replace(/'|’/g, "['’]");
  return new RegExp(`${AVANT_MOT}${brut}${APRES_MOT}`, 'giu');
}

function hachage(str) {
  let h = 5381;
  const s = String(str ?? '');
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function sansAccent(txt) {
  return String(txt ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Comparaison « le sens est-il le même ? » : casse, accents, apostrophes et espaces neutralisés. */
function empreinte(txt) {
  return sansAccent(txt).toLowerCase().replace(/['’`-]/g, '').replace(/\s+/g, '');
}

/** Levenshtein borné — sert à distinguer une correction LOCALE d'une réécriture. */
export function distanceEdition(a, b) {
  const s = String(a ?? '');
  const t = String(b ?? '');
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  let precedente = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i += 1) {
    const courante = [i];
    for (let j = 1; j <= t.length; j += 1) {
      const cout = s[i - 1] === t[j - 1] ? 0 : 1;
      courante[j] = Math.min(courante[j - 1] + 1, precedente[j] + 1, precedente[j - 1] + cout);
    }
    precedente = courante;
  }
  return precedente[t.length];
}

function motsDe(txt) {
  return String(txt ?? '').trim().split(/\s+/).filter(Boolean);
}

/** Suite de chiffres : si elle bouge, ce n'est plus une correction mais une altération de donnée. */
function chiffresDe(txt) {
  return (String(txt ?? '').match(/\d+/g) || []).join('|');
}

const MOTS_NEGATION = new Set(['ne', 'n', 'pas', 'plus', 'jamais', 'aucun', 'aucune', 'non', 'ni', 'sans', 'rien']);

function negationsDe(txt) {
  const set = new Set();
  for (const m of motsDe(sansAccent(txt).toLowerCase().replace(/['’]/g, ' '))) {
    const mot = m.replace(/[^a-z]/g, '');
    if (MOTS_NEGATION.has(mot)) set.add(mot);
  }
  return set;
}

function memesNegations(a, b) {
  const na = negationsDe(a);
  const nb = negationsDe(b);
  if (na.size !== nb.size) return false;
  for (const m of na) if (!nb.has(m)) return false;
  return true;
}

/* ══════════════════════════════════════════════════════════════════
   3. ZONES PROTÉGÉES — ce que le correcteur n'a pas le droit de toucher
══════════════════════════════════════════════════════════════════ */

const RE_URL = /(?:https?:\/\/|www\.)[^\s,;)]+/gi;
const RE_EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const RE_CROCHET = /\[[^\]\n]{1,120}\]/g;
const RE_JETON = /\{\{[^}\n]{1,60}\}\}/g;
/** Sigles et références : XAF, SIRET, RCCM, SAS, TVA, ISO 9001… */
const RE_SIGLE = /(?<![\p{L}\p{N}])\p{Lu}{2,}(?:[-.]?\p{Lu}{1,})*(?![\p{Ll}])/gu;
/** Tout groupe contenant un chiffre : montants, dates, numéros, références. */
const RE_CHIFFRE = /(?<![\p{L}\p{N}])[\p{L}\p{N}]*\p{N}[\p{L}\p{N}.,'’/-]*/gu;
/** Nom propre = majuscule initiale hors début de phrase (Orabank, Ngowazulu, Libreville). */
const RE_CAPITALE = /(?<![\p{L}\p{N}])\p{Lu}[\p{Ll}’'-]+/gu;

function ajouterZones(zones, texte, regex) {
  regex.lastIndex = 0;
  let m = regex.exec(texte);
  while (m) {
    if (m[0].length) zones.push([m.index, m.index + m[0].length]);
    if (m.index === regex.lastIndex) regex.lastIndex += 1;
    m = regex.exec(texte);
  }
}

/**
 * Calcule les intervalles intouchables du texte.
 *
 * @param {string} texte
 * @param {{ termesProteges?: string[], inclureNomsPropres?: boolean }} [opts]
 *   `inclureNomsPropres` : réservé aux propositions du MODÈLE. Les règles locales
 *   travaillent sur une liste fermée de fautes connues, elles n'ont pas besoin de
 *   cette protection (et elle les empêcherait de corriger « Malgrés » en début de phrase).
 * @returns {Array<[number, number]>}
 */
export function zonesProtegees(texte, opts = {}) {
  const src = String(texte ?? '');
  const zones = [];
  for (const re of [RE_URL, RE_EMAIL, RE_CROCHET, RE_JETON, RE_SIGLE, RE_CHIFFRE]) {
    ajouterZones(zones, src, re);
  }
  if (opts.inclureNomsPropres) {
    // Le tout premier mot du texte et les mots qui suivent un point sont des
    // majuscules de position, pas des noms propres : on les laisse corrigibles.
    RE_CAPITALE.lastIndex = 0;
    let m = RE_CAPITALE.exec(src);
    while (m) {
      const avant = src.slice(0, m.index);
      const debutDePhrase = /(^|[.!?:]\s*|\n\s*)$/.test(avant);
      if (!debutDePhrase) zones.push([m.index, m.index + m[0].length]);
      m = RE_CAPITALE.exec(src);
    }
  }
  for (const terme of Array.isArray(opts.termesProteges) ? opts.termesProteges : []) {
    const t = String(terme ?? '').trim();
    if (t.length < 2) continue;
    const re = new RegExp(`${AVANT_MOT}${echapper(t).replace(/ /g, '\\s+')}${APRES_MOT}`, 'giu');
    ajouterZones(zones, src, re);
  }
  return zones.sort((a, b) => a[0] - b[0]);
}

function chevauche(zones, debut, fin) {
  return zones.some(([d, f]) => debut < f && fin > d);
}

/* ══════════════════════════════════════════════════════════════════
   4. RÈGLES LOCALES — déterministes, aucun réseau
══════════════════════════════════════════════════════════════════ */

/**
 * Fautes d'orthographe fréquentes en français professionnel.
 * ⛔ Liste FERMÉE et volontairement courte : chaque entrée doit être une faute
 *    dans TOUS les contextes. « d'avantage », « évidement », « connaitre » sont
 *    absents exprès — ce sont des mots valides ailleurs, donc des faux positifs.
 */
export const LEXIQUE_FAUTES = [
  { faute: 'malgrés', juste: 'malgré', type: 'orthographe', explication: '« malgré » ne prend jamais de s.' },
  { faute: 'malgrè', juste: 'malgré', type: 'orthographe', explication: 'Accent aigu sur le e final.' },
  { faute: 'parmis', juste: 'parmi', type: 'orthographe', explication: '« parmi » ne prend jamais de s.' },
  { faute: 'hormi', juste: 'hormis', type: 'orthographe', explication: '« hormis » prend toujours un s.' },
  { faute: 'quelquechose', juste: 'quelque chose', type: 'orthographe', explication: 'Deux mots séparés.' },
  { faute: 'biensur', juste: 'bien sûr', type: 'orthographe', explication: 'Deux mots, accent circonflexe sur le u.' },
  { faute: 'language', juste: 'langage', type: 'orthographe', explication: 'Forme anglaise ; en français « langage ».' },
  { faute: 'developement', juste: 'développement', type: 'orthographe', explication: 'Deux p et deux accents aigus.' },
  { faute: 'dévelopement', juste: 'développement', type: 'orthographe', explication: 'Deux p.' },
  { faute: 'rénumération', juste: 'rémunération', type: 'orthographe', explication: 'De « munus » : rému-, pas rénu-.' },
  { faute: 'rénumérer', juste: 'rémunérer', type: 'orthographe', explication: 'De « munus » : rému-, pas rénu-.' },
  { faute: 'acceuil', juste: 'accueil', type: 'orthographe', explication: 'Le u précède le e : accueil.' },
  { faute: 'recueuil', juste: 'recueil', type: 'orthographe', explication: 'Un seul u après le c.' },
  { faute: 'proffesseur', juste: 'professeur', type: 'orthographe', explication: 'Un seul f.' },
  { faute: 'notament', juste: 'notamment', type: 'orthographe', explication: 'Deux m.' },
  { faute: 'récement', juste: 'récemment', type: 'orthographe', explication: 'Deux m.' },
  { faute: 'immédiatemment', juste: 'immédiatement', type: 'orthographe', explication: 'Un seul m à la finale -ement.' },
  { faute: 'aggrandir', juste: 'agrandir', type: 'orthographe', explication: 'Un seul g.' },
  { faute: 'abbréviation', juste: 'abréviation', type: 'orthographe', explication: 'Un seul b.' },
  { faute: 'dilemne', juste: 'dilemme', type: 'orthographe', explication: 'Deux m, pas de n.' },
  { faute: 'soit-disant', juste: 'soi-disant', type: 'orthographe', explication: '« soi » pronom, sans t.' },
  { faute: "d'ors et déjà", juste: 'd’ores et déjà', type: 'orthographe', explication: '« ores » = maintenant.' },
  { faute: 'voir même', juste: 'voire', type: 'orthographe', explication: '« voire » (adverbe) ; « même » est un pléonasme.' },
  { faute: 'ammener', juste: 'amener', type: 'orthographe', explication: 'Un seul m.' },
  { faute: 'éxécuter', juste: 'exécuter', type: 'orthographe', explication: 'Pas d’accent sur le premier e.' },
  { faute: 'éffectuer', juste: 'effectuer', type: 'orthographe', explication: 'Pas d’accent sur le premier e.' },
  { faute: 'address', juste: 'adresse', type: 'orthographe', explication: 'Forme anglaise ; en français un seul d.' },
  { faute: 'tout les', juste: 'tous les', type: 'accord', explication: '« tous » au pluriel devant un nom masculin pluriel.' },
  { faute: 'toute les', juste: 'toutes les', type: 'accord', explication: '« toutes » au pluriel devant un nom féminin pluriel.' },
  { faute: 'quelque soit', juste: 'quel que soit', type: 'grammaire', explication: '« quel que » en deux mots ; accordez « quel » au genre du sujet.' },
  { faute: 'malgré que', juste: 'bien que', type: 'grammaire', explication: '« malgré que » est fautif ; « bien que » + subjonctif.' },
  { faute: 'afin de que', juste: 'afin que', type: 'grammaire', explication: 'Locution conjonctive : « afin que ».' },
  { faute: 'pallier à', juste: 'pallier', type: 'grammaire', explication: '« pallier » est transitif direct : pallier un manque.' },
  { faute: 'je vous serai gré', juste: 'je vous saurai gré', type: 'grammaire', explication: 'Du verbe « savoir gré », pas « être gré ».' },
  { faute: 'je vous pris de', juste: 'je vous prie de', type: 'grammaire', explication: 'Présent de « prier » : je vous prie.' },
  { faute: 'etc...', juste: 'etc.', type: 'ponctuation', explication: '« etc. » ne se cumule pas avec des points de suspension.' },
  { faute: 'Mr', juste: 'M.', type: 'typographie', explication: 'Abréviation française de Monsieur : M.' },
];

/** Abréviations dont le point ne termine pas la phrase — évite une fausse majuscule. */
const ABREVIATIONS = new Set([
  'm', 'mm', 'mme', 'mmes', 'mlle', 'me', 'mes', 'dr', 'pr', 'art', 'cf', 'ex', 'etc',
  'p', 'pp', 'n', 'no', 'ref', 'tel', 'av', 'bd', 'st', 'ste', 'mgr', 'fig', 'vol',
  'ed', 'al', 'env', 'max', 'min', 'ste', 'sarl', 'ndlr',
]);

/** Mots dont le doublement est légitime en français. */
const DOUBLONS_LEGITIMES = new Set(['nous', 'vous', 'très', 'tres']);

function fabriquer(candidat) {
  const { debut, fin, avant, apres, type, explication, categorie, source } = candidat;
  return {
    id: `cor_${type}_${debut}_${hachage(`${avant}>${apres}`)}`,
    position: { debut, fin },
    avant,
    apres,
    type,
    categorie: categorie ?? CATEGORIE_FAUTE,
    explication,
    source: source ?? 'regles_locales',
    confiance: candidat.confiance ?? (source === 'modele' ? 0.7 : 0.95),
  };
}

/**
 * Passe DÉTERMINISTE. Aucun réseau, aucune dépendance : c'est aussi le seul
 * correcteur disponible en mode contrôle libre et quand le modèle est injoignable.
 *
 * @param {string} texte
 * @param {{ langue?: string, termesProteges?: string[] }} [opts]
 * @returns {{ corrections: object[], suggestionsStyle: object[], rejets: object[] }}
 */
export function corrigerLocal(texte, opts = {}) {
  const src = String(texte ?? '');
  const langue = String(opts.langue ?? 'fr').toLowerCase();
  const francais = langue.startsWith('fr');
  const zones = zonesProtegees(src, { termesProteges: opts.termesProteges, inclureNomsPropres: false });
  const rejets = [];
  const retenus = [];
  const pris = [];

  /** Bornes + zones protégées. Ne juge PAS le chevauchement (la majuscule fusionne). */
  const recevable = (c) => {
    if (c.debut < 0 || c.fin > src.length || c.fin <= c.debut) return false;
    if (chevauche(zones, c.debut, c.fin)) {
      rejets.push({ avant: c.avant, apres: c.apres, raison: 'zone_protegee', source: 'regles_locales' });
      return false;
    }
    return true;
  };

  const poser = (c) => {
    if (!recevable(c)) return;
    if (chevauche(pris, c.debut, c.fin)) return; // une seule correction par empan
    pris.push([c.debut, c.fin]);
    retenus.push(c);
  };

  /* — Lexique fermé de fautes connues — */
  if (francais) {
    for (const entree of LEXIQUE_FAUTES) {
      const re = motifLexique(entree.faute);
      let m = re.exec(src);
      while (m) {
        const trouve = m[0];
        // La casse d'origine est conservée : « Malgrés » → « Malgré », pas « malgré ».
        const juste =
          trouve[0] === trouve[0].toUpperCase() && trouve[0] !== trouve[0].toLowerCase()
            ? entree.juste.charAt(0).toUpperCase() + entree.juste.slice(1)
            : entree.juste;
        poser({
          debut: m.index,
          fin: m.index + trouve.length,
          avant: trouve,
          apres: juste,
          type: entree.type,
          explication: entree.explication,
        });
        m = re.exec(src);
      }
    }
  }

  /* — Espace manquant avant une ponctuation double (usage français) — */
  if (francais) {
    const re = /(?<=[\p{L}\p{N}])([;:!?])/gu;
    let m = re.exec(src);
    while (m) {
      const signe = m[1];
      const suivant = src[m.index + 1] ?? '';
      // « 14:30 », « 3:1 », « http:// » : jamais d'espace ajouté devant un chiffre ou un /.
      const numerique = /[\d/]/.test(suivant);
      if (!numerique) {
        poser({
          debut: m.index,
          fin: m.index + 1,
          avant: signe,
          apres: ` ${signe}`,
          type: 'typographie',
          explication: `En français, une espace précède « ${signe} ».`,
        });
      }
      m = re.exec(src);
    }
  }

  /* — Espace en trop devant une ponctuation simple — */
  {
    const re = /\s+([,.])/g;
    let m = re.exec(src);
    while (m) {
      poser({
        debut: m.index,
        fin: m.index + m[0].length,
        avant: m[0],
        apres: m[1],
        type: 'typographie',
        explication: `Aucune espace ne précède « ${m[1]} ».`,
      });
      m = re.exec(src);
    }
  }

  /* — Espace manquante APRÈS une virgule ou un point-virgule — */
  {
    const re = /([,;])(?=\p{L})/gu;
    let m = re.exec(src);
    while (m) {
      poser({
        debut: m.index,
        fin: m.index + 1,
        avant: m[1],
        apres: `${m[1]} `,
        type: 'ponctuation',
        explication: `Une espace suit « ${m[1]} ».`,
      });
      m = re.exec(src);
    }
  }

  /* — Espaces multiples — */
  {
    const re = /[ \t]{2,}/g;
    let m = re.exec(src);
    while (m) {
      poser({
        debut: m.index,
        fin: m.index + m[0].length,
        avant: m[0],
        apres: ' ',
        type: 'typographie',
        explication: 'Une seule espace entre deux mots.',
      });
      m = re.exec(src);
    }
  }

  /* — Apostrophe droite → apostrophe typographique — */
  if (francais) {
    const re = /(?<=\p{L})'(?=\p{L})/gu;
    let m = re.exec(src);
    while (m) {
      poser({
        debut: m.index,
        fin: m.index + 1,
        avant: "'",
        apres: '’',
        type: 'typographie',
        explication: 'Apostrophe typographique française.',
      });
      m = re.exec(src);
    }
  }

  /* — Mot dupliqué — */
  {
    const re = new RegExp(`${AVANT_MOT}(\\p{L}{2,})([ \\t]+)\\1${APRES_MOT}`, 'giu');
    let m = re.exec(src);
    while (m) {
      const mot = m[1].toLowerCase();
      if (!DOUBLONS_LEGITIMES.has(mot) && !DOUBLONS_LEGITIMES.has(sansAccent(mot))) {
        poser({
          debut: m.index,
          fin: m.index + m[0].length,
          avant: m[0],
          apres: m[1],
          type: 'grammaire',
          explication: `Le mot « ${m[1]} » est écrit deux fois de suite.`,
        });
      }
      m = re.exec(src);
    }
  }

  /* — Majuscule manquante après un point —
     ⚠️ Volontairement limité aux DÉBUTS DE PHRASE INTERNES : le premier caractère
     du bloc n'est pas touché, car un bloc Document est souvent un fragment
     (cellule de tableau, libellé) qui n'a pas à commencer par une majuscule.
     ⚠️ PIÈGE mesuré : quand une autre règle corrige déjà le mot qui suit le point
     (« tout les » → « tous les »), poser une seconde correction sur la même
     lettre la ferait perdre par chevauchement — le texte accepté restait en
     minuscule. On FUSIONNE donc la majuscule dans la correction hôte. */
  const capitales = [];
  {
    const re = /([.!?])([ \t]+)(\p{Ll})/gu;
    let m = re.exec(src);
    while (m) {
      const avantPoint = src.slice(0, m.index);
      const dernierMot = (avantPoint.match(/([\p{L}\p{N}]+)$/u) || [])[1] ?? '';
      const estAbrev = ABREVIATIONS.has(sansAccent(dernierMot).toLowerCase());
      const estChiffre = /\d$/.test(dernierMot);
      const suspension = src.slice(Math.max(0, m.index - 2), m.index + 1) === '...';
      if (!estAbrev && !estChiffre && !suspension) {
        const debut = m.index + m[1].length + m[2].length;
        const c = {
          debut,
          fin: debut + m[3].length,
          avant: m[3],
          apres: m[3].toUpperCase(),
          type: 'typographie',
          explication: 'Une phrase commence par une majuscule.',
        };
        if (recevable(c)) capitales.push(c);
      }
      m = re.exec(src);
    }
  }

  for (const cap of capitales) {
    const hote = retenus.find((c) => c.debut === cap.debut);
    if (!hote) {
      poser(cap);
      continue;
    }
    const premiere = hote.apres.charAt(0);
    if (premiere && premiere === premiere.toLowerCase() && premiere !== premiere.toUpperCase()) {
      hote.apres = premiere.toUpperCase() + hote.apres.slice(1);
      hote.explication = `${hote.explication} Et une phrase commence par une majuscule.`;
    }
  }

  const corrections = retenus
    .sort((a, b) => a.debut - b.debut)
    .map((c) => fabriquer(c));
  return { corrections, suggestionsStyle: [], rejets };
}

/* ══════════════════════════════════════════════════════════════════
   5. PROPOSITIONS DU MODÈLE — filtrage sévère
══════════════════════════════════════════════════════════════════ */

/**
 * Prompt de correction. Exporté pour être inspectable et testable.
 * @param {string} texte
 * @param {{ langue?: string, registre?: string, termesProteges?: string[] }} [opts]
 */
export function construirePromptCorrection(texte, opts = {}) {
  const langue = String(opts.langue ?? 'fr');
  const registre = String(opts.registre ?? 'administratif');
  const proteges = (Array.isArray(opts.termesProteges) ? opts.termesProteges : [])
    .map((t) => String(t ?? '').trim())
    .filter(Boolean)
    .slice(0, 40);

  return `Tu es correcteur orthographique et grammatical. Langue du texte : ${langue}. Registre : ${registre}.

Texte à corriger (ne le réécris pas) :
"""${String(texte ?? '').slice(0, 6000)}"""

Relève UNIQUEMENT les FAUTES : orthographe, grammaire, accord, typographie, ponctuation.
Règles impératives :
- Une correction ne change JAMAIS le sens, ni un chiffre, ni une date, ni un montant, ni une négation.
- Ne touche PAS aux noms propres, raisons sociales, sigles, références, adresses e-mail, URL, ni aux passages entre crochets [ ].${proteges.length ? `\n- Termes à ne jamais corriger : ${proteges.join(', ')}.` : ''}
- Ce qui relève du STYLE (mot plus élégant, phrase plus courte, ton) n'est PAS une faute : ne le propose pas.
- « avant » doit être la chaîne EXACTE telle qu'elle apparaît dans le texte, la plus courte possible (un mot ou un groupe de deux ou trois mots).
- Si le texte est correct, rends une liste vide.

Réponds UNIQUEMENT par un objet JSON valide. Aucun texte avant, aucun texte après, aucun bloc de code.
Schéma : {"corrections":[{"avant":"malgrés","apres":"malgré","type":"orthographe","explication":"…","contexte":"quelques mots autour"}]}`;
}

/**
 * Extracteur JSON minimal — le module reste sans dépendance (cf. contrainte 3).
 *
 * ⛔ PIÈGE MESURÉ sur un vrai appel Mistral : l'injecteur peut rendre `{provider, text}`,
 *    `{provider, json}` ou une chaîne brute. La première version rendait l'objet tel
 *    quel dans le cas `{text}` — `json.corrections` était `undefined`, et les
 *    7 corrections réellement produites par le modèle disparaissaient SANS un seul
 *    rejet affiché. Toute forme non reconnue LÈVE désormais, ce qui bascule
 *    `corriger()` en résultat dégradé visible.
 */
export function lireJson(brut) {
  if (brut && typeof brut === 'object') {
    if (Array.isArray(brut.corrections)) return brut;
    if (brut.json && typeof brut.json === 'object') return lireJson(brut.json);
    if (typeof brut.text === 'string') return lireJson(brut.text);
    if (typeof brut.content === 'string') return lireJson(brut.content);
    if ('corrections' in brut) return { corrections: [] }; // clé présente mais vide/nulle
    throw new Error('Réponse du modèle de forme inattendue (aucune liste « corrections »)');
  }
  const texte = String(brut ?? '')
    .replace(/^```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim();
  const debut = texte.indexOf('{');
  const fin = texte.lastIndexOf('}');
  if (debut < 0 || fin <= debut) throw new Error('Réponse sans JSON');
  return JSON.parse(texte.slice(debut, fin + 1));
}

/**
 * Relocalise `avant` dans le texte. Le modèle ment sur les positions : on cherche
 * nous-mêmes, en s'aidant du `contexte` qu'il fournit pour lever les ambiguïtés.
 *
 * ⛔ PIÈGE MESURÉ (mistral-large-latest) : le modèle a proposé « tout » → « Tous »
 *    avec le contexte « tout les justificatifs ». Cette place étant déjà prise par
 *    une règle locale, la version précédente repliait sur la PREMIÈRE autre
 *    occurrence de « tout » — celle de « malgré tout », un adverbe correct. Une
 *    correction juste devenait une faute posée au mauvais endroit.
 *    Désormais : quand le contexte désigne une place, c'est celle-là ou rien.
 *
 * @returns {number} index, ou -1
 */
function localiser(src, avant, contexte, dejaPris) {
  if (!avant) return -1;
  const ctx = String(contexte ?? '').trim();
  if (ctx) {
    const posCtx = src.indexOf(ctx);
    const dansCtx = posCtx >= 0 ? ctx.indexOf(avant) : -1;
    if (dansCtx >= 0) {
      const pos = posCtx + dansCtx;
      return chevauche(dejaPris, pos, pos + avant.length) ? -1 : pos;
    }
    // Contexte introuvable (le modèle l'a reformulé) : on retombe sur la recherche simple.
  }
  let i = src.indexOf(avant);
  while (i >= 0) {
    if (!chevauche(dejaPris, i, i + avant.length)) return i;
    i = src.indexOf(avant, i + 1);
  }
  return -1;
}

/**
 * Lit UNE proposition du modèle en tolérant les clés accentuées.
 *
 * ⛔ PIÈGE MESURÉ (mistral-large-latest, 3 appels sur 3, 2026-08-06) : le modèle
 *    respecte le schéma mais écrit `"après"` au lieu de `"apres"`. La lecture par
 *    `p.apres` rendait alors '' pour CHAQUE proposition : les 6 corrections justes
 *    (« document » → « documents », « il on été » → « ils ont été »…) étaient
 *    reclassées en « suppression de style » et l'écran annonçait zéro faute sur une
 *    phrase qui en comptait six. Aucune erreur, aucun rejet : une perte SILENCIEUSE.
 *    `mistral-small-latest` (le modèle réellement routé pour cette tâche) écrit
 *    `"apres"` — c'est bien un piège de dérive, pas un défaut de prompt.
 *
 * ⛔ `absent` distingue « le modèle a proposé une suppression » (clé présente, valeur
 *    vide) de « la clé n'existe pas » (dérive de schéma). Le second est REJETÉ avec
 *    sa raison, jamais avalé comme une suppression volontaire.
 *
 * @param {any} p
 * @returns {{avant:string, apres:string, absent:boolean, type:string, explication:string, contexte:string}}
 */
export function lireProposition(p) {
  const o = p && typeof p === 'object' ? p : {};
  const cle = (...noms) => noms.find((n) => n in o) ?? null;
  const cleApres = cle('apres', 'après', 'apres_correction', 'correction', 'remplacement');
  const cleAvant = cle('avant', 'origine', 'original');
  return {
    avant: String(o[cleAvant] ?? '').trim(),
    apres: String(o[cleApres] ?? ''),
    absent: cleApres === null,
    type: String(o.type ?? o.categorie ?? ''),
    explication: String(o.explication ?? o.raison ?? '').trim(),
    contexte: String(o.contexte ?? o.context ?? ''),
  };
}

/**
 * Type de correction demandé par le modèle, ramené à la nomenclature du module.
 * ⚠️ Les modèles rendent des types composés (« orthographe et accord ») : on retient
 * le PREMIER type connu qu'ils citent plutôt que de tout ramener à « orthographe ».
 * @param {string} brut
 * @returns {string|null} identifiant connu, ou null
 */
export function typeConnu(brut) {
  const s = sansAccent(String(brut ?? '')).toLowerCase();
  if (!s) return null;
  if (TYPES_CORRECTION[s]) return s;
  for (const mot of s.split(/[^a-z]+/).filter(Boolean)) {
    const trouve = TYPES_CORRECTION_IDS.find((id) => sansAccent(id) === mot);
    if (trouve) return trouve;
  }
  return null;
}

/**
 * Trie une proposition du modèle : faute, suggestion de style, ou rejet.
 * ⛔ C'est ici que vit la frontière « correction » / « réécriture ». Une correction
 *    est LOCALE et conserve le sens ; tout le reste bascule en suggestion de style
 *    (ou est rejeté si le sens, un chiffre ou une négation bouge).
 * @returns {{ verdict: 'faute'|'style'|'rejet', raison?: string, type: string }}
 */
export function classerProposition(avant, apres, typeDemande) {
  const a = String(avant ?? '');
  const b = String(apres ?? '');
  const type = typeConnu(typeDemande) ?? 'orthographe';

  if (!a) return { verdict: 'rejet', raison: 'avant_vide', type };
  if (a === b) return { verdict: 'rejet', raison: 'identique', type };
  if (chiffresDe(a) !== chiffresDe(b)) return { verdict: 'rejet', raison: 'chiffre_modifie', type };
  if (!memesNegations(a, b)) return { verdict: 'rejet', raison: 'sens_modifie', type };

  // Même empreinte = accents, casse, apostrophe, espaces : faute typographique certaine.
  if (empreinte(a) === empreinte(b)) return { verdict: 'faute', type };

  const motsAvant = motsDe(a).length;
  if (motsAvant > 6) return { verdict: 'style', raison: 'empan_trop_large', type };

  const d = distanceEdition(a.toLowerCase(), b.toLowerCase());
  const seuil = Math.max(3, Math.round(a.length * 0.5));
  if (d > seuil) return { verdict: 'style', raison: 'reecriture', type };

  // Suppression pure d'un mot porteur de sens : c'est du style, sauf doublon.
  if (!b.trim()) {
    const motsA = motsDe(a);
    const doublon = motsA.length === 2 && motsA[0].toLowerCase() === motsA[1].toLowerCase();
    if (!doublon) return { verdict: 'style', raison: 'suppression', type };
  }

  return { verdict: 'faute', type };
}

/* ══════════════════════════════════════════════════════════════════
   6. POINT D'ENTRÉE — corriger()
══════════════════════════════════════════════════════════════════ */

/**
 * Relève les fautes d'un texte.
 *
 * @param {string} texte
 * @param {object} [opts]
 * @param {string} [opts.langue='fr']
 * @param {string} [opts.registre='administratif']
 * @param {string[]} [opts.termesProteges] noms de l'entreprise, sigles métier…
 * @param {(p:{prompt:string,tache:string,poids:string}) => Promise<any>} [opts.appelModele]
 *        Injection du modèle. ABSENT ⇒ correction locale seule, aucun réseau.
 * @param {number} [opts.maxCorrections=60]
 * @returns {Promise<{ok:boolean, texte:string, langue:string, registre:string, source:string,
 *   corrections:object[], suggestionsStyle:object[], rejets:object[],
 *   degrade?:boolean, degradeMessage?:string, provider?:string|null}>}
 */
export async function corriger(texte, opts = {}) {
  const src = String(texte ?? '');
  const langue = String(opts.langue ?? 'fr');
  const registre = String(opts.registre ?? 'administratif');
  const maxCorrections = Math.max(1, Math.min(200, opts.maxCorrections ?? 60));

  if (!src.trim()) {
    return {
      ok: true, texte: src, langue, registre, source: 'aucun',
      corrections: [], suggestionsStyle: [], rejets: [],
    };
  }

  const local = corrigerLocal(src, { langue, termesProteges: opts.termesProteges });
  const corrections = [...local.corrections];
  const suggestionsStyle = [...local.suggestionsStyle];
  const rejets = [...local.rejets];
  const pris = corrections.map((c) => [c.position.debut, c.position.fin]);

  if (typeof opts.appelModele !== 'function') {
    return {
      ok: true, texte: src, langue, registre, source: 'local',
      corrections: corrections.slice(0, maxCorrections), suggestionsStyle, rejets,
    };
  }

  const zonesModele = zonesProtegees(src, {
    termesProteges: opts.termesProteges,
    inclureNomsPropres: true,
  });

  let provider = null;
  try {
    const reponse = await opts.appelModele({
      prompt: construirePromptCorrection(src, { langue, registre, termesProteges: opts.termesProteges }),
      tache: 'corriger_fautes',
      poids: 'court',
    });
    provider = (reponse && typeof reponse === 'object' && reponse.provider) || null;
    const json = lireJson(reponse);
    const brutes = Array.isArray(json?.corrections) ? json.corrections : [];

    for (const brut of brutes) {
      const { avant, apres, absent, type: typeBrut, explication, contexte } = lireProposition(brut);
      // Dérive de schéma : DITE, jamais confondue avec une suppression volontaire.
      if (absent && avant) {
        rejets.push({ avant, apres: '', raison: 'apres_absent', source: 'modele' });
        continue;
      }
      const verdict = classerProposition(avant, apres, typeBrut);
      if (verdict.verdict === 'rejet') {
        rejets.push({ avant, apres, raison: verdict.raison, source: 'modele' });
        continue;
      }
      const pos = localiser(src, avant, contexte, pris);
      if (pos < 0) {
        // Distinguer les deux cas : la chaîne n'existe pas (hallucination) ou
        // elle est déjà couverte par une règle locale (doublon, pas une faute du modèle).
        const raison = src.includes(avant) ? 'doublon' : 'introuvable';
        rejets.push({ avant, apres, raison, source: 'modele' });
        continue;
      }
      const fin = pos + avant.length;
      if (chevauche(zonesModele, pos, fin)) {
        rejets.push({ avant, apres, raison: 'zone_protegee', source: 'modele' });
        continue;
      }
      pris.push([pos, fin]);
      const item = fabriquer({
        debut: pos,
        fin,
        avant,
        apres,
        type: verdict.type,
        explication: explication || TYPES_CORRECTION[verdict.type].desc,
        categorie: verdict.verdict === 'style' ? CATEGORIE_STYLE : CATEGORIE_FAUTE,
        source: 'modele',
      });
      if (verdict.verdict === 'style') {
        item.raisonStyle = verdict.raison ?? null;
        suggestionsStyle.push(item);
      } else {
        corrections.push(item);
      }
    }
  } catch (e) {
    corrections.sort((a, b) => a.position.debut - b.position.debut);
    return {
      ok: true, texte: src, langue, registre, source: 'local',
      corrections: corrections.slice(0, maxCorrections), suggestionsStyle, rejets,
      degrade: true,
      degradeMessage: e?.message ?? 'Modèle injoignable',
    };
  }

  corrections.sort((a, b) => a.position.debut - b.position.debut);
  suggestionsStyle.sort((a, b) => a.position.debut - b.position.debut);
  return {
    ok: true, texte: src, langue, registre, source: 'local+modele', provider,
    corrections: corrections.slice(0, maxCorrections),
    suggestionsStyle: suggestionsStyle.slice(0, maxCorrections),
    rejets,
  };
}

/* ══════════════════════════════════════════════════════════════════
   7. APPLICATION — accepter / refuser une par une
══════════════════════════════════════════════════════════════════ */

/**
 * Applique les corrections ACCEPTÉES.
 *
 * ⛔ Application de la FIN vers le DÉBUT : sinon la première substitution décale
 *    toutes les positions suivantes (piège classique).
 * ⛔ Chaque correction est revérifiée contre le texte (`avant` doit encore être là) :
 *    si l'utilisateur a édité entre-temps, la correction est ignorée, pas appliquée
 *    au mauvais endroit.
 *
 * @param {string} texte
 * @param {object[]} corrections
 * @param {string[]|null} [idsAcceptes] null ⇒ toutes
 * @returns {{ texte: string, appliquees: string[], ignorees: Array<{id:string, raison:string}> }}
 */
export function appliquerCorrections(texte, corrections, idsAcceptes = null) {
  let sortie = String(texte ?? '');
  const liste = Array.isArray(corrections) ? corrections : [];
  const filtre = idsAcceptes === null ? liste : liste.filter((c) => idsAcceptes.includes(c?.id));
  const ordonnees = [...filtre].sort((a, b) => (b?.position?.debut ?? 0) - (a?.position?.debut ?? 0));

  const appliquees = [];
  const ignorees = [];
  const dejaTouche = [];

  for (const c of ordonnees) {
    const debut = c?.position?.debut;
    const fin = c?.position?.fin;
    if (!Number.isInteger(debut) || !Number.isInteger(fin) || fin > sortie.length || fin <= debut) {
      ignorees.push({ id: c?.id ?? null, raison: 'position_invalide' });
      continue;
    }
    if (sortie.slice(debut, fin) !== c.avant) {
      ignorees.push({ id: c.id, raison: 'texte_modifie' });
      continue;
    }
    if (chevauche(dejaTouche, debut, fin)) {
      ignorees.push({ id: c.id, raison: 'chevauchement' });
      continue;
    }
    sortie = sortie.slice(0, debut) + c.apres + sortie.slice(fin);
    dejaTouche.push([debut, fin]);
    appliquees.push(c.id);
  }

  return { texte: sortie, appliquees: appliquees.reverse(), ignorees };
}

/** Compte par type — pour le bandeau de l'interface. */
export function resumerCorrections(resultat) {
  const parType = Object.fromEntries(TYPES_CORRECTION_IDS.map((t) => [t, 0]));
  for (const c of resultat?.corrections ?? []) {
    if (parType[c.type] !== undefined) parType[c.type] += 1;
  }
  return {
    fautes: resultat?.corrections?.length ?? 0,
    style: resultat?.suggestionsStyle?.length ?? 0,
    rejets: resultat?.rejets?.length ?? 0,
    parType,
  };
}
