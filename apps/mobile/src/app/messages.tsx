import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriFonts as F, type LiriPalette } from '@/constants/liri-theme';
import { useTheme } from '@/lib/theme';
import {
  fetchConversations,
  fetchThread,
  myUserId,
  sendMessage,
  type AppConversation,
  type AppMessage,
} from '@/lib/liri-api';

const initials = (name: string) =>
  name.split(/\s+/).map((w) => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || '?';

function timeShort(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export default function MessagesScreen() {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const [me, setMe] = useState<string | null>(null);
  const [convs, setConvs] = useState<AppConversation[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [active, setActive] = useState<AppConversation | null>(null);

  useEffect(() => {
    void myUserId().then(setMe);
  }, []);
  const load = useCallback(async () => setConvs(await fetchConversations()), []);
  useEffect(() => {
    void load();
  }, [load]);

  if (active) return <Thread me={me} conv={active} onBack={() => { setActive(null); void load(); }} />;

  const loading = convs === null;
  const list = convs ?? [];

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={s.safe}>
        <View style={s.header}><Text style={s.h1}>Messagerie</Text></View>
        {loading ? (
          <View style={s.fill}><ActivityIndicator color={C.coral} /></View>
        ) : list.length === 0 ? (
          <View style={s.fill}>
            <View style={s.emptyMark}><Feather name="message-circle" size={26} color={C.coral} /></View>
            <Text style={s.emptyTitle}>Aucune conversation</Text>
            <Text style={s.emptySub}>Tes échanges avec la communauté apparaîtront ici.</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.coral} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          >
            {list.map((c) => (
              <Pressable key={c.otherId} style={({ pressed }) => [s.convRow, pressed && s.pressed]} onPress={() => setActive(c)}>
                <View style={s.avatar}><Text style={s.avatarTxt}>{initials(c.name)}</Text></View>
                <View style={s.convMid}>
                  <Text style={s.convName} numberOfLines={1}>{c.name}</Text>
                  <Text style={s.convLast} numberOfLines={1}>{c.lastContent}</Text>
                </View>
                <View style={s.convRight}>
                  <Text style={s.convTime}>{timeShort(c.lastAt)}</Text>
                  {c.unread > 0 ? <View style={s.badge}><Text style={s.badgeTxt}>{c.unread}</Text></View> : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function Thread({ me, conv, onBack }: { me: string | null; conv: AppConversation; onBack: () => void }) {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const [msgs, setMsgs] = useState<AppMessage[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => setMsgs(await fetchThread(conv.otherId)), [conv.otherId]);
  useEffect(() => {
    void load();
  }, [load]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText('');
    const optimistic: AppMessage = { id: `tmp-${Date.now()}`, sender_id: me ?? 'me', receiver_id: conv.otherId, content: body, created_at: new Date().toISOString() };
    setMsgs((prev) => [...(prev ?? []), optimistic]);
    await sendMessage(conv.otherId, body);
    setSending(false);
    void load();
  };

  const list = msgs ?? [];

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={s.safe}>
        <View style={s.threadHead}>
          <Pressable onPress={onBack} hitSlop={10}><Feather name="chevron-left" size={24} color={C.ink} /></Pressable>
          <View style={s.threadAvatar}><Text style={s.threadAvatarTxt}>{initials(conv.name)}</Text></View>
          <Text style={s.threadName} numberOfLines={1}>{conv.name}</Text>
        </View>
        <KeyboardAvoidingView style={s.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={s.threadScroll}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {msgs === null ? (
              <ActivityIndicator color={C.coral} style={{ marginTop: 24 }} />
            ) : (
              list.map((m) => {
                const mine = m.sender_id === me;
                return (
                  <View key={m.id} style={[s.bubbleRow, mine ? s.bubbleRowMine : s.bubbleRowOther]}>
                    <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleOther]}>
                      <Text style={[s.bubbleTxt, mine && s.bubbleTxtMine]}>{m.content}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
          <View style={s.inputBar}>
            <TextInput
              style={s.input}
              placeholder="Écrire un message…"
              placeholderTextColor={C.faint}
              value={text}
              onChangeText={setText}
              multiline
            />
            <Pressable style={[s.sendBtn, !text.trim() && s.sendBtnOff]} onPress={send} disabled={!text.trim() || sending}>
              <Feather name="send" size={18} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  safe: { flex: 1 },
  flex1: { flex: 1 },
  pressed: { opacity: 0.7 },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingBottom: 60 },

  header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12 },
  h1: { color: C.ink, fontSize: 28, fontWeight: '700', fontFamily: F.serif },
  scroll: { paddingHorizontal: 14, paddingBottom: 24 },

  convRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, marginBottom: 4 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.coralTint, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: C.coral, fontSize: 16, fontWeight: '800' },
  convMid: { flex: 1, minWidth: 0 },
  convName: { color: C.ink, fontSize: 15, fontWeight: '700', fontFamily: F.sans },
  convLast: { color: C.faint, fontSize: 13, marginTop: 2, fontFamily: F.sans },
  convRight: { alignItems: 'flex-end', gap: 5 },
  convTime: { color: C.faint, fontSize: 11.5 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },

  emptyMark: { width: 60, height: 60, borderRadius: 20, backgroundColor: C.coralTint, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: C.ink, fontSize: 18, fontWeight: '600', marginTop: 16, fontFamily: F.sans },
  emptySub: { color: C.muted, fontSize: 13.5, textAlign: 'center', marginTop: 6, fontFamily: F.sans },

  threadHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  threadAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.coralTint, alignItems: 'center', justifyContent: 'center' },
  threadAvatarTxt: { color: C.coral, fontSize: 13, fontWeight: '800' },
  threadName: { color: C.ink, fontSize: 16, fontWeight: '700', flex: 1, fontFamily: F.sans },
  threadScroll: { padding: 14, gap: 8 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMine: { backgroundColor: C.coral, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: C.panel, borderBottomLeftRadius: 4 },
  bubbleTxt: { color: C.ink, fontSize: 14.5, lineHeight: 19, fontFamily: F.sans },
  bubbleTxtMine: { color: '#fff' },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line },
  input: { flex: 1, maxHeight: 110, color: C.ink, fontSize: 14.5, backgroundColor: C.panel, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontFamily: F.sans },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { opacity: 0.4 },
});
