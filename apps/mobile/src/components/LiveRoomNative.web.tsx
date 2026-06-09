import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EleveLiveShell from '@/components/live-room/eleve-live-shell';
import { LiriColors as C, LiriFonts as F } from '@/constants/liri-theme';

/**
 * Variante WEB de la salle live. LiveKit (WebRTC natif) n'est PAS importé ici —
 * Metro choisit ce `.web.tsx` pour le bundle web/Expo Go.
 *
 * Rôle élève → coque immersive `EleveLiveShell` (smartboard sans fond + zone
 * caméra prof en placeholder), pour prévisualiser la parité hôte↔élève. La vraie
 * vidéo LiveKit vit dans LiveRoomNative.tsx (build natif).
 */
export default function LiveRoomWeb() {
  const router = useRouter();
  const params = useLocalSearchParams<{ title?: string; role?: string }>();
  const title = typeof params.title === 'string' && params.title ? params.title : 'Session live';
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/lives'));

  if (params.role === 'student') {
    // Web : chat en mode local (pas de data channel) — EleveLiveShell gère le repli.
    return <EleveLiveShell title={title} onLeave={goBack} />;
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.card}>
          <View style={styles.icon}><Feather name="video" size={28} color={C.coral} /></View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.badge}>Salle live · hôte</Text>
          <Text style={styles.note}>
            La vidéo en direct (LiveKit) nécessite l&apos;application installée sur ton
            téléphone (build), pas la prévisualisation web ni Expo Go.
          </Text>
          <Pressable style={({ pressed }) => [styles.btn, pressed && styles.pressed]} onPress={goBack}>
            <Text style={styles.btnTxt}>Retour</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  safe: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: {
    width: '100%', maxWidth: 360, alignItems: 'center', gap: 10, padding: 26, borderRadius: 22,
    backgroundColor: C.panel, borderWidth: 1, borderColor: C.line,
  },
  icon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: C.coralTint, marginBottom: 4 },
  title: { color: C.ink, fontSize: 18, fontWeight: '700', fontFamily: F.serif, textAlign: 'center' },
  badge: { color: C.coral, fontSize: 12, fontWeight: '700', fontFamily: F.sans },
  note: { color: C.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6, fontFamily: F.sans },
  btn: { marginTop: 14, backgroundColor: C.coral, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  btnTxt: { color: '#fff', fontSize: 14.5, fontWeight: '700', fontFamily: F.sans },
  pressed: { opacity: 0.7 },
});
