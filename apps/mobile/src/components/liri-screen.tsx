import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriColors as C, LiriFonts as F, softShadow } from '@/constants/liri-theme';

/** Écran d'onglet thématisé (placeholder V1 — sera remplacé par l'écran réel). */
export function LiriScreen({
  icon,
  title,
  subtitle,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.center}>
        <View style={styles.badge}>
          <Feather name={icon} size={30} color={C.coral} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{subtitle}</Text>
        <View style={styles.soon}>
          <Text style={styles.soonTxt}>Bientôt disponible</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  badge: {
    width: 72, height: 72, borderRadius: 24, backgroundColor: C.panel,
    borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', ...softShadow,
  },
  title: { color: C.ink, fontSize: 26, fontWeight: '500', marginTop: 20, fontFamily: F.serif },
  sub: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8, fontFamily: F.sans },
  soon: {
    marginTop: 18, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: C.coralTint, borderWidth: 1, borderColor: 'rgba(217,119,87,0.25)',
  },
  soonTxt: { color: C.coral, fontSize: 12, fontWeight: '600', fontFamily: F.sans },
});
