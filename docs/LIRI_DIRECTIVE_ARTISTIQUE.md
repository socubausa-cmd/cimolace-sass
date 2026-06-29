# LIRI — Directive artistique (RÈGLE EN DUR, portail entier)

> **Validée par le propriétaire (2026-06-29). NON négociable.** S'applique à **TOUT le portail
> LIRI** : toute page sous `LiriPortalShell` / `LiriPortalPage`, et **tout composant legacy
> embarqué** dedans (onglet École, etc.). Tout agent qui touche une UI du portail DOIT la
> respecter ET la vérifier visuellement (capture + au besoin inspection DOM des couleurs
> calculées) **avant de livrer**. Réf. de style approuvée : l'écran **« Rapports & Analytique »**.

## 1. Mariage des couleurs — chaud pour les ACCENTS, neutre pour les FONDS

- **Accents** (icônes, badges, boutons, texte d'emphase, états actifs, gradients d'icônes) =
  **CHAUD** : coral `#d97757` (`var(--school-accent)`), ambre `#c8893f`, terracotta.
- **Bannir le froid** : navy (`#0F1419/#121A25/#192734/#16202A`), violet/indigo (`#7C3AED`…),
  teal/vert-bleu, cyan/bleu, **or/gold ISNA** (`#D4AF37/#b5952f` → ambre). Les gradients
  d'icônes **inline** froids doivent aussi passer en chaud.
- **Seules exceptions** : vert / rouge **sémantiques** (succès / danger / alerte).
- ⚠️ **Les FONDS ne sont JAMAIS chauds.** `--base` du portail = `#262624` (R=G>B = jaune
  désaturé) ; un fond crème/chaud par-dessus, à côté du coral, est perçu **olive/vert**.

## 2. Fonds immersifs — le fond LIRI, rien d'autre

- **Aucun fond opaque ajouté** sur les cartes/conteneurs/tableaux. Ils sont **transparents** :
  seul le fond du portail (`#262624`) traverse. Délimitation par **bordure fine** uniquement
  (`rgba(238,240,245,.08)`), pas de fond, ombre `none`.
- **Interdits** : un bloc plus FONCÉ que le fond (« bloc noir, n'importe quoi »), un fond chaud
  (vire olive), une **boîte-dans-la-boîte** (surface sombre imbriquée dans une autre → la rendre
  transparente). Tableaux **immersifs** : hairlines entre lignes, pas de conteneur coloré.
- Réf. : « Rapports & Analytique » — cartes discrètes, aérées, qui s'emboîtent dans le fond.

## 3. Lisibilité — aucun texte illisible

- Contraste suffisant partout. Les composants legacy conçus pour le **mode clair** ont des
  textes foncés (zinc/gray/slate/stone-800/900, noir) → **forcés en clair** (`#f5f1e9`) sur le
  sombre ; gris moyens → `rgba(245,241,233,.64)` ; textes froids (violet/indigo/blue, ex.
  alertes) → beige chaud. Opacités secondaires assez hautes (`--lt-muted ≥ .58` si utilisé).
- **Pas de surcharge** : aérer, pas de redondance, pas de barre de sous-onglets dans le corps
  (cf. `LIRI_NAVIGATION_ET_MENUS.md` — niveau 3 dans l'en-tête).

## 4. Comment l'appliquer (composants legacy embarqués)

Pattern de référence : le bloc **`ECOLE_WARM_CSS`** de `apps/app/src/pages/liri/LiriEcolePage.jsx`
(remappage **scopé** `.ecole-warm-scope`). Reproduire la même approche pour tout autre espace qui
embarque des surfaces legacy :
- Remap froid→chaud / or→ambre via sélecteurs `[class*="bg-[#…]"]` (robustes à l'opacité) + les
  variables/classes `--premium-*` / `.premium-panel` / `.premium-dashboard-shell`.
- Fonds : `--lt-card-bg` / `--lt-inner-bg` = `transparent`, shadow `none`.
- Anti-imbrication : surface sombre dans surface sombre → `transparent`.
- Lisibilité : remap textes foncés/froids → clairs.

### Pièges connus
- **Spécificité** : les règles définies `#root .premium-*` (avec un **ID**) battent un sélecteur
  à 2 classes → préfixer le tien par `#root`.
- **Animations** : les surfaces back-office à `whileInView` (framer-motion) restent **bloquées à
  `opacity:0`** une fois embarquées dans un scope scrollable (titres/KPI invisibles = « textes
  flous/transparents ») → forcer `.<scope> [style*="opacity: 0;"] { opacity: 1 !important; }`.

## Checklist avant de livrer une UI du portail LIRI
- [ ] Couleurs mariées (accents chauds, aucun froid parasite, fonds neutres) ?
- [ ] Fonds immersifs (transparents, fond LIRI, pas de bloc, pas de boîte-dans-boîte) ?
- [ ] Tout lisible (aucun texte pâle/invisible, contraste OK) ?
- [ ] Pas de surcharge ?
