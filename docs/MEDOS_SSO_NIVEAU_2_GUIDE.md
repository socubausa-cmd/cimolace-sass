# MEDOS Niveau 2 — Intégration SSO côté tenant

Guide d'intégration pour un client tenant (ex: **zahirwellness.com**) qui veut
afficher le portail MEDOS à ses utilisateurs déjà connectés sur SON site,
**sans étape de login supplémentaire** dans le widget.

Niveau 1 (anonyme, voir [MEDOS_INTEGRATION_MODES.md](MEDOS_INTEGRATION_MODES.md))
= le widget demande au visiteur de se connecter via magic link Supabase.
Niveau 2 (identifié, ce doc) = le widget affiche directement le bon dossier
parce que le backend tenant a déjà identifié le user.

## Vue d'ensemble

```
┌───────────────────────────────────────────────────────────────┐
│  Navigateur du client                                         │
│                                                               │
│  Étape 1 : client est connecté sur zahirwellness.com          │
│            (cookie de session Zahir)                          │
│                                                               │
│  Étape 4 : la page /mon-espace charge avec un token MEDOS     │
│            le widget affiche directement le dossier patient   │
└───────────────────────────────────────────────────────────────┘
                  ↑                              ↑
                  │ Étape 3 : retourne HTML       │ Étape 5 : appels API
                  │ avec le token MEDOS injecté   │   /v1/medos/embed/me/*
                  │                               │ (avec ce token)
                  ▼                               ▼
┌───────────────────────────────────────────────────────────────┐
│  Backend Zahir (Next.js / Express / Laravel / WordPress)      │
│                                                               │
│  Étape 2 : vérifie session Zahir → appelle Cimolace :         │
│    POST https://api.cimolace.space/v1/medos/embed/server-token│
│    Authorization: Bearer mdk_zahirwellness_<SECRET>           │
│    Body: { patient_email, mode, ... }                         │
└───────────────────────────────────────────────────────────────┘
                                  ↓
                                  ↓
┌───────────────────────────────────────────────────────────────┐
│  api.cimolace.space (Cimolace)                                │
│                                                               │
│  - Valide la clé API (hash SHA-256)                           │
│  - Crée user Supabase + patient record si nouveaux            │
│  - Signe un JWT (15 min) avec sub = patient_user_id           │
│  - Retourne { token, patient_user_id, expires_in, ... }       │
└───────────────────────────────────────────────────────────────┘
```

## Pré-requis (côté Cimolace, fait une fois)

1. Le staff Cimolace crée le tenant (ex: `zahirwellness`).
2. Cimolace active les moteurs MEDOS souhaités sur ce tenant.
3. Cimolace whitelist le domaine `zahirwellness.com` dans `tenant_domains`.
4. Cimolace génère une **clé API tenant** et la donne au tenant (UNE seule fois).
   Format : `mdk_zahirwellness_a1b2c3d4...` (48 chars random).

⚠️ La clé est **secrète, server-side only**. Jamais dans le frontend.

## Implémentation côté tenant

### Exemple 1 — Next.js (App Router)

**`pages/api/medos-token.ts`** (API route — côté serveur Zahir) :

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react'; // ou ta solution auth

const CIMOLACE_API = 'https://api.cimolace.space';
const TENANT_API_KEY = process.env.CIMOLACE_TENANT_API_KEY!; // mdk_zahirwellness_...

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Vérifier que le user Zahir est connecté
  const session = await getSession({ req });
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // 2. Appeler Cimolace pour obtenir un embed-token identifié
  const cimolaceRes = await fetch(`${CIMOLACE_API}/v1/medos/embed/server-token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TENANT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      patient_email: session.user.email,
      patient_first_name: session.user.name?.split(' ')[0],
      patient_last_name: session.user.name?.split(' ').slice(1).join(' '),
      external_user_id: session.user.id, // ID Zahir pour mapping
      mode: 'patient-portal',
    }),
  });

  if (!cimolaceRes.ok) {
    return res.status(502).json({ error: 'Cimolace unavailable' });
  }

  const { data } = await cimolaceRes.json();
  // 3. Retourner UNIQUEMENT le token au front (15 min de vie)
  res.json({
    token: data.token,
    expires_in: data.expires_in,
  });
}
```

**`pages/mon-espace.tsx`** (page Next.js) :

```tsx
import { useEffect, useRef } from 'react';

export default function MonEspacePage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1. Récupérer le token via notre API route (server-side)
      const res = await fetch('/api/medos-token');
      if (!res.ok) {
        console.error('Token error');
        return;
      }
      const { token } = await res.json();
      if (cancelled) return;

      // 2. Injecter le widget avec data-embed-token
      const script = document.createElement('script');
      script.src = 'https://cimolace.space/medos/v1/embed.js';
      script.setAttribute('data-tenant', 'zahirwellness');
      script.setAttribute('data-mode', 'patient-portal');
      script.setAttribute('data-embed-token', token);
      script.setAttribute('data-primary-color', '#10b981');
      script.async = true;
      document.body.appendChild(script);
    })();

    return () => { cancelled = true; };
  }, []);

  return (
    <main>
      <header>{/* header Zahir */}</header>
      <h1>Mon espace santé</h1>
      <p>Retrouvez ici toutes vos consultations.</p>

      {/* Le widget MEDOS s'injecte ici */}
      <div id="medos-portal" ref={containerRef} style={{ minHeight: 400 }} />

      <footer>{/* footer Zahir */}</footer>
    </main>
  );
}
```

### Exemple 2 — Express / Node (vanilla)

**`server.js`** :

```js
const express = require('express');
const session = require('express-session');
const app = express();

const CIMOLACE_API = 'https://api.cimolace.space';
const TENANT_API_KEY = process.env.CIMOLACE_TENANT_API_KEY;

app.use(session({ secret: 'zahir-secret', resave: false, saveUninitialized: false }));

app.get('/api/medos-token', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });

  const cimolaceRes = await fetch(`${CIMOLACE_API}/v1/medos/embed/server-token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TENANT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      patient_email: req.session.user.email,
      patient_first_name: req.session.user.firstName,
      patient_last_name: req.session.user.lastName,
      mode: 'patient-portal',
    }),
  });

  const { data } = await cimolaceRes.json();
  res.json({ token: data.token, expires_in: data.expires_in });
});

app.get('/mon-espace', (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Mon espace santé — Zahir</title></head>
    <body>
      <header>...header Zahir...</header>
      <main>
        <h1>Mon espace santé</h1>
        <div id="medos-portal"></div>
      </main>

      <script>
        fetch('/api/medos-token')
          .then(r => r.json())
          .then(({ token }) => {
            const s = document.createElement('script');
            s.src = 'https://cimolace.space/medos/v1/embed.js';
            s.setAttribute('data-tenant', 'zahirwellness');
            s.setAttribute('data-mode', 'patient-portal');
            s.setAttribute('data-embed-token', token);
            s.async = true;
            document.body.appendChild(s);
          });
      </script>
    </body>
    </html>
  `);
});

app.listen(3000);
```

### Exemple 3 — Laravel / PHP

**`routes/api.php`** :

```php
Route::middleware('auth')->get('/api/medos-token', function (Request $request) {
    $user = $request->user();
    $response = Http::withToken(env('CIMOLACE_TENANT_API_KEY'))
        ->post('https://api.cimolace.space/v1/medos/embed/server-token', [
            'patient_email' => $user->email,
            'patient_first_name' => $user->first_name,
            'patient_last_name' => $user->last_name,
            'mode' => 'patient-portal',
        ]);
    return response()->json([
        'token' => $response['data']['token'],
        'expires_in' => $response['data']['expires_in'],
    ]);
});
```

**`resources/views/mon-espace.blade.php`** :

```blade
<!DOCTYPE html>
<html>
<head>...</head>
<body>
  <h1>Mon espace santé</h1>
  <div id="medos-portal"></div>

  <script>
    fetch('/api/medos-token')
      .then(r => r.json())
      .then(({ token }) => {
        const s = document.createElement('script');
        s.src = 'https://cimolace.space/medos/v1/embed.js';
        s.setAttribute('data-tenant', 'zahirwellness');
        s.setAttribute('data-mode', 'patient-portal');
        s.setAttribute('data-embed-token', token);
        s.async = true;
        document.body.appendChild(s);
      });
  </script>
</body>
</html>
```

### Exemple 4 — WordPress (PHP)

**`functions.php`** (theme) :

```php
add_action('rest_api_init', function () {
  register_rest_route('zahir/v1', '/medos-token', [
    'methods' => 'GET',
    'permission_callback' => fn() => is_user_logged_in(),
    'callback' => function () {
      $user = wp_get_current_user();
      $resp = wp_remote_post('https://api.cimolace.space/v1/medos/embed/server-token', [
        'headers' => [
          'Authorization' => 'Bearer ' . getenv('CIMOLACE_TENANT_API_KEY'),
          'Content-Type' => 'application/json',
        ],
        'body' => json_encode([
          'patient_email' => $user->user_email,
          'patient_first_name' => $user->first_name,
          'patient_last_name' => $user->last_name,
          'mode' => 'patient-portal',
        ]),
      ]);
      $data = json_decode(wp_remote_retrieve_body($resp), true);
      return ['token' => $data['data']['token']];
    },
  ]);
});
```

**Page WordPress** (template ou shortcode) :

```php
<div id="medos-portal"></div>
<script>
  fetch('/wp-json/zahir/v1/medos-token')
    .then(r => r.json())
    .then(({ token }) => {
      const s = document.createElement('script');
      s.src = 'https://cimolace.space/medos/v1/embed.js';
      s.setAttribute('data-tenant', 'zahirwellness');
      s.setAttribute('data-mode', 'patient-portal');
      s.setAttribute('data-embed-token', token);
      s.async = true;
      document.body.appendChild(s);
    });
</script>
```

## Sécurité — points critiques

| Risque | Mitigation |
|---|---|
| Clé API leak côté front | NE JAMAIS exposer la clé au navigateur. Toujours via une API route backend tenant. |
| Replay du token par un attaquant | Token JWT 15 min seulement. Pas de refresh — il faut re-demander. |
| Token volé via XSS | Le token donne accès aux données du patient identifié — pas plus. Pas de scope admin. |
| Tenant compromis | Révoquer la clé via Cimolace admin → effet immédiat. |
| Pic de traffic = creation users | Le `findOrCreateUser` est idempotent. Pic n'a pas d'impact. |

## Endpoints disponibles après auth via embed-token

Une fois le widget chargé avec un token Niveau 2, il peut appeler :

| Endpoint | Méthode | Scope requis | Action |
|---|---|---|---|
| `/v1/medos/embed/me/whoami` | GET | — | Info patient |
| `/v1/medos/embed/me/notes` | GET | `med:notes:read` | Liste des notes partagées |
| `/v1/medos/embed/me/notes/:id/read` | POST | `med:notes:read` | Marque note comme lue |
| `/v1/medos/embed/forms` | GET | `med:forms:read` | Liste formulaires disponibles |
| `/v1/medos/embed/me/health` | POST | `med:health:write` | Ajoute une entrée de journal santé |

## Test rapide avec curl

```bash
TENANT_API_KEY="mdk_zahirwellness_xxx"

# 1. Obtenir un token pour un patient test
TOKEN=$(curl -sS -X POST https://api.cimolace.space/v1/medos/embed/server-token \
  -H "Authorization: Bearer $TENANT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"patient_email":"test@example.com","patient_first_name":"Test","patient_last_name":"User","mode":"patient-portal"}' \
  | jq -r '.data.token')

echo "Token: $TOKEN"

# 2. Tester l'endpoint patient
curl -sS https://api.cimolace.space/v1/medos/embed/me/whoami \
  -H "Authorization: Bearer $TOKEN" | jq

# 3. Lister les notes du patient
curl -sS https://api.cimolace.space/v1/medos/embed/me/notes \
  -H "Authorization: Bearer $TOKEN" | jq
```

## Pour aller plus loin

- Pour les opérations server-to-server complètes (créer patient, créer note, etc.), utiliser directement `/med/*` avec la clé API tenant en `Authorization` (pas besoin de server-token).
- Pour les webhooks (note signée, RDV créé, ordonnance émise), voir `MEDOS_WEBHOOKS.md` (à venir).
- Le widget peut être réinitialisé côté front en remplaçant le div `#medos-portal` (cf. cas Shadow DOM dans `demo.html`).
