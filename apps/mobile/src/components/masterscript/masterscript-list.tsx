import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { LiriFonts as F, softShadow, type LiriPalette } from '@/constants/liri-theme';
import { useTheme } from '@/lib/theme';

import { fetchProjects, type MasterclassProjectSummary } from './data';
import { StatusBadge } from './status-badge';

/** Date courte FR (ex. « 6 juin »). */
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function shortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MOIS[d.getMonth()]}`;
}

/** Écran liste des masterclass (GET /masterclass-factory/projects). */
export function MasterscriptList() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [projects, setProjects] = useState<MasterclassProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const list = await fetchProjects();
    setProjects(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const open = useCallback(
    (id: string) => router.push({ pathname: '/masterscript', params: { projectId: id } }),
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: MasterclassProjectSummary }) => (
      <Pressable
        style={({ pressed }) => [styles.card, softShadow, pressed && styles.cardPressed]}
        onPress={() => open(item.id)}
        accessibilityRole="button"
      >
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title || 'Masterclass sans titre'}
          </Text>
          <StatusBadge status={item.status} />
        </View>
        <View style={styles.metaRow}>
          <View style={styles.meta}>
            <Feather name="layers" size={13} color={C.faint} />
            <Text style={styles.metaText}>
              {item.chapter_count ?? 0} chapitre{(item.chapter_count ?? 0) > 1 ? 's' : ''}
            </Text>
          </View>
          {!!item.pedagogical_model && (
            <View style={styles.meta}>
              <Feather name="cpu" size={13} color={C.faint} />
              <Text style={styles.metaText}>{item.pedagogical_model}</Text>
            </View>
          )}
          {!!shortDate(item.created_at) && (
            <View style={styles.meta}>
              <Feather name="calendar" size={13} color={C.faint} />
              <Text style={styles.metaText}>{shortDate(item.created_at)}</Text>
            </View>
          )}
        </View>
      </Pressable>
    ),
    [open],
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          hitSlop={10}
        >
          <Feather name="chevron-left" size={22} color={C.ink} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>Lecteur Masterclass</Text>
          <Text style={styles.heading}>Mes masterclass</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.coral} />
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.coral} />
          }
          ListEmptyComponent={<EmptyState />}
        />
      )}
    </View>
  );
}

/** État vide honnête : aucun projet (ou session non connectée → RLS = vide). */
function EmptyState() {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={styles.empty}>
      <LinearGradient
        colors={[C.coralTint, 'transparent']}
        style={styles.emptyIcon}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Feather name="book-open" size={26} color={C.coral} />
      </LinearGradient>
      <Text style={styles.emptyTitle}>Aucune masterclass</Text>
      <Text style={styles.emptyText}>
        Aucun projet n&apos;est disponible pour le moment. Connectez-vous et créez une masterclass
        depuis le Studio pour la retrouver ici.
      </Text>
    </View>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 14 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  kicker: { fontFamily: F.sans, fontSize: 11, fontWeight: '700', color: C.coral, letterSpacing: 0.8, textTransform: 'uppercase' },
  heading: { fontFamily: F.serif, fontSize: 24, color: C.ink, marginTop: 2 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 12, flexGrow: 1 },

  card: {
    backgroundColor: C.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    gap: 12,
  },
  cardPressed: { opacity: 0.85, borderColor: C.coralTint },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTitle: { flex: 1, fontFamily: F.serif, fontSize: 17, color: C.ink, lineHeight: 23 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontFamily: F.sans, fontSize: 13, color: C.muted },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14, paddingTop: 40 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.coralTint,
  },
  emptyTitle: { fontFamily: F.serif, fontSize: 19, color: C.ink },
  emptyText: { fontFamily: F.sans, fontSize: 14, color: C.faint, textAlign: 'center', lineHeight: 21 },
});
