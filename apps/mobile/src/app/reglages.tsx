import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemeToggle } from '@/components/theme-toggle';
import { LiriFonts as F, softShadow, type LiriPalette } from '@/constants/liri-theme';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

type IconName = React.ComponentProps<typeof Feather>['name'];

export default function ReglagesScreen() {
  const { email, signOut } = useAuth();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const initials = (email ?? 'IS').slice(0, 2).toUpperCase();

  // Préférences « Productivité » (vue Réglages du portail web).
  const [autoRecord, setAutoRecord] = useState(true);
  const [waitingRoom, setWaitingRoom] = useState(false);

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

          {/* Compte — liens */}
          <Text style={styles.sectionTitle}>Compte</Text>
          {([
            { icon: 'user', label: 'Profil' },
            { icon: 'droplet', label: 'Branding' },
            { icon: 'credit-card', label: 'Facturation' },
            { icon: 'users', label: 'Équipe' },
          ] as { icon: IconName; label: string }[]).map((row) => (
            <Pressable key={row.label} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={styles.rowIcon}><Feather name={row.icon} size={16} color={C.muted} /></View>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Feather name="chevron-right" size={18} color={C.faint} />
            </Pressable>
          ))}

          {/* Productivité */}
          <Text style={styles.sectionTitle}>Productivité</Text>

          <SelectRow label="Type de live par défaut" hint="à la création rapide" value="Webinar" />
          <ToggleRow
            label="Enregistrement automatique"
            hint="chaque session est enregistrée"
            value={autoRecord}
            onValueChange={setAutoRecord}
          />
          <SelectRow label="Scène audio par défaut" hint="ambiance au démarrage" value="Studio calme" />
          <ToggleRow
            label="Salle d'attente"
            hint="admission manuelle des participants"
            value={waitingRoom}
            onValueChange={setWaitingRoom}
          />

          <Pressable style={({ pressed }) => [styles.signout, pressed && styles.pressed]} onPress={signOut}>
            <Feather name="log-out" size={17} color={C.live} />
            <Text style={styles.signoutTxt}>Se déconnecter</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onValueChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={styles.prefRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.prefLabel}>{label}</Text>
        <Text style={styles.prefHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: 'rgba(255,255,255,0.15)', true: C.coral }}
        thumbColor="#fff"
        ios_backgroundColor="rgba(255,255,255,0.15)"
      />
    </View>
  );
}

function SelectRow({ label, hint, value }: { label: string; hint: string; value: string }) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <Pressable style={({ pressed }) => [styles.prefRow, pressed && styles.pressed]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.prefLabel}>{label}</Text>
        <Text style={styles.prefHint}>{hint}</Text>
      </View>
      <View style={styles.selectChip}>
        <Text style={styles.selectTxt}>{value}</Text>
        <Feather name="chevron-down" size={14} color={C.muted} />
      </View>
    </Pressable>
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

  prefRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, paddingVertical: 13, borderRadius: 15,
    backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, marginBottom: 9,
  },
  prefLabel: { color: C.ink, fontSize: 14, fontWeight: '500', fontFamily: F.sans },
  prefHint: { color: C.faint, fontSize: 12, marginTop: 2, fontFamily: F.sans },
  selectChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 10,
    backgroundColor: C.base, borderWidth: 1, borderColor: C.line,
  },
  selectTxt: { color: C.muted, fontSize: 12.5, fontFamily: F.sans },

  signout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, height: 54, borderRadius: 15,
    backgroundColor: 'rgba(226,85,63,0.10)', borderWidth: 1, borderColor: 'rgba(226,85,63,0.28)', marginTop: 16,
  },
  signoutTxt: { color: C.liveSoft, fontSize: 15, fontWeight: '600', fontFamily: F.sans },
});
