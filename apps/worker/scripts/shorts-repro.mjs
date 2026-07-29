#!/usr/bin/env node
/**
 * shorts-repro — LE BANC DE REPRO DU MOTEUR D'EXTRAITS.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI CE SCRIPT EXISTE AVANT LE RESTE
 * ════════════════════════════════════════════════════════════════════════════
 * Trois seuils gouvernent le découpage des extraits — la pause qui vaut frontière
 * de phrase, les respirations de tête et de queue, la part d'ancrage qui reconnaît
 * une citation. Chacun a été POSÉ à partir de ce qu'on sait du français parlé.
 * Aucun n'a été MESURÉ sur ce locuteur-là, dans cette salle-là, avec ce micro-là.
 *
 * Un seuil écrit d'imagination se comporte exactement comme un seuil juste tant
 * qu'on ne le regarde pas : le moteur produit, les fichiers existent, les journaux
 * sont verts. C'est ainsi qu'on a livré cinq extraits dont un audit contradictoire
 * a ensuite refusé les cinq.
 *
 * Ce banc rejoue le découpage HORS LIGNE, sur un replay réel, et affiche ce qui
 * se passe vraiment. Il ne publie rien, n'écrit rien en base, ne fabrique aucune
 * vidéo.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * EMPLOI
 * ════════════════════════════════════════════════════════════════════════════
 *   node apps/worker/scripts/shorts-repro.mjs --fichier /tmp/replay.mp4 \
 *        --zones 338:388,653:682,874:899
 *
 *   --fichier   le MP4 local (déjà téléchargé depuis R2)
 *   --zones     zones candidates « debut:fin », séparées par des virgules
 *   --pauses    seuils de pause à comparer (défaut : 0.25,0.35,0.45,0.6,0.8)
 *   --derive    mesure seulement la dérive de `-ss` et sort
 *
 * Env : GROQ_API_KEY (ou OPENAI_API_KEY).
 */
import { spawn } from 'child_process';
import { unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { phrasesDepuisMots, PAUSE_PHRASE } from '../src/jobs/short-bornes.js';

// ── Arguments ─────────────────────────────────────────────────────────────
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  args[String(process.argv[i]).replace(/^--/, '')] = process.argv[i + 1];
}
const FICHIER = args.fichier;
const ZONES = String(args.zones || '')
  .split(',').filter(Boolean)
  .map((z) => { const [a, b] = z.split(':').map(Number); return { a, b }; })
  .filter((z) => Number.isFinite(z.a) && Number.isFinite(z.b) && z.b > z.a);
const PAUSES = String(args.pauses || '0.25,0.35,0.45,0.6,0.8').split(',').map(Number).filter(Number.isFinite);

if (!FICHIER) {
  console.error('Il faut --fichier <mp4 local>. Voir l\'en-tête du script.');
  process.exit(2);
}

const arrondi = (x) => Math.round(x * 100) / 100;
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

function lancer(cmd, argv, timeoutMs = 90000) {
  return new Promise((resolve) => {
    const p = spawn(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    const m = setTimeout(() => { try { p.kill('SIGKILL'); } catch { /* mort */ } }, timeoutMs);
    p.stdout.on('data', (d) => (out += d.toString()));
    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('error', (e) => { clearTimeout(m); resolve({ code: -1, out, err: e.message }); });
    p.on('close', (code) => { clearTimeout(m); resolve({ code, out, err }); });
  });
}

// ══════════════════════════════════════════════════════════════════════════
// MESURE 1 — LA DÉRIVE DE `-ss`
// ══════════════════════════════════════════════════════════════════════════
/**
 * `ffmpeg -ss <t> -i <fichier>` ne commence pas exactement à `t` : il se cale sur
 * une frontière de paquet. En VIDÉO cette dérive peut atteindre plusieurs secondes
 * (elle saute à l'image-clé précédente) ; en AUDIO seul (`-vn`), elle vaut un
 * paquet, soit quelques dizaines de millisecondes.
 *
 * ⭐ ON LA MESURE UNE FOIS PLUTÔT QUE DE LA CORRIGER À CHAQUE APPEL. Ajouter un
 * `ffprobe` par extrait pour rattraper 30 ms serait payer un aller-retour pour
 * corriger une erreur plus petite que la respiration de tête (0,20 s). Mais si
 * elle dépassait 100 ms, elle décalerait TOUS les sous-titres du clip, et il
 * faudrait alors passer au seek en deux temps (`-ss t−5` avant `-i`, `-ss 5`
 * après). Cette mesure tranche entre les deux, sur des chiffres.
 */
/** Décode une tranche en PCM 16 bits mono 16 kHz, rendue en Int16Array. */
async function pcmDeLaTranche(fichier, t, duree, { recherche }) {
  // `avant` = recherche rapide (sur le conteneur) ; `apres` = recherche exacte
  // (décodage depuis le début, lent mais juste). C'est la comparaison des deux
  // qui donne la dérive — pas une métadonnée.
  const argv = recherche === 'rapide'
    ? ['-ss', String(t), '-t', String(duree), '-i', fichier]
    : ['-i', fichier, '-ss', String(t), '-t', String(duree)];
  const p = spawn('ffmpeg', ['-v', 'error', ...argv, '-vn', '-ar', '16000', '-ac', '1', '-f', 's16le', '-'],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  const morceaux = [];
  p.stdout.on('data', (d) => morceaux.push(d));
  const code = await new Promise((r) => { p.on('close', r); p.on('error', () => r(-1)); });
  if (code !== 0) return null;
  const buf = Buffer.concat(morceaux);
  return new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 2));
}

/**
 * ⭐ POURQUOI ON NE PEUT PAS LIRE LA DÉRIVE DANS UNE MÉTADONNÉE — et pourquoi la
 * première version de cette fonction rendait un faux « 0 ms ».
 * Elle interrogeait `format=start_time` du WAV produit. Or un WAV ré-encodé ne
 * porte AUCUN horodatage : il commence toujours à 0, quelle que soit la position
 * réellement atteinte dans la source. ffprobe rendait donc `N/A`, `Number()` en
 * faisait `NaN`, et `Math.abs(NaN || 0)` — le `|| 0` — le transformait en un
 * rassurant zéro. Un contrôle qui ne peut structurellement pas échouer ne contrôle
 * rien : c'est exactement le motif de bug qu'on traque dans ce moteur depuis le
 * début (le WAV qui contenait de l'AAC, la transcription vide en HTTP 200).
 *
 * La mesure honnête compare DEUX DÉCODAGES du même instant : recherche rapide
 * (`-ss` avant `-i`, ce que fait la production) contre recherche exacte (`-ss`
 * après `-i`, qui décode tout depuis le début). Si les deux sont identiques, la
 * dérive est nulle. Sinon on cherche le décalage qui les aligne.
 */
async function mesurerDerive(fichier) {
  console.log('\n═══ DÉRIVE DE -ss (recherche rapide contre recherche exacte) ═══');
  const points = [60, 338, 653, 874];
  const SR = 16000;
  const ecarts = [];
  for (const t of points) {
    const [rapide, exact] = await Promise.all([
      pcmDeLaTranche(fichier, t, 2, { recherche: 'rapide' }),
      pcmDeLaTranche(fichier, t, 2, { recherche: 'exacte' }),
    ]);
    if (!rapide || !exact || rapide.length < SR || exact.length < SR) {
      console.log(`  t=${String(t).padStart(4)}s  ❌ décodage impossible`);
      continue;
    }
    // Identiques ? alors la dérive est nulle, inutile de corréler.
    let identique = rapide.length === exact.length;
    if (identique) for (let i = 0; i < rapide.length; i += 97) if (rapide[i] !== exact[i]) { identique = false; break; }
    if (identique) {
      ecarts.push(0);
      console.log(`  t=${String(t).padStart(4)}s  échantillons identiques → dérive 0 ms`);
      continue;
    }
    // Corrélation grossière : on cherche le décalage (±200 ms, pas de 0,5 ms) qui
    // maximise le produit scalaire entre les deux signaux.
    const N = 4000;                       // 250 ms de référence, assez pour caler
    const MAX = Math.round(0.2 * SR);     // ±200 ms
    const PAS = 8;                        // 0,5 ms
    const base = exact.subarray(SR / 2, SR / 2 + N); // on évite le tout début
    let meilleur = { lag: 0, score: -Infinity };
    for (let lag = -MAX; lag <= MAX; lag += PAS) {
      const dep = SR / 2 + lag;
      if (dep < 0 || dep + N > rapide.length) continue;
      let s = 0;
      for (let i = 0; i < N; i += 4) s += base[i] * rapide[dep + i];
      if (s > meilleur.score) meilleur = { lag, score: s };
    }
    const ecart = Math.abs(meilleur.lag) / SR;
    ecarts.push(ecart);
    console.log(`  t=${String(t).padStart(4)}s  décalage ${meilleur.lag > 0 ? '+' : ''}${meilleur.lag} échantillons → dérive ${Math.round(ecart * 1000)} ms`);
  }
  if (ecarts.length === 0) {
    console.log('\n  ⚠️ AUCUNE MESURE VALIDE — ne rien conclure. Vérifier ffmpeg.');
    return null;
  }
  const pire = Math.max(...ecarts);
  console.log(`\n  Pire dérive mesurée : ${Math.round(pire * 1000)} ms (sur ${ecarts.length} points)`);
  console.log(pire < 0.1
    ? '  ✅ SOUS 100 ms — négligeable devant la respiration de tête (200 ms). On garde la recherche rapide.'
    : '  ❌ AU-DESSUS DE 100 ms — tous les sous-titres du clip seraient décalés d\'autant.\n'
      + '     Passer à la recherche en deux temps : -ss <t−5> avant -i, puis -ss 5 après.');
  return pire;
}

// ══════════════════════════════════════════════════════════════════════════
// MESURE 2 — LE SEUIL DE PAUSE
// ══════════════════════════════════════════════════════════════════════════
/**
 * Le seuil qui sépare « l'orateur hésite » de « l'orateur a fini sa phrase » est
 * la pièce maîtresse du découpage, et c'est un chiffre PROPRE À CHAQUE LOCUTEUR.
 * On l'observe ici plutôt que de le décréter : pour chaque valeur candidate, on
 * regarde combien de phrases sortent, leur durée médiane, et surtout la part
 * d'entre elles qui commencent par un CONNECTEUR DE CONTINUATION.
 *
 * ⭐ CETTE DERNIÈRE COLONNE EST LE VRAI JUGE. Le défaut constaté sur les extraits
 * livrés n'était pas « les phrases sont trop longues », c'était « le clip s'ouvre
 * sur *et l'onction de…* ». Une découpe qui produit beaucoup de phrases démarrant
 * par « et », « donc », « alors », « mais » est une découpe qui coupe au milieu
 * des propos — quelle que soit sa jolie durée médiane.
 */
const CONNECTEURS = ['et', 'donc', 'alors', 'mais', 'puis', 'ensuite', 'car', 'parce', 'or', 'ou', 'ni', 'que', 'qui'];

function analyserDecoupe(mots, pause) {
  const phrases = phrasesDepuisMots(mots, { pause });
  if (phrases.length === 0) return null;
  const durees = phrases.map((p) => p.fin - p.debut).sort((a, b) => a - b);
  const med = arrondi(durees[Math.floor(durees.length / 2)]);
  const ouvreSurConnecteur = phrases.filter((p) => {
    const premier = String(p.texte).trim().split(/\s+/)[0] || '';
    return CONNECTEURS.includes(premier.toLowerCase().replace(/[^a-zà-ÿ']/gi, ''));
  }).length;
  const tropCourtes = phrases.filter((p) => p.fin - p.debut < 1.2).length;
  const tropLongues = phrases.filter((p) => p.fin - p.debut > 12).length;
  return {
    pause, nb: phrases.length, med, ouvreSurConnecteur,
    partConnecteur: arrondi(ouvreSurConnecteur / phrases.length),
    tropCourtes, tropLongues, phrases,
  };
}

// ══════════════════════════════════════════════════════════════════════════
async function main() {
  const derive = await mesurerDerive(FICHIER);
  if (args.derive !== undefined) return;

  if (ZONES.length === 0) {
    console.log('\nAucune zone (--zones debut:fin,…) : seule la dérive a été mesurée.');
    return;
  }
  if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
    console.error('\n❌ GROQ_API_KEY ou OPENAI_API_KEY requis pour la transcription au mot.');
    process.exit(3);
  }

  // On importe ici pour que `--derive` fonctionne sans clé de transcription.
  const { bornesAuMot } = await import('../src/jobs/short-bornes.js');

  for (const z of ZONES) {
    console.log(`\n══════════════════════════════════════════════════════════`);
    console.log(`ZONE ${z.a}→${z.b} s  (${mmss(z.a)} → ${mmss(z.b)}, ${z.b - z.a} s)`);
    console.log('══════════════════════════════════════════════════════════');

    // On demande des bornes avec des citations volontairement absurdes : ce qui
    // nous intéresse ici, c'est le FLUX DE MOTS, pas le recalage. Le refus
    // `citation_introuvable` est donc le comportement attendu, et il prouve au
    // passage que le garde-fou mord.
    const r = await bornesAuMot({
      fichier: FICHIER, zoneDebut: z.a, zoneFin: z.b,
      phraseOuverture: 'zzz sonde de banc zzz', phraseCloture: 'zzz sonde de banc zzz',
      journal: { log: () => {}, warn: (m) => console.log('  ' + m) },
    });

    if (!r.mots?.length) {
      console.log(`  ❌ aucun mot obtenu — granularité « ${r.granularite} », motif : ${r.motif || '—'}`);
      continue;
    }
    console.log(`  ${r.mots.length} mots horodatés`);
    if (r.refus?.code === 'citation_introuvable') {
      console.log('  ✅ garde-fou vérifié : une citation absente de l\'audio est bien REFUSÉE');
    }

    // Distribution des écarts inter-mots — la matière première du seuil.
    const ecarts = [];
    for (let i = 0; i + 1 < r.mots.length; i += 1) ecarts.push(r.mots[i + 1].t - r.mots[i].e);
    ecarts.sort((a, b) => a - b);
    const q = (p) => arrondi(ecarts[Math.min(ecarts.length - 1, Math.floor(ecarts.length * p))]);
    console.log(`  écarts inter-mots : médiane ${q(0.5)}s · p75 ${q(0.75)}s · p90 ${q(0.9)}s · p95 ${q(0.95)}s · max ${arrondi(ecarts[ecarts.length - 1])}s`);

    console.log('\n  pause   phrases  médiane  ouvrent sur « et/donc/… »  <1,2s  >12s');
    console.log('  ' + '─'.repeat(66));
    let meilleure = null;
    for (const pause of PAUSES) {
      const a = analyserDecoupe(r.mots, pause);
      if (!a) continue;
      const marque = pause === PAUSE_PHRASE ? ' ←actuel' : '';
      console.log(
        `  ${String(pause).padEnd(8)}${String(a.nb).padEnd(9)}${String(a.med + 's').padEnd(9)}`
        + `${String(`${a.ouvreSurConnecteur} (${Math.round(a.partConnecteur * 100)} %)`).padEnd(26)}`
        + `${String(a.tropCourtes).padEnd(7)}${a.tropLongues}${marque}`,
      );
      // Le meilleur compromis : le moins de phrases ouvrant sur un connecteur,
      // à égalité on préfère la découpe la plus fine (plus de bornes candidates).
      if (!meilleure || a.partConnecteur < meilleure.partConnecteur
        || (a.partConnecteur === meilleure.partConnecteur && a.nb > meilleure.nb)) meilleure = a;
    }
    if (meilleure) {
      console.log(`\n  → sur cette zone, le moins de faux départs : pause ${meilleure.pause}s `
        + `(${Math.round(meilleure.partConnecteur * 100)} % de phrases ouvrant sur un connecteur)`);
      console.log('\n  Les 6 premières phrases à ce seuil :');
      for (const p of meilleure.phrases.slice(0, 6)) {
        console.log(`    [${mmss(p.debut)}→${mmss(p.fin)}] ${p.texte.slice(0, 82)}`);
      }
    }
  }

  console.log('\n══════════════════════════════════════════════════════════');
  // ⚠️ PAS de backticks imbriqués autour de `-ss` ici : `\`Dérive \`-ss\` …\`` se parse
  // comme un tagged template (`ss` pris pour une fonction de balise), passe `node
  // --check` sans broncher, et explose à l'exécution sur « ss is not defined ».
  console.log(`Dérive de -ss retenue : ${Math.round(derive * 1000)} ms.`);
  console.log('Rien n\'a été écrit en base, aucune vidéo produite.');
}

main().catch((e) => { console.error('\n❌ ' + e.stack); process.exit(1); });
