/**
 * Pipeline d'import RÉEL du Studio LIRI (route `/studio/liri/import`).
 *
 * ── POURQUOI CE FICHIER ─────────────────────────────────────────────────────────
 * La page d'import fabriquait une fausse analyse (`setTimeout(…, 2200)` + chiffres en dur
 * « 10 sections détectées », « Images : 3 ») pour cinq de ses six types. On ne garde ici
 * QUE les chemins derrière lesquels un moteur EXISTE DÉJÀ et tourne en production :
 *
 *   · document → `extractTextFromFile` (pdfjs-dist / mammoth), le seul import qui faisait
 *                déjà un vrai travail, vers la Masterclass Factory ;
 *   · visuel   → téléversement dans le bucket `smartboard-canvas` + ligne `designer_ia_images`,
 *                c'est EXACTEMENT le chemin du panneau « Démarrer un projet → Importer » du
 *                SmartBoard Designer (`uploadSmartboardCanvasImage` + `insertDesignerUploadMetadata`) ;
 *   · projet   → validation réelle par `assertWorkspacePayload` (bundle workspace) ou
 *                `parseProjectJson` (export Konva brut), puis enregistrement cloud.
 *
 * ── COMMENT ON ATTERRIT DANS LE DESIGNER AVEC LE CONTENU ────────────────────────
 * `StudioSmartboardKonvaPage` lit `?workspace=<uuid>` (ou `?cw=`), récupère la ligne
 * `liri_course_workspaces` et hydrate l'éditeur (`hydrateWorkspaceIntoKonvaEditor`).
 * C'est la SEULE entrée du Designer qui charge un contenu venu d'une autre page sans
 * toucher au Designer lui-même — d'où le choix « on enregistre un workspace réel, puis on
 * navigue vers son uuid » plutôt qu'un bricolage localStorage (la clé de brouillon local
 * `liri_course_workspace_v1_draft` est réécrite toutes les 45 s par l'auto-save du Designer :
 * y écrire depuis ici écraserait le travail en cours de l'utilisateur).
 *
 * ── LIMITES : ELLES VIENNENT DE POSTGRES, PAS D'UN CAPRICE D'UI ─────────────────
 * Bucket `smartboard-canvas` : `file_size_limit = 52428800` (50 Mo) et `allowed_mime_types`
 * = jpeg/png/webp/gif/svg+xml/webm (migrations 202604302280 puis 202604302301). Ni PDF ni
 * MP4 ne passeront jamais dans ce bucket. Écriture RLS limitée à `{auth.uid()}/…` : l'import
 * exige donc une session. On refuse EN AMONT, avec un message utile, ce que la base refusera.
 */

import { supabase } from '@/lib/customSupabaseClient';
import { extractTextFromFile } from '@/lib/extractDocumentText';
import { uploadSmartboardCanvasImage } from '@/lib/uploadSmartboardCanvasImage';
import { insertDesignerUploadMetadata } from '@/features/smartboard-konva-editor/lib/designerIaImageHistory';
import {
  SB_KONVA_CANVAS_W,
  SB_KONVA_CANVAS_H,
  createEmptyProject,
  mkImageObject,
  parseProjectJson,
} from '@/features/smartboard-konva-editor/model/sceneModel';
import {
  LIRI_COURSE_WORKSPACE_FORMAT,
  assertWorkspacePayload,
  buildWorkspacePayload,
  summarizeWorkspacePayloadForCompare,
} from '@/features/smartboard-konva-editor/lib/courseWorkspaceBundle';
import { saveLiriCourseWorkspace } from '@/features/smartboard-konva-editor/lib/liriCourseWorkspaceSupabase';

/* ─── Limites réelles ─────────────────────────────────────────────────────────── */

export const IMPORT_LIMITS = {
  /** Lecture 100 % navigateur (pdfjs / mammoth) : au-delà l'onglet se fige. */
  documentBytes: 25 * 1024 * 1024,
  /** Plafond imposé par le bucket lui-même (`file_size_limit`, migration 202604302301). */
  visualBytes: 50 * 1024 * 1024,
  /** Le workspace part en colonne `jsonb` : au-delà l'insert devient hostile. */
  projectBytes: 8 * 1024 * 1024,
  /** Fenêtre de pré-remplissage de la Masterclass Factory (aligné sur l'existant). */
  factoryChars: 40_000,
};

/** Types MIME acceptés par le bucket `smartboard-canvas` — refusés par Postgres sinon. */
export const VISUAL_MIME_ALLOWLIST = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];

const VISUAL_EXT_TO_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

const DOCUMENT_EXTS = new Set(['pdf', 'docx', 'txt', 'md', 'text', 'markdown']);

/** Clé de pré-remplissage lue par `MasterclassFactoryPage` (ne pas renommer sans elle). */
export const MASTERCLASS_PREFILL_KEY = 'masterclass:prefillRawText';

export const MASTERCLASS_FACTORY_PATH = '/dashboard/tools/masterclass-factory';
export const SMARTBOARD_DESIGNER_PATH = '/studio/smartboard-designer';

/* ─── Utilitaires ─────────────────────────────────────────────────────────────── */

/** @param {number} bytes */
export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
  if (n >= 1024) return `${Math.round(n / 1024)} Ko`;
  return `${n} o`;
}

/** @param {File} file */
function extensionOf(file) {
  const name = typeof file?.name === 'string' ? file.name : '';
  const dot = name.lastIndexOf('.');
  return dot > -1 ? name.slice(dot + 1).toLowerCase() : '';
}

/** @param {File} file */
export function baseNameOf(file) {
  const name = typeof file?.name === 'string' && file.name ? file.name : 'Import';
  return name.replace(/\.[^.]+$/, '') || name;
}

/**
 * Message d'erreur volontairement ACTIONNABLE : on dit la taille reçue, la limite, et d'où
 * vient la limite. Un « fichier trop lourd » sec fait perdre du temps.
 * @param {File} file
 * @param {number} max
 * @param {string} origine
 */
function assertSize(file, max, origine) {
  if (!file || typeof file.size !== 'number') return;
  if (file.size > max) {
    throw new Error(
      `Fichier trop lourd : ${formatBytes(file.size)} pour un maximum de ${formatBytes(max)} (${origine}).`,
    );
  }
}

/** Une session est indispensable : la RLS écrit sous `{auth.uid()}/…`. */
async function assertSession() {
  const { data } = await supabase.auth.getSession();
  if (!data?.session) {
    throw new Error('Connectez-vous pour importer : le stockage est cloisonné par compte.');
  }
  return data.session;
}

/* ─── 1. Document de cours → Masterclass Factory ──────────────────────────────── */

/**
 * Extrait RÉELLEMENT le texte du document et le dépose pour la Masterclass Factory.
 * @param {File} file
 * @returns {Promise<{ chars: number, truncated: boolean, openPath: string, fileName: string }>}
 */
export async function importCourseDocument(file) {
  const ext = extensionOf(file);
  if (!DOCUMENT_EXTS.has(ext)) {
    throw new Error(
      `Format « .${ext || '?'} » non reconnu. Formats lus : PDF, Word (.docx), .txt, .md.`,
    );
  }
  assertSize(file, IMPORT_LIMITS.documentBytes, 'lecture dans le navigateur');

  let text = '';
  try {
    text = await extractTextFromFile(file);
  } catch (e) {
    throw new Error(
      `Lecture impossible (${e instanceof Error ? e.message : 'erreur inconnue'}). ` +
        'Si le PDF est protégé, exportez-le à nouveau sans mot de passe.',
    );
  }

  const clean = (text || '').trim();
  if (!clean) {
    throw new Error(
      "Aucun texte lisible : ce PDF est probablement un scan (des images de pages, pas du texte). " +
        'Passez-le à l’OCR, ou ouvrez la Masterclass Factory et collez le texte à la main.',
    );
  }

  const truncated = clean.length > IMPORT_LIMITS.factoryChars;
  try {
    window.localStorage.setItem(MASTERCLASS_PREFILL_KEY, clean.slice(0, IMPORT_LIMITS.factoryChars));
  } catch {
    throw new Error(
      'Le navigateur refuse d’écrire le texte extrait (stockage local plein ou navigation privée). ' +
        'Ouvrez la Masterclass Factory et collez le texte à la main.',
    );
  }

  return {
    chars: clean.length,
    truncated,
    openPath: MASTERCLASS_FACTORY_PATH,
    fileName: file.name || 'document',
  };
}

/* ─── 2. Ressource visuelle → SmartBoard Designer ─────────────────────────────── */

/**
 * MIME retenu pour le contrôle d'allow-list : `file.type` est parfois vide (glisser-déposer
 * depuis certaines apps), on retombe alors sur l'extension.
 * @param {File} file
 */
export function resolveVisualMime(file) {
  const declared = String(file?.type || '').toLowerCase();
  if (VISUAL_MIME_ALLOWLIST.includes(declared)) return declared;
  const byExt = VISUAL_EXT_TO_MIME[extensionOf(file)];
  return byExt || declared || '';
}

/**
 * Dimensions natives, pour poser l'image au bon ratio sur le canevas.
 * Renvoie `null` si le navigateur n'arrive pas à décoder (SVG sans taille intrinsèque…),
 * auquel cas on retombe sur un cadre par défaut : mieux qu'un import raté.
 * @param {File} file
 * @returns {Promise<{ width: number, height: number } | null>}
 */
export function readImageNaturalSize(file) {
  return new Promise((resolve) => {
    let url = '';
    try {
      url = URL.createObjectURL(file);
    } catch {
      resolve(null);
      return;
    }
    const img = new Image();
    const done = (value) => {
      try { URL.revokeObjectURL(url); } catch { /* déjà libéré */ }
      resolve(value);
    };
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      done(w > 0 && h > 0 ? { width: w, height: h } : null);
    };
    img.onerror = () => done(null);
    img.src = url;
  });
}

/**
 * Cadre centré sur le canevas SmartBoard (1037×750), en conservant le ratio.
 * @param {{ width: number, height: number } | null} natural
 */
export function fitImageOnSmartboard(natural) {
  const maxW = SB_KONVA_CANVAS_W * 0.86;
  const maxH = SB_KONVA_CANVAS_H * 0.86;
  let width = maxW;
  let height = maxH * 0.75;
  if (natural && natural.width > 0 && natural.height > 0) {
    const ratio = Math.min(maxW / natural.width, maxH / natural.height, 1);
    width = Math.round(natural.width * ratio);
    height = Math.round(natural.height * ratio);
  }
  return {
    width: Math.round(width),
    height: Math.round(height),
    x: Math.round((SB_KONVA_CANVAS_W - width) / 2),
    y: Math.round((SB_KONVA_CANVAS_H - height) / 2),
  };
}

/**
 * Enveloppe un projet Konva dans un bundle workspace v1 valide.
 * Le bloc `designerStudio` évite l'overlay « Nouveau document » à l'ouverture : sans lui,
 * `hydrateDesignerStudioFromPayload` devine `docType` — on préfère le dire explicitement.
 * @param {object} konvaProject
 */
function wrapKonvaProjectAsWorkspace(konvaProject) {
  return buildWorkspacePayload(
    konvaProject,
    { sourceText: '', activeSlideIndex: 0, course: null, globalSuggestions: null },
    { docType: 'smartboard', outputFormats: ['screen'], designerMode: 'design', studioQuickMode: 'analyse' },
  );
}

/**
 * Téléverse pour de bon l'image, l'ajoute à la galerie du Designer, puis crée un document
 * SmartBoard qui la contient.
 *
 * Dégradé assumé : si l'écriture du document échoue (table absente, session expirée…),
 * l'image EST quand même téléversée et visible dans le panneau Images du Designer — on le
 * dit dans `warning` au lieu de faire croire à un échec total.
 *
 * @param {File} file
 * @returns {Promise<{ workspaceId: string | null, openPath: string, url: string, storagePath: string,
 *   natural: { width: number, height: number } | null, placed: { width: number, height: number },
 *   inGallery: boolean, warning: string }>}
 */
export async function importVisualAsset(file) {
  const mime = resolveVisualMime(file);
  if (!VISUAL_MIME_ALLOWLIST.includes(mime)) {
    throw new Error(
      `Format « ${mime || `.${extensionOf(file) || '?'}`} » refusé par le stockage. ` +
        'Acceptés : PNG, JPEG, WebP, GIF, SVG.',
    );
  }
  assertSize(file, IMPORT_LIMITS.visualBytes, 'plafond du bucket smartboard-canvas');
  await assertSession();

  const natural = await readImageNaturalSize(file);
  const { url, path } = await uploadSmartboardCanvasImage(file);

  // Métadonnée = présence dans la galerie « Images » du Designer. Non bloquante :
  // l'image est déjà dans le bucket et utilisable même si la ligne échoue.
  let inGallery = false;
  try {
    const row = await insertDesignerUploadMetadata(supabase, {
      storagePath: path,
      prompt: file.name || 'Import Studio',
      publicUrl: url,
    });
    inGallery = Boolean(row?.id);
  } catch {
    inGallery = false;
  }

  const placed = fitImageOnSmartboard(natural);
  const project = createEmptyProject();
  project.scenes[0].name = baseNameOf(file).slice(0, 80);
  project.scenes[0].objects = [
    mkImageObject(url, { x: placed.x, y: placed.y, width: placed.width, height: placed.height, layer: 1 }),
  ];

  const payload = wrapKonvaProjectAsWorkspace(project);
  const { id, error } = await saveLiriCourseWorkspace({
    title: `Import — ${baseNameOf(file)}`.slice(0, 200),
    payload,
  });

  if (error || !id) {
    return {
      workspaceId: null,
      openPath: SMARTBOARD_DESIGNER_PATH,
      url,
      storagePath: path,
      natural,
      placed,
      inGallery,
      warning:
        `Image téléversée${inGallery ? ' et rangée dans la galerie Images' : ''}, mais le document ` +
        `n’a pas pu être créé : ${error?.message || 'raison inconnue'}. ` +
        'Ouvrez le Designer et reprenez l’image depuis le panneau Images.',
    };
  }

  return {
    workspaceId: id,
    openPath: `${SMARTBOARD_DESIGNER_PATH}?workspace=${id}`,
    url,
    storagePath: path,
    natural,
    placed,
    inGallery,
    warning: inGallery ? '' : 'Image posée sur le canevas, mais absente de la galerie Images (métadonnée refusée).',
  };
}

/* ─── 3. Projet / workspace LIRI → SmartBoard Designer ────────────────────────── */

/**
 * Lit un `.json` exporté par LIRI (bundle workspace complet OU projet Konva brut),
 * le VALIDE avec les mêmes fonctions que l'éditeur, l'enregistre en workspace cloud
 * et renvoie de quoi l'ouvrir.
 *
 * @param {File} file
 * @returns {Promise<{ workspaceId: string, openPath: string, kind: 'workspace' | 'konva',
 *   summary: ReturnType<typeof summarizeWorkspacePayloadForCompare>, title: string }>}
 */
export async function importLiriProject(file) {
  if (extensionOf(file) !== 'json') {
    throw new Error(
      `Format « .${extensionOf(file) || '?'} » non reconnu. Attendu : un export .json ` +
        '(bouton « Exporter » du SmartBoard Designer). Les archives .zip ne sont pas décompressées ici.',
    );
  }
  assertSize(file, IMPORT_LIMITS.projectBytes, 'taille du document enregistré en base');
  await assertSession();

  const raw = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('JSON illisible : le fichier est tronqué ou n’est pas du JSON.');
  }

  /** @type {'workspace' | 'konva'} */
  let kind;
  let payload;
  if (parsed && typeof parsed === 'object' && parsed.format === LIRI_COURSE_WORKSPACE_FORMAT) {
    // Bundle complet : même validation que l'import de l'éditeur (messages déjà en français).
    payload = assertWorkspacePayload(parsed);
    kind = 'workspace';
  } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.scenes)) {
    // Export Konva brut (`serializeProject`) : on l'enveloppe dans un bundle v1.
    payload = wrapKonvaProjectAsWorkspace(parseProjectJson(raw));
    kind = 'konva';
  } else {
    throw new Error(
      'Structure non reconnue : attendu un workspace LIRI (champ « format ») ou un projet ' +
        'Konva (champ « scenes »).',
    );
  }

  const summary = summarizeWorkspacePayloadForCompare(payload);
  if (!summary.konvaSceneCount && !summary.pageCount) {
    throw new Error('Projet vide : aucune scène à ouvrir dans le Designer.');
  }

  const title = (summary.courseTitle || baseNameOf(file) || 'Projet importé').slice(0, 200);
  const { id, error } = await saveLiriCourseWorkspace({ title, payload });
  if (error || !id) {
    throw new Error(error?.message || 'Enregistrement du projet impossible.');
  }

  return {
    workspaceId: id,
    openPath: `${SMARTBOARD_DESIGNER_PATH}?workspace=${id}`,
    kind,
    summary,
    title,
  };
}
