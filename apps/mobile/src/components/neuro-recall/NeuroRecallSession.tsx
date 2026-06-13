import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { LiriColors as C, LiriFonts as F, softShadow } from '@/constants/liri-theme';

import { fetchDueCards, reviewCard, type RecallCard, type ReviewQuality } from './data';

interface Props {
  deckId: string;
  /** Retour à la liste des decks (fin de session ou bouton retour). */
  onDone: () => void;
}

type IconName = React.ComponentProps<typeof Feather>['name'];

/** Les 4 boutons de notation mappés sur quality 1-4. */
const GRADES: { quality: ReviewQuality; label: string; icon: IconName; color: string }[] = [
  { quality: 1, label: 'À revoir', icon: 'rotate-ccw', color: C.live },
  { quality: 2, label: 'Difficile', icon: 'alert-triangle', color: '#c9803f' },
  { quality: 3, label: 'Correct', icon: 'check', color: C.coral },
  { quality: 4, label: 'Facile', icon: 'zap', color: C.emeraldB },
];

/**
 * Session de révision NeuroRecall.
 * Cartes dues une par une : face avant → « Voir la réponse » → face arrière →
 * 4 boutons (Again/Hard/Good/Easy) → POST review → carte suivante.
 * Animation flip via Animated.Value. Progression (index/total).
 */
export function NeuroRecallSession({ deckId, onDone }: Props) {
  const [cards, setCards] = useState<RecallCard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const flip = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    void (async () => {
      const due = await fetchDueCards(deckId);
      if (alive) setCards(due);
    })();
    return () => {
      alive = false;
    };
  }, [deckId]);

  const animateTo = useCallback(
    (to: 0 | 1) => {
      Animated.spring(flip, { toValue: to, useNativeDriver: true, friction: 8, tension: 10 }).start();
    },
    [flip],
  );

  const reveal = useCallback(() => {
    setFlipped(true);
    animateTo(1);
  }, [animateTo]);

  const grade = useCallback(
    async (quality: ReviewQuality) => {
      const card = cards?.[index];
      if (!card || submitting) return;
      setSubmitting(true);
      await reviewCard(card.id, quality); // best-effort ; on avance même si l'API échoue
      setSubmitting(false);
      // Reset visuel puis carte suivante.
      flip.setValue(0);
      setFlipped(false);
      setIndex((i) => i + 1);
    },
    [cards, index, submitting, flip],
  );

  // ── États : chargement / vide / fin ──
  if (cards === null) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.coral} />
        <Text style={s.centerTxt}>Chargement des cartes…</Text>
      </View>
    );
  }

  if (cards.length === 0) {
    return (
      <View style={s.center}>
        <View style={s.bigIcon}>
          <Feather name="coffee" size={28} color={C.coral} />
        </View>
        <Text style={s.centerTitle}>Rien à réviser</Text>
        <Text style={s.centerTxt}>Aucune carte due dans ce deck pour l&apos;instant. Revenez plus tard.</Text>
        <Pressable onPress={onDone} style={({ pressed }) => [s.cta, pressed && s.pressed]}>
          <Text style={s.ctaTxt}>Retour aux decks</Text>
        </Pressable>
      </View>
    );
  }

  if (index >= cards.length) {
    return (
      <View style={s.center}>
        <View style={s.bigIcon}>
          <Feather name="check-circle" size={28} color={C.emeraldB} />
        </View>
        <Text style={s.centerTitle}>Session terminée</Text>
        <Text style={s.centerTxt}>
          {cards.length} {cards.length > 1 ? 'cartes révisées' : 'carte révisée'}. Beau travail !
        </Text>
        <Pressable onPress={onDone} style={({ pressed }) => [s.cta, pressed && s.pressed]}>
          <Text style={s.ctaTxt}>Retour aux decks</Text>
        </Pressable>
      </View>
    );
  }

  const card = cards[index];
  const frontRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const frontOpacity = flip.interpolate({ inputRange: [0, 0.5, 0.5, 1], outputRange: [1, 1, 0, 0] });
  const backOpacity = flip.interpolate({ inputRange: [0, 0.5, 0.5, 1], outputRange: [0, 0, 1, 1] });

  return (
    <View style={s.flex1}>
      {/* progression */}
      <View style={s.progressWrap}>
        <View style={s.progressBarBg}>
          <View style={[s.progressBarFill, { width: `${((index + 1) / cards.length) * 100}%` }]} />
        </View>
        <Text style={s.progressTxt}>
          {index + 1} / {cards.length}
        </Text>
      </View>

      {/* carte flip */}
      <View style={s.cardArea}>
        <Pressable
          style={s.cardPress}
          onPress={flipped ? undefined : reveal}
          disabled={flipped}
          accessibilityRole="button"
          accessibilityLabel={flipped ? 'Réponse affichée' : 'Voir la réponse'}
        >
          {/* face avant — question */}
          <Animated.View
            style={[
              s.face,
              { opacity: frontOpacity, transform: [{ perspective: 1000 }, { rotateY: frontRotate }] },
            ]}
            pointerEvents={flipped ? 'none' : 'auto'}
          >
            <Text style={s.faceTag}>Question</Text>
            <Text style={s.faceText}>{card.question}</Text>
            <View style={s.hint}>
              <Feather name="eye" size={14} color={C.faint} />
              <Text style={s.hintTxt}>Toucher pour voir la réponse</Text>
            </View>
          </Animated.View>

          {/* face arrière — réponse */}
          <Animated.View
            style={[
              s.face,
              s.faceBack,
              { opacity: backOpacity, transform: [{ perspective: 1000 }, { rotateY: backRotate }] },
            ]}
            pointerEvents={flipped ? 'auto' : 'none'}
          >
            <Text style={[s.faceTag, s.faceTagBack]}>Réponse</Text>
            <Text style={s.faceText}>{card.answer}</Text>
          </Animated.View>
        </Pressable>
      </View>

      {/* contrôles bas */}
      <View style={s.controls}>
        {!flipped ? (
          <Pressable onPress={reveal} style={({ pressed }) => [s.revealBtn, pressed && s.pressed]}>
            <Feather name="eye" size={17} color="#fff" />
            <Text style={s.revealTxt}>Voir la réponse</Text>
          </Pressable>
        ) : (
          <View style={s.grades}>
            {GRADES.map((g) => (
              <Pressable
                key={g.quality}
                onPress={() => grade(g.quality)}
                disabled={submitting}
                style={({ pressed }) => [
                  s.grade,
                  { borderColor: g.color },
                  pressed && s.pressed,
                  submitting && s.gradeDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={g.label}
              >
                <Feather name={g.icon} size={18} color={g.color} />
                <Text style={[s.gradeTxt, { color: g.color }]}>{g.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  flex1: { flex: 1 },
  pressed: { opacity: 0.78 },

  // états centrés
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  centerTitle: { color: C.ink, fontSize: 19, fontWeight: '700', fontFamily: F.serif, textAlign: 'center' },
  centerTxt: { color: C.muted, fontSize: 13.5, lineHeight: 20, fontFamily: F.sans, textAlign: 'center' },
  bigIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.coralTint,
    marginBottom: 4,
  },
  cta: {
    marginTop: 10,
    backgroundColor: C.coral,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  ctaTxt: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: F.sans },

  // progression
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 12 },
  progressBarBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.panel2, overflow: 'hidden' },
  progressBarFill: { height: 6, borderRadius: 3, backgroundColor: C.coral },
  progressTxt: { color: C.muted, fontSize: 12.5, fontWeight: '600', fontFamily: F.sans, minWidth: 48, textAlign: 'right' },

  // carte
  cardArea: { flex: 1, paddingHorizontal: 18, paddingVertical: 18 },
  cardPress: { flex: 1 },
  face: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: 'hidden',
    borderRadius: 24,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
    padding: 26,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    ...softShadow,
  },
  faceBack: { backgroundColor: C.panel2, borderColor: C.coralTint },
  faceTag: {
    color: C.coral,
    fontSize: 11.5,
    fontWeight: '700',
    fontFamily: F.sans,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  faceTagBack: { color: C.coral },
  faceText: { color: C.ink, fontSize: 21, lineHeight: 30, fontFamily: F.serif, textAlign: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  hintTxt: { color: C.faint, fontSize: 12, fontFamily: F.sans },

  // contrôles
  controls: { paddingHorizontal: 18, paddingBottom: 8, minHeight: 96, justifyContent: 'center' },
  revealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.coral,
    borderRadius: 16,
    paddingVertical: 16,
  },
  revealTxt: { color: '#fff', fontSize: 15.5, fontWeight: '700', fontFamily: F.sans },
  grades: { flexDirection: 'row', gap: 8 },
  grade: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: C.panel,
  },
  gradeDisabled: { opacity: 0.5 },
  gradeTxt: { fontSize: 12, fontWeight: '700', fontFamily: F.sans },
});
