/**
 * Asset Engine — asset loading, caching, categorization, and search.
 */
import type { Asset, IconAsset, FontAsset } from '@/stores/assets.store';

// ── Cache ─────────────────────────────────────────────────────────────────────

const imageCache = new Map<string, HTMLImageElement>();

export function preloadImage(url: string): Promise<HTMLImageElement> {
  if (imageCache.has(url)) return Promise.resolve(imageCache.get(url)!);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { imageCache.set(url, img); resolve(img); };
    img.onerror = reject;
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

export function getCachedImage(url: string): HTMLImageElement | null {
  return imageCache.get(url) ?? null;
}

export function clearImageCache(): void {
  imageCache.clear();
}

// ── Font loading ──────────────────────────────────────────────────────────────

const loadedFonts = new Set<string>();

export async function loadGoogleFont(family: string, weights: string[] = ['400', '700']): Promise<void> {
  const key = `${family}-${weights.join(',')}`;
  if (loadedFonts.has(key)) return;

  const encodedFamily = encodeURIComponent(family);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodedFamily}:wght@${weights.join(';')}&display=swap`;
  document.head.appendChild(link);

  await document.fonts.load(`16px "${family}"`);
  loadedFonts.add(key);
}

export function isFontLoaded(family: string): boolean {
  return loadedFonts.has(family) || document.fonts.check(`16px "${family}"`);
}

// ── Asset categorization ──────────────────────────────────────────────────────

export const ICON_CATEGORIES = [
  'arrows', 'charts', 'communication', 'design', 'education',
  'interface', 'media', 'navigation', 'objects', 'science',
] as const;

export type IconCategory = typeof ICON_CATEGORIES[number];

/**
 * Scores an icon search result by relevance.
 */
export function scoreIconSearch(icon: IconAsset, query: string): number {
  const q = query.toLowerCase();
  let score = 0;
  if (icon.name.toLowerCase() === q) score += 10;
  if (icon.name.toLowerCase().startsWith(q)) score += 5;
  if (icon.name.toLowerCase().includes(q)) score += 3;
  score += icon.tags.filter((t) => t.includes(q)).length * 2;
  return score;
}

/**
 * Sorts and filters icon assets by search query.
 */
export function searchIcons(icons: IconAsset[], query: string): IconAsset[] {
  if (!query.trim()) return icons;
  return icons
    .map((icon) => ({ icon, score: scoreIconSearch(icon, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ icon }) => icon);
}

// ── Upload helpers ────────────────────────────────────────────────────────────

export type UploadOptions = {
  maxSizeMb?: number;
  allowedTypes?: string[];
};

export type UploadResult = {
  ok: boolean;
  url?: string;
  name?: string;
  size?: number;
  width?: number;
  height?: number;
  error?: string;
};

const DEFAULT_UPLOAD_OPTIONS: UploadOptions = {
  maxSizeMb: 10,
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'],
};

export function validateFile(file: File, options: UploadOptions = DEFAULT_UPLOAD_OPTIONS): string | null {
  const maxBytes = (options.maxSizeMb ?? 10) * 1024 * 1024;
  if (file.size > maxBytes) return `Fichier trop grand (max ${options.maxSizeMb}MB)`;
  const allowed = options.allowedTypes ?? [];
  if (allowed.length > 0 && !allowed.includes(file.type)) {
    return `Type de fichier non supporte (${file.type})`;
  }
  return null;
}

export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  const img = await preloadImage(url);
  return { width: img.naturalWidth, height: img.naturalHeight };
}

// ── Unsplash integration ──────────────────────────────────────────────────────

export type UnsplashPhoto = {
  id: string;
  url: string;
  thumbnail: string;
  author: string;
  authorUrl: string;
  width: number;
  height: number;
};

export async function searchUnsplash(query: string, page = 1): Promise<UnsplashPhoto[]> {
  const res = await fetch(`/api/liri/unsplash?q=${encodeURIComponent(query)}&page=${page}`);
  if (!res.ok) return [];
  const data = await res.json() as { results: UnsplashPhoto[] };
  return data.results ?? [];
}
