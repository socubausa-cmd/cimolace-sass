import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LiriFonts as F, type LiriPalette } from '@/constants/liri-theme';
import { useTheme } from '@/lib/theme';

/** Secondes restantes avant `deadline` (ISO), borné à 0. */
function remainingSeconds(deadline: string | null): number | null {
  if (!deadline) return null;
  const end = new Date(deadline).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.round((end - Date.now()) / 1000));
}

function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Chrono de tour piloté par `debates.arena_turn_deadline`.
 * Décompte local rafraîchi chaque seconde ; aucune fausse valeur si pas de deadline.
 */
export function TurnTimer({ deadline }: { deadline: string | null }) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [secs, setSecs] = useState<number | null>(() => remainingSeconds(deadline));

  useEffect(() => {
    setSecs(remainingSeconds(deadline));
    if (!deadline) return;
    const id = setInterval(() => setSecs(remainingSeconds(deadline)), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (secs == null) {
    return (
      <View style={styles.wrap}>
        <Feather name="clock" size={13} color={C.faint} />
        <Text style={styles.idle}>Tour libre</Text>
      </View>
    );
  }

  const urgent = secs <= 10;
  const over = secs === 0;
  return (
    <View style={[styles.wrap, urgent && styles.wrapUrgent]}>
      <Feather name="clock" size={13} color={over ? C.live : urgent ? C.liveSoft : C.coral} />
      <Text style={[styles.time, urgent && styles.timeUrgent]}>
        {over ? "Temps écoulé" : fmt(secs)}
      </Text>
    </View>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: C.panelTint,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  wrapUrgent: { borderColor: C.liveBorder, backgroundColor: C.liveTint },
  idle: { color: C.faint, fontSize: 12.5, fontWeight: '600', fontFamily: F.sans },
  time: {
    color: C.coral,
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    fontFamily: F.sans,
  },
  timeUrgent: { color: C.liveSoft },
});
