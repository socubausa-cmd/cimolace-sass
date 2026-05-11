# MedOS Patient Experience — Gap Analysis & Roadmap

Date : 2026-05-11  
Workspace : `/Users/ngowazulu/Downloads/isna-opus`

## Verdict

Le portail patient MedOS actuel fonctionne comme preuve technique, mais il n'est pas encore un vrai portail patient.

Aujourd'hui, le patient peut seulement voir des notes cliniques partagées. Il manque les actions qui donnent une sensation de suivi réel : rendez-vous, téléconsultation, formulaires, demandes d'examen, recommandations, programmes, journal santé, documents, prescriptions, paiements, notifications, messagerie et réactions simples.

## Sources consultées

### Cahier des charges MedOS local

Document lu :

- `/Users/ngowazulu/Downloads/toteme-dashboard/docs/MEDOS_CAHIER_DES_CHARGES.md`

Le cahier des charges cible explicitement 9 pages patient :

- `/dashboard` : prochain RDV, messages non lus, formulaires en attente
- `/appointments` : RDV passés/futurs, lien rejoindre consultation
- `/records` : dossier médical lecture seule
- `/notes` : notes partagées uniquement
- `/prescriptions` : ordonnances + PDF
- `/forms` : formulaires à remplir
- `/journal` : journal santé
- `/programs` : programmes assignés + progression
- `/messages` : chat sécurisé

Il liste aussi les modules nécessaires : formulaires médicaux, journal santé, programmes de soins, prescriptions/PDF, AI charting, export RGPD et audit.

### Marché / concurrents

Practice Better positionne le portail client comme un hub : rendez-vous, formulaires, ressources, programmes, messagerie sécurisée, journaux food/mood/lifestyle, documents et actions rapides. Source : https://help.practicebetter.io/hc/en-us/articles/360004032552-Navigating-Your-Client-Portal

SimplePractice met en avant côté client : rendez-vous, demandes de RDV, téléconsultation, paiements, documents/intake paperwork, messagerie sécurisée et notifications push. Source : https://support.simplepractice.com/hc/en-us/articles/9651784620045-The-SimplePractice-Client-Portal-mobile-app

Healthie regroupe EHR, intake/onboarding, scheduling, billing, automations, care plans, patient portal, messaging, programs, telehealth et journaling. Source : https://www.gethealthie.com/platform-overview

Jane App couvre : rendez-vous, téléconsultation, messages, intake forms, documents, contact info, cartes, paiements, reçus, notifications/rappels et gestion des sessions. Source : https://jane.app/guide/my-account-your-patient-client-portal

## État actuel dans `isna-opus`

### Déjà présent

- Backend Phase 1A : patients, notes SOAP, signature, partage patient.
- Guard MedOS actif.
- Route patient : `GET /med/me/notes`.
- UI praticien : dashboard MedOS, liste patients, détail patient, création note, signature, partage.
- UI patient intégrée minimale : `/dashboard/medos/me/notes`.

### Manques majeurs côté patient

| Domaine | État actuel | Ce qu'il faut |
|---|---|---|
| Accueil patient | Absent | dashboard avec prochaines actions, RDV, formulaires, messages, alertes |
| Actions rapides | Absent | demander RDV, remplir formulaire, envoyer document, ouvrir message |
| Notifications | Absent | badges non lus, rappels RDV, nouveau document, note partagée |
| Réactions patient | Absent | “j’ai lu”, question au praticien, accusé de réception |
| Messagerie | Absent | chat sécurisé patient-praticien avec pièces jointes |
| RDV | Absent | liste RDV, demande, annulation, rejoindre téléconsultation |
| Formulaires | API draft désactivée | intake, consentement, PHQ-9, suivi post-consultation |
| Journal santé | API draft désactivée | humeur, sommeil, symptômes, vitaux, alimentation, photos |
| Recommandations | Absent | conseils, ressources, documents, tâches prescrites |
| Demandes d'examen | Absent | lab, imaging, referral, statut, document PDF |
| Ordonnances | Absent | liste, PDF signé, validité, instructions |
| Programmes | Absent | étapes, progression, check-in, rappels |
| Documents | Absent | upload patient, documents partagés, résultats |
| Paiements | Non connecté à MedOS patient | factures, reçus, payer consultation |
| Profil / consentement | Absent | dossier lecture seule, contacts, consentements |
| Export RGPD | Absent | demander export dossier, télécharger JSON/PDF |

## Ce qu'il faut construire côté patient

### 1. Dashboard patient utile

Objectif : remplacer l'écran unique de notes par une vraie page d'accueil.

Blocs :

- Prochain rendez-vous avec bouton rejoindre si téléconsultation disponible.
- Tâches à faire : formulaire, consentement, journal du jour, paiement dû.
- Messages non lus.
- Nouvelles recommandations du praticien.
- Dernières notes/ordonnances partagées.
- Alertes : demande d'examen, document reçu, rappel programme.

### 2. Centre d'actions patient

Actions indispensables :

- Demander un rendez-vous.
- Remplir un formulaire.
- Envoyer une question au praticien.
- Uploader un document ou résultat.
- Télécharger ordonnance/reçu.
- Confirmer “j'ai lu / compris”.
- Marquer une tâche de soin comme faite.

### 3. Notifications et réactions

Types de notifications :

- Nouvelle note partagée.
- Nouvelle ordonnance.
- Nouveau formulaire à remplir.
- Nouveau message.
- Rappel de RDV.
- Rappel de programme.
- Demande d'examen créée.
- Résultat/document ajouté.

Réactions simples :

- Note lue.
- Ordonnance téléchargée.
- Question envoyée.
- Recommandation acceptée / terminée.
- Formulaire soumis.
- Check-in journalier fait.

### 4. Formulaires médicaux

À faire avant le journal avancé, car c'est le premier vrai workflow patient.

MVP formulaires :

- Liste des formulaires assignés.
- Formulaire dynamique JSON.
- Signature électronique simple.
- Statuts : pending, started, submitted, reviewed.
- Notifications patient et praticien.

Templates à livrer :

- Intake patient général.
- Consentement éclairé.
- Bilan nutritionnel.
- PHQ-9.
- Suivi post-consultation.

### 5. Journal santé et trackers

MVP journal :

- Humeur 1-10.
- Énergie 1-10.
- Sommeil.
- Symptômes avec sévérité.
- Notes libres.
- Photos repas/documents.

Phase suivante :

- Poids, tension, glycémie, température, SpO2, activité.
- Graphiques simples.
- Objectifs hebdomadaires.
- Partage automatique au praticien.

### 6. Recommandations et plan de soin

Ce module transforme MedOS en vrai suivi continu.

Objets recommandés :

- Recommandation texte.
- Ressource/document.
- Exercice ou tâche.
- Habitude à suivre.
- Demande de suivi.
- Conseil nutrition/sommeil/stress.
- Protocole court.

Champs utiles :

- titre, description, catégorie, priorité
- échéance
- statut patient : à faire, en cours, terminé, question
- visibilité patient
- lien vers note/consultation source

### 7. Demandes d'examen

À ajouter comme type structuré distinct des prescriptions.

Types :

- analyse laboratoire
- imagerie
- avis spécialiste
- document à fournir
- mesure à suivre

Statuts :

- demandé
- planifié
- résultat reçu
- revu par praticien
- archivé

Côté patient :

- voir la demande
- télécharger PDF
- uploader résultat
- poser une question

### 8. Prescriptions et PDF

MVP :

- Liste ordonnances visibles patient.
- PDF signé.
- date de validité.
- instructions.
- téléchargement.
- notification “nouvelle ordonnance”.

Après :

- fax/email pharmacie/labo.
- historique téléchargements.
- accusé de lecture patient.

### 9. Messagerie sécurisée

MVP :

- conversation patient-praticien par tenant.
- messages texte.
- pièces jointes.
- badge non lu.
- notification email.
- message d'absence praticien.

Règle produit à choisir :

- patient peut initier une conversation librement, ou seulement répondre à un fil ouvert par le praticien.

### 10. Rendez-vous et téléconsultation

MVP :

- prochains RDV.
- historique.
- bouton rejoindre LiveKit.
- demande de RDV.
- annulation/déplacement selon politique praticien.

Après :

- rappels email/SMS/WhatsApp.
- paiement avant confirmation.
- formulaires auto-envoyés avant RDV.

## Roadmap recommandée

### Phase P0 — Nettoyage UX immédiat

Durée : 1-2 jours.

- Renommer `/dashboard/medos/me/notes` en portail patient avec navigation.
- Ajouter shell patient : Accueil, Notes, Dossier, Formulaires, Journal, Messages.
- Ajouter cartes “à venir” pour les modules non branchés.
- Ajouter états de succès/erreur/toast.
- Ajouter badges “nouveau / lu / action requise”.

### Phase P1 — Portail patient MVP réel

Durée : 1 semaine.

- Dashboard patient.
- Notes partagées améliorées avec accusé de lecture.
- Dossier lecture seule.
- Notifications in-app simples.
- Formulaires assignés + soumission.
- Upload document basique.

### Phase P2 — Suivi médical actif

Durée : 1-2 semaines.

- Journal santé.
- Recommandations/tâches.
- Demandes d'examen.
- Ordonnances visibles patient.
- Timeline patient : note, prescription, formulaire, document, message.

### Phase P3 — Relation continue patient-praticien

Durée : 2 semaines.

- Messagerie sécurisée.
- Rappels email.
- RDV + téléconsultation.
- Paiement consultation.
- Programmes de soins avec progression.

### Phase P4 — Différenciation MedOS

Durée : 2-4 semaines.

- AI charting avec résumé patient en langage simple.
- Suggestions de recommandations depuis la note SOAP.
- Génération PDF : ordonnance, demande examen, compte rendu.
- Export RGPD complet.
- Automatisations : “si formulaire non rempli J-1, rappel”.

## Priorité de construction proposée

Ordre recommandé :

1. Dashboard patient + navigation.
2. Notifications in-app et état “action requise”.
3. Formulaires médicaux sécurisés.
4. Dossier patient lecture seule.
5. Accusé de lecture / réaction sur notes.
6. Recommandations/tâches patient.
7. Journal santé.
8. Demandes d'examen.
9. Prescriptions/PDF.
10. Messagerie sécurisée.
11. Rendez-vous/téléconsultation.
12. Programmes de soins.

## Décision importante

Ne pas réactiver brutalement les controllers Forms/Health existants tels quels. Ils ont été désactivés parce que Phase 1B n'était pas sécurisée.

Avant de livrer côté patient :

- vérifier ownership patient sur chaque endpoint ;
- garder `tenant_id` partout ;
- écrire audit log sur lecture/écriture médicale ;
- tester refus cross-patient ;
- ne jamais exposer les notes non partagées.

## Proposition UX concrète

Le portail patient MedOS devrait commencer par un écran “Aujourd'hui”.

Structure :

- Colonne gauche : prochaine consultation, tâches à faire, rappels.
- Centre : timeline de soin.
- Colonne droite : praticien, documents récents, statut consentement.

Exemple de cartes :

- “Formulaire pré-consultation à compléter”
- “Nouvelle ordonnance disponible”
- “Demande d'examen : NFS + glycémie”
- “Recommandation : boire 1.5L d'eau aujourd'hui”
- “Journal santé non rempli aujourd'hui”
- “Message du Dr. Mbadinga”
- “Note de consultation partagée — confirmer lecture”

Ce design donne au patient une impression claire : “je sais quoi faire maintenant”.
