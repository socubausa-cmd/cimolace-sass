import { activateKonvaSceneAndSyncSlide } from '../store/smartboardWorkspaceApi';
import { useSmartboardKonvaStore } from '../store/useSmartboardKonvaStore';

/**
 * Active la scène Konva et le slide Copilot à l’index donné (0-based).
 *
 * @param {number} slideIdx
 */
export function syncToCanvasSlideIndex(slideIdx) {
  const konva = useSmartboardKonvaStore.getState();
  const scenes = konva.project?.scenes ?? [];
  if (!scenes.length) return;
  const idx = Math.max(0, Math.min(Number(slideIdx) || 0, scenes.length - 1));
  const sceneId = scenes[idx]?.id;
  if (!sceneId) return;
  activateKonvaSceneAndSyncSlide(sceneId, idx);
}
