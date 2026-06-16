/**
 * Variante WEB du tableau SmartBoard. Le moteur réel s'appuie sur
 * @shopify/react-native-skia (module natif) qui casse le bundle web / Expo Go —
 * Metro choisit donc ce stub `.web.tsx`. Le vrai tableau vit dans
 * smartboard-screen.tsx (build natif installé).
 */
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriFonts as F, type LiriPalette } from '@/constants/liri-theme';
import { useTheme } from '@/lib/theme';

export default function SmartboardWeb() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const params = useLocalSearchParams<{ title?: string }>();
  const title = typeof params.title === 'string' && params.title ? params.title : 'Tableau SmartBoard';

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.card}>
          <View style={styles.icon}>
            <Feather name="pen-tool" size={28} color={C.coral} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.badge}>Tableau Canvas · Skia</Text>
          <Text style={styles.note}>
            Le tableau interactif (dessin Skia, scènes, sauvegarde) nécessite
            l&apos;application installée sur ton téléphone, pas la prévisualisation
            web ni Expo Go.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
            onPress={() => router.back()}
          >
            <Text style={styles.btnTxt}>Retour</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  safe: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: 10,
    padding: 26,
    borderRadius: 22,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
  },
  icon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.coralTint,
    marginBottom: 4,
  },
  title: { color: C.ink, fontSize: 18, fontWeight: '700', fontFamily: F.serif, textAlign: 'center' },
  badge: { color: C.coral, fontSize: 12, fontWeight: '700', fontFamily: F.sans },
  note: { color: C.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6, fontFamily: F.sans },
  btn: { marginTop: 14, backgroundColor: C.coral, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  btnTxt: { color: '#fff', fontSize: 14.5, fontWeight: '700', fontFamily: F.sans },
  pressed: { opacity: 0.7 },
});
