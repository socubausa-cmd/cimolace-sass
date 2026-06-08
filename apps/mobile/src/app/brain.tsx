import { Feather } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Ember } from '@/components/ember';
import { LiriColors as C, LiriFonts as F, softShadow } from '@/constants/liri-theme';
import { hasToken, streamBrain } from '@/lib/liri-api';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
}

const SUGGESTIONS = [
  'Quels lives cette semaine ?',
  'Combien de membres actifs ?',
  'Cherche « ablutions » dans la base',
];

let seq = 0;
const nextId = () => `m${seq++}`;

export default function BrainScreen() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const cancelRef = useRef<null | (() => void)>(null);

  const scrollToEnd = () => requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

  const send = (text: string) => {
    const msg = text.trim();
    if (!msg || pending) return;
    setInput('');

    const userMsg: Msg = { id: nextId(), role: 'user', content: msg };
    const botId = nextId();
    setMessages((m) => [...m, userMsg, { id: botId, role: 'assistant', content: '', pending: true }]);
    setPending(true);
    scrollToEnd();

    // Sans token de dev, on évite un échec réseau brut : message clair.
    if (!hasToken()) {
      setTimeout(() => {
        setMessages((m) =>
          m.map((x) =>
            x.id === botId
              ? { ...x, pending: false, content: '🔒 Connexion requise pour discuter en direct. L’authentification arrive bientôt — la tuyauterie de streaming est déjà en place.' }
              : x,
          ),
        );
        setPending(false);
        scrollToEnd();
      }, 450);
      return;
    }

    let acc = '';
    const apply = (content: string, done: boolean) =>
      setMessages((m) => m.map((x) => (x.id === botId ? { ...x, content, pending: !done } : x)));

    cancelRef.current = streamBrain(
      { message: msg },
      {
        onToken: (delta) => {
          acc += delta;
          apply(acc, false);
          scrollToEnd();
        },
        onToolConfirm: () => {
          acc += '\n\n⚙️ Action nécessitant une confirmation (bientôt sur mobile).';
          apply(acc, false);
        },
        onDone: () => {
          apply(acc || '…', true);
          setPending(false);
          scrollToEnd();
        },
        onError: (e) => {
          apply(`⚠️ ${e}`, true);
          setPending(false);
        },
      },
    );
  };

  const newChat = () => {
    cancelRef.current?.();
    setPending(false);
    setMessages([]);
  };

  const empty = messages.length === 0;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.hLeft}>
            <Ember style={styles.brandMark}><Feather name="zap" size={16} color="#fff" /></Ember>
            <View>
              <Text style={styles.hTitle}>LIRI Brain</Text>
              <Text style={styles.hSub}>Assistant · Haiku · Isna</Text>
            </View>
          </View>
          <Pressable style={styles.newBtn} onPress={newChat} hitSlop={8}>
            <Feather name="edit" size={17} color={C.muted} />
          </Pressable>
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {empty ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyMark}><Feather name="zap" size={30} color={C.coral} /></View>
              <Text style={styles.emptyTitle}>Bonjour, je suis LIRI</Text>
              <Text style={styles.emptySub}>Demandez-moi vos cours, lives, statistiques ou la base de connaissances de l’école.</Text>
              <View style={styles.chips}>
                {SUGGESTIONS.map((s) => (
                  <Pressable key={s} style={({ pressed }) => [styles.chip, pressed && styles.pressed]} onPress={() => send(s)}>
                    <Text style={styles.chipTxt}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <ScrollView
              ref={scrollRef}
              style={styles.flex}
              contentContainerStyle={styles.thread}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={scrollToEnd}
            >
              {messages.map((m) =>
                m.role === 'user' ? (
                  <View key={m.id} style={styles.userRow}>
                    <View style={styles.userBubble}>
                      <Text style={styles.userText}>{m.content}</Text>
                    </View>
                  </View>
                ) : (
                  <View key={m.id} style={styles.botRow}>
                    <View style={styles.botAvatar}><Feather name="zap" size={13} color={C.coral} /></View>
                    <View style={styles.botBubble}>
                      {m.pending && !m.content ? (
                        <View style={styles.dots}>
                          <View style={styles.dot} />
                          <View style={[styles.dot, styles.dot2]} />
                          <View style={[styles.dot, styles.dot3]} />
                        </View>
                      ) : (
                        <Text style={styles.botText}>{m.content}</Text>
                      )}
                    </View>
                  </View>
                ),
              )}
            </ScrollView>
          )}

          {/* INPUT */}
          <View style={styles.inputBar}>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder="Demandez à LIRI Brain…"
                placeholderTextColor={C.faint}
                multiline
                onSubmitEditing={() => send(input)}
                returnKeyType="send"
              />
              <Pressable
                style={[styles.sendBtn, (!input.trim() || pending) && styles.sendBtnOff]}
                onPress={() => send(input)}
                disabled={!input.trim() || pending}
              >
                <Feather name="arrow-up" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  safe: { flex: 1 },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },

  // header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: C.rail,
  },
  hLeft: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandMark: { width: 34, height: 34, borderRadius: 11, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' },
  hTitle: { color: C.ink, fontSize: 15.5, fontWeight: '700', fontFamily: F.sans },
  hSub: { color: C.faint, fontSize: 11.5, marginTop: 1, fontFamily: F.sans },
  newBtn: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },

  // empty state
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 },
  emptyMark: { width: 64, height: 64, borderRadius: 22, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', ...softShadow },
  emptyTitle: { color: C.ink, fontSize: 25, fontWeight: '500', marginTop: 18, fontFamily: F.serif },
  emptySub: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8, fontFamily: F.sans },
  chips: { marginTop: 22, gap: 9, alignSelf: 'stretch' },
  chip: { paddingHorizontal: 15, paddingVertical: 12, borderRadius: 14, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
  chipTxt: { color: C.muted, fontSize: 13.5, fontWeight: '500', fontFamily: F.sans },

  // thread
  thread: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12, gap: 14 },
  userRow: { alignItems: 'flex-end' },
  userBubble: { maxWidth: '86%', backgroundColor: C.coral, borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10 },
  userText: { color: '#fff', fontSize: 14.5, lineHeight: 21, fontFamily: F.sans },
  botRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, maxWidth: '100%' },
  botAvatar: { width: 26, height: 26, borderRadius: 9, backgroundColor: C.coralTint, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  botBubble: { flex: 1, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 20, borderTopLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 11 },
  botText: { color: C.ink, fontSize: 14.5, lineHeight: 22, fontFamily: F.sans },
  dots: { flexDirection: 'row', gap: 5, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.faint, opacity: 0.9 },
  dot2: { opacity: 0.6 },
  dot3: { opacity: 0.35 },

  // input
  inputBar: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.rail },
  inputWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, backgroundColor: C.panel, borderRadius: 20, borderWidth: 1, borderColor: C.line, paddingLeft: 16, paddingRight: 7, paddingVertical: 6 },
  input: { flex: 1, color: C.ink, fontSize: 15, lineHeight: 20, paddingVertical: 7, maxHeight: 120, fontFamily: F.sans },
  sendBtn: { width: 38, height: 38, borderRadius: 13, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { opacity: 0.4 },
});
