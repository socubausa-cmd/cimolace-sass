# Edge Functions — ISNA Platform

## Fonctions disponibles

### `oauth-initiate` — Démarrage du flux OAuth custom
**POST** `/functions/v1/oauth-initiate`

Body : `{ tenant_slug: string, return_to?: string }`
Retour : `{ redirect_url: string }` → URL Google à ouvrir

### `oauth-callback` — Callback Google OAuth
**GET** `/functions/v1/oauth-callback?code=...&state=...`

Valide le state CSRF, échange le code contre des tokens Google,
crée/trouve l'utilisateur Supabase, crée une session, redirige vers
`/t/:slug/auth/callback#access_token=...&refresh_token=...`

---

## Déploiement

### Prérequis
- Supabase CLI : `brew install supabase/tap/supabase`
- Connecté : `supabase login`
- Lié au projet : `supabase link --project-ref fwfupxvmwtxbtbjdeqvu`

### Déployer les deux fonctions

```bash
# Depuis la racine du projet
supabase functions deploy oauth-initiate
supabase functions deploy oauth-callback
```

### Secrets requis

Les Edge Functions ont automatiquement accès à `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`.

Seul secret additionnel à définir :

```bash
# URL de base du frontend (pour les redirections depuis oauth-callback)
# Prod :
supabase secrets set APP_BASE_URL=https://cimolace.space

# Dev local :
supabase secrets set APP_BASE_URL=http://localhost:5173
```

### Vérifier le déploiement

```bash
supabase functions list
```

---

## Configuration tenant (Google Cloud Console)

Pour chaque tenant qui veut son branding Google :

1. Aller sur https://console.cloud.google.com
2. Créer un projet → APIs & Services → Credentials
3. Create OAuth 2.0 Client ID → Web application
4. **Authorized redirect URIs** (exact) :
   ```
   https://fwfupxvmwtxbtbjdeqvu.supabase.co/functions/v1/oauth-callback
   ```
5. Copier Client ID + Client Secret
6. Les saisir dans le dashboard admin du tenant : `/t/:slug/admin/settings`

---

## Flux complet

```
[1] Élève → /t/isna/login → clique "Google"
[2] SchoolLoginPage → POST oauth-initiate → { redirect_url }
[3] window.location.assign(redirect_url) → Google consent screen
    ↑ Le nom de l'école apparaît sur l'écran Google
[4] Google → GET oauth-callback?code=xxx&state=yyy
[5] oauth-callback : valide state, échange code, crée session
[6] Redirect → /t/isna/auth/callback#access_token=...
[7] SchoolGoogleCallback : setSession() → fetchTenantRole()
[8] Redirect → /student-school-life/dashboard (élève)
              ou /t/isna/admin (staff)
```

---

## Fallback

Si un tenant n'a pas configuré ses credentials Google OAuth (`oauth_not_configured`),
`SchoolLoginPage` bascule automatiquement sur le flux Supabase OAuth standard
(qui affiche l'URL Supabase mais fonctionne sans configuration côté tenant).
