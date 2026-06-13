# ISNA Med — Capacitor (iOS + Android natifs)

L'app med-app (Vite + React) est encapsulée dans Capacitor pour produire des binaires
iOS et Android sans dupliquer le code frontend.

## Mode hybride (live update)

Le `capacitor.config.ts` pointe `server.url` vers `https://med.cimolace.space`.
Le web view des apps natives charge donc directement la version en production —
**pas besoin de rebuilder l'app native** à chaque MAJ frontend, il suffit de
déployer le site.

Le bundle local (`dist/`) sert uniquement de fallback / écran de démarrage.

## Builder iOS

Prérequis : macOS + Xcode installé + un compte développeur Apple.

```bash
cd apps/med-app
pnpm cap:ios     # ouvre le projet Xcode
```

Dans Xcode : sélectionner un simulateur ou un device, puis Run.

## Builder Android

Prérequis : Android Studio + Android SDK + Java (JDK 17+).

```bash
cd apps/med-app
pnpm cap:android # ouvre le projet Android Studio
```

Dans Android Studio : sélectionner un AVD ou un device, puis Run.

> Note : à la génération initiale, `gradle sync` peut échouer si Java n'est pas
> installé localement. Android Studio le résout automatiquement à l'ouverture
> du projet.

## Re-synchroniser après un changement de config

Si on modifie `capacitor.config.ts` ou qu'on ajoute un plugin Capacitor :

```bash
cd apps/med-app
pnpm cap:sync    # vite build + cap sync ios/android
```

## Publication

- iOS : Archive depuis Xcode → App Store Connect (bundle id `space.cimolace.med`).
- Android : Build → Generate Signed Bundle / APK → Google Play Console
  (application id `space.cimolace.med`).
