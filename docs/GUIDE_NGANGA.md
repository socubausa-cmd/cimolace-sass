# Guide d'utilisation — Nganga

**Nganga** est la plateforme de santé fonctionnelle / bien-être de votre cabinet.
Elle a **deux espaces** :

- 🩺 **Espace praticien** — `med.cimolace.space` : gérer les patients, consulter, analyser, prescrire, suivre.
- 🌿 **Espace patient** — portail à votre marque (ex. `…patient.cimolace.space`) : le patient remplit ses questionnaires, voit ses notes, son corps, ses ordonnances, échange avec vous.

> White-label : le patient voit **votre marque** (logo, couleurs), jamais « Cimolace » ni le moteur technique.

---

# 🩺 Côté praticien

Accès : votre site → bouton d'accès praticien (connexion sécurisée par SSO). Menu latéral :

### 1. Dashboard
Vue d'ensemble : activité du jour, raccourcis, indicateurs clés.

### 2. Patients
- Liste + recherche des patients, création d'un patient (assistant d'onboarding).
- Fiche patient : informations, historique, accès au **Jumeau numérique**.
- **Invitation patient** : génère un lien (valable 7 j) ; le patient crée son compte et son dossier se lie automatiquement.

### 3. Rendez-vous
Agenda des consultations : planifier un RDV (patient + date/heure), motif, téléconsultation.

### 4. Consultation IA
Aide à la consultation : prise de notes assistée / transcription, structuration en note clinique (format **SOAP** : Subjectif, Objectif, Évaluation, Plan). Les notes peuvent être **signées** et **partagées** avec le patient.

### 5. Ordonnances
Rédaction d'ordonnances (médicaments, compléments, nutrition) : posologie, durée, instructions. PDF signé, consultable par le patient.

### 6. Formulaires — *créateur intégré*
- **Galerie** de formulaires (anamnèse, consentement, bilan, suivi…).
- **Créateur façon Google Forms** (`Nouveau formulaire`) : **page en deux volets**, configuration à gauche / **aperçu en temps réel** à droite (testable). 7 types de champ : texte court/long, nombre, date, **choix**, **choix multiples**, case à cocher, fichier. Glisser-déposer pour réordonner, dupliquer, champ obligatoire, bascule **ordinateur/mobile**.
- Les formulaires apparaissent **automatiquement chez le patient** à remplir.

### 7. Suivi santé
Journal de santé du patient (vu côté praticien) : check-ins, symptômes, constantes, tendances entre les consultations.

### 8. Programmes
Programmes de soin / cures (ex. détox) attribués au patient.

### 9. Messages
Messagerie sécurisée praticien ↔ patient (questions entre deux consultations, pièces jointes).

### 10. Audit & RGPD
Journal d'audit (qui a accédé/modifié quoi) + conformité RGPD (traçabilité, export, suppression).

---

## 🧬 Le Jumeau numérique (depuis une fiche patient)

Cœur de Nganga : une représentation vivante de l'état du patient, avec **8 onglets**.

| Onglet | Ce qu'il fait |
|---|---|
| **Corps 3D** | Vrai corps 3D rotatif (organes anatomiques réels). Chaque organe est **coloré selon son score** (vert→rouge), **cliquable** → fiche organe (score /100, biomarqueurs contributifs, « Pourquoi ce score ? » expliqué par l'IA). Bascule **Femme/Homme**, zoom, fallback 2D. |
| **Roue** | **Roue de transformation** en 2 modes : **Matrice fonctionnelle** (7 systèmes + 5 processus, modèle de médecine fonctionnelle) et **Hygiène de vie** (12 domaines). Bouton **« Remplir le bilan »** → questionnaire → calcul automatique. Bouton **« Grille »** → éditeur back-office pour **configurer le scoring** (poids/axes) manuellement. |
| **Laboratoire** | **Import de bilans** : photo / PDF / CSV / copier-coller → extraction automatique des biomarqueurs → recalcul des scores → le corps se recolorise. Saisie manuelle possible. Profil démo en 1 clic. Multi-omics avancé : **génomique (SNP)**, **microbiote**, **métabolomique**. |
| **Corrélations** | Carte mentale navigable (façon NotebookLM) : organes ↔ biomarqueurs ↔ symptômes ↔ conditions. Pan/zoom, clic sur un nœud → lecture détaillée (liens, poids, niveau de preuve). |
| **Timeline** | Chronologie des événements de santé et des bilans. |
| **Évolution** | Suivi longitudinal des scores dans le temps (tendances par organe/axe). |
| **Simulateur** | **What-if** : sélectionner des interventions (micronutriments, détox…) → projection de l'effet sur les organes et les indices globaux (vitalité, inflammation, métabolisme). |
| **Copilote IA** | Assistant clinique : **Analyse IA** (génère des **hypothèses** à valider/rejeter), recherche de **cause racine**, « **conseil** » multi-perspectives, recherche scientifique. ⚠️ Aide à la décision, **jamais un diagnostic** — le thérapeute reste 100 % décisionnaire. |

Sur l'onglet Corps figurent aussi : **alertes cliniques**, **hypothèses** (à valider) et un **laboratoire virtuel** de saisie rapide.

---

# 🌿 Côté patient

Accès : le patient se connecte sur **le portail à votre marque**. Menu :

| Section | Ce que le patient fait |
|---|---|
| **Accueil** | Tableau de bord : actions à faire, notifications, dernières notes partagées. |
| **Mon dossier** | Ses infos médicales de base, consentements, en lecture seule. |
| **Rendez-vous** | Voir / demander ses rendez-vous. |
| **Notes** | Lire les **consultations partagées** par le praticien (format SOAP), confirmer la lecture, poser une question. |
| **Notes IA** | Comptes-rendus assistés par IA partagés. |
| **Ordonnances** | Consulter / télécharger ses ordonnances signées et leurs instructions. |
| **Formulaires** | **Remplir les questionnaires** demandés (anamnèse, consentement, **Bilan de transformation**…), y compris **choix multiples**. À l'envoi, ça alimente directement la roue côté praticien. |
| **Suivi santé** | Journal : humeur, sommeil, énergie, symptômes, constantes — entre les consultations. |
| **Mon corps** | Sa vue « jumeau » personnelle (état de son corps de façon pédagogique). |
| **Programmes** | Suivre les programmes/cures qui lui sont assignés. |
| **Messages** | Échanger en sécurité avec le praticien. |
| **Confidentialité** | RGPD : gérer ses consentements, demander l'export ou la suppression de ses données. |

---

## 🔄 Le parcours type (comment tout s'enchaîne)

1. Le praticien **crée le patient** et l'**invite** (lien).
2. Le patient se connecte au portail, **remplit le Bilan de transformation** (Formulaires).
3. Les réponses **alimentent automatiquement la Roue** et les scores du **Jumeau numérique** côté praticien.
4. Le praticien **importe les bilans labo** → le **Corps 3D** se colorise, les corrélations s'affichent.
5. Il lance le **Copilote IA** (hypothèses), **simule** des interventions, **prescrit** et crée un **programme**.
6. Il **partage notes/ordonnances** ; le patient les consulte, tient son **journal**, échange en **messagerie**.

---

## 🔐 Transversal
- **Sécurité / RGPD** : audit complet, consentements, export/suppression des données patient.
- **White-label** : marque du cabinet partout côté patient.
- **IA = copilote** : toutes les sorties IA sont une aide à la décision, jamais un diagnostic.

*Guide indicatif — certaines fonctions avancées (multi-omics, simulateur) dépendent des données disponibles pour le patient.*
