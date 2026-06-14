# Règles d'architecture Cimolace — référence anti-confusion

> **But de ce document** : que personne (humain ou agent IA) ne re-confonde **Cimolace**, **ISNA**, **Liri** et **Studio Créateur**. À lire AVANT de toucher au code.
> Statut : canonique. Complète `CIMOLACE_ARCHITECTURE_SOURCE_OF_TRUTH.md` et `ARCHITECTURE_LIRI_VS_ECOLE.md`.
> Dernière mise à jour : 2026-06-14.

---

## 1. Vocabulaire — à ne JAMAIS confondre

| Terme | Ce que c'est | Ce que ce n'est PAS |
|---|---|---|
| **Cimolace** | La **plateforme SaaS** (la marque, l'OS, le code, l'API, l'équipe). | Pas un tenant. Pas un moteur. |
| **Moteur** (engine) | Une **capacité** activable : **Liri** (live), **École/ISNA** (scolaire), **MEDOS** (santé), **Mbolo** (e-commerce), **Studio Créateur** (création). | Pas une entreprise, pas un client. |
| **Tenant** | Un **client** qui active des moteurs (ex : ISNA Academy / Prorascience, Zahir). | Pas la plateforme. |
| **Liri Studio** | Le **moteur live autonome** (visio type Zoom), installable seul sur n'importe quel site via clé API. | Ne dépend NI de l'École NI de Studio Créateur. |
| **Studio Créateur** | La **suite de création** Liri. Produit **vendu à part** de Liri Studio. | N'est pas l'École. |
| **École (ISNA)** | Le **moteur scolaire** : cours, leçons, élèves, profs, formations. **Consomme** Liri. | N'est pas la plateforme. ISNA Academy est le tenant fondateur. |

**Règles immuables :** Cimolace n'est pas un tenant · un moteur n'est pas un tenant · un tenant active un ou plusieurs moteurs · **tout passe par `apps/api`** (autorité unique).

---

## 2. Les 5 règles d'or du code (NE PAS casser)

1. **Liri reste autonome.** `modules/liri`, `components/liri`, `pages/liri` ne doivent **JAMAIS** importer `school/` ni `studio-creator/`. École et Studio Créateur consomment Liri, **jamais l'inverse**.
   → **Vérifié automatiquement** par une règle ESLint (`no-restricted-imports`) dans `apps/app/eslint.config.js`. Un import interdit fait échouer le lint.

2. **Une seule coque app.** L'app `apps/app` a **une seule** racine : `App.jsx` (entrée `main.tsx`). Ne pas recréer de `App.tsx` / `main.jsx` parallèle.

3. **Pas d'import direct de la config ISNA.** Ne jamais importer `@/tenants/isna/...`. Passer par le **seam** `@/lib/tenant/activeTenantConfig` (seul point qui connaît le tenant actif ; c'est là qu'on branchera la résolution runtime par tenant).

4. **Pas de couleur ISNA en dur.** L'or `#D4AF37` est interdit en dur. Utiliser `var(--school-accent)` :
   - Tailwind : `bg-[var(--school-accent)]` ; avec opacité : `bg-[color-mix(in_srgb,var(--school-accent)_50%,transparent)]`.
   - **Exception** : canvas / Konva / Three / SVG en JS → couleur runtime (la var CSS n'y marche pas).
   - **Exception** : le portail Liri (`LiriPortal.css`, scope `.lp-shell-main`) garde son remap coral basé sur les classes hex littérales → **ne pas migrer** les classes des fichiers du portail.

5. **Source de vérité du catalogue = backend.** Les moteurs d'un template viennent de `apps/api/src/cimolace-catalog` + `school-engine-manifest.ts` (exposé par `GET /catalog/templates`). Le front `lib/infrastructures.ts` n'est qu'un **aperçu** statique, pas la vérité.

---

## 3. Où vit quoi

```
apps/api/                 API multi-tenant — TOUTE la logique métier passe ici (autorité unique)
apps/app/src/
  modules/
    cimolace/             back-office plateforme (clients, billing, credentials…)
    liri/                 moteur LIVE autonome (live, smartboard, studio, replay, neuro-recall)
    school/               moteur ÉCOLE (courses, lessons, students, teachers, admin, marketing, payments)
  components/
    liri/                 UI du live autonome
    studio-creator/       UI de la suite de création (vendue à part)
    school/               UI scolaire (classroom, formations, student, teacher, certificates…)
  pages/
    liri/  studio-creator/  school/   (même découpage)
  lib/tenant/
    activeTenantConfig.js seam unique de config tenant (NE PAS court-circuiter)
  styles/
    proTokens.js          tokens de design neutres partagés (ex-studio-pro)
```

Moteurs API live (clarification — **pas** des doublons) : `live` = Liri Live canonique · `immersive-live` = sous-moteur Liri (partage `livekit.service`) · `livekit` = infra partagée · `zoom-engine` = **connecteur Zoom** (import recordings), **pas** un moteur live.

---

## 4. Ce qui a été fait (chantier de juin 2026)

Branche : `phase2/split-liri-school` (à merger dans `origin/main`).

| Phase | Contenu |
|---|---|
| Audit | Rapport `AUDIT_CONFUSION_CIMOLACE_ISNA_LIRI_2026-06-14.md` (constats + plan). |
| 1 | Coque app unifiée (suppression doublons `App.tsx`/`main.jsx`), root → Cimolace, projet renommé `cimolace`. |
| 2 | `modules/liri-school` éclaté en `modules/liri` (autonome) + `modules/school`. |
| 2b | UI réorganisée en `liri/` + `studio-creator/` + `school/` ; **Liri rendu 100 % autonome** ; règle de lint anti-régression. |
| 3 | Branding ISNA dé-câblé : or officialisé comme `--school-accent` par défaut, ~5000 couleurs migrées (hors portail), imports `tenants/isna` centralisés en un seam. |
| 4 | Investigation moteurs live API → **pas de doublons** (audit corrigé). |
| 6 | Back-office « Mes infrastructures » : page liste multi-infra + statuts, panneau détail (clés API, snippet d'installation, abonnement/carte), lien de nav. |
| 5/7/8 | Catalogue front aligné (6→11 moteurs) ; legacy MEDOS déjà résolu ; runbooks domaines existants (exécution DNS hors code). |

---

## 5. Ce qui reste (et qui ne doit PAS être refait à l'aveugle)

- **QA navigateur** du lot couleurs et des nouvelles pages (rendu non vérifiable en CI sandbox).
- **Chaînes couleur JS** `'#D4AF37'` en contexte canvas/Konva : à traiter **au cas par cas** avec un token runtime (PAS un find-replace).
- **Résolution runtime** du seam `activeTenantConfig` (aujourd'hui = tenant fondateur par défaut).
- Champ backend `lifecycle_status` sur `tenants` pour des statuts brouillon/en cours/fini précis.
- Faire consommer `GET /catalog/templates` à l'onboarding (retirer la liste statique).
- Données/infra (hors code) : billing ISNA `unpaid`, exécution DNS/Vercel.

---

## 6. Coordination entre agents

- La branche `phase2/split-liri-school` est **partagée et active** (plusieurs flux de travail dont le « découplage ISNA »). Synchronisez-vous avant gros refactor.
- Après un renommage de dossier : `git worktree repair` (puis `git worktree prune` si besoin) pour réparer les worktrees liés.
- Ce refactor a **déplacé beaucoup de fichiers** → des **conflits de merge** sont attendus à l'intégration. **Merger / ouvrir la PR vers `origin/main` rapidement** limite la divergence.
- Respecter les **5 règles d'or** (§2) ; le lint bloque déjà la principale (autonomie Liri).
