import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { generateMasterclass, type MasterclassResult } from '@/lib/liri-api';

const PHASES = [
  'Analyse du texte',
  'Découpage en blocs',
  'Structuration en chapitres',
  'Conception pédagogique',
  'Génération des slides',
  'Rédaction du script',
  'Quiz & exercices',
  'Finalisation',
];

export default function CreerMasterclassScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!busy) {
      setPhase(0);
      return;
    }
    const t = setInterval(() => setPhase((p) => Math.min(PHASES.length - 1, p + 1)), 1100);
    return () => clearInterval(t);
  }, [busy]);
  const [result, setResult] = useState<MasterclassResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim().length >= 3 && source.trim().length >= 40 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await generateMasterclass({ title: title.trim(), sourceText: source.trim() });
    setBusy(false);
    if (res && (res.modules?.length || res.title)) {
      setResult(res);
    } else {
      setError("Génération impossible. Vérifie ta connexion et que le texte source est assez riche.");
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
            <Text style={styles.h1}>Masterclass IA</Text>
          </View>

          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.intro}>
              <View style={styles.introIcon}><Feather name="zap" size={18} color={C.coral} /></View>
              <Text style={styles.introTxt}>
                Colle un texte source (cours, notes, transcript) — l&apos;IA génère une masterclass
                structurée en modules et leçons.
              </Text>
            </View>

            <Text style={styles.label}>Titre</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ex. Introduction à la divination"
              placeholderTextColor={C.faint}
            />

            <Text style={styles.label}>Texte source ({source.trim().length} car.)</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={source}
              onChangeText={setSource}
              placeholder="Colle ici le contenu à transformer en masterclass (minimum 40 caractères)…"
              placeholderTextColor={C.faint}
              multiline
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable onPress={submit} disabled={!canSubmit} style={[styles.cta, !canSubmit && styles.ctaOff]}>
              {busy ? (
                <View style={styles.row}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.ctaTxt}>  Génération en cours…</Text>
                </View>
              ) : (
                <Text style={styles.ctaTxt}>✨ Générer la masterclass</Text>
              )}
            </Pressable>

            {busy ? (
              <View style={styles.pipeline}>
                <Text style={styles.pipelineTitle}>Pipeline IA — 8 étapes</Text>
                {PHASES.map((p, i) => {
                  const done = i < phase;
                  const cur = i === phase;
                  return (
                    <View key={p} style={styles.phaseRow}>
                      <View style={[styles.phaseDot, done && styles.phaseDotDone, cur && styles.phaseDotCur]}>
                        {done ? <Feather name="check" size={11} color="#fff" /> : <Text style={styles.phaseNum}>{i + 1}</Text>}
                      </View>
                      <Text style={[styles.phaseTxt, (done || cur) && styles.phaseTxtOn]}>{p}</Text>
                      {cur ? <ActivityIndicator size="small" color={C.coral} style={{ marginLeft: 'auto' }} /> : null}
                    </View>
                  );
                })}
              </View>
            ) : null}

            {result ? (
              <View style={styles.result}>
                <Text style={styles.resultTitle}>{result.title || title}</Text>
                {result.description ? <Text style={styles.resultDesc}>{result.description}</Text> : null}
                {(result.modules ?? []).map((m, i) => (
                  <View key={i} style={styles.module}>
                    <Text style={styles.moduleTitle}>Module {i + 1} — {m.title || 'Sans titre'}</Text>
                    {(m.lessons ?? []).map((l, j) => (
                      <View key={j} style={styles.lesson}>
                        <Feather name="play-circle" size={13} color={C.faint} />
                        <Text style={styles.lessonTxt} numberOfLines={1}>{l.title || `Leçon ${j + 1}`}</Text>
                      </View>
                    ))}
                  </View>
                ))}
                <Text style={styles.resultMeta}>
                  {(result.modules ?? []).length} module(s) générés · enregistré dans la bibliothèque
                </Text>
              </View>
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
  row: { flexDirection: 'row', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6 },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  h1: { color: C.ink, fontSize: 22, fontWeight: '600', fontFamily: F.serif },
  scroll: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 40 },

  intro: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', padding: 14, borderRadius: 16, backgroundColor: C.coralTint, marginBottom: 6 },
  introIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(217,119,87,0.16)', alignItems: 'center', justifyContent: 'center' },
  introTxt: { flex: 1, color: C.muted, fontSize: 12.5, lineHeight: 18, fontFamily: F.sans },

  label: { color: C.muted, fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 8, fontFamily: F.sans },
  input: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: C.ink, fontSize: 15, fontFamily: F.sans },
  textarea: { minHeight: 140, textAlignVertical: 'top' },

  error: { color: C.liveSoft, fontSize: 13, marginTop: 14, fontFamily: F.sans },
  cta: { marginTop: 22, height: 52, borderRadius: 16, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center', ...softShadow },
  ctaOff: { opacity: 0.4 },
  ctaTxt: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: F.sans },

  pipeline: { marginTop: 20, padding: 16, borderRadius: 18, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
  pipelineTitle: { color: C.ink, fontSize: 13, fontWeight: '800', letterSpacing: 0.4, marginBottom: 12, textTransform: 'uppercase', fontFamily: F.sans },
  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  phaseDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel2 },
  phaseDotDone: { backgroundColor: '#34D399', borderColor: '#34D399' },
  phaseDotCur: { backgroundColor: C.coral, borderColor: C.coral },
  phaseNum: { color: C.faint, fontSize: 11, fontWeight: '700' },
  phaseTxt: { color: C.faint, fontSize: 13.5, fontFamily: F.sans },
  phaseTxtOn: { color: C.ink, fontWeight: '600' },

  result: { marginTop: 24, padding: 16, borderRadius: 18, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, ...softShadow },
  resultTitle: { color: C.ink, fontSize: 17, fontWeight: '700', fontFamily: F.serif },
  resultDesc: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 6, fontFamily: F.sans },
  module: { marginTop: 14 },
  moduleTitle: { color: C.coral, fontSize: 13.5, fontWeight: '700', fontFamily: F.sans },
  lesson: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingLeft: 6 },
  lessonTxt: { color: C.muted, fontSize: 13, fontFamily: F.sans, flex: 1 },
  resultMeta: { color: C.faint, fontSize: 11.5, marginTop: 14, fontFamily: F.sans },
});
