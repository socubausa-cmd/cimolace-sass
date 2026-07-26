import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemeToggle } from '@/components/theme-toggle';
import { LiriFonts as F, softShadow, type LiriPalette } from '@/constants/liri-theme';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

type IconName = React.ComponentProps<typeof Feather>['name'];

export default function ReglagesScreen() {
  const router = useRouter();
  const { email, signOut } = useAuth();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const initials = (email ?? 'IS').slice(0, 2).toUpperCase();

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScrollView style={styles.flex1} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.h1}>Paramètres</Text>

          {/* Compte */}
          <View style={styles.card}>
            <View style={styles.avatar}><Text style={styles.avatarTxt}>{initials}</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.name} numberOfLines={1}>{email ?? 'Mon compte'}</Text>
              <Text style={styles.sub}>Espace Isna · LIRI v2.0</Text>
            </View>
          </View>

          {/* Apparence — bascule de teinte crème ⇄ sombre */}
          <Text style={styles.sectionTitle}>Apparence</Text>
          <ThemeToggle />

          {/* Compte — uniquement les entrées qui mènent quelque part en natif.
              « Branding » et « Équipe » n'existent que dans le back-office web :
              les afficher ici donnait quatre chevrons dont aucun ne réagissait. */}
          <Text style={styles.sectionTitle}>Compte</Text>
          {([
            { icon: 'user', label: 'Profil', to: '/profil' },
            { icon: 'credit-card', label: 'Forfaits et facturation', to: '/commerce' },
          ] as { icon: IconName; label: string; to: string }[]).map((row) => (
            <Pressable
              key={row.label}
              accessibilityRole="button"
              onPress={() => router.push(row.to as never)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowIcon}><Feather name={row.icon} size={16} color={C.muted} /></View>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Feather name="chevron-right" size={18} color={C.faint} />
            </Pressable>
          ))}

          <Pressable style={({ pressed }) => [styles.signout, pressed && styles.pressed]} onPress={signOut}>
            <Feather name="log-out" size={17} color={C.live} />
            <Text style={styles.signoutTxt}>Se déconnecter</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  safe: { flex: 1 },
  flex1: { flex: 1 },
  pressed: { opacity: 0.7 },
  scroll: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 36 },
  h1: { color: C.ink, fontSize: 30, fontWeight: '500', marginBottom: 18, fontFamily: F.serif },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, borderRadius: 20,
    backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, marginBottom: 8, ...softShadow,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: F.sans },
  name: { color: C.ink, fontSize: 16, fontWeight: '600', fontFamily: F.sans },
  sub: { color: C.faint, fontSize: 12.5, marginTop: 2, fontFamily: F.sans },

  sectionTitle: {
    color: C.faint, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase',
    marginTop: 22, marginBottom: 10, fontFamily: F.sans,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 15, height: 54, borderRadius: 15,
    backgroundColor: C.panelTint, borderWidth: 1, borderColor: C.line, marginBottom: 9,
  },
  rowIcon: { width: 30, alignItems: 'center' },
  rowLabel: { flex: 1, color: C.ink, fontSize: 14.5, fontFamily: F.sans },


  signout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, height: 54, borderRadius: 15,
    backgroundColor: 'rgba(226,85,63,0.10)', borderWidth: 1, borderColor: 'rgba(226,85,63,0.28)', marginTop: 16,
  },
  signoutTxt: { color: C.liveSoft, fontSize: 15, fontWeight: '600', fontFamily: F.sans },
});
