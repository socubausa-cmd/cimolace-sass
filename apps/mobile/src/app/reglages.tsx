import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriColors as C, LiriFonts as F, softShadow } from '@/constants/liri-theme';
import { useAuth } from '@/lib/auth';

export default function ReglagesScreen() {
  const { email, signOut } = useAuth();
  const initials = (email ?? 'IS').slice(0, 2).toUpperCase();

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <Text style={styles.h1}>Réglages</Text>

        <View style={styles.card}>
          <View style={styles.avatar}><Text style={styles.avatarTxt}>{initials}</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name} numberOfLines={1}>{email ?? 'Mon compte'}</Text>
            <Text style={styles.sub}>Espace Isna · LIRI v2.0</Text>
          </View>
        </View>

        {[
          { icon: 'user' as const, label: 'Profil' },
          { icon: 'bell' as const, label: 'Notifications' },
          { icon: 'shield' as const, label: 'Confidentialité' },
        ].map((row) => (
          <Pressable key={row.label} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <View style={styles.rowIcon}><Feather name={row.icon} size={16} color={C.muted} /></View>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Feather name="chevron-right" size={18} color={C.faint} />
          </Pressable>
        ))}

        <Pressable style={({ pressed }) => [styles.signout, pressed && styles.pressed]} onPress={signOut}>
          <Feather name="log-out" size={17} color={C.live} />
          <Text style={styles.signoutTxt}>Se déconnecter</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  safe: { flex: 1, paddingHorizontal: 18 },
  pressed: { opacity: 0.7 },
  h1: { color: C.ink, fontSize: 30, fontWeight: '500', marginTop: 14, marginBottom: 18, fontFamily: F.serif },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, borderRadius: 20,
    backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, marginBottom: 18, ...softShadow,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: F.sans },
  name: { color: C.ink, fontSize: 16, fontWeight: '600', fontFamily: F.sans },
  sub: { color: C.faint, fontSize: 12.5, marginTop: 2, fontFamily: F.sans },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 15, height: 54, borderRadius: 15,
    backgroundColor: C.panelTint, borderWidth: 1, borderColor: C.line, marginBottom: 9,
  },
  rowIcon: { width: 30, alignItems: 'center' },
  rowLabel: { flex: 1, color: C.ink, fontSize: 14.5, fontFamily: F.sans },

  signout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, height: 54, borderRadius: 15,
    backgroundColor: 'rgba(226,85,63,0.10)', borderWidth: 1, borderColor: 'rgba(226,85,63,0.28)', marginTop: 10,
  },
  signoutTxt: { color: C.liveSoft, fontSize: 15, fontWeight: '600', fontFamily: F.sans },
});
