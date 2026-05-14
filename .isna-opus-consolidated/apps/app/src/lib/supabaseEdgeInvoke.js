/**
 * Edge Functions : le client Supabase renvoie souvent seulement
 * "Edge Function returned a non-2xx status code" alors que le corps JSON contient { error, details }.
 *
 * Dév local des fonctions : définir `VITE_SUPABASE_FUNCTIONS_LOCAL_URL` (ex. `http://127.0.0.1:54321/functions/v1`)
 * puis `supabase functions serve studio-longia-chat` (Docker + secrets du projet lié). Les JWT restent ceux du
 * même projet Supabase que `VITE_SUPABASE_URL` pour que `auth.getUser` côté Edge valide la session.
 */

/**
 * @param {Error & { context?: Response }} fnError
 * @returns {Promise<string>}
 */
export async function getSupabaseFunctionErrorMessage(fnError) {
  if (!fnError) return 'Erreur inconnue';
  const base = fnError.message || 'Erreur Edge Function';
  const res = fnError.context;
  if (res && typeof res.json === 'function') {
    try {
      const body = await res.clone().json();
      if (body?.error != null && body?.details != null) {
        return `${String(body.error)} — ${String(body.details)}`;
      }
      if (body?.error != null) return String(body.error);
      if (body?.details != null) return String(body.details);
      if (typeof body?.message === 'string') return body.message;
    } catch {
      try {
        const text = await fnError.context.clone().text();
        if (text && text.length < 500) return `${base} (${text.slice(0, 200)})`;
      } catch {
        /* ignore */
      }
    }
  }
  return base;
}

function localFunctionsBaseUrl() {
  const raw = import.meta.env?.VITE_SUPABASE_FUNCTIONS_LOCAL_URL;
  return typeof raw === 'string' && raw.trim().startsWith('http') ? raw.trim().replace(/\/$/, '') : '';
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} name
 * @param {import('@supabase/supabase-js').FunctionInvokeOptions} [invokeOptions]
 */
export async function invokeSupabaseFunction(supabase, name, invokeOptions = {}) {
  const localBase = localFunctionsBaseUrl();
  if (localBase) {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) {
      throw new Error('Connexion requise pour tester les Edge Functions en local.');
    }
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const url = `${localBase}/${encodeURIComponent(name)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: String(anon ?? ''),
        ...(invokeOptions.headers && typeof invokeOptions.headers === 'object' ? invokeOptions.headers : {}),
      },
      body: JSON.stringify(invokeOptions.body ?? {}),
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      if (data && typeof data === 'object' && data.error != null) {
        const d = data.details != null ? String(data.details) : '';
        throw new Error(d ? `${String(data.error)} — ${d}` : String(data.error));
      }
      throw new Error(`Edge Function HTTP ${res.status}`);
    }
    if (data && typeof data === 'object' && data.error != null) {
      throw new Error(String(data.error));
    }
    return data;
  }

  const { data, error } = await supabase.functions.invoke(name, invokeOptions);
  if (error) {
    const msg = await getSupabaseFunctionErrorMessage(error);
    throw new Error(msg);
  }
  if (data && typeof data === 'object' && data.error != null) {
    throw new Error(String(data.error));
  }
  return data;
}
