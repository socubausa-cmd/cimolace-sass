import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type LiriPalette } from '@/constants/liri-theme';
import { useTheme } from '@/lib/theme';

import { MasterscriptList } from './masterscript-list';
import { MasterscriptReader } from './masterscript-reader';

/**
 * Moteur « Lecteur Masterclass » (masterscript) — 100% natif, zéro module natif
 * (fonctionne en Expo Go). Aiguille selon ?projectId :
 *   - absent → liste des masterclass (FlatList)
 *   - présent → lecture du projet (accordéon chapitres + progression locale)
 */
export default function MasterscriptScreen() {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const id = Array.isArray(projectId) ? projectId[0] : projectId;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {id ? <MasterscriptReader projectId={id} /> : <MasterscriptList />}
    </SafeAreaView>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.base },
});
