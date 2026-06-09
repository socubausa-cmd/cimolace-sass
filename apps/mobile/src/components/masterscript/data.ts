import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE, currentToken, TENANT_SLUG } from '@/lib/liri-api';

/**
 * Couche données « Lecteur Masterclass » (masterscript) — branchée sur l'API réelle ISNA.
 *
 * Endpoints (MasterclassFactoryController, table liri_projects) :
 *  - GET /masterclass-factory/projects      → liste des projets du tenant
 *  - GET /masterclass-factory/projects/:id  → projet complet (chapters/blocks/analysis)
 *
 * RLS : ces routes exigent une session connectée (JwtAuthGuard + TenantGuard + Roles).
 * Sans token → on renvoie des valeurs vides honnêtes (jamais de fausses maquettes).
 *
 * Progression locale : AsyncStorage, clé `masterscript_progress_:id`
 *   → { completedChapterIds: string[] }
 */

// ── Types (alignés sur apps/app/src/lib/liri-masterclass/types.ts) ───────────

export interface MasterclassProjectSummary {
  id: string;
  title: string;
  status: string;
  pedagogical_model?: string;
  chapter_count?: number;
  created_at?: string;
}

export interface MasterclassAnalysis {
  global_subject?: string;
  intention?: string;
  audience?: string;
  difficulty?: string;
  difficulty_score?: number;
  estimated_total_duration?: string;
  central_themes?: string[];
  global_revelations?: string[];
}

export interface MasterclassExample {
  type?: string;
  content?: string;
}

export interface MasterclassUnderstandingTest {
  question: string;
  expected_answer: string;
}

export interface MasterclassChapter {
  chapter_id: number | string;
  title: string;
  objective?: string;
  skill_to_acquire?: string;
  knowledge_to_transmit?: string;
  revelation_moment?: string;
  pedagogical_tension?: string;
  examples?: MasterclassExample[];
  je_retiens?: string[];
  understanding_test?: MasterclassUnderstandingTest[];
}

export interface MasterclassProjectDetail {
  id: string;
  title: string;
  sourceText?: string;
  status?: string;
  analysis?: MasterclassAnalysis | null;
  chapters: MasterclassChapter[];
  blocks?: unknown[];
}

export interface MasterscriptProgress {
  completedChapterIds: string[];
}

// ── Accès API ────────────────────────────────────────────────────────────────

/**
 * GET authentifié déballant l'enveloppe {data:…} de l'API (ResponseInterceptor).
 * `getJson` n'étant pas exporté par liri-api, on reproduit ici le même contrat
 * (Authorization Bearer + X-Tenant-Slug). Renvoie null si non connecté / erreur.
 */
async function getJson<T>(path: string): Promise<T | null> {
  const token = currentToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': TENANT_SLUG },
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    return ((json as { data?: T })?.data ?? (json as T)) ?? null;
  } catch {
    return null;
  }
}

/** Déballe une liste éventuellement enveloppée ({data:[…]} ou […]). */
function asArray<T>(raw: { data?: T[] } | T[] | null): T[] {
  if (Array.isArray(raw)) return raw;
  const inner = (raw as { data?: T[] } | null)?.data;
  return Array.isArray(inner) ? inner : [];
}

/** Liste des projets masterclass du tenant. [] si non connecté / vide. */
export async function fetchProjects(): Promise<MasterclassProjectSummary[]> {
  const raw = await getJson<{ data?: MasterclassProjectSummary[] } | MasterclassProjectSummary[]>(
    '/masterclass-factory/projects',
  );
  return asArray(raw);
}

/**
 * Projet complet (payload chapters/blocks/analysis). Tolère les variantes de
 * colonnes brutes de `liri_projects` (source_text, analysis_json, chapters_json…).
 * Renvoie null si non connecté / introuvable.
 */
export async function fetchProject(id: string): Promise<MasterclassProjectDetail | null> {
  const raw = await getJson<Record<string, unknown>>(
    `/masterclass-factory/projects/${encodeURIComponent(id)}`,
  );
  if (!raw) return null;
  return normalizeProject(raw);
}

/** Normalise un enregistrement brut en MasterclassProjectDetail exploitable. */
function normalizeProject(raw: Record<string, unknown>): MasterclassProjectDetail {
  const chaptersSrc =
    (raw.chapters as unknown) ?? (raw.chapters_json as unknown) ?? (raw.pedagogy as unknown);
  const analysisSrc = (raw.analysis as unknown) ?? (raw.analysis_json as unknown);

  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? 'Masterclass'),
    sourceText: (raw.sourceText as string) ?? (raw.source_text as string) ?? '',
    status: (raw.status as string) ?? undefined,
    analysis: (analysisSrc as MasterclassAnalysis) ?? null,
    chapters: Array.isArray(chaptersSrc) ? (chaptersSrc as MasterclassChapter[]) : [],
    blocks: Array.isArray(raw.blocks) ? (raw.blocks as unknown[]) : [],
  };
}

// ── Progression locale (AsyncStorage) ────────────────────────────────────────

const progressKey = (projectId: string) => `masterscript_progress_${projectId}`;

/** Identifiant stable d'un chapitre (chapter_id → string). */
export function chapterKey(chapter: MasterclassChapter, index: number): string {
  const raw = chapter.chapter_id;
  return raw === undefined || raw === null || raw === '' ? `idx-${index}` : String(raw);
}

/** Lit la progression locale d'un projet. {completedChapterIds:[]} par défaut. */
export async function loadProgress(projectId: string): Promise<MasterscriptProgress> {
  try {
    const raw = await AsyncStorage.getItem(progressKey(projectId));
    if (!raw) return { completedChapterIds: [] };
    const parsed = JSON.parse(raw) as Partial<MasterscriptProgress>;
    const ids = Array.isArray(parsed.completedChapterIds) ? parsed.completedChapterIds : [];
    return { completedChapterIds: ids.map(String) };
  } catch {
    return { completedChapterIds: [] };
  }
}

/** Marque un chapitre comme complété (idempotent). Renvoie la progression à jour. */
export async function markChapterComplete(
  projectId: string,
  chapterId: string,
): Promise<MasterscriptProgress> {
  const current = await loadProgress(projectId);
  if (current.completedChapterIds.includes(chapterId)) return current;
  const next: MasterscriptProgress = {
    completedChapterIds: [...current.completedChapterIds, chapterId],
  };
  try {
    await AsyncStorage.setItem(progressKey(projectId), JSON.stringify(next));
  } catch {
    /* stockage indisponible : on garde la progression en mémoire pour la session */
  }
  return next;
}
