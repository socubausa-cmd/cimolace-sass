/**
 * short-sous-titres.js — LE TEXTE PRONONCÉ EST LE CONTENU DU SHORT.
 *
 * ── POURQUOI CE MODULE EXISTE (mesuré, pas supposé) ────────────────────────
 * On a essayé pendant trois passes de rendre LA DIAPO lisible en 9:16. C'est une
 * impasse, et le chiffre le dit : sur le replay de référence (partage d'écran Zoom
 * 1920×942), la hauteur MÉDIANE d'un caractère de diapo sur la trame finale vaut
 * 0,42 % à 0,57 % de la hauteur, selon la mise en page — quand le plancher lisible sur
 * un téléphone est 3 %. **Zéro pour cent des caractères atteignaient ce plancher**,
 * avant comme après le meilleur recadrage. Et il n'y a pas d'échappatoire
 * géométrique : amener un corps de diapo de 26 px à 57,6 px demanderait une échelle de
 * 2,2, donc de ne garder que 487 px de large sur 1920 — les trois quarts de la diapo
 * jetés, chaque ligne coupée.
 *
 * La conclusion n'est pas « on n'y arrive pas » mais « ce n'était pas le bon objet ».
 * Le texte d'un partage d'écran est dimensionné pour un 16:9 d'ordinateur ; l'accroche
 * d'un short, elle, est PARLÉE. Elle n'a pas besoin d'une diapo lisible, elle a besoin
 * de GROS SOUS-TITRES sur la voix. Ce module fabrique ces sous-titres, et il les
 * fabrique en ASS (et non en SRT + `force_style`) pour trois raisons concrètes :
 *
 *   1. LA POSITION EXACTE. Le bloc de texte doit tomber dans une zone calculée
 *      (sous la vidéo, au-dessus de l'interface TikTok) : un style ASS porte
 *      MarginV/MarginL/MarginR/Alignment au pixel près, `force_style` sur du SRT ne
 *      permet pas d'avoir DEUX styles (le titre et la parole) dans le même fichier.
 *   2. LE TITRE DEVIENT SÛR À AFFICHER. Le titre vient du modèle, c'est donc du texte
 *      NON MAÎTRISÉ. Écrit dans un `drawtext=`, il traverserait l'analyseur de filtres
 *      de ffmpeg, où `:`, `\`, `%` et les apostrophes sont des métacaractères — une
 *      apostrophe suffit à casser la commande, et un `:` à décaler tous les
 *      paramètres. Écrit dans un fichier ASS, **il ne traverse plus aucun analyseur
 *      de filtres** : ffmpeg ne voit que le CHEMIN du fichier (fabriqué par nous dans
 *      tmpdir, sans caractère spécial). Il ne reste alors à échapper que la syntaxe
 *      ASS elle-même — `{`, `}`, `\` —, un jeu fermé de trois caractères (voir
 *      `echapperAss`). C'est la seule façon défendable d'afficher du texte de modèle.
 *   3. LA DÉCOUPE. Une cue de transcription fait jusqu'à 300 caractères sur 36 s :
 *      l'afficher d'un bloc donne un paragraphe illisible. Il faut la recouper en
 *      unités d'affichage et redistribuer le temps — ce qu'aucun `force_style` ne fait.
 *
 * ── CE QUE CE MODULE NE FAIT PAS ──────────────────────────────────────────
 * Il ne choisit pas les moments (short-highlights.js) et ne décide pas du cadrage
 * (short-cadrage.js). Il reçoit une fenêtre, un texte et une géométrie, et rend un
 * fichier ASS + les diagnostics qui permettent de vérifier ce qui sera à l'écran.
 *
 * ⚠️ UNE SEULE EXCEPTION À CETTE PURETÉ, ET ELLE EST ASSUMÉE : la relecture du texte
 * affiché lit le GLOSSAIRE de l'école (`public.tenant_glossary`, voir plus bas). C'est
 * le seul accès à la base de tout le fichier, il est en lecture, non bloquant, et
 * l'import de supabase-js y est DYNAMIQUE — la géométrie et la fabrique ASS restent
 * éprouvables sans base ni réseau.
 */

import { spawn } from 'child_process';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

// ── Charte LIRI, en couleurs ASS ──────────────────────────────────────────
// ⚠️ L'ASS écrit &HAABBGGRR : alpha, puis BLEU, VERT, ROUGE — l'inverse du HTML.
// Se tromper ici ne casse rien, ça donne juste une couleur fausse que personne ne
// relit ; d'où la conversion explicite plutôt qu'une constante recopiée à la main.
function couleurAss(hexRgb, alpha = 0) {
  const s = String(hexRgb).replace('#', '');
  const r = s.slice(0, 2); const g = s.slice(2, 4); const b = s.slice(4, 6);
  return `&H${alpha.toString(16).padStart(2, '0')}${b}${g}${r}`.toUpperCase();
}
export const FOND_LIRI_HEX = '262624';   // fond
const ENCRE_LIRI = 'f5f4ee';             // texte de parole
const OR_LIRI = 'e6cc92';                // titre (le corail est réservé aux ACTIONS)

// ── Typographie : les nombres, et d'où ils viennent ───────────────────────
/**
 * Taille du sous-titre, en unités de la trame (PlayResY = 1920, donc 1 unité = 1 px).
 *
 * 110 / 1920 = **5,73 % de la hauteur de trame** pour le corps (le cadratin).
 * Mais le chiffre qui compte est la HAUTEUR RÉELLE DE GLYPHE, celle que mesure
 * `mesure_pixel.py` par composantes connexes — c'est elle qu'on compare au plancher de
 * 3 %. Mesurée sur les cartons RÉELLEMENT produits pour ce replay, en gras :
 *     à 104 : médiane 57 px = 2,97 %  → **sous le plancher**, il a fallu monter ;
 *     à 110 : médiane 60 px = **3,15 %**  ·  p90 79 px = 4,11 %  ·  max 4,32 %.
 * À comparer aux 0,42 %–0,57 % de médiane du texte de diapo, dont **0,0 %** des
 * caractères atteignaient le plancher. Ici la moitié des taches d'encre le franchit,
 * et les hampes le dépassent de 37 %.
 */
const TAILLE_PAROLE = 110;
/**
 * PLAFOND du corps de la parole, et la raison du plafond.
 *
 * 110 était un PLANCHER de lisibilité, pas une cible : il place la médiane de glyphe
 * à 3,15 % de la hauteur de trame pour un plancher de 3 %. Mesuré sur l'extrait
 * « Je suis Cheo » réellement produit, la trame n'était encrée qu'à 26 % et le bloc
 * de parole pesait 447 px contre 530 px pour la bande vidéo : la PAROLE, qu'on avait
 * décidé de faire passer au rang de sujet, restait plus petite que l'image reléguée
 * au rang d'accessoire.
 *
 * 131 est choisi pour que 3 lignes (3 × 1,35 × 131 = 531 px) pèsent exactement le
 * poids de la bande vidéo de la source de référence (530 px). Le glyphe médian monte
 * à 3,75 %. Au-delà, la ligne devient trop courte pour les mots du domaine —
 * « Manikongo » et « cinquième » font 9 caractères, et un mot n'est JAMAIS coupé
 * (voir `couperEnLignes`).
 */
const TAILLE_PAROLE_MAX = 131;
/**
 * Interligne de Noto Sans : ascendante 1,069 + descendante 0,293 = 1,362 cadratin.
 * On budgète 1,35 — la valeur sert à RÉSERVER de la place, pas à positionner (libass
 * fait l'interligne lui-même), donc mieux vaut l'arrondir vers le bas et vérifier que
 * la zone tient quand même 4 lignes (voir `geometrieVerticale`).
 */
const INTERLIGNE = 1.35;
export const HAUTEUR_LIGNE_PAROLE = Math.round(TAILLE_PAROLE * INTERLIGNE); // 149 px

/**
 * LONGUEUR MAXIMALE D'UNE LIGNE, en caractères — le nombre le plus disputé du module.
 *
 * Contrainte dure : la largeur utile vaut 1080 − 60 (marge gauche) − 150 (marge droite,
 * la colonne d'icônes de TikTok/Reels) = **870 px**. Mesuré à la police, sur les 4 500
 * caractères de transcription réels du replay de référence, avec la largeur d'avance de
 * Noto Sans estimée à +8 % de celle d'Helvetica (Noto est plus large ; la marge est
 * volontaire), au corps 110 :
 *     13 caractères → médiane 609 px, p95 798 px, **0,6 % des lignes dépassent 870**
 *     14 caractères → p95 851 px, 3,6 % dépassent
 *     15 caractères → p95 904 px, 9,3 % dépassent
 * On retient 13. Et un dépassement n'est pas une casse : libass replie la ligne, le
 * bloc passe de 3 à 4 lignes — cas pour lequel la zone de texte est dimensionnée.
 */
export const MAX_CAR_LIGNE = 13;

/**
 * LA TYPOGRAPHIE DE LA PAROLE SE DÉDUIT DE LA ZONE, ELLE N'EST PAS UNE CONSTANTE.
 *
 * ⭐ POURQUOI — et c'est le calcul qui a tué l'idée d'un simple « on met 131 partout ».
 * La zone de texte ne fait pas la même hauteur selon la source : la bande vidéo est
 * ajustée à la LARGEUR de la trame, donc une source large (2,04:1 — un partage
 * d'écran Zoom) laisse 821 px au texte, tandis qu'une source portrait, dont la bande
 * bute sur le plafond de 740 px, ne lui en laisse que 611. Poser 131 partout ferait
 * déborder le pire cas sous l'interface de TikTok :
 *     4 lignes × 1,35 × 131 = 708 px  >  611 px disponibles.
 * Le corps est donc le plus grand qui tienne LA RÉSERVE DE 4 LIGNES dans la zone,
 * borné en bas par le plancher de lisibilité (110) et en haut par 131.
 *   · source 2,04:1 (référence) : 821 / 5,4 = 152 → plafonné à **131**
 *   · source 16:9               : 743 / 5,4 = 137 → plafonné à **131**
 *   · source portrait (pire cas): 611 / 5,4 = 113 → **113**, et rien ne déborde
 *
 * ⚠️ LA LONGUEUR DE LIGNE DOIT SUIVRE, EN SENS INVERSE. La contrainte de largeur est
 * inchangée (870 px utiles), donc grossir le corps sans raccourcir la ligne ferait
 * replier libass en permanence : les 13 caractères mesurés à 110 donnent un p95 de
 * 798 px, qui à 131 deviendrait 950 px — au-delà des 870. On conserve la MÊME
 * sévérité que le réglage d'origine (0,6 % de lignes en dépassement) en gardant le
 * produit `maxCar × taille` constant : 13 × 110 = 1430.
 *   · à 131 → 10 caractères  ·  à 113 → 12  ·  à 110 → 13 (le réglage d'origine)
 */
export function typographieParole(hauteurZone) {
  const h = Math.max(0, Number(hauteurZone) || 0);
  // ⚠️ ON PART DE LA HAUTEUR DE LIGNE, PAS DU CORPS. Poser
  // `taille = floor(h / (4 × 1,35))` paraît équivalent et ne l'est pas : la hauteur
  // de ligne réellement employée est `round(taille × 1,35)`, et cet arrondi peut
  // monter. Mesuré sur une source 4:3 avec coiffe (zone de 611 px) :
  // floor(611 / 5,4) = 113, mais round(113 × 1,35) = 153 et 4 × 153 = 612 — UN pixel
  // sous l'interface de TikTok. Le garde-fou de `geometrieVerticale` l'a signalé ;
  // c'est exactement ce pour quoi il existe. On borne donc la LIGNE, puis on en
  // déduit le corps.
  const ligneMax = Math.floor(h / LIGNES_RESERVEES);
  const brut = Math.floor(ligneMax / INTERLIGNE);
  const taille = Math.max(TAILLE_PAROLE, Math.min(TAILLE_PAROLE_MAX, brut || TAILLE_PAROLE));
  return {
    taille,
    hauteurLigne: Math.round(taille * INTERLIGNE),
    // `Math.floor` et non un arrondi : dépasser la largeur ne casse rien (libass
    // replie) mais consomme la réserve de 4e ligne, qui existe pour autre chose.
    maxCar: Math.max(8, Math.floor((MAX_CAR_LIGNE * TAILLE_PAROLE) / taille)),
  };
}
/**
 * 3 lignes au plus par unité d'affichage. Ni un mot isolé, ni un paragraphe :
 *  · 3 × 13 = 39 caractères, soit ~2,8 s au débit du français parlé (≈14 car/s, la
 *    constante déjà employée par `cuesToSegments`) — dans la fourchette usuelle du
 *    sous-titrage (1 à 6 s par carton) et bien au-dessus du confort de lecture ;
 *  · le bloc fait alors 3 × 149 = 447 px, soit 23,3 % de la trame — plus que ce que
 *    l'image occupe sur bien des sources (27,6 % sur la référence). Le texte pèse
 *    autant que l'image : c'est exactement ce qu'on cherchait.
 * À 2 lignes le bloc tomberait à 298 px et redeviendrait un accessoire.
 */
export const MAX_LIGNES_PAROLE = 3;
/** Réserve de la zone de texte : 4 lignes, pour absorber un repli imprévu de libass. */
export const LIGNES_RESERVEES = 4;
export const MARGE_GAUCHE = 60;
/** La colonne d'icônes de TikTok/Reels mange le bord droit : on ne lui donne rien. */
export const MARGE_DROITE = 150;

// ── Titre (coiffe) ────────────────────────────────────────────────────────
const TAILLE_TITRE = 52;
export const HAUTEUR_LIGNE_TITRE = Math.round(TAILLE_TITRE * INTERLIGNE); // 70 px
/** Exportée : la trace en base doit citer la taille réellement employée. */
export const TAILLE_SOUS_TITRE = TAILLE_PAROLE;
const MAX_CAR_TITRE = 30;
export const MAX_LIGNES_TITRE = 2;
const MARGE_TITRE = 70;

/** Durée minimale d'affichage d'une unité. En dessous, c'est un clignotement. */
const DUREE_UNITE_MIN = 0.5;
/** Débit du français parlé, en caractères par seconde (même valeur que cuesToSegments). */
const CAR_PAR_SECONDE = 14;
/** Marge sur le débit : mieux vaut un carton un peu lent qu'un carton qui devance. */
const MARGE_DEBIT = 1.15;

// ─── Découpe du texte ──────────────────────────────────────────────────────
/**
 * Coupe un texte en lignes d'au plus `maxCar` caractères, aux espaces uniquement.
 *
 * ⚠️ UN MOT PLUS LONG QUE LA LIGNE N'EST JAMAIS COUPÉ. Couper « Manikongo » en
 * « Maniko / ngo » serait pire qu'une ligne trop large : libass, lui, sait replier une
 * ligne large, il ne sait pas recoller un mot. On préfère donc déborder.
 */
export function couperEnLignes(texte, maxCar = MAX_CAR_LIGNE) {
  const mots = String(texte || '').trim().split(/\s+/).filter(Boolean);
  const lignes = [];
  let courante = '';
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (essai.length > maxCar && courante) {
      lignes.push(courante);
      courante = mot;
    } else {
      courante = essai;
    }
  }
  if (courante) lignes.push(courante);
  return lignes;
}

/**
 * Coupe un texte à la proportion demandée. `fracDebut`/`fracFin` = part à jeter à
 * chaque bout.
 *
 * ⚠️ ON COMPTE EN MOTS, PAS EN CARACTÈRES. Une première version coupait à l'indice de
 * caractère puis cherchait l'espace suivant : quand le point de coupe tombait dans le
 * DERNIER mot il n'y avait plus d'espace après, l'indice restait brut, et le premier
 * carton de l'extrait affichait « ellerie » — la queue de « sorcellerie ». Un compte
 * en mots ne peut pas produire de moignon, et garde toujours au moins un mot.
 */
function couperProportion(texte, fracDebut, fracFin) {
  const mots = String(texte).split(/\s+/).filter(Boolean);
  const n = mots.length;
  if (n === 0) return '';
  const i = Math.min(n - 1, Math.floor(n * fracDebut));
  const j = Math.max(i + 1, n - Math.floor(n * fracFin));
  return mots.slice(i, j).join(' ');
}

/**
 * Segments qui INTERSECTENT la fenêtre, bornes rognées dessus.
 *
 * ⚠️ CHEVAUCHEMENT, PAS INCLUSION STRICTE — c'est un acquis payé cher. L'ancien filtre
 * exigeait `start >= debut && end <= fin`, incompatible avec le bornage dur des
 * extraits (60 s au plus) : dès qu'un extrait naissait d'une cue plus longue, AUCUN
 * segment ne finissait avant la fin de la fenêtre, la liste sortait vide et le repli
 * incrustait littéralement « ... ». Mesuré sur les cues réelles : 12 extraits sur 280
 * (10 replays) tombaient dans ce cas, et le DERNIER segment parlé de CHAQUE extrait
 * était systématiquement perdu (couverture médiane 92,6 %, minimum 9,6 %).
 *
 * ⚠️ ET LE TEXTE EST ROGNÉ AVEC LES BORNES, ce que l'ancienne version ne faisait PAS.
 * Elle coupait le temps et gardait le texte ENTIER : une cue commencée 8 s avant le
 * début de l'extrait versait dans la fenêtre des mots prononcés AVANT le premier
 * plan — le spectateur lisait une phrase pendant qu'il en entendait une autre.
 * Mesuré sur l'extrait 338→359 s du replay de référence : 573 caractères annoncés pour
 * 21 s, soit un débit apparent de 27,3 car/s (le double du français parlé) et 7 cartons
 * sous 0,5 s. On retire donc, aux deux bouts, la part de texte correspondant à la part
 * de temps retirée — au mot près. Approximation, oui ; mais elle vaut infiniment mieux
 * qu'un sous-titre décalé d'une phrase entière.
 */
export function segmentsDeLaFenetre(segments, debut, fin) {
  return (Array.isArray(segments) ? segments : [])
    .filter((s) => Number.isFinite(s?.start) && Number.isFinite(s?.end))
    .filter((s) => s.end > debut && s.start < fin)
    .map((s) => {
      const duree = s.end - s.start;
      const start = Math.max(s.start, debut);
      const end = Math.min(s.end, fin);
      let text = String(s.text || '').trim();
      const perduDebut = duree > 0 ? (start - s.start) / duree : 0;
      const perduFin = duree > 0 ? (s.end - end) / duree : 0;
      // En dessous de 2 %, le rognage ne retirerait qu'une lettre ou deux : on n'abîme
      // pas un texte juste pour honorer un arrondi.
      if (perduDebut > 0.02 || perduFin > 0.02) {
        text = couperProportion(text, Math.max(0, perduDebut), Math.max(0, perduFin));
      }
      return { start, end, text };
    })
    .filter((s) => s.text.length > 0 && s.end - s.start >= 0.08)
    .sort((a, b) => a.start - b.start);
}

/**
 * Transforme les segments d'une fenêtre en UNITÉS D'AFFICHAGE : des cartons d'au plus
 * `maxLignes` × `maxCar` caractères, horodatés en secondes RELATIVES au début de
 * l'extrait.
 *
 * ⚠️ LE CALAGE DANS LE TEMPS EST UNE ESTIMATION, ET LA MANIÈRE DE L'ESTIMER COMPTE.
 * Une cue de transcription n'a qu'un instant de DÉPART (elles naissent d'une fusion de
 * phrases, pas d'un découpage temporel) : sa fin est le départ de la suivante, silence
 * compris. À l'intérieur, on ne sait rien.
 *
 * ⛔ Le prorata des caractères sur toute la fenêtre de la cue — la première version —
 * est FAUX dès qu'il y a une pause, et c'est mesuré sur le passage phare du replay de
 * référence : la cue « Je suis Shao cinquième Manikongo piste Vita Kimba » (49
 * caractères, ~3,5 s de parole) occupe une fenêtre de 11,75 s parce que l'orateur se
 * tait ensuite. Au prorata, le premier carton restait **7,7 s** à l'écran et le second
 * n'apparaissait qu'à 7,7 s — soit environ **5 s APRÈS avoir été prononcé**. Un
 * sous-titre en retard de 5 s sur une voix, en 104 px, se voit immédiatement.
 *
 * ✅ On alloue donc à chaque carton le temps que sa LONGUEUR implique
 * (longueur / 14 car/s, majoré de 15 % pour ne jamais devancer la voix), en cascade
 * depuis le début de la cue ; TOUT le temps restant est donné au DERNIER carton, qui
 * reste donc affiché jusqu'à la cue suivante.
 * Si la parole est plus dense que l'estimation (somme des durées > fenêtre), on revient
 * au prorata : c'est alors une compression, pas un décalage.
 *
 * ⚠️ POURQUOI LE DERNIER CARTON S'ATTARDE AU LIEU DE S'EFFACER. Une version bornait ce
 * reste à 5 s : sur l'extrait 653→679 s du replay de référence, la zone de texte se
 * retrouvait VIDE pendant 4,5 s en fin de clip, parce que l'estimation à 14 car/s est
 * une borne basse (l'orateur s'écoute, marque des temps DANS sa phrase) et sous-estime
 * la durée réelle de la parole. Dans une mise en page où le texte EST le contenu, une
 * zone vide se voit bien plus qu'un sous-titre qui s'attarde — et laisser le carton
 * jusqu'à la cue suivante est de toute façon le comportement normal d'un sous-titrage.
 * Cela reste une APPROXIMATION — elle est assumée ici et maquillée nulle part.
 *
 * Rend `[]` si la fenêtre ne contient aucune parole — l'appelant doit le traiter comme
 * « pas de sous-titres », jamais comme « texte vide à afficher ».
 */
export function decouperEnUnites(segments, debut, fin, opts = {}) {
  const maxCar = opts.maxCar || MAX_CAR_LIGNE;
  const maxLignes = opts.maxLignes || MAX_LIGNES_PAROLE;
  const unites = [];
  let tropRapides = 0;

  for (const seg of segmentsDeLaFenetre(segments, debut, fin)) {
    const lignes = couperEnLignes(seg.text, maxCar);
    // Regroupement en cartons de `maxLignes` lignes.
    const cartons = [];
    for (let i = 0; i < lignes.length; i += maxLignes) {
      cartons.push(lignes.slice(i, i + maxLignes));
    }
    if (cartons.length === 0) continue;

    const dureeSeg = seg.end - seg.start;
    const poids = cartons.map((c) => c.join(' ').length);
    const total = poids.reduce((a, b) => a + b, 0) || 1;

    // Durée que la LONGUEUR de chaque carton implique, au débit du français parlé.
    const estimees = poids.map((n) => Math.max(DUREE_UNITE_MIN, (n / CAR_PAR_SECONDE) * MARGE_DEBIT));
    const sommeEstimee = estimees.reduce((a, b) => a + b, 0);
    let durees;
    if (sommeEstimee <= dureeSeg) {
      durees = estimees.slice();
      // TOUT le reste de la cue revient au DERNIER carton — voir plus haut : un carton
      // qui s'attarde vaut mieux qu'une zone de texte vide.
      durees[durees.length - 1] += dureeSeg - sommeEstimee;
    } else {
      // Parole plus dense que l'estimation : prorata, donc compression uniforme.
      durees = poids.map((n) => (n / total) * dureeSeg);
    }

    let curseur = seg.start;
    cartons.forEach((lignesCarton, i) => {
      // La dernière unité ne dépasse JAMAIS la fin du segment : sans cette borne, les
      // arrondis successifs feraient déborder un carton sur la cue suivante et deux
      // sous-titres se superposeraient à l'écran.
      const finUnite = Math.min(seg.end, curseur + durees[i]);
      if (finUnite - curseur < DUREE_UNITE_MIN) tropRapides += 1;
      unites.push({
        debut: Math.max(0, curseur - debut),
        fin: Math.max(0, finUnite - debut),
        lignes: lignesCarton,
        texte: lignesCarton.join(' '),
      });
      curseur = finUnite;
    });
  }

  // Diagnostic attaché à la liste : combien de cartons défilent trop vite pour être
  // lus, et quel est le débit apparent. Un débit très supérieur à 14 car/s signale une
  // cue dont les bornes sont fausses, pas un défaut de découpe.
  const carTotal = unites.reduce((s, u) => s + u.texte.length, 0);
  const dureeTotale = unites.reduce((s, u) => s + (u.fin - u.debut), 0);
  unites.diagnostic = {
    unites: unites.length,
    caracteres: carTotal,
    debit_car_par_s: dureeTotale > 0 ? Number((carTotal / dureeTotale).toFixed(1)) : 0,
    trop_rapides: tropRapides,
    lignes_max: unites.reduce((m, u) => Math.max(m, u.lignes.length), 0),
    caracteres_ligne_max: unites.reduce(
      (m, u) => Math.max(m, ...u.lignes.map((l) => l.length)), 0,
    ),
  };
  return unites;
}

/**
 * LE GLOSSAIRE APPLIQUÉ À UN FLUX DE MOTS HORODATÉS.
 *
 * ⚠️ POURQUOI ON NE PEUT PAS SE CONTENTER DE CORRIGER LE TEXTE FINAL. Les mots
 * viennent de la re-transcription au mot (`short-bornes.js`), qui n'a jamais vu le
 * vocabulaire de l'école : elle rend « Vitakimpa », « Mani Kongo », « Takenaro ».
 * Corriger seulement la chaîne assemblée casserait la correspondance mot↔temps —
 * or c'est précisément elle qui fait tout l'intérêt de la passe.
 *
 * ⭐ LA RÈGLE EST SIMPLE ET JUSTE : une substitution remplace une SUITE CONTIGUË de
 * mots prononcés par une suite de mots affichés, et la nouvelle suite hérite de
 * l'INTERVALLE COMPLET de l'ancienne (début du premier, fin du dernier). Que le
 * nombre de mots change n'a aucune importance — « ciment qui margut » (3 mots) et
 * « Simon Kimbangu » (2 mots) occupent le même moment de l'enregistrement. Quand
 * un mot se développe en plusieurs, on partage son intervalle également : la
 * position d'un mot À L'INTÉRIEUR d'un mot prononcé n'a pas de sens, et personne
 * ne peut la percevoir sur un carton de sous-titre.
 *
 * Les substitutions sont déjà triées de la plus longue à la plus courte par
 * `preparerGlossaire` — on garde cet ordre, sans quoi « Kimbangu » consommerait la
 * moitié de « Simon Kimbangu ».
 */
export function appliquerGlossaireAuxMots(mots, glossaire) {
  const subs = glossaire?.substitutions || [];
  if (!Array.isArray(mots) || mots.length === 0 || subs.length === 0) {
    return { mots: mots || [], remplacements: [] };
  }
  const nu = (s) => String(s).toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9' ]/g, '').replace(/\s+/g, ' ').trim();

  let courant = mots.map((m) => ({ ...m }));
  const remplacements = [];

  for (const sub of subs) {
    const cible = nu(sub.avant);
    if (!cible) continue;
    const nbCible = cible.split(' ').length;
    for (let i = 0; i + nbCible <= courant.length; i += 1) {
      const fenetre = courant.slice(i, i + nbCible);
      if (nu(fenetre.map((m) => m.mot).join(' ')) !== cible) continue;

      // La ponctuation du DERNIER mot prononcé est conservée : elle marque une fin
      // de phrase, et c'est sur elle que `phrasesDepuisMots` s'appuie ensuite.
      const queue = (String(fenetre[fenetre.length - 1].mot).match(/[.,;:!?…»]+$/) || [''])[0];
      const t = fenetre[0].t;
      const e = fenetre[fenetre.length - 1].e;
      const nouveaux = String(sub.apres).split(/\s+/).filter(Boolean);
      const pas = nouveaux.length > 0 ? (e - t) / nouveaux.length : 0;
      const remplaçants = nouveaux.map((mot, k) => ({
        t: Math.round((t + k * pas) * 100) / 100,
        e: Math.round((t + (k + 1) * pas) * 100) / 100,
        mot: k === nouveaux.length - 1 ? mot + queue : mot,
      }));
      courant = [...courant.slice(0, i), ...remplaçants, ...courant.slice(i + nbCible)];
      remplacements.push({ avant: sub.avant, apres: sub.apres, t });
      i += remplaçants.length - 1;
    }
  }
  return { mots: courant, remplacements };
}

/**
 * LES MÊMES CARTONS, MAIS CALÉS SUR DES MOTS MESURÉS — pas estimés.
 *
 * ⭐ CE QUE ÇA CORRIGE, EN CHIFFRES. `decouperEnUnites` (ci-dessus) ne connaît que le
 * début et la fin d'une cue de ~20 s : elle répartit ce temps entre ses cartons AU
 * PRORATA DES CARACTÈRES, et verse tout le reliquat sur le dernier. Mesuré sur les
 * 5 extraits réellement produits pour le replay du 11 avril : **5 cartons sur 48
 * (10 %) tenus plus de 6 secondes**, jusqu'à **11,8 s** pour « Simon Kimbangu.
 * C'est » — et toujours le DERNIER carton d'une cue. Ce n'était pas un défaut de
 * découpe, c'était la signature d'un temps qui n'avait jamais été mesuré.
 *
 * Ici chaque carton commence au début de son premier mot et finit à la fin de son
 * dernier. Il n'y a plus ni débit supposé (14 car/s), ni reliquat à placer.
 *
 * ⚠️ ON NE COUPE JAMAIS AU MILIEU D'UN MOT : `couperEnLignes` décide des lignes sur
 * le TEXTE, puis on ré-associe ces lignes aux mots dans l'ordre. Les deux découpes
 * ne peuvent diverger que si un mot contient une espace, ce qui n'existe pas.
 *
 * `mots` = `[{t, e, mot}]` en secondes ABSOLUES (short-bornes.js les rend ainsi).
 * `debut`/`fin` = bornes de l'extrait, en secondes absolues. Les unités rendues sont
 * en secondes RELATIVES à `debut`, comme celles de `decouperEnUnites`.
 */
/**
 * Silence au-delà duquel un carton de sous-titre se ferme, en secondes.
 *
 * 1,0 s et non `PAUSE_PHRASE` (0,45 s) : on ne cherche pas ici une frontière de
 * PROPOS — c'est le travail de `short-bornes.js` — mais à empêcher un carton de
 * rester à l'écran pendant un blanc. Un souffle de 0,5 s au milieu d'une phrase ne
 * justifie pas de couper le sous-titre en deux ; une seconde de silence, si.
 */
const COUPURE_CARTON_SEC = 1.0;

export function decouperEnUnitesDepuisMots(mots, debut, fin, opts = {}) {
  const maxCar = opts.maxCar || MAX_CAR_LIGNE;
  const maxLignes = opts.maxLignes || MAX_LIGNES_PAROLE;
  const dedans = (Array.isArray(mots) ? mots : [])
    .filter((m) => m && Number.isFinite(m.t) && Number.isFinite(m.e) && m.e > debut && m.t < fin)
    .sort((a, b) => a.t - b.t);
  const unites = [];
  let tropRapides = 0;
  if (dedans.length === 0) {
    unites.diagnostic = {
      unites: 0, caracteres: 0, debit_car_par_s: 0, trop_rapides: 0,
      lignes_max: 0, caracteres_ligne_max: 0, source_temps: 'mot',
    };
    return unites;
  }

  // ⭐ LE TEMPS D'ABORD, LES CARACTÈRES ENSUITE — et l'ordre inverse a produit un
  // carton de 16,28 s EN PRODUCTION, après un premier correctif qui n'allait pas
  // assez loin.
  // `couperEnLignes` ne connaît que les CARACTÈRES : deux mots séparés par dix-huit
  // secondes de silence atterrissent dans la même ligne (« Cele, Takenaro »), et
  // aucune coupure appliquée ENTRE les lignes ne peut plus les séparer. On découpe
  // donc le flux en RUNS DE PAROLE CONTINUE d'abord, puis on met chaque run en
  // lignes. Une ligne ne peut alors plus enjamber un blanc, par construction.
  const runs = [];
  for (const m of dedans) {
    const cour = runs[runs.length - 1];
    if (cour && m.t - cour[cour.length - 1].e < COUPURE_CARTON_SEC) cour.push(m);
    else runs.push([m]);
  }

  const lignesAvecMots = [];
  for (const run of runs) {
    const lignes = couperEnLignes(run.map((m) => m.mot).join(' '), maxCar);
    // Combien de MOTS chaque ligne consomme. On avance dans le run au même rythme
    // que dans le texte : la ligne « Je suis Cheo » consomme trois mots, quelles que
    // soient leurs durées.
    let curseurMot = 0;
    for (const l of lignes) {
      const n = l.split(/\s+/).filter(Boolean).length;
      const tranche = run.slice(curseurMot, curseurMot + n);
      curseurMot += n;
      if (tranche.length) lignesAvecMots.push({ ligne: l, mots: tranche });
    }
  }

  // ⭐ UN CARTON NE DOIT JAMAIS ENJAMBER UN SILENCE — et l'avoir oublié a produit,
  // EN PRODUCTION, un carton de 18,96 s : pire que les 11,83 s de la voie estimée
  // qu'on remplaçait. Grouper les lignes par NOMBRE seulement suffit tant que la
  // parole est continue ; sur ce replay, le formateur psalmodie avec jusqu'à 21,7 s
  // entre deux mots (le banc l'avait mesuré, je ne l'avais pas relié). Deux lignes
  // consécutives DANS LE TEXTE peuvent donc être séparées par vingt secondes DANS
  // LE SON, et le carton reste affiché tout du long.
  // On coupe donc aussi sur le TEMPS : au-delà de `COUPURE_CARTON_SEC` entre la fin
  // d'une ligne et le début de la suivante, le carton se ferme, quel que soit le
  // nombre de lignes qu'il contient.
  const groupes = [];
  let enCours = [];
  for (const l of lignesAvecMots) {
    if (enCours.length > 0) {
      const finPrec = enCours[enCours.length - 1].mots[enCours[enCours.length - 1].mots.length - 1].e;
      const debutSuiv = l.mots[0].t;
      if (enCours.length >= maxLignes || debutSuiv - finPrec >= COUPURE_CARTON_SEC) {
        groupes.push(enCours);
        enCours = [];
      }
    }
    enCours.push(l);
  }
  if (enCours.length) groupes.push(enCours);

  for (const groupe of groupes) {
    const motsCarton = groupe.flatMap((g) => g.mots);
    if (motsCarton.length === 0) continue;
    const d = Math.max(debut, motsCarton[0].t);
    // ⚠️ LE CARTON TIENT AU MOINS `DUREE_UNITE_MIN`, MÊME MESURÉ. Trois mots
    // prononcés en 0,3 s existent (« et donc voilà ») ; les afficher 0,3 s produit
    // un clignotement illisible. On étire alors vers l'avant, sans jamais dépasser
    // la fin de l'extrait — l'unité suivante démarre à son propre premier mot, donc
    // un chevauchement d'un dixième de seconde reste possible et sans conséquence
    // visible (libass affiche le dernier déclaré).
    const f = Math.min(fin, Math.max(motsCarton[motsCarton.length - 1].e, d + DUREE_UNITE_MIN));
    if (f - d < DUREE_UNITE_MIN) tropRapides += 1;
    unites.push({
      debut: Math.max(0, d - debut),
      fin: Math.max(0, f - debut),
      lignes: groupe.map((g) => g.ligne),
      texte: groupe.map((g) => g.ligne).join(' '),
    });
  }

  const carTotal = unites.reduce((s, u) => s + u.texte.length, 0);
  const dureeTotale = unites.reduce((s, u) => s + (u.fin - u.debut), 0);
  unites.diagnostic = {
    unites: unites.length,
    caracteres: carTotal,
    debit_car_par_s: dureeTotale > 0 ? Number((carTotal / dureeTotale).toFixed(1)) : 0,
    trop_rapides: tropRapides,
    lignes_max: unites.reduce((m, u) => Math.max(m, u.lignes.length), 0),
    caracteres_ligne_max: unites.reduce((m, u) => Math.max(m, ...u.lignes.map((l) => l.length)), 0),
    // ⭐ La trace dit d'où vient le TEMPS, pas seulement le texte. Devant un carton
    // qui traîne, on doit pouvoir répondre « mesuré » ou « estimé » sans supposer.
    source_temps: 'mot',
    carton_le_plus_long_s: unites.reduce((m, u) => Math.max(m, Number((u.fin - u.debut).toFixed(2))), 0),
  };
  return unites;
}

/**
 * SRT correspondant EXACTEMENT à ce qui sera à l'écran (mêmes cartons, mêmes bornes).
 * C'est ce qu'on archive dans `short_clips.subtitle_srt` : la colonne doit attester du
 * texte AFFICHÉ, pas d'un texte parallèle que personne n'a vu.
 */
export function srtDesUnites(unites) {
  if (!unites || unites.length === 0) return null;
  const hms = (s) => new Date(Math.max(0, s) * 1000).toISOString().substr(11, 12).replace('.', ',');
  return unites
    .map((u, i) => `${i + 1}\n${hms(u.debut)} --> ${hms(u.fin)}\n${u.lignes.join('\n')}\n`)
    .join('\n');
}

// ─── Échappement ASS ───────────────────────────────────────────────────────
/**
 * Rend un texte quelconque inoffensif dans un champ `Text` de Dialogue ASS.
 *
 * Le jeu de métacaractères ASS est FERMÉ et court, c'est ce qui rend l'opération sûre
 * (contrairement à l'analyseur de filtres de ffmpeg, où le jeu dépend du filtre, du
 * niveau d'imbrication et des guillemets) :
 *   · `{` … `}` délimitent un bloc de balises d'override → deviennent des parenthèses.
 *     (`\{` n'est pas fiable d'un moteur à l'autre : on SUPPRIME la syntaxe, on ne
 *     tente pas de la neutraliser.)
 *   · `\` introduit une balise (`\N`, `\pos`, …) → devient une barre oblique.
 *   · les fins de ligne casseraient le format « une Dialogue par ligne » → espace.
 * Tout le reste — `:`, `%`, apostrophes, virgules, accents — est LITTÉRAL en ASS :
 * `Text` est le dernier champ de la ligne, les virgules n'y coupent plus rien.
 */
export function echapperAss(texte) {
  return String(texte ?? '')
    .replace(/\\/g, '/')
    .replace(/[{]/g, '(')
    .replace(/[}]/g, ')')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

/**
 * Le CHEMIN, lui, traverse bien l'analyseur de filtres. Il est fabriqué par nous
 * (tmpdir + UUID) donc sans caractère spécial — mais on ne le PRÉSUME pas : si le
 * chemin sortait un jour de l'ordinaire (variable TMPDIR exotique), on échappe les
 * trois caractères qui comptent pour ffmpeg plutôt que de construire une commande
 * fausse en silence.
 */
export function echapperCheminFiltre(chemin) {
  return String(chemin).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

/** Horodatage ASS : H:MM:SS.cc (centièmes). */
function tempsAss(sec) {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${r.toFixed(2).padStart(5, '0')}`;
}

/**
 * Prépare le titre : échappement, découpe en 2 lignes au plus, troncature si besoin.
 * Un titre de plus de 2 lignes déborderait sur la bande vidéo — on préfère un titre
 * coupé net à une mise en page cassée.
 */
export function preparerTitre(titre) {
  const brut = echapperAss(titre);
  if (!brut) return null;
  // ⚠️ ON REPLIE D'ABORD, ON TRONQUE ENSUITE. L'inverse — tronquer à 2 × 30 caractères
  // puis replier — était FAUX : le repli aux mots gaspille de la place, un titre de
  // 60 caractères peut demander 3 lignes, et la 3e (qui portait les points de
  // suspension) était alors jetée en silence. Mesuré sur « Je suis Shao, cinquième
  // Manikongo, héritier du cadavre vivant » : la coiffe affichait « … héritier du »,
  // coupée net, sans rien qui dise au lecteur qu'il manque la suite.
  const lignes = couperEnLignes(brut, MAX_CAR_TITRE);
  if (lignes.length <= MAX_LIGNES_TITRE) return lignes;
  const gardees = lignes.slice(0, MAX_LIGNES_TITRE);
  let derniere = gardees[MAX_LIGNES_TITRE - 1];
  if (derniere.length + 1 > MAX_CAR_TITRE) {
    derniere = derniere.slice(0, MAX_CAR_TITRE - 1).replace(/\s+\S*$/, '');
  }
  gardees[MAX_LIGNES_TITRE - 1] = `${derniere}…`;
  return gardees;
}

/**
 * Fabrique le fichier ASS complet d'un extrait.
 *
 * `geo` vient de `geometrieVerticale` : il porte les marges verticales calculées pour
 * CETTE mise en page (la bande vidéo n'a pas la même hauteur selon la source, donc la
 * zone de texte ne commence pas au même endroit).
 *
 * BorderStyle=3 (boîte opaque) et non un simple contour : c'est la garantie DEMANDÉE
 * que le texte ne se retrouve jamais clair sur clair. La boîte est peinte de la couleur
 * du fond LIRI, donc invisible tant que le texte est sur le fond (le cas normal, par
 * construction) et salvatrice s'il mordait un jour sur l'image. On peint la boîte à la
 * fois en OutlineColour et en BackColour parce que les moteurs ASS ne s'accordent pas
 * sur celle des deux qu'ils emploient pour la boîte — écrire les deux coûte zéro et
 * supprime la question.
 */
export function construireAss({ unites, lignesTitre, geo, duree }) {
  const fond = couleurAss(FOND_LIRI_HEX);
  const encre = couleurAss(ENCRE_LIRI);
  const or = couleurAss(OR_LIRI);
  const a = geo.ass;

  const entete = [
    '[Script Info]',
    '; Généré par short-generator.js — ne pas éditer à la main.',
    'ScriptType: v4.00+',
    'PlayResX: 1080',
    'PlayResY: 1920',
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    'YCbCr Matrix: None',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour,'
      + ' BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle,'
      + ' BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // Alignment=8 (haut-centre) : MarginV compte alors depuis le HAUT de la trame et
    // désigne le haut du bloc. Le bloc grandit donc vers le BAS — la première ligne ne
    // bouge jamais d'un carton à l'autre, ce qui est la seule façon de lire vite.
    // ⚠️ LE CORPS VIENT DE LA GÉOMÉTRIE, PAS D'UNE CONSTANTE (voir
    // `typographieParole`) : `geometrieVerticale` a dimensionné la zone, l'ancre et
    // la longueur de ligne pour CE corps-là. Réécrire `TAILLE_PAROLE` ici — ce que
    // faisait la version précédente — dessinerait un texte dont la taille ne
    // correspondrait plus à la place qu'on lui a réservée. Le repli existe pour les
    // appels anciens qui ne passent pas encore de `taille`.
    `Style: Parole,Noto Sans,${a.taille || TAILLE_PAROLE},${encre},${encre},${fond},${fond},`
      + `-1,0,0,0,100,100,0,0,3,10,0,8,${a.margeGauche},${a.margeDroite},${a.margeHauteParole},1`,
    `Style: Titre,Noto Sans,${TAILLE_TITRE},${or},${or},${fond},${fond},`
      + `-1,0,0,0,100,100,0,0,3,8,0,8,${MARGE_TITRE},${MARGE_TITRE},${a.margeHauteTitre},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  const evenements = [];
  if (lignesTitre && lignesTitre.length > 0) {
    // Le titre coiffe TOUT le clip : c'est une manchette, pas une incrustation fugace.
    evenements.push(
      `Dialogue: 0,${tempsAss(0)},${tempsAss(duree)},Titre,,0,0,0,,${lignesTitre.join('\\N')}`,
    );
  }
  for (const u of unites) {
    // `\N` = retour à la ligne DUR : c'est nous qui décidons de la coupe (voir
    // MAX_CAR_LIGNE), pas le repli automatique de libass.
    const texte = u.lignes.map((l) => echapperAss(l)).join('\\N');
    if (!texte) continue;
    evenements.push(
      `Dialogue: 0,${tempsAss(u.debut)},${tempsAss(u.fin)},Parole,,0,0,0,,${texte}`,
    );
  }

  return `${[...entete, ...evenements].join('\n')}\n`;
}

// ─── Le ffmpeg d'exécution sait-il DESSINER du texte ? ─────────────────────
const ASS_SONDE = `[Script Info]
ScriptType: v4.00+
PlayResX: 240
PlayResY: 120
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: S,Noto Sans,80,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:05.00,S,,0,0,0,,AGWM
`;

function lancerFfmpeg(args) {
  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const morceaux = [];
    let err = '';
    proc.stdout.on('data', (d) => morceaux.push(d));
    proc.stderr.on('data', (d) => (err += d.toString()));
    proc.on('error', (e) => resolve({ code: -1, sortie: Buffer.alloc(0), err: e.message }));
    proc.on('close', (code) => resolve({ code, sortie: Buffer.concat(morceaux), err }));
  });
}

let sondePromesse = null;

/**
 * ⚠️ LE REPLI SILENCIEUX EST INTERDIT ICI, ET C'EST TOUT L'OBJET DE CETTE SONDE.
 *
 * Avant, l'incrustation était tentée puis, en cas d'échec, on refabriquait le clip SANS
 * texte en écrivant une ligne d'avertissement dans le journal d'un conteneur que
 * personne ne lit. Tant que le sous-titre était un ornement, c'était supportable. Il est
 * maintenant LE CONTENU : un clip sans texte n'est plus « un peu moins bien », c'est un
 * clip vide de sens qu'on aurait publié en croyant l'avoir sous-titré.
 *
 * La sonde teste ce qui échoue réellement, et elle distingue les DEUX pannes :
 *   · ffmpeg sans libass → le filtre `ass` n'existe pas, le processus sort en erreur.
 *     (C'est le cas du ffmpeg Homebrew du poste de développement : 489 filtres, ni
 *     `ass`, ni `subtitles`, ni `drawtext`.)
 *   · libass présent mais AUCUNE POLICE → ffmpeg sort en 0, et ne dessine RIEN.
 *     Aucun code de retour ne le dit ; seule l'encre le dit. On rend donc une image et
 *     on regarde si elle contient autre chose que du noir.
 * L'image de production installe `ffmpeg fontconfig font-noto` (apps/worker/Dockerfile),
 * donc les deux cas doivent être verts en prod — mais on le VÉRIFIE au lieu de le croire.
 *
 * Mémoïsée : une seule sonde par processus (~0,2 s), pas une par extrait.
 */
export function capaciteSousTitres(journal = console) {
  if (sondePromesse) return sondePromesse;
  sondePromesse = (async () => {
    let dossier = null;
    try {
      dossier = await mkdtemp(join(tmpdir(), 'sonde-ass-'));
      const chemin = join(dossier, 'sonde.ass');
      await writeFile(chemin, ASS_SONDE);
      const { code, err, sortie } = await lancerFfmpeg([
        '-hide_banner', '-nostats', '-loglevel', 'error',
        '-f', 'lavfi', '-i', 'color=black:s=240x120:d=0.2',
        '-vf', `ass=${echapperCheminFiltre(chemin)}`,
        '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-',
      ]);
      if (code !== 0) {
        return {
          ok: false,
          motif: `ffmpeg refuse le filtre « ass » (libass absent de cette image) : ${String(err).slice(-160).trim()}`,
        };
      }
      // Encre = le pixel le plus clair de la trame. Fond noir + texte blanc : si rien
      // n'a été dessiné, le maximum reste 0.
      let encre = 0;
      for (const octet of sortie) if (octet > encre) encre = octet;
      if (encre < 40) {
        return {
          ok: false,
          motif: 'libass répond mais ne dessine RIEN (aucune police dans le conteneur : '
            + 'installer fontconfig + font-noto)',
          encre,
        };
      }
      return { ok: true, encre, motif: 'libass et police présentes' };
    } catch (e) {
      return { ok: false, motif: `sonde impossible : ${e.message}` };
    } finally {
      if (dossier) await rm(dossier, { recursive: true, force: true }).catch(() => {});
    }
  })();
  sondePromesse.then((r) => {
    if (r.ok) journal.log?.(`[short-gen] Sous-titres : ${r.motif} (encre ${r.encre}/255)`);
    else journal.error?.(`[short-gen] ⛔ SOUS-TITRES IMPOSSIBLES — ${r.motif}`);
  });
  return sondePromesse;
}

// ─── GLOSSAIRE DE L'ÉCOLE ──────────────────────────────────────────────────
/**
 * ⭐ POURQUOI UN GLOSSAIRE, ET POURQUOI IL EST LA PIÈCE MANQUANTE.
 *
 * La relecture par le modèle marchait — par intermittence. Mesuré sur le MÊME corpus,
 * deux tours à la suite : tour 1, 3 lignes corrigées sur 9 ; tour 2, **1 sur 9**, et la
 * ligne du clip phare non corrigée. Zéro invention aux deux tours (les garde-fous
 * tiennent), mais un taux de correction qui dépend de l'humeur du modèle. Un rendu qu'on
 * publie ne peut pas dépendre de ça.
 *
 * Et une partie du problème n'est pas soluble par le modèle, quel qu'il soit : l'orateur
 * s'appelle « Cheo », Whisper écrit « Shao ». AUCUN modèle ne peut le deviner — le nom
 * n'est ni célèbre ni déductible du contexte. Il est en revanche ÉCRIT SUR LA DIAPO
 * PARTAGÉE (« JE SUIS CHEO 5ieme manikongo… »). L'information existe, elle n'était juste
 * jamais donnée au correcteur. Le glossaire la lui donne.
 *
 * ⚠️ LE MOTEUR EST VIDE PAR DÉFAUT, ET CE N'EST PAS UN OUBLI. Cimolace est un SaaS
 * multi-tenant : « Cheo », « Manikongo », « Kimpa Vita » appartiennent à UNE école. Les
 * écrire ici les imposerait à la boutique de nutrition et au cabinet de téléconsultation
 * qui partagent ce worker. Le vocabulaire vit donc en base, par tenant
 * (`public.tenant_glossary`, migration 20260727180000_tenant_glossary.sql), et ce fichier
 * ne connaît AUCUN nom propre.
 *
 * ── DEUX COUCHES, ET LA PREMIÈRE NE COÛTE RIEN ───────────────────────────
 *   1. DÉTERMINISTE (`appliquerGlossaire`) : les graphies fautives DÉJÀ CONSTATÉES sont
 *      déclarées par l'école dans `variants[]` et remplacées mot entier, sans modèle.
 *      Reproductible par construction : 3 tours sur 3 donnent le même texte, et ça marche
 *      même sans clé IA. C'est la seule partie du dispositif dont on peut promettre le
 *      résultat.
 *   2. MODÈLE (`demandeCorrection`) : le glossaire lui est donné comme VOCABULAIRE
 *      FAISANT AUTORITÉ, pour les graphies fautives que personne n'a encore déclarées
 *      (« Chaud », « Shô », « Chéo »…). Là, on demande explicitement au modèle d'OSER —
 *      le défaut mesuré est la timidité, pas l'invention.
 */

/**
 * Longueur minimale d'un mot du glossaire pour qu'il PROUVE quelque chose.
 *
 * Deux usages, un seul seuil :
 *  · une graphie fautive de 3 lettres ou moins remplacée mot entier dans toute la
 *    transcription ferait plus de dégâts qu'elle n'en répare (« sao », « chao » sont
 *    des syllabes, pas des noms) ;
 *  · un mot de glossaire trop court ne peut pas servir de preuve d'ancrage : `motAncre`
 *    laisse déjà passer tout ce qui fait moins de 3 caractères.
 * 4 est la plus petite longueur qui porte un nom propre reconnaissable — et c'est
 * exactement celle de « Cheo ».
 */
const LONGUEUR_MIN_GLOSSAIRE = 4;
/**
 * Nombre maximal de termes envoyés au modèle. Une école qui déclare 400 noms ferait un
 * message plus long que la transcription à relire, avec deux effets mesurés ailleurs
 * dans ce fichier : la sortie coûte plus que l'entrée (JSON tronqué), et v4-pro se tait
 * quand la consigne s'allonge. On coupe, et on le DIT dans le journal.
 */
const MAX_TERMES_PROMPT = 60;

/** Échappe une chaîne pour l'insérer littéralement dans une expression régulière. */
function echapperRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Met en forme les entrées brutes du glossaire (telles que rendues par la base) en
 * l'objet que consomment le prompt, la substitution déterministe et l'ancrage.
 *
 * Rend TOUJOURS un objet exploitable, même vide — un glossaire absent est le cas normal
 * (SaaS multi-tenant), pas une erreur.
 *
 * `entrees` : [{ term, variants?: string[], category?: string }]
 */
export function preparerGlossaire(entrees) {
  const vide = { taille: 0, termes: [], substitutions: [], motsCanoniques: new Set(), tronque: 0 };
  if (!Array.isArray(entrees) || entrees.length === 0) return vide;

  const termes = [];
  const motsCanoniques = new Set();
  const substitutions = [];
  const dejaVu = new Set();

  for (const e of entrees) {
    const terme = String(e?.term ?? e?.terme ?? '').trim();
    if (!terme) continue;
    const cle = terme.toLowerCase();
    if (dejaVu.has(cle)) continue;
    dejaVu.add(cle);
    termes.push({ terme, categorie: String(e?.category ?? e?.categorie ?? '').trim() || null });

    // Un terme composé (« Kimpa Vita ») ancre chacun de ses mots : le contrôle
    // d'ancrage travaille mot à mot, il ne verrait jamais la locution entière.
    for (const mot of terme.split(/\s+/)) {
      const n = normaliserMot(mot);
      if (n.length >= LONGUEUR_MIN_GLOSSAIRE) motsCanoniques.add(n);
    }

    for (const v of Array.isArray(e?.variants) ? e.variants : (e?.variantes || [])) {
      const variante = String(v || '').trim();
      if (!variante) continue;
      // Une variante identique au terme ne remplacerait rien et créerait une boucle
      // de remplacement sur elle-même.
      if (variante.toLowerCase() === cle) continue;
      if (normaliserMot(variante.replace(/\s+/g, '')).length < LONGUEUR_MIN_GLOSSAIRE) continue;
      substitutions.push({ avant: variante, apres: terme });
    }
  }

  // Les variantes LONGUES d'abord : « Vita Kimba » → « Kimpa Vita » doit être tenté
  // avant une éventuelle variante d'un seul mot qui en consommerait la moitié.
  substitutions.sort((a, b) => b.avant.length - a.avant.length);
  for (const s of substitutions) {
    // `(^|[^lettre|chiffre])` plutôt que `\b` : `\b` ne connaît pas les accents en
    // JavaScript, « Vita » et « Vitä » n'y auraient pas la même frontière.
    s.motif = new RegExp(
      `(^|[^\\p{L}\\p{N}])(${echapperRegex(s.avant)})(?=[^\\p{L}\\p{N}]|$)`,
      'giu',
    );
  }

  const tronque = Math.max(0, termes.length - MAX_TERMES_PROMPT);
  return { taille: termes.length, termes, substitutions, motsCanoniques, tronque };
}

/**
 * Couche 1 : remplace les graphies fautives DÉCLARÉES par leur terme canonique.
 *
 * ⚠️ POURQUOI C'EST DÉFENDABLE ALORS QU'UN REMPLACEMENT AVEUGLE NE L'EST PAS.
 * Ce n'est pas le moteur qui décide que « Shao » veut dire « Cheo » : c'est l'école qui
 * l'a écrit dans son glossaire, après l'avoir constaté. Le moteur n'applique qu'une
 * substitution mot entier, insensible à la casse, sur un vocabulaire fini et scellé — le
 * MÊME mécanisme, aux mêmes conditions, que `corrigerTitre` (qui, lui, est déjà en
 * production). Aucun modèle n'intervient, donc aucune invention ne peut entrer par là :
 * ce qui sort est soit le texte d'origine, soit un mot du glossaire.
 *
 * Rend `{ texte, remplacements: [{avant, apres}] }`.
 */
export function appliquerGlossaire(texte, glossaire) {
  let out = String(texte ?? '');
  const remplacements = [];
  if (!glossaire || !glossaire.substitutions?.length || !out) return { texte: out, remplacements };
  for (const s of glossaire.substitutions) {
    s.motif.lastIndex = 0;
    out = out.replace(s.motif, (m, avantChar) => {
      remplacements.push({ avant: s.avant, apres: s.apres });
      return `${avantChar}${s.apres}`;
    });
  }
  return { texte: out, remplacements };
}

/**
 * Charge le glossaire d'un tenant depuis `public.tenant_glossary`.
 *
 * ⚠️ NON BLOQUANT DE BOUT EN BOUT, ET SILENCIEUX NULLE PART. Trois cas d'absence, trois
 * messages distincts — parce qu'un glossaire vide et une table absente ne se réparent
 * pas de la même façon :
 *   · pas de `tenantId` (appelant qui ne le passe pas encore) → glossaire vide ;
 *   · table absente (migration pas encore appliquée hors-bande) → on nomme le fichier
 *     .sql à passer, plutôt que de laisser un code PostgREST cru dans le journal ;
 *   · table présente et vide (le cas de TOUS les tenants sauf celui qui l'a remplie)
 *     → rien à dire, ce n'est pas une anomalie.
 * Dans les trois cas la relecture continue exactement comme avant ce commit.
 *
 * ⚠️ IMPORT DYNAMIQUE de supabase-js : ce module est aussi celui que l'on importe pour
 * éprouver la géométrie et la fabrique ASS (aucune base, aucun réseau). Un import
 * statique imposerait une dépendance et une variable d'environnement à des essais qui
 * n'en ont pas besoin.
 */
let avertiSansTenant = false;
export async function chargerGlossaire({ tenantId, supabase = null, journal = console } = {}) {
  if (!tenantId) {
    // ⚠️ CÂBLAGE. Cette fonction ne peut pas deviner l'école : `tenantId` doit lui venir
    // de l'appelant. Tant que `short-generator.js` ne le passe pas, le glossaire est
    // inerte — et un dispositif inerte qui ne le dit pas est pire que pas de dispositif.
    // Une fois par processus, pas une fois par extrait : ce message vaut consigne, pas
    // alarme, et la plupart des écoles n'ont de toute façon pas de vocabulaire.
    if (!avertiSansTenant) {
      avertiSansTenant = true;
      journal.log?.(
        '[short-gen] Relecture sans glossaire d\'école : `corrigerTranscription` a été appelée '
        + 'sans `tenantId`. Pour l\'activer, passer `tenantId` à l\'appel de '
        + 'short-generator.js (processVideoForShorts en dispose déjà).',
      );
    }
    return preparerGlossaire([]);
  }
  try {
    let client = supabase;
    if (!client) {
      const url = process.env.SUPABASE_URL;
      const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !cle) {
        journal.warn?.('[short-gen] Glossaire non chargé : SUPABASE_URL/SERVICE_ROLE_KEY absents');
        return preparerGlossaire([]);
      }
      ({ createClient: client } = await import('@supabase/supabase-js'));
      client = client(url, cle);
    }
    const { data, error } = await client
      .from('tenant_glossary')
      .select('term, variants, category')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .order('term', { ascending: true });
    if (error) {
      // 42P01 = relation absente côté Postgres ; PGRST205 = le cache de schéma de
      // PostgREST ne connaît pas la table. Même cause, deux codes selon le chemin.
      const absente = error.code === '42P01' || error.code === 'PGRST205';
      journal.warn?.(
        absente
          ? '[short-gen] Glossaire indisponible : la table public.tenant_glossary n\'existe pas '
            + 'sur cette base. Correctif : psql "$DATABASE_URL" -f '
            + 'supabase/migrations/20260727180000_tenant_glossary.sql (les migrations Cimolace '
            + 's\'appliquent hors-bande). La relecture continue sans vocabulaire d\'école.'
          : `[short-gen] Glossaire non chargé (${error.code || ''} ${error.message}) — relecture sans vocabulaire d'école`,
      );
      return preparerGlossaire([]);
    }
    const glo = preparerGlossaire(data || []);
    if (glo.taille > 0) {
      journal.log?.(
        `[short-gen] Glossaire de l'école : ${glo.taille} terme(s), `
        + `${glo.substitutions.length} graphie(s) fautive(s) déclarée(s)`
        + `${glo.tronque ? ` | ⚠️ ${glo.tronque} terme(s) non envoyés au modèle (plafond ${MAX_TERMES_PROMPT})` : ''}`,
      );
    }
    return glo;
  } catch (e) {
    journal.warn?.(`[short-gen] Glossaire non chargé (${e.message}) — relecture sans vocabulaire d'école`);
    return preparerGlossaire([]);
  }
}

// ─── Correction de la transcription ────────────────────────────────────────
/**
 * ⚠️ POURQUOI ON NE PEUT PAS AFFICHER LA TRANSCRIPTION TELLE QUELLE.
 *
 * Whisper écrit, pour le passage phare du replay de référence :
 *     « Je suis Shao cinquième Manikongo piste Vita Kimba. »
 * là où l'orateur dit :
 *     « Je suis Cheo, cinquième Manikongo, fils de Kimpa Vita. »
 * Tant que le texte était un ornement de 18 px en bas de trame, la faute passait
 * inaperçue. En 104 px au milieu de l'écran, elle EST le clip — et une faute de ce
 * calibre sur un nom propre décrédibilise plus sûrement qu'une absence de sous-titre.
 *
 * On fait donc RELIRE le passage par le modèle. C'est un exercice dangereux : à qui on
 * demande de corriger, on donne le pouvoir de réécrire. Trois garde-fous, dont deux
 * SERVEUR (une consigne ne se vérifie pas, un code oui) :
 *   1. la consigne interdit d'inventer et demande de RECOPIER en cas de doute ;
 *   2. le nombre de lignes rendues doit être exactement celui envoyé, sinon tout est
 *      refusé (une ligne fusionnée désaligne tout l'horodatage) ;
 *   3. chaque ligne est comparée à l'originale : longueur voisine ET majorité de mots
 *      ANCRÉS (identiques, même racine, ou à faible distance d'édition — « kimba » →
 *      « kimpa » passe, « le roi » ne passe pas). Une ligne qui échoue est REMPLACÉE
 *      PAR L'ORIGINALE : on perd une correction, on n'affiche jamais une invention.
 * L'original ET le corrigé sont tracés en base (`metadata.transcription`) : devant un
 * sous-titre douteux, on peut toujours savoir ce que la machine avait entendu.
 *
 * ⭐ ET DEPUIS LE GLOSSAIRE : LE DÉFAUT MESURÉ N'EST PLUS L'INVENTION, C'EST LA TIMIDITÉ.
 * Deux tours sur le même corpus ont donné 3 corrections sur 9, puis 1 sur 9 — avec zéro
 * invention aux deux tours. Les garde-fous font donc leur travail ; ce qui manquait était
 * la MATIÈRE. La consigne ci-dessous change d'équilibre en conséquence : « en cas de
 * doute, recopie » reste la règle pour tout le texte ordinaire, mais sur les noms du
 * glossaire — et sur EUX SEULS — on demande au modèle d'oser, et on lui dit que recopier
 * y est une faute.
 */
const SYSTEME_CORRECTION =
  "Tu es correcteur de transcription automatique en français. On te donne des lignes "
  + "produites par une reconnaissance vocale sur une séance enregistrée : elles contiennent "
  + "des fautes d'AUDITION (noms propres mal entendus, mots recoupés au mauvais endroit). "
  + "Tu corriges ce qui a été mal ENTENDU. Tu ne réécris pas, tu ne résumes pas, tu "
  + "n'ajoutes rien. Quand on te donne le vocabulaire officiel de l'école, il fait "
  + "AUTORITÉ sur la graphie de la machine. Tu réponds toujours en JSON strict.";

/**
 * Le bloc « vocabulaire » du message. Vide quand l'école n'a rien déclaré — et le reste
 * du message est alors EXACTEMENT celui d'avant, pour que l'absence de glossaire ne soit
 * jamais une régression.
 *
 * ⚠️ AUCUN NOM PROPRE N'EST ÉCRIT ICI. L'exemple d'insistance (« recopier une graphie
 * approchante quand le vocabulaire dit … est une faute ») est fabriqué avec le PREMIER
 * TERME DU TENANT, pas avec un nom en dur : le même code doit servir une école du Kongo
 * et un cabinet de nutrition.
 */
function blocVocabulaire(glossaire) {
  if (!glossaire || glossaire.taille === 0) return '';
  const liste = glossaire.termes.slice(0, MAX_TERMES_PROMPT);
  const exemple = liste[0].terme;
  return `
VOCABULAIRE OFFICIEL DE CETTE ÉCOLE — ORTHOGRAPHE FAISANT AUTORITÉ
Ces noms ont été saisis à la main par l'école. C'est leur orthographe EXACTE, vérifiée.
${liste.map((t) => `- ${t.terme}${t.categorie ? ` (${t.categorie})` : ''}`).join('\n')}

⭐ SUR CES NOMS-LÀ, TU DOIS OSER CORRIGER.
La reconnaissance vocale les a presque tous mal entendus : ce sont des noms qu'aucune
machine ne connaît. Quand une suite de sons de la transcription peut rendre l'un de ces
noms — même si peu de lettres correspondent, même si le nom a été coupé en deux mots,
collé à son voisin ou mis dans le désordre — ÉCRIS LE NOM DU VOCABULAIRE.
⛔ Ne recopie PAS la graphie de la machine « par prudence » sur ces noms : ici, c'est la
machine qui a tort et le vocabulaire qui a raison. Laisser une graphie approchante là où
le vocabulaire dit « ${exemple} » est une FAUTE, pas une prudence — cette ligne sera
affichée en très gros caractères et le nom sera lu par tout le monde.
⚠️ Le vocabulaire n'autorise QUE ça. Il ne te permet pas de placer un de ces noms là où
rien n'y ressemble à l'oreille : tu répares une audition, tu ne semes pas des mots. Et
pour TOUT LE RESTE du texte, la règle « en cas de doute, recopie » reste entière.
`;
}

function demandeCorrection(lignes, titre, glossaire = null) {
  const vocabulaire = blocVocabulaire(glossaire);
  return `Séance : « ${titre || 'Séance enregistrée'} ».
Ces ${lignes.length} lignes vont être affichées EN GROS comme sous-titres d'un extrait vidéo.
${vocabulaire}
RÈGLES ABSOLUES
- Rends EXACTEMENT ${lignes.length} lignes, mêmes numéros, même ordre.
- Tu ne corriges QUE ce que la machine a mal entendu : noms propres, mots agglutinés ou
  coupés au mauvais endroit, accords manifestes, ponctuation qui aide à lire.
- ⛔ N'AJOUTE AUCUNE INFORMATION. N'invente ni mot, ni nom, ni chiffre. Ne résume pas,
  ne rallonge pas, ne traduis pas, ne change pas le style ni le registre.
- ⛔ EN CAS DE DOUTE, RECOPIE LA LIGNE À L'IDENTIQUE${vocabulaire ? ' — SAUF sur les noms du vocabulaire ci-dessus, où le doute se tranche EN FAVEUR DU VOCABULAIRE' : ''}. Une ligne recopiée est un bon
  résultat ; une ligne réécrite est une faute grave.
- Une correction doit rester PROCHE À L'OREILLE : une suite de sons peut être réécrite
  autrement (mêmes sons, recoupés autrement) mais ne peut pas devenir un mot qui ne
  sonne pas comme elle — ce ne serait plus une correction.
- Tu peux supprimer une répétition immédiate identique (« la la loi » → « la loi »).
- ⭐ LES NOMS PROPRES SONT LA PREMIÈRE CAUSE DE FAUTE, et la plus visible à l'écran.
  Avant de recopier une suite de sons qui ressemble à un nom, demande-toi quel nom de
  personne, de lieu, de peuple ou d'école ces sons peuvent rendre DANS LE SUJET DE LA
  SÉANCE${vocabulaire ? ' — EN COMMENÇANT PAR LE VOCABULAIRE CI-DESSUS' : ''}.
  Rétablis l'orthographe ET L'ORDRE DES MOTS du nom quand les sons y conduisent.
  Si aucun nom ne colle, recopie.

FORMAT DE RÉPONSE
{"lignes":[{"i":1,"texte":"…"}]}

LIGNES À RELIRE
${lignes.map((l, i) => `${i + 1}. ${l.texte}`).join('\n')}`;
}

function resoudreFournisseur() {
  const ds = process.env.DEEPSEEK_API_KEY;
  // ⛔ `deepseek-chat` / `deepseek-reasoner` ont été SUPPRIMÉS par le fournisseur (HTTP
  // 400). Et surtout PAS `v4-pro` ici — MESURÉ sur ce lot de 4 lignes réelles :
  //   · v4-flash + cette consigne  : rend « fils de Kimpa Vita » et ne touche à rien
  //     d'autre. 8,7 s.
  //   · v4-pro + consigne courte   : rend la même correction MAIS invente au passage un
  //     lieu, « Roche-en-Courroux », à partir de « roche en courroux ». 31 s.
  //   · v4-pro + cette consigne    : HTTP 200, 3 999 jetons de raisonnement, `content`
  //     VIDE. 55 s pour rien.
  // Le modèle à raisonnement coûte plus cher, répond plus lentement, invente davantage
  // et se tait quand la consigne s'allonge.
  if (ds && ds !== 'replace_me') {
    return { url: 'https://api.deepseek.com/chat/completions', cle: ds, modele: 'deepseek-v4-flash', nom: 'deepseek' };
  }
  const groq = process.env.GROQ_API_KEY;
  if (groq && groq !== 'replace_me') {
    return { url: 'https://api.groq.com/openai/v1/chat/completions', cle: groq, modele: 'llama-3.3-70b-versatile', nom: 'groq' };
  }
  return null;
}

function lireJson(brut) {
  const s = String(brut || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(s); } catch { /* le modèle a bavardé autour */ }
  const d = s.indexOf('{');
  const f = s.lastIndexOf('}');
  if (d >= 0 && f > d) return JSON.parse(s.slice(d, f + 1));
  throw new Error('réponse non JSON');
}

/** Normalisation pour comparer des mots : minuscules, sans accents ni ponctuation. */
export function normaliserMot(m) {
  return String(m).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

/** Distance de Levenshtein bornée (on ne s'intéresse jamais aux grandes distances). */
export function distanceEdition(a, b, plafond = 3) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > plafond) return plafond + 1;
  let prec = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cour = [i];
    let mini = i;
    for (let j = 1; j <= b.length; j += 1) {
      const c = Math.min(
        prec[j] + 1,
        cour[j - 1] + 1,
        prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      cour[j] = c;
      if (c < mini) mini = c;
    }
    if (mini > plafond) return plafond + 1;
    prec = cour;
  }
  return prec[b.length];
}

/**
 * Un mot du GLOSSAIRE peut-il être la bonne graphie de quelque chose qui a été entendu
 * dans cette ligne-là ?
 *
 * ⚠️ POURQUOI LA SEULE PRÉSENCE AU GLOSSAIRE NE SUFFIT PAS. Premier jet : « tout mot du
 * glossaire est ancré ». Éprouvé sur des lignes fabriquées exprès, il laissait passer
 * « la prière prend fin » → « **Kimpa Vita** prend fin » : le reste de la ligne étant
 * intact, l'ancrage tombait à 3/4 et la ligne était acceptée. Un nom du vocabulaire
 * PLANTÉ là où rien ne l'appelle est exactement ce que le garde-fou doit refuser — et
 * c'est même la faute la plus crédible, puisque c'est nous qui avons demandé au modèle
 * d'oser sur ces mots.
 *
 * ✅ On exige donc que le mot du glossaire soit une RÉ-AUDITION plausible d'un mot de
 * l'original, avec un plafond de distance BEAUCOUP plus large que celui de `motAncre`
 * (moitié du mot, minimum 2, contre un tiers) — assez large pour « shao » → « cheo »
 * (2 substitutions sur 4 lettres, que `motAncre` refuse), assez étroit pour que
 * « prière » ne devienne pas « Kimpa ».
 *
 * Ce qu'aucun plafond ne rattrapera — « ciment qui margut » → « Simon Kimbangu », mesuré
 * à 0 correction sur 4 tours — n'est de toute façon pas du ressort du modèle : c'est le
 * rôle des variantes DÉCLARÉES, qui ne passent pas par ce contrôle puisqu'aucun modèle
 * n'intervient.
 */
function motGlossaireAncre(mot, motsOrigine) {
  const plafond = Math.max(2, Math.ceil(mot.length / 2));
  for (const o of motsOrigine) {
    if (distanceEdition(o, mot, plafond) <= plafond) return true;
  }
  return false;
}

/** Un mot corrigé est-il « déjà là » dans la ligne d'origine ? */
export function motAncre(mot, motsOrigine) {
  if (mot.length < 3) return true; // les outils grammaticaux ne prouvent rien
  for (const o of motsOrigine) {
    if (o === mot) return true;
    if (o.length >= 5 && mot.length >= 5 && o.slice(0, 4) === mot.slice(0, 4)) return true;
    const plafond = Math.max(1, Math.round(mot.length / 3));
    if (distanceEdition(o, mot, plafond) <= plafond) return true;
  }
  return false;
}

/** Part maximale de mots non ancrés tolérée dans une ligne corrigée. */
const ANCRAGE_MIN = 0.6;
/** Fourchette de longueur admise pour une correction (une correction ≠ une réécriture). */
const LONGUEUR_MIN = 0.55;
const LONGUEUR_MAX = 1.5;

/**
 * Verdict serveur sur UNE ligne corrigée. Rend `{ok, motif, ancrage}`.
 * Exporté parce que c'est la pièce qu'on veut pouvoir éprouver seule.
 *
 * ⛔ LE CONFLIT QU'IL FALLAIT RÉGLER, SINON LE GLOSSAIRE NE SERVAIT À RIEN.
 * L'ancrage exige que la majorité des mots rendus soient « déjà là » dans l'original. Or
 * une correction de nom propre CHANGE le mot, par définition : « Shao » → « Cheo » fait
 * 2 substitutions sur 4 lettres, et le plafond de `motAncre` pour un mot de 4 lettres
 * vaut 1. Le mot corrigé est donc jugé NON ANCRÉ. Sur une ligne longue le reste de la
 * phrase absorbait le coup ; sur une ligne courte — et une ligne de sous-titre EST
 * courte — pas : « Je suis Shao » → « Je suis Cheo » donne 1 mot porteur ancré sur 2,
 * soit 0,50 < 0,60, et la correction était REFUSÉE. Le glossaire aurait fait corriger le
 * modèle pour que le garde-fou annule sa correction juste après.
 *
 * ✅ RÈGLE AJOUTÉE : un mot qui figure au glossaire de l'école est ancré. Ce n'est pas un
 * assouplissement du contrôle, c'est le rappel de ce qu'il contrôle. Le garde-fou existe
 * pour exiger que chaque mot affiché vienne d'une SOURCE VÉRIFIABLE et non de
 * l'imagination du modèle. La transcription est une source ; le glossaire en est une
 * autre, et une meilleure — un humain l'a écrit. Un mot présent dans le glossaire est
 * donc ancré par construction, exactement comme un mot présent dans l'original.
 *
 * ⚠️ ET LA BRÈCHE QUE ÇA OUVRIRAIT, REFERMÉE DEUX FOIS.
 *   · EN NOMBRE : les mots ancrés PAR LE SEUL GLOSSAIRE sont plafonnés à un tiers des
 *     mots porteurs de la ligne (au moins 1). Au-delà ils cessent de compter, l'ancrage
 *     s'effondre, la ligne est refusée. Une correction de nom propre en touche un ou
 *     deux ; une ligne qui en « corrige » cinq sur douze n'est plus une correction.
 *   · EN RESSEMBLANCE : le mot du glossaire doit rester une ré-audition plausible d'un
 *     mot de l'original (`motGlossaireAncre`). Sans ce second verrou — et c'était le
 *     premier jet — « la prière prend fin » → « Kimpa Vita prend fin » passait : un seul
 *     nom planté, le reste de la ligne intact, 3 mots ancrés sur 4.
 * Les deux autres garde-fous (nombre de lignes, fourchette de longueur) restent intacts
 * et inchangés.
 */
export function verdictCorrection(avant, apres, opts = {}) {
  const a = String(avant || '').trim();
  const b = String(apres || '').trim();
  if (!b) return { ok: false, motif: 'ligne vide' };
  if (a === b) return { ok: true, motif: 'inchangée', ancrage: 1, change: false };
  const ratio = b.length / Math.max(1, a.length);
  if (ratio < LONGUEUR_MIN || ratio > LONGUEUR_MAX) {
    return { ok: false, motif: `longueur ×${ratio.toFixed(2)} (réécriture, pas correction)` };
  }
  const motsAvant = a.split(/\s+/).map(normaliserMot).filter(Boolean);
  const motsApres = b.split(/\s+/).map(normaliserMot).filter(Boolean);
  const porteurs = motsApres.filter((m) => m.length >= 3);
  if (porteurs.length === 0) return { ok: true, motif: 'rien à ancrer', ancrage: 1, change: true };

  const motsGlossaire = opts.glossaire?.motsCanoniques || null;
  const plafondGlossaire = Math.max(1, Math.floor(porteurs.length / 3));
  let ancres = 0;
  let parGlossaire = 0;
  for (const m of porteurs) {
    if (motAncre(m, motsAvant)) { ancres += 1; continue; }
    if (motsGlossaire?.has(m)
      && parGlossaire < plafondGlossaire
      && motGlossaireAncre(m, motsAvant)) {
      parGlossaire += 1;
      ancres += 1;
    }
  }
  const ancrage = ancres / porteurs.length;
  if (ancrage < ANCRAGE_MIN) {
    return {
      ok: false,
      motif: `${ancres}/${porteurs.length} mots ancrés dans l'original`
        + `${parGlossaire ? ` (dont ${parGlossaire} par le glossaire)` : ''}`,
      ancrage,
      glossaire: parGlossaire,
    };
  }
  return { ok: true, motif: 'corrigée', ancrage, change: true, glossaire: parGlossaire };
}

/**
 * Paires de substitution (mot mal entendu → mot corrigé) déduites d'une correction DÉJÀ
 * VALIDÉE. Sert à propager la correction au TITRE, qui a été écrit par le sélecteur sur
 * la transcription fautive (« Je suis Shao cinquième Manikongo »).
 *
 * ⚠️ ON NE REDEMANDE RIEN AU MODÈLE. Le titre a passé le contrôle d'ancrage de
 * short-highlights sur le texte BRUT ; y appliquer une substitution mot à mot issue
 * d'une correction déjà contrôlée ne peut pas y introduire d'invention. Refaire écrire
 * le titre, si.
 *
 * Prudence : on n'apparie que des mots d'au moins 4 lettres, à faible distance, et
 * seulement si le meilleur candidat est STRICTEMENT meilleur que le suivant — sans quoi
 * on remplacerait au hasard parmi des mots équidistants.
 */
export function pairesDeCorrection(avant, apres) {
  const mots = (s) => String(s || '').split(/\s+/).filter(Boolean);
  const normSet = (s) => new Set(mots(s).map(normaliserMot).filter(Boolean));
  const dansApres = normSet(apres);
  const dansAvant = normSet(avant);
  const disparus = mots(avant).filter((m) => {
    const n = normaliserMot(m);
    return n.length >= 4 && !dansApres.has(n);
  });
  const apparus = mots(apres).filter((m) => {
    const n = normaliserMot(m);
    return n.length >= 4 && !dansAvant.has(n);
  });
  const paires = [];
  for (const d of disparus) {
    const nd = normaliserMot(d);
    const scores = apparus
      .map((a) => ({ a, d: distanceEdition(nd, normaliserMot(a), 3) }))
      .sort((x, y) => x.d - y.d);
    const meilleur = scores[0];
    const suivant = scores[1];
    const plafond = Math.max(2, Math.round(nd.length / 3));
    if (!meilleur || meilleur.d > plafond) continue;
    if (suivant && suivant.d <= meilleur.d) continue; // ambigu → on s'abstient
    // Le remplaçant doit garder la capitale : on ne substitue que des noms propres.
    if (!/^[A-ZÀ-Ý]/.test(meilleur.a)) continue;
    paires.push({ avant: d.replace(/[^\p{L}\p{N}'-]/gu, ''), apres: meilleur.a.replace(/[^\p{L}\p{N}'-]/gu, '') });
  }
  return paires;
}

/** Applique les paires à un titre, mot entier, insensible à la casse. */
export function corrigerTitre(titre, paires) {
  let out = String(titre || '');
  for (const p of paires) {
    if (!p.avant || !p.apres) continue;
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${p.avant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[^\\p{L}\\p{N}]|$)`, 'giu');
    out = out.replace(re, (m, pre) => `${pre}${p.apres}`);
  }
  return out;
}

/**
 * Relit et corrige un lot de lignes. NON BLOQUANT : si le modèle est absent, lent ou
 * refusé, on rend les lignes d'origine et on le DIT. Aucune fabrication ne doit échouer
 * parce que la relecture a échoué.
 *
 * `lignes` : [{ ref, texte }] — `ref` est une clé opaque rendue telle quelle.
 * `tenantId` : facultatif. Fourni, il fait charger le GLOSSAIRE de l'école (voir plus
 *   haut) ; absent, tout se passe exactement comme avant — un moteur multi-tenant ne
 *   peut pas exiger un vocabulaire que la plupart des écoles n'ont pas rempli.
 * `glossaire` : facultatif — glossaire déjà préparé ou entrées brutes, pour les essais
 *   et pour un appelant qui l'aurait déjà en main. Court-circuite la lecture en base.
 * Rend `{ textes: Map(ref → texte affiché), trace }`.
 */
export async function corrigerTranscription({
  lignes, titre, journal = console, budgetMs = 120000,
  tenantId = null, glossaire = null, supabase = null,
}) {
  const textes = new Map();
  const trace = {
    demandees: 0,
    corrigees: 0,
    refusees: 0,
    modele: null,
    motif: null,
    exemples: [],
    // Le glossaire se TRACE, comme la relecture : devant un sous-titre douteux, il faut
    // pouvoir répondre « ce nom vient du vocabulaire de l'école », pas le supposer.
    glossaire: { termes: 0, substitutions: 0, mots_ancres: 0, exemples: [] },
  };
  const utiles = (lignes || []).filter((l) => l && String(l.texte || '').trim().length > 0);
  for (const l of utiles) textes.set(l.ref, l.texte);
  if (utiles.length === 0) return { textes, trace };

  // ── Glossaire : préparé, fourni, ou chargé pour ce tenant ────────────────
  let glo;
  if (glossaire && glossaire.motsCanoniques instanceof Set) glo = glossaire;
  else if (Array.isArray(glossaire)) glo = preparerGlossaire(glossaire);
  else glo = await chargerGlossaire({ tenantId, supabase, journal });
  trace.glossaire.termes = glo.taille;

  // ── COUCHE 1 — DÉTERMINISTE, ET AVANT TOUT APPEL DE MODÈLE ───────────────
  // Elle est placée ici, et pas après la relecture, pour trois raisons :
  //  · elle marche même quand il n'y a AUCUNE clé IA (le `return` ci-dessous) ;
  //  · le modèle reçoit alors un texte déjà juste sur ces noms-là, donc il ne les
  //    « re-corrige » pas dans une autre direction ;
  //  · et le contrôle d'ancrage compare la proposition du modèle au texte RÉELLEMENT
  //    affiché à cet instant, pas à une version périmée.
  for (const l of utiles) {
    const { texte: corrige, remplacements } = appliquerGlossaire(l.texte, glo);
    if (remplacements.length === 0) continue;
    textes.set(l.ref, corrige);
    trace.glossaire.substitutions += remplacements.length;
    for (const r of remplacements) {
      if (trace.glossaire.exemples.length < 12) trace.glossaire.exemples.push(`${r.avant} → ${r.apres}`);
    }
  }
  if (trace.glossaire.substitutions > 0) {
    journal.log?.(
      `[short-gen] Glossaire appliqué SANS modèle : ${trace.glossaire.substitutions} graphie(s) `
      + `remplacée(s) (${[...new Set(trace.glossaire.exemples)].join(', ')})`,
    );
  }

  const fournisseur = resoudreFournisseur();
  if (!fournisseur) {
    trace.motif = 'aucune clé IA configurée — transcription affichée telle quelle';
    journal.warn?.(`[short-gen] Relecture des sous-titres impossible : ${trace.motif}`);
    return { textes, trace };
  }
  trace.modele = fournisseur.modele;
  trace.demandees = utiles.length;

  // ⚠️ DES LOTS COURTS, ET UN BUDGET DE JETONS LARGE — les deux ont été payés.
  // Le modèle doit RECOPIER tout le texte qu'on lui envoie, en plus de raisonner
  // dessus : la sortie coûte facilement trois fois l'entrée. Mesuré sur un lot réel de
  // 11 lignes (~2 700 caractères) avec un plafond de 4 000 jetons : HTTP 200, JSON
  // TRONQUÉ en plein tableau (« Expected ',' or ']' … at position 909 »), lot entier
  // perdu, zéro correction. Lots de 3 000 caractères, plafond élargi à chaque essai.
  // ⚠️ ON ENVOIE LE TEXTE D'APRÈS LA COUCHE DÉTERMINISTE, pas le texte brut : sans cela
  // le modèle recevrait « Shao » alors que l'affichage dit déjà « Cheo », et sa réponse
  // serait comparée à un texte qui n'existe plus.
  const aRelire = utiles.map((l) => ({ ref: l.ref, texte: textes.get(l.ref) ?? l.texte }));
  const lots = [];
  let lot = [];
  let taille = 0;
  for (const l of aRelire) {
    if (lot.length > 0 && taille + l.texte.length > 3000) { lots.push(lot); lot = []; taille = 0; }
    lot.push(l); taille += l.texte.length;
  }
  if (lot.length) lots.push(lot);

  const echeance = Date.now() + budgetMs;
  const appeler = async (courant) => {
    let derniere = null;
    for (let essai = 0; essai < 3; essai += 1) {
      const reste = echeance - Date.now();
      if (reste < 5000) throw derniere || new Error('budget de temps épuisé');
      try {
        const res = await fetch(fournisseur.url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${fournisseur.cle}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: fournisseur.modele,
            messages: [
              { role: 'system', content: SYSTEME_CORRECTION },
              { role: 'user', content: demandeCorrection(courant, titre, glo) },
            ],
            response_format: { type: 'json_object' },
            max_tokens: Math.min(16000, Math.round(8000 * (1 + essai * 0.5))),
            temperature: 0.1,
          }),
          // ⚠️ 45 s par appel et 120 s de budget, PAS l'inverse : avec un budget de
          // 45 s et un délai d'attente de 40 s, la première tentative consommait tout et
          // les deux autres mouraient sur un reliquat de 5 s. Mesuré : v4-flash répond en
          // 9 à 40 s sur ce lot selon la charge — il faut de la place pour au moins deux
          // vraies tentatives. Un encodage dure des minutes : 2 min de relecture au pire
          // n'est pas ce qui coûte cher, une relecture perdue si.
          signal: AbortSignal.timeout(Math.max(5000, Math.min(45000, reste))),
        });
        if (!res.ok) {
          const e = new Error(`${fournisseur.nom} ${res.status}`);
          e.status = res.status;
          throw e;
        }
        const json = await res.json();
        const contenu = String(json?.choices?.[0]?.message?.content ?? '').trim();
        if (!contenu) throw new Error('réponse VIDE (budget de jetons absorbé par le raisonnement)');
        return lireJson(contenu);
      } catch (e) {
        derniere = e;
        journal.warn?.(`[short-gen] Relecture tentative ${essai + 1}/3 — ${e.message}`);
        const surcharge = e.status === 429 || (typeof e.status === 'number' && e.status >= 500);
        if (surcharge && essai < 2) await new Promise((r) => setTimeout(r, 1200 * 2 ** essai));
      }
    }
    throw derniere || new Error('appel impossible');
  };

  for (const courant of lots) {
    try {
      const rendu = await appeler(courant);
      const recues = Array.isArray(rendu?.lignes) ? rendu.lignes : [];
      // Garde-fou n°2 : un décompte différent désaligne l'horodatage. Tout ou rien.
      if (recues.length !== courant.length) {
        throw new Error(`${recues.length} ligne(s) rendue(s) pour ${courant.length} envoyée(s)`);
      }
      recues.forEach((r, i) => {
        const origine = courant[i].texte;
        const propose = String(r?.texte ?? '').trim();
        // Le glossaire entre ICI dans le garde-fou : sans lui, une correction de nom
        // propre sur une ligne courte serait refusée pour « mots non ancrés » (voir
        // `verdictCorrection`) et le vocabulaire de l'école n'aurait servi à rien.
        const v = verdictCorrection(origine, propose, { glossaire: glo });
        if (!v.ok) {
          trace.refusees += 1;
          journal.warn?.(`[short-gen] Correction refusée (${v.motif}) : « ${origine.slice(0, 60)} » → « ${propose.slice(0, 60)} »`);
          return;
        }
        if (!v.change) return;
        textes.set(courant[i].ref, propose);
        trace.corrigees += 1;
        trace.glossaire.mots_ancres += v.glossaire || 0;
        if (trace.exemples.length < 12) {
          trace.exemples.push({ avant: origine.slice(0, 220), apres: propose.slice(0, 220), ancrage: Number((v.ancrage ?? 1).toFixed(2)) });
        }
      });
    } catch (e) {
      trace.motif = `lot non corrigé (${e.message})`;
      journal.warn?.(`[short-gen] Relecture des sous-titres : ${trace.motif} → texte brut conservé pour ce lot`);
    }
  }

  journal.log?.(
    `[short-gen] Relecture des sous-titres (${fournisseur.modele}) : ${trace.corrigees} ligne(s) corrigée(s), `
    + `${trace.refusees} refusée(s) par le garde-fou, sur ${trace.demandees}`
    + `${glo.taille ? ` | glossaire de l'école : ${glo.taille} terme(s), ${trace.glossaire.substitutions} substitution(s) sans modèle, ${trace.glossaire.mots_ancres} mot(s) ancré(s) par lui` : ' | aucun glossaire pour cette école'}`,
  );
  return { textes, trace };
}
