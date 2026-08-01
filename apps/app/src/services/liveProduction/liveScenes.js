import { supabase } from '@/lib/customSupabaseClient';

export async function listScenes(liveSessionId) {
  return supabase
    .from('live_scenes')
    .select('*')
    .eq('live_session_id', liveSessionId)
    .order('order_index', { ascending: true });
}

export async function upsertScene(liveSessionId, scene) {
  const base = {
    live_session_id: liveSessionId,
    name: scene.name ?? 'Scène',
    scene_type: scene.scene_type ?? 'camera_only',
    order_index: scene.order_index ?? 0,
    content_payload_json: scene.content_payload_json ?? {},
    is_preset: scene.is_preset ?? false,
    preset_name: scene.preset_name ?? null,
    is_active: scene.is_active ?? false,
  };
  // ⛔ NE JAMAIS écraser ces trois colonnes par omission. Cette fonction
  // reconstruit la ligne de zéro : renommer une scène suffisait donc à effacer
  // sa narration (audio_url), son chapitre et son mode de rendu. On ne les
  // transmet que lorsqu'ils sont EXPLICITEMENT fournis par l'appelant.
  if (scene.chapter_id !== undefined) base.chapter_id = scene.chapter_id;
  if (scene.render_mode !== undefined) base.render_mode = scene.render_mode;
  if (scene.audio_url !== undefined) base.audio_url = scene.audio_url;
  if (scene.id) {
    return supabase.from('live_scenes').update(base).eq('id', scene.id).select().single();
  }
  return supabase.from('live_scenes').insert(base).select().single();
}

/**
 * Colonnes réellement patchables de `live_scenes`. Fail-closed : une clé hors de
 * cette liste part en erreur explicite au lieu d'un 400 PostgREST illisible.
 * ⚠️ `ia_data` n'est PAS une colonne (elle vit dans `content_payload_json`) — un
 * patch de brouillon wizard ne doit donc jamais arriver ici.
 */
const PATCHABLE_SCENE_COLUMNS = new Set([
  'name',
  'scene_type',
  'order_index',
  'content_payload_json',
  'is_preset',
  'preset_name',
  'is_active',
  'chapter_id',
  'render_mode',
  'audio_url',
]);

/**
 * Applique un patch PARTIEL à une scène : seules les clés fournies sont écrites.
 *
 * ⛔ Contrairement à `upsertScene`, cette fonction ne reconstruit RIEN. Les colonnes
 * absentes du patch ne sont pas transmises, donc `audio_url` (narration), `chapter_id`
 * et `render_mode` survivent à une écriture qui ne les concerne pas — c'est la panne
 * qui a effacé cinq fois des données dans ce dépôt.
 *
 * @param {string} sceneId
 * @param {object} patch clés = colonnes de live_scenes uniquement
 * @returns {Promise<{data: object|null, error: object|null}>} même forme qu'une requête supabase
 */
export async function patchScene(sceneId, patch) {
  if (!sceneId) {
    return { data: null, error: { message: 'patchScene: identifiant de scène manquant' } };
  }

  const update = {};
  for (const [key, value] of Object.entries(patch || {})) {
    // `undefined` = « non concerné » ; `null` reste une valeur écrite volontairement.
    if (value === undefined) continue;
    if (!PATCHABLE_SCENE_COLUMNS.has(key)) {
      return { data: null, error: { message: `patchScene: « ${key} » n'est pas une colonne de live_scenes` } };
    }
    update[key] = value;
  }

  // Un UPDATE sans colonne toucherait `updated_at` pour rien (et PostgREST le rejette).
  if (Object.keys(update).length === 0) return { data: null, error: null };

  return supabase.from('live_scenes').update(update).eq('id', sceneId).select().single();
}

export async function deleteScene(sceneId) {
  return supabase.from('live_scenes').delete().eq('id', sceneId);
}

/** Supprime toutes les scènes d'une session (ex. avant réimport constructeur). */
export async function deleteScenesForLiveSession(liveSessionId) {
  return supabase.from('live_scenes').delete().eq('live_session_id', liveSessionId);
}
