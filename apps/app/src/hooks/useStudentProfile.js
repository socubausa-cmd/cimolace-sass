import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const ROLE_LABEL = {
  student: 'Étudiant',
  teacher: 'Enseignant',
  owner: 'Propriétaire',
  admin: 'Admin',
};

/** Initiales (max 2) depuis un nom, fallback sur l'email. */
export function deriveInitials(name, email) {
  const base = String(name || (email ? String(email).split('@')[0] : '') || '').trim();
  const parts = base.split(/\s+/).map((p) => p[0]).filter(Boolean);
  return (parts.join('') || 'É').slice(0, 2).toUpperCase();
}

/* ─── Validateurs PARTAGÉS (web + mobile) ─── */
export function validateProfileName(name) {
  const v = String(name || '').trim();
  if (v.length === 0) return 'Le nom est requis.';
  if (v.length > 120) return 'Nom trop long (max 120 caractères).';
  return null;
}
export function validateProfilePhone(phone) {
  const v = String(phone || '').trim();
  if (!v) return null; // optionnel
  if (!/^[+0-9 ().-]{6,24}$/.test(v)) return 'Numéro de téléphone invalide.';
  return null;
}

/**
 * Source UNIQUE d'identité de l'élève — partagée par la page web
 * (StudentProfilePage) et l'écran mobile (EleveProfileScreen).
 *
 * Merge la ligne `profiles` (vérité ÉDITABLE : name / phone / avatar_url /
 * notify_sms / role) avec les fallbacks `user.user_metadata`
 * (full_name / avatar_url / school / class) → plus de « deux vérités » du profil
 * (web qui lit profiles, mobile qui lit user_metadata, et qui divergent).
 *
 * Expose aussi les écritures (updateProfile / updateNotifyPrefs) pour que la
 * lecture et l'écriture du profil vivent au même endroit.
 */
export function useStudentProfile(userId) {
  const { user } = useAuth();
  const id = userId || user?.id || null;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!id) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('profiles')
      .select('id,name,email,role,phone,avatar_url,notify_sms')
      .eq('id', id)
      .maybeSingle();
    if (err) setError(err);
    setProfile(data || null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const meta = user?.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {};
  const email = profile?.email || user?.email || '';
  const displayName =
    profile?.name ||
    meta.full_name ||
    (email ? String(email).split('@')[0].split('.')[0] : '') ||
    'Étudiant';
  const avatarUrl = profile?.avatar_url || meta.avatar_url || null;
  const role = profile?.role || user?.role || 'student';
  const roleLabel = ROLE_LABEL[role] || 'Invité';
  const phone = profile?.phone || '';
  const notifySms = profile?.notify_sms === true;
  const school = meta.school || 'ISNA / PRORASCIENCE';
  const classLabel = meta.class || 'Élève LIRI';
  const initials = deriveInitials(displayName, email);

  // Met à jour nom / téléphone dans `profiles` (et l'état local optimiste).
  const updateProfile = useCallback(
    async ({ name, phone: ph } = {}) => {
      if (!id) return { error: new Error('Utilisateur inconnu') };
      const patch = {};
      if (name !== undefined) patch.name = String(name || '').trim() || null;
      if (ph !== undefined) patch.phone = String(ph || '').trim() || null;
      if (Object.keys(patch).length === 0) return { error: null };
      const { error: err } = await supabase.from('profiles').update(patch).eq('id', id);
      if (!err) setProfile((p) => (p ? { ...p, ...patch } : p));
      return { error: err || null };
    },
    [id],
  );

  const updateNotifyPrefs = useCallback(
    async (next) => {
      if (!id) return { error: new Error('Utilisateur inconnu') };
      const value = next === true;
      const { error: err } = await supabase.from('profiles').update({ notify_sms: value }).eq('id', id);
      if (!err) setProfile((p) => (p ? { ...p, notify_sms: value } : p));
      return { error: err || null };
    },
    [id],
  );

  // Reflète localement un nouvel avatar (après upload Storage côté appelant).
  const applyAvatarUrl = useCallback((url) => {
    setProfile((p) => (p ? { ...p, avatar_url: url } : p));
  }, []);

  return {
    profile,
    loading,
    error,
    refresh: load,
    email,
    displayName,
    avatarUrl,
    role,
    roleLabel,
    phone,
    notifySms,
    school,
    classLabel,
    initials,
    updateProfile,
    updateNotifyPrefs,
    applyAvatarUrl,
  };
}
