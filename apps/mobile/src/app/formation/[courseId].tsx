import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LiriFonts as F, softShadow, type LiriPalette } from '@/constants/liri-theme';
import LessonPlayer from '@/components/lesson-player';
import { fetchCourseCurriculum, type CourseCurriculum, type CurriculumLesson } from '@/lib/learning-api';
import { useTheme } from '@/lib/theme';

export default function CourseDetailScreen() {
  const { courseId } = useLocalSearchParams<{ courseId?: string }>();
  const router = useRouter();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [data, setData] = useState<CourseCurriculum | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [openLesson, setOpenLesson] = useState<CurriculumLesson | null>(null);

  useEffect(() => {
    if (!courseId) {
      setError('Formation introuvable.');
      return;
    }
    let active = true;
    void fetchCourseCurriculum(courseId)
      .then((result) => {
        if (!active) return;
        setData(result);
        if (result.modules[0]) setExpanded({ [result.modules[0].id]: true });
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Impossible de charger cette formation.');
      });
    return () => {
      active = false;
    };
  }, [courseId]);

  const completedIds = useMemo(
    () => new Set(data?.progress.filter((item) => item.status === 'completed').map((item) => item.lesson_id) ?? []),
    [data?.progress],
  );
  const lessonCount = data?.modules.reduce((sum, module) => sum + module.lessons.length, 0) ?? 0;
  const completedCount = data?.modules.reduce(
    (sum, module) => sum + module.lessons.filter((lesson) => completedIds.has(lesson.id)).length,
    0,
  ) ?? 0;
  const percent = lessonCount ? Math.round((completedCount / lessonCount) * 100) : 0;

  return (
    <View style={styles.root}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Feather name="chevron-left" size={22} color={C.ink} />
          <Text style={styles.backText}>Formations</Text>
        </Pressable>

        {!data && !error ? <ActivityIndicator color={C.coral} style={styles.loader} /> : null}

        {error ? (
          <View style={styles.error}>
            <Feather name="alert-circle" size={24} color={C.coral} />
            <Text selectable style={styles.errorTitle}>Programme indisponible</Text>
            <Text selectable style={styles.errorCopy}>{error}</Text>
          </View>
        ) : null}

        {data ? (
          <>
            <View style={styles.hero}>
              <Text selectable style={styles.category}>{(data.course.category || 'FORMATION').toUpperCase()}</Text>
              <Text selectable style={styles.title}>{data.course.title || 'Formation sans titre'}</Text>
              <Text selectable style={styles.description}>
                {data.course.description || 'Explore le programme complet de cette formation.'}
              </Text>
              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Feather name="layers" size={16} color={C.coral} />
                  <Text selectable style={styles.statText}>{data.modules.length} module{data.modules.length > 1 ? 's' : ''}</Text>
                </View>
                <View style={styles.stat}>
                  <Feather name="play-circle" size={16} color={C.coral} />
                  <Text selectable style={styles.statText}>{lessonCount} leçon{lessonCount > 1 ? 's' : ''}</Text>
                </View>
              </View>
            </View>

            <View style={styles.progressCard}>
              <View style={styles.progressHead}>
                <Text selectable style={styles.progressTitle}>Ta progression</Text>
                <Text selectable style={styles.progressValue}>{percent}%</Text>
              </View>
              <View style={styles.track}><View style={[styles.fill, { width: `${percent}%` }]} /></View>
              <Text selectable style={styles.progressCopy}>{completedCount} leçon{completedCount > 1 ? 's' : ''} terminée{completedCount > 1 ? 's' : ''} sur {lessonCount}</Text>
            </View>

            <View style={styles.section}>
              <Text selectable style={styles.sectionTitle}>Programme</Text>
              {data.modules.length === 0 ? (
                <Text selectable style={styles.empty}>Le programme détaillé sera bientôt disponible.</Text>
              ) : null}
              {data.modules.map((module, index) => {
                const isOpen = expanded[module.id] === true;
                const done = module.lessons.filter((lesson) => completedIds.has(lesson.id)).length;
                return (
                  <View key={module.id} style={styles.module}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                      onPress={() => setExpanded((current) => ({ ...current, [module.id]: !isOpen }))}
                      style={({ pressed }) => [styles.moduleHead, pressed && styles.pressed]}
                    >
                      <View style={styles.moduleIndex}><Text style={styles.moduleIndexText}>{index + 1}</Text></View>
                      <View style={styles.moduleCopy}>
                        <Text selectable style={styles.moduleTitle}>{module.title || `Module ${index + 1}`}</Text>
                        <Text selectable style={styles.moduleMeta}>{done}/{module.lessons.length} leçons terminées</Text>
                      </View>
                      <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={C.faint} />
                    </Pressable>
                    {isOpen ? (
                      <View style={styles.lessons}>
                        {module.description ? <Text selectable style={styles.moduleDescription}>{module.description}</Text> : null}
                        {module.lessons.map((lesson, lessonIndex) => {
                          const complete = completedIds.has(lesson.id);
                          const kindLabel =
                            lesson.contentType === 'video' ? 'Vidéo'
                            : lesson.contentType === 'quiz' ? 'Quiz'
                            : lesson.contentType === 'powerpoint' ? 'Support'
                            : 'Cours';
                          return (
                            <Pressable
                              key={lesson.id}
                              accessibilityRole="button"
                              onPress={() => setOpenLesson(lesson)}
                              style={({ pressed }) => [styles.lesson, pressed && styles.pressed]}
                            >
                              <View style={[styles.lessonIcon, complete && styles.lessonIconDone]}>
                                <Feather name={complete ? 'check' : lesson.contentType === 'video' ? 'play' : lesson.contentType === 'quiz' ? 'help-circle' : 'file-text'} size={14} color={complete ? '#fff' : C.coral} />
                              </View>
                              <View style={styles.lessonCopy}>
                                <Text style={styles.lessonTitle}>{lesson.title || `Leçon ${lessonIndex + 1}`}</Text>
                                <Text style={styles.lessonMeta}>{kindLabel} · Leçon {lessonIndex + 1}</Text>
                              </View>
                              <Feather name="chevron-right" size={16} color={C.faint} />
                            </Pressable>
                          );
                        })}
                        {module.lessons.length === 0 ? <Text selectable style={styles.emptyLesson}>Aucune leçon dans ce module.</Text> : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>
      <LessonPlayer lesson={openLesson} onClose={() => setOpenLesson(null)} />
    </View>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 48, gap: 18 },
  back: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 38 },
  backText: { color: C.ink, fontSize: 14, fontWeight: '700', fontFamily: F.sans },
  loader: { paddingTop: 100 },
  hero: { gap: 10, paddingVertical: 12 },
  category: { color: C.coral, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, fontFamily: F.sans },
  title: { color: C.ink, fontSize: 32, lineHeight: 38, fontWeight: '600', fontFamily: F.serif },
  description: { color: C.muted, fontSize: 14, lineHeight: 21, fontFamily: F.sans },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 4 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12, backgroundColor: C.coralTint },
  statText: { color: C.ink, fontSize: 12, fontWeight: '600', fontFamily: F.sans },
  progressCard: { gap: 10, padding: 16, borderRadius: 18, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, ...softShadow },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTitle: { color: C.ink, fontSize: 15, fontWeight: '700', fontFamily: F.sans },
  progressValue: { color: C.coral, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'], fontFamily: F.sans },
  track: { height: 7, borderRadius: 99, overflow: 'hidden', backgroundColor: C.panel2 },
  fill: { height: '100%', borderRadius: 99, backgroundColor: C.coral },
  progressCopy: { color: C.muted, fontSize: 11.5, fontFamily: F.sans },
  section: { gap: 11 },
  sectionTitle: { color: C.ink, fontSize: 22, fontWeight: '600', fontFamily: F.serif },
  module: { overflow: 'hidden', borderRadius: 17, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
  moduleHead: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14 },
  pressed: { opacity: 0.7 },
  moduleIndex: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: C.coralTint },
  moduleIndexText: { color: C.coral, fontWeight: '800', fontVariant: ['tabular-nums'], fontFamily: F.sans },
  moduleCopy: { flex: 1, gap: 3 },
  moduleTitle: { color: C.ink, fontSize: 15, fontWeight: '700', fontFamily: F.sans },
  moduleMeta: { color: C.faint, fontSize: 11.5, fontFamily: F.sans },
  moduleDescription: { color: C.muted, fontSize: 12, lineHeight: 18, paddingBottom: 6, fontFamily: F.sans },
  lessons: { gap: 2, paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: C.line },
  lesson: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 58, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  lessonIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: C.coralTint },
  lessonIconDone: { backgroundColor: C.coral },
  lessonCopy: { flex: 1, gap: 3 },
  lessonTitle: { color: C.ink, fontSize: 13, fontWeight: '600', fontFamily: F.sans },
  lessonMeta: { color: C.faint, fontSize: 10.5, fontFamily: F.sans },
  empty: { color: C.muted, fontSize: 13, paddingVertical: 20, fontFamily: F.sans },
  emptyLesson: { color: C.faint, fontSize: 12, paddingVertical: 15, fontFamily: F.sans },
  error: { alignItems: 'center', gap: 10, padding: 28, borderRadius: 18, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
  errorTitle: { color: C.ink, fontSize: 17, fontWeight: '700', fontFamily: F.serif },
  errorCopy: { color: C.muted, textAlign: 'center', fontSize: 13, lineHeight: 19, fontFamily: F.sans },
});
