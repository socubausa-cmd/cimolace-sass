import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriFonts as F, type LiriPalette } from '@/constants/liri-theme';
import {
  getForumPosts, getForumTopic, replyToForumTopic, type ForumPost, type ForumTopicDetail,
} from '@/lib/community-api';
import { useTheme } from '@/lib/theme';

const dateLabel = (value?: string) => value
  ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '';

export default function ForumTopicScreen() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const router = useRouter();
  const { colors: C } = useTheme();
  const s = useMemo(() => styles(C), [C]);
  const [topic, setTopic] = useState<ForumTopicDetail | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!topicId) return;
    try {
      setError(null);
      const [nextTopic, nextPosts] = await Promise.all([getForumTopic(topicId), getForumPosts(topicId)]);
      setTopic(nextTopic);
      setPosts(nextPosts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Discussion inaccessible.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [topicId]);
  useEffect(() => { void load(); }, [load]);

  const send = async () => {
    const content = text.trim();
    if (!content || !topicId || sending) return;
    setSending(true);
    setError(null);
    try {
      const post = await replyToForumTopic(topicId, content);
      setPosts((current) => [...current, post]);
      setText('');
      requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Réponse non envoyée.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={s.safe}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}><Feather name="chevron-left" size={25} color={C.ink} /></Pressable>
          <Text style={s.headerTitle} numberOfLines={1}>{topic?.title ?? 'Discussion'}</Text>
        </View>
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {loading ? <View style={s.center}><ActivityIndicator color={C.coral} /></View> : (
            <ScrollView
              ref={scroll}
              contentContainerStyle={s.content}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={C.coral} />}
            >
              {topic ? (
                <View style={s.topic}>
                  <Text style={s.category}>{topic.category || 'Général'}</Text>
                  <Text style={s.title}>{topic.title}</Text>
                  <Text style={s.date}>{dateLabel(topic.created_at)}</Text>
                  {topic.content ? <Text style={s.body}>{topic.content}</Text> : null}
                </View>
              ) : null}
              <Text style={s.replyCount}>{posts.length} réponse{posts.length === 1 ? '' : 's'}</Text>
              {posts.map((post, index) => (
                <View key={post.id} style={s.post}>
                  <View style={s.avatar}><Text style={s.avatarText}>{index + 1}</Text></View>
                  <View style={s.postBody}>
                    <Text style={s.postMeta}>Membre · {dateLabel(post.created_at)}</Text>
                    <Text style={s.postText}>{post.content}</Text>
                  </View>
                </View>
              ))}
              {error ? <Text style={s.error}>{error}</Text> : null}
            </ScrollView>
          )}
          {!topic?.is_locked ? (
            <View style={s.composer}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Écrire une réponse…"
                placeholderTextColor={C.faint}
                style={s.input}
                multiline
              />
              <Pressable onPress={send} disabled={!text.trim() || sending} style={[s.send, (!text.trim() || sending) && s.disabled]}>
                {sending ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="send" color="#fff" size={18} />}
              </Pressable>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = (C: LiriPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base }, safe: { flex: 1 }, flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { height: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  headerTitle: { flex: 1, color: C.ink, fontFamily: F.serif, fontWeight: '600', fontSize: 19 },
  content: { padding: 16, paddingBottom: 28 },
  topic: { padding: 18, borderRadius: 20, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
  category: { color: C.coral, fontFamily: F.sans, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  title: { color: C.ink, fontFamily: F.serif, fontSize: 24, fontWeight: '600', marginTop: 6 },
  date: { color: C.faint, fontFamily: F.sans, fontSize: 11, marginTop: 6 },
  body: { color: C.muted, fontFamily: F.sans, fontSize: 15, lineHeight: 22, marginTop: 16 },
  replyCount: { color: C.ink, fontFamily: F.sans, fontWeight: '700', marginTop: 24, marginBottom: 8 },
  post: { flexDirection: 'row', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.coralTint, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.coral, fontSize: 11, fontWeight: '800' },
  postBody: { flex: 1 }, postMeta: { color: C.faint, fontSize: 11, fontFamily: F.sans },
  postText: { color: C.ink, fontSize: 14.5, lineHeight: 20, fontFamily: F.sans, marginTop: 4 },
  error: { color: C.liveSoft, fontSize: 13, marginVertical: 12 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: C.line },
  input: { flex: 1, maxHeight: 100, minHeight: 44, borderRadius: 20, backgroundColor: C.panel, color: C.ink, paddingHorizontal: 15, paddingVertical: 11, fontFamily: F.sans },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
});
