import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { apiV2 } from '@/lib/api-v2';
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
      // Annuaire TENANT-SCOPÉ (isolation multi-tenant) : les membres du tenant COURANT,
      // via l'API NestJS (TenantGuard + X-Tenant-Slug injecté par apiV2). On n'utilise PLUS
      // `profiles` global — qui fuitait les membres des AUTRES tenants dans le sélecteur de
      // destinataire (ex. un praticien Zahir voyait les comptes ISNA). Cf. /tenant-portal/members.
      const res = await apiV2.get('/tenant-portal/members');
      // Dépile l'enveloppe ({data:{data:[...]}} via l'intercepteur global) jusqu'au tableau.
      let d = res?.data;
      while (d && !Array.isArray(d) && typeof d === 'object' && 'data' in d) d = d.data;
      const list = Array.isArray(d) ? d : [];

      if (list.length === 0) {
        console.warn('[MessagingContext] tenant members returned 0 rows');
        setProfilesLoading(false);
        return false;
      }

      const mapped = list.map((m) => {
        const email = m.email || '';
        const name = String(m.full_name || m.name || '').trim() || email.split('@')[0] || 'Membre';
        return {
          id: m.user_id || m.id,
          email,
          name,
          avatar_url: m.avatar_url || null,
          role: m.role || 'student',
          // statut d'appartenance (active/invited) → présence indicative pour l'UI.
          status: m.status === 'active' ? 'online' : (m.status || 'offline'),
          city: m.city || null,
          region: m.region || null,
          country: m.country || null,
        };
      }).filter((p) => p.id);
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
