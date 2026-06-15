import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { LiriFonts as F, type LiriPalette } from '@/constants/liri-theme';
import { useTheme } from '@/lib/theme';

import type { VoteChoice } from './data';

const SIDE_A = '#d97757';
const SIDE_B = '#5b7a52';

/**
 * Barre de vote A / B / Égalité. Visible quand le round courant est en phase
 * « voting ». Au tap : insertion dans live_session_signals (via le parent).
 * Verrouille le choix une fois émis (un viewer = un vote par round affiché).
 */
export function VoteBar({
  round,
  myVote,
  onVote,
}: {
  round: number;
  myVote: VoteChoice | null;
  onVote: (choice: VoteChoice) => Promise<boolean>;
}) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [pending, setPending] = useState<VoteChoice | null>(null);

  const handle = async (choice: VoteChoice) => {
    if (myVote || pending) return;
    setPending(choice);
    await onVote(choice);
    setPending(null);
  };

  const opts: { choice: VoteChoice; label: string; tint: string }[] = [
    { choice: 'A', label: 'Camp A', tint: SIDE_A },
    { choice: 'tie', label: 'Égalité', tint: C.muted },
    { choice: 'B', label: 'Camp B', tint: SIDE_B },
  ];

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>
        {myVote ? `Vote enregistré · round ${round}` : `Votez le round ${round}`}
      </Text>
      <View style={styles.row}>
        {opts.map(({ choice, label, tint }) => {
          const selected = myVote === choice;
          const busy = pending === choice;
          const locked = myVote != null && !selected;
          return (
            <Pressable
              key={choice}
              onPress={() => handle(choice)}
              disabled={myVote != null || pending != null}
              style={({ pressed }) => [
                styles.btn,
                { borderColor: selected ? tint : C.line },
                selected && { backgroundColor: `${tint}22` },
                locked && styles.btnLocked,
                pressed && styles.pressed,
              ]}
            >
              {busy ? (
                <ActivityIndicator size="small" color={tint} />
              ) : (
                <>
                  {selected && <Feather name="check" size={14} color={tint} />}
                  <Text style={[styles.btnTxt, { color: selected ? tint : C.ink }]}>{label}</Text>
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  wrap: {
    backgroundColor: C.panel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
    padding: 12,
    gap: 10,
  },
  kicker: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: F.sans,
    textAlign: 'center',
  },
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: C.base,
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 12,
  },
  btnLocked: { opacity: 0.4 },
  btnTxt: { fontSize: 13.5, fontWeight: '700', fontFamily: F.sans },
  pressed: { opacity: 0.7 },
});
