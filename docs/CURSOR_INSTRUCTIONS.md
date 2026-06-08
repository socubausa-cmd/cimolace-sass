# Instructions Cursor — Initialisation V2

> **Archive / ancienne consigne.** Après audit du 2026-05-10, ne pas exécuter ce fichier tel quel : il pointe vers `isna_platform_v2`, alors que la base fonctionnelle MVP retenue est `isna-opus`. Lire d'abord `docs/AGENT_HANDOFF_STATUS_V2.md`, puis recréer une base Git propre depuis `isna-opus` avant d'assigner Cursor/agents.

## Contexte

Tu es l'Agent Cursor. Ta mission : préparer l'infrastructure data, Supabase, migrations, seeds et workers pour la V2.

Ancien workspace indiqué dans cette consigne :

```txt
/Users/ngowazulu/Downloads/isna_platform_v2
```

Workspace fonctionnel audité :

```txt
/Users/ngowazulu/Downloads/isna-opus
```

La V1 de référence est dans :

```txt
/Users/ngowazulu/Downloads/isna_app
```

Ne modifie jamais la V1. Tu travailles uniquement dans la V2.

## Règles absolues

- Pas de secrets dans Git.
- Pas de connexion à l'ancien Supabase bloqué (`ybmczqlfbbmypeszqkal`).
- Tout nouveau Supabase doit être un projet frais.
- Les migrations doivent être documentées et ordonnées.
- Le worker doit être minimal au début.

---

## Mission 1 — Initialiser Git

Dans le workspace V2 :

```bash
cd /Users/ngowazulu/Downloads/isna_platform_v2
git init
git checkout -b main
```

Créer les branches :

```bash
git checkout -b staging
git checkout -b agent/cursor-data-workers
```

Faire un premier commit avec la structure existante :

```bash
git checkout main
git add .
git commit -m "feat: fondation V2 — structure, docs, coordination multi-agents"
```

---

## Mission 2 — Créer Supabase V2 dev/staging

### 2.1 Créer le projet

Aller sur [https://app.supabase.com](https://app.supabase.com) et créer un nouveau projet :

```txt
Nom : isna-v2-dev
Région : la plus proche
Plan : Free
```

### 2.2 Récupérer les clés

Noter :

```txt
URL          : https://xxxxx.supabase.co
ANON_KEY     : eyJ...
SERVICE_ROLE : eyJ...
```

### 2.3 Remplir les .env.example

Copier les `.env.example` vers `.env` localement et remplacer les placeholders :

```bash
cp .env.example .env
cp apps/app/.env.example apps/app/.env
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
```

Remplacer `replace_me` par les vraies valeurs dans chaque `.env`.

Ne jamais committer les `.env`.

---

## Mission 3 — Auditer les migrations V1

### 3.1 Lister toutes les migrations

Explorer :

```txt
/Users/ngowazulu/Downloads/isna_app/supabase/migrations/
```

### 3.2 Produire un inventaire

Créer un fichier :

```txt
docs/MIGRATIONS_INVENTORY.md
```

Format :

```md
# Inventaire migrations V1 → V2

## Ordre d'exécution recommandé

1. `20250504_forum_complete.sql` — tables forum
2. `20250505_marketing_tools.sql` — tables marketing
3. ...

## Tables critiques

- profiles
- tenants (à créer)
- tenant_memberships (à créer)
- ...

## Tables à ignorer ou repenser

- ...
```

### 3.3 Identifier les dépendances

Noter quelles tables dépendent de quelles autres.

---

## Mission 4 — Créer le schéma tenant V2

Avant de rejouer les migrations V1, créer les tables fondamentales V2.

### 4.1 Créer la migration tenant

Fichier :

```txt
supabase/migrations/20250505_001_tenants.sql
```

Contenu minimal :

```sql
-- Tenants
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_user_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'active',
  plan TEXT DEFAULT 'free',
  billing_status TEXT DEFAULT 'unpaid',
  primary_domain TEXT,
  logo_url TEXT,
  brand_colors JSONB DEFAULT '{}',
  timezone TEXT DEFAULT 'UTC',
  locale TEXT DEFAULT 'fr',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tenant memberships
CREATE TABLE tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'student',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- Indexes
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_owner ON tenants(owner_user_id);
CREATE INDEX idx_memberships_tenant ON tenant_memberships(tenant_id);
CREATE INDEX idx_memberships_user ON tenant_memberships(user_id);

-- RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Tenant visible par membres" ON tenants
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM tenant_memberships WHERE tenant_id = id AND user_id = auth.uid())
  );

CREATE POLICY "Tenant modifiable par owner/admin" ON tenants
  FOR UPDATE USING (
    EXISTS(SELECT 1 FROM tenant_memberships WHERE tenant_id = id AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

CREATE POLICY "Membership visible par soi-même" ON tenant_memberships
  FOR SELECT USING (user_id = auth.uid());

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 4.2 Créer la migration access_pass

Fichier :

```txt
supabase/migrations/20250505_002_access_passes.sql
```

```sql
CREATE TABLE access_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES auth.users(id),
  resource_type TEXT NOT NULL, -- 'live', 'course', 'video'
  resource_id UUID NOT NULL,
  payment_id TEXT,
  status TEXT DEFAULT 'active',
  granted_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_access_passes_user ON access_passes(user_id);
CREATE INDEX idx_access_passes_resource ON access_passes(resource_type, resource_id);

ALTER TABLE access_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access pass visible par propriétaire" ON access_passes
  FOR SELECT USING (user_id = auth.uid());
```

---

## Mission 5 — Créer seeds de test

Fichier :

```txt
supabase/seeds/001_admin_seed.sql
```

Contenu :

```sql
-- Créer un tenant Prorascience
INSERT INTO tenants (id, name, slug, status, plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'Prorascience', 'prorascience', 'active', 'platform');

-- Le owner sera créé via l'app après inscription
```

---

## Mission 6 — Préparer worker minimal

### 6.1 Structure

```txt
apps/worker/
  package.json
  src/
    index.js
    jobs/
      ping.js
```

### 6.2 package.json minimal

```json
{
  "name": "isna-worker-v2",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "node --watch src/index.js",
    "start": "node src/index.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.30.0"
  }
}
```

### 6.3 src/index.js minimal

```js
console.log('[worker-v2] Worker démarré');

// Job ping test
setInterval(() => {
  console.log('[worker-v2] ping', new Date().toISOString());
}, 30000);
```

---

## Mission 7 — Appliquer les migrations

Une fois les fichiers SQL créés, les appliquer au nouveau Supabase :

Option A — Via Supabase CLI :

```bash
supabase link --project-ref <ref>
supabase db push
```

Option B — Via SQL Editor dans le dashboard Supabase.

---

## Livrables attendus

- [ ] Git initialisé avec branches
- [ ] Supabase V2 dev/staging créé
- [ ] `.env` locaux remplis (non commités)
- [ ] `docs/MIGRATIONS_INVENTORY.md`
- [ ] `supabase/migrations/20250505_001_tenants.sql`
- [ ] `supabase/migrations/20250505_002_access_passes.sql`
- [ ] `supabase/seeds/001_admin_seed.sql`
- [ ] `apps/worker/` initialisé
- [ ] Premier commit sur `agent/cursor-data-workers`

## Ne pas faire

- Ne pas toucher à la V1.
- Ne pas créer de logique métier complexe dans le worker.
- Ne pas configurer de paiement réel.
- Ne pas migrer toutes les tables V1 sans coordination.
