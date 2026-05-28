# MEDOS — Plan d'implémentation embedding (Modes A/B/C)

Dernière mise à jour : 2026-05-28
Pré-requis : avoir lu `MEDOS_INTEGRATION_MODES.md`.

## Objectif

Rendre MEDOS techniquement capable d'être intégré dans les 3 modes :

- **A** Hébergé (`*.medos.cimolace.com`)
- **B** Domaine personnalisé (`clinique-x.ga`)
- **C** Embedded dans site externe (widget JS / iframe / API+SDK)

À la fin de ce plan, ZahirWellness pourra brancher MEDOS sur son site sans
toucher au code Cimolace, en ajoutant 4 lignes de HTML.

## État de départ (vérifié dans le code)

| Composant                       | Localisation                                | Statut       |
| ------------------------------- | ------------------------------------------- | ------------ |
| API MEDOS multi-tenant          | `apps/api/src/medos/`                       | ✅ existant  |
| TenantGuard (JWT + X-Tenant-Slug) | `apps/api/src/tenant/tenant.guard.ts`     | ✅ existant  |
| MedosEnabledGuard               | `apps/api/src/medos/medos-enabled.guard.ts` | ✅ existant  |
| Table `tenant_api_keys`         | `supabase/migrations/004_tenant_api_keys.sql` | ✅ existante (jamais utilisée) |
| ApiKeyGuard                     | —                                           | ❌ à créer   |
| Table `tenant_domains`          | —                                           | ❌ à créer   |
| Endpoint `/v1/medos/embed-token` | —                                          | ❌ à créer   |
| CORS dynamique                  | —                                           | ❌ à créer   |
| Widget JS                       | —                                           | ❌ à créer   |
| Route `apps/public-site/embed/[mode]` | —                                     | ❌ à créer   |

## Architecture cible

```
Client externe (zahirwellness.com)
   │
   │  <script src="https://cdn.cimolace.com/medos/v1/embed.js"
   │          data-tenant="zahirwellness">
   │
   ▼
embed.js (bundle React)
   │
   │  1. Lit data-tenant = "zahirwellness"
   │  2. POST /v1/medos/embed-token  (CORS check sur Origin)
   │     Authorization: rien — clé publique tenant côté front interdit
   │     -> on échange via un endpoint côté serveur client OU
   │        on utilise une clé publique "embed-public" sans secret
   ▼
apps/api/src/medos/embed.controller.ts
   │
   │  - CORS dynamique : Origin doit être dans tenant_domains
   │  - Résout tenant par slug -> tenant_id
   │  - Génère JWT court (15 min) signé HS256, claims :
   │    { tenant_id, mode, scope, exp }
   │  - Retourne { token, api_base }
   ▼
embed.js
   │
   │  3. Auth ultérieures vers /v1/medos/* avec Bearer <embed-jwt>
   ▼
apps/api/src/medos/* (controllers existants)
   │
   │  - Nouveau guard EmbedTokenGuard valide le JWT embed
   │  - Résout tenant + scope (lecture seule, ou prise RDV, etc.)
   │  - Le reste du flow MEDOS normal s'applique
```

Côté serveur client (option mode C.3 API+SDK) :

```
Backend client (Node, Python, etc.)
   │
   │  Authorization: Bearer mdk_zahir_<secret>
   │  X-Tenant-Slug: zahirwellness
   ▼
ApiKeyGuard
   │
   │  - Hash SHA-256 du Bearer
   │  - Lookup tenant_api_keys par key_hash
   │  - Vérifie revoked_at IS NULL
   │  - Met à jour last_used_at
   │  - Résout req.tenant à partir de tenant_id
   ▼
Endpoints MEDOS normaux
```

## Sprint S0 — Pré-requis non bloquants (3-5 jours)

À faire AVANT de toucher à l'embedding, sinon RGPD bloqué :

### S0.1 Audit log writer
- Créer `apps/api/src/medos/med-audit.interceptor.ts`
- Logger automatiquement chaque accès patient/note dans `medical_audit_log`
  (table déjà créée)
- Appliquer en tant que `@UseInterceptors(MedAuditInterceptor)` sur tous les
  controllers MEDOS
- Champs loggés : tenant_id, actor_id, action, resource_type, resource_id, ip,
  user_agent, occurred_at

### S0.2 Seed templates formulaires
- Migration `supabase/migrations/XXX_medos_form_templates.sql`
- Templates : consent_general, intake_basic, post_consult, phq9, nutrition
- Marqués `is_template = true`, `tenant_id = NULL` (visibles tous tenants)

### S0.3 Test d'intégration smoke
- `apps/api/src/medos/medos.e2e-spec.ts`
- Scénarios : créer patient, créer note, signer, partager, audit log écrit
- Bloquant pour passer S1

## Sprint S1 — Mode C.3 API + clés tenant (3-4 jours)

### S1.1 ApiKeyGuard

Fichier : `apps/api/src/auth/api-key.guard.ts`

```ts
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly tenantService: TenantService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { tenant: TenantContext; apiKeyId?: string }>();
    const auth = req.headers['authorization'];

    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token requis');
    }
    const raw = auth.slice(7).trim();
    if (!raw.startsWith('cml_') && !raw.startsWith('mdk_')) {
      // pas une clé API tenant — laisse passer pour fallback JWT
      return false;
    }

    const hash = createHash('sha256').update(raw).digest('hex');

    const { data: key, error } = await this.supabase.client
      .from('tenant_api_keys')
      .select('id, tenant_id, revoked_at')
      .eq('key_hash', hash)
      .single();

    if (error || !key || key.revoked_at) {
      throw new UnauthorizedException('Clé API invalide ou révoquée');
    }

    req.apiKeyId = key.id;
    req.tenant = await this.tenantService.resolveById(key.tenant_id);

    // touch last_used_at (fire and forget)
    this.supabase.client
      .from('tenant_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', key.id)
      .then(() => null);

    return true;
  }
}
```

À monter en parallèle de `JwtAuthGuard` via un `CompositeAuthGuard` qui essaye
l'un puis l'autre.

### S1.2 Endpoint génération de clé API

Fichier : `apps/api/src/cimolace-backoffice/api-keys.controller.ts`

Routes :
- `POST /admin/tenants/:tenantId/api-keys` -> crée clé, retourne UNE fois la
  valeur brute (`mdk_<slug>_<random32>`), stocke seulement le hash
- `GET /admin/tenants/:tenantId/api-keys` -> liste (sans valeurs), avec
  `key_prefix`, `label`, `last_used_at`, `revoked_at`
- `DELETE /admin/tenants/:tenantId/api-keys/:keyId` -> revoke (set
  `revoked_at = now()`)

UI dans `apps/app/src/pages/AdminApiKeys.tsx` :
- Bouton "Générer clé MEDOS pour ce tenant"
- Modal qui affiche la valeur brute UNE SEULE FOIS avec "Copier"
- Liste des clés actives + bouton "Révoquer"

### S1.3 Endpoints MEDOS exposés via clé API

Configurer le routing pour que `/v1/medos/*` accepte les deux auth :

- JWT Supabase + `X-Tenant-Slug` (clients dashboards Cimolace)
- Clé API tenant (sites externes serveur)

Réutiliser les controllers existants — juste changer le guard à
`CompositeAuthGuard`.

### S1.4 Rate limiting

`apps/api/src/common/rate-limit.middleware.ts` :
- Bucket par `tenant_id` (Redis si dispo, sinon mémoire pour MVP)
- 1000 req / min par défaut, surchargeable par tenant
- Headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### S1.5 Tests S1
- Créer clé via admin
- Appeler `/v1/medos/patients` avec clé -> 200
- Appeler avec clé révoquée -> 401
- Appeler avec clé d'un autre tenant -> 403 (isolation)
- Vérifier `last_used_at` mis à jour

## Sprint S2 — Mode C.1 widget JS (4-5 jours)

### S2.1 CORS dynamique

`apps/api/src/main.ts` : configurer Nest CORS avec callback :

```ts
app.enableCors({
  origin: async (origin, callback) => {
    if (!origin) return callback(null, true); // server-to-server
    // Whitelist statique (Cimolace + cdn)
    if (CIMOLACE_DOMAINS.includes(origin)) return callback(null, true);
    // Lookup tenant_domains
    const allowed = await tenantDomainsService.isAllowedOrigin(origin);
    return callback(null, allowed);
  },
  credentials: false,
});
```

Cache 5 minutes en mémoire pour éviter de taper la DB à chaque preflight.

### S2.2 Endpoint embed-token

Fichier : `apps/api/src/medos/embed.controller.ts`

```ts
@Controller('v1/medos/embed')
export class MedosEmbedController {
  @Post('token')
  async issueEmbedToken(
    @Body() body: { tenant_slug: string; mode: EmbedMode },
    @Req() req: Request,
  ) {
    // Origin check : doit être dans tenant_domains du slug demandé
    const origin = req.headers.origin;
    const tenant = await this.tenantService.resolveBySlug(body.tenant_slug);
    const allowed = await this.tenantDomainsService.isOriginAllowedForTenant(
      origin, tenant.id,
    );
    if (!allowed) throw new ForbiddenException('Origin non autorisé');

    const scope = SCOPE_BY_MODE[body.mode]; // ex: ['med:notes:read', 'med:health:write']

    const token = await this.jwtService.signAsync(
      { tenant_id: tenant.id, mode: body.mode, scope },
      { expiresIn: '15m', secret: this.config.get('MEDOS_EMBED_JWT_SECRET') },
    );

    return { token, api_base: this.config.get('MEDOS_API_BASE'), expires_in: 900 };
  }
}
```

Nouveau guard `EmbedTokenGuard` qui décode le JWT, peuple `req.tenant`, vérifie
que la route demandée est dans le `scope`.

### S2.3 Widget React + bundle

Nouveau package : `apps/medos-embed/`

Structure :

```
apps/medos-embed/
├── package.json
├── tsconfig.json
├── vite.config.ts      (build en UMD, single file, externals zéro)
├── src/
│   ├── embed.tsx       (entry point, lit data-* attrs, mount)
│   ├── modes/
│   │   ├── PatientPortal.tsx
│   │   ├── AppointmentBooker.tsx
│   │   ├── ConsentForm.tsx
│   │   └── HealthTracker.tsx
│   ├── lib/
│   │   ├── api.ts      (fetch wrapper avec JWT embed)
│   │   ├── auth.ts     (POST /embed/token, store JWT en mémoire)
│   │   └── theme.ts    (lit data-theme, data-primary-color)
│   └── styles.css      (Tailwind scoped via prefix `mdembed-`)
└── public/
    └── embed.js        (copié sur CDN après build)
```

Le bundle doit :
- Inclure React, ReactDOM bundled (pas d'externals)
- Faire < 200 KB gzip pour `patient-portal`
- Mounter dans `#medos-portal` ou `[data-medos-mode]`
- Lire `data-tenant`, `data-mode`, `data-theme`, `data-locale`, `data-primary-color`
- Tomber gracieusement si tenant inconnu (afficher message d'erreur, pas crash)

### S2.4 Publication CDN

Pipeline `apps/medos-embed/scripts/publish.sh` :
- Build le bundle
- Upload sur Cloudflare R2 (ou S3) sous `cdn.cimolace.com/medos/v1/embed.js`
- Header `Cache-Control: public, max-age=3600`
- Header `Cross-Origin-Resource-Policy: cross-origin`

Versioning : `v1` figé, breaking changes -> `v2`.

### S2.5 Tests S2
- HTML statique de test dans `apps/medos-embed/test/index.html`
- Domaine de test ajouté à `tenant_domains` du tenant "test"
- Mount widget, vérifier rendu, vérifier appels API
- Tester avec domaine non whitelisté -> doit refuser

## Sprint S3 — Mode C.2 iframe (2-3 jours)

### S3.1 Routes iframe

`apps/public-site/app/embed/[mode]/page.tsx` :
- Lit `?tenant=` et `?token=`
- Si pas de token : refuse
- Vérifie le token via `/v1/medos/embed/verify`
- Rend le composant approprié en pleine page

### S3.2 postMessage protocol

Du parent vers iframe :
- `{ type: 'medos:resize', height }` -> ajuste hauteur
- `{ type: 'medos:theme', theme }` -> change thème

De l'iframe vers parent :
- `{ type: 'medos:ready' }`
- `{ type: 'medos:appointment-created', id }`
- `{ type: 'medos:form-submitted', formId }`
- `{ type: 'medos:height-changed', height }`

Helper JS à fournir au client : `cdn.cimolace.com/medos/v1/iframe-helper.js`.

### S3.3 CSP & frame-ancestors

Middleware Next.js qui retourne :
`Content-Security-Policy: frame-ancestors <domains tenant>`

basé sur `tenant_domains`.

## Sprint S4 — Mode A hébergé (3-4 jours)

### S4.1 Wildcard DNS
- Vercel : ajouter `*.medos.cimolace.com` dans le projet `public-site`
- Cloudflare DNS : `*.medos -> CNAME -> cname.vercel-dns.com`

### S4.2 Résolution tenant par sous-domaine

Middleware Next.js dans `apps/public-site/middleware.ts` :

```ts
export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const match = host.match(/^([a-z0-9-]+)\.medos\.cimolace\.com$/);
  if (match) {
    const slug = match[1];
    req.headers.set('x-tenant-slug', slug);
  }
  return NextResponse.next();
}
```

### S4.3 Templates landing par tenant

`apps/public-site/app/[tenant]/page.tsx` :
- Lit tenant via slug
- Récupère branding (logo, couleurs, contenu) depuis `tenant_branding`
- Rend la landing dynamique

### S4.4 UI configuration tenant
- `apps/app/src/pages/TenantBranding.tsx` (déjà partiellement existant)
- Champs : nom affiché, baseline, couleur primaire, logo, sections landing

## Sprint S5 — Mode B domaine personnalisé (4-5 jours)

### S5.1 Migration tenant_domains

```sql
CREATE TABLE tenant_domains (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  custom_domain TEXT NOT NULL UNIQUE,
  ssl_status    TEXT NOT NULL DEFAULT 'pending',  -- pending|active|failed
  verify_token  TEXT NOT NULL,
  verified_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  created_by    UUID
);

CREATE INDEX idx_tenant_domains_tenant ON tenant_domains(tenant_id);
CREATE INDEX idx_tenant_domains_domain ON tenant_domains(custom_domain);
ALTER TABLE tenant_domains ENABLE ROW LEVEL SECURITY;
```

### S5.2 Service Cloudflare for SaaS (recommandation)

- Account-level API : créer un custom_hostname par domaine
- Provisioning SSL automatique (TLS 1.3, certificat managé)
- Webhook quand SSL devient actif -> update `ssl_status`

### S5.3 Vérification DNS
- Endpoint `POST /v1/tenants/me/domains` -> crée la ligne avec `verify_token`
- Endpoint `POST /v1/tenants/me/domains/:id/verify` -> check TXT DNS record
  `_cimolace.<domain>` contient le token
- UI dans `apps/app` -> page "Mon domaine"

### S5.4 Résolution par Host header

Étendre le middleware S4.2 pour gérer aussi les domaines personnalisés :
- Si host match `*.medos.cimolace.com` -> slug extrait
- Sinon, lookup `tenant_domains` par `custom_domain = host`
- Si match : injecter `x-tenant-slug`

## Sprint S6 — Pilote ZahirWellness (1-2 semaines)

### S6.1 Préparation
- Audit lecture seule du site Zahir (cf règles ZAHIR_TO_MBOLO)
- Clone de travail séparé
- Clarification business : Zahir veut-il MEDOS ? Quel mode ?

### S6.2 Tenant staging
- Créer tenant `zahirwellness-staging` dans Cimolace
- Activer MEDOS
- Importer 3 patients test (jamais de données réelles)
- Générer clé API tenant

### S6.3 Shadow mode (1 semaine, zéro trafic)
- Ajouter `zahirwellness.com` à `tenant_domains` du staging
- Embed widget sur une page cachée `/medos-test`
- Test exhaustif : auth, isolation, audit log, RGPD, performance

### S6.4 Bascule progressive (production)
- Créer tenant `zahirwellness` prod
- Feature flag par patient (10% -> 50% -> 100%)
- Monitoring : latence p95, erreurs, taux d'opt-out
- Rollback documenté : retirer le `<script>` suffit

### S6.5 Documentation client
- Fiche "Comment Zahir intègre MEDOS" (interne)
- Fiche "Vous gardez votre site, on installe MEDOS" (commerciale)

## Dépendances et ordre d'exécution

```
S0 (audit log, seeds, tests) ─┐
                              ├─> S1 (API + clés)
                              │     │
                              │     ├─> S2 (widget JS)
                              │     │     │
                              │     │     └─> S6 (Zahir)
                              │     │           │
                              │     └─> S3 (iframe)
                              │           │
                              └─> S4 (hébergé) ──> S5 (domaine perso)
```

S1 est le bottleneck — sans clés API tenant fonctionnelles, rien d'embeddable.

## Estimation totale

- S0 : 3-5 jours
- S1 : 3-4 jours
- S2 : 4-5 jours
- S3 : 2-3 jours
- S4 : 3-4 jours
- S5 : 4-5 jours
- S6 : 5-10 jours (selon disponibilité Zahir)

**Total : 24-36 jours-personne**

Pour un seul dev plein temps : 5-7 semaines pour avoir Zahir embarqué.
Pour 2 devs : 3-4 semaines.

## Risques

1. **Cloudflare for SaaS coût** — N domaines × pricing. Alternative : Caddy
   ACME self-hosted.
2. **Bundle widget trop gros** — surveiller poids gzip < 250 KB. Si dépassement,
   lazy load par mode.
3. **Conflit CSS sur site client** — préfixer toutes les classes (`mdembed-`),
   ou utiliser Shadow DOM.
4. **Race condition embed-token** — gérer expiration JWT, refresh transparent.
5. **Audit log non implémenté (S0)** — si S0 sauté, RGPD bloqué, Zahir bloqué.

## Définition de "fini"

L'embedding MEDOS est considéré fini quand :

- Une commande `<script src=...>` sur n'importe quel site whitelisté affiche
  un portail patient fonctionnel
- Le serveur du client peut appeler `/v1/medos/*` avec une clé API et
  recevoir/modifier des données patient
- Un client sans site obtient en 1h un sous-domaine `*.medos.cimolace.com`
  brandé
- Un client avec son propre domaine peut le brancher en < 1 jour avec SSL auto
- Chaque accès patient/note est tracé dans `medical_audit_log`
- Les 6 sprints ont leurs tests verts en CI

## Prochaine action

Validation business :
- Confirmer qu'on attaque S0 + S1 d'abord (audit log + API keys)
- Confirmer le positionnement Zahir (MEDOS ou Mbolo ou les deux ?)
- Choisir l'hébergement CDN pour le widget (R2 / S3 / Vercel)
- Choisir le provisioning SSL (Cloudflare for SaaS / Caddy)

Une fois validé : implémentation S0 puis S1 dans `apps/api/src/medos/`.
