/**
 * 04-batch.mjs — ORCHESTRATEUR du traitement de masse (645 vidéos TikTok → cours Précepteur).
 * Boucle : transcrire un paquet (priorité aux titres qui annoncent un enseignement) → générer
 * les cours de ce paquet → recommencer. Idempotent et RELANÇABLE : chaque vidéo ne passe qu'une
 * fois (statuts en base), un plantage n'annule rien de ce qui est déjà fait.
 *
 * Usage : node tools/precepteur-tiktok/04-batch.mjs [--chunk 6] [--max 600] [--stop-after-min 480]
 *   --chunk           taille d'un paquet (transcrire N puis générer N)
 *   --max             nombre max de vidéos TRANSCRITES sur ce run (garde-fou coût)
 *   --stop-after-min  durée max du run en minutes (garde-fou)
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql, q, TENANT_ID, log } from './common.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > -1 ? Number(process.argv[i + 1]) : dflt; };
const CHUNK = arg('--chunk', 6);
const MAX = arg('--max', 1000);
const STOP_AFTER_MS = arg('--stop-after-min', 600) * 60_000;

const startedAt = Date.now();
const counts = () => Object.fromEntries(
  sql(`select status, count(*) from precepteur_sources where tenant_id=${q(TENANT_ID)}::uuid group by status;`)
    .split('\n').filter(Boolean).map((l) => { const [s, n] = l.split('|'); return [s, Number(n)]; }),
);
const nbCourses = () => Number(sql(`select count(*) from precepteur_courses where tenant_id=${q(TENANT_ID)}::uuid;`) || 0);

function run(script, args) {
  try {
    const out = execFileSync('node', [path.join(HERE, script), ...args], {
      encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, env: process.env,
    });
    // On relaie les lignes utiles (✅ ⏭️ ❌) pour garder une trace lisible du run.
    out.split('\n').filter((l) => /[✅⏭❌🔎]/.test(l)).forEach((l) => console.log('   ' + l.trim()));
    return true;
  } catch (e) {
    log(`  ⚠️ ${script} a échoué : ${String(e.message).split('\n')[0].slice(0, 160)}`);
    return false; // on continue : le prochain tour reprendra la file
  }
}

let transcribed = 0;
let round = 0;
log(`▶️  BATCH — paquets de ${CHUNK} · max ${MAX} vidéos · ${Math.round(STOP_AFTER_MS / 60000)} min`);
log(`   état initial : ${JSON.stringify(counts())} · cours : ${nbCourses()}`);

for (;;) {
  const c = counts();
  const restants = c.new || 0;
  if (!restants) { log('✅ Plus aucune vidéo à transcrire.'); break; }
  if (transcribed >= MAX) { log(`⏹️  Plafond --max ${MAX} atteint.`); break; }
  if (Date.now() - startedAt > STOP_AFTER_MS) { log('⏹️  Durée max du run atteinte.'); break; }

  round += 1;
  const take = Math.min(CHUNK, MAX - transcribed);
  log(`── tour ${round} · ${restants} vidéo(s) restante(s) · transcription de ${take}…`);
  run('02-transcribe.mjs', ['--limit', String(take), '--model', 'small']);
  transcribed += take;

  log(`   génération des cours du paquet…`);
  run('03-generate.mjs', ['--limit', String(take)]);

  const c2 = counts();
  log(`   → ${JSON.stringify(c2)} · cours : ${nbCourses()} · ${Math.round((Date.now() - startedAt) / 60000)} min écoulées`);
}

log(`🏁 FIN — ${JSON.stringify(counts())} · cours en base : ${nbCourses()} · durée ${Math.round((Date.now() - startedAt) / 60000)} min`);
