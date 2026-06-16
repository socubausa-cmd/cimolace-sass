# Cadrage — Corps 3D rotatif (MEDOS / Jumeau numérique)

> But : passer du **corps anatomique SVG** (actuel, livré : organes en formes reconnaissables, colorés, cliquables, zoom) à un **vrai corps 3D rotatif** : modèle anatomique qu'on tourne/zoome à la souris, chaque organe étant un *mesh* séparé, coloré selon son score et cliquable → fiche organe (état + facteurs + IA).

État actuel (2026-06-14) : onglet « Corps 3D » = `BodyViewer.tsx` en **SVG 2D** (organes-formes, zoom/pan, clic). Fiable, léger (~4 KB), mobile OK. Le 3D ci-dessous est une **vue enrichie**, pas un remplacement obligatoire.

---

## 1. Le verrou : le MODÈLE 3D (≠ du code)

90 % de l'effort et du risque sont là. Il faut un **glTF/GLB** avec :
- **un mesh séparé et nommé par organe** (≈ les 12 actuels : `brain, thyroid, heart, lungs, liver, stomach, pancreas, gut, kidneys, adrenals, immune/spleen, reproductive`) → pour colorer + cliquer chacun indépendamment ;
- une **silhouette de corps** translucide (peau) pour situer les organes ;
- **web-optimisé** : décimé + compressé Draco, cible **< 6–8 Mo** (sinon chargement lent).

### Options de modèle

| Source | Licence | Pour | Contre |
|---|---|---|---|
| **Sketchfab** (filtrer *Downloadable* + CC) | CC-BY (attribution) | GLB prêt, souvent bonne qualité | Vérifier que les organes sont des **meshes séparés** ; licence par modèle |
| **Z-Anatomy** (z-anatomy.com) | CC-BY-SA | Exhaustif, meshes nommés (Blender) | **Énorme** (corps entier, 1000s de meshes) → gros nettoyage Blender ; share-alike |
| **BodyParts3D** (lifesciencedb) | CC-BY-SA 2.1 JP | **1 fichier par organe** (facile à piocher) | Format OBJ/STL (à convertir GLB), qualité inégale |
| **Commande / achat** (TurboSquid, CGTrader, ou 3D artist) | Royalty-free / contrat | Propre, web-ready, licence claire | **Coût** (~50–500 € prêt, ~300–1500 € sur mesure) |
| **Génératif** (Meshy, Luma) | variable | Rapide/pas cher | Précision anatomique douteuse, split/nommage manuel |

**Recommandé** : un modèle **CC-BY avec organes séparés** (Sketchfab) si on en trouve un propre, sinon **commander un set d'organes web-optimisé** (le plus sûr pour qualité + licence). Éviter Z-Anatomy *full* sauf besoin d'exhaustivité.

### Pipeline modèle (Blender) — une fois la source choisie
1. Garder uniquement les ~12 organes (+ silhouette), supprimer le reste.
2. **Décimer** (réduire le polycount → cible < ~200 k triangles au total).
3. **Renommer chaque mesh** = notre code organe (`brain`, `heart`, …).
4. Aligner dans un repère commun + matériau de base neutre.
5. Export **GLB + Draco** → `apps/med-app/public/models/body.glb`.

---

## 2. La partie code (r3f) — la plus simple

Déjà en place dans `package.json` (pas de nouvelle grosse dép) : `three ^0.184`, `@react-three/fiber ^9.6`, `@react-three/drei ^10.7`. À ajouter : `@types/three` (TS) + loader Draco.

Plan `BodyViewer3D.tsx` :
1. `<Canvas>` + `useGLTF('/models/body.glb')` (drei) avec **DRACOLoader**.
2. Parcourir la scène glTF → `mesh.name` → code organe → **cloner le matériau** et appliquer la couleur du score (vert/jaune/orange/rouge, gris si non évalué).
3. **Clic** : `onClick` sur le mesh (raycast intégré r3f) → `onSelect(code)` → la fiche `OrganDetail` existante s'ouvre (déjà branchée).
4. **OrbitControls** (rotation + zoom molette, pan désactivé), auto-rotation à l'arrêt, **recentrage caméra** sur l'organe sélectionné.
5. Organe **critique** → matériau émissif + légère pulsation.
6. **Lazy-load + Suspense** : fallback = le `BodyViewer` SVG actuel (s'affiche pendant le chargement du GLB et si WebGL indisponible).
7. **Toggle** dans l'onglet Corps : « 2D » (SVG, rapide) ⇄ « 3D » (explorer). Le branchement `organs`/`selected`/`onSelect` + `OrganDetail` est **identique** au SVG → réutilisé tel quel.

---

## 3. Découpage & effort

| Phase | Contenu | Effort |
|---|---|---|
| **0. Modèle** | sourcer + vérifier licence/split + (Blender) extraire 12 organes, décimer, nommer, export GLB+Draco | **0,5–3 j** (le gros variable — selon source ; commande = délai externe) |
| **1. Code r3f** | `BodyViewer3D` : load GLB, mapping mesh→code, couleurs, clic, OrbitControls, fallback | **0,5–1 j** |
| **2. Perf/mobile** | Draco, lazy-load, contrôles tactiles, fallback WebGL, budget bundle | **0,5 j** |
| **3. Intégration** | toggle 2D/3D dans l'onglet Corps, recentrage caméra, polish | **0,5 j** |

**Total ≈ 2–4 jours-homme** (+ coût modèle si payé/commandé). Le déploiement reste le flux med-app habituel (build prebuilt + `vercel deploy --prebuilt --prod`).

---

## 4. Risques
- **Taille GLB** → temps de chargement (mitigation : décimation + Draco, lazy-load, fallback SVG).
- **WebGL absent / vieux device** → garder le SVG en fallback (toujours dispo).
- **Mapping noms de meshes ↔ codes** : dépend de la propreté du modèle (à normaliser au pipeline).
- **Licence** : CC-BY/CC-BY-SA = attribution obligatoire (+ share-alike pour SA) ; à valider AVANT prod.
- **Mobile** : perf 3D + contrôles tactiles à tester.

---

## 5. Décisions à prendre (USER) — bloquantes
1. **Modèle** : (a) je cherche un CC-BY propre et je fais le pipeline Blender, (b) on **achète/commande** un set d'organes (coût €, qualité+licence garanties), ou (c) **tu fournis** un GLB.
2. **Morphologie** : neutre / homme / femme (impacte « reproducteur » + silhouette).
3. **Qualité** : stylisé (léger, cohérent avec l'UI) vs médical-réaliste (plus lourd).
4. **Place** : 3D **en plus** du SVG (toggle 2D/3D — *recommandé* pour perf/mobile/fallback) ou 3D qui **remplace** le SVG.

---

## 6. Recommandation
Garder le **SVG comme vue par défaut** (rapide, fiable, mobile, déjà livré) et ajouter le **3D comme mode « Explorer en 3D »** (bouton, lazy-loadé, fallback SVG). Pour le modèle : viser un **set d'organes web-optimisé commandé** (qualité + licence nettes) ou un **CC-BY Sketchfab** propre. La partie code est rapide ; **tout dépend du modèle** — c'est la première décision.
