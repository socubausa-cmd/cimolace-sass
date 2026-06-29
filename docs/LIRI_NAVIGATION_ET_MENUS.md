# LIRI — Navigation & organisation des menus (RÈGLE EN DUR)

> À lire avant toute modif de la navigation du **portail LIRI** (rail, sous-rail, onglets,
> back-office école). Complète `LIRI_ISNA_DOMAINES_ROUTING_BRANDING.md` (domaines/branding)
> et `ARCHITECTURE_LIRI_VS_ECOLE.md` (produit vs tenant).

## 1. Le back-office école vit DANS le portail (plus de shell séparé)

Il n'y a **qu'une seule** interface : le **portail LIRI** (`LiriPortalShell` / `LiriPortalPage`,
rail Accueil/Lives/Forum/Messages/Studio/École/Biblio/Brain). Le vieux back-office séparé
`/owner-dashboard` (shell `LiriDashboardShell`, « style isna ») **ne doit plus jamais être
monté**.

- L'onglet **École** du portail = `/liri/ecole` (`pages/liri/LiriEcolePage.jsx`) **embarque
  tout le back-office** : sous-rail des 6 familles (`buildOwnerMenuGroups`,
  `components/owner/ownerMenuGroups.js`) + le switch `OwnerDashboardBody`
  (`pages/OwnerDashboard.jsx`, export nommé), `basePath="/liri/ecole"`.
- **Atterrissage** : owner/admin → **toujours `/liri`** (`lib/dashboardRoute.js`,
  `App.jsx` `DashboardRedirect`). Jamais `/owner-dashboard`, même sur le domaine tenant.
- `/owner-dashboard` → **redirige** vers `/liri/ecole` (`App.jsx` `OwnerDashboardLegacyRedirect`,
  query préservée). Les liens internes en dur suivent donc automatiquement.
- `/liri/ecole` est **restreint owner/admin** (il expose Finances/Utilisateurs/Paramètres).

### Pièges
- Un composant d'onglet ne doit **JAMAIS** monter son propre shell (`OwnerDashboardLayout` /
  `LiriDashboardShell`) → sinon **double-shell** (« LØRI ADMIN » imbriqué). Cas réglé :
  `SettingsPage` accepte `embedded` (ne monte plus le layout en embarqué). Pour toute
  page-onglet qui s'auto-enveloppe, ajouter le même garde-fou.
- « Communication » (forum) du sous-rail → pointe vers `/liri/forum` (le forum du rail), pas
  de forum dupliqué dans École.

## 2. RÈGLE D'ORGANISATION DES MENUS — 3 niveaux, 3 emplacements

| Niveau | Quoi | Où | Exemple |
|--------|------|-----|---------|
| 1 · Espaces | produits LIRI | **Rail icônes** (gauche) | Accueil, Lives, École, Studio |
| 2 · Sections | sections d'un espace | **Sous-rail** (gauche) | Pilotage, Pédagogie, Finances |
| 3 · Sous-vues | vues d'une section | **EN-TÊTE** (barre du logo) | Paramètres → Général / Année / Sécurité |

- **Interdit** : une barre de sous-onglets (`PremiumSegmentedSelector`) dans le **corps** qui
  pousse le contenu. Le niveau 3 **remonte dans l'en-tête** (fil d'Ariane + onglets).
- **Anti-redondance** : un libellé déjà présent dans le sous-rail (niveau 2) ne réapparaît
  **pas** en sous-vue (niveau 3). Ex : « Paiements », « Notifications » retirés des sous-vues
  de Paramètres.
- **Repli** : `•••` / scroll si débordement ou mobile (les onglets `md:flex` sont masqués
  sous `md`, le sous-rail prend le relais).

### Mécanisme technique
`components/liri/portalHeader.tsx` — contexte d'en-tête du portail (2 contextes séparés
**setters** / **valeurs** → push sans boucle de rendu).
- `LiriPortalShell` fournit le `PortalHeaderProvider` et rend, dans la topbar :
  le **fil d'Ariane** (`crumb`) à gauche + les **sous-vues** (`HeaderTabs`) à droite.
- Une page POUSSE depuis l'intérieur du shell (sous le Provider) :
  - `usePortalCrumb(['École', '<section>'])` — fil d'Ariane.
  - `usePortalTabs(items, active, onChange)` — sous-vues (onglets soulignés coral).
  - `useInPortalHeader()` — `true` dans le portail → la page **masque sa barre inline** ;
    `false` hors portail (page standalone) → elle **rend sa barre** comme avant.

### Ajouter une section avec des sous-vues
1. Le contenu de la section appelle `usePortalTabs(options, active, onChange)` et masque sa
   barre inline derrière `{!useInPortalHeader() && <barre/>}`.
2. Le fil d'Ariane suit automatiquement (poussé par `LiriEcolePage` selon l'onglet actif).
3. Hooks toujours appelés inconditionnellement (règle des hooks) ; le push est no-op hors
   portail.
4. ⚠️ **Rendre le contenu DIRECTEMENT** (`<div key={active}>{content}</div>`) en mode embarqué —
   PAS dans `AnimatePresence mode="wait"` ni `<TabsContent value={active}>` (Radix). Dans le
   scope scrollable, l'exit d'`AnimatePresence` ne se complète pas → le contenu **ne bascule
   jamais** (bug SILENCIEUX : l'onglet actif change dans l'en-tête mais le panneau reste figé).
   Au-delà de 6 onglets, le repli « ••• » de `HeaderTabs` s'active automatiquement.

## Fichiers clés
- `components/liri/portalHeader.tsx` — contexte + hooks d'en-tête.
- `components/liri/LiriPortalShell.tsx` — topbar 3 zones + `HeaderTabs`.
- `pages/liri/LiriEcolePage.jsx` — onglet École = back-office embarqué + fil d'Ariane.
- `components/owner/ownerMenuGroups.js` — source unique des 6 familles.
- `pages/OwnerDashboard.jsx` — `OwnerDashboardBody` (switch réutilisé) + `FinanceSection`.
- `lib/dashboardRoute.js` + `App.jsx` — atterrissage owner → `/liri`, redirection legacy.
