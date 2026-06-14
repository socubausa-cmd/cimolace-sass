# PR — Décharge de la confusion Cimolace / ISNA / Liri (Phases 1→6)

**Branche :** `phase2/split-liri-school` → `main`
**Commits :** 20 · **Arbre propre** · règle de lint anti-régression incluse

---

## Pourquoi

Le code mélangeait **Cimolace** (la plateforme), **ISNA** (un tenant/moteur école) et **Liri** (le moteur live autonome). Cette PR sépare les trois, rend Liri réellement autonome, dé-câble l'identité ISNA codée en dur, et pose un back-office multi-infrastructure.

## Ce qui change

- **Coque app unifiée** : suppression des doublons `App.tsx` / `main.jsx` ; une seule racine `App.jsx` ; racine `cimolace.space` → espace plateforme. Projet renommé `cimolace`.
- **Séparation Liri ↔ École ↔ Studio Créateur** (moteurs *et* UI) :
  - `modules/liri` (live autonome) · `modules/school` (scolaire)
  - `components|pages/{liri, studio-creator, school}`
  - **Liri 100 % autonome** : aucun import vers `school` ou `studio-creator`.
  - **Garde-fou ESLint** (`no-restricted-imports`) qui bloque toute régression Liri→École/Studio.
- **Branding ISNA dé-câblé** : or `#D4AF37` officialisé comme `--school-accent` par défaut ; ~5000 couleurs migrées vers `var(--school-accent)` (Tailwind + `color-mix` pour l'opacité), **portail Liri préservé** ; imports `@/tenants/isna` centralisés dans un **seam** unique (`lib/tenant/activeTenantConfig`).
- **Back-office « Mes infrastructures »** (modèle Stripe/Zoom) : page liste multi-infra + statuts, panneau détail (clés API, snippet d'installation, abonnement + paiement carte), lien de nav.
- **Catalogue front** aligné sur le manifeste backend (école 6→11 moteurs).
- **fix(build)** : 3 chemins d'import CSS cassés par la réorg (fichiers déplacés, CSS resté en place).
- **Docs** : `REGLES_ARCHITECTURE_CIMOLACE.md` (5 règles d'or + vocabulaire), `AUDIT_CONFUSION_…md`, pointeur en tête de `CLAUDE.md`.

## Vérifications faites

- ✅ **911 imports `@/` résolvent** (composants/pages/modules/lib/styles), **0 introuvable**.
- ✅ **0 import relatif cassé** dans les dossiers réorganisés (scan exhaustif `./` et `../`, CSS inclus).
- ✅ Règle de lint testée : passe sur le code actuel, échoue sur un import interdit.
- ✅ Invariant : `liri → school` = 0, `liri → studio-creator` = 0.

## À faire avant/après merge (NON couvert ici)

- ⚠️ **QA navigateur** : rendu des couleurs (ISNA doit rester doré) et des nouvelles pages — non vérifiable en CI sandbox (build `vite` non lançable ici).
- Chaînes couleur **JS canvas/Konva** (`'#D4AF37'`) : migration manuelle au cas par cas (token runtime), **pas** un find-replace.
- Brancher la **résolution runtime par tenant** dans le seam `activeTenantConfig`.
- Champ backend `lifecycle_status` (statuts brouillon/en cours/fini précis) ; onboarding → `GET /catalog/templates`.
- Données/infra : billing ISNA `unpaid`, exécution DNS/Vercel (runbooks existants).
- Conflits de merge attendus (réorg = beaucoup de fichiers déplacés) → merger **tôt**.

## Règles à respecter ensuite (cf. REGLES_ARCHITECTURE_CIMOLACE.md)

1. Liri reste autonome (lint). 2. Une seule coque `App.jsx`. 3. Pas d'import direct `@/tenants/isna` (seam). 4. Pas de `#D4AF37` en dur (`var(--school-accent)`). 5. Catalogue = source backend.
