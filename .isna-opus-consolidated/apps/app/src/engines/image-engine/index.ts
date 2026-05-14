/**
 * Image Engine — crop, mask, filters, LUT, adjustments, and async operations.
 */
import type { DesignElement } from '@/engines/types';

// ── Types ────────────────────────────────────────────────────────────────────

export type CropBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MaskShape = 'rect' | 'ellipse' | 'custom-path';

export type ImageFilter = {
  type: 'brightness' | 'contrast' | 'saturation' | 'blur' | 'grayscale' | 'sepia' | 'hue';
  value: number;
};

export type FilterStack = ImageFilter[];

export type LutPreset =
  | 'none'
  | 'cool'
  | 'warm'
  | 'vintage'
  | 'dramatic'
  | 'matte'
  | 'fade';

export type ImageAdjustments = {
  brightness: number;  // -100 to 100
  contrast: number;    // -100 to 100
  saturation: number;  // -100 to 100
  blur: number;        // 0 to 100
  grayscale: boolean;
  sepia: boolean;
  hue: number;         // 0 to 360
  lut: LutPreset;
};

export const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  blur: 0,
  grayscale: false,
  sepia: false,
  hue: 0,
  lut: 'none',
};

// ── Filter composition ────────────────────────────────────────────────────────

/**
 * Converts ImageAdjustments to a CSS filter string for preview rendering.
 */
export function adjustmentsToCssFilter(adj: ImageAdjustments): string {
  const filters: string[] = [];
  if (adj.brightness !== 0) filters.push(`brightness(${1 + adj.brightness / 100})`);
  if (adj.contrast !== 0) filters.push(`contrast(${1 + adj.contrast / 100})`);
  if (adj.saturation !== 0) filters.push(`saturate(${1 + adj.saturation / 100})`);
  if (adj.blur > 0) filters.push(`blur(${adj.blur * 0.1}px)`);
  if (adj.grayscale) filters.push('grayscale(1)');
  if (adj.sepia) filters.push('sepia(0.7)');
  if (adj.hue !== 0) filters.push(`hue-rotate(${adj.hue}deg)`);
  return filters.join(' ') || 'none';
}

/**
 * Applies LUT preset as CSS adjustments (approximation).
 */
export function lutToAdjustments(lut: LutPreset): Partial<ImageAdjustments> {
  const presets: Record<LutPreset, Partial<ImageAdjustments>> = {
    none: {},
    cool: { saturation: -20, hue: 200, brightness: 5 },
    warm: { saturation: 20, hue: 30, brightness: 5 },
    vintage: { saturation: -30, contrast: -10, sepia: true },
    dramatic: { contrast: 40, saturation: -20 },
    matte: { brightness: 10, contrast: -20, saturation: -10 },
    fade: { brightness: 20, contrast: -30, saturation: -20 },
  };
  return presets[lut] ?? {};
}

// ── Crop ──────────────────────────────────────────────────────────────────────

/**
 * Returns the display style for a cropped image inside its element bounds.
 */
export function computeCropStyle(
  elementWidth: number,
  elementHeight: number,
  crop: CropBox,
  imageNaturalWidth: number,
  imageNaturalHeight: number,
): React.CSSProperties {
  const scaleX = elementWidth / crop.width;
  const scaleY = elementHeight / crop.height;
  return {
    width: imageNaturalWidth * scaleX,
    height: imageNaturalHeight * scaleY,
    objectFit: 'none',
    objectPosition: `-${crop.x * scaleX}px -${crop.y * scaleY}px`,
  };
}

// ── Async operations (hooks to external services) ─────────────────────────────

/**
 * Requests background removal via the LIRI API.
 * Returns a data URL of the transparent PNG.
 */
export async function removeBackground(imageUrl: string): Promise<string> {
  const res = await fetch('/api/liri/remove-background', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl }),
  });
  if (!res.ok) throw new Error(`Background removal failed: ${res.status}`);
  const { url } = await res.json() as { url: string };
  return url;
}

/**
 * Vectorizes an image via the LIRI API.
 * Returns an SVG string.
 */
export async function vectorizeImage(imageUrl: string): Promise<string> {
  const res = await fetch('/api/liri/vectorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl }),
  });
  if (!res.ok) throw new Error(`Vectorization failed: ${res.status}`);
  const { svg } = await res.json() as { svg: string };
  return svg;
}

/**
 * Applies adjustments to an element's data and returns the updated element.
 */
export function applyAdjustmentsToElement(
  element: DesignElement,
  adjustments: Partial<ImageAdjustments>,
): DesignElement {
  return {
    ...element,
    data: {
      ...(element.data as Record<string, unknown>),
      adjustments: { ...DEFAULT_ADJUSTMENTS, ...(element.data as Record<string, unknown>).adjustments, ...adjustments },
    },
  };
}

/**
 * Applies a crop box to an element.
 */
export function applyCropToElement(element: DesignElement, crop: CropBox): DesignElement {
  return {
    ...element,
    data: { ...(element.data as Record<string, unknown>), crop },
  };
}

// React import only for type (not bundled if unused)
declare const React: { CSSProperties: Record<string, unknown> };
type ReactCSSProperties = Record<string, string | number>;
