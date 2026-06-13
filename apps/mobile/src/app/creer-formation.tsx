import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
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

import { LiriColors as C, LiriFonts as F, softShadow } from '@/constants/liri-theme';
import {
  fetchCourses,
  publishCurriculum,
  type Course,
  type DraftLesson,
  type DraftModule,
} from '@/lib/liri-api';

const CATS = [
  { key: 'general', label: 'Général' },
  { key: 'sciences', label: 'Sciences' },
  { key: 'pratique', label: 'Pratique' },
  { key: 'initiation', label: 'Initiation' },
];

const LESSON_KINDS: { key: DraftLesson['kind']; label: string; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
  { key: 'video', label: 'Vidéo', icon: 'video' },
  { key: 'text', label: 'Texte', icon: 'file-text' },
  { key: 'quiz', label: 'Quiz', icon: 'help-circle' },
];

const newLesson = (kind: DraftLesson['kind'] = 'video'): DraftLesson => ({ title: '', kind, content: '', videoUrl: '' });
const newModule = (): DraftModule => ({ title: '', lessons: [newLesson()] });

export default function CreerFormationScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('general');
  const [price, setPrice] = useState('');
  const [modules, setModules] = useState<DraftModule[]>([newModule()]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [created, setCreated] = useState<{ course: Course; modules: number; lessons: number } | null>(null);
  const [recent, setRecent] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);

  const lessonCount = modules.reduce((n, m) => n + m.lessons.filter((l) => l.title.trim()).length, 0);
  const canSubmit = title.trim().length >= 3 && !busy;

  // — mutations curriculum —
  const updateModule = (mi: number, patch: Partial<DraftModule>) =>
    setModules((ms) => ms.map((m, i) => (i === mi ? { ...m, ...patch } : m)));
  const addModule = () => setModules((ms) => [...ms, newModule()]);
  const removeModule = (mi: number) => setModules((ms) => (ms.length > 1 ? ms.filter((_, i) => i !== mi) : ms));
  const moveModule = (mi: number, dir: -1 | 1) =>
    setModules((ms) => {
      const j = mi + dir;
      if (j < 0 || j >= ms.length) return ms;
      const copy = [...ms];
      [copy[mi], copy[j]] = [copy[j], copy[mi]];
      return copy;
    });

  const updateLesson = (mi: number, li: number, patch: Partial<DraftLesson>) =>
    setModules((ms) => ms.map((m, i) => (i === mi ? { ...m, lessons: m.lessons.map((l, k) => (k === li ? { ...l, ...patch } : l)) } : m)));
  const addLesson = (mi: number) => setModules((ms) => ms.map((m, i) => (i === mi ? { ...m, lessons: [...m.lessons, newLesson()] } : m)));
  const removeLesson = (mi: number, li: number) =>
    setModules((ms) => ms.map((m, i) => (i === mi ? { ...m, lessons: m.lessons.filter((_, k) => k !== li) } : m)));

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setProgress('');
    const priceCents = price.trim() ? parseInt(price.replace(/[^\d]/g, ''), 10) * 100 : undefined;
    const res = await publishCurriculum({
      title: title.trim(),
      description: desc.trim(),
      category: cat,
      priceCents,
      modules,
      onProgress: setProgress,
    });
    setBusy(false);
    setProgress('');
    if (res?.course?.id) {
      setCreated(res);
      setTitle('');
      setDesc('');
      setPrice('');
      setModules([newModule()]);
      const list = await fetchCourses();
      setRecent(list.slice(0, 5));
    } else {
      setError("Création impossible. Vérifie que tu as les droits (enseignant) et ta connexion.");
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
              <Feather name="chevron-left" size={22} color={C.ink} />
            </Pressable>
            <Text style={styles.h1}>Nouvelle formation</Text>
          </View>

          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {created ? (
              <View style={styles.successCard}>
                <View style={styles.successIcon}><Feather name="check" size={20} color="#fff" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.successTitle}>Formation publiée ✓</Text>
                  <Text style={styles.successSub}>
                    « {created.course.title} » · {created.modules} chapitre(s), {created.lessons} leçon(s).
                  </Text>
                </View>
              </View>
            ) : null}

            <Text style={styles.label}>Titre de la formation</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ex. Les fondements de la science nocturne" placeholderTextColor={C.faint} />

            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, styles.textarea]} value={desc} onChangeText={setDesc} placeholder="Ce que l'apprenant va découvrir…" placeholderTextColor={C.faint} multiline />

            <Text style={styles.label}>Catégorie</Text>
            <View style={styles.chips}>
              {CATS.map((c) => {
                const active = c.key === cat;
                return (
                  <Pressable key={c.key} onPress={() => setCat(c.key)} style={[styles.chip, active && styles.chipActive]}>
                    <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Prix (FCFA · 0 = gratuit)</Text>
            <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="0" placeholderTextColor={C.faint} keyboardType="number-pad" />

            {/* ─── Programme ─── */}
            <View style={styles.programHead}>
              <Text style={styles.programTitle}>Programme</Text>
              <Text style={styles.programCount}>{modules.length} chap. · {lessonCount} leçon(s)</Text>
            </View>

            {modules.map((m, mi) => (
              <View key={mi} style={styles.module}>
                <View style={styles.moduleHead}>
                  <View style={styles.moduleNum}><Text style={styles.moduleNumTxt}>{mi + 1}</Text></View>
                  <TextInput
                    style={styles.moduleTitle}
                    value={m.title}
                    onChangeText={(t) => updateModule(mi, { title: t })}
                    placeholder={`Chapitre ${mi + 1}`}
                    placeholderTextColor={C.faint}
                  />
                  <Pressable onPress={() => moveModule(mi, -1)} hitSlop={6} style={styles.iconBtn}><Feather name="chevron-up" size={16} color={C.muted} /></Pressable>
                  <Pressable onPress={() => moveModule(mi, 1)} hitSlop={6} style={styles.iconBtn}><Feather name="chevron-down" size={16} color={C.muted} /></Pressable>
                  <Pressable onPress={() => removeModule(mi)} hitSlop={6} style={styles.iconBtn}><Feather name="trash-2" size={15} color={C.liveSoft} /></Pressable>
                </View>

                {m.lessons.map((l, li) => (
                  <View key={li} style={styles.lesson}>
                    <View style={styles.lessonTop}>
                      <View style={styles.kinds}>
                        {LESSON_KINDS.map((k) => {
                          const on = k.key === l.kind;
                          return (
                            <Pressable key={k.key} onPress={() => updateLesson(mi, li, { kind: k.key })} style={[styles.kind, on && styles.kindOn]}>
                              <Feather name={k.icon} size={12} color={on ? '#fff' : C.muted} />
                              <Text style={[styles.kindTxt, on && styles.kindTxtOn]}>{k.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <Pressable onPress={() => removeLesson(mi, li)} hitSlop={6} style={styles.iconBtn}><Feather name="x" size={15} color={C.faint} /></Pressable>
                    </View>
                    <TextInput
                      style={styles.lessonTitle}
                      value={l.title}
                      onChangeText={(t) => updateLesson(mi, li, { title: t })}
                      placeholder={l.kind === 'quiz' ? 'Titre du quiz' : 'Titre de la leçon'}
                      placeholderTextColor={C.faint}
                    />
                    {l.kind === 'video' && (
                      <TextInput style={styles.lessonMeta} value={l.videoUrl} onChangeText={(t) => updateLesson(mi, li, { videoUrl: t })} placeholder="URL de la vidéo (optionnel)" placeholderTextColor={C.faint} autoCapitalize="none" />
                    )}
                    {l.kind === 'text' && (
                      <TextInput style={[styles.lessonMeta, { minHeight: 56, textAlignVertical: 'top' }]} value={l.content} onChangeText={(t) => updateLesson(mi, li, { content: t })} placeholder="Contenu de la leçon…" placeholderTextColor={C.faint} multiline />
                    )}
                    {l.kind === 'quiz' && (
                      <TextInput style={[styles.lessonMeta, { minHeight: 56, textAlignVertical: 'top' }]} value={l.content} onChangeText={(t) => updateLesson(mi, li, { content: t })} placeholder={'Question 1 ? a) … b) … (réponse: a)'} placeholderTextColor={C.faint} multiline />
                    )}
                  </View>
                ))}

                <Pressable onPress={() => addLesson(mi)} style={styles.addLesson}>
                  <Feather name="plus" size={14} color={C.coral} />
                  <Text style={styles.addLessonTxt}>Ajouter une leçon</Text>
                </Pressable>
              </View>
            ))}

            <Pressable onPress={addModule} style={styles.addModule}>
              <Feather name="plus-circle" size={16} color={C.coral} />
              <Text style={styles.addModuleTxt}>Ajouter un chapitre</Text>
            </Pressable>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable onPress={submit} disabled={!canSubmit} style={[styles.cta, !canSubmit && styles.ctaOff]}>
              {busy ? (
                <View style={styles.ctaBusy}>
                  <ActivityIndicator color="#fff" />
                  {!!progress && <Text style={styles.ctaProgress}>{progress}</Text>}
                </View>
              ) : (
                <Text style={styles.ctaTxt}>Publier la formation</Text>
              )}
            </Pressable>

            {recent.length > 0 ? (
              <>
                <Text style={[styles.label, { marginTop: 24 }]}>Mes formations récentes</Text>
                {recent.map((c) => (
                  <View key={c.id} style={styles.recentRow}>
                    <Feather name="book-open" size={16} color={C.coral} />
                    <Text style={styles.recentTitle} numberOfLines={1}>{c.title}</Text>
                    <Text style={styles.recentBadge}>{c.status ?? 'draft'}</Text>
                  </View>
                ))}
              </>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  safe: { flex: 1 },
  flex1: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6 },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  h1: { color: C.ink, fontSize: 22, fontWeight: '600', fontFamily: F.serif },
  scroll: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 40 },

  label: { color: C.muted, fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 8, fontFamily: F.sans },
  input: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: C.ink, fontSize: 15, fontFamily: F.sans },
  textarea: { minHeight: 90, textAlignVertical: 'top' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
  chipActive: { backgroundColor: 'rgba(217,119,87,0.9)', borderColor: 'transparent' },
  chipTxt: { color: C.muted, fontSize: 12.5, fontWeight: '600', fontFamily: F.sans },
  chipTxtActive: { color: '#fff' },

  // Programme
  programHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 10 },
  programTitle: { color: C.ink, fontSize: 17, fontWeight: '800', fontFamily: F.serif },
  programCount: { color: C.faint, fontSize: 12, fontWeight: '600', fontFamily: F.sans },

  module: { backgroundColor: C.panelTint, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 12, marginBottom: 12 },
  moduleHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  moduleNum: { width: 26, height: 26, borderRadius: 8, backgroundColor: C.coralTint, alignItems: 'center', justifyContent: 'center' },
  moduleNumTxt: { color: C.coral, fontSize: 13, fontWeight: '800' },
  moduleTitle: { flex: 1, color: C.ink, fontSize: 15, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 8, fontFamily: F.sans },
  iconBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  lesson: { backgroundColor: C.panel, borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 10, marginTop: 8 },
  lessonTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kinds: { flexDirection: 'row', gap: 6 },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1, borderColor: C.line, paddingHorizontal: 9, paddingVertical: 5 },
  kindOn: { backgroundColor: C.coral, borderColor: C.coral },
  kindTxt: { color: C.muted, fontSize: 11, fontWeight: '700', fontFamily: F.sans },
  kindTxtOn: { color: '#fff' },
  lessonTitle: { color: C.ink, fontSize: 14, fontWeight: '600', paddingVertical: 8, marginTop: 4, fontFamily: F.sans },
  lessonMeta: { backgroundColor: C.base, borderRadius: 9, borderWidth: 1, borderColor: C.line, paddingHorizontal: 11, paddingVertical: 9, color: C.muted, fontSize: 13, fontFamily: F.sans },

  addLesson: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, marginTop: 8, justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: C.line, borderStyle: 'dashed' },
  addLessonTxt: { color: C.coral, fontSize: 13, fontWeight: '700', fontFamily: F.sans },
  addModule: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 13, borderRadius: 14, borderWidth: 1.5, borderColor: C.coral, borderStyle: 'dashed' },
  addModuleTxt: { color: C.coral, fontSize: 14, fontWeight: '700', fontFamily: F.sans },

  error: { color: C.liveSoft, fontSize: 13, marginTop: 14, fontFamily: F.sans },

  cta: { marginTop: 22, minHeight: 52, borderRadius: 16, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center', ...softShadow },
  ctaOff: { opacity: 0.4 },
  ctaTxt: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: F.sans },
  ctaBusy: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ctaProgress: { color: '#fff', fontSize: 13, fontWeight: '600', fontFamily: F.sans },

  successCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, marginBottom: 4, backgroundColor: 'rgba(52,211,153,0.10)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.3)' },
  successIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#34D399', alignItems: 'center', justifyContent: 'center' },
  successTitle: { color: C.ink, fontSize: 14.5, fontWeight: '700', fontFamily: F.sans },
  successSub: { color: C.muted, fontSize: 12.5, marginTop: 2, fontFamily: F.sans },

  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, marginTop: 8 },
  recentTitle: { flex: 1, color: C.ink, fontSize: 13.5, fontFamily: F.sans },
  recentBadge: { color: C.faint, fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', fontFamily: F.sans },
});
