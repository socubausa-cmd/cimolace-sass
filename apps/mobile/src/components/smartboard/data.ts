/**
 * Couche données du moteur SmartBoard (RÉELLE).
 *
 * Table : `liri_course_workspaces` (colonne `payload` JSONB = SbKonvaProject).
 *  - RLS : la lecture/écriture exige une session Supabase connectée.
 *    Sans session → on renvoie un état vide honnête (jamais de fausse maquette).
 *  - Repli offline : AsyncStorage conserve le dernier brouillon local pour
 *    reprendre le travail hors connexion (clé par workspace ou « local »).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

import { coerceProject } from './model';
import type { SbKonvaProject, WorkspaceFull, WorkspaceRow } from './types';

const LOCAL_KEY_PREFIX = 'smartboard:draft:';
const LOCAL_FALLBACK_KEY = `${LOCAL_KEY_PREFIX}local`;

/** Traduit une erreur Supabase en message FR lisible (migrations / session). */
function mapError(raw: unknown): string {
  const msg = raw instanceof Error ? raw.message : String(raw ?? '');
  const m = msg.toLowerCase();
  if (m.includes('jwt') || m.includes('invalid claim') || msg.includes('401')) {
    return 'Session expirée — reconnecte-toi.';
  }
  if (m.includes('permission denied') || m.includes('rls') || msg.includes('403')) {
    return 'Accès refusé — vérifie la connexion (RLS).';
  }
  if (m.includes('does not exist') || m.includes('could not find the table')) {
    return 'Table `liri_course_workspaces` absente : migration Supabase requise.';
  }
  return msg || 'Erreur inconnue';
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

/** Liste des brouillons cloud de l'utilisateur connecté. Vide si non connecté. */
export async function fetchWorkspaceList(): Promise<{
  rows: WorkspaceRow[];
  error: string | null;
}> {
  const session = await getSession();
  if (!session) {
    return { rows: [], error: null }; // état vide honnête, pas une erreur bloquante
  }
  const { data, error } = await supabase
    .from('liri_course_workspaces')
    .select('id, title, updated_at, user_id, lifecycle_status')
    .eq('user_id', session.user.id)
    .order('updated_at', { ascending: false })
    .limit(40);
  if (error) {
    return { rows: [], error: mapError(error) };
  }
  return { rows: (data as WorkspaceRow[]) ?? [], error: null };
}

/** Charge un workspace complet (payload désérialisé) par id. */
export async function fetchWorkspaceById(
  id: string,
): Promise<{ workspace: WorkspaceFull | null; error: string | null }> {
  const session = await getSession();
  if (!session) {
    return { workspace: null, error: 'Non connecté' };
  }
  const { data, error } = await supabase
    .from('liri_course_workspaces')
    .select('id, title, payload, user_id, lifecycle_status')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    return { workspace: null, error: mapError(error) };
  }
  if (!data) {
    return { workspace: null, error: 'Brouillon introuvable' };
  }
  const row = data as {
    id: string;
    title: string;
    payload: unknown;
    user_id: string;
    lifecycle_status?: string | null;
  };
  return {
    workspace: {
      id: row.id,
      title: row.title,
      user_id: row.user_id,
      lifecycle_status: row.lifecycle_status,
      project: coerceProject(row.payload),
    },
    error: null,
  };
}

/**
 * Sauvegarde cloud (upsert) : update si `id`, insert sinon.
 * Renvoie l'id (nouveau ou existant). Sauvegarde TOUJOURS une copie locale.
 */
export async function saveWorkspace(args: {
  id: string | null;
  title: string;
  project: SbKonvaProject;
}): Promise<{ id: string | null; error: string | null; offline: boolean }> {
  const { id, title, project } = args;
  const safeTitle = (title || 'Sans titre').slice(0, 200);

  // Copie locale immédiate (repli offline) — best effort.
  await saveLocalDraft(id, { title: safeTitle, project }).catch(() => undefined);

  const session = await getSession();
  if (!session) {
    return { id, error: 'Connecte-toi pour enregistrer sur le cloud.', offline: true };
  }

  if (id) {
    const { data, error } = await supabase
      .from('liri_course_workspaces')
      .update({ title: safeTitle, payload: project })
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) {
      return { id, error: mapError(error), offline: true };
    }
    return { id: (data as { id: string } | null)?.id ?? id, error: null, offline: false };
  }

  const { data, error } = await supabase
    .from('liri_course_workspaces')
    .insert({ user_id: session.user.id, title: safeTitle, payload: project })
    .select('id')
    .single();
  if (error) {
    return { id: null, error: mapError(error), offline: true };
  }
  return { id: (data as { id: string }).id, error: null, offline: false };
}

// ── Repli local (AsyncStorage) ────────────────────────────────────────────────

function localKey(id: string | null): string {
  return id ? `${LOCAL_KEY_PREFIX}${id}` : LOCAL_FALLBACK_KEY;
}

export async function saveLocalDraft(
  id: string | null,
  payload: { title: string; project: SbKonvaProject },
): Promise<void> {
  await AsyncStorage.setItem(
    localKey(id),
    JSON.stringify({ ...payload, savedAt: Date.now() }),
  );
}

export async function loadLocalDraft(
  id: string | null,
): Promise<{ title: string; project: SbKonvaProject } | null> {
  const raw = await AsyncStorage.getItem(localKey(id));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { title?: string; project?: unknown };
    return {
      title: typeof parsed.title === 'string' ? parsed.title : 'Brouillon local',
      project: coerceProject(parsed.project),
    };
  } catch {
    return null;
  }
}
