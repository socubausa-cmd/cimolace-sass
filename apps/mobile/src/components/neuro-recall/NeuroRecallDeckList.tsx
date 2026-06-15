import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { LiriFonts as F, softShadow, type LiriPalette } from '@/constants/liri-theme';
import { useTheme } from '@/lib/theme';

import { fetchDecks, fetchStats, type RecallDeck, type RecallStats } from './data';

interface Props {
  /** Ouvre la session de révision pour un deck donné. */
  onOpenDeck: (deckId: string) => void;
}

/**
 * Écran liste des decks NeuroRecall.
 * FlatList des decks (GET /neuro-recall/decks), badge global « X cartes dues »
 * (GET /neuro-recall/stats), bouton Réviser par deck.
 * État vide honnête si aucun deck (jamais de fausses maquettes).
 */
export function NeuroRecallDeckList({ onOpenDeck }: Props) {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const [decks, setDecks] = useState<RecallDeck[] | null>(null);
  const [stats, setStats] = useState<RecallStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [d, s] = await Promise.all([fetchDecks(), fetchStats()]);
    setDecks(d);
    setStats(s);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const loading = decks === null;
  const dueCards = stats?.dueCards ?? 0;

  return (
    <View style={s.flex1}>
      {/* bandeau récap — cartes dues globales */}
      <View style={s.recap}>
        <View style={s.recapIcon}>
          <Feather name="zap" size={18} color={C.coral} />
        </View>
        <View style={s.flex1}>
          <Text style={s.recapNum}>{dueCards}</Text>
          <Text style={s.recapLabel}>
            {dueCards === 0 ? 'aucune carte à réviser' : dueCards === 1 ? 'carte à réviser' : 'cartes à réviser'}
          </Text>
        </View>
        {stats ? (
          <View style={s.recapMeta}>
            <Text style={s.recapMetaTxt}>{stats.totalDecks} decks</Text>
            <Text style={s.recapMetaTxt}>{stats.totalReviews} révisions</Text>
          </View>
        ) : null}
      </View>

      <FlatList
        data={decks ?? []}
        keyExtractor={(d) => d.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.coral} />}
        renderItem={({ item }) => <DeckRow deck={item} onPress={() => onOpenDeck(item.id)} />}
        ListEmptyComponent={
          loading ? null : (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Feather name="layers" size={26} color={C.coral} />
              </View>
              <Text style={s.emptyTitle}>Aucun deck pour le moment</Text>
              <Text style={s.emptySub}>
                Vos paquets de flashcards apparaîtront ici une fois créés depuis une session ou un cours.
                Connectez-vous pour retrouver vos révisions.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

function DeckRow({ deck, onPress }: { deck: RecallDeck; onPress: () => void }) {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const when = deck.created_at ? formatDate(deck.created_at) : null;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, pressed && s.pressed]}>
      <View style={s.cardIcon}>
        <Feather name="book-open" size={20} color={C.coral} />
      </View>
      <View style={s.flex1}>
        <Text style={s.cardTitle} numberOfLines={2}>
          {deck.title || 'Deck sans titre'}
        </Text>
        {when ? <Text style={s.cardMeta}>Créé le {when}</Text> : null}
      </View>
      <View style={s.reviewBtn}>
        <Text style={s.reviewBtnTxt}>Réviser</Text>
        <Feather name="chevron-right" size={16} color="#fff" />
      </View>
    </Pressable>
  );
}

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  flex1: { flex: 1 },
  pressed: { opacity: 0.75 },

  recap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    padding: 14,
    borderRadius: 18,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
    ...softShadow,
  },
  recapIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.coralTint,
  },
  recapNum: { color: C.ink, fontSize: 22, fontWeight: '700', fontFamily: F.serif },
  recapLabel: { color: C.muted, fontSize: 12.5, fontFamily: F.sans, marginTop: -2 },
  recapMeta: { alignItems: 'flex-end', gap: 2 },
  recapMetaTxt: { color: C.faint, fontSize: 11, fontFamily: F.sans },

  list: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 36, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
    ...softShadow,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.coralTint,
  },
  cardTitle: { color: C.ink, fontSize: 15, fontWeight: '600', fontFamily: F.sans },
  cardMeta: { color: C.faint, fontSize: 11.5, fontFamily: F.sans, marginTop: 3 },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: 14,
    paddingRight: 10,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.coral,
  },
  reviewBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700', fontFamily: F.sans },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 28, gap: 10 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.coralTint,
    marginBottom: 4,
  },
  emptyTitle: { color: C.ink, fontSize: 16.5, fontWeight: '700', fontFamily: F.serif, textAlign: 'center' },
  emptySub: { color: C.muted, fontSize: 13, lineHeight: 19, fontFamily: F.sans, textAlign: 'center' },
});
