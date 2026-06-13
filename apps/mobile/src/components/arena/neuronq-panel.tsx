import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { LiriColors as C, LiriFonts as F } from '@/constants/liri-theme';

import { neuronqText, type NeuronqQuestionRow } from './data';

function statusTint(status: string | null): string {
  if (status === 'answered') return C.emeraldB;
  if (status === 'skipped') return C.faint;
  return C.coral; // pending / autre
}

function statusLabel(status: string | null): string {
  if (status === 'answered') return 'Répondu';
  if (status === 'skipped') return 'Passé';
  return 'En attente';
}

function QuestionRow({ q }: { q: NeuronqQuestionRow }) {
  return (
    <View style={styles.qRow}>
      <View style={[styles.qDot, { backgroundColor: statusTint(q.status) }]} />
      <View style={styles.qBody}>
        <Text style={styles.qText}>{neuronqText(q)}</Text>
        <Text style={[styles.qStatus, { color: statusTint(q.status) }]}>
          {statusLabel(q.status)}
        </Text>
      </View>
    </View>
  );
}

/**
 * File NeuronQ : questions du public en temps réel (FlatList) + saisie pour
 * poser une question (insert live_neuronq_questions). États vides honnêtes.
 */
export function NeuronqPanel({
  questions,
  canAsk,
  onSubmit,
}: {
  questions: NeuronqQuestionRow[];
  canAsk: boolean;
  onSubmit: (text: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const ok = await onSubmit(text);
    setSending(false);
    if (ok) setDraft('');
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Feather name="help-circle" size={15} color={C.coral} />
        <Text style={styles.title}>NeuronQ</Text>
        <Text style={styles.count}>{questions.length}</Text>
      </View>

      <FlatList
        data={questions}
        keyExtractor={(q) => q.id}
        renderItem={({ item }) => <QuestionRow q={item} />}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Aucune question pour l&apos;instant. Soyez le premier à en poser une.
          </Text>
        }
      />

      {canAsk ? (
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Posez votre question…"
            placeholderTextColor={C.faint}
            multiline
            maxLength={400}
          />
          <Pressable
            onPress={send}
            disabled={!draft.trim() || sending}
            style={({ pressed }) => [
              styles.sendBtn,
              (!draft.trim() || sending) && styles.sendDisabled,
              pressed && styles.pressed,
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="send" size={16} color="#fff" />
            )}
          </Pressable>
        </View>
      ) : (
        <Text style={styles.locked}>
          Connectez-vous pour poser une question à l&apos;arène.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: C.panel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    gap: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { color: C.ink, fontSize: 15, fontWeight: '700', fontFamily: F.serif, flex: 1 },
  count: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: F.sans,
    backgroundColor: C.base,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  qRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', paddingVertical: 2 },
  qDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  qBody: { flex: 1, gap: 2 },
  qText: { color: C.ink, fontSize: 14, lineHeight: 20, fontFamily: F.sans },
  qStatus: { fontSize: 11, fontWeight: '700', fontFamily: F.sans },
  sep: { height: 1, backgroundColor: C.lineSoft, marginVertical: 7 },
  empty: { color: C.faint, fontSize: 13, lineHeight: 19, fontFamily: F.sans, paddingVertical: 6 },
  composer: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 2 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: C.base,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: C.ink,
    fontSize: 14,
    fontFamily: F.sans,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: C.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
  locked: { color: C.faint, fontSize: 12.5, fontFamily: F.sans, textAlign: 'center', paddingTop: 2 },
  pressed: { opacity: 0.7 },
});
