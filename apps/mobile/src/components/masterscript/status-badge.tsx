import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LiriFonts as F, type LiriPalette } from '@/constants/liri-theme';
import { useTheme } from '@/lib/theme';

/** Libellé + couleur d'un statut de projet liri_projects. */
function describe(status: string | undefined, C: LiriPalette): { label: string; color: string; tint: string } {
  switch ((status ?? '').toLowerCase()) {
    case 'complete':
    case 'ready':
      return { label: 'Prêt', color: C.emeraldB, tint: 'rgba(109,143,96,0.16)' };
    case 'running':
    case 'analyzing':
      return { label: 'En cours', color: C.coral, tint: C.coralTint };
    case 'error':
    case 'failed':
      return { label: 'Erreur', color: C.live, tint: C.liveTint };
    case 'draft':
    default:
      return { label: status ? status : 'Brouillon', color: C.faint, tint: 'rgba(130,128,122,0.14)' };
  }
}

/** Pastille de statut compacte (liste des projets). */
export function StatusBadge({ status }: { status?: string }) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const s = describe(status, C);
  return (
    <View style={[styles.badge, { backgroundColor: s.tint }]}>
      <View style={[styles.dot, { backgroundColor: s.color }]} />
      <Text style={[styles.label, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontFamily: F.sans, fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
});
