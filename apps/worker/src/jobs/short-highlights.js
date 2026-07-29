/**
 * short-highlights.js — CHOISIR LES MOMENTS D'UN REPLAY QUI MÉRITENT UN EXTRAIT.
 *
 * ─── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 * `detectHighlightMoments()` (short-generator.js) prétendait détecter des « moments
 * forts ». Son critère réel : « le segment fait plus de 20 caractères ». Mesuré sur
 * le replay « Réunion Zoom de L'arbre du Manikongo » (20 min 57, 57 cues) : 96 % des
 * segments passaient le test et 13 des 14 candidats naissaient du simple dépassement
 * de 60 s. Ce n'était pas un détecteur, c'était un découpeur régulier.
 *
 * Conséquence à l'écran, vérifiée : « Extrait 1 » = les 60 premières secondes, soit
 * un TABLEAU BLANC VIDE (gabarit Zoom « Ajouter un texte ») sur la phrase « Ok, là,
 * je pense qu'on enregistre bien sur le Clad », avec 60 % de silence dont 9,7 s de
 * silence PUR à la fin. Pendant ce temps, « Je suis Cheo, cinquième Manikongo, fils
 * de Kimpa Vita » (t = 653) n'était pas retenu.
 *
 * C'est le MÊME problème que le chapitrage sémantique, résolu de la même façon :
 * une règle mécanique ne trouve pas de SENS. On demande donc au modèle QUELS
 * passages accrochent — voir apps/api/src/masterclass-factory/replay-chapters.service.ts,
 * dont ce module reprend la méthode (blocs horodatés → tranches avec recouvrement →
 * MAP → validation dure côté serveur).
 *
 * ─── DEUX DIFFÉRENCES ASSUMÉES AVEC LE CHAPITRAGE ────────────────────────────
 * 1. PAS DE REDUCE PAR LE MODÈLE. Le chapitrage doit COUVRIR toute la durée : il lui
 *    faut un arbitre capable de fusionner et de hiérarchiser en prose. Ici on veut le
 *    CLASSEMENT des 5 meilleurs moments, et le modèle donne déjà, pour chaque
 *    candidat, une note d'accroche. L'arbitrage entre tranches se fait donc sur des
 *    critères que le modèle ne peut PAS juger (silence, image vide) : un second
 *    appel n'y apporterait rien et coûterait une minute de mur (mesuré sur le
 *    chapitrage : deux appels `pro` stériles avant d'aboutir).
 * 2. LE MODÈLE PRODUIT PLUS DE CANDIDATS QU'IL N'EN FAUT. C'est ce qui donne au
 *    garde-fou de quoi REMPLACER un passage qu'il écarte, au lieu de devoir choisir
 *    entre « publier un extrait muet » et « ne rien publier ».
 *    ⚠️ MAIS ÉLEVER UN PLAFOND N'EST PAS SUR-PRODUIRE — mesuré : demander « jusqu'à 10 »
 *    sur l'unique tranche du replay de référence en rendait 5, dont 3 écartés. La marge
 *    réelle vient de la RELANCE ciblée (`demanderAuModele`), qui redemande en listant ce
 *    qui est DÉJÀ PRIS. Voir aussi `MAX_EXTRAITS` : c'est un plafond, pas une promesse.
 *
 * ─── CE QUE LE SERVEUR VÉRIFIE DU TRAVAIL DU MODÈLE ──────────────────────────
 * Les bornes ET le TITRE. Un titre halluciné a déjà traversé toute la chaîne (le
 * candidat 224→266 titré « Je suis le cinquième Manikongo » sur un passage qui ne
 * contient pas ces mots) : seul le veto d'image l'a arrêté, par chance. `adequationTitre`
 * exige désormais que le titre soit ANCRÉ dans le texte de sa fenêtre — avec assez de
 * tolérance pour survivre à une transcription fautive, qui est la norme sur les noms
 * propres (« Shao » pour « Cheo », « Kimba » pour « Kimpa »).
 *
 * ─── LE CRITÈRE QUE LE MODÈLE NE PEUT PAS JUGER ──────────────────────────────
 * Il lit du TEXTE. Il ne sait pas qu'entre deux phrases il y a douze secondes de rien,
 * ni que l'écran partagé est un tableau blanc vierge. Un passage à 60 % de silence
 * n'accroche personne, même si la phrase est belle. D'où `mesurerFenetre()` : silence
 * réellement présent dans le signal (silencedetect) et densité visuelle réelle de
 * l'image (voir `mesurerDetail`).
 *
 * OÙ EST PLACÉ CE GARDE-FOU, ET POURQUOI : **APRÈS le choix du modèle**, sur les
 * seules fenêtres retenues.
 *   · Coût. Mesurer TOUT le replay avant le choix, c'est un décodage complet : sur les
 *     replays réels de la Vidéothèque (2 h en moyenne, 14 h au pire) cela occupe le
 *     conteneur worker — celui qui porte aussi les notifs live — pendant des minutes.
 *     Mesurer 15 fenêtres de 60 s coûte quelques secondes (mesuré : ~1,3 s par fenêtre
 *     sur le replay de référence, audio + image).
 *   · Justesse. Le modèle a besoin de TOUT le texte pour trouver du sens ; pré-censurer
 *     la transcription lui cacherait le contexte qui précède un bon moment.
 *   · Autorité. Le veto doit avoir le DERNIER mot, précisément parce que le modèle ne
 *     peut pas entendre le silence.
 * ⛔ UN PRÉ-FILTRE TEXTUEL A ÉTÉ ESSAYÉ PUIS RETIRÉ (voir le bloc (2) de
 * `selectionnerMoments`) : estimer la parole d'après la longueur du texte se trompait
 * de 35 points sur le meilleur passage du replay de référence, parce que c'est
 * justement là que la transcription est la plus lacunaire. Aucune estimation ne
 * remplace une mesure.
 *
 * ─── REPLI ───────────────────────────────────────────────────────────────────
 * `selectionMecanique()` ne dépend d'aucun modèle. Elle reste MÉCANIQUE et est
 * étiquetée comme telle partout (`origine: 'mecanique'`, titres « Extrait N » et non
 * un titre inventé). Elle est tout de même meilleure que l'ancienne détection : elle
 * vise les zones de parole DENSE et passe, elle aussi, sous le garde-fou du signal.
 */

import { spawn } from 'child_process';

// ── Forme des extraits ────────────────────────────────────────────────────────
/** En dessous, ce n'est plus un extrait : on n'a pas le temps d'installer une idée. */
export const DUREE_MIN = 20;
/** Au-delà, ce n'est plus un format court (et la plupart des plateformes coupent). */
export const DUREE_MAX = 60;
/**
 * ⚠️ PLAFOND, PAS PROMESSE. C'est le nombre d'extraits AU PLUS ; le nombre réellement
 * livré dépend de ce que le replay contient. Mesuré sur le replay de référence
 * (20 min 57, 57 cues) : le modèle propose 5 moments, le garde-fou en écarte 3
 * (tableau blanc), il en reste 2. Ce n'est pas une panne, c'est un replay court dont
 * une partie est de l'installation technique. Toute interface qui annonce « 5 extraits »
 * avant d'avoir mesuré ment ; le diagnostic rendu par `selectionnerMoments`
 * (`candidats`, `ecartes`, `titresEcartes`) est là pour dire ce qui s'est passé.
 */
export const MAX_EXTRAITS = 5;
/**
 * Candidats demandés au modèle = MAX_EXTRAITS × ce facteur. C'est la marge de
 * remplacement du garde-fou : sans elle, écarter un passage muet reviendrait à
 * livrer moins d'extraits que promis.
 *
 * ⚠️ CE FACTEUR NE SUFFIT PAS À LUI SEUL. Mesuré : sur un replay court (une seule
 * tranche), il ne fait qu'élever un PLAFOND que le modèle n'atteint pas — on demande
 * « jusqu'à 10 », il en rend 5, et la « sur-production ×3 » est fictive. La vraie marge
 * vient de la RELANCE ciblée (voir `demanderAuModele`), qui redemande explicitement
 * d'AUTRES moments aux tranches les moins productives.
 */
const SUR_PRODUCTION = 3;
/**
 * Deux extraits qui se touchent racontent la même chose : au-delà du simple
 * chevauchement, on impose un écart de départ à départ. 30 s et non 45 : mesuré, un
 * seuil trop large jetait des moments distincts et non chevauchants (338→359 puis
 * 408→429 sur le replay de référence, soit 49 s d'écart et rien en commun).
 */
const ECART_MIN_SEC = 30;

// ── Découpage envoyé au modèle ────────────────────────────────────────────────
/**
 * Blocs de 20 s (le chapitrage en prend 30). Plus fin, parce qu'on ne cherche pas un
 * MOUVEMENT du cours mais une PHRASE : la borne de départ d'un extrait doit tomber sur
 * la phrase qui accroche, pas trente secondes avant.
 */
const FENETRE_BLOC_SEC = 20;
/** Taille visée d'une tranche : ~30 000 car. ≈ 8 500 jetons, une quantité réellement lue. */
const TRANCHE_CAR = 30000;
/** Au-delà, on élargit les tranches plutôt que d'empiler les appels (temps mur + jetons). */
const MAX_TRANCHES = 8;
/** Un bon moment peut chevaucher une couture : les tranches se recouvrent. */
const RECOUVREMENT_SEC = 90;
/**
 * Appels simultanés. 2 et non 3 (chapitrage) : ici on tourne dans le conteneur worker,
 * qui porte aussi la file d'e-mails et les rappels de live. DeepSeek répond par des 429
 * en rafale quand on tape trop fort.
 */
const CONCURRENCE = 2;

// ── Budget des appels ─────────────────────────────────────────────────────────
/**
 * ⭐ PLANCHER MESURÉ, NE PAS BAISSER. Sur du JSON structuré, les modèles v4 renvoient
 * un `content` VIDE — HTTP 200, aucune erreur — quand leur raisonnement interne a
 * absorbé tout le budget. Le chapitrage l'a payé deux fois (vide à 2000, vide encore à
 * 6000). C'est un TROU SILENCIEUX, pas une exception : on journalise chaque retour vide.
 *
 * ⚠️ ET 9000 NE SUFFIT PAS ICI — mesuré, `usage` réel sur la tranche unique du replay
 * de référence (3 492 jetons d'entrée, 8 extraits rendus) :
 *     completion_tokens 8 462, dont reasoning_tokens 7 892.
 * Le RAISONNEMENT à lui seul consomme 93 % du budget ; il ne reste que ~570 jetons pour
 * le JSON. À 9000, une tranche à peine plus fournie voit sa sortie amputée — et le
 * symptôme n'est PAS une erreur : c'est une liste courte, plausible, qui ne couvre que
 * le DÉBUT de la séance. Constaté deux fois en essai réel (2 et 3 extraits rendus, tous
 * dans les cinq premières minutes) avant d'être expliqué par ce `usage`.
 * 14 000 laisse ~6 000 jetons de sortie : de quoi rendre une vingtaine d'extraits.
 * Le plafond ne coûte rien tant qu'il n'est pas consommé (facturation à l'usage).
 */
const MAX_TOKENS = 14000;
/**
 * ⭐ 110 s ET NON 75 : MESURE, PAS PRUDENCE. Sur la tranche unique du replay de
 * référence, l'appel qui aboutit met 74,8 s — soit 197 ms sous l'ancien plafond de 75 s.
 * Ce n'était pas un timeout, c'était un tirage au sort : au tour suivant, le MÊME appel
 * a été abandonné sur échéance (« The operation was aborted due to timeout ») et il a
 * fallu une seconde tentative. La cause est mesurée dans `usage` : 10 178 jetons de
 * RAISONNEMENT avant la première ligne de JSON — le modèle réfléchit plus longtemps
 * depuis que le prompt exige un titre justifié et une raison citée.
 * 110 s laisse deux tentatives entières dans le budget total, contre trois tentatives
 * dont aucune n'avait le temps d'aboutir.
 */
const TIMEOUT_APPEL_MS = 110000;
const BUDGET_TOTAL_MS = 240000; // 4 min pour toute la phase de sélection

// ── Seuils du garde-fou (calibrés sur le replay de référence, cf. en-tête) ─────
/**
 * Fenêtres mesurées sur « L'arbre du Manikongo » (silencedetect -40 dB / 0,8 s) :
 *   t=780 → 100 % de silence (60 s de rien)      t=495 → 77 % dont 25,3 s de queue
 *   t=2   →  60 % dont 9,7 s de queue  ← l'« Extrait 1 » d'aujourd'hui
 *   t=429 →  64 %      t=605 → 66 %      t=682 → 46 %      t=653 → 44 %
 *   t=848 →  36 %      t=127 → 31 %      t=899 → 24 %      t=380 → 21 %      t=197 → 3 %
 * La parole normale de ce maître (débit lent, incantatoire) tourne entre 20 et 46 % :
 * un seuil à 55 % écarte les quatre fenêtres mortes sans toucher aux vivantes.
 */
const SILENCE_RATIO_MAX = 0.55;
/** Un extrait qui se termine sur du vide meurt à l'écran. 9,7 s pour l'« Extrait 1 ». */
const SILENCE_QUEUE_MAX = 3.5;
/** Un trou franc au milieu casse le rythme aussi sûrement qu'une fin muette. */
const SILENCE_TROU_MAX = 9;
const SILENCE_DB = -40;
const SILENCE_DUREE_MIN = 0.8;

/**
 * ⭐ SEUIL DE SILENCE ADAPTÉ AU LOCUTEUR — ET POURQUOI IL NE PEUT QUE DURCIR.
 *
 * Reproche légitime : 0,55 est un chiffre ABSOLU, il ignore le débit propre à chaque
 * intervenant. Un orateur rapide qui parle à 12 % de blanc passerait sans peine un
 * seuil taillé pour un maître au débit incantatoire.
 *
 * La correction naïve — « seuil relatif au silence MÉDIAN du replay » — a été mesurée,
 * et elle EMPIRE les choses. Sondes audio sur le replay de référence (12 fenêtres de
 * 30 s réparties sur toute la durée) :
 *     médiane du taux de silence = 70 %   ·   silence global du replay = 56 %
 * La médiane est PLUS HAUTE que le seuil actuel : un seuil « médiane + marge » aurait
 * laissé passer les fenêtres à 100 % de silence qu'on écarte aujourd'hui. Raison : la
 * moitié d'un replay de séance N'EST PAS de la parole (installation, questions
 * inaudibles, temps morts). La médiane décrit le replay, pas le LOCUTEUR.
 *
 * Ce qui décrit le locuteur, c'est le QUART LE PLUS DENSE : Q1 des mêmes sondes.
 * Mais Q1 est instable à l'échantillonnage — mesuré sur le MÊME replay :
 *      8 sondes → 42 %    10 → 31 %    12 → 37 %    16 → 41 %    20 → 40 %
 * soit ±13 points selon le nombre de sondes. Un seuil calé dessus au plus juste
 * ferait basculer le verdict du meilleur extrait du replay (0,487 après recadrage)
 * d'un tour à l'autre.
 *
 * D'où la règle retenue : `seuil = min(SILENCE_RATIO_MAX, Q1 + MARGE_SILENCE_REL)`.
 *   · le relatif ne peut que DURCIR, jamais assouplir — le plafond absolu reste le
 *     dernier rempart, et l'instabilité de Q1 ne peut donc pas ouvrir la porte ;
 *   · la marge (0,25) est plus large que l'instabilité mesurée (0,13), pour que le
 *     verdict ne dépende pas du tirage des sondes ;
 *   · sur le replay de référence : Q1 = 0,37 → 0,62 → ramené à 0,55, seuil INCHANGÉ,
 *     donc zéro régression ; sur un orateur dense (Q1 = 0,10) le seuil tombe à 0,35,
 *     ce qui est l'adaptation demandée.
 */
const MARGE_SILENCE_REL = 0.25;
/** Fenêtre d'une sonde audio. 30 s = l'ordre de grandeur d'un extrait, donc comparable. */
const SONDE_AUDIO_SEC = 30;
/**
 * ⭐ DÉPARTAGE À ÉGALITÉ DE PAROLE, en secondes (voir `recadrerSurLaParole`).
 * En dessous de cet écart, deux sous-fenêtres contiennent la MÊME parole et ne
 * diffèrent que par le silence qu'elles traînent. 0,05 s est très en dessous d'un
 * phonème français (80 à 120 ms) : on ne peut pas perdre une syllabe dans cette marge.
 * Mesuré sur l'extrait de référence, l'écart réel entre les deux fenêtres à départager
 * est exactement 0,000 s — le morceau retiré est du silence PUR.
 */
const EGALITE_PAROLE_SEC = 0.05;

/**
 * DENSITÉ VISUELLE : part de la référence du replay (Q3 sondé sur toute la durée, voir
 * `mesurerReferenceVisuelle`) en dessous de laquelle on considère l'image VIDE.
 * Mesuré sur le replay de référence (Q3 = 73 703 octets par image) :
 *   tableau blanc vierge t=127 → 12 %   t=197 → 24 %   t=2 → 30 %   partage arrêté → 8 %
 *   diapos réelles → 65 % à 135 %
 * Seuil à 45 % : les écrans vides tombent tous, les diapos passent toutes, et l'écart
 * entre les deux familles (24 % contre 65 %) laisse une marge confortable.
 */
const DETAIL_PART_MIN = 0.45;
/**
 * Plancher ABSOLU, en octets PNG par pixel analysé. Il ne sert QUE au cas dégénéré où
 * presque tout le replay est vide : la médiane devient basse et le critère relatif
 * ci-dessus ne veto plus rien. Mesuré : tableau blanc 0,04 à 0,11 o/px, diapo dense
 * 0,33 à 0,50, image de caméra (bruitée) au-delà de 0,8. Volontairement très bas
 * (0,05) pour ne jamais condamner une vraie prise de vue sombre.
 */
const DETAIL_PLANCHER_OPX = 0.05;

/** Débit de parole du français oral, en caractères par seconde (pré-filtre textuel). */
const CAR_PAR_SEC = 14;

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Secondes → « 1:02:30 » / « 12:30 », pour parler au modèle dans les deux notations. */
export function mmss(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(r).padStart(2, '0')}`;
}

// ─── Préparation de la transcription ─────────────────────────────────────────
/**
 * Agrège les segments en blocs horodatés « [seconde] texte ». Le repère temporel est
 * indispensable : sans lui le modèle peut décrire un moment mais pas le SITUER.
 * Le texte part INTÉGRALEMENT (aucune compression) — c'est la leçon du chapitrage, où
 * une compression à 40 000 caractères jetait 80 % des mots et rendait les ruptures
 * invisibles.
 */
export function construireBlocs(segments, fenetreSec = FENETRE_BLOC_SEC) {
  const blocs = [];
  let debut = -1;
  let buf = [];
  const vider = () => {
    if (debut >= 0 && buf.length) {
      const texte = buf.join(' ').replace(/\s+/g, ' ').trim();
      if (texte) blocs.push({ t: Math.round(debut), texte });
    }
    buf = [];
  };
  for (const s of segments) {
    const t = Number(s?.start);
    const texte = String(s?.text || '').trim();
    if (!Number.isFinite(t) || t < 0 || !texte) continue;
    if (debut < 0 || t - debut >= fenetreSec) {
      vider();
      debut = t;
    }
    buf.push(texte);
  }
  vider();
  return blocs;
}

/**
 * Découpe les blocs en tranches successives avec RECOUVREMENT. Le budget porte sur la
 * taille d'UNE tranche, jamais sur le texte : si la transcription est longue on ajoute
 * des tranches ; si elles deviendraient trop nombreuses, la dernière absorbe le reste
 * (jamais de fin de replay hors couverture).
 */
export function decouperTranches(blocs) {
  if (!blocs.length) return [];
  const lignes = blocs.map((b) => `[${b.t}] ${b.texte}`);
  const total = lignes.reduce((n, l) => n + l.length + 1, 0);
  // Le facteur 1,15 provisionne le recouvrement (chaque tranche relit un bout de la
  // précédente) : sans lui on débordait systématiquement d'une tranche.
  const taille = Math.max(TRANCHE_CAR, Math.ceil((total * 1.15) / MAX_TRANCHES));

  const tranches = [];
  let i = 0;
  while (i < blocs.length && tranches.length < MAX_TRANCHES) {
    let j = i;
    let car = 0;
    const derniere = tranches.length === MAX_TRANCHES - 1;
    while (j < blocs.length && (derniere || car < taille)) {
      car += lignes[j].length + 1;
      j += 1;
    }
    tranches.push({
      debut: blocs[i].t,
      fin: blocs[j - 1].t + FENETRE_BLOC_SEC,
      texte: lignes.slice(i, j).join('\n'),
    });
    if (j >= blocs.length) break;
    const cible = blocs[j - 1].t - RECOUVREMENT_SEC;
    let k = j;
    // `k > i + 1` garantit la progression : jamais de boucle infinie si une seule
    // tranche couvre déjà plus que le recouvrement demandé.
    while (k > i + 1 && blocs[k - 1].t >= cible) k -= 1;
    i = k;
  }
  return tranches;
}

// ─── Appel du modèle ─────────────────────────────────────────────────────────
/**
 * DeepSeek d'abord, Groq en repli.
 * ⛔ `deepseek-chat` et `deepseek-reasoner` ont été SUPPRIMÉS par le fournisseur :
 * tout ancien nom rend HTTP 400. Seuls `deepseek-v4-flash` / `deepseek-v4-pro`
 * répondent — et sur du JSON structuré c'est `flash` qu'il faut (voir MAX_TOKENS).
 */
function resoudreFournisseur() {
  const ds = process.env.DEEPSEEK_API_KEY;
  if (ds && ds !== 'replace_me') {
    return {
      url: 'https://api.deepseek.com/chat/completions',
      cle: ds,
      modele: 'deepseek-v4-flash',
      nom: 'deepseek',
    };
  }
  const groq = process.env.GROQ_API_KEY;
  if (groq && groq !== 'replace_me') {
    return {
      url: 'https://api.groq.com/openai/v1/chat/completions',
      cle: groq,
      modele: 'llama-3.3-70b-versatile',
      nom: 'groq',
    };
  }
  return null;
}

/**
 * Lit un JSON même si le modèle l'a emballé dans une clôture Markdown ou l'a fait
 * précéder d'une phrase de politesse. Jette si rien d'exploitable.
 */
function lireJson(brut) {
  const s = String(brut || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(s);
  } catch {
    const d = s.indexOf('{');
    const f = s.lastIndexOf('}');
    if (d >= 0 && f > d) return JSON.parse(s.slice(d, f + 1));
    throw new Error('réponse non JSON');
  }
}

/**
 * Appel résilient. Deux garde-fous, tous deux payés cher ailleurs dans ce dépôt :
 *  · le `content` VIDE (HTTP 200, budget de jetons absorbé par le raisonnement) est
 *    traité comme une ERREUR et JOURNALISÉ — sinon c'est un trou silencieux ;
 *  · backoff exponentiel + gigue sur 429 / 5xx : relancer immédiatement n'empile que
 *    des refus, et désynchroniser les appels évite qu'ils se reprennent le même 429.
 */
async function appelerLlm(system, user, { etiquette, echeance, journal }) {
  const fournisseur = resoudreFournisseur();
  if (!fournisseur) throw new Error('aucune clé IA configurée (DEEPSEEK_API_KEY / GROQ_API_KEY)');

  let derniere = null;
  for (let essai = 0; essai < 3; essai += 1) {
    const reste = echeance - Date.now();
    // En dessous de 5 s, un appel ne peut pas aboutir : on rend la main plutôt que de
    // brûler l'échéance des tranches voisines.
    if (reste <= 5000) throw derniere || new Error(`${etiquette} : budget de temps épuisé`);
    try {
      const res = await fetch(fournisseur.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${fournisseur.cle}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: fournisseur.modele,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          response_format: { type: 'json_object' },
          // Budget élargi au fil des tentatives : le raisonnement en consomme.
          max_tokens: Math.min(16000, Math.round(MAX_TOKENS * (1 + essai * 0.5))),
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(Math.max(5000, Math.min(TIMEOUT_APPEL_MS, reste))),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        const err = new Error(`${fournisseur.nom} ${res.status}: ${t.slice(0, 160)}`);
        err.status = res.status;
        throw err;
      }
      const json = await res.json();
      const contenu = String(json?.choices?.[0]?.message?.content ?? '').trim();
      if (!contenu) throw new Error(`${fournisseur.modele} : réponse VIDE (budget de jetons absorbé)`);
      return lireJson(contenu);
    } catch (e) {
      derniere = e;
      journal.warn(`[shorts:ia] ${etiquette} tentative ${essai + 1}/3 — ${e.message}`);
      const surcharge = e.status === 429 || (typeof e.status === 'number' && e.status >= 500);
      if (surcharge && essai < 2) await pause(Math.min(8000, 1200 * 2 ** essai) + Math.floor(Math.random() * 400));
    }
  }
  throw derniere || new Error(`${etiquette} : appel impossible`);
}

// ─── Le prompt ───────────────────────────────────────────────────────────────
const SYSTEME =
  "Tu es monteur de formats courts (TikTok, Reels, Shorts). On te donne un extrait de la " +
  "transcription HORODATÉE d'une séance enregistrée en direct, découpée en blocs préfixés par " +
  "leur seconde de départ. Ta mission : repérer les passages qui ACCROCHERAIENT un inconnu qui " +
  "tombe sur la vidéo dans son fil — quelqu'un qui ne connaît ni la séance, ni l'intervenant, et " +
  "qui décide en deux secondes s'il reste. Tu réponds toujours en JSON strict.";

/**
 * ⭐ LE TITRE EST LE PRODUIT, PAS UNE ÉTIQUETTE.
 *
 * C'est ce que le créateur lit dans la Vidéothèque pour décider s'il publie, et c'est
 * la base de la légende sociale. Un bon segment mal titré est un extrait perdu.
 *
 * Défaut mesuré sur le replay de référence : le passage 653→682 s, où l'orateur décline
 * son identité et sa filiation (« Je suis Cheo, cinquième Manikongo, fils de Kimpa
 * Vita »), a été titré « Que faire après l'incantation ? » — une question d'intendance
 * rituelle qui appartient à un AUTRE passage (t = 874). La `raison` ne mentionnait même
 * pas l'identité. Le modèle avait bien repéré le moment ; il n'avait pas compris qu'on
 * lui demandait de nommer L'ACCROCHE.
 *
 * Les exemples ci-dessous sont donc tirés de CE replay et opposés deux à deux : un
 * modèle apprend beaucoup mieux d'un contre-exemple concret que d'une consigne abstraite.
 *
 * ⚠️ ET LE TITRE DOIT REPRENDRE LES MOTS DU PASSAGE. Ce n'est pas une coquetterie :
 * c'est ce qui le rend VÉRIFIABLE côté serveur (voir `adequationTitre`). Un titre
 * paraphrasé jusqu'à ne plus partager un seul mot porteur avec ce qui est dit est
 * indiscernable d'un titre inventé — et sera écarté.
 *
 * @param {Array} [dejaVus] — moments déjà proposés pour cette tranche (relance).
 */
function demandePourTranche(tranche, idx, total, titre, attendus, dejaVus = null) {
  // RELANCE : on ne redemande pas « encore des extraits » (le modèle re-proposerait les
  // mêmes), on lui dit lesquels sont PRIS et on lui demande d'aller voir ailleurs.
  const relance = dejaVus?.length
    ? `\n⚠️ SECOND PASSAGE SUR CETTE TRANCHE. Tu as déjà proposé les moments ci-dessous ; ils sont PRIS,
ne les reprends pas, même reformulés :
${dejaVus.map((d) => `  · ${d.start}→${d.end} s — « ${d.titre || 'sans titre'} »`).join('\n')}
Relis la tranche et cherche des moments DIFFÉRENTS, ailleurs dans le texte. Si tu n'en vois
aucun autre qui accroche VRAIMENT, rends une liste vide : c'est une réponse juste.\n`
    : '';

  return `Séance : « ${titre || 'Séance enregistrée'} ».
EXTRAIT ${idx + 1}/${total} — il couvre de ${tranche.debut} s (${mmss(tranche.debut)}) à ${tranche.fin} s (${mmss(tranche.fin)}).
${relance}

⛔ NE DÉCOUPE PAS LE TEMPS EN MORCEAUX RÉGULIERS. Un bon extrait n'est pas un intervalle
d'horloge : c'est un MOMENT QUI ACCROCHE. Cherche-le dans ce qui est DIT.

CE QUI ACCROCHE (garde ça) :
- une AFFIRMATION FORTE, tranchée, qui surprend ou qui prend position ;
- une PROMESSE : ce que l'auditeur va comprendre, savoir faire, ou cesser de croire ;
- une HISTOIRE, une scène, un souvenir, un cas concret raconté ;
- une QUESTION QUI INTRIGUE, ou une énigme posée puis dénouée ;
- une RÉVÉLATION : « en réalité… », « ce qu'on ne dit jamais… », un contre-pied ;
- une DÉFINITION frappante, une formule mémorable, une identité affirmée.

CE QU'IL FAUT FUIR (ne le propose jamais) :
- les réglages techniques : « est-ce que vous m'entendez », « on enregistre bien »,
  « ton micro est coupé », « je partage mon écran », « vous voyez le tableau ? » ;
- les salutations, l'appel de présence, les au revoir, les « à demain » ;
- l'intendance : liens à envoyer, droits d'accès, horaires, devoirs à rendre ;
- les blancs, les hésitations, les phrases inachevées, les reprises après incident ;
- les digressions administratives et les échanges entre deux participants.

CONTRAINTES (impératives) :
- "debut" = une seconde ENTIÈRE, PRISE PARMI LES HORODATAGES [ ] fournis ci-dessous, et
  qui tombe SUR la phrase qui accroche — pas trente secondes avant.
- "fin" = une seconde entière, strictement supérieure à "debut".
  Durée entre ${DUREE_MIN} et ${DUREE_MAX} secondes. Un extrait doit se terminer sur une idée
  achevée, jamais au milieu d'un mot.

⭐ LES DEUX CHAMPS LES PLUS IMPORTANTS — "phrase_ouverture" ET "phrase_cloture".
  Le texte que tu lis est horodaté par blocs d'une vingtaine de secondes : tes "debut" et
  "fin" ne peuvent donc PAS être précis, et ce n'est pas grave — ils servent seulement à
  SITUER la zone. Ce sont ces deux citations qui décideront des bornes réelles.
- "phrase_ouverture" = la PREMIÈRE PHRASE ENTIÈRE de l'extrait, RECOPIÉE MOT POUR MOT
  depuis le texte ci-dessous. Pas résumée, pas reformulée, pas corrigée.
- "phrase_cloture" = la DERNIÈRE PHRASE ENTIÈRE de l'extrait, recopiée de la même façon.
- ⛔ L'OUVERTURE NE COMMENCE JAMAIS PAR UN MOT DE LIAISON — « et », « donc », « alors »,
  « mais », « puis », « ensuite », « car », « parce que », « or ». Un extrait qui démarre
  sur « et l'onction de… » ou « et après on continue… » ouvre au milieu d'un propos :
  celui qui le découvre dans son fil ne sait ni de qui ni de quoi on parle. Recule
  jusqu'au vrai début de l'idée, même si cela allonge l'extrait.
- ⛔ L'OUVERTURE NE COMMENCE PAS NON PLUS PAR UN PRONOM SANS ANTÉCÉDENT — « elle », « il »,
  « ça », « ce dernier » — si la personne ou la chose désignée n'est nommée qu'AVANT.
- ⛔ LA CLÔTURE FERME QUELQUE CHOSE. Ce n'est ni une question laissée sans réponse, ni une
  phrase inachevée, ni le début d'une énumération qui continue après.
- ⛔ CES DEUX PHRASES DOIVENT EXISTER DANS LE TEXTE. Elles seront recherchées dans
  l'enregistrement lui-même ; une phrase que tu aurais écrite de toi-même ne s'y trouvera
  pas et l'extrait sera REFUSÉ. Dans le doute, recopie plus court mais exact.
- "referent" = le nom propre réellement prononcé ENTRE ces deux phrases (la personne, le
  lieu, la notion dont il est question), ou null s'il n'y en a aucun. Un extrait sans
  aucun nom est souvent un extrait qu'on ne peut pas comprendre seul.
- ⛔ Aucune borne en dehors de l'intervalle [${tranche.debut}, ${tranche.fin}] : tu ne vois que cet extrait.
- Les extraits que tu proposes ne se chevauchent pas entre eux.
- Propose TOUS les passages qui accrochent, jusqu'à ${attendus} sur cette tranche. Ne fais pas
  ta propre présélection : c'est la note "force" qui les classera ensuite, et un passage
  moyen retenu vaut mieux qu'un passage moyen tu.
- ⭐ En revanche, si cette tranche ne contient AUCUN passage qui accroche — que des réglages,
  de l'intendance ou du bavardage — rends une liste VIDE. C'est une réponse JUSTE et UTILE :
  mieux vaut aucun extrait qu'un extrait mort.

LE TITRE — c'est lui qu'on lira, lis ceci deux fois :
- "titre" = 3 à 10 mots, en français. Il doit dire CE QUI ACCROCHE DANS CE PASSAGE PRÉCIS :
  l'affirmation qui est lancée, l'identité qui est déclarée, la scène qui est racontée,
  le contre-pied qui est pris. PAS le thème général du cours, PAS une question
  d'intendance, PAS un résumé tiède.
- ⭐ REPRENDS LES MOTS ET LES NOMS DU PASSAGE, tels qu'ils y apparaissent. Un titre qui
  ne partage aucun mot avec ce qui est dit sera REJETÉ automatiquement, même s'il est joli.
- ⛔ N'ATTRIBUE AU PASSAGE AUCUNE PHRASE QU'IL NE CONTIENT PAS. Si tu écris un titre à la
  première personne (« Je suis… », « Je n'ai jamais… »), cette déclaration doit avoir été
  RÉELLEMENT prononcée dans ce passage-ci. Sinon, c'est un faux.
- ⛔ PAS DE RACOLAGE : aucune promesse que le passage ne tient pas, aucun superlatif
  inventé, pas de « la vérité qu'on vous cache », pas de « ça va changer votre vie »,
  pas de chiffre ni de fait qui ne soit pas dans le texte. Un titre doit être VRAI.

- "raison" = une phrase (160 caractères max) qui CITE ce qui accroche : le fragment
  réellement prononcé (entre guillemets) ou l'élément précis (le nom déclaré, la scène
  racontée, l'affirmation lancée). « Passage intéressant » n'est pas une raison, et une
  raison qui ne parle pas de ce que dit le titre signale que l'un des deux est faux.
- "force" = entier de 1 à 5. 5 = on s'arrête de scroller. 1 = tiède. N'utilise 4 et 5 que
  pour ce qui accroche vraiment ; si tout est à 5, tu n'as rien classé.

EXEMPLES DE TITRES, tirés de cette séance même (apprends de l'écart) :
· Passage où l'orateur énonce son nom et sa filiation :
    ✅ « Je suis Cheo, cinquième Manikongo, fils de Kimpa Vita » — le titre EST l'accroche.
    ❌ « Que faire après l'incantation ? » — vrai ailleurs dans la séance, faux ici :
       ce titre parle d'intendance rituelle alors que le passage déclare une identité.
    ❌ « Le nom et l'identification » — le thème, pas l'accroche. Personne ne s'arrête.
    ❌ « La révélation qui va bouleverser votre vie » — racolage : rien de tel n'est promis.
· Passage où l'orateur explique quand la prière s'applique :
    ✅ « Une fois l'identification faite, on applique » — reprend ses mots, dit l'idée.
    ❌ « Je suis le cinquième Manikongo » — cette phrase n'est PAS dans ce passage-là.
       Un titre emprunté à un autre moment est un mensonge, même s'il est excellent.

JSON attendu, strictement :
{"extraits":[{"debut":${tranche.debut},"fin":${tranche.debut + 40},"phrase_ouverture":"la première phrase entière, recopiée mot pour mot","phrase_cloture":"la dernière phrase entière, recopiée mot pour mot","referent":"le nom propre prononcé, ou null","titre":"…","raison":"…","force":4}]}

TRANSCRIPTION HORODATÉE (chaque ligne = « [seconde] texte ») :
"""
${tranche.texte}
"""`;
}

// ─── Validation DURE du retour du modèle ─────────────────────────────────────
/** « 1:02:30 », « 12:30 », 750, « 750 » → 3750 / 750 / 750. `null` si illisible. */
function lireSeconde(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v ?? '').trim();
  if (!s) return null;
  const direct = Number(s);
  if (Number.isFinite(direct)) return direct;
  const m = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

// ─── ADÉQUATION TITRE ↔ TEXTE (le titre affirme-t-il ce qui est dit ?) ───────
/**
 * ⭐ POURQUOI CE CONTRÔLE EXISTE — un titre halluciné a échappé à toute validation.
 *
 * Mesuré sur le replay de référence : le candidat 224→266 s a été titré
 * « Je suis le cinquième Manikongo » alors que le texte de cette fenêtre dit
 * « Le nom, c'est le moyen par lequel on s'identifie… » et « Dieu d'Abraham, de Jacob »
 * — ni « Manikongo », ni « cinquième », ni la moindre phrase à la première personne.
 * Le modèle avait emprunté la phrase à un AUTRE passage (t = 653). `lireExtraits()`
 * validait les bornes, la durée, le format… jamais l'ADÉQUATION. Ce candidat n'a été
 * arrêté que par le veto d'image (26 % de la référence) : par chance, pas par
 * conception. Sur un replay sans tableau blanc, il partait en ligne.
 *
 * ─── LA MÉTHODE, ET POURQUOI CELLE-LÀ ───────────────────────────────────────
 * Contrainte dominante : LA TRANSCRIPTION EST FAUTIVE, surtout sur les noms propres —
 * c'est justement là que le contenu est le plus particulier. Whisper écrit
 * « Je suis Shao cinquième Manikongo piste Vita Kimba » pour « Je suis Cheo, cinquième
 * Manikongo, fils de Kimpa Vita ». Un contrôle par comparaison exacte rejetterait donc
 * le titre JUSTE du meilleur extrait du replay. Toute méthode qui exige l'égalité des
 * chaînes est disqualifiée d'avance.
 *
 * On mesure donc un ANCRAGE, en trois tolérances cumulées :
 *   1. mots normalisés (minuscules, accents et apostrophes retirés) ;
 *   2. mots-outils écartés — seuls les mots PORTEURS comptent (« que faire après
 *      l'incantation » ne pèse que par « incantation ») ;
 *   3. appariement souple : égalité, OU même racine sur 5 lettres
 *      (« application » ↔ « appliquer »), OU distance d'édition ≤ 1 (≤ 2 au-delà de
 *      7 lettres) — c'est ce dernier point qui sauve « Kimpa » ↔ « Kimba ».
 *
 * ─── LA RÈGLE, CALIBRÉE SUR LES CAS RÉELS ───────────────────────────────────
 * Un titre est REJETÉ s'il n'a AUCUN mot porteur ancré dans le passage (et, s'il en
 * compte 4 ou plus, s'il n'en a qu'un seul : un titre long qui ne touche le texte
 * qu'une fois touche par accident). Vérifié sur les quatre titres réels du replay :
 *     « Je suis le cinquième Manikongo »  sur 224→266 →  0 / 2  ancré  → REJETÉ ✅
 *     « Que faire après l'incantation ? » sur 653→682 →  0 / 1  ancré  → REJETÉ ✅
 *     « Application pratique de la prière » sur 899→928 → 1 / 3      → gardé  ✅
 *     « Je suis Cheo, cinquième Manikongo, fils de Kimpa Vita » sur 653 → 4 / 6 → gardé ✅
 * Un seuil en POURCENTAGE aurait été plus élégant et plus faux : à 1/3, le titre
 * « Application pratique de la prière » (0,333) passait de justesse ou tombait selon
 * l'arrondi. L'ancrage compté en mots est franc.
 *
 * Second contrôle, indépendant du lexique : UNE DÉCLARATION À LA PREMIÈRE PERSONNE
 * dans le titre exige que le passage contienne effectivement une parole au « je ».
 * C'est le type même de la faute constatée (« Je suis le cinquième Manikongo » sur un
 * passage entièrement en « on » et « nous ») et ce test la prend sans dépendre d'un
 * seul mot commun.
 *
 * ─── CE QUE CE CONTRÔLE NE SAIT PAS FAIRE (limites assumées) ─────────────────
 * · Il ne juge pas la VÉRACITÉ, seulement l'ANCRAGE. Un titre dont tous les mots sont
 *   dans le passage mais qui en inverse le sens (« il n'a jamais été Manikongo »)
 *   passe. Contre cela, seul le prompt agit.
 * · Il punit la paraphrase pure : « Une lignée royale revendiquée » ne partage aucun
 *   mot avec « Je suis Shao cinquième Manikongo » et serait rejeté alors qu'il est
 *   juste. C'est un compromis ASSUMÉ, et c'est pourquoi le prompt exige explicitement
 *   de reprendre les mots du passage : la règle de contrôle est annoncée au modèle,
 *   elle ne lui tend pas un piège.
 * · Il ne voit que le texte de la fenêtre. Un titre qui s'appuie sur ce qui a été dit
 *   trois minutes plus tôt sera rejeté — c'est voulu : un extrait doit se suffire.
 */

/** Minuscules, accents retirés, apostrophes et ponctuation → espaces. */
function normaliserTexte(s) {
  return String(s || '')
    .normalize('NFD')
    // Bloc « Combining Diacritical Marks » : c'est ce que NFD a détaché des lettres.
    // Écrit en points de code et non en littéral, pour rester lisible et incassable.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Mots-outils français. Volontairement LARGE : un mot-outil de trop ne fait que rendre
 * le contrôle plus indulgent (moins de mots porteurs à ancrer), un mot porteur oublié
 * le rendrait injustement sévère. On se trompe donc du côté qui ne jette rien.
 */
const MOTS_OUTILS = new Set(
  ('le la les un une des du de au aux et ou ni mais donc or car que qui quoi dont ou ce cet cette ces ca cela ceci ' +
    'celui celle ceux je tu il elle on nous vous ils elles me te se moi toi lui leur leurs mon ma mes ton ta tes son ' +
    'sa ses notre nos votre vos en pour par dans sur sous avec sans vers chez entre depuis pendant avant apres contre ' +
    'est sont etre ete suis es sommes etes ai as avons avez ont avoir eu fait faire fais font ne pas plus moins tres ' +
    'bien tout tous toute toutes meme aussi comme quand comment pourquoi si oui non deja encore alors ici la quel ' +
    'quelle quels quelles va vais vont peut peux pouvez doit dois devez veut veux voulez dire dit disait ' +
    'y a d l s n c j m t qu jusqu lorsqu puisqu')
    .split(' ')
    .filter(Boolean),
);

/** Mots PORTEURS d'un texte normalisé : ni mots-outils, ni mots de moins de 3 lettres. */
function motsPorteurs(normalise) {
  const out = [];
  for (const m of normalise.split(' ')) {
    if (m.length < 3 || MOTS_OUTILS.has(m)) continue;
    out.push(m);
  }
  return out;
}

/**
 * Distance d'édition BORNÉE : dès qu'on dépasse `plafond` on abandonne. Le plafond sert
 * autant à la justesse (au-delà, ce ne sont plus deux graphies du même mot) qu'au coût :
 * on compare un titre à quelques centaines de mots, plusieurs fois par extrait.
 */
function distanceEdition(a, b, plafond) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > plafond) return plafond + 1;
  let prec = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const cour = [i];
    let minLigne = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      cour[j] = Math.min(prec[j] + 1, cour[j - 1] + 1, prec[j - 1] + cout);
      if (cour[j] < minLigne) minLigne = cour[j];
    }
    // Toute la ligne dépasse déjà le plafond : le résultat final ne pourra que monter.
    if (minLigne > plafond) return plafond + 1;
    prec = cour;
  }
  return prec[b.length];
}

/** Un mot du titre est-il « dit » dans le passage ? (égalité / racine / graphie fautive) */
function motAncre(mot, motsDuTexte) {
  if (motsDuTexte.has(mot)) return true;
  // Tolérance à la faute de transcription. 1 caractère jusqu'à 6 lettres (« kimpa »
  // ↔ « kimba »), 2 au-delà — à 4 lettres, 2 fautes ne désignent plus le même mot.
  const plafond = mot.length >= 7 ? 2 : 1;
  const racine = mot.length >= 5 ? mot.slice(0, 5) : null;
  for (const m of motsDuTexte) {
    // Même racine : couvre la dérivation (« application » ↔ « appliquer »), que la
    // distance d'édition seule ne rattrape pas (5 caractères d'écart).
    if (racine && m.length >= 5 && (m.startsWith(racine) || mot.startsWith(m.slice(0, 5)))) return true;
    if (distanceEdition(mot, m, plafond) <= plafond) return true;
  }
  return false;
}

/** Le titre parle-t-il à la première personne du singulier ? */
const TITRE_PREMIERE_PERSONNE = /(^|\s)(je|j|mon|ma|mes)(\s|$)/;

/**
 * Verdict d'adéquation d'un titre au texte de sa fenêtre.
 * @returns {{ok: boolean, motif: string|null, ancres: number, porteurs: number}}
 *   `ok: true` avec `motif: 'non vérifiable'` quand le titre n'a aucun mot porteur ou
 *   qu'aucun texte n'est disponible : on ne condamne jamais ce qu'on n'a pas pu mesurer
 *   — c'est la même règle que pour le garde-fou du signal.
 */
export function adequationTitre(titre, texteFenetre) {
  const t = normaliserTexte(titre);
  const f = normaliserTexte(texteFenetre);
  if (!t || !f) return { ok: true, motif: 'non vérifiable', ancres: 0, porteurs: 0 };

  const porteurs = [...new Set(motsPorteurs(t))];
  const motsDuTexte = new Set(f.split(' ').filter((m) => m.length >= 3));

  // Déclaration au « je » : elle doit correspondre à une parole au « je » dans le
  // passage. Test indépendant du lexique, donc insensible aux fautes de transcription.
  if (TITRE_PREMIERE_PERSONNE.test(` ${t} `)) {
    const parleALaPremierePersonne = / (je|j) /.test(` ${f} `);
    if (!parleALaPremierePersonne) {
      return { ok: false, motif: 'titre au « je » sur un passage qui ne dit jamais « je »', ancres: 0, porteurs: porteurs.length };
    }
  }

  if (!porteurs.length) return { ok: true, motif: 'non vérifiable', ancres: 0, porteurs: 0 };
  const ancres = porteurs.filter((m) => motAncre(m, motsDuTexte)).length;
  // 0 ancre = le titre parle d'autre chose. 1 seule ancre sur un titre long = accident.
  const minimum = porteurs.length >= 4 ? 2 : 1;
  if (ancres < minimum) {
    return {
      ok: false,
      motif: `titre non ancré (${ancres}/${porteurs.length} mot(s) porteur(s) réellement dit(s) : ${porteurs.join(', ')})`,
      ancres,
      porteurs: porteurs.length,
    };
  }
  return { ok: true, motif: null, ancres, porteurs: porteurs.length };
}

/**
 * Texte RÉELLEMENT prononcé dans une fenêtre, reconstitué depuis les blocs horodatés
 * (ceux-là mêmes qui ont été envoyés au modèle : on juge le titre sur ce que le modèle
 * a lu, pas sur une autre version du texte).
 */
export function texteDesBlocs(blocs, debut, fin, fenetreSec = FENETRE_BLOC_SEC) {
  if (!Array.isArray(blocs) || !blocs.length) return '';
  return blocs
    .filter((b) => b.t + fenetreSec > debut && b.t < fin)
    .map((b) => b.texte)
    .join(' ');
}

/** Nettoie un titre rendu par le modèle. '' = inexploitable. */
function nettoyerTitre(v) {
  let s = String(v ?? '').replace(/\s+/g, ' ').trim();
  s = s.replace(/^["'«»\-–—•*\s]+/, '').replace(/["'«»\s]+$/, '').replace(/[.;,:]+$/, '').trim();
  if (!s) return '';
  if (s.length > 80) return ''; // titre-paragraphe = phrase recopiée
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Lit et VALIDE les extraits d'une tranche. Rien n'est pris pour argent comptant :
 * le modèle rend parfois des bornes en « mm:ss », des fins avant les débuts, des
 * durées de 3 minutes ou des bornes hors de la tranche qu'il a lue.
 *
 * On RÉPARE ce qui est réparable sans rien inventer (une fin trop lointaine est
 * ramenée à debut + DUREE_MAX ; une fin trop proche est repoussée à debut + DUREE_MIN
 * tant que ça reste dans le replay) et on REJETTE le reste. Réparer plutôt que jeter :
 * un bon moment ne doit pas être perdu pour une borne bâclée.
 *
 * ⭐ ET DEPUIS LE TITRE HALLUCINÉ DU 224→266 : on valide aussi l'ADÉQUATION du titre au
 * texte de sa fenêtre (voir `adequationTitre`). Un titre non ancré n'annule PAS le
 * candidat — le passage peut être bon, c'est le motif qui est faux : on retire le titre
 * ET la raison (tous deux non fondés), et on baisse la force d'un cran pour que les
 * candidats honnêtes passent devant si la place manque. Le passage reste disponible en
 * dernier recours, avec le titre neutre « Extrait N ».
 *
 * @param {Array} [blocs] — blocs horodatés envoyés au modèle. SANS EUX, PAS DE CONTRÔLE
 *   DE TITRE : c'est explicite et journalisé par l'appelant, jamais silencieux.
 */
export function lireExtraits(brut, bas, haut, dureeSec, plafond, blocs = null) {
  const liste = Array.isArray(brut?.extraits)
    ? brut.extraits
    : Array.isArray(brut?.highlights)
      ? brut.highlights
      : Array.isArray(brut?.moments)
        ? brut.moments
        : Array.isArray(brut)
          ? brut
          : [];

  const out = [];
  for (const it of liste) {
    const d = lireSeconde(it?.debut ?? it?.start ?? it?.t ?? it?.from);
    let f = lireSeconde(it?.fin ?? it?.end ?? it?.to);
    if (d === null) continue;
    const debut = Math.max(0, Math.round(d));
    // Le modèle extrapole parfois au-delà de ce qu'il a lu : une borne hors tranche
    // n'est justifiée par AUCUN texte (tolérance d'un bloc).
    if (debut < bas - FENETRE_BLOC_SEC || debut > haut + FENETRE_BLOC_SEC) continue;
    if (dureeSec && debut >= dureeSec - DUREE_MIN) continue; // rien à extraire si près de la fin

    let fin = f === null ? debut + DUREE_MAX : Math.round(f);
    if (fin <= debut) fin = debut + DUREE_MAX;              // fin absurde → durée pleine
    if (fin - debut > DUREE_MAX) fin = debut + DUREE_MAX;   // bornage DUR de la durée
    if (fin - debut < DUREE_MIN) fin = debut + DUREE_MIN;   // trop court → allongé
    if (dureeSec) fin = Math.min(fin, dureeSec);
    if (fin - debut < DUREE_MIN) continue;                  // la fin du replay ne le permet pas

    let titre = nettoyerTitre(it?.titre ?? it?.title ?? it?.label);
    let raison = String(it?.raison ?? it?.reason ?? it?.why ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
    let force = Number(it?.force ?? it?.score ?? it?.strength);
    if (!Number.isFinite(force)) force = 3;
    force = Math.max(1, Math.min(5, Math.round(force)));

    // CONTRÔLE D'ADÉQUATION. On juge le titre sur le texte de SA fenêtre, pas sur toute
    // la tranche : c'est précisément l'erreur du 224→266, un titre emprunté à un autre
    // moment de la même tranche.
    let titreEcarte = null;
    if (titre && blocs) {
      const verdict = adequationTitre(titre, texteDesBlocs(blocs, debut, fin));
      if (!verdict.ok) {
        titreEcarte = { titre, motif: verdict.motif };
        titre = '';
        raison = ''; // la raison portait le même motif inventé : elle tombe avec le titre.
        force = Math.max(1, force - 1);
      }
    }

    // ⭐ LES CITATIONS TRAVERSENT SANS ÊTRE JUGÉES ICI. On ne peut pas les vérifier à ce
    // stade : elles seront cherchées dans l'audio RE-TRANSCRIT AU MOT de la zone
    // (`short-bornes.js`), pas dans les cues de 20 s qu'on a sous la main — et c'est
    // tout l'intérêt, puisque la passe courte entend souvent autre chose que la longue.
    // On se contente d'un plancher de longueur : une « citation » de trois caractères
    // s'ancrerait n'importe où et ferait passer le garde-fou pour un tamis.
    const citation = (v) => {
      const s = String(v ?? '').replace(/\s+/g, ' ').trim();
      return s.length >= 15 ? s.slice(0, 400) : null;
    };
    const phraseOuverture = citation(it?.phrase_ouverture ?? it?.ouverture);
    const phraseCloture = citation(it?.phrase_cloture ?? it?.cloture);
    const referent = String(it?.referent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) || null;

    out.push({
      start: debut, end: fin, titre, raison, force,
      phraseOuverture, phraseCloture, referent,
      ...(titreEcarte ? { titreEcarte } : {}),
    });
  }

  out.sort((a, b) => a.start - b.start || b.force - a.force);
  // Le prompt ne fait que SUGGÉRER un nombre : sans plafond ici, rien ne borne la
  // liste qu'une tranche peut produire. On garde les plus forts, pas les premiers.
  if (plafond && out.length > plafond) {
    return [...out].sort((a, b) => b.force - a.force || a.start - b.start)
      .slice(0, plafond)
      .sort((a, b) => a.start - b.start);
  }
  return out;
}

/**
 * Supprime les chevauchements et les extraits trop rapprochés, en gardant le PLUS FORT
 * de chaque grappe (et, à force égale, le plus ancien : le moment commence là).
 * Le recouvrement entre tranches fait que le même passage remonte souvent deux fois.
 */
export function retirerChevauchements(liste, ecartMin = ECART_MIN_SEC) {
  const tries = [...liste].sort((a, b) => a.start - b.start);
  const gardes = [];
  for (const c of tries) {
    const prec = gardes[gardes.length - 1];
    const colle = prec && (c.start < prec.end || c.start - prec.start < ecartMin);
    if (!colle) {
      gardes.push(c);
      continue;
    }
    // Même grappe : on remplace le représentant si le nouveau venu est plus fort.
    if (c.force > prec.force) gardes[gardes.length - 1] = c;
  }
  return gardes;
}

// ─── Estimation textuelle (ordonne le repli, n'écarte JAMAIS) ────────────────
/**
 * Estime la part de PAROLE dans une fenêtre à partir de la seule longueur du texte
 * (≈14 caractères par seconde en français oral).
 *
 * ⚠️ Ce n'est PAS une mesure : les segments issus des cues se touchent bout à bout
 * (la fin d'une cue est le début de la suivante), donc leur durée cumulée vaut
 * toujours 100 % de la fenêtre et ne dit RIEN du silence. La longueur du texte, elle,
 * en dit quelque chose — mais pas grand-chose.
 *
 * ⛔ NE PAS S'EN SERVIR POUR ÉCARTER UN CANDIDAT. Essayé, mesuré, retiré : sur la
 * fenêtre 653→703 s du replay de référence, cette estimation donne 26 % de parole
 * quand le signal en mesure 61 % — parce que la transcription y est lacunaire. Elle ne
 * sert plus qu'à ORDONNER les fenêtres du repli mécanique, où aucune autre information
 * n'est disponible et où l'erreur ne coûte qu'un mauvais classement.
 */
export function densiteParoleEstimee(segments, debut, fin) {
  const duree = Math.max(1, fin - debut);
  let car = 0;
  for (const s of segments) {
    const a = Math.max(Number(s.start), debut);
    const b = Math.min(Number(s.end), fin);
    if (!(b > a)) continue;
    const texte = String(s.text || '');
    const part = (b - a) / Math.max(0.001, Number(s.end) - Number(s.start));
    car += texte.length * part;
  }
  return car / CAR_PAR_SEC / duree;
}

// ─── Mesure du signal (ffmpeg) ───────────────────────────────────────────────
function lancerFfmpeg(args, { collecterStdout = false } = {}) {
  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', collecterStdout ? 'pipe' : 'ignore', 'pipe'] });
    let err = '';
    let octets = 0;
    if (collecterStdout) proc.stdout.on('data', (d) => { octets += d.length; });
    proc.stderr.on('data', (d) => { err += d.toString(); });
    // On ne rejette JAMAIS : une mesure impossible ne doit pas faire échouer une
    // fabrication. L'appelant traite `null` comme « non mesuré » (cf. `evaluer`).
    proc.on('error', () => resolve({ code: -1, err, octets }));
    proc.on('close', (code) => resolve({ code, err, octets }));
  });
}

/**
 * Blancs audio d'une fenêtre, en secondes RELATIVES à son début.
 * `-ss` AVANT `-i` : recherche rapide par images-clés (sur un replay de 2 h, chercher
 * après `-i` décoderait depuis la seconde 0).
 */
async function mesurerSilences(fichier, debut, duree) {
  const { code, err } = await lancerFfmpeg([
    '-hide_banner', '-nostats', '-ss', String(debut), '-t', String(duree),
    '-i', fichier, '-vn', '-af', `silencedetect=noise=${SILENCE_DB}dB:d=${SILENCE_DUREE_MIN}`,
    '-f', 'null', '-',
  ]);
  if (code !== 0) return null;
  const spans = [];
  let courant = null;
  for (const m of err.matchAll(/silence_(start|end): (-?[\d.]+)/g)) {
    const v = Number(m[2]);
    if (m[1] === 'start') courant = Math.max(0, v);
    else if (courant !== null) {
      spans.push([courant, Math.min(duree, v)]);
      courant = null;
    }
  }
  // Un `silence_start` sans `silence_end` = la fenêtre se termine DANS le silence.
  // C'est exactement le défaut de l'« Extrait 1 » : ne pas le refermer ici le rendrait
  // invisible à la mesure.
  if (courant !== null) spans.push([courant, duree]);
  return spans;
}

/**
 * DENSITÉ VISUELLE — combien d'information y a-t-il RÉELLEMENT à l'écran ?
 *
 * Méthode : on ré-encode quelques images de la fenêtre en PNG et on PÈSE le flux.
 * Un aplat (tableau blanc vierge, écran de partage arrêté) se compresse presque à
 * rien ; une diapo dense, non. C'est une mesure d'entropie spatiale déguisée, obtenue
 * sans écrire un octet sur le disque ni analyser un seul pixel côté Node.
 *
 * ⚠️ PNG ET NON JPEG : mesuré sur le replay de référence, le JPEG (q=5) ne sépare
 * l'écran vide de la diapo que d'un facteur 4 (7,8 ko contre 34 ko) — il paie un coût
 * fixe par bloc et n'écrase pas les aplats. Le PNG les sépare d'un facteur 20
 * (22 ko contre 100 ko à 640 px de large). Le seuil devient franc au lieu d'être un
 * arbitrage.
 *
 * ⚠️ TOUJOURS À LA MÊME DÉFINITION (640 px de large) : la valeur est alors comparable
 * d'un replay à l'autre, et le plancher absolu en octets/pixel a un sens.
 */
async function mesurerDetail(fichier, debut, duree, largeurSource, hauteurSource) {
  const LARGE = 640;
  const haut = Math.max(2, Math.round((LARGE * hauteurSource) / Math.max(1, largeurSource) / 2) * 2);
  const pas = 3; // une image toutes les 3 s : ~20 images pour une fenêtre de 60 s
  const { code, octets } = await lancerFfmpeg(
    [
      '-hide_banner', '-loglevel', 'error', '-ss', String(debut), '-t', String(duree),
      '-i', fichier, '-an', '-vf', `fps=1/${pas},scale=${LARGE}:${haut}`,
      '-f', 'image2pipe', '-vcodec', 'png', '-',
    ],
    { collecterStdout: true },
  );
  if (code !== 0 || octets === 0) return null;
  const images = Math.max(1, Math.round(duree / pas));
  return { parImage: octets / images, parPixel: octets / images / (LARGE * haut) };
}

/**
 * RÉFÉRENCE VISUELLE DU REPLAY — « que sait montrer cette vidéo, au mieux ? »
 *
 * ⚠️ CETTE RÉFÉRENCE NE DOIT PAS ÊTRE CALCULÉE SUR LES SEULS CANDIDATS. Constaté en
 * essai réel : un tour où le modèle n'a rendu QU'UN candidat donnait une référence
 * égale à ce candidat lui-même — donc un rapport de 1,00 et un veto structurellement
 * incapable de se déclencher, même sur un tableau blanc vierge. Et sur un lot dont la
 * moitié est vide, la référence s'effondre au niveau du vide.
 *
 * On sonde donc le replay ENTIER : une image toutes les `1/PROBES` de la durée, hors
 * des toutes premières et dernières secondes (accueil et au revoir sont muets et vides
 * par nature — les inclure abaisserait la barre). Coût mesuré sur le replay de
 * référence : 12 sondes en 1,7 s, chaque sonde étant une recherche O(1) dans l'index
 * du MP4 et non un décodage.
 *
 * On garde le 3ᵉ QUARTILE : la question n'est pas « cette fenêtre est-elle dans la
 * moyenne » mais « est-elle vide au regard de ce que ce replay affiche quand il a
 * quelque chose à montrer ».
 * Sondé sur le replay de référence : 3 729 / 4 696 / 10 038 / 19 354 / 24 296 / 66 536 /
 * 68 339 / 69 264 / 69 929 / 73 703 / 74 367 / 108 718 octets par image → Q3 = 73 703.
 * Les fenêtres à tableau blanc tombent alors à 12 %, 24 % et 30 % de la référence
 * (seuil 45 %), les diapos réelles entre 65 % et 135 %.
 *
 * ⚠️ CE N'EST PLUS QU'UNE FAÇADE sur `sonderLeReplay`, qui prend image ET audio aux
 * mêmes instants. Conservée parce qu'elle est exportée et lisible ; elle paie donc
 * aussi le sondage audio (0,7 s mesuré). Dans le moteur, appeler `sonderLeReplay`.
 */
export async function mesurerReferenceVisuelle(fichier, dureeSec, source, sondes = 12) {
  const s = await sonderLeReplay(fichier, dureeSec, source, sondes);
  return s?.detailQ3 ?? null;
}

/** Quantile `p` (0→1) d'une liste de nombres, sur une copie triée. */
function quantile(valeurs, p) {
  if (!valeurs.length) return null;
  const t = [...valeurs].sort((a, b) => a - b);
  return t[Math.min(t.length - 1, Math.floor(t.length * p))];
}

/**
 * SONDAGE DU REPLAY — la même passe donne la référence d'IMAGE et la référence de PAROLE.
 *
 * L'image répond à « que sait montrer cette vidéo, au mieux ? » (Q3, cf. ci-dessus).
 * L'audio répond à « à quoi ressemble le silence quand ce locuteur PARLE ? » — et c'est
 * le Q1, pas la médiane, pour la raison mesurée en tête de fichier (MARGE_SILENCE_REL) :
 * la médiane d'un replay de séance décrit ses temps morts, pas sa parole.
 *
 * Les deux mesures partagent les MÊMES instants : on ne double pas le nombre de
 * recherches dans le fichier, et les deux références décrivent le même échantillon du
 * replay. Coût mesuré sur le replay de référence : 1,7 s pour l'image (12 sondes) et
 * 0,7 s pour l'audio (12 fenêtres de 30 s) — l'audio est presque gratuit parce qu'il se
 * décode sans toucher à la vidéo (`-vn`).
 */
export async function sonderLeReplay(fichier, dureeSec, source, sondes = 12) {
  if (!fichier || !dureeSec || dureeSec < 60) return null;
  const marge = Math.min(30, dureeSec * 0.03);
  const utile = dureeSec - 2 * marge;
  if (utile <= 0) return null;

  const details = [];
  const silences = [];
  for (let i = 0; i < sondes; i += 1) {
    const t = marge + (utile * (i + 0.5)) / sondes;
    // Une SEULE image par sonde : `mesurerDetail` avec une durée de 1 s et un pas de 1.
    const d = await mesurerDetailBrut(fichier, t, source);
    if (d) details.push(d);
    // Fenêtre audio de l'ordre de grandeur d'un extrait, bornée par la fin du replay :
    // un taux de silence n'a de sens que comparé à des fenêtres de taille comparable.
    const fen = Math.min(SONDE_AUDIO_SEC, Math.max(5, dureeSec - t));
    const spans = await mesurerSilences(fichier, t, fen);
    if (spans) silences.push(statsSilence(spans, fen).ratio);
  }
  if (!details.length && !silences.length) return null;
  return {
    detailQ3: quantile(details, 0.75),
    // Q1 = le quart le plus dense en parole. Q2 est donné pour le journal : l'écart
    // entre les deux est le meilleur indicateur qu'un replay est à moitié mort.
    paroleQ1: quantile(silences, 0.25),
    silenceMedian: quantile(silences, 0.5),
    sondes: { image: details.length, audio: silences.length },
  };
}

/**
 * Plafond de silence RÉELLEMENT appliqué à ce replay. Le relatif ne peut que DURCIR :
 * `min` avec le plafond absolu — c'est ce qui rend l'instabilité de Q1 (±13 points
 * mesurés) inoffensive, puisqu'elle ne peut jamais ouvrir la porte, seulement la fermer.
 */
export function seuilSilencePourCeReplay(paroleQ1) {
  if (!Number.isFinite(paroleQ1)) return SILENCE_RATIO_MAX;
  return Math.min(SILENCE_RATIO_MAX, paroleQ1 + MARGE_SILENCE_REL);
}

/** Poids PNG d'UNE image à l'instant `t` (même définition que `mesurerDetail`). */
async function mesurerDetailBrut(fichier, t, source) {
  const LARGE = 640;
  const haut = Math.max(2, Math.round((LARGE * (source?.hauteur || 1080)) / Math.max(1, source?.largeur || 1920) / 2) * 2);
  const { code, octets } = await lancerFfmpeg(
    [
      '-hide_banner', '-loglevel', 'error', '-ss', String(Math.max(0, t)),
      '-i', fichier, '-frames:v', '1', '-an', '-vf', `scale=${LARGE}:${haut}`,
      '-f', 'image2pipe', '-vcodec', 'png', '-',
    ],
    { collecterStdout: true },
  );
  return code === 0 && octets > 0 ? octets : null;
}

/**
 * Mesure une fenêtre candidate : silence RÉEL + densité visuelle RÉELLE.
 * Rend `null` sur échec — une mesure impossible ne condamne rien (voir `evaluer`).
 */
export async function mesurerFenetre(fichier, debut, fin, source) {
  const duree = Math.max(1, fin - debut);
  const [spans, detail] = await Promise.all([
    mesurerSilences(fichier, debut, duree),
    mesurerDetail(fichier, debut, duree, source?.largeur || 1920, source?.hauteur || 1080),
  ]);
  if (!spans && !detail) return null;
  return { spans: spans || [], detail, duree, silenceMesure: Boolean(spans) };
}

/**
 * Statistiques de silence d'une fenêtre [0, duree] à partir des blancs mesurés.
 * Fonction PURE : elle sert à la fois au verdict et au rognage, sans repasser par ffmpeg.
 */
export function statsSilence(spans, duree) {
  let total = 0;
  let trou = 0;
  for (const [a, b] of spans) {
    total += b - a;
    trou = Math.max(trou, b - a);
  }
  const dernier = spans.length ? spans[spans.length - 1] : null;
  // « Queue » = silence qui touche la FIN de la fenêtre (tolérance 0,3 s).
  const queue = dernier && duree - dernier[1] <= 0.3 ? dernier[1] - dernier[0] : 0;
  const premier = spans.length ? spans[0] : null;
  const tete = premier && premier[0] <= 0.3 ? premier[1] - premier[0] : 0;
  return { ratio: total / Math.max(1, duree), trou, queue, tete };
}

/**
 * RECADRAGE SUR LA PAROLE, AVANT VERDICT.
 *
 * Un passage à 60 % de silence n'est pas forcément un mauvais passage : c'est souvent
 * un bon passage MAL BORNÉ. Le modèle lit du texte, il ne peut pas savoir que la phrase
 * qu'il a choisie est précédée de huit secondes de rien et suivie de dix autres.
 *
 * On cherche donc, À L'INTÉRIEUR de la fenêtre choisie par le modèle (jamais au-delà :
 * on ne déplace pas son choix, on le resserre), la sous-fenêtre qui maximise les
 * SECONDES DE PAROLE tout en respectant les seuils. Maximiser les secondes de parole
 * — et non minimiser le taux de silence — est délibéré : minimiser le taux ramènerait
 * systématiquement l'extrait à sa durée plancher, puisqu'une fenêtre courte contient
 * mécaniquement moins de blanc.
 *
 * Les bornes candidates sont les FRONTIÈRES DE PAROLE déjà mesurées (fin d'un blanc
 * pour un début, début d'un blanc pour une fin) : l'extrait démarre et s'achève donc
 * sur de la voix, jamais au milieu d'une syllabe. Aucune nouvelle mesure ffmpeg : les
 * blancs sont déjà connus. Transformer un veto en réparation coûte ici zéro seconde.
 *
 * ─── ⭐ LE DÉPARTAGE À ÉGALITÉ, ET POURQUOI IL EST INDISPENSABLE ─────────────
 * « Maximiser les secondes de parole » ne dit RIEN quand deux sous-fenêtres contiennent
 * exactement la même parole. C'est le cas dès qu'on peut retirer du silence PUR : le
 * morceau retiré ne portait aucune voix, donc les deux fenêtres sont à égalité et la
 * comparaison stricte `>` laisse gagner… la PREMIÈRE VISITÉE, c'est-à-dire la fenêtre
 * PLEINE (`departs` commence par 0, `fins` par `duree`).
 *
 * Mesuré sur l'extrait de référence 653→682 s (« Je suis Cheo, cinquième Manikongo ») —
 * les deux seules sous-fenêtres à égalité :
 *      0 → 29,00 s : parole 13,276 s, silence 54,2 %, queue muette 3,41 s   ← retenue
 *      0 → 25,89 s : parole 13,276 s, silence 48,7 %, queue muette 0,30 s
 * Même parole au millième près ; 3,11 s de rien en plus, dont 3,41 s de silence PUR à la
 * fin, à 0,09 s du plafond de queue. Un extrait qui se termine sur du vide meurt à
 * l'écran — et c'était le seul extrait qui comptait de ce replay.
 *
 * D'où : à parole égale (à `EGALITE_PAROLE_SEC` près), on prend celle qui traîne le
 * MOINS de silence. On ne perd pas une syllabe, par construction : la parole comparée
 * est la même.
 *
 * @param {number} [seuilRatio] — plafond de silence, adapté au locuteur par l'appelant
 *   (voir MARGE_SILENCE_REL). Défaut = plafond absolu, pour que la fonction reste
 *   utilisable seule (scripts de mesure, tests).
 */
export function recadrerSurLaParole(extrait, mesure, seuilRatio = SILENCE_RATIO_MAX) {
  if (!mesure?.silenceMesure) return extrait;
  const duree = extrait.end - extrait.start;
  const spans = mesure.spans;
  if (!spans.length || duree <= DUREE_MIN) return extrait;

  const silenceDans = (a, b) =>
    spans.reduce((n, [x, y]) => n + Math.max(0, Math.min(b, y) - Math.max(a, x)), 0);

  // Départs = 0 et chaque REPRISE de parole ; fins = la fin de la fenêtre et chaque
  // ENTRÉE en silence. 0,3 s de respiration pour ne pas couper l'attaque du mot.
  const departs = new Set([0]);
  const fins = new Set([duree]);
  for (const [a, b] of spans) {
    if (b < duree - 1) departs.add(Math.max(0, b - 0.3));
    if (a > 1) fins.add(Math.min(duree, a + 0.3));
  }

  let meilleur = null;
  for (const d of departs) {
    for (const f of fins) {
      const L = f - d;
      if (L < DUREE_MIN || L > DUREE_MAX) continue;
      const sil = silenceDans(d, f);
      const ratio = sil / L;
      const stats = statsSilence(
        spans.map(([a, b]) => [Math.max(0, a - d), Math.min(L, b - d)]).filter(([a, b]) => b > a),
        L,
      );
      const admissible = ratio <= seuilRatio && stats.queue <= SILENCE_QUEUE_MAX && stats.trou <= SILENCE_TROU_MAX;
      const parole = L - sil;
      const candidat = { d, f, parole, silence: sil, ratio, admissible };
      if (!meilleur) meilleur = candidat;
      // Une fenêtre admissible bat toujours une inadmissible ; à égalité d'admissibilité
      // on garde celle qui contient le plus de parole EN SECONDES.
      else if (candidat.admissible !== meilleur.admissible) {
        if (candidat.admissible) meilleur = candidat;
      } else {
        const ecart = candidat.parole - meilleur.parole;
        if (ecart > EGALITE_PAROLE_SEC) meilleur = candidat;
        // ⭐ ÉGALITÉ DE PAROLE → le moins de silence gagne. Sans cette ligne, la fenêtre
        // PLEINE l'emportait toujours (première visitée) et l'extrait gardait sa queue
        // muette : 3,41 s de rien à la fin du meilleur passage du replay de référence.
        else if (Math.abs(ecart) <= EGALITE_PAROLE_SEC && candidat.silence < meilleur.silence) meilleur = candidat;
      }
    }
  }
  if (!meilleur || (meilleur.d < 1 && duree - meilleur.f < 1)) return extrait;

  const L = meilleur.f - meilleur.d;
  const nouveaux = spans
    .map(([a, b]) => [a - meilleur.d, b - meilleur.d])
    .filter(([a, b]) => b > 0 && a < L)
    .map(([a, b]) => [Math.max(0, a), Math.min(L, b)]);
  return {
    ...extrait,
    start: Math.round(extrait.start + meilleur.d),
    end: Math.round(extrait.start + meilleur.f),
    recadre: Math.round((duree - L) * 10) / 10,
    _mesure: { ...mesure, spans: nouveaux, duree: L },
  };
}

/**
 * VERDICT sur une fenêtre mesurée. `refDetail` = détail médian des candidats du même
 * replay : le critère visuel est RELATIF au replay (un cours filmé en 720p sombre n'a
 * pas la même densité qu'une capture d'écran 1080p), avec un plancher absolu pour le
 * cas dégénéré où presque tout le replay est vide.
 *
 * Rend `{ ok, motifs[] }`. Une mesure absente ne condamne JAMAIS : on ne peut pas
 * reprocher à un passage ce qu'on n'a pas su mesurer.
 *
 * @param {number} [seuilRatio] — plafond de silence adapté au locuteur (cf.
 *   MARGE_SILENCE_REL). Défaut = plafond absolu.
 */
export function evaluer(mesure, refDetail, seuilRatio = SILENCE_RATIO_MAX) {
  const motifs = [];
  if (!mesure) return { ok: true, motifs, mesure: null };
  const duree = mesure.duree;
  if (mesure.silenceMesure) {
    const s = statsSilence(mesure.spans, duree);
    if (s.ratio > seuilRatio) motifs.push(`silence ${Math.round(s.ratio * 100)} % (seuil ${Math.round(seuilRatio * 100)} %)`);
    if (s.queue > SILENCE_QUEUE_MAX) motifs.push(`fin muette ${s.queue.toFixed(1)} s`);
    if (s.trou > SILENCE_TROU_MAX) motifs.push(`blanc de ${s.trou.toFixed(1)} s`);
  }
  if (mesure.detail) {
    if (mesure.detail.parPixel < DETAIL_PLANCHER_OPX) motifs.push('image quasi uniforme');
    else if (refDetail && mesure.detail.parImage < refDetail * DETAIL_PART_MIN) {
      motifs.push(`image vide (${Math.round((mesure.detail.parImage / refDetail) * 100)} % du replay)`);
    }
  }
  return { ok: motifs.length === 0, motifs };
}

// ─── Repli MÉCANIQUE (aucun modèle) ──────────────────────────────────────────
/**
 * ⚠️ CE N'EST PAS UN CHOIX ÉDITORIAL, et il ne doit jamais être présenté comme tel.
 * C'est un découpeur : il vise les zones où le TEXTE est le plus dense (donc où l'on
 * parle le plus), réparties sur toute la durée, en commençant sur une frontière de
 * segment. Il ne sait pas ce qui accroche — il sait seulement éviter le vide.
 *
 * Il reste meilleur que l'ancienne détection sur deux points mesurables : il ne part
 * jamais de la seconde 0 par défaut, et il passe sous le même garde-fou de signal.
 */
export function selectionMecanique(segments, dureeSec, max = MAX_EXTRAITS) {
  if (!segments.length) return [];
  const duree = Math.min(DUREE_MAX, Math.max(DUREE_MIN, 45));
  const candidats = [];
  for (const s of segments) {
    const debut = Math.round(Number(s.start));
    if (!Number.isFinite(debut)) continue;
    const fin = Math.min(dureeSec || debut + duree, debut + duree);
    if (fin - debut < DUREE_MIN) continue;
    const densite = densiteParoleEstimee(segments, debut, fin);
    candidats.push({
      start: debut,
      end: fin,
      // Ni titre ni raison : aucun jugement n'a été porté, et en inventer un ferait
      // passer un découpage pour un choix. `short_clips.title` retombera sur « Extrait N ».
      titre: '',
      raison: '',
      // La « force » n'est ici qu'une densité de texte : on l'assume, elle sert
      // uniquement à trier, jamais à prétendre que le passage est bon.
      force: Math.min(5, Math.max(1, Math.round(densite * 5))),
      densite,
    });
  }
  if (!candidats.length) return [];
  // Répartition sur toute la durée : sans elle, un `.slice(0, 5)` sur une liste
  // chronologique prend les cinq premières minutes — c'est-à-dire l'accueil.
  const parZone = new Map();
  const zones = Math.max(1, max);
  const total = dureeSec || candidats[candidats.length - 1].end;
  for (const c of candidats) {
    const z = Math.min(zones - 1, Math.floor((c.start / Math.max(1, total)) * zones));
    const actuel = parZone.get(z);
    if (!actuel || c.densite > actuel.densite) parZone.set(z, c);
  }
  return [...parZone.values()].sort((a, b) => a.start - b.start);
}

// ─── Orchestration ───────────────────────────────────────────────────────────
/**
 * Choisit les moments d'un replay.
 *
 * @param {object}   o
 * @param {Array}    o.segments   — [{start, end, text}] (cues réemployées ou Whisper)
 * @param {number}   o.dureeSec   — durée du replay
 * @param {string}   o.titre      — titre de la séance (contexte du prompt)
 * @param {string}   [o.fichier]  — chemin de la vidéo locale ; sans lui, aucune mesure
 * @param {object}   [o.source]   — { largeur, hauteur } de la vidéo (mesure d'image)
 * @param {number}   [o.max]      — nombre d'extraits livrés
 * @param {object}   [o.journal]  — console-like
 * @returns {{extraits: Array, origine: 'ia'|'mecanique', diagnostic: object}}
 */
export async function selectionnerMoments({
  segments = [],
  dureeSec = 0,
  titre = '',
  fichier = null,
  source = null,
  max = MAX_EXTRAITS,
  journal = console,
} = {}) {
  const propres = (Array.isArray(segments) ? segments : [])
    .filter((s) => Number.isFinite(Number(s?.start)) && Number.isFinite(Number(s?.end)) && String(s?.text || '').trim())
    .map((s) => ({ start: Number(s.start), end: Number(s.end), text: String(s.text).trim() }))
    .sort((a, b) => a.start - b.start);

  // `titresEcartes` : titres refusés faute d'ancrage dans leur passage (cf.
  // `adequationTitre`). C'est un diagnostic de QUALITÉ DU MODÈLE, distinct des `ecartes`
  // qui sont des refus de SIGNAL. Les confondre masquerait une dérive du prompt.
  const diagnostic = { candidats: 0, ecartes: [], titresEcartes: [], tranches: 0, motifIa: null, seuilSilence: null };

  // (1) SÉLECTION PAR LE SENS. Tout échec descend d'un cran, et on le DIT.
  let candidats = [];
  let origine = 'ia';
  if (propres.length < 2) {
    origine = 'mecanique';
    diagnostic.motifIa = 'transcription absente ou trop courte';
  } else {
    try {
      candidats = await demanderAuModele(propres, dureeSec, titre, max, journal, diagnostic);
    } catch (e) {
      diagnostic.motifIa = e.message;
      journal.warn(`[shorts:ia] sélection par le sens impossible (${e.message})`);
    }
    if (!candidats.length) {
      origine = 'mecanique';
      diagnostic.motifIa = diagnostic.motifIa || 'aucun moment retenu par le modèle';
    }
  }
  if (origine === 'mecanique') {
    // ⚠️ Repli MÉCANIQUE : on le crie, et l'appelant le trace en base. Personne ne doit
    // croire que ces extraits ont été choisis pour leur intérêt.
    journal.warn(
      `[shorts] ⚠️ REPLI MÉCANIQUE (${diagnostic.motifIa}) — les extraits ne sont PAS un choix éditorial, ` +
        'seulement des fenêtres de parole dense réparties sur la durée.',
    );
    candidats = selectionMecanique(propres, dureeSec, max * 2);
  }

  // ⚠️ ON NE DÉDOUBLONNE PAS ENCORE. Les chevauchements étaient retirés ICI, avant la
  // mesure : le garde-fou se retrouvait alors sans remplaçant, puisque l'alternative
  // voisine avait déjà été jetée. Mesuré sur le replay de référence : 6 moments
  // proposés → 3 après dédoublonnage → 1 après veto, alors qu'en mesurant les 6 il en
  // restait 3. Le dédoublonnage arrive donc APRÈS le veto (bloc 4) — et de toute façon
  // les bornes bougent au recadrage, donc juger les chevauchements avant serait faux.
  candidats = candidats.filter((c) => c.end - c.start >= DUREE_MIN);
  diagnostic.candidats = candidats.length;
  if (!candidats.length) return { extraits: [], origine, diagnostic };

  // (2) ⛔ PAS DE PRÉ-FILTRE TEXTUEL — TESTÉ, PUIS RETIRÉ.
  //
  // L'idée paraissait bonne : estimer la parole d'une fenêtre à partir de la longueur
  // du texte (≈14 car./s) coûte zéro et éviterait de payer ffmpeg sur une fenêtre
  // manifestement muette. MESURÉ sur le replay de référence, fenêtre 653 → 703 s
  // (« Je suis Cheo, cinquième Manikongo, fils de Kimpa Vita » — le passage même qui
  // devrait sortir en premier) : parole RÉELLEMENT mesurée 61 %, estimation par le
  // texte 26 %. Trente-cinq points d'écart, parce que la transcription de ce passage
  // est lacunaire — Whisper a laissé tomber la moitié de l'incantation. Le pré-filtre
  // écartait donc le meilleur moment du replay AVANT toute mesure.
  //
  // Leçon générale : un proxy textuel se trompe exactement là où la transcription est
  // pauvre, c'est-à-dire là où le contenu est le plus particulier. Et l'économie qu'il
  // promettait est dérisoire — mesuré : 0,4 s de ffmpeg par fenêtre, 2 s pour cinq
  // candidats. `densiteParoleEstimee` ne sert donc plus qu'à ORDONNER le repli
  // mécanique, jamais à écarter quoi que ce soit.
  const apresTexte = candidats;

  // (3) GARDE-FOU MESURÉ — seule la mesure écarte, et elle a le dernier mot.
  let finaux = apresTexte;
  if (fichier) {
    const t0 = Date.now();
    const mesures = [];
    for (const c of apresTexte) {
      // En série et non en parallèle : chaque mesure décode de l'audio et des images,
      // dans le conteneur qui porte aussi la file d'e-mails et les rappels de live.
      mesures.push(await mesurerFenetre(fichier, c.start, c.end, source));
    }
    // Références sondées sur TOUT le replay (voir `sonderLeReplay` : les calculer sur
    // les seuls candidats rendait le veto inopérant dès qu'ils étaient peu nombreux ou
    // majoritairement vides). Repli sur les candidats si la sonde échoue — mieux vaut
    // une référence imparfaite que pas de veto du tout.
    const sonde = await sonderLeReplay(fichier, dureeSec, source);
    let refDetail = sonde?.detailQ3 ?? null;
    if (!refDetail) {
      const connus = mesures.map((m) => m?.detail?.parImage).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
      refDetail = connus.length ? connus[Math.min(connus.length - 1, Math.floor(connus.length * 0.75))] : null;
      if (refDetail) journal.warn('[shorts] référence visuelle sondée indisponible → repli sur les candidats');
    }
    // Seuil de silence ADAPTÉ AU LOCUTEUR. Aucun repli sur les candidats ici, à dessein :
    // faute de sonde, on garde le plafond absolu. Un seuil relatif calculé sur les seuls
    // candidats serait circulaire — il s'ajusterait au défaut qu'il doit détecter.
    const seuilSilence = seuilSilencePourCeReplay(sonde?.paroleQ1);
    diagnostic.seuilSilence = Math.round(seuilSilence * 100) / 100;
    if (sonde?.paroleQ1 != null) {
      journal.log(
        `[shorts] parole du replay : Q1 ${Math.round(sonde.paroleQ1 * 100)} % de silence, ` +
          `médiane ${Math.round(sonde.silenceMedian * 100)} % (${sonde.sondes.audio} sondes) → ` +
          `seuil appliqué ${Math.round(seuilSilence * 100)} %` +
          `${seuilSilence < SILENCE_RATIO_MAX ? ' (durci)' : ` (plafond absolu ${Math.round(SILENCE_RATIO_MAX * 100)} %)`}`,
      );
    }

    const survivants = [];
    for (let i = 0; i < apresTexte.length; i += 1) {
      const rogne = recadrerSurLaParole(apresTexte[i], mesures[i], seuilSilence);
      const mesure = rogne._mesure || mesures[i];
      const { ok, motifs } = evaluer(mesure, refDetail, seuilSilence);
      if (ok) {
        const { _mesure, ...propre } = rogne;
        survivants.push({
          ...propre,
          mesures: mesure
            ? {
                silence: mesure.silenceMesure
                  ? Math.round(statsSilence(mesure.spans, mesure.duree).ratio * 100) / 100
                  : null,
                detail_relatif: mesure.detail && refDetail
                  ? Math.round((mesure.detail.parImage / refDetail) * 100) / 100
                  : null,
              }
            : null,
        });
      } else {
        diagnostic.ecartes.push({ start: apresTexte[i].start, motifs });
        journal.warn(
          `[shorts] ✂️ ${mmss(apresTexte[i].start)} écarté — ${motifs.join(', ')}` +
            `${apresTexte[i].titre ? ` (« ${apresTexte[i].titre} »)` : ''}`,
        );
      }
    }
    journal.log(
      `[shorts] garde-fou signal : ${apresTexte.length} mesuré(s) en ${Math.round((Date.now() - t0) / 1000)} s → ` +
        `${survivants.length} retenu(s)`,
    );

    finaux = survivants;
    if (!survivants.length) {
      // TOUT est écarté → ON NE REND RIEN, et c'est délibéré.
      //
      // La tentation était de garder « le moins mauvais » pour ne pas rentrer les mains
      // vides. Écrit puis retiré, pour deux raisons :
      //  · le classement de repli aurait porté sur le silence seul, donc il aurait pu
      //    élire précisément une fenêtre à écran vide — la faute qu'on corrige ;
      //  · c'est la consigne qu'on donne au modèle lui-même (« mieux vaut aucun extrait
      //    qu'un extrait mort ») : l'appliquer au modèle et pas à soi serait incohérent.
      // L'appelant transforme cette liste vide en échec EXPLIQUÉ, et le détail de chaque
      // refus (avec ses chiffres) est déjà dans le journal ci-dessus : si le garde-fou
      // est mal calibré pour un replay, cela se voit en une ligne.
      diagnostic.tousEcartes = true;
      journal.error(
        `[shorts] ❌ Les ${apresTexte.length} candidat(s) ont TOUS été écartés par le garde-fou ` +
          '(silence dominant ou écran vide) — rien ne sera fabriqué pour ce replay.',
      );
      return { extraits: [], origine, diagnostic };
    }
  } else {
    journal.warn('[shorts] aucun fichier local : garde-fou silence/image NON appliqué');
  }

  // (4) DÉDOUBLONNAGE, puis CLASSEMENT FINAL.
  //     Le dédoublonnage vient APRÈS la mesure (voir le bloc 1) et après le recadrage,
  //     parce que ce sont les bornes DÉFINITIVES qui décident du chevauchement. Les
  //     tranches se recouvrant, le même moment remonte souvent deux fois.
  const sansDoublon = retirerChevauchements(finaux);
  if (sansDoublon.length !== finaux.length) {
    journal.log(`[shorts] dédoublonnage : ${finaux.length} → ${sansDoublon.length} extrait(s)`);
  }
  // Les plus forts d'abord, puis remise en ordre chronologique (c'est l'ordre
  // d'affichage attendu dans la Vidéothèque).
  const gardes = [...sansDoublon]
    .sort((a, b) => b.force - a.force || a.start - b.start)
    .slice(0, max)
    .sort((a, b) => a.start - b.start);

  return { extraits: gardes, origine, diagnostic };
}

/** Phase MAP : chaque tranche rend ses moments, en parallèle borné. */
async function demanderAuModele(segments, dureeSec, titre, max, journal, diagnostic) {
  const blocs = construireBlocs(segments);
  const tranches = decouperTranches(blocs);
  diagnostic.tranches = tranches.length;
  if (!tranches.length) return [];

  const echeance = Date.now() + BUDGET_TOTAL_MS;
  // Ce qu'on demande par tranche : la sur-production totale répartie, mais bornée par
  // ce qu'une tranche peut RAISONNABLEMENT contenir (≈ un moment toutes les 2 min de
  // parole). Annoncer « jusqu'à 15 » sur une tranche de 20 min n'apporte rien : le
  // modèle ne fabrique pas de moments qui n'existent pas, et un plafond absurde le
  // pousse plutôt à s'autocensurer. Plancher de 2 : une tranche doit toujours pouvoir
  // proposer une alternative au garde-fou.
  const parTranche = Math.max(
    2,
    Math.min(
      Math.max(3, Math.round((tranches[0].fin - tranches[0].debut) / 120)),
      Math.ceil((max * SUR_PRODUCTION) / tranches.length),
    ),
  );

  journal.log(
    `[shorts:ia] « ${titre} » : ${segments.length} segment(s) → ${blocs.length} bloc(s) de ${FENETRE_BLOC_SEC} s ` +
      `→ ${tranches.length} tranche(s), ${parTranche} extrait(s) demandé(s) par tranche`,
  );

  const resultats = new Array(tranches.length).fill(null).map(() => []);
  let curseur = 0;
  let echecs = 0;
  let derniereErreur = null;
  const ouvrier = async () => {
    for (;;) {
      const i = curseur;
      curseur += 1;
      if (i >= tranches.length) return;
      const tr = tranches[i];
      try {
        const brut = await appelerLlm(
          SYSTEME,
          demandePourTranche(tr, i, tranches.length, titre, parTranche),
          { etiquette: `tranche ${i + 1}/${tranches.length}`, echeance, journal },
        );
        resultats[i] = lireExtraits(brut, tr.debut, tr.fin, dureeSec, parTranche * 2, blocs);
      } catch (e) {
        // Une tranche perdue n'invalide pas la sélection : les autres couvrent le reste.
        echecs += 1;
        derniereErreur = e;
        journal.warn(`[shorts:ia] tranche ${i + 1}/${tranches.length} abandonnée — ${e.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCE, tranches.length) }, ouvrier));

  // ⚠️ DISTINGUER « le modèle n'a rien trouvé » de « le modèle n'a pas répondu ».
  // Sans ce relais, une clé IA absente ou un fournisseur en panne était journalisée
  // comme « aucun moment retenu par le modèle » — un diagnostic FAUX, qui envoyait
  // chercher le défaut dans le prompt au lieu de la configuration.
  if (echecs === tranches.length && derniereErreur) throw derniereErreur;

  journal.log(
    `[shorts:ia] ${resultats.flat().length} moment(s) proposé(s) sur ${resultats.filter((r) => r.length).length}/${tranches.length} tranche(s) productives`,
  );

  // ─── ⭐ RELANCE CIBLÉE — LA SEULE SUR-PRODUCTION QUI EXISTE VRAIMENT ────────
  // Constat mesuré sur le replay de référence : `SUR_PRODUCTION = 3` demandait « jusqu'à
  // 10 » moments sur l'unique tranche ; le modèle en a rendu 5, le garde-fou en a écarté
  // 3, il en restait 2 sur 5 « promis ». La sur-production n'avait donc produit AUCUNE
  // marge de remplacement : élever un plafond que le modèle n'atteint pas ne coûte rien
  // et ne rapporte rien.
  //
  // Ce qui marche, c'est de REDEMANDER en excluant explicitement ce qui est déjà pris —
  // un modèle qu'on relance sans lui dire ce qu'il a déjà proposé re-propose la même
  // chose.
  //
  // SEUIL `max * 2`, ET POURQUOI LA RELANCE EST ICI ET NON APRÈS LE VETO. On relance
  // AVANT de mesurer, donc sans savoir combien de candidats le garde-fou va emporter :
  // le facteur 2 est calé sur le taux de veto RÉEL du replay de référence (4 écartés +
  // 1 doublon sur 10 → 5 livrés, soit exactement le compte). Relancer APRÈS le veto
  // serait plus juste — on ne paierait un appel que si la moisson survivante est
  // vraiment courte — mais cela ferait entrer un aller-retour modèle au milieu de la
  // phase de mesure, et doublerait le temps mur du pire cas. À revoir si un replay
  // montre un taux de veto très différent de celui-ci.
  //
  // On borne strictement le coût :
  //   · une seule relance par tranche, jamais deux ;
  //   · au plus CONCURRENCE tranches relancées, choisies parmi les MOINS productives par
  //     minute (c'est là que le texte reste inexploité) ;
  //   · seulement si la moisson est courte et s'il reste DE QUOI FAIRE UN APPEL ENTIER.
  // Coût mesuré sur le replay de référence : la première moisson prend 75 s sur les
  // 240 s de budget (dont 10 178 jetons de raisonnement) ; la relance en prend autant.
  // ⚠️ Le reste de budget exigé est un appel COMPLET, pas la moitié : lancer une relance
  // avec 40 s devant soi ne produit qu'un abandon sur échéance, c'est-à-dire du temps mur
  // dépensé pour rien dans le conteneur qui porte aussi la file d'e-mails.
  const dejaTous = resultats.flat();
  const resteAssezDeTemps = echeance - Date.now() > TIMEOUT_APPEL_MS;
  if (dejaTous.length < max * 2 && resteAssezDeTemps) {
    const aRelancer = tranches
      .map((tr, i) => ({ i, tr, parMinute: resultats[i].length / Math.max(1, (tr.fin - tr.debut) / 60) }))
      // Les tranches ayant ÉCHOUÉ sont exclues : leur problème n'est pas la moisson.
      .filter((x) => resultats[x.i].length > 0 || echecs === 0)
      .sort((a, b) => a.parMinute - b.parMinute)
      .slice(0, CONCURRENCE);
    journal.log(
      `[shorts:ia] moisson courte (${dejaTous.length} < ${max * 2}) → relance de ${aRelancer.length} tranche(s) ` +
        'en excluant les moments déjà proposés',
    );
    await Promise.all(
      aRelancer.map(async ({ i, tr }) => {
        try {
          const brut = await appelerLlm(
            SYSTEME,
            demandePourTranche(tr, i, tranches.length, titre, parTranche, resultats[i]),
            { etiquette: `relance ${i + 1}/${tranches.length}`, echeance, journal },
          );
          const neufs = lireExtraits(brut, tr.debut, tr.fin, dureeSec, parTranche * 2, blocs);
          // Le modèle réutilise parfois une borne déjà rendue malgré la consigne : on ne
          // fait pas confiance à la consigne, on vérifie. `retirerChevauchements` fera le
          // reste plus tard, mais un doublon ici fausserait déjà le compte.
          const connus = new Set(resultats[i].map((e) => e.start));
          const inedits = neufs.filter((e) => !connus.has(e.start));
          resultats[i] = [...resultats[i], ...inedits];
          journal.log(
            `[shorts:ia] relance tranche ${i + 1} : ${neufs.length} rendu(s), ${inedits.length} inédit(s)`,
          );
        } catch (e) {
          // Une relance ratée ne coûte que du temps : la première moisson reste acquise.
          journal.warn(`[shorts:ia] relance tranche ${i + 1} abandonnée — ${e.message}`);
        }
      }),
    );
  }

  const tous = resultats.flat();
  // Journal du contrôle de titre : c'est le seul endroit d'où l'on peut voir si le
  // prompt dérive (beaucoup de titres non ancrés = le modèle raconte autre chose).
  const douteux = tous.filter((e) => e.titreEcarte);
  for (const e of douteux) {
    diagnostic.titresEcartes.push({ start: e.start, titre: e.titreEcarte.titre, motif: e.titreEcarte.motif });
    journal.warn(`[shorts:ia] 🏷️ ${mmss(e.start)} titre refusé « ${e.titreEcarte.titre} » — ${e.titreEcarte.motif}`);
  }
  journal.log(
    `[shorts:ia] TOTAL ${tous.length} moment(s) retenu(s) après relance` +
      `${douteux.length ? `, dont ${douteux.length} au titre refusé (non ancré dans le passage)` : ''}`,
  );
  return tous;
}
