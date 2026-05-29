/**
 * Point d'entrée unique pour l'état « workspace » LIRI : projet Konva + slice Course Copilot.
 * Les deux restent dans des stores Zustand séparés ; cette couche évite la duplication
 * de buildWorkspacePayload / hydrate à chaque écran.
 */

import {
  buildWorkspacePayload,
  parseWorkspaceImport,
  assertWorkspacePayload,
  LIRI_COURSE_WORKSPACE_FORMAT,
  LIRI_COURSE_WORKSPACE_LOCAL_KEY,
} from '../lib/courseWorkspaceBundle';
import { parseProjectJson } from '../model/sceneModel';
import { useCourseCopilotStore } from './useCourseCopilotStore';
import { useSmartboardKonvaStore } from './useSmartboardKonvaStore';
import { useDesignerShellStore } from './useDesignerShellStore';
import { useAiHubStore } from './useAiHubStore';
import { useDocumentCoachStore } from './useDocumentCoachStore';

export {
  buildWorkspacePayload,
  parseWorkspaceImport,
  assertWorkspacePayload,
  LIRI_COURSE_WORKSPACE_FORMAT,
  LIRI_COURSE_WORKSPACE_LOCAL_KEY,
};

/**
 * Slice Copilot tel que attendu par {@link buildWorkspacePayload}.
 * @returns {Parameters<typeof buildWorkspacePayload>[1]}
 */
export function getCopilotWorkspaceSlice() {
  const c = useCourseCopilotStore.getState();
  return {
    sourceText: c.sourceText,
    activeSlideIndex: c.activeSlideIndex,
    course: c.course,
    globalSuggestions: c.globalSuggestions,
    courseTheme: c.courseTheme,
    validationChecklist: c.validationChecklist,
    slideTimingMinutes: c.slideTimingMinutes,
    designerPreviewMode: c.designerPreviewMode,
    cinemaPedagogy: c.cinemaPedagogy,
  };
}

/** @returns {Record<string, unknown>} */
export function collectDesignerStudioForExport() {
  const shell = useDesignerShellStore.getState();
  const ai = useAiHubStore.getState();
  const coach = useDocumentCoachStore.getState();
  const longia = useSmartboardKonvaStore.getState().longiaMessages;
  return {
    docType: shell.docType,
    outputFormats: shell.outputFormats,
    designerMode: shell.designerMode,
    studioQuickMode: ai.studioQuickMode,
    longiaMessages: longia.map((m) => ({
      role: m.role,
      text: m.text,
      ...(Array.isArray(m.suggestions) && m.suggestions.length ? { suggestions: m.suggestions } : {}),
      ...(m.longiaUnified && typeof m.longiaUnified === 'object' ? { longiaUnified: m.longiaUnified } : {}),
      ...(m.longiaComposed && typeof m.longiaComposed === 'object' ? { longiaComposed: m.longiaComposed } : {}),
    })),
    documentCoach: coach.isDocumentMode ? coach.exportForWorkspace() : null,
  };
}

/**
 * Bundle JSON complet (Konva + Copilot + shell Studio / LONGIA).
 * @returns {ReturnType<typeof buildWorkspacePayload>}
 */
export function buildWorkspacePayloadFromStores() {
  const project = useSmartboardKonvaStore.getState().project;
  return buildWorkspacePayload(project, getCopilotWorkspaceSlice(), collectDesignerStudioForExport());
}

/** Titre par défaut pour enregistrement cloud (aligné CourseWorkspaceCloudSection). */
export function inferWorkspaceTitleFromStores() {
  const c = useCourseCopilotStore.getState();
  if (c.course?.title) return String(c.course.title).slice(0, 200);
  const line = c.sourceText?.split('\n').map((l) => l.trim()).find(Boolean);
  if (line) return line.slice(0, 200);
  return `Workspace ${new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`;
}

/**
 * Applique `data.designerStudio` (docType, LONGIA, coach, quick mode).
 * @param {ReturnType<typeof buildWorkspacePayload> | Record<string, unknown>} data
 */
export function hydrateDesignerStudioFromPayload(data) {
  const d = data && typeof data === 'object' ? /** @type {Record<string, unknown>} */ (data) : null;
  const ds = d?.designerStudio;
  if (!ds || typeof ds !== 'object') {
    const kp = d?.konvaProject;
    const hasKonva =
      kp &&
      typeof kp === 'object' &&
      Array.isArray(/** @type {{ scenes?: unknown[] }} */ (kp).scenes) &&
      /** @type {{ scenes: unknown[] }} */ (kp).scenes.length > 0;
    useDesignerShellStore.setState({
      docType: hasKonva ? 'smartboard' : null,
      outputFormats: ['screen'],
      designerMode: 'design',
    });
    useAiHubStore.getState().setStudioQuickMode('analyse');
    useDocumentCoachStore.getState().deactivateDocumentMode();
    useSmartboardKonvaStore.getState().clearLongiaMessages();
    return;
  }
  /** @type {import('../lib/courseWorkspaceBundle').DesignerStudioPayload} */
  const block = /** @type {any} */ (ds);
  useDesignerShellStore.getState().hydrateFromPayload(block);
  const sq = block.studioQuickMode;
  if (typeof sq === 'string') useAiHubStore.getState().setStudioQuickMode(sq);
  const lm = block.longiaMessages;
  if (Array.isArray(lm) && lm.length) {
    useSmartboardKonvaStore.getState().hydrateLongiaFromExport(lm);
  } else {
    useSmartboardKonvaStore.getState().clearLongiaMessages();
  }
  const dc = block.documentCoach;
  if (dc && typeof dc === 'object') {
    useDocumentCoachStore.getState().hydrateFromWorkspace(/** @type {any} */ (dc));
  } else {
    useDocumentCoachStore.getState().deactivateDocumentMode();
  }
}

/**
 * Hydrate uniquement le store Copilot (ex. bootstrap parent qui injecte le Konva via `initialKonvaProject`).
 * @param {ReturnType<typeof buildWorkspacePayload>} data
 */
export function hydrateWorkspaceCopilotOnly(data) {
  useCourseCopilotStore.getState().hydrateFromExport(data);
}

/**
 * Import workspace dans l'éditeur Konva : charge le projet puis le plan Copilot (ordre aligné sur l'existant).
 * Ignore `konvaProject` absent ou vide (ex. brouillon Polotno-only).
 * @param {ReturnType<typeof buildWorkspacePayload>} data
 */
export function hydrateWorkspaceIntoKonvaEditor(data) {
  const kp = data.konvaProject;
  if (kp && typeof kp === 'object' && Array.isArray(kp.scenes) && kp.scenes.length) {
    useSmartboardKonvaStore.getState().loadProject(parseProjectJson(JSON.stringify(kp)));
  }
  useCourseCopilotStore.getState().hydrateFromExport(data);
  hydrateDesignerStudioFromPayload(data);
}

/**
 * @param {string} jsonString
 * @returns {ReturnType<typeof parseWorkspaceImport>}
 */
export function hydrateWorkspaceIntoKonvaEditorFromJsonString(jsonString) {
  const data = parseWorkspaceImport(jsonString);
  hydrateWorkspaceIntoKonvaEditor(data);
  return data;
}

/**
 * Clic sur une scène dans la bande : active la scène Konva et aligne le slide Copilot
 * lorsque l'index existe dans le plan (évite le décalage filmstrip / canvas).
 *
 * @param {string} sceneId
 * @param {number} sceneIndex index dans `project.scenes` (0-based)
 */
export function activateKonvaSceneAndSyncSlide(sceneId, sceneIndex) {
  const konva = useSmartboardKonvaStore.getState();
  const copilot = useCourseCopilotStore.getState();
  konva.setActiveScene(sceneId);
  const slideCount = copilot.course?.slides?.length ?? 0;
  if (slideCount && sceneIndex >= 0 && sceneIndex < slideCount) {
    copilot.setActiveSlideIndex(sceneIndex);
  }
}
