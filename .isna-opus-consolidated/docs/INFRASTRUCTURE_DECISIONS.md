# Infrastructure Decisions

## Décision 1 — Pas de Netlify backend pour V2

Netlify reste lié à la V1. La V2 utilise une API dédiée et des workers séparés.

## Décision 2 — Séparation public/app

- Site public : Next.js
- Application connectée : React + Vite

## Décision 3 — Backend métier séparé

L'API métier est séparée du frontend. NestJS est recommandé pour structurer les domaines complexes.

## Décision 4 — Vidéo et live

- Live : LiveKit Cloud
- VOD/replays : Mux ou Cloudflare Stream
- FFmpeg : worker/job dédié, jamais dans une route HTTP frontend/backend synchrone

## Décision 5 — Supabase

Supabase V2 dev/staging sera créé pour éviter de payer l'ancien projet bloqué pendant le développement.
