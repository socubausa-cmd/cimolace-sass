import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
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

import { LiriFonts as F, softShadow, type LiriPalette } from '@/constants/liri-theme';
import { createForumTopic } from '@/lib/liri-api';
import { useTheme } from '@/lib/theme';

const CATS = [
  { key: 'general', label: 'Général' },
  { key: 'questions', label: 'Questions' },
  { key: 'entraide', label: 'Entraide' },
  { key: 'annonces', label: 'Annonces' },
];

/** Crée une discussion sur le forum (POST /forum/topics) — même base que le web. */
export default function CreerDiscussionScreen() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [cat, setCat] = useState('general');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim().length >= 4 && content.trim().length >= 5 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const res = await createForumTopic({ title: title.trim(), content: content.trim(), category: cat });
    setBusy(false);
    if (res?.id) {
      router.back();
    } else {
      setError("Publication impossible. Vérifie que tu es connecté et membre de l'école.");
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
            <Text style={styles.h1}>Nouvelle discussion</Text>
          </View>

          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Titre</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Le sujet de ta discussion"
              placeholderTextColor={C.faint}
            />

            <Text style={styles.label}>Message</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={content}
              onChangeText={setContent}
              placeholder="Développe ta question ou ton idée…"
              placeholderTextColor={C.faint}
              multiline
            />

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

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable onPress={submit} disabled={!canSubmit} style={[styles.cta, !canSubmit && styles.ctaOff]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaTxt}>Publier la discussion</Text>}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  safe: { flex: 1 },
  flex1: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6 },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  h1: { color: C.ink, fontSize: 22, fontWeight: '600', fontFamily: F.serif },
  scroll: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 40 },

  label: { color: C.muted, fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 8, fontFamily: F.sans },
  input: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: C.ink, fontSize: 15, fontFamily: F.sans },
  textarea: { minHeight: 120, textAlignVertical: 'top' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
  chipActive: { backgroundColor: 'rgba(217,119,87,0.9)', borderColor: 'transparent' },
  chipTxt: { color: C.muted, fontSize: 12.5, fontWeight: '600', fontFamily: F.sans },
  chipTxtActive: { color: '#fff' },

  error: { color: C.liveSoft, fontSize: 13, marginTop: 14, fontFamily: F.sans },
  cta: { marginTop: 22, height: 52, borderRadius: 16, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center', ...softShadow },
  ctaOff: { opacity: 0.4 },
  ctaTxt: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: F.sans },
});
