#!/usr/bin/env bash
# Régénère les modèles 3D d'organes (public/models/{female,male}/*.glb) du
# Jumeau numérique MEDOS, à partir du HuBMAP Human Reference Atlas (CC BY 4.0).
#
# Pipeline : télécharge les GLB par organe (repère corporel partagé Visible
# Human) → compresse chacun en Draco via gltf-transform (≈ 4 Mo / corps).
# Aucun Blender requis. Idempotent.
#
# Usage : bash scripts/build-body-models.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
BASE="https://raw.githubusercontent.com/hubmapconsortium/ccf-3d-reference-object-library/main"
SRC="$HERE/public/models/src"
OUT="$HERE/public/models"
mkdir -p "$SRC/female" "$SRC/male" "$OUT/female" "$OUT/male"

# <repo-path>|<dest relatif à public/models/src/>  (code organe = nom de fichier)
read -r -d '' MANIFEST <<'EOF' || true
VH_Female/v1.1/Allen_F_Brain.glb|female/brain.glb
VH_Female/v1.1/VH_F_Heart.glb|female/heart.glb
VH_Female/v1.1/VH_F_Lung.glb|female/lungs.glb
VH_Female/v1.1/VH_F_Liver.glb|female/liver.glb
VH_Female/v1.1/VH_F_Kidney_L.glb|female/kidney_l.glb
VH_Female/v1.1/VH_F_Kidney_R.glb|female/kidney_r.glb
VH_Female/v1.1/VH_F_Spleen.glb|female/spleen.glb
VH_Female/v1.1/VH_F_Pancreas.glb|female/pancreas.glb
VH_Female/v1.1/VH_F_Small_Intestine.glb|female/gut_small.glb
VH_Female/v1.1/SBU_F_Intestine_Large.glb|female/gut_large.glb
VH_Female/v1.1/VH_F_Thymus.glb|female/thymus.glb
VH_Female/v1.1/VH_F_Uterus.glb|female/reproductive.glb
VH_Female/v1.1/VH_F_Skin.glb|female/skin.glb
VH_Male/v1.1/Allen_M_Brain.glb|male/brain.glb
VH_Male/v1.1/VH_M_Heart.glb|male/heart.glb
VH_Male/v1.1/VH_M_Lung.glb|male/lungs.glb
VH_Male/v1.1/VH_M_Liver.glb|male/liver.glb
VH_Male/v1.1/VH_M_Kidney_L.glb|male/kidney_l.glb
VH_Male/v1.1/VH_M_Kidney_R.glb|male/kidney_r.glb
VH_Male/v1.1/VH_M_Spleen.glb|male/spleen.glb
VH_Male/v1.1/VH_M_Pancreas.glb|male/pancreas.glb
VH_Male/v1.1/VH_M_Small_Intestine.glb|male/gut_small.glb
VH_Male/v1.1/SBU_M_Intestine_Large.glb|male/gut_large.glb
VH_Male/v1.1/VH_M_Thymus.glb|male/thymus.glb
VH_Male/v1.1/VH_M_Prostate.glb|male/reproductive.glb
VH_Male/v1.1/VH_M_Skin.glb|male/skin.glb
EOF

echo "» Téléchargement + compression Draco…"
while IFS='|' read -r src dest; do
  [ -z "$src" ] && continue
  raw="$SRC/$dest"; final="$OUT/$dest"
  [ -s "$raw" ] || curl -sSfL --retry 3 -o "$raw" "$BASE/${src// /%20}"
  npx --yes @gltf-transform/cli@latest optimize "$raw" "$final" --compress draco >/dev/null 2>&1
  printf "  ✓ %-22s %5.0f KB\n" "$dest" "$(echo "$(stat -f%z "$final" 2>/dev/null || stat -c%s "$final")/1024" | bc)"
done <<< "$MANIFEST"

echo "» Terminé. Sources brutes : $SRC (non versionnées — supprimables)."
echo "  female: $(du -sh "$OUT/female" | cut -f1)   male: $(du -sh "$OUT/male" | cut -f1)"
