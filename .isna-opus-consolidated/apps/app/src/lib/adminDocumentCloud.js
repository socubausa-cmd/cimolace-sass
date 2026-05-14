import { supabase } from '@/lib/customSupabaseClient';

/**
 * @returns {Promise<{ document: object, updated_at: string } | null>}
 */
export async function fetchAdminDocumentFromCloud() {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return null;

  const { data, error } = await supabase
    .from('secretariat_admin_documents')
    .select('document, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data?.document) return null;
  return { document: data.document, updated_at: data.updated_at };
}

/**
 * @param {import('@/lib/adminDocumentStorage').AdminDocumentState} state
 */
export async function saveAdminDocumentToCloud(state) {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error('Vous devez être connecté pour enregistrer dans le nuage.');

  const payload = {
    ...state,
    savedAt: Date.now(),
  };

  const { error } = await supabase.from('secretariat_admin_documents').upsert(
    {
      user_id: user.id,
      document: payload,
    },
    { onConflict: 'user_id' },
  );

  if (error) throw error;
}
