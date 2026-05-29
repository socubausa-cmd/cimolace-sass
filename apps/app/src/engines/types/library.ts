// ─── Community Library Types ──────────────────────────────────────────────────

export type LibraryItemCategory =
  | 'image'
  | 'vector'
  | 'lut'
  | 'template'
  | 'project';

export type LibraryTheme =
  | 'education'
  | 'spiritual'
  | 'science'
  | 'business'
  | 'art'
  | 'technology'
  | 'nature'
  | 'history';

export type LibraryUsableIn = 'designer' | 'builder' | 'live' | 'export';

export type CompatibilityScore = 100 | 70 | 30;

export type LibraryItem = {
  id: string;
  title: string;
  category: LibraryItemCategory;
  tags: string[];
  theme: LibraryTheme | string;
  preview: string;          // preview image URL
  asset: string;            // actual file URL or base64
  compatibility: CompatibilityScore;
  usable_in: LibraryUsableIn[];
  created_at: string;
  author?: string;
  authorId?: string;
  source: 'personal' | 'community';
  downloads?: number;
  likes?: number;
  liked?: boolean;
  fileType?: string;        // 'png' | 'svg' | 'cube' | 'json' | etc.
  fileSize?: number;        // bytes
  width?: number;
  height?: number;
  // For LUT items
  lutData?: string;         // .cube file content
  // For template items
  templateData?: object;    // parsed JSON
  // For project items
  projectData?: object;     // SmartBoard project JSON
};

export type Library = {
  personal: LibraryItem[];
  community: LibraryItem[];
};

// ── Import pipeline ───────────────────────────────────────────────────────────

export type ImportStep = 'idle' | 'uploading' | 'analyzing' | 'previewing' | 'converting' | 'saving' | 'done' | 'error';

export type ImportAnalysis = {
  detectedCategory: LibraryItemCategory;
  detectedFileType: string;
  compatibility: CompatibilityScore;
  compatibilityReason: string;
  suggestedTags: string[];
  suggestedTheme: LibraryTheme;
  needsConversion: boolean;
  conversionNote?: string;
  width?: number;
  height?: number;
  fileSize?: number;
};

export type ImportJob = {
  id: string;
  file: File | null;
  url?: string;
  step: ImportStep;
  analysis: ImportAnalysis | null;
  preview: string | null;
  error?: string;
  progress: number;
};

// ── Filters ───────────────────────────────────────────────────────────────────

export type LibraryFilters = {
  category: LibraryItemCategory | 'all';
  theme: LibraryTheme | 'all';
  compatibility: CompatibilityScore | 'all';
  source: 'personal' | 'community' | 'all';
  search: string;
  usableIn: LibraryUsableIn | 'all';
};

export const DEFAULT_LIBRARY_FILTERS: LibraryFilters = {
  category: 'all',
  theme: 'all',
  compatibility: 'all',
  source: 'all',
  search: '',
  usableIn: 'all',
};

// ── Drag payload (for drop into designer) ─────────────────────────────────────

export type LibraryDragPayload = {
  type: 'library-item';
  item: LibraryItem;
};
