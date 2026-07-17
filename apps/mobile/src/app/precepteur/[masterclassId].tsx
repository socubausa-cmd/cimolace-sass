import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { LiriFonts as F, type LiriPalette } from '@/constants/liri-theme';
import { fetchCourseCurriculum, type CourseCurriculum } from '@/lib/learning-api';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

/**
 * LE PRÉCEPTEUR (natif) — v1 texte. Joue un `precepteur_course` (concepts → scènes) en mode
 * immersif « voix » typewriter (style Sherpas), avec atelier (question → réponse → révélation)
 * et Q&A borné au cours via l'edge `precepteur-brain` (déployée). Miroir natif de FormationStage
 * (web) sans la synthèse vocale / les croquis (à porter en v2 : expo-speech + react-native-svg).
 */
type Scene = {
  type?: string;
  title?: string;
  narration?: string;
  board_text?: string;
  question?: string;
  reveal_narration?: string;
  analogie?: string;
};
type Concept = { title?: string; scenes?: Scene[] };
type PrecepteurCourse = { title?: string; concepts?: Concept[] };

const DEMO: PrecepteurCourse = {
  title: 'La respiration consciente',
  concepts: [
    {
      title: 'Pourquoi respirer consciemment',
      scenes: [
        { type: 'lecon', title: 'Pourquoi respirer consciemment', narration: 'Respirer consciemment active le nerf vague : le rythme cardiaque ralentit, la tension baisse, l’esprit s’apaise. On passe du « combat-fuite » au « repos-digestion ».' },
        { type: 'atelier', question: 'À ton avis, quel système nerveux la respiration lente active-t-elle ?', reveal_narration: 'Le parasympathique — le mode « repos-digestion » qui répare et apaise.' },
      ],
    },
    {
      title: 'La cohérence cardiaque',
      scenes: [
        { type: 'lecon', title: 'La cohérence cardiaque', narration: 'Inspirer cinq secondes, expirer cinq secondes : six cycles par minute synchronisent le cœur et la respiration. Quelques minutes suffisent pour réguler le stress.' },
      ],
    },
  ],
};

function sceneText(s: Scene | undefined): string {
  if (!s) return '';
  if (s.type === 'atelier') return s.question || 'Réfléchis un instant à ce que nous venons de voir…';
  if (s.type === 'image_analogie') return s.analogie || s.narration || '';
  return s.board_text || s.narration || '';
}

const htmlToText = (html?: string): string =>
  String(html ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** Convertit une formation (curriculum modules→leçons) en cours Précepteur (concepts→scènes) :
 *  chaque support (slides) devient des scènes « leçon ». Permet de JOUER n'importe quel cours au Précepteur. */
function curriculumToPrecepteur(curr: CourseCurriculum): PrecepteurCourse {
  const concepts: Concept[] = (curr.modules ?? [])
    .map((m) => {
      const scenes: Scene[] = (m.lessons ?? []).flatMap((l) => {
        const cd = (l.contentData ?? {}) as Record<string, unknown>;
        const slides = Array.isArray(cd.slides) ? (cd.slides as { title?: string; content?: string }[]) : [];
        if (l.contentType === 'powerpoint' && slides.length) {
          return slides.map((s): Scene => ({ type: 'lecon', title: s.title, narration: htmlToText(s.content) || s.title || '' }));
        }
        if (l.contentType === 'video') {
          return [{ type: 'lecon', title: l.title, narration: `Regarde attentivement la vidéo « ${l.title || 'la leçon'} », puis pose-moi tes questions.` } as Scene];
        }
        return [{ type: 'lecon', title: l.title, narration: l.title || '' } as Scene];
      }).filter((s) => (s.narration || '').trim());
      return { title: m.title || 'Module', scenes };
    })
    .filter((c) => c.scenes.length);
  return { title: curr.course.title || 'Cours', concepts };
}

export default function PrecepteurScreen() {
  const { masterclassId } = useLocalSearchParams<{ masterclassId?: string }>();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [course, setCourse] = useState<PrecepteurCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState('');
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [q, setQ] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!masterclassId || masterclassId === 'demo') {
        setCourse(DEMO);
        setLoading(false);
        return;
      }
      // 1) Masterclass avec un cours Précepteur enrichi (créé par la Factory web).
      const { data } = await supabase.from('masterclasses').select('precepteur_course').eq('id', masterclassId).maybeSingle();
      if (!alive) return;
      const pc = (data?.precepteur_course ?? null) as PrecepteurCourse | null;
      if (pc && Array.isArray(pc.concepts) && pc.concepts.length) {
        setCourse(pc);
        setLoading(false);
        return;
      }
      // 2) Sinon : jouer une FORMATION (structure relationnelle) convertie en scènes.
      try {
        const curr = await fetchCourseCurriculum(masterclassId);
        if (!alive) return;
        const conv = curriculumToPrecepteur(curr);
        if ((conv.concepts ?? []).length) {
          setCourse(conv);
          setLoading(false);
          return;
        }
      } catch {
        /* ni masterclass ni formation → démo */
      }
      if (!alive) return;
      setCourse(DEMO);
      setLoading(false);
    };
    void load();
    return () => { alive = false; };
  }, [masterclassId]);

  const scenes = useMemo(
    () => (course?.concepts ?? []).flatMap((c) => (c.scenes ?? []).map((s) => ({ ...s, conceptTitle: c.title }))),
    [course],
  );
  const cur = scenes[idx];
  const full = sceneText(cur);

  useEffect(() => {
    setTyped('');
    setRevealed(false);
    setAnswer('');
    if (!full) return undefined;
    let i = 0;
    const t = setInterval(() => {
      i += 2;
      setTyped(full.slice(0, i));
      if (i >= full.length) clearInterval(t);
    }, 22);
    return () => clearInterval(t);
  }, [idx, full]);

  const knowledge = useMemo(
    () => ({
      title: course?.title || 'ce cours',
      concepts: (course?.concepts ?? []).map((c) => {
        const l = (c.scenes ?? []).find((s) => s.type === 'lecon');
        return { title: c.title || '', lesson: String(l?.narration || l?.board_text || '').slice(0, 700) };
      }),
    }),
    [course],
  );

  const ask = async () => {
    const question = q.trim();
    if (!question || asking) return;
    setQ('');
    setAsking(true);
    setReply('…');
    try {
      const { data, error } = await supabase.functions.invoke('precepteur-brain', {
        body: { question, course: knowledge, concept: cur?.conceptTitle || '' },
      });
      if (error) throw error;
      setReply(String((data as { reply?: string } | null)?.reply || 'Je n’ai pas trouvé la réponse dans ce cours.'));
    } catch {
      setReply('Je ne peux pas répondre à l’instant — réessaie dans un moment.');
    } finally {
      setAsking(false);
    }
  };

  const advance = () => setIdx((i) => Math.min(scenes.length - 1, i + 1));
  const atEnd = idx >= scenes.length - 1;

  if (loading) return <View style={styles.center}><ActivityIndicator color={C.coral} /></View>;

  return (
    <View style={styles.root}>
      <Text style={styles.mode}>CIMOLACE · MODE FORMATION</Text>
      <Pressable style={styles.stage} onPress={cur?.type === 'atelier' ? undefined : advance}>
        <ScrollView contentContainerStyle={styles.stageBody} keyboardShouldPersistTaps="handled">
          <View style={styles.presence} />
          {cur?.type === 'atelier' ? (
            <View style={styles.atelier}>
              <Text style={styles.voice}>{typed}</Text>
              {!revealed ? (
                <>
                  <TextInput value={answer} onChangeText={setAnswer} placeholder="Ta réponse…" placeholderTextColor={C.faint} style={styles.answerInput} multiline />
                  <Pressable onPress={() => setRevealed(true)} style={styles.revealBtn}><Text style={styles.revealTxt}>Voir la réponse</Text></Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.reveal}>{cur.reveal_narration || 'Voilà l’essentiel de ce que nous venons de voir ensemble.'}</Text>
                  <Pressable onPress={advance} style={styles.revealBtn}><Text style={styles.revealTxt}>{atEnd ? 'Terminer' : 'Continuer'}</Text></Pressable>
                </>
              )}
            </View>
          ) : (
            <Text style={styles.voice}>
              {typed}
              {typed.length < full.length ? <Text style={styles.caret}> ▋</Text> : null}
            </Text>
          )}
          {reply ? <Text style={styles.reply}>{reply}</Text> : null}
        </ScrollView>
        {cur?.type !== 'atelier' ? <Text style={styles.hint}>{atEnd ? 'Fin du cours' : 'Touche pour continuer'}</Text> : null}
      </Pressable>
      <View style={styles.qbar}>
        <TextInput value={q} onChangeText={setQ} placeholder="Parle à la présence…" placeholderTextColor={C.faint} style={styles.qInput} onSubmitEditing={ask} returnKeyType="send" />
        <Pressable onPress={ask} disabled={asking} style={[styles.qSend, asking && { opacity: 0.5 }]}>
          <Feather name="arrow-up" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.base },
  mode: { textAlign: 'center', color: C.coral, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, paddingTop: 56, paddingBottom: 8, fontFamily: F.sans },
  stage: { flex: 1 },
  stageBody: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 26, paddingVertical: 30, gap: 22 },
  presence: { alignSelf: 'center', width: 46, height: 46, borderRadius: 23, backgroundColor: C.coralTint, borderWidth: 1, borderColor: C.coral, marginBottom: 8 },
  voice: { color: C.ink, fontSize: 24, lineHeight: 34, fontWeight: '600', textAlign: 'center', fontFamily: F.serif },
  caret: { color: C.coral },
  atelier: { gap: 16 },
  answerInput: { minHeight: 70, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, color: C.ink, padding: 14, fontSize: 15, fontFamily: F.sans },
  revealBtn: { alignSelf: 'center', paddingVertical: 11, paddingHorizontal: 22, borderRadius: 12, backgroundColor: C.coral },
  revealTxt: { color: '#fff', fontSize: 14, fontWeight: '700', fontFamily: F.sans },
  reveal: { color: C.muted, fontSize: 16, lineHeight: 24, textAlign: 'center', fontFamily: F.serif },
  reply: { color: C.muted, fontSize: 15, lineHeight: 23, textAlign: 'center', fontStyle: 'italic', fontFamily: F.serif, marginTop: 8 },
  hint: { textAlign: 'center', color: C.faint, fontSize: 12, paddingBottom: 10, fontFamily: F.sans },
  qbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 28, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.rail },
  qInput: { flex: 1, height: 42, borderRadius: 21, paddingHorizontal: 16, backgroundColor: C.panel, color: C.ink, fontSize: 14, fontFamily: F.sans },
  qSend: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: C.coral },
});
