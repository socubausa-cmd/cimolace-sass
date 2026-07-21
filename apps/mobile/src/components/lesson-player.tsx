import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LiriFonts as F, softShadow, type LiriPalette } from '@/constants/liri-theme';
import type { CurriculumLesson } from '@/lib/learning-api';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

/** Retire les balises HTML pour un rendu texte natif lisible. */
function htmlToText(html?: string): string {
  return String(html ?? '')
    .replace(/<br\s*\/?>(?=)/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

type Slide = { title?: string; content?: string };
type Question = { question?: string; options?: string[]; correctAnswer?: number };
type Branch = { label?: string; title?: string; summary?: string; keyPoints?: string[] };

/** Résout l'URL vidéo jouable : montage (renderedUrl) > url directe > URL signée du storagePath. */
async function resolveVideoUrl(data: Record<string, unknown>): Promise<string> {
  const rendered = String(data.renderedUrl ?? '').trim();
  if (rendered) return rendered;
  const url = String(data.url ?? '').trim();
  if (url) return url;
  const sp = (data.storagePath ?? data.storage_path) as string | undefined;
  if (sp) {
    const { data: signed } = await supabase.storage.from('videos').createSignedUrl(String(sp), 3600);
    return signed?.signedUrl ?? '';
  }
  return '';
}

export default function LessonPlayer({ lesson, onClose }: { lesson: CurriculumLesson | null; onClose: () => void }) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const data = (lesson?.contentData ?? {}) as Record<string, unknown>;
  const type = lesson?.contentType ?? '';

  const [videoUrl, setVideoUrl] = useState<string>('');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setAnswers({});
    setSubmitted(false);
    if (lesson && type === 'video') {
      let active = true;
      void resolveVideoUrl(data).then((u) => { if (active) setVideoUrl(u); });
      return () => { active = false; };
    }
    setVideoUrl('');
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id]);

  const slides = Array.isArray(data.slides) ? (data.slides as Slide[]) : [];
  const questions = Array.isArray(data.questions) ? (data.questions as Question[]) : [];
  const mindmap = (data.mindmap ?? null) as { label?: string; summary?: string; children?: Branch[] } | null;
  const score = questions.reduce((n, q, i) => (answers[i] === q.correctAnswer ? n + 1 : n), 0);

  return (
    <Modal visible={!!lesson} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={styles.root}>
        <View style={styles.head}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
            <Feather name="x" size={22} color={C.ink} />
          </Pressable>
          <Text numberOfLines={1} style={styles.headTitle}>{lesson?.title ?? 'Leçon'}</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {/* ── VIDÉO ── */}
          {type === 'video' ? (
            <View style={styles.block}>
              <View style={styles.videoCard}>
                <Feather name="play-circle" size={40} color={C.coral} />
                <Text style={styles.videoLabel}>{htmlToText(String(data.title ?? '')) || 'Vidéo de la leçon'}</Text>
                <Pressable
                  disabled={!videoUrl}
                  onPress={() => videoUrl && void Linking.openURL(videoUrl)}
                  style={({ pressed }) => [styles.cta, !videoUrl && styles.ctaOff, pressed && styles.pressed]}
                >
                  <Feather name="external-link" size={15} color="#fff" />
                  <Text style={styles.ctaText}>{videoUrl ? 'Regarder la vidéo' : 'Vidéo indisponible'}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* ── SUPPORT (slides) ── */}
          {type === 'powerpoint' && slides.length ? (
            <View style={styles.block}>
              {slides.map((s, i) => (
                <View key={i} style={styles.slide}>
                  {s.title ? <Text style={styles.slideTitle}>{s.title}</Text> : null}
                  <Text selectable style={styles.slideBody}>{htmlToText(s.content) || '—'}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* ── QUIZ ── */}
          {type === 'quiz' && questions.length ? (
            <View style={styles.block}>
              {questions.map((q, qi) => (
                <View key={qi} style={styles.quizQ}>
                  <Text style={styles.quizQTitle}>{qi + 1}. {q.question ?? 'Question'}</Text>
                  {(q.options ?? []).map((opt, oi) => {
                    const picked = answers[qi] === oi;
                    const correct = submitted && oi === q.correctAnswer;
                    const wrong = submitted && picked && oi !== q.correctAnswer;
                    return (
                      <Pressable
                        key={oi}
                        disabled={submitted}
                        onPress={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                        style={[styles.opt, picked && styles.optPicked, correct && styles.optCorrect, wrong && styles.optWrong]}
                      >
                        <Text style={[styles.optText, (correct || wrong) && { color: '#fff' }]}>{opt}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
              {submitted ? (
                <Text style={styles.quizScore}>Score : {score}/{questions.length}</Text>
              ) : (
                <Pressable
                  disabled={Object.keys(answers).length !== questions.length}
                  onPress={() => setSubmitted(true)}
                  style={({ pressed }) => [styles.cta, Object.keys(answers).length !== questions.length && styles.ctaOff, pressed && styles.pressed]}
                >
                  <Text style={styles.ctaText}>Valider</Text>
                </Pressable>
              )}
            </View>
          ) : null}

          {/* ── MINDMAP (carte de révision) ── */}
          {mindmap && Array.isArray(mindmap.children) && mindmap.children.length ? (
            <View style={styles.block}>
              <Text style={styles.mmRoot}>{mindmap.label ?? 'Carte de révision'}</Text>
              {mindmap.children.map((b, i) => (
                <View key={i} style={styles.branch}>
                  <Text style={styles.branchLabel}>{b.label ?? b.title ?? `Concept ${i + 1}`}</Text>
                  {b.summary ? <Text style={styles.branchSummary}>{b.summary}</Text> : null}
                  {Array.isArray(b.keyPoints) && b.keyPoints.length ? (
                    <Text style={styles.branchKeys}>{b.keyPoints.map((k) => `• ${k}`).join('\n')}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {/* ── Repli : rien de reconnu ── */}
          {type !== 'video' && !(type === 'powerpoint' && slides.length) && !(type === 'quiz' && questions.length) && !(mindmap?.children?.length) ? (
            <Text style={styles.empty}>Le contenu de cette leçon sera bientôt disponible.</Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  close: { width: 22 },
  headTitle: { flex: 1, color: C.ink, fontSize: 16, fontWeight: '700', fontFamily: F.serif },
  body: { padding: 18, paddingBottom: 60, gap: 16 },
  block: { gap: 12 },
  videoCard: { alignItems: 'center', gap: 12, padding: 26, borderRadius: 18, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, ...softShadow },
  videoLabel: { color: C.ink, fontSize: 15, fontWeight: '600', textAlign: 'center', fontFamily: F.sans },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 18, borderRadius: 13, backgroundColor: C.coral },
  ctaOff: { backgroundColor: C.faint, opacity: 0.6 },
  ctaText: { color: '#fff', fontSize: 14, fontWeight: '700', fontFamily: F.sans },
  pressed: { opacity: 0.8 },
  slide: { gap: 7, padding: 16, borderRadius: 16, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
  slideTitle: { color: C.ink, fontSize: 18, fontWeight: '600', fontFamily: F.serif },
  slideBody: { color: C.muted, fontSize: 14.5, lineHeight: 22, fontFamily: F.sans },
  quizQ: { gap: 8, padding: 16, borderRadius: 16, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
  quizQTitle: { color: C.ink, fontSize: 15, fontWeight: '700', fontFamily: F.sans },
  opt: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2 },
  optPicked: { borderColor: C.coral, backgroundColor: C.coralTint },
  optCorrect: { borderColor: '#3f9f6b', backgroundColor: '#3f9f6b' },
  optWrong: { borderColor: C.coral, backgroundColor: C.coral },
  optText: { color: C.ink, fontSize: 13.5, fontFamily: F.sans },
  quizScore: { color: C.coral, fontSize: 16, fontWeight: '800', textAlign: 'center', paddingVertical: 8, fontFamily: F.sans },
  mmRoot: { color: C.ink, fontSize: 20, fontWeight: '600', textAlign: 'center', paddingVertical: 8, fontFamily: F.serif },
  branch: { gap: 5, padding: 14, borderRadius: 14, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
  branchLabel: { color: C.ink, fontSize: 14.5, fontWeight: '700', fontFamily: F.sans },
  branchSummary: { color: C.muted, fontSize: 13, lineHeight: 19, fontFamily: F.sans },
  branchKeys: { color: C.faint, fontSize: 12.5, lineHeight: 19, fontFamily: F.sans },
  empty: { color: C.muted, fontSize: 14, textAlign: 'center', paddingVertical: 40, fontFamily: F.sans },
});
