# Dossier de conformité — HDS · Ségur · CE/MDR
### Franchir le marché médical français avec MEDOS / Cimolace Connected Care
*Établi le 2026-06-28. Les fourchettes de coûts/délais sont indicatives — à confirmer par devis au moment de la décision.*

---

## 0. Synthèse exécutive — 3 décisions, 1 séquence

| Verrou | Statut MEDOS aujourd'hui | Bloquant pour… | Décision / action |
|---|---|---|---|
| **HDS** (hébergement données de santé) | ❌ **Non conforme** (Supabase + Railway + Vercel ≠ certifiés HDS) | **TOUT** usage médical légal en France | Migrer l'hébergement vers un **hébergeur certifié HDS** (OVH/Scaleway/AWS-HDS) |
| **CE / MDR** (dispositif médical) | ⚠️ **Zone grise** (l'IA propose ordonnance + alertes cliniques) | Hôpitaux + revendiquer le diagnostic | **Décider** : rester « assistant validé par le praticien » (rapide) **ou** engager le marquage CE (long, mais barrière) |
| **Ségur** (référencement ANS) | ❌ Aucun service socle intégré (FHIR amorcé) | Vente hôpital + **financement État** | Intégrer INS/MSSanté/DMP/Pro Santé Connect → se faire référencer |

**Les 3 sont indépendants mais cumulatifs.** Sans HDS → illégal. Sans Ségur → pas d'hôpital français (mais OK pour thérapeutes/cliniques privées). CE → seulement si tu revendiques le diagnostic.

**Séquence recommandée** : `(1) HDS d'abord` → `(2) vendre aux thérapeutes/cliniques en "assistant non-dispositif"` → `(3) Ségur + CE en parallèle pour ouvrir l'hôpital`. L'Afrique (PawaPay, mobile money) contourne tout ça → marché de volume en attendant.

---

## 1. HDS — Hébergement de Données de Santé *(le socle non-négociable)*

### 1.1 La règle
Dès qu'on héberge des données de santé à caractère personnel pour de la prévention/diagnostic/soin/suivi, l'hébergement **doit** être chez un hébergeur **certifié HDS** (art. L.1111-8 CSP). Ce n'est pas optionnel — c'est une condition légale d'exercice. Référentiel **HDS v2** (mai 2024), adossé à **ISO 27001:2022 + ISO 27701**.

### 1.2 ⚠️ État réel de MEDOS — NON CONFORME
La pile actuelle n'est **pas** certifiée HDS :
- **Supabase** (`fwfupxvmwtxbtbjdeqvu`) — héberge TOUTES les données patient (med_patients, biomarqueurs, notes, ordonnances…). Supabase tourne sur AWS mais **n'est pas certifié HDS** en tant que tel.
- **Railway** (isna-api, isna-worker) — **pas HDS**.
- **Vercel** (med-app, patient-portal) — front, ne stocke pas de PHI en principe, mais les tokens/sessions transitent.

👉 **C'est le blocage n°1.** Aucune vente médicale légale en France tant que ce n'est pas réglé.

### 1.3 Les 6 activités HDS (un certificat peut n'en couvrir qu'une partie)
1. Infrastructure physique (datacenter) · 2. Infrastructure virtuelle (compute/stockage) · 3. Plateforme applicative (PaaS) · 4. Infogérance/administration · 5. **Édition de logiciel de santé** · 6. Messagerie sécurisée.

**Pour toi** : l'**hébergeur** couvre 1-4 (parfois 6). Sa certification ne TE certifie pas : ton appli/code/configs ont leurs propres contrôles. L'**activité 5 en propre** n'est nécessaire que si un appel d'offres hospitalier l'exige.

### 1.4 Le chemin (du moins cher au plus lourd)
- **Option A (recommandée pour démarrer)** : **louer** chez un hébergeur HDS, ne PAS se certifier soi-même.
  - **OVHcloud HDS** — le plus utilisé par les startups e-santé, meilleur rapport qualité/prix, couvre 1-6.
  - **Scaleway** (français, HDS 1-4), **AWS/Azure/GCP** (régions EU certifiées HDS — à **configurer explicitement** pour rester dans ces régions).
  - 👉 Piste concrète : **Postgres managé HDS** (OVH/Scaleway) ou **AWS HDS** + y rapatrier la base. Pour Supabase : soit self-host Supabase sur une infra HDS, soit migrer vers un Postgres HDS + réécrire la couche d'accès (le code utilise déjà le client Supabase → un Postgres direct demande un adaptateur).
- **Option B (plus tard)** : viser ta **propre certification activité 5** (éditeur) — seulement si un marché public l'impose.

### 1.5 Exigences techniques (déjà partiellement en place dans MEDOS ✅ / à faire ❌)
| Exigence | MEDOS |
|---|---|
| Chiffrement en transit (HTTPS/TLS) | ✅ (api/med/patient en HTTPS) |
| Chiffrement au repos + gestion de clés | ⚠️ à confirmer côté Supabase/host |
| Journalisation/audit des accès | ✅ `med_audit_log` (chaque mutation) |
| Contrôles d'accès granulaires | ✅ tenant + rôle + ownership (leçon C1) ; ⚠️ **mais RLS contournée (service-role)** → l'isolation est 100% applicative, un audit HDS le pointera |
| Registre des traitements + DPIA/AIPD | ❌ à produire |
| Hébergement en région HDS | ❌ **à migrer** |

### 1.6 Coûts/délais indicatifs
- Surcoût HDS vs cloud standard : **+20 à 50 %**. Infra : **50–200 €/mois** (MVP) → **5 000 €+/mois** à l'échelle.
- Certification éditeur en propre (si nécessaire) : **audit 10 000–30 000 €** + rôle DPO/sécu **500–2 000 €/mois**.
- **Délai migration** : 2–6 semaines pour rapatrier la base + reconfigurer (selon couplage Supabase).

> **Action prioritaire #1** : ouvrir un compte **OVHcloud HDS** (ou AWS région HDS), y migrer la base patient, et **architecturer HDS-first**. Tant que ce n'est pas fait, rester en **bêta/recherche** ou sur des tenants non-français (Afrique).

---

## 2. CE / MDR — Dispositif Médical Logiciel (SaMD) *(la décision structurante)*

### 2.1 La ligne de partage : documentation vs aide à la décision
- **Transcription / note SOAP brute relue par le praticien** → **NON-dispositif**. Cadre allégé.
- **IA qui suggère un diagnostic, signale une anomalie, priorise un triage, prédit (jumeau)** → **SaMD réglementé** (marquage CE / MDR). Le critère = **l'intention médicale revendiquée par le fabricant** (ton marketing + tes CGU).

### 2.2 ⚠️ Où se situe MEDOS — zone grise à cadrer
| Fonction MEDOS | Risque SaMD |
|---|---|
| Scribe → note SOAP (relue/validée) | 🟢 Faible (assistant documentaire) |
| Copilote **ordonnance suggérée** (brouillon, validé praticien, jamais signé auto) | 🟠 Moyen — c'est de l'aide à la décision, mais bornée par la validation humaine |
| Jumeau : **alertes cliniques** (« crise hypertensive — contactez les urgences ») | 🔴 **Élevé** — c'est de l'interprétation/alerte → tend vers SaMD |
| Jumeau **prédictif** (projection, simulateur) | 🔴 Élevé si tu revendiques une valeur pronostique |

👉 **Les alertes cliniques déterministes du jumeau + le copilote ordonnance sont les éléments qui te font basculer.** Tant qu'ils sont présentés comme **aide non-diagnostique, validée par un soignant**, tu restes défendable côté « assistant ». Le *claim* est le déclencheur.

### 2.3 Si tu vises le marquage CE (UE — Règlement MDR 2017/745)
- **Règle 11** classe les logiciels : la majorité des SaMD cliniquement signifiants tombe en **classe IIa+** → **revue par Organisme Notifié obligatoire** (goulot d'étranglement : pénurie d'ON désignés MDR → délais).
- Normes cycle de vie : **IEC 62304** (dev logiciel médical) + **ISO 13485** (système qualité) + **ISO 14971** (gestion des risques).
- **Superposition AI Act** : un SaMD à base d'IA est **automatiquement high-risk** (Art. 6(1) AI Act) → **double conformité MDR + AI Act**. Bonne nouvelle : le QMS MDR sert de fondation à l'AI Act. Échéance Art. 6(1) pour DM déjà marqués CE : **2 août 2027**.
- **US (FDA)** : voies 510(k) / De Novo / PMA. Exemption CDS (Cures Act) si le logiciel se contente de rapprocher données ↔ guidelines et **laisse le clinicien réviser**.

### 2.4 Recommandation stratégique
**Phase de lancement : reste « assistant validé par le praticien » → PAS de CE.** Concrètement :
- Marketing/CGU : « aide à la décision, **ne se substitue pas au jugement médical**, toute note/ordonnance est un **brouillon validé et signé par le praticien** ».
- Les alertes du jumeau : reformuler en **« repères de prévention / hygiène de vie »** côté patient (pas « diagnostic »), et **« signaux à vérifier »** côté praticien.
- Lancer le **chantier QMS (ISO 13485 + IEC 62304 + ISO 14971)** en parallèle **seulement** quand un gros deal hospitalier justifie le marquage CE (**12–18 mois**, plusieurs dizaines à centaines de k€ — à confirmer par devis ON).

> **Décision à prendre par toi** : revendiques-tu, à terme, le **diagnostic/pronostic** (= barrière à l'entrée défendable mais longue), ou restes-tu **outil d'assistance** (mise sur le marché rapide) ? Ça conditionne toute la roadmap réglementaire.

---

## 3. Ségur du numérique en santé *(le sésame hôpital + financement État)*

### 3.1 Pourquoi c'est central
L'**ANS** publie une liste officielle de logiciels **référencés** (DPI, etc.). Être référencé = condition d'accès au marché hospitalier ET de ville français, **et l'État finance** la montée de version chez tes clients (programme **SONS** : l'État achète directement les MAJ aux éditeurs via l'ASP, **sans coût pour le pro**). C'est un **levier de financement**, pas qu'une corvée.

### 3.2 Les services socles à intégrer (= ce qui manque à MEDOS)
| Service socle | Rôle | MEDOS |
|---|---|---|
| **INS** (Identité Nationale de Santé) | identifiant patient national | ❌ |
| **MSSanté** | messagerie sécurisée de santé | ❌ |
| **DMP / Mon espace santé** | alimentation + consultation du dossier patient national | ⚠️ **FHIR R4 amorcé** (couche `/med/fhir` Patient/Observation/MedicationRequest/Encounter) — base technique pour s'y connecter |
| **Pro Santé Connect** | authentification forte des professionnels (e-CPS) | ❌ |
| (+ Ordonnance numérique selon segment) | | ⚠️ ordonnances existent, pas le format e-prescription national |

👉 **La couche FHIR déjà construite est ta tête de pont** vers le DMP. Reste INS + MSSanté + Pro Santé Connect.

### 3.3 Calendrier (vague 2, par « couloir »)
- **Hôpital (DPI/PFI)** : décrets mai 2024. · **Médecine de ville (LGC)** : textes avr. 2025, **référencement ouvert sept. 2025**. · **Imagerie** : avr. 2025. · **Médico-social (DUI)** : mars 2026.
- 👉 Pour MEDOS (médecine de ville / thérapeutes) : le **couloir ville (LGC)** est ouvert.

---

## 4. Télémédecine — cadre & remboursement *(rappel, pour le module téléconsult)*

- **Téléconsultation remboursée 70 %** (base 25 € généraliste → 17,50 € remboursé), sous conditions (parcours coordonné, alternance présentiel, territorialité).
- ⚠️ **Agrément « société de téléconsultation »** (décret 29 fév. 2024) : requis **seulement si TU organises l'offre** (salaries/mets à dispo des médecins, perçois le remboursement). **Si tu vends l'OUTIL** (le praticien reste responsable de l'acte) → **pas d'agrément**.
- 👉 **Recommandation** : rester **éditeur d'outil** (pas plateforme B2C) → pas d'agrément lourd.

---

## 5. Roadmap séquencée (réaliste)

```
ÉTAPE 1 — Débloquer la légalité (0-2 mois)
  └─ HDS : louer OVH/AWS HDS + migrer la base patient  ← BLOQUANT ABSOLU
  └─ RGPD : registre des traitements + DPIA + DPO
  └─ Cadrer le claim : "assistant validé par le praticien" (CGU + marketing)

ÉTAPE 2 — Vendre (cycle court, sans Ségur ni CE) (2-6 mois)
  └─ Cible : thérapeutes, médecine fonctionnelle (Zahir = client zéro), petites cliniques privées
  └─ Pricing : 100-300 €/praticien/mois + setup
  └─ En parallèle : AFRIQUE (PawaPay, mobile money) = volume, hors cadre FR

ÉTAPE 3 — Ouvrir l'hôpital (6-18 mois)
  └─ Ségur ville : intégrer INS/MSSanté/DMP (sur la couche FHIR)/Pro Santé Connect → référencement ANS (+ financement SONS)
  └─ Intégration DPI hospitalier (HL7/FHIR/IHE)
  └─ DÉCISION CE/MDR : si claim diagnostic → QMS ISO 13485 + IEC 62304 + AI Act (12-18 mois)
```

---

## 6. Coûts & délais (fourchettes indicatives — à confirmer par devis)

| Poste | Coût | Délai |
|---|---|---|
| HDS (location OVH/AWS) | +20-50 % infra ; 50-5 000 €/mois | 2-6 sem migration |
| HDS certification éditeur (option) | 10-30 k€ + DPO 0,5-2 k€/mois | 6-12 mois |
| RGPD (registre, DPIA, DPO) | variable, DPO mutualisable | 1-2 mois |
| Ségur (intégration socles) | dev interne ; **financé par SONS** côté clients | 3-9 mois |
| CE/MDR classe IIa (si diagnostic) | dizaines-centaines de k€ | 12-18 mois |

---

## 7. ✅ Checklist d'actions concrètes — ce que TOI tu dois lancer

**Bloquant immédiat :**
- [ ] Ouvrir un compte **OVHcloud HDS** (ou décider AWS région HDS). → *je peux ensuite coder la migration de la base.*
- [ ] Désigner/mandater un **DPO** (interne ou mutualisé) + lancer le **registre des traitements** + une **DPIA**.

**Décision stratégique (toi seul) :**
- [ ] **Trancher le claim** : « assistant non-dispositif » (rapide) **vs** trajectoire **CE/MDR diagnostic** (long, barrière). ← conditionne tout.
- [ ] **Modèle téléconsult** : vendre l'outil (pas d'agrément) — *confirmé recommandé*.

**Pour l'hôpital (plus tard) :**
- [ ] Demander l'accès aux **API socles ANS** (INS, MSSanté, Pro Santé Connect, DMP) → *je code l'intégration sur la couche FHIR existante.*
- [ ] Viser le **référencement Ségur couloir ville (LGC)**.

**Ce que je peux coder dès que tu débloques :**
- Migration base → HDS · connecteurs INS/MSSanté/Pro Santé Connect/DMP · adaptation des claims dans l'UI/CGU · e-prescription au format national.

---

## 8. État MEDOS vs exigences — récap honnête

| Exigence | État | Qui agit |
|---|---|---|
| Audit log / traçabilité | ✅ fait | — |
| Contrôle d'accès tenant+patient | ✅ fait (mais RLS off → 100% applicatif) | moi (durcir si audit HDS) |
| Couche interop FHIR (→ DMP) | ✅ amorcée | moi (étendre) |
| Chiffrement transit | ✅ | — |
| **Hébergement HDS** | ❌ | **toi** (compte) → moi (migration) |
| RGPD (registre/DPIA/DPO) | ❌ | **toi** (DPO) |
| INS / MSSanté / Pro Santé Connect | ❌ | toi (accès API) → moi (code) |
| Décision CE/MDR | ⚠️ à trancher | **toi** |
| Agrément téléconsult | 🟢 non requis (éditeur d'outil) | — |

---

*Ce dossier est un plan de travail, pas un avis juridique. Avant tout engagement, fais valider le volet CE/MDR par un consultant affaires réglementaires (un ON ou un cabinet SaMD) et le volet HDS/RGPD par ton DPO.*
