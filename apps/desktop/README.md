# LIRI — application de bureau (macOS, Windows)

Coque Electron autour du portail LIRI. Fidèle au web **par construction** :
elle charge le portail déployé, elle n'en embarque pas une copie.

## Pourquoi charger le portail plutôt que l'embarquer

Un paquet contenant `apps/app/dist` serait périmé au déploiement suivant : il
faudrait publier une version de l'application de bureau à chaque mise en ligne
du front. Et il ne servirait à rien hors ligne de toute façon, puisque toutes
les données viennent de l'API.

Charger l'URL garde donc les deux surfaces alignées sans effort, pour toujours.

## Ce que la coque apporte face à un simple onglet

- présence dans le dock et la barre des tâches, avec l'icône LIRI ;
- fenêtre sans barre d'adresse ni onglets ;
- instance unique — un second lancement réveille la fenêtre existante ;
- menus natifs en français, avec « Retour à l'accueil » (`Cmd/Ctrl+Shift+H`) ;
- taille et position de la fenêtre mémorisées entre deux sessions ;
- liens externes ouverts dans le navigateur du système ;
- écran « Portail injoignable » aux couleurs LIRI au lieu d'une page d'erreur
  de navigateur.

## Sécurité

`contextIsolation` activé, `nodeIntegration` désactivé, `sandbox` activé : la
page n'a aucun pont vers Node. La navigation interne est restreinte à l'origine
du portail et à `accounts.google.com` (connexion Google) ; toute autre URL part
dans le navigateur du système, pour que la coque ne devienne pas un navigateur
généraliste.

## Construire

```bash
cd apps/desktop && npm install
npm run icons        # régénère .icns / .ico / .png depuis la marque officielle
npm run build:mac    # dmg + zip, arm64 et x64
npm run build:win    # nsis + portable, x64
```

Les artefacts atterrissent dans `release/`.

⚠️ **Le binaire Windows peut être produit depuis macOS, mais pas exécuté ici.**
Sa validation demande une machine Windows. Ce qui est vérifiable depuis le Mac :
que l'artefact se génère, sa taille, et que l'icône `.ico` est bien intégrée.

## Pointer vers un autre portail

L'URL par défaut est `https://app.prorascience.org`. Pour un autre tenant :

```bash
LIRI_PORTAL_URL=https://portail.exemple.org npm start
```

Pour figer la valeur dans un paquet distribué, remplacer la constante
`PORTAL_URL` de `src/main.js` — un tenant = un binaire, comme pour le mobile où
le slug est figé à la compilation.

## Signature et distribution

Le **câblage est en place** (`hardenedRuntime` + entitlements + hook de
notarisation `scripts/notarize.cjs`, tout gaté par variables d'env — **aucun
secret dans le dépôt**). Il ne reste qu'à fournir les certificats : dès qu'ils
sont posés en env, le même `npm run build:*` signe, notarise et agrafe.

### macOS — signature « Developer ID » + notarisation

Prérequis (une fois) :
1. **Apple Developer Program** (99 $/an) → dans Xcode/Trousseau, un certificat
   **« Developer ID Application »**. Exporte-le en `.p12` (avec mot de passe).
2. **Mot de passe pour app** : [appleid.apple.com](https://appleid.apple.com) →
   Connexion et sécurité → Mots de passe pour app.
3. **Team ID** (10 caractères) : [developer.apple.com](https://developer.apple.com/account) → Membership.

Puis, à chaque build de distribution :

```bash
export CSC_LINK="/chemin/DeveloperID.p12"      # ou base64 du .p12
export CSC_KEY_PASSWORD="motdepasse-du-p12"
export APPLE_ID="ton@appleid.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"
npm run build:mac        # signe (hardened runtime + entitlements) → notarise → agrafe
```

Vérifier :

```bash
codesign --verify --deep --strict --verbose=2 "release/mac-arm64/LIRI.app"
spctl -a -vvv -t install "release/LIRI-1.0.0-arm64.dmg"   # → "accepted … Notarized Developer ID"
xcrun stapler validate "release/mac-arm64/LIRI.app"
```

### Windows — signature de code

#### Option A (recommandée) — Azure Trusted Signing, **câblée** (`npm run build:win:azure`)

Aucun certificat `.pfx` à acheter ni à stocker : Microsoft détient le certificat,
tu signes via ton identité Entra. Le wrapper `scripts/build-win.cjs` est déjà en
place et **gaté par env** — sans les variables, il produit un build non signé.

Mise en place Azure (une fois) :
1. **Trusted Signing Account** + **Certificate Profile** dans le portail Azure
   (Marketplace → « Trusted Signing »). Note l'**endpoint régional**
   (`https://<region>.codesigning.azure.net/`), le **nom du compte** et le **nom du profil**.
2. **Validation d'identité** du profil (l'organisation « Cimolace » doit être validée par Microsoft — quelques jours).
3. **App Entra (service principal)** + rôle **« Trusted Signing Certificate Profile Signer »**
   sur le compte → récupère `TenantId`, `ClientId`, un `ClientSecret`.

Puis, **sur Windows** (poste ou CI — voir plus bas) :

```bash
# Coordonnées du compte (non secrètes)
export AZURE_TS_ENDPOINT="https://weu.codesigning.azure.net/"
export AZURE_TS_ACCOUNT="cimolace-signing"
export AZURE_TS_CERT_PROFILE="cimolace-profile"
export WIN_PUBLISHER_NAME="Cimolace"
# Authentification Entra (secrète)
export AZURE_TENANT_ID="…"  AZURE_CLIENT_ID="…"  AZURE_CLIENT_SECRET="…"
npm run build:win:azure     # build + signature Azure Trusted Signing
```

⚠️ La signature Azure passe par **PowerShell + le module `TrustedSigning` + signtool** :
elle s'exécute **sous Windows** (poste Windows ou **runner CI Windows**), pas depuis
ce Mac. Depuis macOS, `build:win:azure` produit le binaire **non signé**.

#### Option B — certificat OV/EV classique (`.pfx`)

```bash
export WIN_CSC_LINK="/chemin/cert.pfx"      # ou base64
export WIN_CSC_KEY_PASSWORD="motdepasse"
npm run build:win
```

Vérifier (sur Windows) : `signtool verify /pa /v "release\LIRI Setup 1.0.0.exe"`.

#### Construire/signer Windows sans machine Windows → CI

Comme tu es sur Mac, le plus simple pour signer Windows est un **runner CI Windows**.
Un modèle prêt à l'emploi est fourni : **`ci/desktop-release.yml`** — copie-le dans
`.github/workflows/`, ajoute les secrets (Apple + Azure) au dépôt, puis pousse un tag
`desktop-v*`. Il build+signe macOS **et** Windows et publie les artefacts.

⚠️ Le binaire Windows peut être **produit** depuis ce Mac mais pas **exécuté** ni
signé ici : signature + validation demandent Windows.

### En attendant les certificats (intérim)

Les binaires non signés **fonctionnent**, l'utilisateur doit juste confirmer une alerte :
- **macOS** : clic droit sur l'app → *Ouvrir* → *Ouvrir* ; ou
  `xattr -dr com.apple.quarantine "/Applications/LIRI.app"`.
- **Windows** : sur l'écran SmartScreen → *Informations complémentaires* → *Exécuter quand même*.

### Mise à jour automatique (plus tard)

electron-builder génère déjà `latest-mac.yml` / `latest.yml`. Pour activer
l'auto-update (`electron-updater`), définir un bloc `publish` (generic/S3/GitHub
Releases) et héberger les artefacts + `.yml`. Hors périmètre à ce stade.
