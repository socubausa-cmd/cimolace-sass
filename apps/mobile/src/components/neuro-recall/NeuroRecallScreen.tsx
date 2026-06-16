import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type LiriPalette } from '@/constants/liri-theme';
import { useTheme } from '@/lib/theme';
import { EngineHeader } from '@/components/engine-kit';

import { NeuroRecallDeckList } from './NeuroRecallDeckList';
import { NeuroRecallSession } from './NeuroRecallSession';

/**
 * Moteur NeuroRecall Flashcards (key: neuro-recall) — 100 % natif, Expo Go.
 *
 * Deux vues pilotées par l'état local `activeDeck` :
 *  - liste des decks (par défaut) ;
 *  - session de révision (carte par carte) quand un deck est sélectionné.
 *
 * Lancement direct : /neuro-recall?deckId=X démarre la session sur ce deck.
 * Aucun module natif requis → fonctionne tel quel en Expo Go et sur le web.
 */
export default function NeuroRecallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ deckId?: string }>();
  const initialDeck = typeof params.deckId === 'string' && params.deckId.length > 0 ? params.deckId : null;

  const [activeDeck, setActiveDeck] = useState<string | null>(initialDeck);

  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);

  // Retour : depuis une session → liste ; depuis la liste → écran précédent.
  const handleBack = () => {
    if (activeDeck) setActiveDeck(null);
    else router.back();
  };

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={s.safe}>
        <EngineHeader title={activeDeck ? 'Révision' : 'NeuroRecall'} onBack={handleBack} />
        {activeDeck ? (
          <NeuroRecallSession deckId={activeDeck} onDone={() => setActiveDeck(null)} />
        ) : (
          <NeuroRecallDeckList onOpenDeck={(id) => setActiveDeck(id)} />
        )}
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  safe: { flex: 1 },
});
