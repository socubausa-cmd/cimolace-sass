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

Non configurées à ce stade. macOS exigera un certificat Apple Developer pour
éviter l'avertissement Gatekeeper au premier lancement ; Windows, un certificat
de signature de code pour éviter l'écran SmartScreen. Sans eux, les binaires
fonctionnent mais l'utilisateur doit confirmer une alerte à la première
ouverture.
