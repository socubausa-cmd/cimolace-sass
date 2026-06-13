import { StyleSheet, Text, View } from 'react-native';

import { LiriColors as C, LiriFonts as F } from '@/constants/liri-theme';

/** Libellé + couleur d'un statut de projet liri_projects. */
function describe(status?: string): { label: string; color: string; tint: string } {
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
  const s = describe(status);
  return (
    <View style={[styles.badge, { backgroundColor: s.tint }]}>
      <View style={[styles.dot, { backgroundColor: s.color }]} />
      <Text style={[styles.label, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
