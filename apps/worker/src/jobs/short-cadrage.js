/**
 * short-cadrage.js — OÙ EST LE CONTENU DANS L'IMAGE, ET COMMENT LE POSER EN 9:16.
 *
 * ── LE PROBLÈME, MESURÉ ────────────────────────────────────────────────────
 * Le replay de référence est un partage d'écran 1920×942 (2,04:1). Mis à l'échelle
 * de la largeur sur une trame 1080×1920, il donne une bande de 1080×530 : 100 % des
 * pixels sont conservés, mais **72,4 % de la trame est du fond vide** et le corps de
 * texte de la diapo tombe à 15 px, soit 0,78 % de la hauteur de trame — alors que le
 * plancher lisible du sous-titrage mobile est 3 %.
 *
 * ⚠️ L'ARITHMÉTIQUE QUI COMMANDE TOUT, ET QU'AUCUNE ASTUCE NE CONTOURNE :
 *        hauteur_finale_du_caractère = hauteur_source × min(1080/largeur_rognée,
 *                                                            hauteur_dispo/hauteur_rognée)
 * La taille du texte ne dépend QUE de l'échelle, donc essentiellement de la LARGEUR
 * qu'on décide de garder. Pour amener un caractère de 26 px (le corps de la diapo de
 * référence) à 3 % de 1920 = 57,6 px, il faudrait une échelle de 2,2, donc ne garder
 * que 487 px de large sur 1920 : **75 % de la diapo jetée, chaque ligne coupée**.
 * Le plancher de 3 % est donc INATTEIGNABLE sur une diapo dense sans la mutiler ; il
 * a été calibré pour des SOUS-TITRES (FontSize 58), pas pour du texte de diapo.
 * Ce qu'on peut gagner honnêtement, on le gagne ici — et on dit où on s'arrête.
 *
 * ── LES DEUX GISEMENTS RÉELS ───────────────────────────────────────────────
 *  1. LES MARGES MORTES. Un partage d'écran porte presque toujours des zones sans
 *     aucun contenu : bande noire des participants, marges de la fenêtre, plages
 *     vides sous la diapo. On les retire — et rien d'actif n'est perdu.
 *  2. LES GOUTTIÈRES. Une diapo en deux colonnes se lit aussi bien en deux BANDES
 *     EMPILÉES, et l'empilement rend à chaque colonne toute la largeur de la trame.
 *     Mesuré sur l'extrait de référence : échelle 0,562 → 0,727, soit +29 % de taille
 *     de caractère, SANS couper une seule lettre (la coupe passe dans une colonne de
 *     pixels vide sur toute la hauteur, dans TOUTES les sondes).
 *
 * ── MÉTHODE DE DÉTECTION (et pourquoi celle-là) ────────────────────────────
 * On sonde K instants de la fenêtre de l'extrait — jamais un seul. Pour chaque
 * cellule d'une grille grossière on retient deux faits :
 *   · ACTIVE  : elle porte du gradient (du texte, un trait, une image) dans AU MOINS
 *               UNE sonde. C'est une UNION : une ligne qui n'apparaît qu'à la fin de
 *               l'extrait est déjà dans la boîte, donc jamais coupée.
 *   · ANIMÉE  : son contenu change d'une sonde à l'autre presque à chaque fois.
 *
 * ⛔ POURQUOI PAS `cropdetect` : mesuré sur CE replay, il rend 1668×942 à t=30,
 *    1920×942 à t=680 et **1920×858 à t=1100** — cette dernière sonde aurait amputé
 *    84 px de diapo. Un outil qui coupe parfois le contenu ne peut pas décider seul.
 *    L'union sur plusieurs sondes est précisément le remède à cette instabilité :
 *    une sonde qui sous-détecte est écrasée par les autres.
 *
 * ⛔ POURQUOI LE MOUVEMENT, ET PAS UNE HEURISTIQUE DE VISAGE : la passe précédente a
 *    essayé de reconnaître « visage centré » par la part de détail de la colonne
 *    centrale — mesuré, une vraie diapo donnait 0,38 et un portrait 0,40 : le critère
 *    ne sépare RIEN. Le mouvement, lui, sépare parfaitement : sur ce replay le bougé
 *    médian par cellule vaut **0,00 sur la diapo** (une image fixe partagée) et
 *    **63 à 93 au p90 sur la vignette caméra Zoom**. Les deux populations ne se
 *    touchent même pas. C'est ce qui permet de retirer la vignette — laquelle, à elle
 *    seule, interdisait tout gain : elle occupe le seul coin mort de la trame.
 *
 * ⛔ CE QU'ON NE RETIRE JAMAIS : un contenu animé qui ne touche AUCUN bord (une vidéo
 *    insérée dans la diapo) est entouré de contenu fixe — il est donc déjà à
 *    l'intérieur de la boîte et son retrait ne changerait rien. Et si la scène ENTIÈRE
 *    bouge (plan caméra plein cadre), il ne reste pas assez de contenu fixe : on
 *    renonce et on garde l'image entière. Fail-safe, pas fail-open.
 */

import { spawn } from 'child_process';

// Largeur d'analyse. 960 et non 480 : en dessous, la réduction moyenne les pixels et
// un trait fin de diapo passe sous le seuil de gradient — on perdrait du contenu réel.
const LARGE_ANALYSE = 960;
// Côté d'une cellule, en pixels d'analyse. 4 → 8 px source sur une source 1920 :
// assez fin pour cerner une marge, assez gros pour ignorer le bruit de compression.
const CELL = 4;
// Nombre de sondes. 6 sur une fenêtre de 30 s = une image toutes les 5 s : assez pour
// voir un changement de diapo en cours d'extrait, assez peu pour rester à ~1 s de ffmpeg.
const SONDES = 6;
// Un pixel est « encre » si le gradient local dépasse ce seuil (sur 255).
const SEUIL_GRADIENT = 16;
// Une cellule est active si elle contient au moins ce nombre de pixels d'encre.
const ENCRE_MIN = 2;
// Bougé médian au-delà duquel une cellule est dite ANIMÉE (différence absolue moyenne
// entre sondes consécutives). Mesuré : diapo 0,00 / vignette caméra 63+. Le seuil est
// posé très bas dans le vide qui sépare les deux populations.
const SEUIL_BOUGE = 3;
// Marge de sûreté rendue au contenu après détection, en fraction de la dimension.
// La grille est grossière (8 px source) et une lettre peut mordre la cellule voisine.
const MARGE = 0.012;
// Gain d'échelle minimal en dessous duquel on ne rogne PAS : rogner pour 3 % de plus,
// c'est prendre un risque de cadrage sans rien rendre de lisible.
const GAIN_MIN_ROGNAGE = 1.08;
// Idem pour la découpe en colonnes, plus exigeante : elle change la COMPOSITION.
const GAIN_MIN_COLONNES = 1.12;
// Largeur minimale d'une gouttière, en fraction de la largeur source. 2,2 % = 42 px
// sur 1920 : au-dessous, on tomberait sur les filets d'un tableau, dont l'empilement
// détruirait l'alignement des lignes.
const GOUTTIERE_MIN = 0.022;
// Une colonne issue d'une découpe doit peser au moins ça, sinon la « colonne » n'est
// qu'un ornement en marge et l'empiler coûte de la hauteur pour rien.
const COLONNE_MIN = 0.18;
// Part maximale de la trame qu'un bloc animé peut occuper pour être considéré comme
// une VIGNETTE (au-delà : c'est le sujet, pas une incrustation).
const VIGNETTE_MAX = 0.25;
// Part MAXIMALE du contenu actif qui peut être animée pour qu'on ose encore retirer
// la vignette. C'est un RAPPORT et pas un seuil absolu : une diapo est majoritairement
// blanche, donc « 12 % de la trame en contenu fixe » désigne aussi bien un document
// dense qu'un écran presque vide — mesuré, deux fenêtres du même replay tombaient à
// 0,119 et 0,121, de part et d'autre d'un seuil absolu, et basculaient de « vignette
// retirée » à « rien retiré ». Le rapport, lui, dit ce qu'on veut vraiment savoir :
// le mouvement est-il un DÉTAIL de la scène (vignette) ou en est-il le SUJET (plan
// caméra) ? Mesuré sur ce replay : 3 % — un détail, sans ambiguïté.
const ANIME_MAX_DU_CONTENU = 0.5;
// Plancher absolu, seulement pour ne pas calculer un rapport sur du bruit.
const CONTENU_MIN = 0.03;

/**
 * Sonde K images d'une fenêtre, en NIVEAUX DE GRIS BRUTS.
 *
 * ⚠️ RAWVIDEO ET PAS PNG. Le worker n'a aucun décodeur d'image en JS (et on ne va pas
 * ajouter une dépendance pour ça) : `-f rawvideo -pix_fmt gray` rend un tampon d'octets
 * directement indexable, un octet par pixel. On connaît la largeur qu'on a demandée,
 * donc la hauteur se déduit de la taille du tampon — aucune supposition.
 *
 * `-ss` AVANT `-i` : recherche rapide par images-clés, sinon un extrait pris à 1 h 40
 * d'un replay de 2 h coûterait 100 minutes de décodage (même leçon que createShortClip).
 */
function sonderImages(fichier, debut, duree, largeur) {
  const pas = Math.max(0.5, duree / SONDES);
  return new Promise((resolve) => {
    const args = [
      '-v', 'error',
      '-ss', String(Math.max(0, debut)),
      '-t', String(Math.max(1, duree)),
      '-i', fichier,
      '-an',
      // `scale=L:-2` garde le rapport d'image et force une hauteur PAIRE.
      '-vf', `fps=1/${pas},scale=${largeur}:-2,format=gray`,
      '-f', 'rawvideo', '-',
    ];
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const morceaux = [];
    let taille = 0;
    proc.stdout.on('data', (d) => { morceaux.push(d); taille += d.length; });
    proc.stderr.on('data', () => {});
    proc.on('error', () => resolve(null));   // ffmpeg absent : l'appelant se rabat
    proc.on('close', (code) => {
      if (code !== 0 || taille === 0) return resolve(null);
      resolve(Buffer.concat(morceaux, taille));
    });
  });
}

/** Grille d'activité (gradient) d'une image en niveaux de gris. */
function carteActivite(px, L, H, wc, hc) {
  const act = new Uint8Array(wc * hc);
  // Gradient « droite + bas ». Un aplat rend 0 ; une lettre rend beaucoup.
  for (let y = 0; y < hc * CELL; y++) {
    const ligne = y * L;
    for (let x = 0; x < wc * CELL; x++) {
      const v = px[ligne + x];
      const dx = x + 1 < L ? Math.abs(px[ligne + x + 1] - v) : 0;
      const dy = y + 1 < H ? Math.abs(px[ligne + L + x] - v) : 0;
      if (dx + dy > SEUIL_GRADIENT) {
        const c = ((y / CELL) | 0) * wc + ((x / CELL) | 0);
        if (act[c] < 255) act[c]++;
      }
    }
  }
  return act;
}

/** Boîte englobante des cellules vraies. */
function boiteDe(masque, wc, hc) {
  let x0 = wc, y0 = hc, x1 = -1, y1 = -1;
  for (let y = 0; y < hc; y++) {
    for (let x = 0; x < wc; x++) {
      if (!masque[y * wc + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

/**
 * PÈLE LES FILETS ISOLÉS aux quatre bords de la boîte.
 *
 * Un partage d'écran est bordé de TRAITS : la frontière entre la diapo blanche et la
 * bande noire des participants, le cadre de la fenêtre, une règle de PowerPoint. Le
 * critère de gradient les voit comme du contenu — un trait vertical d'un pixel qui
 * court sur toute la hauteur est même l'un des plus « actifs » de l'image.
 *
 * MESURÉ : sur l'extrait de référence, la seule frontière blanc/noir à x≈1671 tenait la
 * boîte ouverte jusqu'à 1694 alors que la diapo s'arrête à 1660 — d'où un bandeau noir
 * parasite dans le clip fini. On retire donc une colonne (ou une ligne) de bord quand
 * les cellules qui la suivent VERS L'INTÉRIEUR sont toutes vides : du texte n'est jamais
 * seul, il a des voisins. Au plus 3 pelures par bord, pour qu'un bug de mesure ne puisse
 * jamais grignoter du contenu réel.
 */
const CREUX = 4;          // profondeur de vide exigée derrière un filet, en cellules
const FILET_MAX = 2;      // épaisseur maximale d'un filet, en cellules (16 px source)
const PELURES_MAX = 3;

function pelerFiletsIsoles(masque, b, wc) {
  // Un bord est décrit par : « la ligne/colonne d'indice i est-elle active ? », le sens
  // vers l'intérieur, et de quoi lire/écrire la borne. Les quatre bords partagent la
  // même mécanique — la duplication serait une invitation à corriger trois fois sur quatre.
  const actifCol = (x) => {
    for (let y = b.y0; y < b.y1; y++) if (masque[y * wc + x]) return true;
    return false;
  };
  const actifLig = (y) => {
    for (let x = b.x0; x < b.x1; x++) if (masque[y * wc + x]) return true;
    return false;
  };
  const bords = [
    { actif: () => actifCol, bord: 'x1', oppose: 'x0', sens: -1, decalage: -1 },
    { actif: () => actifCol, bord: 'x0', oppose: 'x1', sens: +1, decalage: 0 },
    { actif: () => actifLig, bord: 'y1', oppose: 'y0', sens: -1, decalage: -1 },
    { actif: () => actifLig, bord: 'y0', oppose: 'y1', sens: +1, decalage: 0 },
  ];
  for (const e of bords) {
    const actif = e.actif();
    for (let n = 0; n < PELURES_MAX; n++) {
      const dedans = Math.abs(b[e.bord] - b[e.oppose]);
      if (dedans <= (CREUX + FILET_MAX) * 2) break;   // trop peu de matière pour juger
      const depart = b[e.bord] + e.decalage;
      // Épaisseur du filet accolé au bord (le blanc/noir d'un partage d'écran fait
      // souvent 2 cellules : la transition et son anticrénelage).
      let ep = 0;
      while (ep <= FILET_MAX && actif(depart + ep * e.sens)) ep++;
      if (ep === 0 || ep > FILET_MAX) break;          // pas un filet : du contenu
      let creux = true;
      for (let k = 0; creux && k < CREUX; k++) creux = !actif(depart + (ep + k) * e.sens);
      if (!creux) break;                              // du contenu juste derrière
      b[e.bord] += ep * e.sens;
      // Le bord peut désormais tomber sur du vide : on le resserre sur la matière.
      while (Math.abs(b[e.bord] - b[e.oppose]) > 1 && !actif(b[e.bord] + e.decalage)) {
        b[e.bord] += e.sens;
      }
    }
  }
}

/**
 * Détecte la région utile de l'image sur la fenêtre [debut, debut+duree].
 * Rend `null` quand il n'y a RIEN à décider (ffmpeg indisponible, sondes trop peu
 * nombreuses, pas assez de contenu fixe) : l'appelant garde alors la mise à l'échelle
 * de l'image entière, qui ne détruit jamais rien.
 */
export async function detecterRegionUtile({ fichier, debut, duree, largeur, hauteur }) {
  const L = Number(largeur) || 0;
  const H = Number(hauteur) || 0;
  if (!fichier || !L || !H || !(duree > 0)) return null;

  const largeurAnalyse = Math.min(LARGE_ANALYSE, Math.round(L / 2) * 2) || LARGE_ANALYSE;
  const tampon = await sonderImages(fichier, debut, duree, largeurAnalyse);
  if (!tampon) return null;

  // Hauteur d'analyse : déduite de la taille du tampon, pas supposée. `scale=-2` a pu
  // arrondir : on cherche la hauteur paire qui divise exactement le tampon.
  const attendue = Math.round((largeurAnalyse * H) / L / 2) * 2;
  let hAnalyse = attendue;
  if (tampon.length % (largeurAnalyse * hAnalyse) !== 0) {
    hAnalyse = 0;
    for (let h = attendue - 4; h <= attendue + 4; h += 2) {
      if (h > 0 && tampon.length % (largeurAnalyse * h) === 0) { hAnalyse = h; break; }
    }
    if (!hAnalyse) return null;
  }
  const parImage = largeurAnalyse * hAnalyse;
  const nb = tampon.length / parImage;
  if (nb < 2) return null;   // sans deux sondes on ne peut ni unir ni mesurer un bougé

  const wc = Math.floor(largeurAnalyse / CELL);
  const hc = Math.floor(hAnalyse / CELL);
  const actif = new Uint8Array(wc * hc);
  const bouges = [];
  let precedente = null;

  for (let i = 0; i < nb; i++) {
    const px = tampon.subarray(i * parImage, (i + 1) * parImage);
    const a = carteActivite(px, largeurAnalyse, hAnalyse, wc, hc);
    // UNION : actif dans au moins une sonde. Un texte qui apparaît en cours d'extrait
    // entre dans la boîte, donc ne sera pas coupé.
    for (let c = 0; c < actif.length; c++) if (a[c] >= ENCRE_MIN) actif[c] = 1;
    if (precedente) {
      // ⚠️ DIFFÉRENCE ABSOLUE, PAS DIFFÉRENCE DES MOYENNES : un visage qui bouge
      // conserve à peu près la même luminance moyenne ; c'est le contenu qui change.
      const d = new Float32Array(wc * hc);
      for (let y = 0; y < hc; y++) {
        for (let x = 0; x < wc; x++) {
          let s = 0;
          for (let j = 0; j < CELL; j++) {
            const l1 = (y * CELL + j) * largeurAnalyse;
            for (let k = 0; k < CELL; k++) {
              s += Math.abs(px[l1 + x * CELL + k] - precedente[l1 + x * CELL + k]);
            }
          }
          d[y * wc + x] = s / (CELL * CELL);
        }
      }
      bouges.push(d);
    }
    // Copie obligatoire : `px` est une VUE sur le tampon partagé, pas une image à soi.
    precedente = Uint8Array.from(px);
  }

  // ANIMÉ = bougé MÉDIAN élevé. La médiane, et pas la moyenne : un seul changement de
  // diapo en cours d'extrait ferait exploser une moyenne et ferait passer toute la
  // diapo pour une vidéo.
  const anime = new Uint8Array(wc * hc);
  for (let c = 0; c < anime.length; c++) {
    const vals = bouges.map((d) => d[c]).sort((a, b) => a - b);
    const med = vals.length % 2 ? vals[(vals.length - 1) / 2]
      : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2;
    if (med > SEUIL_BOUGE) anime[c] = 1;
  }

  const fixe = Uint8Array.from(actif);
  const bAnime = boiteDe(anime, wc, hc);
  let vignette = null;
  if (bAnime) {
    const aire = ((bAnime.x1 - bAnime.x0) * (bAnime.y1 - bAnime.y0)) / (wc * hc);
    // Accolée à un bord ? Sinon c'est une vidéo INSÉRÉE, entourée de diapo : la retirer
    // ne changerait rien à la boîte, et la retirer « pour de vrai » serait une faute.
    const colle = bAnime.x0 <= wc * 0.03 || bAnime.x1 >= wc * 0.97
      || bAnime.y0 <= hc * 0.03 || bAnime.y1 >= hc * 0.97;
    if (colle && aire <= VIGNETTE_MAX) {
      // On l'étend jusqu'aux bords qu'elle frôle ET d'un liseré tout autour : le CADRE
      // de la vignette et son ÉTIQUETTE DE NOM, eux, ne bougent pas. Mesuré : sans ce
      // liseré, l'étiquette « L'arbre du Manikong… » survivait à 28 px de la vignette
      // et suffisait à ramener la boîte de 1660 à 1710 — un bandeau noir parasite dans
      // le clip fini, pour 28 px de texte d'interface Zoom que personne ne lit.
      const lisereX = Math.max(1, Math.round(wc * 0.016));
      const lisereY = Math.max(1, Math.round(hc * 0.016));
      const v = {
        x0: Math.max(0, bAnime.x0 - lisereX), x1: Math.min(wc, bAnime.x1 + lisereX),
        y0: Math.max(0, bAnime.y0 - lisereY), y1: Math.min(hc, bAnime.y1 + lisereY),
      };
      if (v.x1 >= wc * 0.90) v.x1 = wc;
      if (v.x0 <= wc * 0.10) v.x0 = 0;
      if (v.y1 >= hc * 0.90) v.y1 = hc;
      if (v.y0 <= hc * 0.10) v.y0 = 0;
      for (let y = v.y0; y < v.y1; y++) for (let x = v.x0; x < v.x1; x++) fixe[y * wc + x] = 0;
      vignette = v;
    }
  }

  let nActif = 0;
  let nFixe = 0;
  let nAnimeActif = 0;
  for (let c = 0; c < actif.length; c++) {
    if (actif[c]) nActif++;
    if (fixe[c]) nFixe++;
    if (actif[c] && anime[c]) nAnimeActif++;
  }
  const partFixe = nFixe / fixe.length;
  // ⚠️ MESURÉ SUR CE QUI BOUGE, PAS SUR CE QU'ON A RETIRÉ. Une première version
  // calculait ce rapport après la soustraction de la vignette : quand les garde-fous
  // refusaient de la retirer (plan caméra plein cadre), le rapport valait 0 et le
  // journal affirmait « rien ne bouge » sur un plan qui ne fait que ça.
  const partAnimeeDuContenu = nActif ? nAnimeActif / nActif : 0;

  // Le mouvement est-il le SUJET de la scène (plan caméra plein cadre) plutôt qu'un
  // détail ? Alors on ne retire rien : c'est le cas où un rognage « intelligent » se
  // tromperait le plus lourdement — il découperait quelqu'un.
  let masque = fixe;
  let vignetteRetiree = Boolean(vignette);
  if (partAnimeeDuContenu > ANIME_MAX_DU_CONTENU || nActif / actif.length < CONTENU_MIN) {
    masque = actif;
    vignetteRetiree = false;
  }

  const b = boiteDe(masque, wc, hc);
  if (!b) return null;
  pelerFiletsIsoles(masque, b, wc);

  // ⚠️ NE JAMAIS FAIRE RENTRER PAR LE CADRAGE CE QUE LA DÉTECTION A MIS DEHORS.
  // Retirer la vignette du MASQUE ne retire pas ses pixels : si la boîte reste ouverte
  // au-delà pour une autre raison (ici la trame de points du fond de diapo, active
  // jusqu'à x=1667 alors que la vignette commence à 1656), un lambeau de vignette
  // revient dans le clip — mesuré : 34 px d'étiquette Zoom au coin de la seconde bande.
  // On rabat donc la boîte sur la vignette, mais du SEUL côté où cela coûte le moins,
  // et jamais si ce côté emporte plus de 15 % de la boîte : une vignette en haut à
  // droite touche aussi le bord HAUT, et rabattre par le haut couperait le titre.
  // Bord éventuellement RABATTU sur la vignette. Retenu pour la suite : c'est le seul
  // endroit où la marge de sûreté doit être suspendue (voir plus bas).
  let bordRabattu = null;
  if (vignette && vignetteRetiree) {
    const aire = (b.x1 - b.x0) * (b.y1 - b.y0);
    const clips = [];
    if (vignette.x1 >= wc && vignette.x0 > b.x0) clips.push({ bord: 'x1', v: vignette.x0, perte: (b.x1 - vignette.x0) * (b.y1 - b.y0) });
    if (vignette.x0 <= 0 && vignette.x1 < b.x1) clips.push({ bord: 'x0', v: vignette.x1, perte: (vignette.x1 - b.x0) * (b.y1 - b.y0) });
    if (vignette.y1 >= hc && vignette.y0 > b.y0) clips.push({ bord: 'y1', v: vignette.y0, perte: (b.y1 - vignette.y0) * (b.x1 - b.x0) });
    if (vignette.y0 <= 0 && vignette.y1 < b.y1) clips.push({ bord: 'y0', v: vignette.y1, perte: (vignette.y1 - b.y0) * (b.x1 - b.x0) });
    const meilleur = clips.filter((c) => c.perte > 0).sort((a, c) => a.perte - c.perte)[0];
    if (meilleur && meilleur.perte <= aire * 0.15) {
      b[meilleur.bord] = meilleur.v;
      bordRabattu = meilleur.bord;
    }
  }

  // Grille → pixels source, marge de sûreté, bornes paires.
  const ech = L / (wc * CELL);
  const mx = Math.round(L * MARGE);
  const my = Math.round(H * MARGE);

  // ── LA MARGE DE SÛRETÉ NE DOIT PAS REMETTRE LA VIGNETTE DANS LA BANDE ──────
  // La marge (1,2 %, soit 23 px sur 1920) existe pour UNE raison : la grille est
  // grossière (8 px source) et une lettre peut mordre la cellule voisine, alors on rend
  // au contenu ce que l'arrondi lui a pris. Du côté de la vignette, ce qui suit la
  // frontière n'est pas une lettre : c'est la vignette elle-même, que la détection vient
  // de mettre dehors — et son bloc animé a déjà été élargi d'un liseré de 32 px avant
  // d'être soustrait, précisément pour emporter son CADRE et son ÉTIQUETTE DE NOM, qui,
  // eux, ne bougent pas. Rendre 23 px de ce côté revient à remettre un ruban de cadre
  // Zoom dans le clip fini.
  //
  // MESURÉ sur le replay de référence (1920×942, vignette caméra en haut à droite) :
  //   fenêtre 653 s → boîte rabattue à 1664, marge → 1686 : 22 px de vignette gardés
  //   fenêtre 739 s → boîte déjà à 1680,   marge → 1702 : 22 px de vignette gardés
  // Le second cas montre pourquoi il ne suffit PAS de neutraliser la marge sur le bord
  // « rabattu » : là, aucun rabattement n'a eu lieu (la boîte s'arrêtait déjà pile sur
  // la vignette, le rabattement n'aurait rien gagné) et la marge la faisait rentrer
  // quand même.
  //
  // ⚠️ ON TESTE DES RECTANGLES, PAS DES BORDS. Une vignette en haut à droite touche
  // AUSSI le bord haut : raisonner par bord supprimerait la marge HAUTE, qui s'étend
  // pourtant sur toute la largeur de la boîte, à gauche de la vignette — et couperait
  // 11 px de diapo pour rien (vérifié : la marge haute reste bien à 36 px sur ce
  // replay). Chaque marge est un RUBAN ; on ne la supprime que si ce ruban recouvre
  // vraiment la vignette.
  // Limite assumée : deux marges voisines conservées peuvent laisser un COIN de
  // 23 × 11 px effleurer la vignette. Il tombe dans le liseré de 32 px déjà ajouté
  // autour d'elle, donc dans du cadre, jamais dans le visage.
  const bx0 = Math.round(b.x0 * CELL * ech);
  const by0 = Math.round(b.y0 * CELL * ech);
  const bx1 = Math.round(b.x1 * CELL * ech);
  const by1 = Math.round(b.y1 * CELL * ech);
  const vg = (vignette && vignetteRetiree)
    ? {
      x0: Math.round(vignette.x0 * CELL * ech), x1: Math.round(vignette.x1 * CELL * ech),
      y0: Math.round(vignette.y0 * CELL * ech), y1: Math.round(vignette.y1 * CELL * ech),
    }
    : null;
  // Chevauchement STRICT : deux rectangles qui ne se touchent que par un bord (le cas
  // exact d'une boîte qui s'arrête pile sur la vignette) ne se recouvrent pas.
  const mord = (rx0, ry0, rx1, ry1) => Boolean(vg)
    && rx1 > vg.x0 && rx0 < vg.x1 && ry1 > vg.y0 && ry0 < vg.y1;
  let x1 = Math.min(L, mord(bx1, by0, bx1 + mx, by1) ? bx1 : bx1 + mx);
  let x0 = Math.max(0, mord(bx0 - mx, by0, bx0, by1) ? bx0 : bx0 - mx);
  let y1 = Math.min(H, mord(bx0, by1, bx1, by1 + my) ? by1 : by1 + my);
  let y0 = Math.max(0, mord(bx0, by0 - my, bx1, by0) ? by0 : by0 - my);
  x0 -= x0 % 2; y0 -= y0 % 2;
  let bl = (x1 - x0) - ((x1 - x0) % 2);
  let bh = (y1 - y0) - ((y1 - y0) % 2);
  if (bl < 32 || bh < 32) return null;

  // ── GOUTTIÈRES : colonnes VIDES sur toute la hauteur de la boîte, dans TOUTES les
  // sondes (le masque est déjà l'union). Une coupe qui passe là ne traverse, par
  // construction, aucune lettre.
  const gouttieres = [];
  {
    const cx0 = Math.max(0, Math.floor(x0 / ech / CELL));
    const cx1 = Math.min(wc, Math.ceil((x0 + bl) / ech / CELL));
    const cy0 = Math.max(0, Math.floor(y0 / ech / CELL));
    const cy1 = Math.min(hc, Math.ceil((y0 + bh) / ech / CELL));
    let deb = null;
    for (let x = cx0; x <= cx1; x++) {
      let vide = x < cx1;
      for (let y = cy0; vide && y < cy1; y++) if (masque[y * wc + x]) vide = false;
      if (vide && deb === null) deb = x;
      else if (!vide && deb !== null) {
        // Bornées à la boîte : l'arrondi de la grille peut déborder d'une cellule, et
        // une « gouttière » qui déborde produirait une colonne de largeur NÉGATIVE.
        const px0 = Math.max(x0, Math.round(deb * CELL * ech));
        const px1 = Math.min(x0 + bl, Math.round(x * CELL * ech));
        if (px1 - px0 >= L * GOUTTIERE_MIN) gouttieres.push({ x0: px0, x1: px1 });
        deb = null;
      }
    }
  }

  return {
    boite: { x: x0, y: y0, l: bl, h: bh },
    gouttieres,
    mesures: {
      sondes: nb,
      part_fixe: Number(partFixe.toFixed(3)),
      part_animee_du_contenu: Number(partAnimeeDuContenu.toFixed(3)),
      vignette_retiree: vignetteRetiree,
      // Bord de la boîte rabattu sur la vignette, et donc privé de marge de sûreté :
      // sans cette trace, un cadrage serré d'un côté n'a aucune explication lisible.
      bord_rabattu: bordRabattu,
      vignette: vignette
        ? {
          x: Math.round(vignette.x0 * CELL * ech), y: Math.round(vignette.y0 * CELL * ech),
          l: Math.round((vignette.x1 - vignette.x0) * CELL * ech),
          h: Math.round((vignette.y1 - vignette.y0) * CELL * ech),
        }
        : null,
    },
  };
}

export const SEUILS_CADRAGE = {
  GAIN_MIN_ROGNAGE,
  GAIN_MIN_COLONNES,
  COLONNE_MIN,
  SONDES,
};
