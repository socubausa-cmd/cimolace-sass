# LIRI mobile — mise en boutique (Google Play / App Store)

État au 25 juillet 2026. Compte EAS `cimolace`, projet `mobile`
(`c706a25c-bd5c-4b33-836c-8a54d424c9ec`), identifiant d'app `org.prorascience.liri`
sur les deux plateformes.

## Ce qui est prêt côté code

- Identité LIRI complète : icône iOS 1024² **sans canal alpha** (l'App Store
  rejette l'alpha), icône adaptive Android (foreground + background `#262624` +
  monochrome pour les thèmes Android 13+), splash, favicon — tous générés depuis
  la marque officielle par `.gen-app-icons.mjs` à la racine du dépôt.
- `expo-doctor` : 18/18. `tsc` : 0 erreur. `eslint` : 0 avertissement.
- Chiffrement : `ITSAppUsesNonExemptEncryption: false` déjà déclaré → pas de
  formulaire export à remplir à chaque envoi TestFlight.
- Permissions Android demandées (toutes justifiées par les lives LiveKit) :
  `CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `BLUETOOTH*`,
  `FOREGROUND_SERVICE`, `WAKE_LOCK`, `SYSTEM_ALERT_WINDOW`, `INTERNET`,
  `ACCESS_NETWORK_STATE`, `VIBRATE`, `READ/WRITE_EXTERNAL_STORAGE`.
  Aucune ne déclenche de formulaire de déclaration Play.

## Profils de build (`eas.json`)

| Profil | Android | iOS | Usage |
|---|---|---|---|
| `development` | APK dev client | simulateur | debug avec Metro |
| `preview` | APK | simulateur | vérification rapide, **aucun compte Apple requis** |
| `device` | APK | **iPhone réel** (ad hoc) | test sur appareil, compte Apple requis |
| `production` | AAB | build boutique | envoi en boutique |

```bash
npx eas-cli build --platform android --profile preview   # APK testable tout de suite
npx eas-cli build --platform ios --profile device        # iPhone réel (compte Apple)
```

## Android — Google Play

Prérequis à faire côté fondateur (une fois) :

1. Compte **Google Play Console** (25 $ une seule fois) et création de la fiche
   `org.prorascience.liri`.
2. Compte de service Google Cloud avec le rôle *Service Account User* sur la
   console, clé JSON téléchargée.
3. Rattacher la clé à EAS :

```bash
npx eas-cli credentials
```

Puis, à chaque version :

```bash
npx eas-cli build --platform android --profile production
npx eas-cli submit --platform android --latest
```

`submit.production.android` est réglé sur la piste **internal** en
**brouillon** : rien ne part au public tant que la fiche n'est pas validée
manuellement dans la console.

## iOS — App Store

**Le compte Apple Developer existe** (contrat signé le 27 juillet 2026, identifiant
`manikongo5@icloud.com`). L'iPhone réel et TestFlight sont donc débloqués.

⚠️ Toutes les étapes ci-dessous demandent de **s'authentifier auprès d'Apple** :
c'est à toi de les lancer, je ne saisis pas d'identifiants.

### Installer sur ton iPhone

```bash
npx eas-cli device:create        # enregistre l'appareil (QR code à scanner)
npx eas-cli build --platform ios --profile device
```

### TestFlight puis App Store

1. Créer l'app dans App Store Connect avec le bundle `org.prorascience.liri`.
2. `npx eas-cli build --platform ios --profile production`
3. `npx eas-cli submit --platform ios --latest`

`eas submit` demande l'identifiant Apple, le Team ID et l'ascAppId à la
première exécution puis les mémorise. Ils ne sont **pas** écrits dans le
dépôt.


```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --latest
```

Éléments que les deux boutiques réclament et qui **ne sont pas** dans le dépôt :
captures d'écran par taille d'appareil, description, mots-clés, catégorie,
politique de confidentialité en ligne, et pour Apple le questionnaire
« App Privacy » (l'app collecte e-mail + contenus pédagogiques via Supabase).

## Vérifier un artefact avant de l'envoyer

La configuration résolue n'est pas ce qui est livré — `expo config --type
introspect` a annoncé un `UIBackgroundModes` que le `.app` produit n'avait pas.
Inspecter le binaire :

```bash
tar -xzf build.tar.gz && plutil -p LIRI.app/Info.plist | grep -i backgroundmodes
```

```bash
~/Library/Android/sdk/build-tools/*/aapt2 dump permissions build.apk
```

## Régénérer les icônes

```bash
node .gen-app-icons.mjs
```

Source : `liri logo officielle2.png` à la racine du dépôt. Le script recadre la
marque seule (il écarte le wordmark « LIRI » sous la marque), la pose sur le
fond LIRI `#262624` et écrit les six fichiers dans `assets/images/`.
