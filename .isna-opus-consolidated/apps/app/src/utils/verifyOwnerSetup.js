import { supabase } from '@/lib/customSupabaseClient';

const ok = (details) => ({ status: 'ok', details });
const warn = (details) => ({ status: 'warning', details });
const err = (details) => ({ status: 'error', details });
const missing = (details) => ({ status: 'missing', details });

export const verifyOwnerStatus = async () => {
  const result = {
    auth: missing({ message: 'No session' }),
    profile: missing({ message: 'No profile checked' }),
    role: missing('No role checked'),
    permissions: warn({ message: 'Not checked' }),
  };

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      result.auth = err({ message: sessionError.message });
      return result;
    }

    const session = sessionData?.session;
    if (!session?.user) {
      result.auth = missing({ message: 'No authenticated user' });
      return result;
    }

    result.auth = ok({
      user_id: session.user.id,
      email: session.user.email,
    });

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (profileError) {
      const msg = String(profileError.message || 'Unknown profile error');
      result.profile = err({ message: msg });
      if (msg.toLowerCase().includes('cannot coerce the result to a single json object')) {
        result.role = err('Doublons détectés dans public.profiles pour cet utilisateur (plusieurs lignes avec le même id).');
      } else {
        result.role = err(`Profil introuvable (donc rôle indéterminé)`);
      }
      return result;
    }

    const profile = Array.isArray(profiles) ? profiles[0] : null;
    if (!profile) {
      result.profile = missing({ message: 'No profile row found for current user' });
      result.role = err(`Profil introuvable (donc rôle indéterminé)`);
      return result;
    }

    result.profile = ok(profile);

    const role = String(profile?.role || '').toLowerCase();
    if (role === 'owner') {
      result.role = ok(`Rôle OK: ${role}`);
    } else {
      result.role = err(`Rôle incorrect: ${role || 'inconnu'} (attendu: owner)`);
    }

    result.permissions = warn({
      message: 'Permissions non vérifiées (table roles non consultée ici).',
    });
    return result;
  } catch (e) {
    result.auth = err({ message: e?.message || 'Unknown error' });
    return result;
  }
};

export const verifyOwnerSetup = async () => {
  const status = await verifyOwnerStatus();
  const isOwnerSetup = status?.role?.status === 'ok';
  return { success: Boolean(isOwnerSetup), isOwnerSetup, status };
};

export default verifyOwnerSetup;
