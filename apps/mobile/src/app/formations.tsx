import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LiriFonts as F, softShadow, type LiriPalette } from '@/constants/liri-theme';
import { fetchStudentCourses } from '@/lib/learning-api';
import type { Course } from '@/lib/liri-api';
import { useTheme } from '@/lib/theme';

const categoryLabel = (value?: string) =>
  value && value !== 'general' ? value.replaceAll('-', ' ') : 'Formation';

export default function StudentFormationsScreen() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setCourses(await fetchStudentCourses());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de charger les formations.');
      setCourses([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.coral} />}
      >
        <View style={styles.heading}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
            <Feather name="chevron-left" size={22} color={C.ink} />
          </Pressable>
          <View style={styles.headingCopy}>
            <Text selectable style={styles.eyebrow}>ESPACE ÉLÈVE</Text>
            <Text selectable style={styles.title}>Mes formations</Text>
            <Text selectable style={styles.subtitle}>Retrouve ton programme et reprends là où tu t’es arrêté.</Text>
          </View>
        </View>

        {courses === null ? <ActivityIndicator color={C.coral} style={styles.loader} /> : null}

        {error ? (
          <View style={styles.stateCard}>
            <Feather name="wifi-off" size={24} color={C.coral} />
            <Text selectable style={styles.stateTitle}>Chargement impossible</Text>
            <Text selectable style={styles.stateCopy}>{error}</Text>
            <Pressable onPress={() => void load()} style={styles.retry}>
              <Text style={styles.retryText}>Réessayer</Text>
            </Pressable>
          </View>
        ) : null}

        {courses?.length === 0 && !error ? (
          <View style={styles.stateCard}>
            <Feather name="book-open" size={26} color={C.coral} />
            <Text selectable style={styles.stateTitle}>Aucune formation disponible</Text>
            <Text selectable style={styles.stateCopy}>Les formations publiées par ton école apparaîtront ici.</Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {courses?.map((course, index) => (
            <Pressable
              key={course.id}
              accessibilityRole="button"
              accessibilityLabel={`Ouvrir la formation ${course.title ?? 'sans titre'}`}
              onPress={() => router.push(`/formation/${course.id}` as never)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <View style={styles.cover}>
                <View style={styles.coverNumber}>
                  <Text style={styles.coverNumberText}>{String(index + 1).padStart(2, '0')}</Text>
                </View>
                <Feather name="book-open" size={28} color={C.coral} />
              </View>
              <View style={styles.cardBody}>
                <Text selectable style={styles.category}>{categoryLabel(course.category).toUpperCase()}</Text>
                <Text selectable numberOfLines={2} style={styles.cardTitle}>{course.title || 'Formation sans titre'}</Text>
                <Text selectable numberOfLines={2} style={styles.description}>
                  {course.description || 'Découvre le programme détaillé de cette formation.'}
                </Text>
                <View style={styles.openRow}>
                  <Text style={styles.openText}>Voir le programme</Text>
                  <Feather name="arrow-right" size={16} color={C.coral} />
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 44, gap: 22 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  back: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
  headingCopy: { flex: 1, gap: 4 },
  eyebrow: { color: C.coral, fontSize: 11, fontWeight: '800', letterSpacing: 1.3, fontFamily: F.sans },
  title: { color: C.ink, fontSize: 30, fontWeight: '600', fontFamily: F.serif },
  subtitle: { color: C.muted, fontSize: 13.5, lineHeight: 20, fontFamily: F.sans },
  loader: { paddingTop: 70 },
  list: { gap: 14 },
  card: { flexDirection: 'row', minHeight: 164, borderRadius: 20, overflow: 'hidden', backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, ...softShadow },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  cover: { width: 104, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center', gap: 18 },
  coverNumber: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: C.coralTint },
  coverNumberText: { color: C.coral, fontSize: 10, fontWeight: '800', fontVariant: ['tabular-nums'], fontFamily: F.sans },
  cardBody: { flex: 1, padding: 16, gap: 7 },
  category: { color: C.coral, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, fontFamily: F.sans },
  cardTitle: { color: C.ink, fontSize: 18, lineHeight: 22, fontWeight: '700', fontFamily: F.serif },
  description: { color: C.muted, fontSize: 12.5, lineHeight: 18, fontFamily: F.sans },
  openRow: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 },
  openText: { color: C.coral, fontSize: 12.5, fontWeight: '700', fontFamily: F.sans },
  stateCard: { alignItems: 'center', gap: 9, paddingHorizontal: 24, paddingVertical: 34, borderRadius: 20, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
  stateTitle: { color: C.ink, fontSize: 17, fontWeight: '700', fontFamily: F.serif },
  stateCopy: { color: C.muted, textAlign: 'center', fontSize: 13, lineHeight: 19, fontFamily: F.sans },
  retry: { marginTop: 4, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: C.coral },
  retryText: { color: '#fff', fontWeight: '800', fontSize: 12.5, fontFamily: F.sans },
});
