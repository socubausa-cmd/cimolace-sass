# Messagerie élève — temps réel : décision technique (2026-06-14)

App concernée : `apps/app` (coque LIRI élève `/m/eleve/messages/*`).
Hook : `apps/app/src/hooks/useRealtimeMessaging.js` (consommé via `MessagingContext`).

## Contexte vérifié en prod (Supabase `fwfupxvmwtxbtbjdeqvu`, le 2026-06-14)

Schéma RÉEL de `public.messages` (vérifié au `psql`, ≠ migration `20260521000033_chat_messaging.sql` qui est **périmée**) :

```
id, tenant_id (NN), conversation_id (NN), sender_id (NN),
recipient_id (null), subject (null), content (NN),
is_read (null), read_at (null), created_at (null)
```

→ Modèle **CONVERSATION** (`conversation_id` + `recipient_id`), **pas** un DM plat avec `receiver_id`.

État RLS / realtime des 3 tables (`messages`, `conversations`, `conversation_participants`) :

| Fait | Valeur |
|------|--------|
| RLS activé | oui, sur les 3 |
| Policies sur `public.messages` | **0** (aucune) → `authenticated`/`anon` ne peut NI lire NI écrire en direct |
| Présence dans la publication `supabase_realtime` | **non** → Realtime n'émettrait **rien** |
| `REPLICA IDENTITY` | `default` (pas `full`) |
| Lignes dans `messages` | **0** (la feature n'a jamais persisté un message) |

La seule voie d'accès fonctionnelle est l'**API NestJS** (`service_role`) : `POST /messaging/send`,
`GET /messaging/conversations`, `GET /messaging/conversations/:id`. C'est pourquoi `supabaseCompat.ts`
route `from('messages')` → `messagingApi`, et que `supabase.channel()` y est un **no-op** (`ChannelStub`).

L'API est cohérente avec le schéma prod (RPC `find_or_create_conversation(tenant,user1,user2)→jsonb`,
`conversations.name/type`, `conversation_participants` sans `left_at`).

## Pourquoi le correctif « p4 » précédent était faux

Il basculait `messages` vers le vrai client Supabase + ajoutait une colonne `receiver_id` + des policies DM.
Or (a) le vrai client lirait **0 ligne** (aucune policy SELECT), et (b) `receiver_id` n'existe pas — la
colonne réelle est `recipient_id`. → casse. Le hook restant était d'ailleurs codé en **DM plat**
(`receiver_id`, `insert({sender_id,receiver_id})`), incompatible avec le contrat conversation de l'API.

## Options évaluées

**(a) Supabase Realtime côté client.** Exigerait, pour émettre quoi que ce soit sous le JWT `authenticated` :
1. `ALTER PUBLICATION supabase_realtime ADD TABLE public.messages`
2. `ALTER TABLE public.messages REPLICA IDENTITY FULL`
3. une policy `SELECT` `authenticated` (`sender_id = auth.uid() OR recipient_id = auth.uid()`)

→ Cela **ouvre en lecture directe** une table aujourd'hui 100 % `service_role` : changement du modèle de
menace, contournement de l'API comme source de vérité unique, et migration DB à appliquer en prod. Risque
élevé pour un gain de latence marginal. **À valider avec l'équipe — non retenu pour l'instant.**

**(b) Polling court via l'API NestJS.** Aucune modif de schéma / policy / publication. L'API est déjà la
source de vérité et fonctionne (`service_role`). On interroge `/messaging` de façon **adaptative** pour un
rendu quasi-temps-réel. Changement **frontend uniquement** (un seul déploiement, Vercel).

## Décision : **option (b)**

Le moins risqué, aligné « l'API est la source de vérité ». Aucune policy RLS cliente n'est introduite sur
une table jusque-là 100 % `service_role`.

### Cadence de polling (dans `useRealtimeMessaging.js`)

- **Fil ouvert** (conversation active), onglet visible : poll **5 s** d'UNE conversation (1 requête).
- **Liste / badges non-lus**, onglet visible : refresh complet toutes les **20 s**.
- **Onglet caché** : refresh complet ralenti (~60 s).
- **`focus` / `visibilitychange→visible`** : refresh immédiat.
- **Backoff réseau** : après 3 échecs consécutifs, pause de 120 s (repris de l'existant).

### Alignement du hook sur le contrat réel

- Lecture : `messagingApi.listConversations()` puis `getConversation(id)` par conversation ; on aplatit en
  liste de messages et on **mappe `recipient_id` → `receiver_id`** pour conserver le contrat public du hook
  (les écrans `Eleve*` et `MessagingPage` consomment `{ sender_id, receiver_id, content, is_read, created_at }`
  et des conversations dérivées `{ participantId, unreadCount, lastMessage, … }`).
- Envoi : `messagingApi.send({ recipientId, content })` (la conversation est créée côté serveur via
  `find_or_create_conversation`).
- `markAsRead` / `deleteMessage` / `editMessage` : **optimistes locaux** (pas d'endpoint API dédié à ce jour).
  Persistance serveur = travail futur (ajouter les routes NestJS correspondantes). Des « overrides » locaux
  évitent que le polling ne réannule l'état optimiste pendant la session.

## Hors-scope (volontaire)

- Aucune migration SQL appliquée. Aucun changement à l'API NestJS. Aucun changement au routage
  `messages → messagingApi` de `supabaseCompat.ts`.
- Si un vrai push temps-réel devient nécessaire plus tard : préférer un **SSE/WebSocket côté API NestJS**
  (la source de vérité reste l'API), plutôt que d'ouvrir une policy RLS cliente (option (a)).
