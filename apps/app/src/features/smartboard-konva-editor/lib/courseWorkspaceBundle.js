/**
 * Bundle JSON : projet Konva (`konvaProject`, version 1) ou ancien export Polotno (`polotnoProject`, version 2) + état Course Copilot.
 */

import { mergeCourseThemeFromExport } from './liriCourseTheme';
import { mergeValidationChecklistFromExport } from './liriValidationChecklist';
import { normalizeDesignerPreviewMode } from './liriDesignerPreviewModes';
import { mergeCinemaPedagogyFromExport, sanitizeCinemaPedagogyForExport } from './liriCinemaPedagogy';

export const LIRI_COURSE_WORKSPACE_FORMAT = 'liri-course-workspace-v1';

/**
 * Tranche « shell Studio » embarquée dans le JSON (SmartBoard Designer unifié).
 * @typedef {{
 *   v?: number;
 *   docType?: string | null;
 *   outputFormats?: string[];
 *   designerMode?: string;
 *   studioQuickMode?: string;
 *   longiaMessages?: Array<{ role: string; text: string; suggestions?: unknown[] }>;
 *   documentCoach?: Record<string, unknown> | null;
 * }} DesignerStudioPayload
 */

/**
 * @param {Record<string, unknown> | null | undefined} raw
 * @returns {DesignerStudioPayload | null}
 */
export function sanitizeDesignerStudioForExport(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const ds = /** @type {Record<string, unknown>} */ (raw);
  const mode = ds.designerMode;
  const safeMode = ['design', 'live', 'video', 'cinema'].includes(mode) ? mode : 'design';
  const lmRaw = ds.longiaMessages;
  const longiaMessages = Array.isArray(lmRaw)
    ? lmRaw.slice(0, 40).map((m) => {
        const x = m && typeof m === 'object' ? /** @type {Record<string, unknown>} */ (m) : {};
        const role = x.role === 'user' ? 'user' : 'ai';
        const text = typeof x.text === 'string' ? x.text.slice(0, 12_000) : '';
        const out = { role, text };
        if (Array.isArray(x.suggestions) && x.suggestions.length) {
          /** @type {any} */ (out).suggestions = x.suggestions.slice(0, 12);
        }
        if (x.longiaUnified && typeof x.longiaUnified === 'object') {
          /** @type {any} */ (out).longiaUnified = x.longiaUnified;
        }
        if (x.longiaComposed && typeof x.longiaComposed === 'object') {
          /** @type {any} */ (out).longiaComposed = x.longiaComposed;
        }
        return out;
      })
    : null;
  const out = /** @type {DesignerStudioPayload} */ ({
    v: 1,
    docType: ds.docType === null || ds.docType === undefined ? null : String(ds.docType).slice(0, 64),
    outputFormats: Array.isArray(ds.outputFormats) && ds.outputFormats.length
      ? ds.outputFormats.map((x) => String(x).slice(0, 48)).slice(0, 12)
      : ['screen'],
    designerMode: safeMode,
    studioQuickMode:
      typeof ds.studioQuickMode === 'string' ? ds.studioQuickMode.slice(0, 64) : 'analyse',
  });
  if (longiaMessages?.length) out.longiaMessages = longiaMessages;
  if (ds.documentCoach && typeof ds.documentCoach === 'object') {
    out.documentCoach = /** @type {Record<string, unknown>} */ (ds.documentCoach);
  }
  return out;
}

/**
 * @param {Record<string, unknown>} canvasProject — Polotno `store.toJSON()` **ou** projet Konva (`scenes`, `canvas`, …)
 * @param {{
 *   sourceText: string;
 *   activeSlideIndex: number;
 *   course: import('../model/courseCopilotTypes').LiriCourseCopilotCourse | null;
 *   globalSuggestions: string[] | null;
 *   courseTheme?: import('./liriCourseTheme').CourseThemeState | null;
 *   validationChecklist?: Record<string, boolean> | null;
 *   slideTimingMinutes?: number[] | null;
 *   designerPreviewMode?: import('./liriDesignerPreviewModes').DesignerPreviewMode | string | null;
 *   cinemaPedagogy?: import('./liriCinemaPedagogy').LiriCinemaPedagogyState | null;
 * }} copilot
 * @param {Record<string, unknown> | null | undefined} [designerStudio] — état shell / LONGIA / coach (voir {@link sanitizeDesignerStudioForExport})
 */
export function buildWorkspacePayload(canvasProject, copilot, designerStudio = null) {
  const shared = {
    format: LIRI_COURSE_WORKSPACE_FORMAT,
    exportedAt: new Date().toISOString(),
    sourceText: copilot.sourceText ?? '',
    activeSlideIndex: copilot.activeSlideIndex ?? 0,
    course: copilot.course ?? null,
    globalSuggestions: copilot.globalSuggestions ?? null,
    courseTheme: mergeCourseThemeFromExport(copilot.courseTheme),
    validationChecklist: mergeValidationChecklistFromExport(copilot.validationChecklist),
    slideTimingMinutes: Array.isArray(copilot.slideTimingMinutes) ? copilot.slideTimingMinutes : [],
    designerPreviewMode: normalizeDesignerPreviewMode(copilot.designerPreviewMode),
    cinemaPedagogy: sanitizeCinemaPedagogyForExport(copilot.cinemaPedagogy),
  };

  const dsOut = sanitizeDesignerStudioForExport(designerStudio);
  const sharedPlus = dsOut ? { ...shared, designerStudio: dsOut } : { ...shared };

  const isKonvaProject =
    canvasProject &&
    typeof canvasProject === 'object' &&
    Array.isArray(/** @type {{ scenes?: unknown[] }} */ (canvasProject).scenes) &&
    !Array.isArray(/** @type {{ pages?: unknown[] }} */ (canvasProject).pages);

  if (isKonvaProject) {
    return {
      ...sharedPlus,
      version: 1,
      polotnoProject: null,
      konvaProject: canvasProject,
    };
  }

  return {
    ...sharedPlus,
    version: 2,
    polotnoProject: canvasProject,
    konvaProject: null,
  };
}

/**
 * Valide un objet workspace (fichier ou ligne Supabase jsonb).
 * v2 : `polotnoProject.pages` (historique) ou `konvaProject.scenes`
 * v1 : `konvaProject.scenes`
 * @param {unknown} data
 */
export function assertWorkspacePayload(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Payload invalide');
  }
  const d = /** @type {Record<string, unknown>} */ (data);
  if (d.format !== LIRI_COURSE_WORKSPACE_FORMAT) {
    throw new Error(`Format attendu : ${LIRI_COURSE_WORKSPACE_FORMAT}`);
  }
  const ver = Number(d.version) || 1;
  const pp = d.polotnoProject;
  const kp = d.konvaProject;
  const hasPolotnoPages =
    pp && typeof pp === 'object' && Array.isArray(/** @type {any} */ (pp).pages) && /** @type {any} */ (pp).pages.length > 0;
  const hasKonvaScenes =
    kp && typeof kp === 'object' && Array.isArray(/** @type {any} */ (kp).scenes) && /** @type {any} */ (kp).scenes.length > 0;

  if (ver >= 2) {
    if (hasPolotnoPages || hasKonvaScenes) {
      return /** @type {ReturnType<typeof buildWorkspacePayload>} */ (data);
    }
    throw new Error('Workspace v2 : polotnoProject.pages ou konvaProject.scenes requis');
  }
  if (!hasKonvaScenes) {
    throw new Error('konvaProject.scenes manquant (workspace v1)');
  }
  return /** @type {ReturnType<typeof buildWorkspacePayload>} */ (data);
}

/**
 * @param {string} jsonString
 * @returns {ReturnType<typeof buildWorkspacePayload>}
 */
export function parseWorkspaceImport(jsonString) {
  return assertWorkspacePayload(JSON.parse(jsonString));
}

export const LIRI_COURSE_WORKSPACE_LOCAL_KEY = 'liri_course_workspace_v1_draft';

/**
 * Résumé pédagogique / taille pour comparaison de versions (sans diff texte intégral).
 * @param {unknown} data
 */
export function summarizeWorkspacePayloadForCompare(data) {
  const d = data && typeof data === 'object' ? /** @type {Record<string, unknown>} */ (data) : {};
  const pp = d.polotnoProject;
  const pages =
    pp && typeof pp === 'object' && Array.isArray(/** @type {{ pages?: unknown[] }} */ (pp).pages)
      ? /** @type {{ pages: unknown[] }} */ (pp).pages
      : [];
  let elementCount = 0;
  for (const p of pages) {
    const ch = p && typeof p === 'object' ? /** @type {{ children?: unknown[] }} */ (p).children : null;
    if (Array.isArray(ch)) elementCount += ch.length;
  }
  const kp = d.konvaProject;
  let konvaSceneCount = 0;
  if (kp && typeof kp === 'object' && Array.isArray(/** @type {{ scenes?: unknown[] }} */ (kp).scenes)) {
    const scenes = /** @type {{ scenes: unknown[] }} */ (kp).scenes;
    konvaSceneCount = scenes.length;
    for (const sc of scenes) {
      const objs =
        sc && typeof sc === 'object' ? /** @type {{ objects?: unknown[] }} */ (sc).objects : null;
      if (Array.isArray(objs)) elementCount += objs.length;
    }
  }
  const course =
    d.course && typeof d.course === 'object'
      ? /** @type {{ title?: string; slides?: unknown[] }} */ (d.course)
      : null;
  return {
    exportedAt: typeof d.exportedAt === 'string' ? d.exportedAt : null,
    sourceChars: String(d.sourceText ?? '').length,
    slidePlanCount: Array.isArray(course?.slides) ? course.slides.length : 0,
    courseTitle: typeof course?.title === 'string' ? course.title : '',
    pageCount: pages.length,
    konvaSceneCount,
    elementCount,
    jsonLength: JSON.stringify(data ?? {}).length,
  };
}

/**
 * @param {unknown} left
 * @param {unknown} right
 */
export function compareWorkspacePayloadsForUi(left, right) {
  const sa = summarizeWorkspacePayloadForCompare(left);
  const sb = summarizeWorkspacePayloadForCompare(right);
  const jsonA = JSON.stringify(left ?? null);
  const jsonB = JSON.stringify(right ?? null);
  if (jsonA === jsonB) {
    return {
      identical: true,
      lines: ['Les deux charges utiles sont identiques (comparaison JSON complète).'],
      left: sa,
      right: sb,
    };
  }
  /** @type {string[]} */
  const lines = ['Les contenus diffèrent. Indicateurs :'];
  if (sa.exportedAt !== sb.exportedAt) {
    lines.push(`· Date d'export : ${sa.exportedAt || '—'} → ${sb.exportedAt || '—'}`);
  }
  if (sa.sourceChars !== sb.sourceChars) {
    lines.push(`· Caractères source : ${sa.sourceChars} → ${sb.sourceChars}`);
  }
  if (sa.slidePlanCount !== sb.slidePlanCount) {
    lines.push(`· Slides (plan Copilot) : ${sa.slidePlanCount} → ${sb.slidePlanCount}`);
  }
  if (sa.pageCount !== sb.pageCount) {
    lines.push(`· Pages Polotno : ${sa.pageCount} → ${sb.pageCount}`);
  }
  if (sa.konvaSceneCount !== sb.konvaSceneCount) {
    lines.push(`· Scènes Konva : ${sa.konvaSceneCount} → ${sb.konvaSceneCount}`);
  }
  if (sa.elementCount !== sb.elementCount) {
    lines.push(`· Objets canvas (total) : ${sa.elementCount} → ${sb.elementCount}`);
  }
  if (sa.jsonLength !== sb.jsonLength) {
    lines.push(`· Taille JSON (~octets) : ${sa.jsonLength} → ${sb.jsonLength}`);
  }
  if (lines.length === 1) {
    lines.push('· Différences détectées mais non détaillées (champs hors indicateurs).');
  }
  return { identical: false, lines, left: sa, right: sb };
}
