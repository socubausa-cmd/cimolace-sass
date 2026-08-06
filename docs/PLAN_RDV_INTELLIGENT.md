# Plan — Un système de rendez-vous qui VOIT

> ⚠️ **ADDENDUM (2026-08-06, soir) — le diagnostic ci-dessous date du matin, et une
> partie du P0 a été livrée EN PRODUCTION dans la journée par une session parallèle**
> (commits `393952e9`, `c649aad8`, `8d6b145d`, déployés 16:42→18:08) :
> · la table de journal existe : **`appointment_events`** (migration 20260806120000,
>   RLS staff cloisonnée par `tenant_memberships`) — c'est LA table du chantier, ne pas
>   créer de `booking_events` concurrente ;
> · **la cloche est réparée** : `LiriBell.jsx` (compteur non-lus, temps réel, marque-lu)
>   montée dans les DEUX topbars — le portail ET l'Accueil, qui a sa propre barre ;
> · **`applyReschedule` referme la boucle** du chemin `/replanifier/:token` : rendez-vous
>   confirmé, invitation acceptée, événement journalisé, `notifyStaff()` (fan-out
>   owner/admin/secrétariat) ;
> · la timeline lit `GET /booking/appointments/:id/events`.
>
> **Ce qui reste du P0**, en cours dans cette session : `respondInvitation` (le second
> point d'entrée, POST /booking/invitations/respond) refermé sur les MÊMES rails —
> helpers `logAppointmentEvent`/`notifyStaff` réutilisés, et la migration
> 20260806160000 (⛔ écrite, pas appliquée) qui élargit en SURENSEMBLE la contrainte
> `kind` (liste fermée : tout kind inconnu est rejeté en silence, perte muette) avec
> `client_responded` et `reschedule_declined`. Les sections P1/P2 restent valables.

> Demande du fondateur (2026-08-06) : « les rendez-vous que j'ai renvoyés, le report reste
> encore inchangé. Le système n'est pas intelligent : pas d'historique, pas de mise à jour,
> rendez-vous reporté pour voir si le client a renvoyé, etc. Le système est aveugle.
> Et l'icône de notification ne notifie rien, c'est muet. »
>
> Le diagnostic ci-dessous est MESURÉ dans le code, pas supposé. Chaque affirmation cite
> son fichier.

## 1. Pourquoi le système est aveugle — l'état des lieux

**La boucle du report ne se referme jamais.** Quand le client clique le lien de report et
choisit un créneau, `respondInvitation` (`apps/api/src/booking/booking-advanced.service.ts:293-324`)
écrit `accepted_at` **dans la table `booking_invitations` — et c'est tout**. Il ne touche
pas au rendez-vous lui-même (ni sa date, ni son statut), n'écrit aucune notification,
n'envoie aucun e-mail à l'accueil. Côté `/liri/rdv`, le rendez-vous reste donc
« À confirmer » à son ancienne date, comme si rien ne s'était passé. C'est exactement le
symptôme observé.

**La cloche est bien plombée, mais personne ne sonne.** `LiriBell`
(`apps/app/src/components/liri/LiriBell.jsx`) lit la table `notifications` filtrée par
`user_id`, avec du temps réel — la plomberie est saine. Mais `booking.service.ts` n'écrit
des notifications que vers le **demandeur** (l'élève, lignes 265/344/448), jamais vers
**l'administrateur**. Une demande de Séance de prière venue de prorascience.org n'a même
pas de compte demandeur : personne ne reçoit rien. La cloche est muette parce qu'aucun
émetteur ne lui parle.

**La timeline existe déjà à moitié.** `LiriRdvAdminPage.jsx` porte déjà l'interface d'un
historique (« timeline », rechargée après chaque action, ligne 171) et même le statut
« Client a reprogrammé » (`client_responded`, ligne 71). Mais l'API ne produit pas les
événements qui la nourriraient, et la version déployée du front est antérieure. L'écran
sait afficher une mémoire que le moteur n'écrit pas.

**Ce qui existe et se réutilise** (rien de tout cela n'est à construire) :
`appointments` + `booking_invitations` + `booking_reschedule_requests` + satisfaction ·
`email_queue` → worker `isna-worker` → Resend (sender du tenant) · `notifications` + RLS +
temps réel · l'accusé vers `notify_email` (infos@prorascience.org) · WhatsApp Cloud API
avec le gabarit `rdv_notification` · export ICS (`buildICS`, jamais branché aux e-mails).

## 2. Phase 0 — Refermer la boucle du report *(le système voit)*

C'est la phase qui fait disparaître le symptôme. Petite en volume, entièrement dans
`booking-advanced.service.ts` + une migration.

1. **`respondInvitation` termine son travail.** À l'acceptation d'un créneau :
   - le rendez-vous est **réécrit** (nouvelle date, statut `confirmed`, horodaté) ;
   - un événement d'historique est consigné (cf. point 3) ;
   - l'accueil est prévenu : notification (cloche) **et** e-mail à `notify_email`,
     WhatsApp si activé ;
   - au refus : statut `reschedule_declined` visible, mêmes signaux.
2. **Chaque demande entrante notifie l'accueil.** Nouvelle demande publique → une ligne
   `notifications` pour le(s) compte(s) staff du tenant + l'e-mail existant. La cloche
   sonne enfin pour ce qu'elle devait signaler depuis le début.
3. **Une mémoire : `booking_events`.** Table `(appointment_id, type, acteur, payload,
   created_at)` alimentée par TOUTES les actions : demande créée, confirmée, refusée,
   report envoyé, **lien ouvert**, client a répondu, relance, annulation. La timeline du
   front la lit telle quelle — l'écran existe déjà.
4. **Déployer le front `/liri/rdv` refondu** (worktree + vercel, le chemin habituel) pour
   que la timeline et les statuts soient visibles en production.

## 3. Phase 1 — Le système devient intelligent *(il suit et relance)*

1. **Des onglets qui disent la vérité** : À confirmer · Confirmés · **Report envoyé —
   en attente client** · **Client a répondu** · Refusés · Annulés · Expirés. Aujourd'hui
   un report envoyé reste mélangé aux « À confirmer », c'est ce qui rend l'écran illisible.
2. **Suivi d'ouverture du lien** : l'ouverture de `/replanifier/:token` écrit un événement
   `lien_ouvert`. On distingue enfin « n'a pas vu » de « a vu et n'a pas répondu ».
3. **Relances automatiques** : sans réponse à J+2, relance e-mail (worker + `email_queue`,
   tout existe) ; expiration propre du lien à J+7 avec passage du RDV en « Expiré ».
4. **Rappels avant séance** : J-1 et H-1, e-mail + WhatsApp (`rdv_notification` est déjà
   approuvé). Le no-show baisse, c'est le premier gain économique du chantier.
5. **ICS joint** aux confirmations : `buildICS` existe, il n'est jamais attaché.

## 4. Phase 2 — Le confort d'organisation

1. **Vue calendrier semaine** à côté de la liste : les créneaux occupés, glisser un RDV
   pour proposer un report (le panneau de dispo `booking_availability` pilote déjà les
   créneaux).
2. **Annulation avec motif** (e-mail automatique au client), **confirmation en lot**,
   recherche par nom/e-mail, filtre par service.
3. **Fiche client** : tous les RDV d'une même personne, reliés au CRM existant — l'accueil
   voit qu'un demandeur en est à sa troisième demande.
4. **Cloche** : notifications navigateur optionnelles (permission demandée, jamais
   imposée) pour l'accueil qui n'a pas l'onglet ouvert.

## 5. Ordre conseillé et effort

| Phase | Contenu | Effort | Dépend de |
|---|---|---|---|
| **P0** | boucle refermée + cloche émettrice + `booking_events` + déploiement front | 1 séance | rien |
| **P1** | onglets vrais + ouverture de lien + relances + rappels + ICS | 1-2 séances | P0 (les événements) |
| **P2** | calendrier + lots + fiche client + notifs navigateur | 2 séances | P1 |

Tout s'appuie sur l'existant — aucune nouvelle infrastructure, aucun nouveau fournisseur.
La règle du chantier reste celle du dépôt : chaque action écrit son événement (pas de
mémoire silencieuse), chaque signal part par les canaux déjà en place, et rien ne
s'annonce à l'écran qui ne soit réellement produit par le moteur.
