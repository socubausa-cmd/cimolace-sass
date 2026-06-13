import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LiriColors as C, LiriFonts as F } from '@/constants/liri-theme';

import { ChapterCard } from './chapter-card';
import {
  chapterKey,
  fetchProject,
  loadProgress,
  markChapterComplete,
  type MasterclassProjectDetail,
} from './data';

/** Écran lecture d'une masterclass (GET /masterclass-factory/projects/:id). */
export function MasterscriptReader({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<MasterclassProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [detail, progress] = await Promise.all([
        fetchProject(projectId),
        loadProgress(projectId),
      ]);
      if (!alive) return;
      setProject(detail);
      setCompleted(progress.completedChapterIds);
      // Ouvre par défaut le premier chapitre non terminé.
      if (detail?.chapters.length) {
        const firstOpen = detail.chapters.find(
          (c, i) => !progress.completedChapterIds.includes(chapterKey(c, i)),
        );
        const idx = firstOpen ? detail.chapters.indexOf(firstOpen) : 0;
        setExpandedId(chapterKey(detail.chapters[idx], idx));
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  const chapters = useMemo(() => project?.chapters ?? [], [project?.chapters]);
  const total = chapters.length;
  const doneCount = useMemo(
    () => chapters.filter((c, i) => completed.includes(chapterKey(c, i))).length,
    [chapters, completed],
  );
  const ratio = total > 0 ? doneCount / total : 0;

  const onComplete = useCallback(
    async (key: string, nextKey: string | null) => {
      const progress = await markChapterComplete(projectId, key);
      setCompleted(progress.completedChapterIds);
      setExpandedId(nextKey);
    },
    [projectId],
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
        <Text style={styles.headerTitle} numberOfLines={1}>
          {project?.title ?? 'Masterclass'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.coral} />
        </View>
      ) : !project ? (
        <EmptyReader
          title="Masterclass introuvable"
          text="Ce projet n'est pas disponible. Connectez-vous, ou revenez à la liste."
        />
      ) : total === 0 ? (
        <EmptyReader
          title="Aucun chapitre"
          text="Cette masterclass n'a pas encore de chapitres générés."
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {!!project.analysis?.global_subject && (
            <View style={styles.intro}>
              <Text style={styles.introSubject}>{project.analysis.global_subject}</Text>
              {!!project.analysis.estimated_total_duration && (
                <View style={styles.introMeta}>
                  <Feather name="clock" size={13} color={C.faint} />
                  <Text style={styles.introMetaText}>
                    {project.analysis.estimated_total_duration}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.progress}>
            <View style={styles.progressTop}>
              <Text style={styles.progressLabel}>Progression</Text>
              <Text style={styles.progressCount}>
                {doneCount} / {total}
              </Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
            </View>
          </View>

          <View style={styles.chapters}>
            {chapters.map((chapter, i) => {
              const key = chapterKey(chapter, i);
              const nextKey =
                i + 1 < total ? chapterKey(chapters[i + 1], i + 1) : null;
              return (
                <ChapterCard
                  key={key}
                  chapter={chapter}
                  index={i}
                  completed={completed.includes(key)}
                  expanded={expandedId === key}
                  onToggle={() => setExpandedId((prev) => (prev === key ? null : key))}
                  onComplete={() => onComplete(key, nextKey)}
                />
              );
            })}
          </View>

          {doneCount === total && (
            <View style={styles.doneBanner}>
              <Feather name="check-circle" size={18} color={C.emeraldB} />
              <Text style={styles.doneText}>Masterclass terminée. Bravo !</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

/** État vide honnête du lecteur. */
function EmptyReader({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.empty}>
      <Feather name="book-open" size={28} color={C.faint} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  headerTitle: { flex: 1, fontFamily: F.serif, fontSize: 19, color: C.ink },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, gap: 16 },

  intro: { gap: 8 },
  introSubject: { fontFamily: F.sans, fontSize: 14, color: C.muted, lineHeight: 21 },
  introMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  introMetaText: { fontFamily: F.sans, fontSize: 13, color: C.faint },

  progress: {
    backgroundColor: C.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    gap: 10,
  },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontFamily: F.sans, fontSize: 12, fontWeight: '700', color: C.faint, textTransform: 'uppercase', letterSpacing: 0.6 },
  progressCount: { fontFamily: F.sans, fontSize: 14, fontWeight: '700', color: C.coral },
  track: { height: 8, borderRadius: 4, backgroundColor: C.rail, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: C.coral },

  chapters: { gap: 12 },

  doneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: 'rgba(109,143,96,0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(109,143,96,0.3)',
    paddingVertical: 14,
  },
  doneText: { fontFamily: F.sans, fontSize: 15, fontWeight: '700', color: C.emeraldB },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  emptyTitle: { fontFamily: F.serif, fontSize: 19, color: C.ink },
  emptyText: { fontFamily: F.sans, fontSize: 14, color: C.faint, textAlign: 'center', lineHeight: 21 },
});
