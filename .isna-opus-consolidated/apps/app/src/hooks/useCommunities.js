import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/hooks/useAuth';

export function useCommunities() {
  const { user } = useAuth();
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setCommunities([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('community_members')
        .select(`
          id, role, joined_at,
          community:community_id (
            id, name, description, image_url, creator_id, is_active, created_at
          )
        `)
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false });

      if (err) throw err;
      const raw = (data || []).filter((r) => r.community?.is_active);
      const creatorIds = [...new Set(raw.map((r) => r.community?.creator_id).filter(Boolean))];
      const { data: creators } =
        creatorIds.length > 0
          ? await supabase.from('profiles').select('id, name, email').in('id', creatorIds)
          : { data: [] };
      const creatorMap = Object.fromEntries((creators || []).map((p) => [p.id, p]));

      setCommunities(
        raw.map((r) => ({
          ...r,
          community: r.community
            ? { ...r.community, creator: creatorMap[r.community.creator_id] || { name: 'Inconnu' } }
            : null,
        }))
      );
    } catch (e) {
      setError(e);
      setCommunities([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { communities, loading, error, refresh };
}

export function useCommunityMessages(communityId) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!communityId || !user?.id) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('community_messages')
        .select('id, content, created_at, author_id, edited_at')
        .eq('community_id', communityId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(200);

      if (err) throw err;

      const authorIds = [...new Set((data || []).map((m) => m.author_id).filter(Boolean))];
      const { data: profiles } = authorIds.length
        ? await supabase.from('profiles').select('id, name, avatar_url').in('id', authorIds)
        : { data: [] };
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

      setMessages(
        (data || []).map((m) => ({
          ...m,
          author: profileMap[m.author_id] || { name: 'Inconnu' },
        }))
      );
    } catch (e) {
      setError(e);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [communityId, user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const sendMessage = useCallback(
    async (content) => {
      if (!communityId || !user?.id || !content?.trim()) return { error: new Error('Données manquantes') };
      const { error: err } = await supabase.from('community_messages').insert({
        community_id: communityId,
        author_id: user.id,
        content: content.trim(),
      });
      if (err) return { error: err };
      await refresh();
      return { error: null };
    },
    [communityId, user?.id, refresh]
  );

  return { messages, loading, error, refresh, sendMessage };
}
