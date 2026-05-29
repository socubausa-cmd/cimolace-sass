import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

export function useAdminCommunities() {
  const [communities, setCommunities] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [commRes, profRes] = await Promise.all([
        supabase
          .from('communities')
          .select('id, name, description, creator_id, image_url, is_active, created_at')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('profiles')
          .select('id, name, email')
          .neq('role', 'visitor')
          .order('name')
          .limit(500),
      ]);

      if (commRes.error) throw commRes.error;
      if (profRes.error) throw profRes.error;

      const creatorIds = [...new Set((commRes.data || []).map((c) => c.creator_id).filter(Boolean))];
      const { data: creatorProfiles } =
        creatorIds.length > 0
          ? await supabase.from('profiles').select('id, name, email').in('id', creatorIds)
          : { data: [] };
      const creatorMap = Object.fromEntries((creatorProfiles || []).map((p) => [p.id, p]));

      setCommunities(
        (commRes.data || []).map((c) => ({
          ...c,
          creator: creatorMap[c.creator_id] || { name: 'Inconnu' },
        }))
      );
      setProfiles(profRes.data || []);
    } catch (e) {
      setError(e);
      setCommunities([]);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createCommunity = useCallback(
    async ({ name, description, creator_id }) => {
      if (!name?.trim() || !creator_id) return { error: new Error('Nom et créateur requis') };
      const { data: comm, error: commErr } = await supabase
        .from('communities')
        .insert({
          name: name.trim(),
          description: (description || '').trim() || null,
          creator_id,
        })
        .select('id')
        .single();

      if (commErr) return { error: commErr };
      if (!comm?.id) return { error: new Error('Création échouée') };

      const { error: memErr } = await supabase.from('community_members').insert({
        community_id: comm.id,
        user_id: creator_id,
        role: 'creator',
      });
      if (memErr) return { error: memErr };

      await refresh();
      return { data: comm, error: null };
    },
    [refresh]
  );

  const updateCommunity = useCallback(
    async (id, payload) => {
      const { error: err } = await supabase.from('communities').update(payload).eq('id', id);
      if (err) return { error: err };
      await refresh();
      return { error: null };
    },
    [refresh]
  );

  const addMembers = useCallback(
    async (communityId, userIds) => {
      if (!communityId || !Array.isArray(userIds) || userIds.length === 0)
        return { error: new Error('Données invalides') };
      const rows = userIds.map((uid) => ({
        community_id: communityId,
        user_id: uid,
        role: 'member',
      }));
      const { error: err } = await supabase.from('community_members').upsert(rows, {
        onConflict: 'community_members_community_user_unique',
        ignoreDuplicates: true,
      });
      if (err) return { error: err };
      await refresh();
      return { error: null };
    },
    [refresh]
  );

  return {
    communities,
    profiles,
    loading,
    error,
    refresh,
    createCommunity,
    updateCommunity,
    addMembers,
  };
}
