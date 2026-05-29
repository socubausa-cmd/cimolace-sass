import { useSmartboardKonvaStore } from '../store/useSmartboardKonvaStore';

/** @type {Record<string, string>} */
export const AI_HUB_EXPLAIN = {
  group_selection:
    'Le groupement associe plusieurs calques avec un même identifiant de groupe : vous pouvez les déplacer et les traiter ensemble selon les outils du studio.',
  duplicate_selection:
    'Une copie de chaque élément sélectionné est créée avec un léger décalage (+20 px) pour rester visible sur le canvas.',
  align_center_canvas:
    'La position de chaque objet est recalculée pour le centrer dans le cadre du document (largeur et hauteur du canvas).',
  select_all_on_canvas:
    'Tous les calques de la scène active passent en sélection multiple : vous pouvez ensuite grouper, dupliquer ou aligner d\'un coup.',
};

/**
 * @param {string} actionId
 * @returns {{ ok: boolean; message: string }}
 */
export function executeAiHubAction(actionId) {
  const s = useSmartboardKonvaStore.getState();
  switch (actionId) {
    case 'group_selection': {
      if (s.selectedIds.length < 2) {
        return { ok: false, message: 'Sélectionnez au moins 2 éléments pour grouper.' };
      }
      const gid = s.groupSelected();
      return { ok: Boolean(gid), message: gid ? 'Éléments groupés.' : 'Impossible de grouper.' };
    }
    case 'duplicate_selection': {
      if (!s.selectedIds.length) {
        return { ok: false, message: 'Sélectionnez au moins un élément à dupliquer.' };
      }
      s.duplicateSelected();
      return { ok: true, message: 'Copie créée (décalée).' };
    }
    case 'align_center_canvas': {
      if (!s.selectedIds.length) {
        return { ok: false, message: 'Sélectionnez au moins un élément.' };
      }
      s.alignSelectedCenterBoth();
      return { ok: true, message: 'Sélection centrée sur le canvas.' };
    }
    case 'select_all_on_canvas': {
      s.selectAllInActiveScene();
      return { ok: true, message: 'Tous les objets de la scène sont sélectionnés.' };
    }
    default:
      return { ok: false, message: 'Action non reconnue.' };
  }
}
