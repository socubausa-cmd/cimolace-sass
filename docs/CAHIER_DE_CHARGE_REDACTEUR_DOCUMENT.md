# Cahier des charges — Le Rédacteur de document

> Dicté par le fondateur le 2026-08-04. Jusqu'à cette date, le mode Document du SmartBoard
> Designer n'avait **aucun cahier des charges écrit** : 60 spécifications étaient versionnées
> dans `docs/` (Tableau Vivant, Précepteur, Cimolace…), aucune sur l'éditeur documentaire.
> Ce fichier est la référence. Toute divergence entre le code et ce texte est un défaut.

## 1. L'intention

> « Un éditeur de document révolutionnaire, intelligent, plus fort et plus moderne que Canva
> et Word, capable de saisir **toute forme de document administratif** (devis, demande,
> courrier…). »

Le test qui tranche : **un artisan doit pouvoir produire son devis ici, de la page blanche
au PDF.** Tant que ce parcours ne passe pas, le rédacteur n'est pas livrable — quelle que
soit la richesse du reste.

## 2. Les six exigences

| N° | Exigence | Formulation d'origine |
|----|----------|----------------------|
| **§1** | **Mode hybride** | L'IA est un assistant qu'on **appelle**. Elle suggère le modèle, le style de langage, le mot technique. Elle propose des **blocs de suggestion qu'on peut tirer / coller / régénérer**. |
| **§2** | **Rédaction intégrale** | L'IA peut **rédiger tout le document elle-même**. |
| **§3** | **Contrôle libre** | Un mode où l'utilisateur garde la main, **sans IA imposée**. |
| **§4** | **Conscience du contexte** | L'IA connaît le contexte de la saisie — **administratif, commercial, juridique** — et doit être **compétente pour analyser le document** en conséquence. |
| **§5** | **Critique avant export** | À la fin, l'IA **analyse la mise en forme, la critique, l'améliore** — **avant** l'export. |
| **§6** | **IA design** | Une IA de mise en page : **choix de police, palette de couleurs, blocs de mots à redesigner — comme dans Canva**. |

## 3. Les règles non négociables

Elles ne viennent pas d'une préférence de style : chacune répond à un défaut constaté dans
ce dépôt.

1. **L'IA propose, elle n'écrase jamais.** Aucun texte saisi par l'utilisateur ne peut être
   remplacé par une génération sans une action explicite de sa part, et sans un aperçu
   **avant / après**. Sept pertes de données ont été trouvées dans ce dépôt, toutes de la
   même famille : une écriture qui **reconstruit** au lieu de **patcher**.
2. **Écriture par patch partiel.** Jamais de reconstruction d'un projet, d'une fiche ou d'un
   objet à la sauvegarde.
3. **Un bouton qui ne fait rien est interdit.** Soit il est branché, soit il est retiré.
   Une commande décorative est un mensonge adressé à l'utilisateur, pas un travail en cours.
4. **Le mode Contrôle libre est un silence, pas une préférence.** Quand il est actif,
   **aucune requête réseau IA ne part**, y compris en arrière-plan. Cela se vérifie en
   comptant les requêtes, pas en lisant un commentaire.
5. **Rien n'est annoncé qui n'existe.** Un libellé, une carte de modèle ou un message de
   l'IA qui promet une fonction absente est un défaut de même gravité qu'un bouton mort.
6. **Une affirmation se mesure.** « Les totaux sont justes » se prouve en recalculant ;
   « le document change » se prouve sur le projet Konva, pas sur le DOM.

## 4. Les options manquantes — audit du 2026-08-04

Auditées face à ce qu'un rédacteur professionnel attend, et à ce que le §1 « toute forme de
document administratif » implique réellement. Un devis, une facture ou un contrat de
plusieurs pages ne se composent pas sans les quatre premières lignes.

| Option | Pourquoi elle est requise | Gravité |
|--------|---------------------------|---------|
| **Tableau** (lignes, quantités, P.U., totaux, **TVA**, Total TTC) | Sans lui, ni devis ni facture. Les totaux doivent être arithmétiquement justes : arrondi à 2 décimales **par ligne**, puis somme des lignes arrondies — un écart d'un centime sur un devis est un défaut réel. | **Bloquant** |
| **Multi-pages, saut de page, débordement** | Un contrat tient rarement sur une page. Le canevas est A4 794×1123 px. | **Bloquant** |
| **En-tête / pied de page récurrents + numérotation** | Attendu de tout document administratif ; jetons `{{page}}` / `{{pages}}`. | **Bloquant** |
| **Export PDF fidèle** | Le §5 exige une critique **avant l'export** — sans export, l'exigence est sans objet. Texte sélectionnable si le chemin le permet. | **Bloquant** |
| **Image / logo** | En-tête d'entreprise, tampon, signature scannée. | Majeur |
| **Séparateur (filet horizontal)** | Primitive de mise en page élémentaire. | Majeur |
| **Marges et format papier** (A4 portrait/paysage, A5, Letter) | La critique de mise en forme mesure des marges : elles doivent être paramétrables. | Majeur |
| **Listes à puces et numérotées** | Attendu de base d'un traitement de texte. | Majeur |
| **Styles nommés réutilisables** | Ce que Word appelle les styles ; condition d'un document cohérent. | Moyen |
| **Correcteur orthographique** | Attendu sur un document administratif. | Moyen |
| **Champs variables / publipostage** | Un même courrier pour N destinataires. | Moyen |
| **Sommaire automatique, notes de bas de page** | Documents longs, juridiques. | Mineur |
| **Historique de versions** | Le store Supabase existe ; l'historique n'est pas exposé. | Mineur |
| **Export DOCX** | ⚠️ **Annoncé sur les cartes de modèles alors qu'il n'existe pas** — relève de la règle 5 : à implémenter ou à ne plus annoncer. | Majeur |

## 5. Ce qui doit se mesurer à la recette

Une recette qui ne produit pas ces chiffres n'est pas une recette.

- Nombre de boutons visibles du mode Document qui, cliqués, ne produisent **rien** (ni
  changement du projet Konva, ni changement du DOM, ni requête réseau). **Cible : 0.**
- Nombre de boutons qui n'attrapent pas le **premier** clic parce qu'un voile les recouvre.
  **Cible : 0.** (Mesuré à 90 sur 104 avant correction.)
- En mode Contrôle libre, requêtes IA émises sur 10 s. **Cible : 0.**
- Total HT, TVA et Total TTC d'un devis de 3 lignes, recalculés indépendamment.
  **Cible : identiques.**
- Après « Nouveau » puis « Sauver », l'état de la fiche précédente. **Cible : intacte.**
- Modèles de la bibliothèque rendant une zone générique « [ZONE] ». **Cible : 0 sur 100.**
- Blocs de suggestion survivant à la fermeture puis réouverture du panneau.
  **Cible : tous.** (Mesuré à 0 avant correction — du travail IA déjà payé, jeté.)

## 6. État vérifié au 2026-08-05

Cinq passes d'audit, de construction et de preuve en navigateur réel. Chaque ligne est un
relevé, pas une appréciation. Point de départ : **31 constats P0, 28 P1** — le mode Document
était une coque de démonstration où **aucun appel à un modèle de langage n'était jamais
émis** (le « coach » était un `setTimeout(900 ms)` suivi d'une concaténation de chaînes).

| Exigence | Mesure |
|----------|--------|
| §1 Suggestions | blocs proposés, insérés, **régénérés**, et **glissés-déposés** (posés à 3 px du point de dépôt) |
| §1 Reformulation | 3 variantes, **aperçu AVANT / APRÈS**, canevas inchangé tant que « Remplacer » n'est pas cliqué |
| §2 Rédaction intégrale | brouillon relu, puis 10 objets posés, Ctrl+Z annule |
| §3 Contrôle libre | **0 requête réseau sur 10 s**, verrou à trois niveaux devant toute construction de prompt |
| §4 Contexte | registre et formalité détectés (« Administratif · Soutenu 4/5 »), analyse locale sans réseau |
| §5 Critique avant export | diagnostic chiffré, corrections applicables une par une, affiché **avant** le bouton d'export |
| §6 IA design | 3 variantes d'habillage, polices appliquées sur 10 blocs, **0 requête** (moteur local) |

| Recette de la §5 | Cible | Relevé |
|------------------|-------|--------|
| Boutons sans effet | 0 | **0** en mode Document (4 restants appartiennent à la coque du portail) |
| Boutons ratant le premier clic | 0 | **0** (90 sur 104 au départ) |
| Requêtes IA en Contrôle libre / 10 s | 0 | **0** |
| Totaux d'un devis | justes | **HT 1 177,00 · TVA 235,40 · TTC 1 412,40**, recalculés indépendamment |
| Fiche précédente après « Nouveau » | intacte | intacte — `cloudWorkspaceId` remis à `null`, `?workspace` retiré |
| Modèles rendant « [ZONE] » | 0 / 100 | **0 / 100** |
| Suggestions survivant à la fermeture du panneau | toutes | **3 / 3** |
| Saisie au centre d'une cellule | 15 / 15 | **15 / 15**, page 1 et page 2 |
| Les deux critiques du même document | identiques | **identiques mot pour mot**, marges 76/57/76/57 |
| PDF | fidèle | 2 pages, texte sélectionnable, **€ sur 6 montants / 6** |

### Ce qui reste ouvert, dit plutôt que maquillé

- **Aucun essai avec un humain.** Le plancher de zoom (0,62) est fondé sur la géométrie de la
  cible — fenêtre de clic mesurée à 9-10 px contre 5-6 px avant — et non sur un échec observé :
  le robot réussit jusqu'à l'échelle 0,20. La dispersion de visée d'une vraie main n'est pas
  mesurée.
- **Arbitrage de produit non validé** : sur une page, le zoom par défaut descend de 0,6905 à
  0,6191. C'est le prix de la garantie « la page entière tient sans défiler ».
- **Une seule taille de fenêtre éprouvée** (1512×900). Aucun essai tactile ni mobile.
- **Pas de repère visuel de défilement** : sur deux pages, la page 2 n'est atteignable qu'à la
  molette, sans barre ni indicateur de page.
- **Pas de déplacement de groupe** dans l'éditeur : un tableau se déplace pièce par pièce.
  Fonctionnalité absente de longue date, pas une régression.
- **Débordement naturel d'un tableau** au-delà d'une page non éprouvé (le panneau plafonne à
  30 lignes vierges).
- **Aucun paiement réel** n'a été exercé, et l'export DOCX reste annoncé sans exister
  (règle 5).

### Deux erreurs de diagnostic corrigées en route

Elles valent d'être écrites : elles montrent comment on se trompe ici.

1. **Le « € manquant » du PDF n'existait pas.** jsPDF écrit les polices standard avec
   `/WinAnsiEncoding` : `€` = octet `0x80`, `—` = `0x97`. Ce sont des positions de contrôle C1
   en Latin-1 — toute extraction naïve des chaînes `Tj` les rend invisibles. Le PDF était
   correct depuis le début ; c'est la mesure qui était fausse.
2. **Un relais de glissement de groupe écrit puis entièrement retiré.** Konva démarre déjà un
   vrai drag sur chaque nœud attaché au Transformer ; le relais était redondant *et* nuisible
   (`dragOriginRef` est un ref unique partagé par les drags concurrents : la pièce attrapée
   partait à dx = −294 au lieu de +64). Il ne manquait que la sélection, détruite au
   `mousedown`.

### Un incident serveur révélé au passage

L'enregistrement du Studio était **mort pour tout le monde** : `HTTP 500 / 42P17 infinite
recursion` sur `liri_course_workspaces` — deux politiques RLS qui se citent l'une l'autre. La
table contenait **0 ligne** : personne n'avait jamais réussi à enregistrer. Derrière se cachait
un second défaut, `s.workspace_id = s.id` (un `id` non qualifié se lie à la table intérieure
d'une sous-requête) : **le partage n'a jamais fonctionné**. Correctif dans
`supabase/migrations/20260805090000_fix_liri_workspaces_rls_recursion.sql`, prouvé dans une
transaction annulée sur la base de production.

## 7. Architecture — où vit quoi

| Rôle | Fichier |
|------|---------|
| Intelligence de rédaction (contexte, suggestions, rédaction intégrale, verrou du mode libre) | `apps/app/src/features/smartboard-konva-editor/lib/documentIntelligence.js` |
| Critique de mise en forme et IA design | `…/lib/documentDesignCritique.js` |
| Pose des blocs sur la page A4 (encre lisible, pas d'empilement) | `…/lib/documentBlockLayout.js` |
| Tableaux et devis (colonnes, TVA, totaux, ajout/suppression de ligne) | `…/lib/documentTables.js` |
| Pagination, saut de page, en-tête/pied récurrents, numérotation | `…/lib/documentPagination.js` |
| Export PDF / PNG / impression, et critique unifiée avant export | `…/lib/documentExport.js` |
| Bibliothèque des 100 modèles (10 domaines) | `apps/app/src/data/documentTemplates.json` + `…/lib/documentTemplateLibrary.js` |
| Machine à états du coach | `…/store/useDocumentCoachStore.js` |
| Panneaux | `…/components/Document{SuggestionsPanel,TextAiActions,ReviewPanel}.jsx`, `…/studio/DocumentCoachPanel.jsx` |
| Coque de l'éditeur | `apps/app/src/pages/studio-creator/studio/StudioSmartboardKonvaPage.jsx` |
| Canal IA unique | edge `studio-longia-chat` (repli `longia-admin-document`) |

⚠️ Le mode Document **partage sa coque** avec le mode Smartboard (bascule en barre haute).
Tout ce qui est ajouté au rail d'outils, à la barre haute ou au hub LONGIA doit être
conditionné au mode, sinon il fuit dans l'autre produit.
