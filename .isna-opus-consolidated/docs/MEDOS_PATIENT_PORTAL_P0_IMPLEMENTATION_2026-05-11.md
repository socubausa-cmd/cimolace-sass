# MedOS Patient Portal P0 — Implementation

Date : 2026-05-11

## Livré

Le portail patient intégré dans `apps/app` n'est plus seulement une page de notes. Il possède maintenant :

- une route d'accueil `/dashboard/medos/me` ;
- une navigation patient : Aujourd'hui, Notes, Dossier, Formulaires, Journal, Recommandations, Examens, Ordonnances, Messages ;
- un tableau de bord "Aujourd'hui" avec actions rapides, notifications, compteurs et dernières notes ;
- des cartes préparées pour les fonctionnalités attendues côté patient ;
- une réaction locale sur les notes : `J'ai lu` ;
- un panneau de question au praticien préparé pour la future messagerie sécurisée.

## Fichiers modifiés

- `apps/app/src/pages/MedosPatientPortal.tsx`
- `apps/app/src/App.tsx`
- `apps/app/src/pages/MedosDashboard.tsx`

## Capture

- `docs/screenshots/medos-patient-portal-today-p0-2026-05-11.png`

## Validation

- `npm run lint -w @isna/app` : OK
- `npm run build -w @isna/app` : OK

## Limite assumée

Les modules Formulaires, Journal, Recommandations, Examens, Ordonnances et Messages sont visibles côté UI mais pas encore branchés à un backend sécurisé. Les controllers Forms/Health existants restent à ne pas réactiver tant que l'ownership patient, l'audit médical et les tests cross-patient ne sont pas validés.
