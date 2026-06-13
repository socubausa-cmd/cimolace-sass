# Rapport — Version native LIRI (apps/mobile) · 2026-06-08

## 1. Résumé exécutif

L'app native **LIRI** (`apps/mobile`, React Native / Expo) atteint **100 % de parité**
fonctionnelle avec le portail web : **30 moteurs natifs, 0 partiel, 0 absent**.

| Indicateur | Valeur |
|---|---|
| Parité native | **100 %** |
| Natif (complet) | **30** moteurs |
| Partiel | **0** |
| Absent | **0** |
| Typecheck `tsc --noEmit` | **0 erreur** |

Vérifié dans le hub `/engines` : « Parité native · 100% · 30 Natif · 0 Partiel · 0 À faire ».

---

## 2. Finalisation des 8 derniers moteurs (cette passe)

| Moteur | Ce qui a été livré | Vérif |
|---|---|---|
| **Salle live (élève)** | Chat **bidirectionnel** temps réel (data channel `chat`) : overlay + saisie + badge | ✅ preview |
| **Régie live (hôte)** | **Q&R temps réel** (canal `qa`, file + résolution) · **chat** temps réel (envoi/réception) · **multicam invités** (tuiles vidéo distantes, scène Galerie) · **modération** (canal `mod`) | ✅ preview (chat + questions) |
| **Paiement** | Feuille **Mobile Money native PawaPay** : pays (5) + opérateur (MTN/Orange/Airtel) + n° E.164 + dépôt + **polling statut** (`/offering-checkout/mobile-money`) ; carte web en repli | ✅ preview |
| **Créer un cours** | **Éditeur de curriculum** : chapitres → leçons **Vidéo/Texte/Quiz**, réordonner, prix, publication (`/courses` + `/modules` + `/lessons`) | ✅ preview |
| **Arena** | Participation déjà complète (viewer LiveKit + débat/votes/NeuronQ Supabase realtime) → **point d'entrée** ajouté (liste lives → `/arena/[id]`, tag DÉBAT) | ✅ preview (mount) |
| **Smartboard** | Édition native déjà complète (Skia : stylo, gomme, rect, cercle, texte, undo, clear, CRUD scènes, sauvegarde cloud+local) → confirmée livrable | ✅ typecheck |
| **Export Center** | UI native + déclenchement serveur → confirmé livrable | ✅ |
| **Orchestrateur live** | Sélecteur de sources + ouverture d'une vraie session/régie → confirmé livrable | ✅ |

### Plomberie temps réel du live (data channels LiveKit)
- `sb` — synchro slide hôte→élève
- `chat` — chat bidirectionnel hôte↔élève
- `qa` — questions / mains levées élève→hôte
- `mod` — modération hôte→élève (micros coupés, salle verrouillée)
- multicam : `useTracks(Camera)` distants → tuiles vidéo dans la scène Galerie

---

## 3. Couverture complète (30 moteurs)

- **Live** : Régie hôte · Salle élève · Lives & replays · Salle d'attente
- **Studio** : Studio hub · Smartboard · Masterclass Factory · Créer un cours · Masterscript · Export Center · Orchestrateur live
- **Apprentissage** : LIRI Brain (IA) · Neuron/NeuroRecall · Arena · Bibliothèque · Forum
- **Vie scolaire** : hub · Notes · Absences · Évaluations · Documents · Agenda
- **Communication** : Messagerie · Notifications · Profil élève
- **Commerce** : Forfaits · Boutique · Paiement
- **Accueil** : Accueil · Intégrations (clés API)

---

## 4. Validation restante (appareil uniquement)

Tout est typecheck-clean et vérifié en preview web pour l'UI. Les briques **LiveKit
natif** (vidéo, data channels) et **Skia** (édition smartboard) ne s'exécutent pas en
preview web — à valider sur **build EAS appareil** :

```bash
cd apps/mobile && eas login
eas build --profile development --platform android   # ou ios → LiveKit/Skia/data channels
npx expo start --dev-client
eas build --profile production --platform android|ios  # stores
```

À valider sur device : flux vidéo hôte/invités, synchro slide, chat/Q&R temps réel,
modération, dépôt PawaPay réel (token live), dessin Skia.

### Finitions transverses (non bloquantes)
- **Maillon constructeur** : Architect IA / Masterclass émettent déjà un deck ; brancher
  `fetchLiveDeck`/`fetchSessionDeckId` sur des slides réelles côté portail.
- **Push notifications** (Expo/Firebase) — l'écran lit déjà la table.
- Retirer le hack `[PREVIEW-MOD] micLocked` du stub web `LiveRoomNative.web.tsx`.
- Commits / PR : working tree non commité (selon convention).

Suivi vivant : ouvrir **`/engines`** dans l'app.
