#!/usr/bin/env node
// surveillance.js — ISNA V2 branch monitor — powered by DeepSeek Flash

const { execSync } = require('child_process');

const REPO    = '/Users/ngowazulu/Downloads/isna-opus';

// Worktree de chaque branche pour les opérations fichiers (build)
const WORKTREES = {
  'feat/flash-migrations-worker' : '/Users/ngowazulu/Downloads/isna-flash',
  'feat/api-branding-marketing'  : '/Users/ngowazulu/Downloads/isna-sonnet',
  'feat/app-ui-flows'            : '/Users/ngowazulu/Downloads/isna-pro',
  'feat/opus-billing-roles'      : '/Users/ngowazulu/Downloads/isna-opus',
};
const INTERVAL = 3 * 60 * 1000; // 3 min
const KEY     = process.env.DEEPSEEK_API_KEY;

// ─── Ordre de merge strict ────────────────────────────────────────────────────
const QUEUE = [
  {
    branch  : 'feat/flash-migrations-worker',
    agent   : 'DeepSeek Flash',
    requiredFiles: [
      'supabase/migrations/20250505_004_marketing.sql',
      'supabase/seeds/002_marketing_seed.sql',
      'apps/worker/src/inngest.ts',
      'apps/worker/src/jobs/sendEmail.ts',
      'apps/worker/src/jobs/processVideo.ts',
      'apps/worker/src/jobs/generateAiContent.ts',
    ],
    criteria: [
      'supabase/migrations/20250505_004_marketing.sql (tables promo_codes, popups, banners + RLS)',
      'supabase/seeds/002_marketing_seed.sql (PROMO10, BIENVENUE20, popup, banner)',
      'apps/worker/src/inngest.ts — client Inngest stub',
      'apps/worker/src/jobs/sendEmail.ts',
      'apps/worker/src/jobs/processVideo.ts',
      'apps/worker/src/jobs/generateAiContent.ts',
    ],
  },
  {
    branch    : 'feat/api-branding-marketing',
    agent     : 'Claude Sonnet',
    buildDir  : 'apps/api',
    requiredFiles: [
      'apps/api/src/tenant/update-branding.dto.ts',
      'apps/api/src/common/decorators/roles.decorator.ts',
      'apps/api/src/common/guards/roles.guard.ts',
      'apps/api/src/marketing/marketing.module.ts',
      'apps/api/src/marketing/marketing.controller.ts',
      'apps/api/src/marketing/marketing.service.ts',
    ],
    criteria  : [
      'apps/api/src/tenant/update-branding.dto.ts (name?, logo_url?, primary_domain?, brand_colors?)',
      'apps/api/src/common/decorators/roles.decorator.ts (TenantRole union + @Roles)',
      'apps/api/src/common/guards/roles.guard.ts (lit req.tenant.userRole)',
      'apps/api/src/marketing/ — module scaffold complet',
      'npm run build dans apps/api réussit',
    ],
  },
  {
    branch : 'feat/app-ui-flows',
    agent  : 'DeepSeek V4 Pro',
    requiredFiles: [
      'apps/app/src/lib/api.ts',
      'apps/app/src/App.tsx',
      'apps/app/src/pages/DashboardLives.tsx',
      'apps/app/src/pages/DashboardLivesNew.tsx',
      'apps/app/src/pages/LiveJoin.tsx',
    ],
    criteria: [
      'apps/app/src/lib/api.ts — client centralisé (Bearer + X-Tenant-Slug)',
      'apps/app/src/App.tsx — QueryClientProvider + BrowserRouter + routes',
      'apps/app/src/pages/DashboardLives.tsx — liste lives + bouton Créer',
      'apps/app/src/pages/DashboardLivesNew.tsx — formulaire POST /lives',
      'apps/app/src/pages/LiveJoin.tsx — token LiveKit + bouton Payer si 403',
    ],
  },
  {
    branch : 'feat/opus-billing-roles',
    agent  : 'Claude Opus',
    requiredFiles: [
      'docs/SECURITY_REVIEW.md',
      'docs/PHASE_BILLING_ROLES_SPEC.md',
      'supabase/migrations/20250505000005_billing.sql',
    ],
    criteria: [
      'docs/SECURITY_REVIEW.md — 12 risques documentés par sévérité',
      'docs/PHASE_BILLING_ROLES_SPEC.md — schéma SQL billing + matrice 6 rôles + 8 endpoints',
      'supabase/migrations/20250505000005_billing.sql — subscriptions, invoices, billing_events + RLS',
    ],
  },
];

const merged = new Set();

// ─── Helpers git ──────────────────────────────────────────────────────────────
function git(cmd) {
  try {
    return execSync(`git -C ${REPO} ${cmd}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

function branchInfo(branch) {
  const files   = git(`ls-tree -r --name-only ${branch}`);
  const commits = git(`log --oneline ${branch} ^main`);
  return { files, commits };
}

function runBuild(branch, dir) {
  const worktree = WORKTREES[branch] ?? REPO;
  const buildPath = `${worktree}/${dir}`;
  try {
    if (!require('fs').existsSync(`${worktree}/node_modules`)) {
      execSync(`cd ${worktree} && npm install`, { encoding: 'utf8', stdio: 'pipe', timeout: 120_000 });
    }
    execSync(`cd ${buildPath} && npm run build`, {
      encoding: 'utf8',
      stdio   : 'pipe',
      timeout : 90_000,
    });
    return 'BUILD OK';
  } catch (e) {
    const out = (e.stdout || '') + (e.stderr || '');
    return `BUILD FAIL:\n${out.slice(-600)}`;
  }
}

// ─── DeepSeek Flash API ───────────────────────────────────────────────────────
async function askDeepSeek(prompt) {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method : 'POST',
    headers: {
      'Content-Type' : 'application/json',
      'Authorization': `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      model      : 'deepseek-chat',
      temperature: 0,
      messages   : [{ role: 'user', content: prompt }],
    }),
  });
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}

async function analyzeWithDeepSeek(item, buildResult) {
  const { branch, agent, criteria, requiredFiles } = item;
  const { files, commits } = branchInfo(branch);

  if (!files) return { ready: false, reason: 'Branche vide ou inexistante', missing: [] };

  // Vérification déterministe des fichiers obligatoires
  const missingFiles = (requiredFiles ?? []).filter(f => !files.includes(f));
  if (missingFiles.length > 0) {
    return {
      ready  : false,
      reason : `${missingFiles.length} fichier(s) obligatoire(s) manquant(s)`,
      missing: missingFiles,
    };
  }

  // Si build fail, inutile d'appeler DeepSeek
  if (buildResult?.startsWith('BUILD FAIL')) {
    return { ready: false, reason: 'Build échoué', missing: ['npm run build doit réussir'] };
  }

  // DeepSeek analyse la qualité des fichiers présents
  const prompt = `Tu es un assistant CI pour le projet ISNA V2.

Branche : ${branch}
Agent   : ${agent}

Tous les fichiers obligatoires sont présents.
Vérifie maintenant la QUALITÉ du travail selon ces critères :
${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Commits vs main :
${commits || '(aucun nouveau commit — travail peut-être non commité)'}

${item.buildDir ? `Build ${item.buildDir} : ${buildResult}` : ''}

Si les commits sont vides, le travail n'est probablement pas commité — retourne ready: false.

Réponds UNIQUEMENT avec du JSON valide, sans markdown :
{"ready": true|false, "reason": "explication courte", "missing": ["problèmes détectés"]}`;

  const raw = await askDeepSeek(prompt);
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { ready: false, reason: 'Réponse invalide', missing: [] };
  } catch {
    return { ready: false, reason: `Parse error: ${raw.slice(0, 100)}`, missing: [] };
  }
}

// ─── Merge avec résolution automatique des conflits ──────────────────────────
function merge(branch) {
  git(`checkout main`);

  // Tentative merge propre
  const clean = (() => {
    try {
      git(`merge --no-ff ${branch} -m "merge: ${branch} — agent terminé"`);
      return true;
    } catch {
      return false;
    }
  })();

  if (clean) return { ok: true, resolved: [] };

  // Récupère les fichiers en conflit
  const status = git(`status --porcelain`);
  const conflicted = status
    .split('\n')
    .filter(l => l.match(/^(UU|AA|DD|AU|UA)/))
    .map(l => l.slice(3).trim())
    .filter(Boolean);

  if (conflicted.length === 0) {
    git(`merge --abort`);
    return { ok: false, resolved: [], error: 'Erreur merge inconnue' };
  }

  // Stratégie : prendre "theirs" (branche entrante) sur chaque conflit
  // Opus en dernier → ses correctifs de sécurité sont prioritaires
  for (const file of conflicted) {
    try {
      git(`checkout --theirs -- ${file}`);
      git(`add ${file}`);
    } catch {
      git(`merge --abort`);
      return { ok: false, resolved: [], error: `Impossible de résoudre ${file}` };
    }
  }

  // Finalise le merge
  try {
    execSync(
      `git -C ${REPO} commit -m "merge: ${branch} — agent terminé (conflits auto-résolus)"`,
      { encoding: 'utf8', stdio: 'pipe' }
    );
    return { ok: true, resolved: conflicted };
  } catch {
    git(`merge --abort`);
    return { ok: false, resolved: [], error: 'Échec commit après résolution' };
  }
}

// ─── Logging coloré ───────────────────────────────────────────────────────────
const C = {
  reset : '\x1b[0m',
  cyan  : '\x1b[36m',
  green : '\x1b[32m',
  red   : '\x1b[31m',
  yellow: '\x1b[33m',
  purple: '\x1b[35m',
};

function log(msg, type = 'info') {
  const map = {
    info : { icon: '●', color: C.cyan   },
    ok   : { icon: '✓', color: C.green  },
    error: { icon: '✗', color: C.red    },
    wait : { icon: '○', color: C.yellow },
    merge: { icon: '⎇', color: C.purple },
  };
  const { icon, color } = map[type] ?? map.info;
  const time = new Date().toLocaleTimeString('fr-FR');
  console.log(`${color}[${time}] ${icon}  ${msg}${C.reset}`);
}

// ─── Cycle principal ──────────────────────────────────────────────────────────
async function cycle() {
  console.log('\n' + '─'.repeat(64));
  log(`Cycle — ${new Date().toLocaleString('fr-FR')}`, 'info');

  // Auto-détecte les branches déjà mergées (commits ahead = 0)
  for (const { branch } of QUEUE) {
    if (!merged.has(branch)) {
      const ahead = git(`log --oneline ${branch} ^main`);
      if (!ahead) {
        merged.add(branch);
        log(`${branch}  déjà dans main — ignorée`, 'ok');
      }
    }
  }

  for (let i = 0; i < QUEUE.length; i++) {
    const item = QUEUE[i];
    const { branch, agent } = item;

    if (merged.has(branch)) {
      log(`${branch}  ✓ déjà mergée`, 'ok');
      continue;
    }

    // Respect ordre : attendre la branche précédente
    if (i > 0 && !merged.has(QUEUE[i - 1].branch)) {
      log(`${branch}  en attente de ${QUEUE[i - 1].branch}`, 'wait');
      continue;
    }

    log(`Analyse  ${branch}  (${agent})...`, 'info');

    const buildResult = item.buildDir ? runBuild(branch, item.buildDir) : null;
    if (buildResult?.startsWith('BUILD FAIL')) {
      log(`${branch}  build échoué — merge bloqué`, 'error');
      log(buildResult.split('\n').slice(-3).join(' '), 'error');
      continue;
    }

    const result = await analyzeWithDeepSeek(item, buildResult);

    if (result.ready) {
      log(`${branch}  PRÊTE — merge en cours...`, 'merge');
      const { ok, resolved, error } = merge(branch);
      if (ok) {
        merged.add(branch);
        if (resolved.length > 0) {
          log(`${branch}  MERGÉE — ${resolved.length} conflit(s) auto-résolu(s) ✓`, 'ok');
          resolved.forEach(f => log(`   ⎇ conflit résolu (theirs) : ${f}`, 'merge'));
          log(`   → Vérifie ces fichiers : version de "${agent}" retenue`, 'wait');
        } else {
          log(`${branch}  MERGÉE dans main ✓ (sans conflit)`, 'ok');
        }
        const next = QUEUE[i + 1];
        if (next) log(`Prochaine cible : ${next.branch} (${next.agent})`, 'info');
      } else {
        log(`${branch}  ÉCHEC MERGE — ${error}`, 'error');
        log(`   → Intervention manuelle requise`, 'error');
      }
    } else {
      log(`${branch}  pas prête : ${result.reason}`, 'wait');
      (result.missing ?? []).forEach(m => log(`   → ${m}`, 'wait'));
    }
  }

  if (merged.size === QUEUE.length) {
    log('TOUTES LES BRANCHES MERGÉES — surveillance terminée', 'ok');
    process.exit(0);
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
if (!KEY) {
  console.error(`${C.red}❌  DEEPSEEK_API_KEY manquante.${C.reset}`);
  console.error(`   Lance avec : DEEPSEEK_API_KEY=sk-xxx node surveillance.js`);
  process.exit(1);
}

console.log(`${C.purple}
╔══════════════════════════════════════════════╗
║   ISNA V2 — Surveillance branches            ║
║   Modèle  : DeepSeek Flash                   ║
║   Repo    : ${REPO.split('/').pop().padEnd(32)}║
║   Intervalle : 3 minutes                     ║
╚══════════════════════════════════════════════╝${C.reset}`);

QUEUE.forEach((q, i) =>
  log(`${i + 1}. ${q.branch}  (${q.agent})`, 'wait')
);

cycle();
setInterval(cycle, INTERVAL);
