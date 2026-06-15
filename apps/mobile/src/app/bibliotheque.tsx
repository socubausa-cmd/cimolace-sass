import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriFonts as F, softShadow, type LiriPalette } from '@/constants/liri-theme';
import { fetchCourses, fetchReplays, type Course, type Replay } from '@/lib/liri-api';
import { useTheme } from '@/lib/theme';

type IconName = React.ComponentProps<typeof Feather>['name'];

type Cat = 'Tout' | 'Cours' | 'Masterclass' | 'Replays' | 'Images' | 'Exports';
const CATS: Cat[] = ['Tout', 'Cours', 'Masterclass', 'Replays', 'Images', 'Exports'];

interface Asset {
  icon: IconName;
  title: string;
  meta: string;
  kind: Exclude<Cat, 'Tout'>;
}

const MOIS_B = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** Mappe un replay (live_sessions) → carte d'asset. */
function replayToAsset(r: Replay): Asset {
  const d = r.scheduled_at ? new Date(r.scheduled_at) : null;
  const when = d ? `${d.getDate()} ${MOIS_B[d.getMonth()]}` : 'Replay';
  return {
    icon: 'film',
    title: r.title || 'Session enregistrée',
    meta: `Replay · ${when}`,
    kind: 'Replays',
  };
}

/** Mappe un cours (courses) → carte d'asset. */
function courseToAsset(c: Course): Asset {
  return {
    icon: 'book-open',
    title: c.title || 'Cours',
    meta: `Cours${c.category ? ` · ${c.category}` : ''}`,
    kind: 'Cours',
  };
}

export default function BibliothequeScreen() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [cat, setCat] = useState<Cat>('Tout');
  const [replays, setReplays] = useState<Replay[] | null>(null);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [r, c] = await Promise.all([fetchReplays(), fetchCourses()]);
    setReplays(r);
    setCourses(c);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // VRAIES données (catalogue cours + replays). Vide tant que non connecté.
  const loading = replays === null || courses === null;
  const assets = useMemo<Asset[]>(
    () => [
      ...(courses ? courses.map(courseToAsset) : []),
      ...(replays ? replays.map(replayToAsset) : []),
    ],
    [courses, replays],
  );

  const items = useMemo(
    () => (cat === 'Tout' ? assets : assets.filter((a) => a.kind === cat)),
    [cat, assets],
  );

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.flex1}>
              <Text style={styles.h1}>Bibliothèque</Text>
              <Text style={styles.h1sub}>Masterclass, replays, images, exports</Text>
            </View>
            {/* Point d'entrée vers le lecteur MasterScript (masterclass chapitrées) */}
            <Pressable
              style={({ pressed }) => [styles.readerBtn, pressed && styles.pressed]}
              onPress={() => router.push('/masterscript')}
              hitSlop={8}
            >
              <Feather name="file-text" size={15} color={C.coral} />
              <Text style={styles.readerBtnTxt}>Lecteur</Text>
            </Pressable>
          </View>
        </View>

        {/* filtres */}
        <View style={styles.filtersWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {CATS.map((c) => {
            const active = c === cat;
            return (
              <Pressable
                key={c}
                onPress={() => setCat(c)}
                style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
              >
                <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        </View>

        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.coral} />}
        >
          {!loading && items.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Feather name="folder" size={26} color={C.faint} /></View>
              <Text style={styles.emptyTitle}>Bibliothèque vide</Text>
              <Text style={styles.emptySub}>
                {cat === 'Tout'
                  ? 'Aucun replay disponible pour le moment.'
                  : `Aucun élément dans « ${cat} ».`}
              </Text>
            </View>
          ) : null}

          <View style={styles.grid}>
            {items.map((a) => (
              <Pressable key={a.title} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                <View style={styles.thumb}>
                  <Feather name={a.icon} size={26} color={C.coral} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{a.title}</Text>
                  <Text style={styles.cardMeta}>{a.meta}</Text>
                </View>
              </Pressable>
            ))}
          </View>
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
  header: { paddingHorizontal: 18, paddingTop: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  readerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.coralTint, borderRadius: 13,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  readerBtnTxt: { color: C.coral, fontSize: 13, fontWeight: '700', fontFamily: F.sans },
  h1: { color: C.ink, fontSize: 30, fontWeight: '500', fontFamily: F.serif },
  h1sub: { color: C.muted, fontSize: 13.5, marginTop: 4, fontFamily: F.sans },

  filtersWrap: { height: 60, justifyContent: 'center' },
  filters: { paddingHorizontal: 18, gap: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 14,
    height: 34,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
  },
  chipActive: { backgroundColor: 'rgba(217,119,87,0.9)', borderColor: 'transparent' },
  chipTxt: { color: C.muted, fontSize: 12.5, fontWeight: '600', fontFamily: F.sans },
  chipTxtActive: { color: '#fff' },

  scroll: { paddingHorizontal: 18, paddingBottom: 36 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47.7%',
    flexGrow: 1,
    borderRadius: 18,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
    ...softShadow,
  },
  thumb: {
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.panel2,
  },
  cardBody: { padding: 12 },
  cardTitle: { color: C.ink, fontSize: 13.5, fontWeight: '600', fontFamily: F.sans },
  cardMeta: { color: C.faint, fontSize: 11.5, marginTop: 3, fontFamily: F.sans },

  empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 32, gap: 10 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, marginBottom: 4,
  },
  emptyTitle: { color: C.ink, fontSize: 16, fontWeight: '600', fontFamily: F.sans },
  emptySub: { color: C.faint, fontSize: 13, lineHeight: 19, textAlign: 'center', fontFamily: F.sans },
});
