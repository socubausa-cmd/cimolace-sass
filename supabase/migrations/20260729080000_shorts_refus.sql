-- ════════════════════════════════════════════════════════════════════════════
-- Les REFUS du contrôle de sortie, rendus visibles au créateur.
--
-- Le moteur écarte désormais des extraits plutôt que de les livrer (short-jury.js) :
-- fin sur de la logistique de séance, question dont la réponse est hors bornes,
-- titre qui annonce un chiffre absent du texte retenu. Sur le replay de référence,
-- 3 passages sur 4 tombaient sur ces règles.
--
-- ⭐ UN REFUS MUET EST UN REFUS QU'ON NE PEUT PAS CORRIGER. Sans cette colonne, le
-- créateur voit « 2 extraits » là où il en attendait 5 et n'a aucun moyen de savoir
-- pourquoi — ni de contester. On archive donc ce qui a été écarté ET le motif, en
-- clair, pour l'afficher.
--
-- Forme : [{start, end, titre, code, detail, extrait_texte}]
-- `code` ∈ FIN_LOGISTIQUE · QUESTION_SANS_REPONSE · TITRE_NON_TENU · JURY
--          · citation_introuvable · bornes_inversees
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.zoom_recordings
  ADD COLUMN IF NOT EXISTS shorts_refus jsonb;

COMMENT ON COLUMN public.zoom_recordings.shorts_refus IS
  'Passages écartés au contrôle de sortie des extraits courts, avec leur motif : '
  '[{start,end,titre,code,detail,extrait_texte}]. Affiché au créateur — un refus muet '
  'ne peut pas être corrigé. NULL = aucun refus, ou fabrication antérieure au 2026-07-29.';

NOTIFY pgrst, 'reload schema';
