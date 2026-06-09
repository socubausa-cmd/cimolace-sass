import { StyleSheet, Text, View } from 'react-native';

import { LiriColors as C, LiriFonts as F } from '@/constants/liri-theme';

import type { ActiveSide, DebateParticipantRow } from './data';

const SIDE_A = '#d97757'; // coral — camp A
const SIDE_B = '#5b7a52'; // emeraude — camp B

function teamLabel(side: 'A' | 'B', members: DebateParticipantRow[]): string {
  const named = members.map((m) => (m.display_name ?? '').trim()).filter(Boolean);
  if (named.length) return named.join(' · ');
  return side === 'A' ? 'Camp A' : 'Camp B';
}

/** Une colonne d'équipe (couleur, libellé, score, indicateur « à la parole »). */
function TeamCol({
  side,
  members,
  score,
  active,
}: {
  side: 'A' | 'B';
  members: DebateParticipantRow[];
  score: number;
  active: boolean;
}) {
  const tint = side === 'A' ? SIDE_A : SIDE_B;
  return (
    <View style={[styles.col, active && { borderColor: tint }]}>
      <View style={styles.colHead}>
        <View style={[styles.dot, { backgroundColor: tint }]} />
        <Text style={[styles.sideTag, { color: tint }]}>{side}</Text>
        {active && <Text style={styles.speaking}>· parole</Text>}
      </View>
      <Text style={styles.team} numberOfLines={1}>
        {teamLabel(side, members)}
      </Text>
      <Text style={[styles.score, { color: tint }]}>{score}</Text>
    </View>
  );
}

/**
 * Bandeau des deux équipes A / B avec scores cumulés et mise en avant du camp
 * actuellement « à la parole » (debates.arena_active_side).
 */
export function TeamBanner({
  teamA,
  teamB,
  scoreA,
  scoreB,
  activeSide,
}: {
  teamA: DebateParticipantRow[];
  teamB: DebateParticipantRow[];
  scoreA: number;
  scoreB: number;
  activeSide: ActiveSide;
}) {
  return (
    <View style={styles.row}>
      <TeamCol side="A" members={teamA} score={scoreA} active={activeSide === 'A'} />
      <View style={styles.vs}>
        <Text style={styles.vsTxt}>VS</Text>
      </View>
      <TeamCol side="B" members={teamB} score={scoreB} active={activeSide === 'B'} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  col: {
    flex: 1,
    backgroundColor: C.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 4,
  },
  colHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sideTag: { fontSize: 12, fontWeight: '900', fontFamily: F.sans, letterSpacing: 0.5 },
  speaking: { color: C.muted, fontSize: 11, fontWeight: '600', fontFamily: F.sans },
  team: { color: C.ink, fontSize: 13.5, fontWeight: '600', fontFamily: F.sans },
  score: { fontSize: 26, fontWeight: '800', fontFamily: F.serif, fontVariant: ['tabular-nums'] },
  vs: { alignSelf: 'center', paddingHorizontal: 2 },
  vsTxt: { color: C.faint, fontSize: 12, fontWeight: '800', fontFamily: F.sans, letterSpacing: 1 },
});
