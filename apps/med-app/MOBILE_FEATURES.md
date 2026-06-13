# Mobile native features (Capacitor wrap)

Trois plugins natifs essentiels intégrés dans `apps/med-app/` — exposés via 3
hooks React dans `src/native/`. Tous les hooks gardent une compatibilité web
(noop ou fallback) pour ne jamais bloquer le build / les tests Vite.

## Packages

| Plugin            | npm                                            | Version |
| ----------------- | ---------------------------------------------- | ------- |
| Push notifications | `@capacitor/push-notifications`               | ^8      |
| Camera             | `@capacitor/camera`                           | ^8      |
| Biometric auth     | `@aparajita/capacitor-biometric-auth` (\*)    | ^10     |

(\*) Le package `@capacitor-community/biometric-auth` n'existe plus sur npm
(repo archivé). `@aparajita/capacitor-biometric-auth` est le remplaçant
maintenu, avec la même API.

Configuration : voir `capacitor.config.ts`, section `plugins`.

## Hooks

### `usePush()` — `src/native/usePush.ts`
```ts
const { token, lastNotification, permission, requestPermission, isNative } = usePush();
```
- `requestPermission()` déclenche le prompt iOS/Android et appelle
  `PushNotifications.register()` si accordé.
- `token` (APNS sur iOS, FCM sur Android) est rempli via le listener
  `registration`.
- `lastNotification` est mise à jour pour les events foreground
  (`pushNotificationReceived`) et action (`pushNotificationActionPerformed`).
- Sur web : `isNative=false`, `requestPermission()` renvoie `'denied'`.

### `useCamera()` — `src/native/useCamera.ts`
```ts
const { takePhoto, busy, error, isNative } = useCamera();
const file = await takePhoto({ quality: 85, filename: 'bilan.jpg' });
```
- Sur natif : `Camera.getPhoto({ resultType: DataUrl })`, converti en `File`
  prêt à `FormData` (cible : `POST /documents/upload`).
- Sur web : fallback `<input type="file" accept="image/*" capture="environment">`
  pour ouvrir la caméra sur mobile-Safari/Chrome.
- Utilisé dans `LabReaderPanel` (bouton "Prendre une photo du bilan").

### `useBiometric()` — `src/native/useBiometric.ts`
```ts
const { authenticate, isAvailable, isNative, lastError } = useBiometric();
if (await isAvailable()) {
  const ok = await authenticate('Confirmer l\'accès au dossier patient');
}
```
- `authenticate(reason)` ouvre FaceID/TouchID/Android Biometric — fallback
  PIN/passcode appareil grâce à `allowDeviceCredential: true`
  (`capacitor.config.ts`).
- Renvoie `true` / `false` (jamais throw) pour gate facilement un écran.

## Activation côté backend — push (TODO)

1. **iOS** : créer une clé APNS (.p8) dans Apple Developer, l'enregistrer
   dans Firebase Console (Cloud Messaging → Apple app config) ou dans le
   provider push direct.
2. **Android** : ajouter `google-services.json` dans `android/app/` (FCM).
3. **Backend** : ajouter un endpoint
   `POST /api/devices/register { token, platform, user_id }`
   et envoyer le `token` retourné par `usePush()` côté client après
   authentification.
4. **Send** : utiliser FCM HTTP v1 (Google) ou un service unifié
   (OneSignal, Knock) — payload doit inclure `notification.title/body` et
   `data` (deep links, ex: `{ "screen": "twin", "patientId": "..." }`).
5. **iOS prod** : Push Notifications capability + Background Modes
   (Remote notifications) activés dans Xcode après `npx cap sync ios`.

## Sync natif

Après modification de `capacitor.config.ts` ou ajout de plugin :
```bash
cd apps/med-app
pnpm run build         # vite build → dist/
npx cap sync           # copie dist/ + installe les plugins natifs
npx cap open ios       # ouvre Xcode pour signer / pousser
npx cap open android   # ouvre Android Studio
```

> **Note** : `cap sync` n'a pas été exécuté lors de l'installation des
> plugins — à faire avant le prochain build mobile.
