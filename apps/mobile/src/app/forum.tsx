import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriFonts as F, softShadow, type LiriPalette } from '@/constants/liri-theme';
import { useTheme } from '@/lib/theme';
import { fetchForumTopics, type ForumTopic } from '@/lib/liri-api';

type IconName = React.ComponentProps<typeof Feather>['name'];

interface Thread {
  id: string;
  name: string;
  last: string;
  time: string;
  icon: IconName;
  live?: boolean;
  unread?: number;
  missed?: boolean;
  initials?: string;
  online?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
function timeLabel(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'hier';
  return `${d.getDate()}/${pad(d.getMonth() + 1)}`;
}

/** Mappe un topic (table forum_topics) → ligne d'affichage. */
function topicToThread(t: ForumTopic): Thread {
  return {
    id: t.id,
    name: t.title || 'Discussion',
    last: t.category ? `# ${t.category}` : 'Discussion',
    time: timeLabel(t.last_post_at || t.created_at),
    icon: t.is_pinned ? 'bookmark' : 'message-square',
    unread: t.replies_count && t.replies_count > 0 ? t.replies_count : undefined,
  };
}

export default function ForumScreen() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [q, setQ] = useState('');
  const [topics, setTopics] = useState<ForumTopic[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setTopics(await fetchForumTopics());
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  // Recharge à chaque retour sur l'onglet (ex. après création d'une discussion).
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // VRAIES données uniquement (table forum_topics, comme le web). Pas de maquette :
  // si la base est vide, on affiche un état vide honnête.
  const loading = topics === null;
  const threads = useMemo<Thread[]>(() => (topics ? topics.map(topicToThread) : []), [topics]);
  const items = threads.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.h1}>Forum</Text>
          <Pressable
            onPress={() => router.push('/creer-discussion')}
            style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
          >
            <Feather name="plus" size={18} color={C.coral} />
          </Pressable>
        </View>

        {/* recherche */}
        <View style={styles.searchWrap}>
          <View style={styles.search}>
            <Feather name="search" size={15} color={C.faint} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Rechercher…"
              placeholderTextColor={C.faint}
              style={styles.searchInput}
            />
          </View>
        </View>

        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.coral} />}
        >
          {/* État vide / chargement — vraie donnée (forum_topics), pas de maquette */}
          {!loading && items.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Feather name="message-square" size={26} color={C.faint} />
              </View>
              <Text style={styles.emptyTitle}>Aucune discussion</Text>
              <Text style={styles.emptySub}>
                {q.trim() ? 'Aucun résultat pour cette recherche.' : 'Sois le premier à lancer une discussion sur le forum.'}
              </Text>
            </View>
          ) : null}

          {items.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => router.push({ pathname: '/forum/[topicId]', params: { topicId: t.id } } as unknown as Href)}
              style={({ pressed }) => [styles.row, t.live && styles.rowLive, pressed && styles.pressed]}
            >
              {/* avatar */}
              <View style={[styles.avatar, t.live && styles.avatarLive]}>
                {t.initials ? (
                  <Text style={styles.avatarInitials}>{t.initials}</Text>
                ) : (
                  <Feather name={t.icon} size={16} color={t.live ? '#fff' : C.coral} />
                )}
                {t.online ? <View style={styles.onlineDot} /> : null}
              </View>

              {/* corps */}
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowName} numberOfLines={1}>{t.name}</Text>
                  {t.time ? <Text style={styles.rowTime}>{t.time}</Text> : null}
                </View>
                <Text
                  style={[styles.rowLast, t.live && styles.rowLastLive, t.missed && styles.rowLastMissed]}
                  numberOfLines={1}
                >
                  {t.missed ? '↘ ' : ''}{t.last}
                </Text>
              </View>

              {/* badge non-lus */}
              {t.unread ? (
                <View style={styles.unread}>
                  <Text style={styles.unreadTxt}>{t.unread}</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  safe: { flex: 1 },
  flex1: { flex: 1 },
  pressed: { opacity: 0.7 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 14 },
  h1: { color: C.ink, fontSize: 28, fontWeight: '500', fontFamily: F.serif },
  newBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },

  searchWrap: { paddingHorizontal: 18, paddingVertical: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
  searchInput: { flex: 1, color: C.ink, fontSize: 14, fontFamily: F.sans },

  scroll: { paddingHorizontal: 12, paddingBottom: 36, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 11, borderRadius: 18 },
  rowLive: { backgroundColor: 'rgba(226,85,63,0.10)', borderWidth: 1, borderColor: 'rgba(226,85,63,0.25)' },

  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: C.coralTint, ...softShadow },
  avatarLive: { backgroundColor: C.live },
  avatarInitials: { color: C.coral, fontSize: 14, fontWeight: '700', fontFamily: F.sans },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 11, height: 11, borderRadius: 6, backgroundColor: '#34D399', borderWidth: 2, borderColor: C.base },

  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowName: { color: C.ink, fontSize: 14, fontWeight: '600', fontFamily: F.sans, flex: 1 },
  rowTime: { color: C.faint, fontSize: 11, marginLeft: 8, fontFamily: F.sans },
  rowLast: { color: C.faint, fontSize: 12.5, marginTop: 2, fontFamily: F.sans },
  rowLastLive: { color: C.liveSoft },
  rowLastMissed: { color: C.liveSoft },

  unread: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' },
  unreadTxt: { color: '#fff', fontSize: 11, fontWeight: '800', fontFamily: F.sans },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 10 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, marginBottom: 4,
  },
  emptyTitle: { color: C.ink, fontSize: 16, fontWeight: '600', fontFamily: F.sans },
  emptySub: { color: C.faint, fontSize: 13, lineHeight: 19, textAlign: 'center', fontFamily: F.sans },
});
