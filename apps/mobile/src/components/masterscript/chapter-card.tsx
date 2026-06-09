import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { LiriColors as C, LiriFonts as F, softShadow } from '@/constants/liri-theme';

import type { MasterclassChapter } from './data';

interface ChapterCardProps {
  chapter: MasterclassChapter;
  index: number;
  completed: boolean;
  expanded: boolean;
  onToggle: () => void;
  onComplete: () => void;
}

/**
 * Carte chapitre en accordéon. L'ouverture/fermeture pilote une rotation du
 * chevron et un fondu du corps via Animated.Value (zéro module natif).
 * Le corps déroule le contenu step-by-step : objectif, compétence, révélation,
 * tension, exemples, je_retiens, test de compréhension.
 */
export function ChapterCard({
  chapter,
  index,
  completed,
  expanded,
  onToggle,
  onComplete,
}: ChapterCardProps) {
  const anim = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const [mounted, setMounted] = useState(expanded);

  useEffect(() => {
    if (expanded) setMounted(true);
    Animated.timing(anim, {
      toValue: expanded ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !expanded) setMounted(false);
    });
  }, [expanded, anim]);

  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });
  const examples = chapter.examples?.filter((e) => (e.content ?? '').trim()) ?? [];
  const jeRetiens = chapter.je_retiens?.filter((s) => s.trim()) ?? [];
  const tests = chapter.understanding_test?.filter((t) => t.question?.trim()) ?? [];

  return (
    <View style={[styles.card, completed && styles.cardDone, softShadow]}>
      <Pressable style={styles.header} onPress={onToggle} accessibilityRole="button">
        <View style={[styles.num, completed && styles.numDone]}>
          {completed ? (
            <Feather name="check" size={14} color={C.base} />
          ) : (
            <Text style={styles.numText}>{index + 1}</Text>
          )}
        </View>
        <Text style={styles.title} numberOfLines={expanded ? undefined : 2}>
          {chapter.title || `Chapitre ${index + 1}`}
        </Text>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Feather name="chevron-right" size={20} color={C.faint} />
        </Animated.View>
      </Pressable>

      {mounted && (
        <Animated.View style={[styles.body, { opacity: anim }]}>
          {!!chapter.objective && (
            <Section icon="target" label="Objectif" text={chapter.objective} />
          )}
          {!!chapter.skill_to_acquire && (
            <Section icon="award" label="Compétence à acquérir" text={chapter.skill_to_acquire} />
          )}
          {!!chapter.revelation_moment && (
            <Section icon="zap" label="Révélation" text={chapter.revelation_moment} accent />
          )}
          {!!chapter.pedagogical_tension && (
            <Section icon="alert-triangle" label="Tension" text={chapter.pedagogical_tension} />
          )}

          {examples.length > 0 && (
            <View style={styles.section}>
              <Label icon="layers" text="Exemples" />
              {examples.map((ex, i) => (
                <View key={i} style={styles.bullet}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bulletText}>{ex.content}</Text>
                </View>
              ))}
            </View>
          )}

          {jeRetiens.length > 0 && (
            <View style={[styles.section, styles.retiens]}>
              <Label icon="bookmark" text="Je retiens" accent />
              {jeRetiens.map((line, i) => (
                <View key={i} style={styles.bullet}>
                  <View style={[styles.bulletDot, { backgroundColor: C.coral }]} />
                  <Text style={styles.bulletText}>{line}</Text>
                </View>
              ))}
            </View>
          )}

          {tests.length > 0 && (
            <View style={styles.section}>
              <Label icon="help-circle" text="Test de compréhension" />
              {tests.map((t, i) => (
                <View key={i} style={styles.test}>
                  <Text style={styles.testQ}>{t.question}</Text>
                  {!!t.expected_answer && (
                    <Text style={styles.testA}>{t.expected_answer}</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          <Pressable
            style={[styles.cta, completed && styles.ctaDone]}
            onPress={onComplete}
            accessibilityRole="button"
          >
            <Feather
              name={completed ? 'check-circle' : 'arrow-right-circle'}
              size={17}
              color={completed ? C.emeraldB : C.base}
            />
            <Text style={[styles.ctaText, completed && styles.ctaTextDone]}>
              {completed ? 'Chapitre terminé' : 'Chapitre suivant'}
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

/** Petit en-tête de section (icône + libellé). */
function Label({
  icon,
  text,
  accent,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  text: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.labelRow}>
      <Feather name={icon} size={13} color={accent ? C.coral : C.faint} />
      <Text style={[styles.labelText, accent && { color: C.coral }]}>{text}</Text>
    </View>
  );
}

/** Bloc « libellé + paragraphe ». */
function Section({
  icon,
  label,
  text,
  accent,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  text: string;
  accent?: boolean;
}) {
  return (
    <View style={[styles.section, accent && styles.sectionAccent]}>
      <Label icon={icon} text={label} accent={accent} />
      <Text style={styles.paragraph}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
  },
  cardDone: { borderColor: 'rgba(109,143,96,0.32)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  num: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.coralTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numDone: { backgroundColor: C.emeraldB },
  numText: { fontFamily: F.sans, fontSize: 13, fontWeight: '700', color: C.coral },
  title: { flex: 1, fontFamily: F.serif, fontSize: 16, color: C.ink, lineHeight: 22 },

  body: { paddingHorizontal: 16, paddingBottom: 16, gap: 14 },
  section: { gap: 8 },
  sectionAccent: {
    backgroundColor: C.coralTint2,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.coralTint,
  },
  retiens: {
    backgroundColor: C.coralTint2,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.coralTint,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  labelText: {
    fontFamily: F.sans,
    fontSize: 11,
    fontWeight: '700',
    color: C.faint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  paragraph: { fontFamily: F.sans, fontSize: 14, color: C.muted, lineHeight: 21 },

  bullet: { flexDirection: 'row', gap: 9, paddingRight: 4 },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: C.faint,
    marginTop: 8,
  },
  bulletText: { flex: 1, fontFamily: F.sans, fontSize: 14, color: C.muted, lineHeight: 21 },

  test: {
    backgroundColor: C.rail,
    borderRadius: 10,
    padding: 11,
    gap: 5,
    borderWidth: 1,
    borderColor: C.lineSoft,
  },
  testQ: { fontFamily: F.sans, fontSize: 14, color: C.ink, fontWeight: '600', lineHeight: 20 },
  testA: { fontFamily: F.sans, fontSize: 13, color: C.faint, lineHeight: 19 },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: C.coral,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 2,
  },
  ctaDone: { backgroundColor: 'rgba(109,143,96,0.14)', borderWidth: 1, borderColor: 'rgba(109,143,96,0.32)' },
  ctaText: { fontFamily: F.sans, fontSize: 15, fontWeight: '700', color: C.base },
  ctaTextDone: { color: C.emeraldB },
});
