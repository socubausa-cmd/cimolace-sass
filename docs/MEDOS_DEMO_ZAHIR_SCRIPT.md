# MEDOS — Script de démo Zahirwellness

**Durée cible : 8 minutes** · **Audience : équipe Zahir**
**Stack démontrée : 19 tâches livrées (P0 → P4)**

---

## 0 — Pré-démo (à faire la veille)

- [ ] Vider les patients de test sur le tenant `zahirwellness`
- [ ] Connecter le compte médecin : `demo-medos-1779970333@cimolace.space` / `DemoMedos2026!`
- [ ] Connecter le compte patient sur un 2ᵉ navigateur ou écran : `demo-patient-zahir@cimolace.space` / `DemoPatient2026!`
- [ ] Vérifier qu'`api.cimolace.space/health` répond 200
- [ ] Préparer le tab `cimolace.space/medos/integration` pour la fin

---

## Acte 1 — Le médecin onboarde un nouveau patient (1m30)

**Côté médecin (`app.cimolace.space/medos`)**

1. `/patients` → bouton **+ Nouveau patient**
   - Prénom : Marie · Nom : Dupont · DOB : 1985-03-12 · Genre : F · Groupe : O+ · Email : marie@demo.test
   - → Le dossier apparaît dans la liste ✅
2. Cliquer sur "Marie Dupont" → `/patients/:id`
3. Cliquer sur **Inviter au portail**
   - Le lien magique apparaît, copier → simuler envoi par mail
4. **(coulisses)** : montrer rapidement le compte patient connecté en parallèle

> **Argument commercial** : *"Onboarding patient en 30 secondes — pas de form 20 champs, juste l'essentiel. L'invitation patient est intégrée."*

---

## Acte 2 — Le patient remplit son anamnèse + santé (1m30)

**Côté patient (`patient.cimolace.space`)**

5. Tab `/forms` → clic sur "Anamnèse — Premier rendez-vous" → **Remplir**
   - Renderer dynamique : 9 questions (motif, traitements, allergies, tabac…)
   - Soumettre
6. Tab `/health` → bouton **+ Enregistrer aujourd'hui**
   - Sliders : Humeur 7/10 · Énergie 6/10 · Sommeil 7.5h · Eau 1.5L · Notes "Petite fatigue le matin"
   - Soumettre
7. Re-faire l'étape 6 avec des valeurs différentes (3 entrées au total) → le **graphique Recharts** apparaît

> **Argument commercial** : *"Le patient nourrit son dossier en autonomie AVANT la consultation. Vous arrivez préparé."*

---

## Acte 3 — La consultation IA + ordonnance (2m)

**Côté médecin**

8. `/appointments` → **+ Nouveau RDV**
   - Patient : Marie Dupont · Date : aujourd'hui +30 min · Type : "En cabinet" · 30 min
   - → Apparaît dans la timeline avec badge "À CONFIRMER"
9. Clic sur le badge **CheckCircle** → "Confirmé"
10. `/charting` → **Démarrer la consultation IA**
    - Coller un texte de transcription préparé (15 lignes) ou uploader un .wav
    - → Status "transcribing" → "generating" → SOAP complet apparaît
    - Clic **Insérer dans le dossier**
11. `/prescriptions` → **+ Nouvelle ordonnance**
    - Patient : Marie · 90j validité · Instructions : "Boire 1.5L d'eau/jour"
    - Ligne 1 : Paracétamol 1000mg · 1 cp · 3x/jour · 5 jours
    - Ligne 2 : Magnésium 300mg · 2 cp · 1x/jour · 30 jours · NON SUBSTITUABLE
    - **Créer** → puis **Signer** → bouton **PDF** ouvre l'ordonnance imprimable

> **Argument commercial** : *"De la transcription audio au PDF signé : 4 clics. La signature électronique a valeur légale (hash SHA-256 + horodatage)."*

---

## Acte 4 — Le programme de soins + messagerie (1m30)

**Côté médecin**

12. `/programs` → **+ Nouveau programme**
    - Titre : "Détox 30 jours" · Catégorie : detox · 30 jours
    - Ajouter 4 étapes :
      - "Jeûne intermittent 16h" (task, J+0)
      - "Bilan hépatique" (lab_result, J+7)
      - "Marche 30min/jour" (task, J+0)
      - "Bilan final" (appointment, J+30)
    - **Inscrire un patient** → Marie Dupont
13. `/messages` → **+ Nouvelle conversation**
    - Patient : Marie · Sujet : "Suivi détox jour 1" · "Bonjour Marie, comment se passe le premier jour ?"

**Côté patient** (basculer écran)

14. `/programs` → "Détox 30 jours" avec **barre de progression 0%**
    - Cocher la 1ère étape ✓ → progression passe à 25%
15. `/messages` → lire le message du médecin, répondre "Tout va bien, juste un peu faim 😊"

**Retour côté médecin**

16. `/messages` → la réponse apparaît dans les 6 secondes (polling)

> **Argument commercial** : *"Programmes de soins + messagerie sécurisée = boucle d'engagement patient. Vous savez en temps réel si vos patients suivent leur traitement."*

---

## Acte 5 — RGPD (1m)

**Côté patient**

17. `/privacy` → 8 consentements RGPD avec toggles
    - Activer "Recherche scientifique" → toggle vert
    - Désactiver "Communications marketing" → toggle gris
18. Cliquer **Demander un export** → toast "Demande enregistrée"

**Côté médecin**

19. `/audit` → la table audit log montre **toutes les actions** des 30 dernières minutes
    - Filtrer par "prescription" → on voit le sign de Marie
    - Cliquer sur la ligne export du patient → JSON inspecté

> **Argument commercial** : *"RGPD natif : consentements granulaires côté patient + journal d'audit immuable côté praticien. Vous êtes prêts pour le contrôle CNIL."*

---

## Acte 6 — L'intégration Zahir (1m)

**Sur `zahirwellness.com`** (ou ouvrir `cimolace.space/medos/integration`)

20. Montrer la page docs **Stripe-style** : 3 modes officiels (A/B/C)
21. Coller le snippet :
    ```html
    <script src="https://cimolace.space/medos/v1/embed.js"></script>
    <medos-widget tenant="zahirwellness" mode="C-anonyme"></medos-widget>
    ```
22. Le widget MEDOS s'affiche en Shadow DOM → le patient zahir peut accéder à son dossier **sans quitter zahirwellness.com**

> **Argument commercial** : *"3 lignes de code et MEDOS est intégré dans votre site existant. Les patients ne savent même pas qu'ils utilisent une plateforme tierce."*

---

## Clôture (30s)

**Récap visuel :**
- **34 fonctionnalités** opérationnelles côté médecin
- **17 fonctionnalités** opérationnelles côté patient
- **3 modes d'intégration** (Hosted, Custom domain, Embedded)
- **0 frais d'infra** côté Zahir (Cloud Run + Vercel chez Cimolace)
- **Conformité RGPD** sur étagère

**Prix** : à compléter avec la grille Zahir

---

## Plan B — Si un truc casse en live

| Si… | Plan B |
|---|---|
| API down | Montrer les screenshots `/tmp/medos-shots/` puis demo locale |
| Patient portal ne login pas | Re-créer compte via `npm run gen-test-user` |
| Consultation IA timeout | Skip cet acte, montrer une note SOAP déjà créée |
| Widget MEDOS ne charge pas | Switcher sur le mode iframe direct cimolace.space/embed |

---

## Annexe — Comptes utilisés

| Rôle | Email | Mot de passe |
|---|---|---|
| Médecin | demo-medos-1779970333@cimolace.space | DemoMedos2026! |
| Patient | demo-patient-zahir@cimolace.space | DemoPatient2026! |
| Tenant slug | zahirwellness | |
| API | api.cimolace.space | |
| Med-app | app.cimolace.space/medos (ou med-app vercel URL) | |
| Patient portal | patient.cimolace.space (ou patient-portal vercel URL) | |
