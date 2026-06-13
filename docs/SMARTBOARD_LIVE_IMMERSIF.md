# Smartboard live immersif — gabarit natif mobile

But : pendant un live (`LiveHostPage` / régie + salle élève), le **smartboard** doit
**se fondre dans la scène** (fond immersif sombre) au lieu d'être une carte blanche/opaque,
et réserver une **zone pour le flux vidéo** du présentateur.

## Principes

1. **Sans fond (transparent).** Le conteneur du smartboard n'a aucun fond opaque : les blocs
   (titre, idée clé, formule, à retenir…) flottent sur l'arrière-plan immersif du live.
   - Texte clair (blanc / lavande) lisible sur sombre.
   - Accents en **translucide** (bordures + remplissages très faible opacité), jamais de carte pleine.
   - Marge droite (`paddingRight`) sur les blocs pour dégager le rail de FAB de la régie.
1bis. **Fond = TABLEAU à carreaux (pas du noir plat).** La scène live affiche un quadrillage
   façon tableau / papier millimétré : navy sombre `#0a0b0f` + lignes blanches très
   translucides (`rgba(255,255,255,0.05)`) tous les **44px**. Rendu via `react-native-svg`
   (`<Pattern>`), aligné sur le compositeur web `SmartBoardCompositor`. Le smartboard
   transparent se pose dessus → effet « contenu écrit sur le tableau ».
2. **Zone caméra réservée.** Le gabarit prévoit un emplacement (`cameraZone`) où vient le
   **flux vidéo LiveKit** du présentateur (vignette « Flux vidéo prof »). Le contenu du
   smartboard s'organise autour de cette zone (pas de chevauchement).
3. **Produit par le constructeur.** Quand **Architect IA** ou **Masterclass** génère un
   smartboard, il sort ce **template natif** (blocs + cameraZone). Le même template est
   rendu identiquement côté **hôte** (régie) et **élève** (salle), sur la scène immersive.

## Modèle de données (sortie du constructeur)

```ts
type SmartboardBlockType = 'key-idea' | 'formula' | 'retain' | 'paragraph' | 'list';

interface SmartboardBlock {
  type: SmartboardBlockType;
  text?: string;        // key-idea / paragraph / formula
  items?: string[];     // retain / list
  label?: string;       // sur-titre (ex. « VALEUR OFFICIELLE »)
}

interface SmartboardSlide {
  chapter?: string;     // ex. « CHAPITRE 3 »
  title: string;        // ex. « La vitesse de la lumière »
  blocks: SmartboardBlock[];
  cameraZone?: 'top-right' | 'bottom-right' | 'none';  // emplacement du flux vidéo
}
```

Le constructeur (`generate-visual-image` / Architect / Masterclass) renvoie un `SmartboardSlide[]`
(une entrée par slide). Le rendu mobile consomme ce tableau tel quel.

## Rendu (natif mobile)

Composant : `apps/mobile/src/components/live-host/immersive-smartboard.tsx`
- `ImmersiveSmartboard({ slide, cameraNode })` :
  - **aucun fond** (transparent),
  - rend chaque bloc en style « fondu » (translucide),
  - place `cameraNode` (un `<VideoTrack>` LiveKit, ou un placeholder « Flux vidéo prof ») dans
    la `cameraZone`.
- Intégration : `host-shell.tsx` → scène `smartboard` rend `<ImmersiveSmartboard slide cameraNode={hostVideo} />`
  (le flux caméra de l'hôte va dans la zone réservée au lieu du plein écran).

## Fidélité au modèle
Même contenu que la maquette fournie (chapitre, titre, idée clé, valeur officielle/formule,
à retenir) **mais sans le fond blanc** : sur la scène live sombre, le smartboard est immersif,
avec la vignette caméra du prof intégrée.
