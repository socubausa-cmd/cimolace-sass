/**
 * 06-refit-sketches.mjs — RECADRE les croquis des cours DÉJÀ en base (sans repayer de génération).
 * Le modèle dessine souvent au centre (x 25→75) : le croquis n'occupe alors que la moitié du
 * tableau et paraît minuscule, labels illisibles. On applique l'homothétie déterministe de
 * `sketchFit.mjs` à chaque `sketch` et `reveal_sketch`, puis on réécrit le cours.
 *
 * Usage : node tools/precepteur-tiktok/06-refit-sketches.mjs [--apply]   (simulation par défaut)
 */
import { sql, q, TENANT_ID, log } from './common.mjs';
import { fitSketchToCanvas } from './sketchFit.mjs';

const APPLY = process.argv.includes('--apply');

const span = (els) => {
  const xs = []; const ys = [];
  for (const e of els) {
    if (e.center) { xs.push(e.center[0]); ys.push(e.center[1]); }
    if (e.from) { xs.push(e.from[0], e.to[0]); ys.push(e.from[1], e.to[1]); }
  }
  return xs.length ? `x ${Math.min(...xs)}→${Math.max(...xs)} · y ${Math.min(...ys)}→${Math.max(...ys)}` : '—';
};

const rows = sql(`select id, title, course from precepteur_courses where tenant_id=${q(TENANT_ID)}::uuid order by created_at;`)
  .split('\n').filter(Boolean).map((l) => {
    const i1 = l.indexOf('|'); const i2 = l.indexOf('|', i1 + 1);
    return { id: l.slice(0, i1), title: l.slice(i1 + 1, i2), course: l.slice(i2 + 1) };
  });

log(`${rows.length} cours en base${APPLY ? '' : ' — SIMULATION (ajoute --apply pour écrire)'}`);
let touched = 0; let sketches = 0;

for (const r of rows) {
  let course;
  try { course = JSON.parse(r.course); } catch { log(`  ⚠️ ${r.title} — JSON illisible`); continue; }
  let changed = false;
  for (const c of course.concepts || []) {
    for (const s of c.scenes || []) {
      for (const key of ['sketch', 'reveal_sketch']) {
        const sk = s[key];
        if (!sk || !Array.isArray(sk.elements) || !sk.elements.length) continue;
        const before = span(sk.elements);
        const next = fitSketchToCanvas(sk.elements);
        const after = span(next);
        sketches += 1;
        if (after !== before) {
          s[key] = { ...sk, elements: next };
          changed = true;
          log(`  ↔︎ ${r.title.slice(0, 42)} · ${key} : ${before}  →  ${after}`);
        }
      }
    }
  }
  if (changed) {
    touched += 1;
    if (APPLY) sql(`update precepteur_courses set course=${q(JSON.stringify(course))}::jsonb where id=${q(r.id)}::uuid;`);
  }
}
log(`🏁 ${sketches} croquis inspectés · ${touched} cours ${APPLY ? 'recadrés' : 'à recadrer'}`);
