# MEDOS Production — Final Setup Checklist

Tout ce qui demande **une action manuelle** côté Ngowazulu (Hostinger, LiveKit Cloud, etc.) pour finaliser la prod.

---

## 1. DNS Hostinger — Custom domains pour med-app et patient-portal

**Pourquoi :** aujourd'hui les apps sont sur `https://med-app-cimolace.vercel.app` (laid en démo). Vercel a déjà préparé `med.cimolace.space` et `patient.cimolace.space` côté projets, manquent les A records DNS.

### Étapes Hostinger

1. Connecte-toi sur **Hostinger > Domaines > cimolace.space > DNS Zone**
2. **Ajouter 2 enregistrements A** :

   | Type | Nom | Valeur | TTL |
   |------|-----|--------|-----|
   | A | `med` | `76.76.21.21` | 14400 |
   | A | `patient` | `76.76.21.21` | 14400 |

3. **Sauvegarde**. Propagation DNS : 5-30 min.

### Vérification

```bash
# Doit retourner 76.76.21.21
dig med.cimolace.space +short
dig patient.cimolace.space +short

# Doit retourner un 200 (Vercel auto-renouvelle le SSL)
curl -I https://med.cimolace.space
curl -I https://patient.cimolace.space
```

### Côté Vercel (si pas déjà fait)

Pour activer les domaines une fois les A records propagés :

```bash
# Une seule fois, depuis le répertoire concerné
cd apps/med-app && vercel domains add med.cimolace.space --scope cimolace
cd apps/patient-portal && vercel domains add patient.cimolace.space --scope cimolace
```

Vercel détecte automatiquement les A records et délivre le certificat SSL Let's Encrypt.

---

## 2. LiveKit Cloud — Webhook URL configuration

**Pourquoi :** le code de la session Liri se ferme tout seul quand LiveKit envoie un event `room_finished`. Sans webhook configuré côté LiveKit Cloud, les events ne partent jamais → les sessions restent ouvertes → billing minutes ne se calcule pas.

### Étapes LiveKit Cloud

1. Connecte-toi sur **https://cloud.livekit.io** (compte associé au project Cimolace)
2. Va dans **Settings > Webhooks**
3. **Add Endpoint** :

   - **URL** : `https://api.cimolace.space/webhooks/livekit`
   - **Events sélectionnés** (tous nécessaires pour le billing + replays) :
     - ✅ `room_finished`
     - ✅ `room_stopped`
     - ✅ `participant_joined`
     - ✅ `participant_left`
     - ✅ `egress_started`
     - ✅ `egress_updated`
     - ✅ `egress_ended`

4. **Save**. LiveKit signe les webhooks avec ton `LIVEKIT_API_SECRET` — déjà configuré côté Cloud Run, rien d'autre à faire.

### Vérification

Après configuration, lance une téléconsultation depuis MEDOS, ferme l'onglet pendant l'appel, attends 30 sec, puis :

```sql
SELECT id, purpose, started_at, ended_at, duration_seconds
FROM liri_sessions
ORDER BY started_at DESC
LIMIT 5;
```

Tu dois voir une ligne avec `ended_at` non-null et `duration_seconds` calculé.

---

## 3. Comptes patients connectables (déjà fait — 2026-05-29)

**Status :** ✅ Done via `/tmp/medos-migrate/create-demo-patient-users.mjs`

| Email | Mot de passe | Patient lié |
|---|---|---|
| `marie.dupont@demo.test` | `DemoPatient2026!` | Marie Dupont |
| `thomas.martin@demo.test` | `DemoPatient2026!` | Thomas Martin |
| `sophie.bernard@demo.test` | `DemoPatient2026!` | Sophie Bernard |
| `karim.benali@demo.test` | `DemoPatient2026!` | Karim Ben Ali |

Tous peuvent se logger sur `https://patient-portal-cimolace.vercel.app` (ou `https://patient.cimolace.space` une fois le DNS propagé).

Marie est la plus riche pour la démo : 14 jours santé, 1 ordonnance, 1 programme assigné, 1 thread messagerie, 2 RDV.

---

## 4. URLs finales prod (référence)

| Service | URL actuelle | URL finale (après DNS) |
|---|---|---|
| API NestJS | `https://api.cimolace.space` | (inchangé) |
| Public site | `https://cimolace.space` | (inchangé) |
| Doc dev | `https://cimolace.space/medos/integration` | (inchangé) |
| Demo widget | `https://cimolace.space/medos/v1/demo.html` | (inchangé) |
| Med-app (docteur) | `https://med-app-cimolace.vercel.app` | `https://med.cimolace.space` |
| Patient portal | `https://patient-portal-cimolace.vercel.app` | `https://patient.cimolace.space` |
| Admin Cimolace | `https://cimolace.space/app` *(à confirmer)* | (inchangé) |

---

## 5. Comptes admin / staff prod

| Rôle | Email | Password |
|---|---|---|
| Demo doctor MEDOS | `demo-medos-1779970333@cimolace.space` | `DemoMedos2026!` |
| Demo patient (legacy) | `demo-patient-zahir@cimolace.space` | `DemoPatient2026!` |
| Demo patients (seedés) | voir §3 | `DemoPatient2026!` |

---

## 6. Pour relancer un test E2E complet

```bash
# Tous les endpoints API
node /tmp/medos-migrate/e2e-p0-p4.mjs

# Widget embed flow
node /tmp/medos-migrate/e2e-widget-embed.mjs

# Liri + Mbolo
node /tmp/medos-migrate/e2e-liri-mbolo.mjs
```

Si tout retourne 200 / route présente, prod prête pour démo.

---

*Document généré à la fin de la session 2026-05-29.*
