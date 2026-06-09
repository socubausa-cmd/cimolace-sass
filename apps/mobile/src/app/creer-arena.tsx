import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriColors as C, LiriFonts as F, softShadow } from '@/constants/liri-theme';
import { createLive, startLive } from '@/lib/liri-api';

/**
 * Arena — Débat : une session live structurée en débat (2 équipes).
 * Techniquement = un live LIRI dont le titre porte le sujet du débat,
 * puis on ouvre la salle immersive (LiveKit) en mode hôte.
 */
export default function CreerArenaScreen() {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [teamA, setTeamA] = useState('Pour');
  const [teamB, setTeamB] = useState('Contre');
  const [busy, setBusy] = useState(false);

  const canSubmit = subject.trim().length >= 5 && !busy;

  const launch = async () => {
    if (!canSubmit) return;
    setBusy(true);
    const title = `Arena · ${subject.trim()}`;
    const created = await createLive({ title });
    if (!created?.id) {
      setBusy(false);
      Alert.alert('Arena', "Impossible de créer le débat. Vérifie ta connexion.");
      return;
    }
    await startLive(created.id);
    setBusy(false);
    router.push({
      pathname: '/live-room',
      params: { id: created.id, role: 'host', title, mode: 'arena' },
    });
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
              <Feather name="chevron-left" size={22} color={C.ink} />
            </Pressable>
            <Text style={styles.h1}>Arena — Débat</Text>
          </View>

          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.intro}>
              <View style={styles.introIcon}><Feather name="flag" size={18} color={C.coral} /></View>
              <Text style={styles.introTxt}>
                Lance un débat structuré en direct : deux équipes s&apos;affrontent sur un sujet,
                les participants votent. La salle immersive s&apos;ouvre dès le lancement.
              </Text>
            </View>

            <Text style={styles.label}>Sujet du débat</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="Ex. La tradition doit-elle évoluer avec la science ?"
              placeholderTextColor={C.faint}
            />

            <View style={styles.teams}>
              <View style={styles.teamCol}>
                <Text style={styles.teamLabel}>Équipe A</Text>
                <TextInput style={[styles.input, styles.teamInput]} value={teamA} onChangeText={setTeamA} placeholderTextColor={C.faint} />
              </View>
              <View style={styles.vs}><Text style={styles.vsTxt}>VS</Text></View>
              <View style={styles.teamCol}>
                <Text style={styles.teamLabel}>Équipe B</Text>
                <TextInput style={[styles.input, styles.teamInput]} value={teamB} onChangeText={setTeamB} placeholderTextColor={C.faint} />
              </View>
            </View>

            <View style={styles.note}>
              <Feather name="info" size={13} color={C.faint} />
              <Text style={styles.noteTxt}>
                La salle vidéo (LiveKit) nécessite l&apos;app installée (build), pas Expo Go.
              </Text>
            </View>

            <Pressable onPress={launch} disabled={!canSubmit} style={[styles.cta, !canSubmit && styles.ctaOff]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaTxt}>🏆 Lancer le débat en direct</Text>}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  safe: { flex: 1 },
  flex1: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6 },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  h1: { color: C.ink, fontSize: 22, fontWeight: '600', fontFamily: F.serif },
  scroll: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 40 },

  intro: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', padding: 14, borderRadius: 16, backgroundColor: C.coralTint, marginBottom: 6 },
  introIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(217,119,87,0.16)', alignItems: 'center', justifyContent: 'center' },
  introTxt: { flex: 1, color: C.muted, fontSize: 12.5, lineHeight: 18, fontFamily: F.sans },

  label: { color: C.muted, fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 8, fontFamily: F.sans },
  input: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: C.ink, fontSize: 15, fontFamily: F.sans },

  teams: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 16 },
  teamCol: { flex: 1 },
  teamLabel: { color: C.muted, fontSize: 12, fontWeight: '600', marginBottom: 6, fontFamily: F.sans },
  teamInput: { paddingVertical: 11, textAlign: 'center' },
  vs: { paddingBottom: 12 },
  vsTxt: { color: C.coral, fontSize: 13, fontWeight: '800', fontFamily: F.sans },

  note: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, paddingHorizontal: 4 },
  noteTxt: { flex: 1, color: C.faint, fontSize: 11.5, lineHeight: 16, fontFamily: F.sans },

  cta: { marginTop: 18, height: 52, borderRadius: 16, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center', ...softShadow },
  ctaOff: { opacity: 0.4 },
  ctaTxt: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: F.sans },
});
