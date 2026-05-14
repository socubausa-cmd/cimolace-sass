# Secretariat — Scenario Temple NGOWAZULU

## Objectif
Ce document decrit le workflow operationnel du secretariat pour le parcours **Temple NGOWAZULU**:
- controle du paiement d'ouverture,
- verification administrative du dossier,
- qualification,
- transmission au maitre,
- suivi et escalade.

## 1) Conditions d'entree
Un dossier NGOWAZULU est recevable uniquement si:
1. Paiement confirme du plan `ngowazulu-ouverture-recouvrement`.
2. Formulaire patient complete.
3. Consentements obligatoires valides:
   - serment de confidentialite,
   - clause de non-divulgation,
   - disclaimer medical.

## 2) Pieces obligatoires
Le secretariat verifie la presence des 3 pieces:
1. Photo (profil)
2. Piece d'identite
3. Preuve d'habitation

Si une piece manque:
- statut: `incomplete_admin`,
- action: notifier le patient pour regularisation,
- delai de relance: 24h puis 72h.

## 3) Delais de traitement
- Verification admin initiale: **24h a 72h**
- Qualification dossier: **48h**
- Transmission au maitre: immediate apres qualification
- Demarrage prise en charge: selon urgence (`standard` / `urgent`)

## 4) Statuts operationnels recommandes
- `awaiting_opening_payment`
- `awaiting_documents`
- `incomplete_admin`
- `qualified_secretariat`
- `submitted_to_master`
- `in_treatment`
- `closed`

## 5) Script de communication secretariat
### A. Dossier incomplet
> Bonjour, votre dossier NGOWAZULU est recu, mais il manque des elements administratifs.
> Merci de regulariser depuis votre espace:
> - piece d'identite,
> - preuve d'habitation,
> - photo.
> Sans cela, la transmission au maitre ne peut pas etre lancee.

### B. Dossier qualifie
> Bonjour, votre dossier est complet et valide par le secretariat.
> Il est transmis au maitre pour orientation et calendrier de prise en charge.

### C. Escalade urgence
> Votre dossier est tagge `urgent`.
> Le secretariat a priorise votre demande et active un canal de suivi accelere.

## 6) Checklist de cloture secretariat
- Paiement d'ouverture confirme
- Documents admin conformes
- Consentements signes
- Qualification saisie
- Dossier transmis au maitre
- Notification patient envoyee

## 7) Gouvernance
- Confidentialite stricte (aucune diffusion externe)
- Journaliser toutes les actions critiques
- Respect de la separation:
  - secretariat = qualification / suivi admin
  - maitre = orientation / protocole spirituel

