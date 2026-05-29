/**
 * Library Engine — analyze, preview, convert, and route library items.
 * Pipeline: import → analyze → preview → convert → save → use
 */
import type {
  LibraryItem, LibraryItemCategory, ImportAnalysis,
  CompatibilityScore, LibraryTheme,
} from '@/engines/types/library';
import type { DesignElement } from '@/engines/types/design';
import { makeImageElement, makeTextElement, makeRectElement } from '@/engines/konva-engine';
import { readFileAsDataUrl, validateFile } from '@/engines/asset-engine';

// ── File type detection ───────────────────────────────────────────────────────

export function detectFileType(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeMap: Record<string, string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'application/pdf': 'pdf',
    'application/json': 'json',
  };
  if (file.type && mimeMap[file.type]) return mimeMap[file.type];
  return ext;
}

export function detectCategory(fileType: string): LibraryItemCategory {
  const imageTypes = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
  const vectorTypes = ['svg', 'pdf'];
  const lutTypes = ['cube', '3dl', 'lut'];
  const templateTypes = ['json'];

  if (imageTypes.includes(fileType)) return 'image';
  if (vectorTypes.includes(fileType)) return 'vector';
  if (lutTypes.includes(fileType)) return 'lut';
  if (templateTypes.includes(fileType)) return 'template';
  return 'project';
}

// ── Compatibility scoring ─────────────────────────────────────────────────────

export function scoreCompatibility(category: LibraryItemCategory, fileType: string): {
  score: CompatibilityScore;
  reason: string;
  needsConversion: boolean;
  note?: string;
} {
  switch (category) {
    case 'image':
      if (['png', 'jpg', 'jpeg', 'webp'].includes(fileType)) {
        return { score: 100, reason: 'Format image natif — compatible direct', needsConversion: false };
      }
      if (fileType === 'gif') {
        return { score: 70, reason: 'GIF supporté mais animation ignorée', needsConversion: false };
      }
      return { score: 30, reason: 'Format non optimal', needsConversion: true };

    case 'vector':
      if (fileType === 'svg') {
        return { score: 100, reason: 'SVG natif — rendu parfait dans le Designer', needsConversion: false };
      }
      if (fileType === 'pdf') {
        return { score: 70, reason: 'PDF vectoriel — extraction premiere page', needsConversion: true, note: 'Conversion PDF → SVG requise' };
      }
      return { score: 30, reason: 'Format vectoriel non reconnu', needsConversion: true };

    case 'lut':
      if (fileType === 'cube') {
        return { score: 100, reason: 'Format .cube standard — LUT native LIRI', needsConversion: false };
      }
      return { score: 30, reason: 'Format LUT non standard — conversion vers .cube requise', needsConversion: true, note: 'Conversion LUT requise' };

    case 'template':
      return { score: 100, reason: 'Template JSON LIRI — compatible direct', needsConversion: false };

    case 'project':
      return { score: 70, reason: 'Projet partiel — importation selective', needsConversion: false };

    default:
      return { score: 30, reason: 'Type inconnu — compatibilite limitee', needsConversion: true };
  }
}

// ── Tag suggestion ────────────────────────────────────────────────────────────

const THEME_KEYWORDS: Record<LibraryTheme, string[]> = {
  education: ['cours', 'apprendre', 'lecon', 'etude', 'eleve', 'enseignement', 'school', 'learn'],
  spiritual: ['spirituel', 'meditation', 'ame', 'esprit', 'sacred', 'ritual', 'initiation'],
  science: ['physique', 'chimie', 'biologie', 'math', 'formule', 'experience', 'lab', 'atom'],
  business: ['strategie', 'vente', 'marche', 'croissance', 'profit', 'client', 'entreprise'],
  art: ['design', 'couleur', 'forme', 'illustration', 'peinture', 'art', 'creatif'],
  technology: ['code', 'dev', 'tech', 'digital', 'app', 'logiciel', 'ia', 'ai', 'robot'],
  nature: ['nature', 'foret', 'eau', 'plante', 'animal', 'terre', 'ciel', 'mer'],
  history: ['histoire', 'afrique', 'antique', 'civilisation', 'culture', 'heritage'],
};

export function suggestTagsFromFilename(filename: string): string[] {
  const name = filename.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = name.split(/\s+/).filter((w) => w.length > 2);
  return [...new Set(words)].slice(0, 6);
}

export function suggestTheme(filename: string, tags: string[]): LibraryTheme {
  const text = `${filename} ${tags.join(' ')}`.toLowerCase();
  let bestTheme: LibraryTheme = 'education';
  let bestScore = 0;

  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS) as [LibraryTheme, string[]][]) {
    const score = keywords.filter((kw) => text.includes(kw)).length;
    if (score > bestScore) { bestScore = score; bestTheme = theme; }
  }
  return bestTheme;
}

// ── Full analysis pipeline ────────────────────────────────────────────────────

export async function analyzeImport(file: File): Promise<ImportAnalysis> {
  const fileType = detectFileType(file);
  const category = detectCategory(fileType);
  const { score, reason, needsConversion, note } = scoreCompatibility(category, fileType);
  const tags = suggestTagsFromFilename(file.name);
  const theme = suggestTheme(file.name, tags);

  let width: number | undefined;
  let height: number | undefined;

  if (['image', 'vector'].includes(category) && fileType !== 'pdf') {
    try {
      const url = URL.createObjectURL(file);
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => { width = img.naturalWidth; height = img.naturalHeight; URL.revokeObjectURL(url); resolve(); };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        img.src = url;
      });
    } catch { /* ignore */ }
  }

  return {
    detectedCategory: category,
    detectedFileType: fileType,
    compatibility: score,
    compatibilityReason: reason,
    suggestedTags: tags,
    suggestedTheme: theme,
    needsConversion,
    conversionNote: note,
    width,
    height,
    fileSize: file.size,
  };
}

// ── Preview generation ────────────────────────────────────────────────────────

export async function generatePreview(file: File, category: LibraryItemCategory): Promise<string> {
  if (['image', 'vector'].includes(category)) {
    return readFileAsDataUrl(file);
  }
  if (category === 'lut') {
    // Return a gradient preview for LUT files
    return generateLutPreviewDataUrl();
  }
  if (category === 'template') {
    return generateTemplatePreviewDataUrl();
  }
  return '';
}

function generateLutPreviewDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 80;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 160, 0);
  grad.addColorStop(0, '#1a0533');
  grad.addColorStop(0.33, '#D4AF37');
  grad.addColorStop(0.66, '#0ea5e9');
  grad.addColorStop(1, '#f0fdf4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 160, 80);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.font = 'bold 12px Inter, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText('LUT', 80, 46);
  return canvas.toDataURL();
}

function generateTemplatePreviewDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 90;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0f1117';
  ctx.fillRect(0, 0, 160, 90);
  ctx.fillStyle = '#D4AF37';
  ctx.fillRect(12, 12, 136, 6);
  ctx.fillStyle = '#334155';
  ctx.fillRect(12, 28, 100, 4);
  ctx.fillRect(12, 38, 80, 4);
  ctx.fillRect(12, 52, 136, 24);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(84, 28, 64, 20);
  return canvas.toDataURL();
}

// ── Conversion ────────────────────────────────────────────────────────────────

export async function convertToLiriFormat(file: File, analysis: ImportAnalysis): Promise<string> {
  // Most formats are used as-is. Only PDF → needs server-side conversion.
  if (analysis.detectedFileType === 'pdf') {
    // In production: call /api/liri/pdf-to-svg
    // For now: return placeholder
    return readFileAsDataUrl(file);
  }
  return readFileAsDataUrl(file);
}

// ── Use in Designer ───────────────────────────────────────────────────────────

/**
 * Converts a library item to a DesignElement for the Konva canvas.
 */
export function libraryItemToElement(item: LibraryItem, x = 200, y = 200): DesignElement | null {
  switch (item.category) {
    case 'image':
      return makeImageElement({ url: item.asset, x, y, width: item.width ?? 400, height: item.height ?? 300 });

    case 'vector':
      return {
        id: `el-${Date.now()}`,
        type: 'svg',
        x, y,
        width: item.width ?? 300,
        height: item.height ?? 300,
        opacity: 1,
        locked: false,
        hidden: false,
        sectionId: null,
        data: { svgContent: item.asset, url: item.asset },
        style: {},
      };

    case 'lut':
      // LUT is applied to existing elements, not dropped as a new element
      return null;

    case 'template':
      // Template imports multiple elements — handled separately
      return null;

    default:
      return null;
  }
}

/**
 * Extracts DesignElements from a template library item.
 */
export function extractTemplateElements(item: LibraryItem): DesignElement[] {
  if (item.category !== 'template' || !item.templateData) return [];
  const data = item.templateData as { elements?: DesignElement[] };
  return data.elements ?? [];
}

/**
 * Applies a LUT to an element's adjustments.
 */
export function applyLutToElement(element: DesignElement, item: LibraryItem): DesignElement {
  if (item.category !== 'lut') return element;
  return {
    ...element,
    data: {
      ...(element.data as object),
      adjustments: {
        ...((element.data as Record<string, unknown>).adjustments ?? {}),
        lut: item.id,
        lutName: item.title,
        lutData: item.lutData,
      },
    },
  };
}
