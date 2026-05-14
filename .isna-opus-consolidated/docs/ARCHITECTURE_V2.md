# Architecture V2

## Décision principale

Séparer le site public, l'application connectée, l'API et les workers.

```txt
Cloudflare
  ├─ prorascience.org         → apps/public-site Next.js
  ├─ app.prorascience.org     → apps/app React + Vite
  ├─ api.prorascience.org     → apps/api NestJS/Fastify
  ├─ media.prorascience.org   → Mux ou Cloudflare Stream
  └─ live.prorascience.org    → LiveKit Cloud
```

## Pourquoi cette séparation

- Le site public a besoin de SEO.
- L'application connectée n'a pas besoin de SEO.
- Le backend métier doit être indépendant du frontend.
- Les tâches longues doivent sortir de l'API HTTP.

## Frontend public

- Next.js
- Landing pages
- Pricing
- Blog
- Pages produits
- SEO/OpenGraph

## Application connectée

- React + Vite
- Dashboard
- Admin
- Studio
- Live
- SmartBoard
- Back-office

## API

- NestJS recommandé
- Auth Supabase JWT
- Modules métiers
- Rôles
- Paiement
- LiveKit token service
- Marketing
- Forum

## Workers

- IA longue
- FFmpeg
- Emails
- Notifications
- Marketing automation
- Cron billing

## Vidéo et live

- Live : LiveKit Cloud
- VOD/replays : Mux ou Cloudflare Stream
- Exports temporaires : R2 ou Google Cloud Storage
