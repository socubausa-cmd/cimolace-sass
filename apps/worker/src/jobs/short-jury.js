/**
 * short-jury — LE CONTRÔLE DE SORTIE DES EXTRAITS.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI CE MODULE EXISTE, ET POURQUOI IL NE SAIT QUE DIRE NON
 * ════════════════════════════════════════════════════════════════════════════
 * Un audit contradictoire des 5 extraits produits pour le replay du 11 avril 2026
 * les a tous refusés. Deux d'entre eux n'étaient pas RÉPARABLES :
 *   · l'extrait 4 posait une question dont la réponse commençait APRÈS sa fin, et
 *     s'achevait sur « je vous entends pas… Micro est coupé » ;
 *   · l'extrait 5 tenait 7 s de très bon puis 19 s de logistique de fin de séance
 *     (« demain il y a les teneurs ici là… il prend le live »), soit 73 % du clip.
 * Pour ceux-là, la bonne sortie n'est pas un meilleur découpage : c'est le REFUS.
 *
 * ⭐ L'ASYMÉTRIE EST LE CŒUR DU DISPOSITIF. Le jury ne peut que RETRANCHER. Il ne
 * crée aucun extrait, n'en allonge aucun, n'en réécrit aucun titre. La décision
 * finale vaut `mécanique.ok ET modèle.publiable`. Un juge qui ne peut que
 * soustraire ne peut pas halluciner un clip dans l'existence — c'est la seule
 * garantie qui tienne face à un modèle, et elle est structurelle, pas déclarative.
 *
 * ⚠️ TROIS RÈGLES MÉCANIQUES SEULEMENT, ET CHACUNE REPOSE SUR UNE MESURE. La
 * tentation était d'en écrire neuf (ouverture orpheline, ordinal orphelin, absence
 * de charge, charabia, hors-cadre…). Elles ont été écartées : soit elles sont déjà
 * traitées structurellement en amont (l'ouverture, par le contrat de citation et la
 * frontière de phrase), soit elles ne se déclenchaient que sur CE replay-ci, soit
 * elles auraient censuré le sujet même de l'école. Une règle qui ne se vérifie pas
 * sur un autre corpus n'est pas une règle, c'est un souvenir.
 */

/**
 * Marqueurs de logistique — ce qui n'appartient pas au cours mais à la séance.
 *
 * ⚠️ CETTE LISTE EST UN DÉFAUT, PAS UNE VÉRITÉ. Elle sert de repli quand l'école
 * n'a rien déclaré. Codée en dur et appliquée sans nuance, une telle liste devient
 * un censeur du sujet même de l'école : « le live » est de l'intendance chez un
 * formateur et un thème chez un autre. D'où deux garde-fous :
 *   · elle ne mord que dans les DERNIÈRES SECONDES d'un extrait — un mot
 *     d'intendance au milieu d'un propos n'est pas un motif de refus ;
 *   · l'école peut la remplacer entièrement (`opts.lexique`).
 */
export const LOGISTIQUE_PAR_DEFAUT = [
  'micro est coupé', 'micro coupé', 'vous m\'entendez', 'tu m\'entends', 'je vous entends pas',
  'partage mon écran', 'vous voyez mon écran', 'on enregistre',
  'à demain', 'à la prochaine', 'bonne soirée', 'bonne journée', 'au revoir',
  'la semaine prochaine', 'le lien', 'je vous envoie', 'inscrivez-vous',
  'prend le live', 'coupe le live', 'on arrête l\'enregistrement',
];

/** Fenêtre de fin sur laquelle la règle de logistique s'applique, en secondes. */
const FENETRE_FIN_SEC = 6;

const nu = (s) => String(s || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Les nombres d'un texte, chiffres ET lettres, pour la règle du titre. */
const NOMBRES_EN_LETTRES = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8,
  neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15,
  vingt: 20, trente: 30, quarante: 40, cinquante: 50, cent: 100, mille: 1000,
  premier: 1, premiere: 1, deuxieme: 2, troisieme: 3, quatrieme: 4, cinquieme: 5,
};
function nombresDe(texte) {
  const t = nu(texte);
  const trouves = new Set();
  for (const m of t.match(/\d+/g) || []) trouves.add(Number(m));
  for (const mot of t.split(/[^a-z]+/)) {
    if (NOMBRES_EN_LETTRES[mot] !== undefined) trouves.add(NOMBRES_EN_LETTRES[mot]);
    // « 5e », « 5ᵉ », « 2nd » : le chiffre est déjà pris par la regex ci-dessus.
  }
  return trouves;
}

/**
 * LES TROIS RÈGLES MÉCANIQUES. Rend `{ ok, refus: [{code, detail}] }`.
 *
 * `unites` = les cartons de sous-titre RÉELLEMENT affichés, avec leurs bornes
 * relatives. On juge ce qui sera à l'écran, jamais un texte parallèle.
 */
export function reglesMecaniques({ unites, titre, duree, lexique = LOGISTIQUE_PAR_DEFAUT }) {
  const refus = [];
  const cartons = Array.isArray(unites) ? unites : [];
  const texteFinal = cartons.map((u) => u.texte).join(' ').trim();

  // ── 1. FIN_LOGISTIQUE ────────────────────────────────────────────────────
  // Ce que le spectateur entend en DERNIER décide de ce qu'il retient. L'extrait 5
  // ouvrait sur « Que le serpent brise les côtes… » et fermait sur « il prend le
  // live » : la seule chose qu'on emporte est la seconde.
  const seuilFin = Math.max(0, (Number(duree) || 0) - FENETRE_FIN_SEC);
  const queue = nu(cartons.filter((u) => u.fin > seuilFin).map((u) => u.texte).join(' '));
  const marqueur = lexique.find((m) => queue.includes(nu(m)));
  if (marqueur) {
    refus.push({
      code: 'FIN_LOGISTIQUE',
      detail: `les ${FENETRE_FIN_SEC} dernières secondes contiennent « ${marqueur} » — c'est la dernière chose que le spectateur entend`,
    });
  }

  // ── 2. QUESTION_SANS_REPONSE ─────────────────────────────────────────────
  // Aucun lexique requis : c'est une propriété de la ponctuation finale. L'extrait
  // 4 posait « …la prière prend fin ce moment ou qu'est-ce qu'on fait ? » et
  // s'arrêtait là — la réponse commençait 5 s après la fin du clip.
  const dernier = cartons.length ? String(cartons[cartons.length - 1].texte).trim() : '';
  if (/\?\s*$/.test(dernier)) {
    refus.push({
      code: 'QUESTION_SANS_REPONSE',
      detail: `l'extrait se termine sur une question (« …${dernier.slice(-60)} ») dont la réponse est hors bornes`,
    });
  }

  // ── 3. TITRE_NON_TENU ────────────────────────────────────────────────────
  // ⭐ LA RÈGLE DES NOMBRES est celle qui aurait attrapé « La femme aux neuf
  // femelles et ses 900 ENFANTS » : le « 900 » était prononcé APRÈS la borne de
  // sortie. Un titre promet ; le clip doit tenir la promesse dans ses propres
  // bornes.
  const nombresTitre = nombresDe(titre);
  const nombresTexte = nombresDe(texteFinal);
  const manquants = [...nombresTitre].filter((n) => !nombresTexte.has(n));
  if (titre && manquants.length) {
    refus.push({
      code: 'TITRE_NON_TENU',
      detail: `le titre annonce ${manquants.join(', ')} — absent du texte réellement contenu dans l'extrait`,
    });
  }

  return { ok: refus.length === 0, refus, texteFinal };
}

/**
 * LE JUGE MODÈLE — un seul appel, tous les survivants d'un coup.
 *
 * ⭐ IL NE VOIT QUE LE TEXTE FINAL ET LE TITRE. Ni le contexte d'avant, ni celui
 * d'après, ni les horodatages, ni la raison invoquée à la sélection. C'est
 * délibéré : on simule L'INCONNU QUI TOMBE DESSUS DANS SON FIL, on ne re-simule pas
 * le professeur qui sait déjà de quoi il parle. Un juge qui voit le contexte
 * comprend toujours l'extrait — et valide donc toujours.
 *
 * `appelModele(messages, opts)` est injecté par l'appelant : ce module ne connaît
 * ni fournisseur, ni clé, ni modèle. Il reste testable hors ligne.
 */
export async function jugerParLeSens({ candidats, appelModele, journal = console, budgetMs = 60000 }) {
  const verdicts = new Map();
  if (!candidats.length || typeof appelModele !== 'function') {
    // Pas de juge disponible → on ne refuse RIEN. L'asymétrie joue dans les deux
    // sens : un jury absent ne doit jamais bloquer une fabrication.
    for (const c of candidats) verdicts.set(c.id, { publiable: true, motif: 'jury indisponible' });
    return verdicts;
  }

  const consigne = `Tu es quelqu'un qui fait défiler un fil de vidéos courtes. Tu ne connais RIEN
au sujet, tu n'as pas vu ce qui précède, tu ne verras pas ce qui suit. Tu réponds en JSON strict.`;

  const demande = `Voici ${candidats.length} extrait(s) de vidéo verticale. Pour CHACUN, tu ne vois que son
titre et la TOTALITÉ du texte qui s'affiche à l'écran, du premier au dernier carton.

Pour chacun, réponds à trois questions, et à rien d'autre :
1. La première seconde est-elle compréhensible pour toi ? (tu n'as aucun contexte)
2. L'extrait se termine-t-il sur quelque chose de fermé — une idée achevée, une chute —
   ou te laisse-t-il en plan ?
3. Y a-t-il, dans ce texte, quelqu'un ou quelque chose de NOMMÉ, qui te dise de qui ou de
   quoi on parle ?

⛔ TON SEUL POUVOIR EST DE REFUSER. Tu ne proposes pas de meilleures bornes, tu ne
réécris aucun titre, tu ne suggères aucun découpage. Tu dis publiable, ou tu dis pourquoi
tu ne le publierais pas.
⭐ ET TU N'ES PAS LÀ POUR AIMER LE SUJET. Une école ésotérique, un cours de comptabilité,
un sermon : ce n'est pas ton affaire. La seule question est : « est-ce que ce clip se tient
tout seul ? » Un contenu déroutant mais cohérent est PUBLIABLE.

${candidats.map((c, i) => `━━━ EXTRAIT ${i + 1} ━━━
titre : ${c.titre || '(sans titre)'}
texte à l'écran : ${c.texteFinal}`).join('\n\n')}

JSON attendu, strictement :
{"verdicts":[{"n":1,"publiable":true,"motif":"","premiere_seconde_comprehensible":true,"chute":true,"referent_present":true}]}`;

  try {
    const brut = await appelModele(
      [{ role: 'system', content: consigne }, { role: 'user', content: demande }],
      { budgetMs },
    );
    const liste = Array.isArray(brut?.verdicts) ? brut.verdicts : [];
    for (const v of liste) {
      const idx = Number(v?.n) - 1;
      if (!Number.isInteger(idx) || idx < 0 || idx >= candidats.length) continue;
      verdicts.set(candidats[idx].id, {
        publiable: v?.publiable !== false,
        motif: String(v?.motif || '').slice(0, 200),
        premiereSeconde: v?.premiere_seconde_comprehensible !== false,
        chute: v?.chute !== false,
        referent: v?.referent_present !== false,
      });
    }
    // ⚠️ UN CANDIDAT NON JUGÉ EST PUBLIABLE, PAS REFUSÉ. Le modèle peut avoir
    // tronqué sa liste ; interpréter un silence comme un refus ferait disparaître
    // des extraits corrects sur un défaut de réponse, et personne ne saurait
    // pourquoi le moteur en livre soudain trois au lieu de cinq.
    for (const c of candidats) {
      if (!verdicts.has(c.id)) verdicts.set(c.id, { publiable: true, motif: 'non jugé' });
    }
  } catch (e) {
    journal.warn?.(`[short-jury] juge indisponible (${e.message}) — aucun refus prononcé`);
    for (const c of candidats) verdicts.set(c.id, { publiable: true, motif: 'jury en échec' });
  }
  return verdicts;
}

/**
 * Le contrôle complet. Rend `{ gardes, refuses }`.
 * `refuses` porte de quoi l'AFFICHER au créateur : un refus muet est un refus
 * qu'on ne peut pas corriger.
 */
export async function controlerSortie({ extraits, appelModele = null, lexique, journal = console }) {
  const mecanique = new Map();
  const survivants = [];
  const refuses = [];

  for (const e of extraits) {
    const r = reglesMecaniques({
      unites: e.unites, titre: e.titre, duree: e.end - e.start, lexique,
    });
    mecanique.set(e, r);
    if (r.ok) survivants.push(e);
    else {
      refuses.push({
        start: e.start, end: e.end, titre: e.titre,
        code: r.refus[0].code,
        detail: r.refus.map((x) => x.detail).join(' · '),
        extrait_texte: r.texteFinal.slice(0, 300),
      });
    }
  }

  if (survivants.length === 0) return { gardes: [], refuses };

  const candidats = survivants.map((e, i) => ({
    id: i, titre: e.titre, texteFinal: mecanique.get(e).texteFinal,
  }));
  const verdicts = await jugerParLeSens({ candidats, appelModele, journal });

  const gardes = [];
  survivants.forEach((e, i) => {
    const v = verdicts.get(i);
    if (v?.publiable !== false) { gardes.push(e); return; }
    refuses.push({
      start: e.start, end: e.end, titre: e.titre,
      code: 'JURY',
      detail: v.motif || 'le juge ne le publierait pas',
      extrait_texte: mecanique.get(e).texteFinal.slice(0, 300),
    });
  });

  return { gardes, refuses };
}
