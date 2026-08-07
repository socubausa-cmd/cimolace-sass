# LIRI — fiche App Store (à copier dans App Store Connect)

État au 7 août 2026. Bundle `org.prorascience.liri`, version 1.0.0.
Compte Apple actif : **Judith Kalonji** (adhésion Developer Program valide).

Le build `1.0.0 (6)` est envoyé dans App Store Connect. Tout ce qui suit est
prêt à copier-coller. Restent à renseigner manuellement dans App Store Connect :
les captures d'écran, le compte de démonstration, la fiche App Privacy et la
sélection du build 6 pour l'évaluation.

---

## Informations générales

| Champ | Valeur |
|---|---|
| **Nom** (30 car. max) | `LIRI` |
| **Sous-titre** (30 car. max) | `Cours, lives et suivi` |
| **Catégorie principale** | Éducation |
| **Catégorie secondaire** | Productivité |
| **Langue principale** | Français (France) |
| **Classification d'âge** | 4+ |
| **URL d'assistance** | https://prorascience.org/nous-contacter |
| **URL marketing** | https://prorascience.org |
| **Politique de confidentialité** | https://prorascience.org/politique-confidentialite |
| **Droits d'auteur** | 2026 Prorascience |

## Mots-clés (100 caractères max, séparés par des virgules, sans espaces)

```
cours,formation,live,visio,école,pédagogie,tutorat,classe,agenda,étudiant,professeur,replay
```

99 caractères. Ne PAS répéter le nom de l'app ni la catégorie : Apple les
indexe déjà, les répéter gaspille les caractères.

## Description

```
LIRI réunit dans une seule application tout ce dont vous avez besoin pour
apprendre et enseigner à distance.

SUIVRE SES COURS
Retrouvez vos formations, votre semaine de classe et l'ensemble de vos
supports. La vidéothèque garde chaque séance enregistrée, chapitrée et
consultable quand vous voulez.

PARTICIPER AUX SÉANCES EN DIRECT
Rejoignez les cours en visioconférence depuis votre téléphone. La qualité
s'adapte automatiquement aux connexions lentes — pensé pour être utilisable
là où le réseau est capricieux.

ÉCHANGER
Un forum par formation, une messagerie avec vos enseignants et votre
secrétariat, et des notifications pour ne rien manquer.

ORGANISER
Votre agenda, vos rendez-vous, votre vie scolaire : absences, résultats,
échéances. Tout ce qui vous concerne, au même endroit.

POUR LES ENSEIGNANTS
Animez vos séances en direct, préparez vos supports et suivez votre classe
depuis le même outil que vos élèves.

LIRI s'adapte à votre établissement : vous n'y voyez que les espaces
auxquels vous avez accès.

Une organisation partenaire et un compte sont nécessaires pour utiliser
l'application.
```

## Nouveautés de cette version (première soumission)

```
Première version de LIRI.
```

---

## Questionnaire « App Privacy » — réponses

Apple demande de déclarer chaque donnée collectée. Répondre juste : une
déclaration incomplète fait rejeter la version, et une déclaration fausse
peut faire retirer l'app.

**Données collectées, liées à l'identité de l'utilisateur :**

| Type | Usage | Suivi publicitaire |
|---|---|---|
| Adresse e-mail | Fonctionnalité de l'app, identification | Non |
| Nom | Fonctionnalité de l'app | Non |
| Numéro de téléphone (facultatif) | Fonctionnalité de l'app | Non |
| Contenu utilisateur (messages, notes, publications de forum) | Fonctionnalité de l'app | Non |
| Identifiants de compte | Fonctionnalité de l'app | Non |
| Données d'utilisation (progression pédagogique) | Fonctionnalité de l'app, analyses | Non |
| Diagnostics (rapports d'erreur) | Analyses | Non |

**À déclarer explicitement :**
- « Suivi » (App Tracking Transparency) : **NON**. L'app ne suit personne à
  travers d'autres apps ou sites, et n'utilise aucune régie publicitaire.
- Caméra et micro : utilisés **uniquement** pendant les séances en direct.
  Les textes de permission sont déjà dans `app.json`.

## Chiffrement (déjà réglé)

`ITSAppUsesNonExemptEncryption: false` est déclaré dans `app.json` : l'app
n'utilise que le HTTPS standard. Aucun formulaire d'exportation à remplir à
chaque envoi.

## Compte de démonstration pour l'évaluation Apple

**Obligatoire.** L'app exige une connexion : sans identifiants de test, le
relecteur Apple ne voit qu'un écran de login et **rejette la soumission**
(motif « Guideline 2.1 — Information Needed »).

Créer un compte élève dédié à l'évaluation, avec des données réalistes
(au moins une formation, une séance passée, un message), et le renseigner
dans App Store Connect → Informations sur l'évaluation :

```
Identifiant : review@prorascience.org
Mot de passe : (à créer, à ne PAS écrire dans ce dépôt)
Notes : Compte élève de démonstration. L'application donne accès aux cours,
aux séances en direct et à la messagerie de l'établissement partenaire.
Les fonctions de création sont réservées aux enseignants.
```

---

## Captures d'écran — ce qui bloque

Apple exige des captures aux dimensions iPhone exactes :
- **6,9 pouces** (1320 × 2868) — obligatoire
- **6,5 pouces** (1242 × 2688) — obligatoire
- 3 à 10 captures par taille.

**Elles ne peuvent pas être produites sur ce Mac** : Xcode n'est pas
installé (`xcode-select` pointe sur les Command Line Tools seuls), donc
aucun simulateur iOS n'est disponible.

Deux issues :
1. **Installer Xcode** depuis le Mac App Store (~10 Go). Je peux ensuite
   lancer le simulateur et produire les captures moi-même.
2. **Passer par TestFlight** : une fois la première version envoyée,
   l'installer sur un vrai iPhone et capturer depuis l'appareil.

Écrans à montrer, dans cet ordre (le premier est le plus vu) :
1. Accueil — la vue d'ensemble
2. Ma semaine — l'emploi du temps
3. Une séance en direct
4. Vidéothèque — les replays
5. Forum ou messagerie

⚠️ Ne PAS fabriquer ces captures depuis l'émulateur Android : la barre
d'état et la navigation ne sont pas celles d'iOS, et ça se voit.
