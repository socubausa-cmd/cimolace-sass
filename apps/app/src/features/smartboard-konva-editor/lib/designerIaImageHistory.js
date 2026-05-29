/**
 * Galerie images Designer : Supabase (connecté) — URLs publiques stables (smartboard-canvas).
 * Hors session : repli localStorage (clé LEGACY) pour aperçu rapide uniquement.
 */

const LEGACY_LOCAL_KEY = 'liri-designer-ia-images-v1';
/** Taille de page PostgREST (évite le plafond ~1000 lignes / requête). */
const SUPABASE_PAGE = 1000;
/** Lots pour `storage.remove` (évite les timeouts sur grosses galeries). */
const STORAGE_REMOVE_CHUNK = 500;

export const DESIGNER_IA_IMAGE_SIZES = [
  { value: '1792x1024', label: 'Paysage 1792' },
  { value: '1024x1024', label: 'Carré 1024' },
  { value: '1024x1792', label: 'Portrait' },
];

function loadLegacyLocal() {
  try {
    const raw = localStorage.getItem(LEGACY_LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => x && typeof x.url === 'string' && x.url.length > 0);
  } catch {
    return [];
  }
}

function saveLegacyLocal(entries) {
  try {
    localStorage.setItem(LEGACY_LOCAL_KEY, JSON.stringify(entries));
  } catch {
    /* quota navigateur */
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ prompt: string, size: string, provider?: 'auto' | 'gemini' | 'dalle' }} args
 * — `gemini` : Imagen via `GEMINI_API_KEY` (Google AI Studio). `auto` : DALL·E si OPENAI, sinon Imagen si seule clé Gemini.
 */
export async function invokeGenerateVisualImage(supabase, { prompt, size, provider }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const opts = {
    body: { prompt, size, ...(provider ? { provider } : {}) },
  };
  if (token) {
    opts.headers = { Authorization: `Bearer ${token}` };
  }
  return supabase.functions.invoke('generate-visual-image', opts);
}

/**
 * OpenAI (Edge `studio-cover-prompt-assistant`) — interprète l'idée, pose des questions, reformule le prompt image.
 * @param {'interpret'|'finalize'} args.step
 */
export async function invokeStudioCoverPromptAssistant(supabase, body) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const opts = { body };
  if (token) {
    opts.headers = { Authorization: `Bearer ${token}` };
  }
  return supabase.functions.invoke('studio-cover-prompt-assistant', opts);
}

/**
 * Récupère toutes les lignes utilisateur (pagination interne, sans plafond artificiel côté app).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {string} selectColumns
 */
async function fetchAllDesignerIaRows(supabase, userId, selectColumns) {
  const all = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('designer_ia_images')
      .select(selectColumns)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, from + SUPABASE_PAGE - 1);

    if (error) return { data: null, error };
    if (!data?.length) break;
    all.push(...data);
    if (data.length < SUPABASE_PAGE) break;
    from += SUPABASE_PAGE;
  }
  return { data: all, error: null };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<Array<{ id?: string, url: string, prompt: string, size?: string, at: number, source?: string, storagePath?: string, persisted: boolean }>>}
 */
export async function fetchDesignerImageGallery(supabase) {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userErr || !user?.id) {
    return loadLegacyLocal().map((x) => ({
      ...x,
      persisted: false,
    }));
  }

  const { data, error } = await fetchAllDesignerIaRows(
    supabase,
    user.id,
    'id, storage_bucket, storage_path, prompt, size, source, created_at',
  );

  if (error) {
    console.warn('designer_ia_images fetch', error);
    return loadLegacyLocal().map((x) => ({ ...x, persisted: false }));
  }

  return (data || []).map((row) => {
    const bucket = row.storage_bucket || 'smartboard-canvas';
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(row.storage_path);
    return {
      id: row.id,
      url: pub?.publicUrl || '',
      prompt: row.prompt || '',
      size: row.size || '',
      at: new Date(row.created_at).getTime(),
      source: row.source || 'dalle',
      storagePath: row.storage_path,
      persisted: true,
    };
  }).filter((x) => x.url);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ url: string, prompt?: string, size?: string }} entry
 */
export function pushLegacyLocalDesignerImage(entry) {
  const url = String(entry?.url || '').trim();
  if (!url) return;
  const prompt = String(entry?.prompt || '').slice(0, 65535);
  const size = String(entry?.size || '');
  const prev = loadLegacyLocal();
  const next = [{ url, prompt, size, at: Date.now() }, ...prev.filter((x) => x.url !== url)];
  saveLegacyLocal(next);
}

/** @param {import('@supabase/supabase-js').SupabaseClient} supabase */
export async function deleteDesignerImageEntry(supabase, entry) {
  if (!entry?.id || !entry.persisted) {
    if (entry?.url) {
      const prev = loadLegacyLocal().filter((x) => x.url !== entry.url);
      saveLegacyLocal(prev);
    }
    return;
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user?.id) return;

  const bucket = 'smartboard-canvas';
  if (entry.storagePath) {
    await supabase.storage.from(bucket).remove([entry.storagePath]);
  }
  await supabase.from('designer_ia_images').delete().eq('id', entry.id);
}

/** @param {import('@supabase/supabase-js').SupabaseClient} supabase */
export async function clearDesignerImageGallery(supabase) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user?.id) {
    saveLegacyLocal([]);
    return;
  }
  const uid = userData.user.id;
  const { data: rows, error: rowsErr } = await fetchAllDesignerIaRows(
    supabase,
    uid,
    'id, storage_path',
  );
  if (rowsErr) {
    console.warn('clearDesignerImageGallery list', rowsErr);
    return;
  }

  const paths = (rows || []).map((r) => r.storage_path).filter(Boolean);
  for (let i = 0; i < paths.length; i += STORAGE_REMOVE_CHUNK) {
    const chunk = paths.slice(i, i + STORAGE_REMOVE_CHUNK);
    await supabase.storage.from('smartboard-canvas').remove(chunk);
  }
  await supabase.from('designer_ia_images').delete().eq('user_id', uid);
}

/**
 * Après upload fichier (bucket déjà rempli) — enregistre la ligne métadonnée.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function insertDesignerUploadMetadata(supabase, { storagePath, prompt, publicUrl }) {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user?.id) return null;
  const { data, error } = await supabase
    .from('designer_ia_images')
    .insert({
      user_id: userData.user.id,
      storage_bucket: 'smartboard-canvas',
      storage_path: storagePath,
      prompt: String(prompt || 'Import').slice(0, 65535),
      size: null,
      source: 'upload',
    })
    .select('id')
    .single();
  if (error) {
    console.warn('insertDesignerUploadMetadata', error);
    return null;
  }
  return { id: data?.id, url: publicUrl };
}
