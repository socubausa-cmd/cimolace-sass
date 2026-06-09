# Orchestrateur de parité native — LIRI (apps/mobile)

But : amener l'app **native `apps/mobile`** à parité **complète et fonctionnelle** avec le
portail web LIRI (`apps/app`, isna_platform_v2), moteur par moteur, jusqu'à une version
grand public.

- **Source de vérité (code)** : [`src/lib/engines.ts`](src/lib/engines.ts) — registre de tous les moteurs + statut.
- **Hub visible (app)** : écran `/engines` ([`src/app/engines.tsx`](src/app/engines.tsx)) — parité + navigation.
- **Référence design** : `apps/app` (web) = LECTURE SEULE. Modèle live officiel : `../../docs/LIVE_HOST_MODELE_OFFICIEL.md`.

## État (2026-06-06, après portage)

**Parité native ≈ 83% · 20 Natif · 10 Partiel · 0 Absent** (vs 5 natif / 21 absent à l'audit initial).
→ **Tous les moteurs LIRI ont désormais un écran natif** (plus aucun absent). Les « Partiel »
restants sont des internes avancés (liste plus bas), pas des écrans manquants.

Vérification continue : `npx tsc --noEmit` = 0 erreur ; chaque écran rendu en preview web (port 8090).

### Partiels restants (internes avancés à approfondir)
Régie live (tiroirs/scènes réels, Q&R, multicam) · Salle live élève (overlays chat/annotations) ·
Smartboard (édition outils/calques — rendu OK) · Masterclass (UI 8 étapes) ·
Course/Formation builder (éditeur avancé — form natif OK) · Bibliothèque (catalogue cours) ·
Arena (participation live) · Paiement (natif PawaPay/Stripe — checkout web via Linking OK) ·
Export Center (pipeline serveur) · Orchestrateur live (synchro multi-source temps réel).

### Public-readiness
- Auth : le bypass d'aperçu `[PREVIEW-APP]` est **gardé par `__DEV__`** → en build de production,
  `LoginScreen` est obligatoire. ✅
- Modules natifs (LiveKit régie/salle, Skia smartboard) → **non testables en web** ; valider sur
  **build EAS dev** (Expo Go ne suffit pas) :
  ```bash
  cd apps/mobile
  eas login
  eas build --profile development --platform android   # ou ios
  npx expo start --dev-client
  ```
  Build store : `eas build --profile production --platform android|ios`.

| Statut | Moteurs |
|---|---|
| ✅ Natif | Brain, NeuroRecall, Forum, Replays/Lives, Accueil, Masterscript, Intégrations |
| 🟡 Partiel | Régie live (hôte), Salle live (élève), Smartboard, Studio hub, Masterclass, Bibliothèque, Arena, Profil |
| ❌ À faire | Notifications, Messagerie, Profil élève, Vie scolaire (notes/absences/évals/docs), Agenda, Forfaits, Boutique, Paiement, Course/Formation builder, Export center, Orchestrateur live, Salle d'attente, Dashboard produit, Classroom |

## Architecture de portage
- **Backend partagé** : la plupart des moteurs lisent le même backend (`api.cimolace.space` REST `/...` + Supabase RLS + LiveKit). → Le portage natif = surtout des **écrans RN** branchés aux mêmes endpoints (cf. `src/lib/liri-api.ts`).
- **Code par plateforme** : modules natifs (LiveKit, Skia) isolés via `*.tsx` / `*.web.tsx` pour ne pas casser le bundle web.
- **Thème** : `src/constants/liri-theme.ts` (coral) pour la coque app ; palette violet/noir pour la régie live (modèle officiel).

## Roadmap (priorité métier)

### Phase A — Live (en cours)
- [x] Phase 1-3 : coque régie `host-shell.tsx` (modèle officiel) + tiroirs + scène smartboard.
- [x] Phase 4 : `live-host-screen.tsx` branche LiveKit réel (caméra/micro hôte, participants, Arrêter→endLive).
- [ ] Overlays salle live élève (chat, annotations) ; salle d'attente.

### Phase B — Engagement (rétention)
- [ ] Notifications (Supabase `notifications`)
- [ ] Messagerie (Supabase realtime)
- [ ] Profil élève (stats/badges/niveau)

### Phase C — Vie scolaire (marché écoles)
- [ ] Hub Vie scolaire + Notes + Absences + Évaluations + Documents + Agenda (Supabase RLS)

### Phase D — Commerce (revenu)
- [ ] Forfaits + Boutique + Paiement (PawaPay/Stripe)

### Phase E — Création (créateurs)
- [ ] Course/Formation builder, Masterclass 8 étapes, Smartboard éditeur, Export center, Orchestrateur live

## Test fidèle
Chaque moteur porté doit : (1) typecheck `npx tsc --noEmit` = 0 erreur ; (2) rendre en preview web (port 8090) pour le visuel ; (3) pour les moteurs natifs (LiveKit/Skia) → vérif sur **build EAS** (Expo Go ne suffit pas).

## Suivi
Le suivi vivant se fait via la liste de tâches de la session + le statut dans `src/lib/engines.ts`
(mettre à jour `status` quand un moteur atteint la parité).
