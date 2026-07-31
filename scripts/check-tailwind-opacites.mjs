#!/usr/bin/env node
/**
 * check-tailwind-opacites — REFUSE LES CLASSES D'OPACITÉ QUI NE PRODUISENT AUCUN STYLE.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE DÉFAUT QUE CE CONTRÔLE EMPÊCHE DE REVENIR
 * ════════════════════════════════════════════════════════════════════════════
 * Tailwind n'accepte au modificateur d'opacité que les clés de son ÉCHELLE
 * (0, 5, 10, 15 … 95, 100). Écrire `border-white/12` ou `text-white/88` produit une
 * classe **morte** : aucune règle CSS n'est générée. La bordure retombe alors sur le
 * gris clair du preflight, et le texte hérite de la couleur du parent.
 *
 * ⭐ C'EST LE PIRE GENRE DE BOGUE : il est INVISIBLE À LA RELECTURE. `border-white/12`
 * a l'air parfaitement normal, personne ne le signale en revue, aucun outil ne
 * bronche, le build passe au vert. Il ne se voit qu'à l'écran, et seulement si l'on
 * sait quoi chercher.
 *
 * Relevé une fois, sur ce dépôt : **1141 occurrences dans 199 fichiers** — dont 137
 * dans le seul tableau blanc de la salle de classe en direct. Aucune n'avait jamais
 * été signalée.
 *
 * ⚠️ LA FORME CORRECTE POUR UNE VALEUR LIBRE EST LA SYNTAXE À CROCHETS : `/[0.12]`.
 * Elle est toujours émise, quelle que soit la valeur, et elle est déjà employée plus
 * de 2 500 fois ici. Ce n'est donc pas une contrainte nouvelle imposée au code : c'est
 * la convention majoritaire du dépôt, qu'on fait simplement respecter.
 *
 * Usage :
 *   node scripts/check-tailwind-opacites.mjs [dossier]     → contrôle, sort 1 si faute
 *   node scripts/check-tailwind-opacites.mjs --corriger    → convertit et sort 0
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

/**
 * L'échelle réellement émise par Tailwind pour les modificateurs d'opacité.
 *
 * ⚠️ RELEVÉE DANS LE CSS BÂTI DE CE PROJET, pas recopiée d'une documentation. La
 * première version de cette règle disait « multiples de 5 » et c'était FAUX : le CSS
 * contenait aussi 1, 2, 3, 4, 9, 11, 16 — qui venaient en réalité de la syntaxe à
 * crochets. Se fier à la doc plutôt qu'au produit aurait laissé passer la moitié des
 * cas. Pour revérifier après une montée de version de Tailwind :
 *     grep -oE '\\\\/[0-9]{1,3}' apps/app/dist/assets/*.css | tr -d '\\\\/' | sort -nu
 */
const ECHELLE = new Set([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]);

/**
 * Préfixes d'utilitaires qui acceptent un modificateur d'opacité. La liste est
 * volontairement EXPLICITE : un motif large attraperait des fractions de texte
 * ordinaire (« 3/4 des élèves ») ou des chemins d'import, et un contrôle qui crie au
 * loup finit désactivé.
 */
const PREFIXES = 'text|bg|border|ring|shadow|from|to|via|divide|outline|decoration|placeholder|fill|stroke|accent|caret';
const MOTIF = new RegExp(`\\b((?:${PREFIXES})-[^\\s"'\`/]+(?:\\[[^\\]]*\\])?)/(\\d{1,3})\\b`, 'g');

const EXCLUS = new Set(['node_modules', 'dist', 'build', '.git', '.next', 'coverage']);

async function fichiersSources(racine) {
  const out = [];
  const parcourir = async (d) => {
    let entrees;
    try { entrees = await readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of entrees) {
      if (e.name.startsWith('.') && e.name !== '.') continue;
      const p = join(d, e.name);
      if (e.isDirectory()) { if (!EXCLUS.has(e.name)) await parcourir(p); }
      else if (/\.(jsx|tsx)$/.test(e.name)) out.push(p);
    }
  };
  await parcourir(racine);
  return out;
}

const argv = process.argv.slice(2);
const CORRIGER = argv.includes('--corriger');
const RACINE = argv.find((a) => !a.startsWith('--')) || 'apps/app/src';

const fautes = [];
let corrigees = 0;

for (const p of await fichiersSources(RACINE)) {
  const src = readFileSync(p, 'utf8');
  let modifie = src;
  let n = 0;

  modifie = src.replace(MOTIF, (tout, util, val) => {
    const v = Number(val);
    // > 100 : ce n'est pas une opacité (z-index, poids de police écrits en fraction).
    if (v > 100 || ECHELLE.has(v)) return tout;
    // Une valeur déjà arbitraire (`bg-[rgba(…)]/12`) reste fautive de la même façon,
    // mais on ne veut pas casser la partie entre crochets : seul le modificateur bouge.
    n += 1;
    if (!CORRIGER) {
      const ligne = src.slice(0, src.indexOf(tout)).split('\n').length;
      fautes.push({ fichier: relative(process.cwd(), p), ligne, classe: tout, propose: `${util}/[0.${String(v).padStart(2, '0')}]` });
      return tout;
    }
    return `${util}/[0.${String(v).padStart(2, '0')}]`;
  });

  if (CORRIGER && n > 0) { writeFileSync(p, modifie); corrigees += n; }
}

if (CORRIGER) {
  console.log(`✅ ${corrigees} opacité(s) converties en syntaxe à crochets.`);
  process.exit(0);
}

if (fautes.length === 0) {
  console.log('✅ Aucune classe d\'opacité morte.');
  process.exit(0);
}

console.error(`\n⛔ ${fautes.length} classe(s) d'opacité NE PRODUISENT AUCUN STYLE.\n`);
console.error('   Tailwind n\'émet le modificateur que pour les clés de son échelle');
console.error('   (0, 5, 10 … 95, 100). Les autres valeurs doivent passer par la syntaxe');
console.error('   à crochets — déjà employée plus de 2 500 fois dans ce dépôt.\n');
for (const f of fautes.slice(0, 25)) {
  console.error(`   ${f.fichier}:${f.ligne}`);
  console.error(`     ${f.classe}  →  ${f.propose}`);
}
if (fautes.length > 25) console.error(`   … et ${fautes.length - 25} autre(s).`);
console.error('\n   Correction automatique :  node scripts/check-tailwind-opacites.mjs --corriger\n');
process.exit(1);
