#!/usr/bin/env node
/**
 * Trouve les modules NestJS qui existent dans src/ mais ne sont pas wired dans AppModule.
 * (Bug type MasterclassFactory : code complet mais routes 404 car non importé dans AppModule.)
 */
const fs = require('fs');
const path = require('path');

const SRC = '/Users/ngowazulu/Downloads/isna_platform_v2/apps/api/src';
const APP_MODULE = path.join(SRC, 'app.module.ts');

function listModuleFiles(dir, depth = 0) {
  const results = [];
  if (depth > 3) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listModuleFiles(full, depth + 1));
    } else if (entry.name.endsWith('.module.ts')) {
      results.push(full);
    }
  }
  return results;
}

function listControllerFiles(dir, depth = 0) {
  const results = [];
  if (depth > 3) return results;
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listControllerFiles(full, depth + 1));
    } else if (entry.name.endsWith('.controller.ts')) {
      results.push(full);
    }
  }
  return results;
}

function extractModuleClassName(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/export class (\w+Module)\b/);
  return match ? match[1] : null;
}

function countEndpoints(dir) {
  const controllers = listControllerFiles(dir);
  let total = 0;
  for (const c of controllers) {
    const txt = fs.readFileSync(c, 'utf8');
    const matches = txt.match(/@(Get|Post|Patch|Delete|Put)\(/g) || [];
    total += matches.length;
  }
  return total;
}

// Charger AppModule
const appModuleContent = fs.readFileSync(APP_MODULE, 'utf8');

// Lister tous les *.module.ts (sauf app.module.ts)
const allModules = listModuleFiles(SRC)
  .filter((f) => !f.endsWith('app.module.ts') && !f.endsWith('app.module.min.ts'));

const orphans = [];
const wired = [];
const noController = [];

for (const f of allModules) {
  const className = extractModuleClassName(f);
  if (!className) continue;

  const dir = path.dirname(f);
  const hasController = listControllerFiles(dir).length > 0;
  const endpoints = countEndpoints(dir);

  // Vérifier dans AppModule import + imports[]
  const importRegex = new RegExp(`import\\s+\\{[^}]*\\b${className}\\b[^}]*\\}`);
  const isImported = importRegex.test(appModuleContent);
  const isInArray = new RegExp(`\\b${className}\\b\\s*[,\\]]`).test(appModuleContent);
  const isWired = isImported && isInArray;

  const relDir = path.relative(SRC, dir) || 'root';

  if (!hasController) {
    noController.push({ className, dir: relDir });
  } else if (isWired) {
    wired.push({ className, dir: relDir, endpoints });
  } else {
    orphans.push({ className, dir: relDir, endpoints });
  }
}

console.log('═══════════════════════════════════════════════════════════');
console.log('  AUDIT — Modules NestJS et leur état dans AppModule');
console.log('═══════════════════════════════════════════════════════════\n');

console.log(`✅ MODULES WIRED dans AppModule (${wired.length}) — endpoints actifs`);
wired.sort((a, b) => b.endpoints - a.endpoints);
wired.forEach((m) => console.log(`  ✅ ${m.className.padEnd(30)} (${m.dir}/) — ${m.endpoints} endpoints`));

console.log(`\n❌ MODULES ORPHELINS (${orphans.length}) — code existe mais routes 404`);
orphans.sort((a, b) => b.endpoints - a.endpoints);
if (orphans.length === 0) {
  console.log('  🎉 AUCUN module orphelin !');
} else {
  orphans.forEach((m) => console.log(`  ❌ ${m.className.padEnd(30)} (${m.dir}/) — ${m.endpoints} endpoints PERDUS`));
}

console.log(`\n⚠️  MODULES SANS CONTROLLER (${noController.length}) — services internes only`);
noController.forEach((m) => console.log(`  ⚠️  ${m.className.padEnd(30)} (${m.dir}/) — service-only`));

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`Total: ${wired.length} wired + ${orphans.length} orphans + ${noController.length} no-controller = ${allModules.length}`);
