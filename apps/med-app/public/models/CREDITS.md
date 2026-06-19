# Modèles 3D d'organes — Attribution

Les modèles anatomiques du Jumeau numérique (`female/*.glb`, `male/*.glb`)
sont dérivés du **HuBMAP Human Reference Atlas (HRA) — 3D Reference Object
Library**.

- Source : https://github.com/hubmapconsortium/ccf-3d-reference-object-library
  (portail : https://humanatlas.io/3d-reference-library)
- Licence : **Creative Commons Attribution 4.0 International (CC BY 4.0)**
  — https://creativecommons.org/licenses/by/4.0/
- Modifications : extraction d'un sous-ensemble d'organes (VH_Female / VH_Male
  v1.1), compression Draco via `@gltf-transform/cli` (cf.
  `scripts/build-body-models.sh`). Aucune altération de la géométrie
  anatomique au-delà de la décimation/compression web.

L'attribution est aussi affichée in-app dans la vue « Corps 3D ».

> Cite : Börner, K., et al. *Human Reference Atlas*. HuBMAP Consortium.
