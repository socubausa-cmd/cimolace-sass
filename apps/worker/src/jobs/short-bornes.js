/**
 * short-bornes — LES BORNES D'UN EXTRAIT, CALÉES SUR DES MOTS RÉELS.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI CE MODULE EXISTE
 * ════════════════════════════════════════════════════════════════════════════
 * Un audit contradictoire des 5 extraits réellement produits pour le replay
 * « L'arbre du Manikongo — 11 avril 2026 » les a TOUS LES CINQ refusés :
 *   · ouvertures en plein milieu d'un propos — « et l'onction de… », « et après
 *     on continue… » ;
 *   · fermetures amputées — l'extrait phare coupe à 679 s une prise de parole qui
 *     court jusqu'à 682 s : « C'est un » devient « C'est » ;
 *   · 5 cartons de sous-titre sur 48 (10 %) tenus plus de 6 s, jusqu'à 11,8 s.
 *
 * ⭐ LA CAUSE EST MATÉRIELLE, ET ELLE EST DANS NOTRE CODE. Les cues stockées font
 * ~20 secondes (57 pour 21 minutes) parce que l'ingestion agglomérait les prises
 * de parole en paragraphes et jetait leurs fins. C'est corrigé pour l'AVENIR
 * (`transcript_segments`, migration 20260728160000), mais :
 *   1. tout l'existant a perdu cette finesse pour de bon ;
 *   2. même la finesse de la source (2-8 s par prise de parole) ne suffit pas à
 *      couper au mot près.
 * On ne peut pas choisir une frontière de phrase quand la plus petite unité
 * disponible dure vingt secondes. Ce module fabrique la finesse qui manque, à la
 * demande, et SEULEMENT sur la zone candidate.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QU'IL FAIT
 * ════════════════════════════════════════════════════════════════════════════
 * ⭐ ET IL RAPPORTE DEUX GAINS, PAS UN. Mesuré sur la zone 653→682 s du replay de
 * référence — la transcription grossière n'était pas seulement mal MINUTÉE, elle
 * était mal ENTENDUE :
 *     cue de 20 s  : « Je suis Shao cinquième Manikongo piste Vita Kimba »
 *     au mot       : « Je suis Cheo, 5e Mani Kongo. » / « Fils de Vitakimpa. »
 * Sur une fenêtre courte, le même modèle retrouve « Cheo » et « fils de » sans
 * aucun glossaire. De même « Bumba, Gongo lanky selé » et « Takenaro, Shankuru »
 * pour ce que la passe longue rendait en « taquine à roche en courroux ». Le
 * contexte de vingt secondes noyait des noms que dix secondes font ressortir.
 *
 *   1. découpe un corridor autour de la zone désignée (±20 s, plafonné à 150 s) ;
 *   2. en extrait l'audio DU FICHIER DÉJÀ TÉLÉCHARGÉ localement — aucun accès
 *      réseau au stockage ;
 *   3. le repasse à Whisper en `timestamp_granularities[]=word` ;
 *   4. regroupe les mots en PHRASES (ponctuation, ou pause mesurée) ;
 *   5. retrouve dans ce flux les deux phrases que le modèle a CITÉES, et rend les
 *      bornes exactes.
 *
 * ⚠️ TOUS LES REPLIS SONT ÉTIQUETÉS, AUCUN N'EST SILENCIEUX. `granularite` vaut
 * 'mot', 'segment' ou 'cue'. Un moteur qui dégrade sans le dire produit exactement
 * le défaut qu'on vient de passer une session à diagnostiquer : un résultat
 * plausible dont personne ne sait qu'il a été fabriqué au rabais.
 */
import { spawn } from 'child_process';
import { readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { normaliserMot, motAncre, appliquerGlossaireAuxMots } from './short-sous-titres.js';

// ── Les nombres, et d'où ils viennent ─────────────────────────────────────

/**
 * Débordement de part et d'autre de la zone désignée par le modèle.
 *
 * 20 s parce que c'est la taille d'une cue : le modèle situe sa zone à partir de
 * cues de ~20 s, donc son `zone_debut` peut se tromper d'une cue entière. En deçà,
 * la phrase d'ouverture qu'il a citée pourrait tomber hors du corridor et on
 * refuserait un bon extrait pour une erreur de repérage, pas de jugement.
 */
export const MARGE_CORRIDOR = 20;

/**
 * Plafond de la zone re-transcrite.
 *
 * 150 s d'audio 16 kHz mono PCM = 4,8 Mo, très en dessous des 25 Mo qu'acceptent
 * Groq et OpenAI. C'est aussi ~10 s de traitement chez le fournisseur : au-delà,
 * on paierait la transcription d'un passage qu'on ne publiera pas.
 */
export const MAX_ZONE_SEC = 150;

/**
 * Pause qui vaut frontière de phrase, en secondes.
 *
 * ⭐ MESURÉ, ET LE RÉSULTAT EST UN NON-ÉVÉNEMENT — c'est précisément ce que
 * `scripts/shorts-repro.mjs` sert à établir. Sur le replay de référence, la
 * distribution des écarts entre mots consécutifs est **bimodale, sans zone
 * grise** :
 *     zone 338→388 s (224 mots) : médiane 0 s · p75 0 s · p90 0 s · p95 0 s · max 5,72 s
 *     zone 653→682 s ( 30 mots) : médiane 0 s · p75 2,44 s · p90 3,72 s · max 21,68 s
 * Les mots d'une même proposition se touchent (écart 0), et les vraies frontières
 * s'ouvrent à plusieurs secondes. Conséquence directe, vérifiée sur les deux
 * zones : **toute valeur de 0,25 à 0,8 s produit exactement le même découpage**
 * (0 % de phrases ouvrant sur un connecteur, dans tous les cas).
 * On garde donc 0,45 s — au milieu du plateau — et on ne perd plus de temps à
 * l'ajuster. Si un jour un locuteur produit une zone grise, le banc le dira.
 *
 * ⚠️ LE VRAI BOUTON EST AILLEURS : c'est `PHRASE_MAX_SEC`. Sur la zone 338→388,
 * 4 phrases sur 9 sont issues de la coupe forcée, pas d'une pause.
 *
 * ⭐ ET LA PONCTUATION N'EST QU'UN BONUS, PAS LA COLONNE VERTÉBRALE. Whisper la
 * place au jugé. La pause, elle, est mesurée. Quand les deux se contredisent, on
 * suit la pause.
 */
export const PAUSE_PHRASE = 0.45;

/**
 * Au-delà, on coupe même sans pause : une « phrase » de 12 s n'est plus une phrase.
 *
 * ⚠️ C'EST LE SEUIL QUI TRAVAILLE RÉELLEMENT sur ce locuteur (voir `PAUSE_PHRASE`) :
 * il produit 4 des 9 phrases de la zone de référence. Le baisser hacherait des
 * propos continus ; le monter rendrait des blocs trop longs pour servir de borne.
 */
const PHRASE_MAX_SEC = 12;
/** En deçà, on absorbe dans la voisine : « D'accord. » seul n'est pas une unité. */
const PHRASE_MIN_SEC = 1.2;

/**
 * Marges de respiration autour des bornes, en secondes.
 *
 * Asymétriques À DESSEIN. En tête, 0,20 s suffit : couper juste avant une attaque
 * de consonne s'entend, mais un blanc plus long fait « traîner » le début, et un
 * short se juge dans sa première seconde. En queue, 0,35 s : une fin de phrase
 * porte une descente d'intonation qui déborde le dernier mot, et couper dessus
 * donne l'impression d'un fichier tronqué — exactement le défaut relevé sur
 * l'extrait phare (« C'est un » → « C'est »).
 */
const RESPIRATION_TETE = 0.20;
const RESPIRATION_QUEUE = 0.35;

/**
 * Part minimale de mots ANCRÉS pour reconnaître une citation.
 *
 * Le modèle recopie la phrase depuis un texte déjà passé au glossaire ; la
 * re-transcription, elle, entend le son brut. Les deux graphies diffèrent donc
 * légalement (« Kimpa Vita » cité contre « Kimba vita » entendu). `motAncre`
 * tolère déjà racine commune et faible distance d'édition ; 0,5 laisse passer une
 * citation à moitié re-transcrite autrement, et refuse une citation inventée —
 * dont AUCUN mot porteur ne se retrouve dans l'audio.
 */
const ANCRAGE_CITATION = 0.5;

/** Budget total du module. Au-delà, on rend le repli étiqueté plutôt que rien. */
export const BUDGET_BORNES_MS = 90000;

// ── Outils ────────────────────────────────────────────────────────────────

const arrondi = (x) => Math.round(x * 100) / 100;

/** Mots porteurs d'une chaîne : ceux qui prouvent quelque chose (≥ 3 lettres). */
function motsPorteursDe(texte) {
  return String(texte || '')
    .split(/\s+/)
    .map(normaliserMot)
    .filter((m) => m.length >= 3);
}

function lancer(cmd, args, { timeoutMs = 60000 } = {}) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    const minuteur = setTimeout(() => { try { proc.kill('SIGKILL'); } catch { /* déjà mort */ } }, timeoutMs);
    proc.stdout.on('data', (d) => (out += d.toString()));
    proc.stderr.on('data', (d) => (err += d.toString()));
    proc.on('error', (e) => { clearTimeout(minuteur); resolve({ code: -1, out, err: e.message }); });
    proc.on('close', (code) => { clearTimeout(minuteur); resolve({ code, out, err }); });
  });
}

/**
 * Extrait l'audio d'une TRANCHE, et vérifie ce qui est sorti.
 *
 * ⚠️ `-ss` AVANT `-i` : la recherche se fait alors sur le conteneur, sans décoder
 * ce qui précède. Sur un replay de 21 minutes, `-ss` après `-i` décoderait tout
 * depuis le début pour n'en garder que 150 s.
 *
 * ⚠️ LE CONTRÔLE ffprobe N'EST PAS FACULTATIF, et cette leçon a déjà été payée :
 * un flux AAC baptisé `.wav` sort de ffmpeg en code 0, et le fournisseur répond
 * **HTTP 200** avec `duration: 0.046` et un mot halluciné. Le défaut ne produit
 * aucune erreur nulle part — il produit une transcription vide et plausible.
 */
async function extraireTranche(fichier, debut, duree, sortie) {
  const r = await lancer('ffmpeg', [
    '-y', '-ss', String(debut), '-t', String(duree), '-i', fichier,
    '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', sortie,
  ], { timeoutMs: 60000 });
  if (r.code !== 0) throw new Error(`extraction audio (code ${r.code}) : ${String(r.err).slice(-200)}`);

  const p = await lancer('ffprobe', [
    '-v', 'error', '-select_streams', 'a:0',
    '-show_entries', 'stream=codec_name', '-of', 'default=nw=1:nk=1', sortie,
  ], { timeoutMs: 15000 });
  const codec = p.code === 0 ? p.out.trim() : null;
  // `null` = ffprobe absent du conteneur : un contrôle qui ne peut pas s'exécuter
  // ne doit pas condamner une extraction qui, elle, va peut-être très bien.
  if (codec && codec !== 'pcm_s16le') {
    throw new Error(`audio extrait en « ${codec} » au lieu de pcm_s16le — le fournisseur ne l'entendrait pas`);
  }
  return sortie;
}

/**
 * Transcription AU MOT d'un fichier audio court.
 *
 * ⚠️ MISTRAL/VOXTRAL EST VOLONTAIREMENT ABSENT de cette liste, alors qu'il figure
 * dans la chaîne générale de `short-generator.js` : il n'expose que la granularité
 * `segment`. L'y laisser en repli rendrait un objet sans `words`, et le module
 * dégraderait silencieusement en croyant avoir des mots.
 *
 * `amorce` (le `prompt` de Whisper) porte le vocabulaire de l'école. Whisper ne
 * garde que ses ~224 derniers jetons : on met donc les termes les plus critiques
 * EN FIN de chaîne, pas au début.
 */
async function transcrireAuMot(fichierAudio, { amorce = '', journal = console } = {}) {
  const fournisseurs = [];
  if (process.env.GROQ_API_KEY) {
    fournisseurs.push({ nom: 'Groq', url: 'https://api.groq.com/openai/v1/audio/transcriptions', cle: process.env.GROQ_API_KEY, modele: 'whisper-large-v3' });
  }
  if (process.env.OPENAI_API_KEY) {
    fournisseurs.push({ nom: 'OpenAI', url: 'https://api.openai.com/v1/audio/transcriptions', cle: process.env.OPENAI_API_KEY, modele: 'whisper-1' });
  }
  if (fournisseurs.length === 0) throw new Error('aucun fournisseur de transcription au mot configuré (GROQ_API_KEY ou OPENAI_API_KEY)');

  const donnees = await readFile(fichierAudio);
  let dernierEchec = '';
  for (const f of fournisseurs) {
    try {
      const form = new FormData();
      form.append('file', new Blob([donnees], { type: 'audio/wav' }), 'zone.wav');
      form.append('model', f.modele);
      form.append('language', 'fr');
      form.append('response_format', 'verbose_json');
      // Les deux granularités : les mots pour les bornes, les segments comme
      // repli interne si le fournisseur ignore `word` sans le dire.
      form.append('timestamp_granularities[]', 'word');
      form.append('timestamp_granularities[]', 'segment');
      if (amorce) form.append('prompt', amorce);

      const res = await fetch(f.url, { method: 'POST', headers: { Authorization: `Bearer ${f.cle}` }, body: form });
      if (!res.ok) { dernierEchec = `${f.nom} HTTP ${res.status}`; continue; }
      const d = await res.json();
      const mots = Array.isArray(d.words)
        ? d.words
          .map((m) => ({ t: Number(m.start), e: Number(m.end), mot: String(m.word || '').trim() }))
          .filter((m) => m.mot && Number.isFinite(m.t) && Number.isFinite(m.e))
        : [];
      const segments = Array.isArray(d.segments)
        ? d.segments.map((s) => ({ t: Number(s.start), e: Number(s.end), text: String(s.text || '').trim() })).filter((s) => s.text)
        : [];
      if (mots.length === 0) {
        // Le fournisseur a répondu 200 sans mots : on le DIT et on tente le suivant.
        dernierEchec = `${f.nom} n'a rendu aucun mot horodaté`;
        journal.warn?.(`[short-bornes] ${dernierEchec} — ${segments.length} segment(s) seulement`);
        continue;
      }
      return { mots, segments, fournisseur: f.nom };
    } catch (e) {
      dernierEchec = `${f.nom}: ${e.message}`;
    }
  }
  throw new Error(`transcription au mot : ${dernierEchec}`);
}

// ── Découpe en phrases ────────────────────────────────────────────────────

/**
 * Regroupe des mots horodatés en PHRASES.
 *
 * Trois raisons de couper, dans cet ordre de confiance :
 *   1. une PAUSE mesurée ≥ `PAUSE_PHRASE` — le seul critère qui vienne du son ;
 *   2. une ponctuation forte en fin de mot — utile, mais placée au jugé par
 *      Whisper, donc subordonnée à la pause ;
 *   3. une durée qui dépasse `PHRASE_MAX_SEC` — garde-fou contre l'orateur qui
 *      n'inspire jamais.
 * Puis on absorbe les unités de moins de `PHRASE_MIN_SEC` dans leur voisine : un
 * « D'accord. » isolé n'est pas une borne, c'est une ponctuation orale.
 */
export function phrasesDepuisMots(mots, { pause = PAUSE_PHRASE } = {}) {
  if (!Array.isArray(mots) || mots.length === 0) return [];
  const brutes = [];
  let cour = null;
  for (let i = 0; i < mots.length; i += 1) {
    const m = mots[i];
    if (!cour) cour = { debut: m.t, fin: m.e, mots: [m] };
    else { cour.fin = m.e; cour.mots.push(m); }

    const suivant = mots[i + 1];
    const ecart = suivant ? suivant.t - m.e : Infinity;
    const ponctue = /[.!?…»]$/.test(m.mot);
    const tropLongue = cour.fin - cour.debut >= PHRASE_MAX_SEC;
    if (!suivant || ecart >= pause || (ponctue && ecart >= pause / 3) || tropLongue) {
      brutes.push(cour);
      cour = null;
    }
  }
  if (cour) brutes.push(cour);

  // Absorption des miettes. On les recolle à la VOISINE LA PLUS PROCHE dans le
  // temps : recoller systématiquement à gauche collerait « D'accord. » à la fin
  // d'un propos qu'il ne conclut pas.
  const phrases = [];
  for (const p of brutes) {
    const courte = p.fin - p.debut < PHRASE_MIN_SEC;
    if (!courte || phrases.length === 0) { phrases.push(p); continue; }
    const prec = phrases[phrases.length - 1];
    phrases[phrases.length - 1] = { debut: prec.debut, fin: p.fin, mots: [...prec.mots, ...p.mots] };
  }
  return phrases.map((p) => ({
    debut: arrondi(p.debut),
    fin: arrondi(p.fin),
    texte: p.mots.map((m) => m.mot).join(' ').replace(/\s+([,.;:!?…])/g, '$1').trim(),
    mots: p.mots,
  }));
}

/**
 * Retrouve une phrase CITÉE dans une liste de phrases mesurées.
 *
 * ⭐ ON NE COMPARE PAS DES CHAÎNES, ON COMPTE DES ANCRES. Le modèle cite depuis un
 * texte passé au glossaire (« Kimpa Vita ») ; la re-transcription entend le son
 * brut (« Kimba vita »). Une égalité stricte échouerait sur toutes les citations
 * intéressantes — précisément celles qui portent les noms propres de l'école.
 * `motAncre` accepte l'identité, la racine commune sur 4 lettres, et une distance
 * d'édition proportionnelle à la longueur du mot.
 *
 * Rend `{ index, score }`, ou `null` si aucune phrase n'atteint `ANCRAGE_CITATION`
 * — cas où la citation a été INVENTÉE, ce qu'aucune comparaison de secondes
 * n'aurait su détecter.
 */
export function retrouverCitation(citation, phrases, { seuil = ANCRAGE_CITATION } = {}) {
  const cherches = motsPorteursDe(citation);
  if (cherches.length === 0 || phrases.length === 0) return null;

  let meilleur = null;
  for (let i = 0; i < phrases.length; i += 1) {
    // On regarde la phrase ET ses deux voisines : le modèle peut avoir cité une
    // phrase que notre découpe a scindée en deux sur une hésitation.
    for (const largeur of [1, 2]) {
      if (i + largeur > phrases.length) continue;
      const fenetre = phrases.slice(i, i + largeur);
      const presents = fenetre.flatMap((p) => motsPorteursDe(p.texte));
      if (presents.length === 0) continue;
      const ancres = cherches.filter((m) => motAncre(m, presents)).length;
      const score = ancres / cherches.length;
      if (!meilleur || score > meilleur.score) {
        meilleur = { index: i, largeur, score: arrondi(score) };
      }
    }
  }
  return meilleur && meilleur.score >= seuil ? meilleur : null;
}

// ── Le point d'entrée ─────────────────────────────────────────────────────

/**
 * Cale les bornes d'un extrait sur des phrases réelles.
 *
 * Rend TOUJOURS un objet ; ne jette jamais. `granularite` dit ce qui a été
 * réellement obtenu :
 *   · 'mot'     — la passe a réussi, `debut`/`fin` sont calés sur des phrases ;
 *   · 'cue'     — repli : on rend les bornes proposées telles quelles, et `motif`
 *                 dit pourquoi. L'appelant DOIT le journaliser.
 * `refus` non nul = l'extrait ne doit pas être fabriqué (citation introuvable).
 */
export async function bornesAuMot({
  fichier,
  zoneDebut,
  zoneFin,
  phraseOuverture,
  phraseCloture,
  dureeSource = Infinity,
  glossaire = null,
  /** Plafond de durée de l'extrait, en secondes. 0 ou null = pas de plafond. */
  dureeMax = 0,
  journal = console,
  budgetMs = BUDGET_BORNES_MS,
}) {
  const repli = (motif) => ({
    granularite: 'cue', debut: zoneDebut, fin: zoneFin, motif, refus: null, mots: [], phrases: [],
  });

  if (!fichier || !Number.isFinite(zoneDebut) || !Number.isFinite(zoneFin) || zoneFin <= zoneDebut) {
    return repli('zone invalide');
  }
  if (!phraseOuverture || !phraseCloture) {
    return repli('le modèle n\'a pas cité ses phrases de bornes');
  }

  const t0 = Date.now();
  const z0 = Math.max(0, zoneDebut - MARGE_CORRIDOR);
  const z1 = Math.min(dureeSource, zoneFin + MARGE_CORRIDOR);
  const duree = Math.min(MAX_ZONE_SEC, z1 - z0);
  if (duree <= 0) return repli('corridor vide');

  const sortie = join(tmpdir(), `bornes_${Math.round(z0)}_${Math.round(duree)}_${process.pid}.wav`);
  try {
    await extraireTranche(fichier, z0, duree, sortie);
    if (Date.now() - t0 > budgetMs) return repli(`budget dépassé à l'extraction (${budgetMs} ms)`);

    // Le vocabulaire de l'école, les termes critiques EN FIN (Whisper ne retient
    // que la queue de l'amorce).
    const amorce = glossaire?.termes?.length
      ? glossaire.termes.map((t) => t.terme).join(', ')
      : '';

    const { mots, fournisseur } = await transcrireAuMot(sortie, { amorce, journal });
    if (Date.now() - t0 > budgetMs) return repli(`budget dépassé après transcription (${budgetMs} ms)`);

    // ⚠️ REMETTRE LES MOTS À L'HEURE DU FICHIER COMPLET. Whisper horodate la
    // TRANCHE, qui commence à 0 ; sans ce décalage, toutes les bornes sortiraient
    // ~11 minutes trop tôt sur ce replay, et rien dans le résultat ne le dirait.
    const motsBruts = mots.map((m) => ({ ...m, t: arrondi(m.t + z0), e: arrondi(m.e + z0) }));

    // ⭐ LE GLOSSAIRE MORD SUR LES MOTS **AVANT** DE CHERCHER LES CITATIONS, et
    // l'oublier a coûté un rejet à tort en production.
    // Le modèle cite depuis le texte des cues, DÉJÀ passé au glossaire : il écrit
    // « Manikongo fils de Kimpa Vita ». La passe au mot, elle, entend le son brut et
    // rend « Mani Kongo » puis « Vitakimpa ». Sur 7 mots porteurs cherchés, 2 seulement
    // s'ancraient — sous le seuil de 0,5 — et l'extrait phare du replay était REFUSÉ
    // pour « citation introuvable » alors que la phrase était là, mot pour mot.
    // On met donc les deux côtés dans la même orthographe avant de les comparer.
    const { mots: motsAbsolus } = appliquerGlossaireAuxMots(motsBruts, glossaire);
    const phrases = phrasesDepuisMots(motsAbsolus);
    if (phrases.length === 0) return repli('aucune phrase reconstituée');

    const ouv = retrouverCitation(phraseOuverture, phrases);
    const clo = retrouverCitation(phraseCloture, phrases);

    // ⛔ SEULE L'OUVERTURE EST OBLIGATOIRE — et cette asymétrie est une correction
    // d'un défaut de conception constaté en production.
    //
    // Exiger que LES DEUX citations s'ancrent doublait la probabilité d'échec pour
    // un gain faible : l'extrait phare du replay a été refusé deux fois de suite,
    // d'abord sur l'ouverture (corrigé par le glossaire sur les mots), puis sur la
    // CLÔTURE — alors que son ouverture, elle, s'ancrait à 86 %. Or les deux bornes
    // ne se valent pas :
    //   · l'OUVERTURE décide de tout. Un short se juge dans sa première seconde, et
    //     c'est là que « et l'onction de… » tuait les extraits. Elle doit être
    //     retrouvée dans l'audio — c'est aussi le seul vrai signal d'invention : un
    //     modèle qui écrit une phrase jamais prononcée l'écrit d'abord ici.
    //   · la CLÔTURE est un CONFORT. Ne pas la retrouver ne prouve rien de mauvais :
    //     la fin d'un passage est souvent la partie la moins bien entendue (voix qui
    //     baisse, chevauchement). On peut la choisir mécaniquement — sur une vraie
    //     frontière de phrase, ce qui reste tout l'intérêt du module.
    if (!ouv) {
      return {
        granularite: 'mot', debut: zoneDebut, fin: zoneFin, motif: null, mots: motsAbsolus, phrases,
        refus: {
          code: 'citation_introuvable',
          detail: "la phrase d'ouverture citée ne se retrouve pas dans l'audio : elle n'a pas été prononcée",
        },
      };
    }

    const pOuv = phrases[ouv.index];
    let pClo;
    if (clo && clo.index >= ouv.index) {
      pClo = phrases[Math.min(phrases.length - 1, clo.index + clo.largeur - 1)];
    } else {
      // Clôture non retrouvée (ou placée AVANT l'ouverture, ce qui revient au même) :
      // on prend la dernière phrase entière qui tient dans le budget de durée. Le
      // clip finit donc sur une vraie fin de propos, simplement pas sur celle que le
      // modèle avait en tête.
      const budget = dureeMax || (zoneFin - zoneDebut);
      pClo = pOuv;
      for (const p of phrases.slice(ouv.index)) {
        if (p.fin + RESPIRATION_QUEUE - (pOuv.debut - RESPIRATION_TETE) <= budget) pClo = p;
        else break;
      }
      journal.log?.(
        `[short-bornes] clôture non retrouvée dans l'audio — fin posée sur la dernière `
        + `frontière de phrase du budget (${arrondi(pClo.fin)} s). L'ouverture, elle, est ancrée à `
        + `${Math.round(ouv.score * 100)} %.`,
      );
    }
    if (pClo.fin <= pOuv.debut) {
      return {
        granularite: 'mot', debut: zoneDebut, fin: zoneFin, motif: null, mots: motsAbsolus, phrases,
        refus: { code: 'bornes_inversees', detail: 'la clôture citée précède l\'ouverture citée' },
      };
    }

    const debut = arrondi(Math.max(z0, pOuv.debut - RESPIRATION_TETE));
    let fin = arrondi(Math.min(z1, pClo.fin + RESPIRATION_QUEUE));

    // ⚠️ BORNAGE DUR DE LA DURÉE — sans lui le recalage a produit un « short » de 69 s
    // en production. `lireExtraits` borne la durée du candidat, mais le recalage
    // travaille APRÈS et étend jusqu'aux frontières de phrase : rien ne le retenait.
    // On raccourcit alors PAR PHRASES ENTIÈRES, jamais au milieu d'une — couper à la
    // seconde ici défairait tout ce que ce module vient de calculer.
    if (dureeMax && fin - debut > dureeMax) {
      const dansLaFenetre = phrases.filter((p) => p.debut >= pOuv.debut && p.fin <= fin);
      let derniere = null;
      for (const p of dansLaFenetre) {
        if (p.fin + RESPIRATION_QUEUE - debut <= dureeMax) derniere = p;
        else break;
      }
      if (derniere) {
        fin = arrondi(derniere.fin + RESPIRATION_QUEUE);
        journal.log?.(`[short-bornes] durée ramenée à ${arrondi(fin - debut)} s (plafond ${dureeMax} s), sur une frontière de phrase`);
      } else {
        // Même la PREMIÈRE phrase dépasse le plafond : on ne peut pas la couper sans
        // trahir le propos. On refuse plutôt que de livrer une phrase tronquée.
        return {
          granularite: 'mot', debut, fin, motif: null, mots: motsAbsolus, phrases,
          refus: {
            code: 'phrase_trop_longue',
            detail: `la première phrase dure ${arrondi(phrases[ouv.index].fin - phrases[ouv.index].debut)} s, au-delà du plafond de ${dureeMax} s`,
          },
        };
      }
    }
    journal.log?.(
      `[short-bornes] ${fournisseur} · ${motsAbsolus.length} mots, ${phrases.length} phrases · `
      + `${zoneDebut}→${zoneFin} recalé en ${debut}→${fin} `
      // ⚠️ `clo` PEUT ÊTRE NUL depuis que la clôture est facultative. Écrire
      // `clo.score` ici jetait sur le chemin nominal du repli — une ligne de
      // journal qui fait tomber la fabrication qu'elle décrit.
      + `(ouverture ${Math.round(ouv.score * 100)} %, clôture ${clo ? `${Math.round(clo.score * 100)} %` : 'posée sur le budget'}) `
      + `· ${Date.now() - t0} ms`,
    );
    return { granularite: 'mot', debut, fin, motif: null, refus: null, mots: motsAbsolus, phrases };
  } catch (e) {
    // Un échec de cette passe ne doit JAMAIS empêcher la fabrication : on dégrade,
    // on l'étiquette, l'appelant décide.
    journal.warn?.(`[short-bornes] repli sur les cues : ${e.message}`);
    return repli(e.message);
  } finally {
    try { await unlink(sortie); } catch { /* déjà nettoyé */ }
  }
}
