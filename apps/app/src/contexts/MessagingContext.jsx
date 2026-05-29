import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useRealtimeMessaging } from '@/hooks/useRealtimeMessaging';

const MessagingContext = createContext();

export const MessagingProvider = ({ children }) => {
  const { user, session } = useAuth();
  const userId = user?.id || null;
  const messagingDisabled = typeof window !== 'undefined' && window.location.pathname.startsWith('/cimolace');

  const [allProfiles, setAllProfiles] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [profilesLoading, setProfilesLoading] = useState(true);
  const retriedRef = useRef(false);
  const networkWarnOnceRef = useRef(false);

  const logProfilesIssue = useCallback((kind, payload) => {
    const msg = String(payload?.message ?? payload ?? '');
    const looksNetwork =
      /failed to fetch|network|load failed|timeout|connection reset|econnreset|aborted/i.test(msg);
    if (looksNetwork && !networkWarnOnceRef.current) {
      networkWarnOnceRef.current = true;
      console.warn(
        '[MessagingContext] API Supabase injoignable (réseau ou projet). Messagerie / liste des profils limitées. Vérifiez connexion, VPN, et le tableau Supabase (projet actif).',
        msg.slice(0, 120),
      );
      return;
    }
    if (!looksNetwork) {
      console.error(`[MessagingContext] profiles ${kind}:`, msg || payload);
    }
  }, []);

  const loadProfiles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, name, avatar_url, role, status, city, region, country')
        .limit(400);

      if (error) {
        logProfilesIssue('error', error);
        setProfilesLoading(false);
        return false;
      }

      if (!data || data.length === 0) {
        console.warn('[MessagingContext] profiles returned 0 rows');
        setProfilesLoading(false);
        return false;
      }

      const mapped = data.map((p) => ({
        ...p,
        name: p.name?.trim() || p.email?.split('@')[0] || 'Membre',
      }));
      const map = {};
      mapped.forEach((p) => { map[p.id] = p; });
      setAllProfiles(mapped);
      setProfilesMap(map);
      setProfilesLoading(false);
      return true;
    } catch (err) {
      logProfilesIssue('exception', err);
      setProfilesLoading(false);
      return false;
    }
  }, [logProfilesIssue]);

  // Charger les profils dès que la session est disponible
  useEffect(() => {
    if (messagingDisabled) {
      setProfilesLoading(false);
      setAllProfiles([]);
      setProfilesMap({});
      return;
    }
    if (!session && !user) {
      setProfilesLoading(false);
      setAllProfiles([]);
      setProfilesMap({});
      return;
    }
    retriedRef.current = false;
    setProfilesLoading(true);
    loadProfiles().then((ok) => {
      if (!ok && !retriedRef.current) {
        retriedRef.current = true;
        setTimeout(() => loadProfiles(), 1500);
      }
    });
  }, [session, user, loadProfiles, messagingDisabled]);

  const {
    messages,
    conversations,
    loading: messagesLoading,
    tableExists: messagesTableExists,
    sendMessage,
    markAsRead,
    deleteMessage,
    editMessage,
    getConversationMessages,
    fetchAndMergeConversation,
    refresh,
  } = useRealtimeMessaging(messagingDisabled ? null : userId, profilesMap);

  const currentUser = useMemo(() => {
    if (!user) return null;
    const profile = profilesMap[user.id];
    return {
      id: user.id,
      name: profile?.name || user.name || user.email?.split('@')[0] || '',
      avatar_url: profile?.avatar_url || user.avatar_url || null,
      role: profile?.role || user.role || 'student',
      status: 'online',
      email: user.email,
    };
  }, [user, profilesMap]);

  const value = useMemo(
    () => ({
      conversations,
      messages,
      users: allProfiles,
      profiles: profilesMap,
      currentUser,
      messagesTableExists,
      // Do not block messaging UI on long profile fetch.
      loading: messagesLoading,
      sendMessage,
      markAsRead,
      deleteMessage,
      editMessage,
      getConversationMessages,
      fetchAndMergeConversation,
      refresh,
      reloadProfiles: loadProfiles,
    }),
    [conversations, messages, allProfiles, profilesMap, currentUser, messagesTableExists, profilesLoading, messagesLoading, sendMessage, markAsRead, deleteMessage, editMessage, getConversationMessages, fetchAndMergeConversation, refresh, loadProfiles]
  );

  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
};

export const useMessaging = () => useContext(MessagingContext);
