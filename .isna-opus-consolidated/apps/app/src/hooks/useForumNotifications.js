import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Hook pour gérer les notifications forum en temps réel
 * Features:
 * - Notifications en temps réel via Supabase
 * - Marquer comme lu
 * - Compteur de non-lues
 * - Souscription auto aux threads créés
 */
export function useForumNotifications(userId) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Charger les notifications
  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    
    const { data } = await supabase
      .from('forum_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    setNotifications(data || []);
    setUnreadCount((data || []).filter(n => !n.is_read).length);
    setLoading(false);
  }, [userId]);

  // Marquer comme lu
  const markAsRead = useCallback(async (notificationId) => {
    if (!userId) return;

    await supabase
      .from('forum_notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId);

    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, [userId]);

  // Marquer tout comme lu
  const markAllAsRead = useCallback(async () => {
    if (!userId) return;

    await supabase
      .from('forum_notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [userId]);

  // Temps réel - écouter les nouvelles notifications
  useEffect(() => {
    if (!userId) return;

    loadNotifications();

    const channel = supabase
      .channel(`forum-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'forum_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications(prev => [payload.new, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh: loadNotifications,
  };
}

/**
 * Hook pour les favoris (utilise la DB au lieu de localStorage)
 */
export function useForumFavorites(userId) {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadFavorites = useCallback(async () => {
    if (!userId) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('forum_favorites')
      .select('question_id')
      .eq('user_id', userId);

    setFavorites((data || []).map(f => f.question_id));
    setLoading(false);
  }, [userId]);

  const toggleFavorite = useCallback(async (questionId) => {
    if (!userId) return;

    const isFav = favorites.includes(questionId);

    if (isFav) {
      await supabase
        .from('forum_favorites')
        .delete()
        .eq('question_id', questionId)
        .eq('user_id', userId);
      setFavorites(prev => prev.filter(id => id !== questionId));
    } else {
      await supabase
        .from('forum_favorites')
        .insert({ question_id: questionId, user_id: userId });
      setFavorites(prev => [...prev, questionId]);
    }
  }, [favorites, userId]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  return { favorites, loading, toggleFavorite, isFav: (id) => favorites.includes(id) };
}

/**
 * Hook pour les votes (utilise la DB)
 */
export function useForumVotes(userId) {
  const [votes, setVotes] = useState({}); // { postId: value }
  const [loading, setLoading] = useState(true);

  const loadVotes = useCallback(async (postIds) => {
    if (!userId || !postIds?.length) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('forum_votes')
      .select('post_id, value')
      .eq('user_id', userId)
      .in('post_id', postIds);

    const voteMap = {};
    (data || []).forEach(v => voteMap[v.post_id] = v.value);
    setVotes(voteMap);
    setLoading(false);
  }, [userId]);

  const vote = useCallback(async (postId, value) => {
    if (!userId) throw new Error('Not authenticated');

    const currentVote = votes[postId] || 0;
    const newVote = currentVote === value ? 0 : value;

    // Supprimer l'ancien vote
    if (currentVote !== 0) {
      await supabase
        .from('forum_votes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);
    }

    // Insérer nouveau si non-zero
    if (newVote !== 0) {
      await supabase
        .from('forum_votes')
        .insert({ post_id: postId, user_id: userId, value: newVote });
    }

    setVotes(prev => ({ ...prev, [postId]: newVote }));
    return newVote;
  }, [votes, userId]);

  const getVoteCount = useCallback(async (postId) => {
    const { data } = await supabase
      .from('forum_votes')
      .select('value')
      .eq('post_id', postId);

    return (data || []).reduce((sum, v) => sum + v.value, 0);
  }, []);

  return { votes, loading, vote, loadVotes, getVoteCount };
}

/**
 * Hook pour souscrire/se désabonner d'un thread
 */
export function useForumSubscriptions(userId) {
  const [subscriptions, setSubscriptions] = useState([]);

  const loadSubscriptions = useCallback(async () => {
    if (!userId) return;

    const { data } = await supabase
      .from('forum_subscriptions')
      .select('question_id')
      .eq('user_id', userId);

    setSubscriptions((data || []).map(s => s.question_id));
  }, [userId]);

  const toggleSubscription = useCallback(async (questionId, notifyEmail = false) => {
    if (!userId) return;

    const isSubscribed = subscriptions.includes(questionId);

    if (isSubscribed) {
      await supabase
        .from('forum_subscriptions')
        .delete()
        .eq('question_id', questionId)
        .eq('user_id', userId);
      setSubscriptions(prev => prev.filter(id => id !== questionId));
    } else {
      await supabase
        .from('forum_subscriptions')
        .insert({ 
          question_id: questionId, 
          user_id: userId, 
          notify_email: notifyEmail 
        });
      setSubscriptions(prev => [...prev, questionId]);
    }
  }, [subscriptions, userId]);

  const isSubscribed = useCallback((questionId) => {
    return subscriptions.includes(questionId);
  }, [subscriptions]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  return { subscriptions, toggleSubscription, isSubscribed };
}

/**
 * Hook pour gérer les brouillons auto-sauvegardés
 */
export function useForumDrafts(userId) {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadDrafts = useCallback(async () => {
    if (!userId) {
      setDrafts([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('forum_drafts')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    setDrafts(data || []);
    setLoading(false);
  }, [userId]);

  const saveDraft = useCallback(async (draftData) => {
    if (!userId) return null;

    setSaving(true);
    try {
      const { data } = await supabase
        .from('forum_drafts')
        .upsert({
          user_id: userId,
          ...draftData,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      await loadDrafts();
      return data;
    } finally {
      setSaving(false);
    }
  }, [userId, loadDrafts]);

  const deleteDraft = useCallback(async (draftId) => {
    if (!userId) return;

    await supabase
      .from('forum_drafts')
      .delete()
      .eq('id', draftId)
      .eq('user_id', userId);

    setDrafts(prev => prev.filter(d => d.id !== draftId));
  }, [userId]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  return { drafts, loading, saving, saveDraft, deleteDraft, refresh: loadDrafts };
}

/**
 * Hook pour les mentions (@username)
 */
export function useForumMentions(userId) {
  const [mentions, setMentions] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadMentions = useCallback(async () => {
    if (!userId) {
      setMentions([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('forum_mentions')
      .select('*, post:post_id(*)')
      .eq('mentioned_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    setMentions(data || []);
    setUnreadCount((data || []).filter(m => !m.is_read).length);
    setLoading(false);
  }, [userId]);

  const markAsRead = useCallback(async (mentionId) => {
    if (!userId) return;

    await supabase
      .from('forum_mentions')
      .update({ is_read: true })
      .eq('id', mentionId)
      .eq('mentioned_user_id', userId);

    setMentions(prev =>
      prev.map(m => m.id === mentionId ? { ...m, is_read: true } : m)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, [userId]);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;

    await supabase
      .from('forum_mentions')
      .update({ is_read: true })
      .eq('mentioned_user_id', userId)
      .eq('is_read', false);

    setMentions(prev => prev.map(m => ({ ...m, is_read: true })));
    setUnreadCount(0);
  }, [userId]);

  // Temps réel
  useEffect(() => {
    if (!userId) return;

    loadMentions();

    const channel = supabase
      .channel(`forum-mentions-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'forum_mentions',
          filter: `mentioned_user_id=eq.${userId}`,
        },
        (payload) => {
          setMentions(prev => [payload.new, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadMentions]);

  return {
    mentions,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh: loadMentions,
  };
}

/**
 * Hook pour la réputation utilisateur
 */
export function useUserReputation(userId) {
  const [reputation, setReputation] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadReputation = useCallback(async () => {
    if (!userId) {
      setReputation(null);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('user_reputation')
      .select('*')
      .eq('user_id', userId)
      .single();

    setReputation(data || {
      points: 0,
      level: 'novice',
      questions_count: 0,
      answers_count: 0,
      accepted_answers_count: 0,
      badges: [],
    });
    setLoading(false);
  }, [userId]);

  const loadLeaderboard = useCallback(async (limit = 10) => {
    const { data } = await supabase
      .from('user_reputation_leaderboard')
      .select('*')
      .limit(limit);

    setLeaderboard(data || []);
  }, []);

  // Temps réel
  useEffect(() => {
    if (!userId) return;

    loadReputation();

    const channel = supabase
      .channel(`user-reputation-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_reputation',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setReputation(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadReputation]);

  return {
    reputation,
    leaderboard,
    loading,
    refresh: loadReputation,
    refreshLeaderboard: loadLeaderboard,
  };
}

// Helper: Badge config avec couleurs
export const REPUTATION_BADGES = {
  helper: { label: 'Helper', color: '#2cc275', icon: '💚' },
  popular: { label: 'Popular', color: '#ff6b4a', icon: '🔥' },
  expert: { label: 'Expert', color: '#5b3df5', icon: '👑' },
  veteran: { label: 'Veteran', color: '#8b6dff', icon: '🏆' },
};

// Helper: Level thresholds
export const REPUTATION_LEVELS = {
  novice: { threshold: 0, label: 'Novice' },
  member: { threshold: 100, label: 'Membre' },
  contributor: { threshold: 300, label: 'Contributeur' },
  expert: { threshold: 1000, label: 'Expert' },
  veteran: { threshold: 5000, label: 'Vétéran' },
};
