# Liri Portail / Prorascience — mémoire de reprise Claude

Date : 2026-07-24  
Contexte : l'utilisateur arrive en fin de crédits Codex et veut que Claude continue sans revenir en arrière.

## Mandat prioritaire

Finaliser Liri Portail pour le tenant `prorascience` / `isna` comme interface officielle de vente, connexion, cours, forum, messagerie et live immersif. Ne pas repartir sur les anciennes interfaces `/t/:slug/...` comme base UX : elles peuvent rester compatibles, mais le travail produit validé est dans `/liri`.

## Directive artistique validée

Liri Portail doit se comporter comme une interface d'époque IA, pas comme un back-office classique.

- Fond sombre chaud `#262624`, respiration, transparence, halos subtils.
- Accent coral/terra `#d97757` et ambre doux ; éviter bleu/violet/teal/navy/or dur.
- Interface immersive mais lisible : peu de cartes opaques, beaucoup d'espace, hiérarchie nette.
- Le portail doit donner la sensation d'un “moteur intelligent” :
  - l'utilisateur demande ;
  - l'agent explique ;
  - l'interface navigue pour lui ;
  - les raccourcis restent cliquables ;
  - la réponse n'est pas un bloc statique, mais un parcours.
- Pour Prorascience, style narratif : “avant il fallait voyager / maintenant le savoir vient à toi”, problématique → solution → différence → parcours.
- Le mode lecture doit être stable : le texte long défile dans son panneau, pas toute l'interface.
- Le bouton “Écrire” doit faire le vide, comme une gomme : on entre dans un écran plein, calme, dédié à la question.

## Règles anti-régression

1. Ne pas remplacer Liri Portail par l'ancienne vitrine ou l'ancienne page paiement.
2. Ne pas remettre des cartes trop chargées sur “Mes cours”.
3. Ne pas cacher la logique post-production derrière des boutons dispersés : l'élève doit comprendre le parcours.
4. Ne pas retirer les droits micro/caméra directs des membres admis en appel immersif.
5. Ne pas déployer avec `vercel --prod` directement. Déploiement front : `bash deploy-liri.sh` uniquement.
6. Toujours vérifier avec capture écran avant de livrer une UI.

## Travail déjà fait dans cette session

### Paiement / abonnement / renouvellement

- Tunnel Liri paiement amélioré.
- Calendrier de paiement visible côté élève.
- État forfait actuel, jours restants, grâce/past_due/expired.
- Webhook Stripe `invoice.payment_failed` traité : facture échouée + notification.
- Build validé : `npm run build -w @isna/api`, `npm run build -w @isna/app`.

### Forum / messagerie

- Accès forum et messagerie vérifié pour membre élève.
- `/liri/forum` et `/liri/messages` restent dans le portail.
- Le forum permet question liée à vidéo/replay.
- La messagerie affiche la sélection de destinataire et membres.

### Live immersif

Bug signalé : “dans appel immersif les membres ne peuvent que parler en messagerie, pas en appel”.

Correction :

- Fichier : `apps/app/src/components/liri/liri-live/GuestPermissionBar.jsx`
- Micro/caméra/main levée n'exigent plus un grant temporaire serveur quand la session les autorise déjà.
- Les boutons “Accès micro / Accès caméra / Signaux” ne s'affichent plus si le droit existe déjà.
- Le formateur garde le contrôle global via les verrous session (`student_audio_enabled`, `student_video_enabled`, etc.).

### Mes cours

L'utilisateur a dit que la page “Mes cours” n'était pas assez immersive.

Correction :

- Fichier : `apps/app/src/pages/school/student-school-life/StudentFormationsOsPage.jsx`
- Ajout d'un cockpit “Liri Learning OS” :
  - titre massif et calme ;
  - stats modules/séances/vidéos ;
  - raccourcis Continuer ;
  - texte d'intention : cliquer ou demander à l'agent.

### Player post-production

L'utilisateur ne comprenait pas le player vidéo issu de la post-production.

Correction :

- Fichier : `apps/app/src/components/school/formations/CoursePlayerInterface.jsx`
- Ajout d'un bandeau “Player augmenté par la post-production”.
- Ajout d'un parcours en 4 étapes :
  1. Regarder ;
  2. Comprendre ;
  3. Réviser ;
  4. Questionner.
- Les étapes expliquent le rôle des chapitres, transcript, SmartBoard, mindmap, quiz et forum.
- Correction : le bouton “Questionner” ouvre `activePanel='questions'`, pas un onglet fantôme.

## Captures / état de preuve

Des captures ont été générées dans :

`artifacts/liri-cours-player-redesign/`

Attention : certaines captures automatiques ont montré un loader ou une page login parce que le contexte Playwright ne récupérait pas correctement la session utilisateur. Pour les prochaines preuves, préférer :

1. ouvrir Chrome déjà connecté ;
2. naviguer manuellement vers `/liri/formations` ;
3. ou injecter une session Supabase complète avec tenant slug `isna` et vérifier que les appels API partent avec `X-Tenant-Slug: isna`.

## Fichiers principaux modifiés à relire

- `apps/app/src/components/liri/liri-live/GuestPermissionBar.jsx`
- `apps/app/src/pages/school/student-school-life/StudentFormationsOsPage.jsx`
- `apps/app/src/components/school/formations/CoursePlayerInterface.jsx`
- `apps/app/src/contexts/BillingContext.jsx`
- `apps/app/src/pages/liri/LiriAccountPage.tsx`
- `apps/app/src/components/liri/TierAccessPanel.jsx`
- `apps/api/src/checkout/subscription-renewal.service.ts`

## Vérifications déjà passées

```bash
npm run build -w @isna/app
```

Passé après les corrections live, Mes cours et player.

```bash
npm run build -w @isna/api
```

Passé après les corrections paiement/renouvellement.

## À continuer ensuite

1. Vérifier visuellement `/liri/formations` avec un vrai compte connecté.
2. Ouvrir un cours réel avec contenu post-production et vérifier :
   - bandeau “Player augmenté…” ;
   - étapes Regarder/Comprendre/Réviser/Questionner ;
   - SmartBoard overlay ;
   - mindmap/quiz ;
   - panneau questions.
3. Finaliser captures écran propres pour validation utilisateur.
4. Vérifier le live immersif bout à bout :
   - hôte démarre ;
   - membre rejoint ;
   - membre admis ;
   - micro/caméra activables ;
   - messagerie reste disponible ;
   - quitter termine proprement la séance.
5. Continuer le tunnel de vente Liri Portail, pas l'ancienne route paiement :
   - inscription ;
   - paiement Stripe intégré ;
   - confirmation email/notification ;
   - activation espace élève ;
   - dossier d'admission ;
   - renouvellement mensuel ;
   - tentative échouée / grâce / relance.

## Phrase directrice pour Claude

Ne construis pas une “page”. Construis un moteur de navigation pédagogique intelligent : l'élève arrive dans un espace calme, demande, comprend où il en est, regarde, révise, pose une question, et Liri garde la mémoire du chemin.
