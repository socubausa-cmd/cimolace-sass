# MedOS Integration Audit — Codex Review

Date : 2026-05-10
Reviewer : Codex
Rapport audite : `docs/MEDOS_INTEGRATION_AUDIT_FOR_CIMOLACE.md`
Source MedOS inspectee : `/Users/ngowazulu/Downloads/isna_platform_v2`
Cible stable : `/Users/ngowazulu/Downloads/isna-opus`

---

## Verdict

Le rapport DeepSeek est globalement fiable : MedOS ne doit pas etre migre tel quel dans `isna-opus`.

Je confirme les risques techniques principaux :

- RBAC medical absent : les controllers MedOS utilisent `JwtAuthGuard` + `TenantGuard`, mais pas de `RolesGuard` medical ni de `@Roles()`.
- Validation absente : plusieurs endpoints utilisent `@Body() any`.
- Audit medical absent : la table `medical_audit_log` existe, mais aucun flux applicatif ne l'alimente.
- RLS medicale insuffisante : les migrations MedOS utilisent des policies `service_role_full_access`, donc l'isolation repose surtout sur l'API.
- Bug critique `med-charting` confirme : `generateNote()` insere une consultation sans `record_id` ni `practitioner_id`, alors que la migration les declare `NOT NULL`.
- Bug critique `med-gdpr` confirme : l'anonymisation met `patient_user_id` a `null`, alors que la colonne est `NOT NULL`.

Decision : ne pas fusionner le code MedOS prototype dans `isna-opus` maintenant.

---

## Correction importante sur les secrets

Le rapport DeepSeek signale des secrets exposes dans `isna_platform_v2`.

Etat constate au moment de cette review :

- `apps/api/.env` est marque comme supprime du tracking Git (`D apps/api/.env`).
- `scripts/e2e_test.js` lit maintenant `SUPABASE_SERVICE_ROLE_KEY` depuis `process.env`, sans cle hardcodee visible.
- `.gitignore` existe en fichier non tracke.

Donc le risque "secret actuellement hardcode dans le fichier inspecte" semble deja corrige localement. Mais si une vraie cle a deja ete commit/push dans l'historique, il faut quand meme la considerer compromise et la faire tourner dans Supabase.

Action restante : finaliser le nettoyage Git de `isna_platform_v2` ou repartir d'un workspace propre avant de laisser d'autres agents coder dessus.

---

## Arbitrage architectural

Le rapport recommande une stabilisation dans `isna_platform_v2`, puis migration.

Mon arbitrage : ne pas investir lourdement dans `isna_platform_v2`. Ce repo doit rester une reference/prototype MedOS. Le produit livrable doit etre construit dans `isna-opus`, sur le socle Cimolace deja valide :

- Auth JWT Supabase deja stable.
- TenantGuard deja stable.
- RolesGuard deja disponible.
- Catalogue Cimolace deja valide E2E.
- Onboarding infrastructure deja connecte.

Strategie recommandee :

1. Lire le prototype `isna_platform_v2` en reference seulement.
2. Implementer MedOS module par module dans `isna-opus`.
3. Commencer par un module pilote medical minimal mais securise : patients + notes cliniques.
4. Ajouter audit log et DTOs des le premier commit MedOS.
5. Reporter IA charting, PDF, prescriptions, portail patient et Practice Better complet apres validation du socle securise.

---

## Prochaine tache executable

Confier a DeepSeek V4 Pro une tache limitee, non-financiere, mais structuree :

**MedOS Phase 1A — Scaffolding securise dans `isna-opus`**

Objectif :

- Creer le module `apps/api/src/medos` dans `isna-opus`.
- Ne migrer aucun code brut depuis `isna_platform_v2`.
- Implementer seulement les bases :
  - roles MedOS constants/types ;
  - decorators/guards ou adaptation du `RolesGuard` existant ;
  - migration SQL MedOS MVP pour `med_patients`, `med_consultation_notes`, `med_audit_log` ;
  - DTOs validates pour patient et note ;
  - service audit log ;
  - endpoints patients/notes proteges par role ;
  - tests unitaires de role, tenant, audit et contraintes.

Ne pas demander a DeepSeek de faire :

- IA charting ;
- PDF ;
- prescriptions ;
- portail patient ;
- worker ;
- paiement ;
- RLS medicale finale sans review Codex/Sonnet.

---

## Points a faire revoir par Codex apres execution DeepSeek

- Aucune route medicale sans `JwtAuthGuard` + `TenantGuard`.
- Aucune mutation medicale sans role medical explicite.
- Aucune insertion/modification patient ou note sans ecriture dans `med_audit_log`.
- Aucun `@Body() any` dans les controllers MedOS.
- Aucune policy RLS trop large pour les roles utilisateur.
- Aucun code qui permet a un patient de lister tous les patients du tenant.
- Tests obligatoires avant acceptation.

