#!/usr/bin/env node
/**
 * Garde-fou Bash (hook PreToolUse) — cimolace.
 *
 * Bloque MÉCANIQUEMENT 3 règles « absolues » déjà écrites dans CLAUDE.md / mémoire,
 * que rien ne protégeait jusqu'ici (et qui ont déjà été enfreintes) :
 *
 *   1. `git add -A/./--all/*` et `git commit -a/--all/-am`  → index git PARTAGÉ entre
 *      sessions concurrentes : stage le WIP d'un autre. Règle : `git commit -- <chemins>`.
 *   2. `vercel --prod` À LA MAIN  → CLAUDE.md règle #1 : `bash deploy-liri.sh` UNIQUEMENT
 *      (smoke test runtime + rollback auto ; sinon prod BLANCHE `undefined.default`).
 *   3. Afficher `.env.production`  → secrets (DATABASE_URL, SUPABASE_JWT_SECRET, LiveKit,
 *      Stripe). Ne jamais imprimer les valeurs ; grep seulement les NOMS de clés.
 *
 * Contrat hook : lit le JSON de l'appel outil sur stdin, `exit 2` (+ message stderr)
 * pour BLOQUER, `exit 0` pour laisser passer. Fail-open : toute erreur interne = exit 0.
 */
import { readFileSync } from 'node:fs';

function block(msg) {
  process.stderr.write(`⛔ GARDE-FOU cimolace — ${msg}\n`);
  process.exit(2);
}

let cmd = '';
try {
  const raw = readFileSync(0, 'utf8');
  cmd = String(JSON.parse(raw || '{}')?.tool_input?.command ?? '');
} catch {
  process.exit(0); // pas de commande lisible → ne pas bloquer
}
if (!cmd.trim()) process.exit(0);

// 1a) git add -A / . / --all / *
if (/\bgit\s+add\b[^|;&\n]*?(\s-A\b|\s--all\b|\s\.(\s|$)|\s\*(\s|$))/.test(cmd)) {
  block(
    '« git add -A / . / --all / * » interdit : l’index git est PARTAGÉ entre sessions '
    + 'concurrentes (tu stagerais le WIP d’une autre). Utilise « git add <chemin précis> » '
    + 'ou directement « git commit -m "…" -- <chemins> ».',
  );
}
// 1b) git commit -a / --all / -am  (stage tous les fichiers suivis modifiés)
if (/\bgit\s+commit\b[^|;&\n]*?\s(--all\b|-[a-z]*a[a-z]*)/i.test(cmd)) {
  block(
    '« git commit -a / --all / -am » interdit : stage TOUT le suivi modifié (WIP d’autres '
    + 'sessions inclus). Utilise « git commit -m "…" -- <chemins explicites> ».',
  );
}

// 2) vercel --prod à la main (hors deploy-liri.sh qui l’appelle en interne)
if (/\bvercel\b/.test(cmd) && /(--prod\b|deploy\s+--prod)/.test(cmd) && !/deploy-liri\.sh/.test(cmd)) {
  block(
    '« vercel --prod » à la main interdit (CLAUDE.md règle #1). Déploie via '
    + '« bash deploy-liri.sh » : smoke test runtime + rollback auto avant de basculer '
    + 'origin/main (un HEAD committé peut rendre la prod BLANCHE sur toutes les routes).',
  );
}

// 3) dump complet de .env.production (secrets) — on bloque les verbes qui affichent
// TOUT le fichier ; grep/awk restent permis (extraction de NOMS de clés seulement).
if (
  /\.env\.production\b/.test(cmd)
  && /\b(cat|less|more|head|tail|bat|nl|xxd|strings|od|jq)\b/.test(cmd)
  && !/(run-sql|deploy-liri)/.test(cmd)
) {
  block(
    'Dump de .env.production interdit (secrets : DATABASE_URL / JWT / LiveKit / Stripe). '
    + 'Lis-le sans imprimer les valeurs (ex. run-sql.js le lit en interne), ou grep '
    + 'UNIQUEMENT les noms de clés : `grep -oE "^[A-Z_]+=" .env.production`.',
  );
}

process.exit(0);
