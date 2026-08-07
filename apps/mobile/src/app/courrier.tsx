import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Linking, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { syncMailbox } from '@/lib/liri-api';
import { supabase } from '@/lib/supabase';

const C = {
  bg: '#262624', card: 'rgba(255,255,255,.045)',
  ink: '#F5F1E9', muted: 'rgba(245,241,233,.62)', faint: 'rgba(245,241,233,.40)',
  line: 'rgba(255,255,255,.09)', coral: '#E08A5F',
};

type Thread = {
  id: string; subject: string | null; primary_contact_email: string | null;
  updated_at: string | null; pipeline_status: string | null;
};
type Mail = {
  id: string; from_name: string | null; from_email: string | null; subject: string | null;
  body_text: string | null; snippet: string | null; received_at: string | null;
  is_read: boolean | null; is_outbound: boolean | null;
};

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '';

export default function CourrierScreen() {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [unread, setUnread] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Thread | null>(null);
  const [mails, setMails] = useState<Mail[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadThreads = useCallback(async () => {
    const { data: t } = await supabase
      .from('email_threads')
      .select('id,subject,primary_contact_email,updated_at,pipeline_status')
      .order('updated_at', { ascending: false })
      .limit(50);
    const { data: u } = await supabase.from('emails').select('thread_id').eq('is_read', false);
    setUnread(new Set(((u as { thread_id: string }[]) ?? []).map((e) => e.thread_id)));
    setThreads((t as Thread[]) ?? []);
  }, []);
  useEffect(() => { void loadThreads(); }, [loadThreads]);

  const openThread = useCallback(async (t: Thread) => {
    setSelected(t); setMails(null);
    const { data } = await supabase
      .from('emails')
      .select('id,from_name,from_email,subject,body_text,snippet,received_at,is_read,is_outbound')
      .eq('thread_id', t.id)
      .order('received_at', { ascending: true });
    setMails((data as Mail[]) ?? []);
    // Marque le fil comme lu.
    await supabase.from('emails').update({ is_read: true }).eq('thread_id', t.id).eq('is_read', false);
    setUnread((prev) => { const n = new Set(prev); n.delete(t.id); return n; });
  }, []);

  const doSync = useCallback(async () => {
    setSyncing(true); setMsg(null);
    const r = await syncMailbox();
    setSyncing(false);
    if (r?.error) setMsg(r.hint || r.error);
    else setMsg(typeof r?.synced === 'number' ? `${r.synced} message(s) synchronisé(s)` : 'Boîte à jour');
    await loadThreads();
  }, [loadThreads]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await loadThreads(); setRefreshing(false);
  }, [loadThreads]);

  // ── Vue détail d'un fil ──
  if (selected) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.detailHead}>
          <Pressable onPress={() => { setSelected(null); setMails(null); }} style={s.back} hitSlop={10}>
            <Feather name="chevron-left" size={22} color={C.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.detailSubject} numberOfLines={2}>{selected.subject || '(sans objet)'}</Text>
            {!!selected.primary_contact_email && <Text style={s.detailFrom}>{selected.primary_contact_email}</Text>}
          </View>
          {!!selected.primary_contact_email && (
            <Pressable style={s.round} onPress={() => void Linking.openURL(`mailto:${selected.primary_contact_email}`)}>
              <Feather name="corner-up-left" size={16} color={C.ink} />
            </Pressable>
          )}
        </View>
        {mails === null ? (
          <View style={s.center}><ActivityIndicator color={C.coral} /></View>
        ) : (
          <ScrollView contentContainerStyle={s.detailBody}>
            {mails.map((m) => (
              <View key={m.id} style={[s.bubble, m.is_outbound && s.bubbleOut]}>
                <View style={s.bubbleHead}>
                  <Text style={s.bubbleFrom} numberOfLines={1}>
                    {m.is_outbound ? 'Vous' : (m.from_name || m.from_email || 'Expéditeur')}
                  </Text>
                  <Text style={s.bubbleDate}>{fmt(m.received_at)}</Text>
                </View>
                <Text style={s.bubbleText}>{(m.body_text || m.snippet || '').trim() || '(message vide)'}</Text>
              </View>
            ))}
            <View style={{ height: 32 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // ── Liste des fils ──
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>Courrier</Text>
          <Text style={s.sub}>Boîte infos@prorascience.org</Text>
        </View>
        <Pressable style={s.syncBtn} onPress={() => void doSync()} disabled={syncing}>
          {syncing ? <ActivityIndicator color="#1c1a18" size="small" />
            : <><Feather name="refresh-cw" size={14} color="#1c1a18" /><Text style={s.syncTxt}>Synchroniser</Text></>}
        </Pressable>
      </View>
      {msg && <View style={s.note}><Text style={s.noteTxt}>{msg}</Text></View>}

      {threads === null ? (
        <View style={s.center}><ActivityIndicator color={C.coral} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.coral} />}
        >
          {threads.length === 0 ? (
            <View style={s.empty}>
              <Feather name="mail" size={28} color={C.faint} />
              <Text style={s.emptyTxt}>Aucun courrier. Lance une synchro.</Text>
            </View>
          ) : (
            threads.map((t) => {
              const isUnread = unread.has(t.id);
              return (
                <Pressable key={t.id} style={s.thread} onPress={() => void openThread(t)}>
                  {isUnread && <View style={s.unreadDot} />}
                  <View style={{ flex: 1 }}>
                    <Text style={[s.threadSubject, isUnread && s.threadUnread]} numberOfLines={1}>
                      {t.subject || '(sans objet)'}
                    </Text>
                    {!!t.primary_contact_email && <Text style={s.threadFrom} numberOfLines={1}>{t.primary_contact_email}</Text>}
                  </View>
                  <Text style={s.threadDate}>{fmt(t.updated_at)}</Text>
                  <Feather name="chevron-right" size={18} color={C.faint} />
                </Pressable>
              );
            })
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  h1: { color: C.ink, fontSize: 26, fontWeight: '700', letterSpacing: -0.3 },
  sub: { color: C.muted, fontSize: 13, marginTop: 2 },
  syncBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.coral, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10, minWidth: 44, justifyContent: 'center' },
  syncTxt: { color: '#1c1a18', fontSize: 13, fontWeight: '700' },
  note: { marginHorizontal: 16, marginBottom: 6, backgroundColor: 'rgba(224,138,95,.12)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 13, borderWidth: 1, borderColor: 'rgba(224,138,95,.3)' },
  noteTxt: { color: C.coral, fontSize: 12.5, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  list: { paddingHorizontal: 16, paddingTop: 2 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 56 },
  emptyTxt: { color: C.faint, fontSize: 14 },
  thread: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.coral },
  threadSubject: { color: C.muted, fontSize: 14.5, fontWeight: '500' },
  threadUnread: { color: C.ink, fontWeight: '700' },
  threadFrom: { color: C.faint, fontSize: 12, marginTop: 2 },
  threadDate: { color: C.faint, fontSize: 11 },
  // détail
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  detailSubject: { color: C.ink, fontSize: 17, fontWeight: '700', lineHeight: 21 },
  detailFrom: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  round: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.05)', borderWidth: 1, borderColor: C.line },
  detailBody: { padding: 16 },
  bubble: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14, marginBottom: 12 },
  bubbleOut: { backgroundColor: 'rgba(224,138,95,.10)', borderColor: 'rgba(224,138,95,.22)' },
  bubbleHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 7 },
  bubbleFrom: { flex: 1, color: C.ink, fontSize: 14, fontWeight: '700' },
  bubbleDate: { color: C.faint, fontSize: 11 },
  bubbleText: { color: C.muted, fontSize: 14, lineHeight: 20 },
});
