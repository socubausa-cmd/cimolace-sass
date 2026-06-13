/**
 * Maquette « Live Host » — salle live de l'hôte, version mobile.
 *
 * Reproduction PIXEL-PERFECT de la maquette web de référence :
 *   apps/app/src/pages/eleve-mobile/LiriMobileHostView.jsx
 *
 * Composant 100 % React Native (aucun module natif) : il s'affiche donc à
 * l'identique sur le web (prévisualisation Expo) ET sur l'app installée.
 * La vidéo LiveKit réelle viendra se brancher dans les emplacements
 * « Ma vidéo » / « ProfPip » côté natif (intégration ultérieure).
 */
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';

const STUDENT_POSTER = require('../../../assets/images/live/student-poster.png');
const PROF_PIP = require('../../../assets/images/live/prof-pip.png');

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const participants: { name: string; role?: string; online: boolean }[] = [
  { name: 'Manikongo', role: 'PROF', online: true },
  { name: 'Amina K.', online: true },
  { name: 'Yannick D.', online: true },
  { name: 'Sarah L.', online: true },
  { name: 'Mohamed B.', online: true },
  { name: 'Clara M.', online: true },
];

const SLIDES = [
  { n: 1, label: 'Ondes et lumière' },
  { n: 2, label: 'La vitesse de la lumière' },
  { n: 3, label: 'Spectre visible' },
  { n: 4, label: 'Interférences' },
  { n: 5, label: 'Diffraction' },
  { n: 6, label: 'Double fente' },
  { n: 7, label: 'QCM / révision' },
];

/* Palette de la maquette (violet sombre — distincte du thème portail coral). */
const P = {
  bg: '#050812',
  cardA: '#0f1525',
  cardB: '#080c18',
  navBg: 'rgba(11,16,28,0.95)',
  navRing: '#0b101c',
  violet600: '#7c3aed',
  violet500: '#8b5cf6',
  violet400: '#a78bfa',
  violet300: '#c4b5fd',
  violet200: '#ddd6fe',
  red500: '#ef4444',
  red400: '#f87171',
  emerald400: '#34d399',
  emerald300: '#6ee7b7',
  cyan400: '#22d3ee',
  cyan200: '#a5f3fc',
  amber200: '#fde68a',
  slate900: '#0f172a',
  slate800: '#1e293b',
  white: '#ffffff',
};

export default function HostMaquette() {
  const router = useRouter();
  const [activeSlide, setActiveSlide] = useState(1);

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={s.safe}>
        <ScrollView
          style={s.flex1}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.col}>
            {/* ── Header : LIVE · 128 · profil ── */}
            <View style={s.header}>
              <View style={s.headerLeft}>
                <View style={s.liveBadge}>
                  <View style={s.liveDot} />
                  <Text style={s.liveTxt}>LIVE</Text>
                </View>
                <View style={s.countBadge}>
                  <Text style={s.countTxt}>👥 128</Text>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [s.profileBtn, pressed && s.press]}
                onPress={() => router.back()}
                accessibilityLabel="Profil ou réglages"
              >
                <Feather name="user" size={20} color="rgba(255,255,255,0.9)" />
              </Pressable>
            </View>

            {/* ── Diapo en cours ── */}
            <LinearGradient colors={[P.cardA, P.cardB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.slideCard}>
              <View style={s.slideHead}>
                <View style={s.slideHeadText}>
                  <Text style={s.chapterKicker}>CHAPITRE 3</Text>
                  <Text style={s.slideTitle}>{SLIDES[activeSlide].label}</Text>
                </View>
                <View style={s.slideHeadRight}>
                  <ProfPip />
                  <Speedometer />
                </View>
              </View>

              {activeSlide === 1 ? (
                <View style={s.slideBody}>
                  <Text style={s.para}>
                    En physique, on pose que la célérité de la lumière dans le vide, notée{' '}
                    <Text style={s.em}>c</Text>, est une <Text style={s.strong}>constante universelle</Text>.
                  </Text>

                  <View style={s.formula}>
                    <Text style={s.formulaTxt}>
                      c = 299 792 458 m/s <Text style={s.formulaDim}>≈ 300 000 km/s</Text>
                    </Text>
                  </View>

                  <View style={s.retainBox}>
                    <Text style={s.retainLabel}>À RETENIR</Text>
                    <View style={s.ul}>
                      <Bullet>
                        La lumière se propage <Text style={s.strong}>en ligne droite</Text> en milieu homogène.
                      </Bullet>
                      <Bullet>
                        Son <Text style={s.strong}>énergie</Text> transporte l'info couleur et intensité.
                      </Bullet>
                      <Bullet>
                        La vitesse <Text style={s.em}>c</Text> est la <Text style={s.strong}>limite haute</Text> pour toute information.
                      </Bullet>
                    </View>
                  </View>

                  {/* Diagramme Soleil → Terre */}
                  <View style={s.diagram}>
                    <View style={s.sun}><Text style={s.sunTxt}>☼</Text></View>
                    <View style={s.dash} />
                    <View style={s.diagDot} />
                    <View style={s.dash} />
                    <View style={s.diagDot} />
                  </View>
                  <Text style={s.caption}>Temps de trajet du Soleil à la Terre ≈ 8 min 20 s</Text>
                </View>
              ) : (
                <Text style={s.previewNote}>
                  Aperçu de la leçon — pensez à revenir sur « La vitesse de la lumière » pour l'exemple complet.
                </Text>
              )}
            </LinearGradient>

            {/* ── Plan du chapitre ── */}
            <View style={s.planWrap}>
              <Text style={s.planLabel}>PLAN DU CHAPITRE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.planRow}>
                {SLIDES.map((slide, i) => {
                  const active = i === activeSlide;
                  return (
                    <Pressable
                      key={slide.n}
                      onPress={() => setActiveSlide(i)}
                      style={({ pressed }) => [s.planItem, active ? s.planItemActive : s.planItemIdle, pressed && s.press]}
                    >
                      <View style={[s.planNum, active ? s.planNumActive : s.planNumIdle]}>
                        <Text style={[s.planNumTxt, active && s.planNumTxtActive]}>{slide.n}</Text>
                      </View>
                      <Text numberOfLines={1} style={[s.planItemLabel, active ? s.planItemLabelActive : s.planItemLabelIdle]}>
                        {slide.label}
                      </Text>
                      {active ? <View style={s.planUnderline} /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* ── Ma vidéo ── */}
            <View style={s.videoSection}>
              <Text style={s.sectionH2}>Ma vidéo</Text>
              <View style={s.videoFrame}>
                <ImageBackground source={STUDENT_POSTER} style={s.videoImg} imageStyle={s.videoImgInner}>
                  <LinearGradient
                    colors={['rgba(0,0,0,0.2)', 'transparent', 'rgba(0,0,0,0.6)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={s.videoTopLeft}>
                    <Feather name="video" size={16} color={P.violet300} />
                    <View style={s.onBadge}><Text style={s.onTxt}>ON</Text></View>
                  </View>
                  <Pressable style={({ pressed }) => [s.maximizeBtn, pressed && s.press]} accessibilityLabel="Agrandir la vidéo">
                    <Feather name="maximize-2" size={20} color="rgba(255,255,255,0.95)" />
                  </Pressable>
                  <View style={s.videoCtrls}>
                    <CircleCtrl icon="camera" label="Caméra" />
                    <CircleCtrl icon="mic" label="Micro" />
                    <Pressable style={({ pressed }) => [s.bigRedBtn, pressed && s.press]} accessibilityLabel="Couper la caméra">
                      <Feather name="video-off" size={20} color="#fff" />
                    </Pressable>
                  </View>
                </ImageBackground>
              </View>
              <View style={s.pager}>
                <View style={[s.pagerDot, { backgroundColor: P.violet500 }]} />
                <View style={[s.pagerDot, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
              </View>
            </View>

            {/* ── Membres connectés ── */}
            <View style={s.membersSection}>
              <View style={s.membersHead}>
                <View>
                  <Text style={s.sectionH2}>Membres connectés</Text>
                  <View style={s.onlineRow}>
                    <View style={s.onlineDot} />
                    <Text style={s.onlineTxt}>128 en ligne</Text>
                  </View>
                </View>
                <Pressable style={({ pressed }) => [s.seeAllBtn, pressed && s.press]}>
                  <Text style={s.seeAllTxt}>Voir tous</Text>
                </Pressable>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.membersRow}>
                {participants.map((p) => (
                  <View key={p.name} style={s.member}>
                    <LinearGradient colors={[P.violet500, '#3b82f6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatarRing}>
                      <View style={s.avatarInner} />
                      {p.online ? <View style={s.avatarOnline} /> : null}
                    </LinearGradient>
                    <Text numberOfLines={1} style={s.memberName}>{p.name}</Text>
                    {p.role ? (
                      <View style={s.roleBadge}><Text style={s.roleTxt}>{p.role}</Text></View>
                    ) : null}
                  </View>
                ))}
                <View style={s.memberMore}>
                  <View style={s.moreCircle}><Text style={s.moreTxt}>+122</Text></View>
                </View>
              </ScrollView>
            </View>

            {/* ── Chat / Questions ── */}
            <View style={s.dualGrid}>
              <View style={s.dualCard}>
                <View style={s.dualHead}>
                  <Text style={s.dualTitle}>Chat en direct</Text>
                  <View style={s.dualCount}><Text style={s.dualCountTxt}>12</Text></View>
                </View>
                <View style={s.msgBox}>
                  <Text style={s.msgName}>Amina K.</Text>
                  <Text style={s.msgTxt}>Merci beaucoup professeur 🙏</Text>
                </View>
              </View>

              <View style={s.dualCard}>
                <View style={s.dualHead}>
                  <Text style={s.dualTitle}>Questions</Text>
                  <View style={s.dualCount}><Text style={s.dualCountTxt}>5</Text></View>
                </View>
                <View style={s.msgBox}>
                  <Text style={s.msgName}>Yannick D.</Text>
                  <Text style={s.msgTxt}>Pourquoi la lumière a-t-elle une vitesse constante ?</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* ── Barre d'actions (sticky) ── */}
        <View style={s.navBar}>
          <View style={s.navRow}>
            <BarAction icon="menu" label="Menu" />
            <BarAction icon="message-circle" label="Chat" />
            <Pressable style={({ pressed }) => [s.navMic, pressed && s.press]} accessibilityLabel="Micro">
              <Feather name="mic" size={36} color="#fff" />
            </Pressable>
            <BarAction hand label="Lever la main" />
            <BarAction icon="log-out" label="Quitter" danger onPress={() => router.back()} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ───────────────────────── Sous-composants ───────────────────────── */

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.li}>
      <Text style={s.liDot}>•</Text>
      <Text style={s.liTxt}>{children}</Text>
    </View>
  );
}

function ProfPip() {
  return (
    <View style={s.pip}>
      <ImageBackground source={PROF_PIP} style={s.pipImg} imageStyle={s.pipImgInner}>
        <LinearGradient colors={['rgba(0,0,0,0.1)', 'transparent', 'rgba(0,0,0,0.5)']} style={StyleSheet.absoluteFill} />
        <View style={s.pipBadge}>
          <View style={s.pipDot} />
          <Text style={s.pipTxt}>PROF</Text>
        </View>
      </ImageBackground>
    </View>
  );
}

function CircleCtrl({ icon, label }: { icon: FeatherName; label: string }) {
  return (
    <Pressable style={({ pressed }) => [s.circleCtrl, pressed && s.press]} accessibilityLabel={label}>
      <Feather name={icon} size={20} color="#fff" />
    </Pressable>
  );
}

function BarAction({
  icon,
  hand,
  label,
  danger = false,
  onPress,
}: {
  icon?: FeatherName;
  hand?: boolean;
  label: string;
  danger?: boolean;
  onPress?: () => void;
}) {
  const color = danger ? P.red500 : 'rgba(255,255,255,0.85)';
  return (
    <Pressable style={({ pressed }) => [s.barAction, pressed && s.press]} onPress={onPress}>
      <View style={s.barIcon}>
        {hand ? (
          <MaterialCommunityIcons name="hand-back-right" size={24} color={color} />
        ) : (
          <Feather name={icon as FeatherName} size={24} color={color} />
        )}
      </View>
      <Text style={[s.barLabel, danger && { color: P.red400 }]}>{label}</Text>
    </Pressable>
  );
}

function Speedometer() {
  return (
    <Svg width={80} height={64} viewBox="0 0 96 72">
      <Path d="M8 64 A40 40 0 0 1 80 20" stroke="rgba(139,92,246,0.3)" strokeWidth={3} strokeLinecap="round" fill="none" />
      <Path d="M8 64 A40 40 0 0 1 64 32" stroke="rgba(232,121,249,0.9)" strokeWidth={2.5} strokeLinecap="round" fill="none" />
      <Line x1={48} y1={64} x2={64} y2={32} stroke="rgba(255,255,255,0.8)" strokeWidth={2} />
      <Circle cx={48} cy={64} r={3} fill={P.violet400} />
    </Svg>
  );
}

/* ───────────────────────────── Styles ───────────────────────────── */

const SERIF = 'Georgia';

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.bg },
  safe: { flex: 1 },
  flex1: { flex: 1 },
  press: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  scrollContent: { paddingBottom: 16 },
  col: { width: '100%', maxWidth: 430, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8 },

  /* Header */
  header: { marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 999, backgroundColor: 'rgba(239,68,68,0.2)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.5)',
  },
  liveDot: { height: 6, width: 6, borderRadius: 3, backgroundColor: P.red500 },
  liveTxt: { color: P.red400, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  countBadge: { borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 10, paddingVertical: 4 },
  countTxt: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  profileBtn: {
    height: 40, width: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)',
  },

  /* Slide card */
  slideCard: { borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 16, ...sh(0.45, 16) },
  slideHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  slideHeadText: { flex: 1, paddingRight: 4 },
  slideHeadRight: { alignItems: 'flex-end', gap: 8 },
  chapterKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: 'rgba(167,139,250,0.9)' },
  slideTitle: { marginTop: 2, fontFamily: SERIF, fontSize: 22, fontWeight: '700', lineHeight: 26, color: '#f0e6ff' },

  slideBody: { marginTop: 4, gap: 12 },
  para: { fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.85)' },
  em: { fontStyle: 'italic' },
  strong: { fontWeight: '700', color: '#fff' },
  formula: {
    borderRadius: 12, borderWidth: 2, borderColor: 'rgba(139,92,246,0.5)', backgroundColor: 'rgba(46,16,101,0.4)',
    paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center',
  },
  formulaTxt: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5, color: P.violet200, textAlign: 'center' },
  formulaDim: { color: 'rgba(167,139,250,0.8)' },
  retainBox: { borderRadius: 16, borderWidth: 2, borderColor: 'rgba(16,185,129,0.5)', backgroundColor: 'rgba(2,44,34,0.25)', padding: 12 },
  retainLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: P.emerald300 },
  ul: { marginTop: 6, gap: 6 },
  li: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
  liDot: { color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 18 },
  liTxt: { flex: 1, fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.8)' },

  diagram: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 4 },
  sun: {
    height: 36, width: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.4)', backgroundColor: 'rgba(245,158,11,0.15)',
  },
  sunTxt: { fontSize: 12, fontWeight: '700', color: P.amber200 },
  dash: { flex: 1, height: 0, borderBottomWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.25)' },
  diagDot: { height: 8, width: 8, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(34,211,238,0.5)', backgroundColor: 'rgba(6,182,212,0.3)' },
  caption: { textAlign: 'center', fontSize: 10, fontWeight: '500', color: 'rgba(165,243,252,0.9)' },
  previewNote: { marginTop: 8, fontSize: 14, color: 'rgba(255,255,255,0.55)' },

  /* Plan */
  planWrap: { marginTop: 12 },
  planLabel: { marginBottom: 6, paddingHorizontal: 2, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: 'rgba(255,255,255,0.35)' },
  planRow: { gap: 10, paddingBottom: 8 },
  planItem: { minWidth: 66, alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 6, paddingTop: 8 },
  planItemActive: { borderColor: P.violet500, backgroundColor: 'rgba(139,92,246,0.15)', ...sh(0.2, 10) },
  planItemIdle: { borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)' },
  planNum: { height: 24, width: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  planNumActive: { backgroundColor: P.violet500 },
  planNumIdle: { backgroundColor: 'rgba(255,255,255,0.08)' },
  planNumTxt: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  planNumTxtActive: { color: '#fff' },
  planItemLabel: { marginTop: 6, width: '100%', textAlign: 'center', fontSize: 8, fontWeight: '500', lineHeight: 10 },
  planItemLabelActive: { color: P.violet200 },
  planItemLabelIdle: { color: 'rgba(255,255,255,0.5)' },
  planUnderline: { marginTop: 6, height: 2, width: 28, borderRadius: 1, backgroundColor: P.violet500 },

  /* Ma vidéo */
  videoSection: { marginTop: 8, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', padding: 16 },
  sectionH2: { fontSize: 18, fontWeight: '700', color: '#fff' },
  videoFrame: { marginTop: 12, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(139,92,246,0.6)', backgroundColor: P.slate900, overflow: 'hidden' },
  videoImg: { width: '100%', aspectRatio: 16 / 9, justifyContent: 'flex-start' },
  videoImgInner: { resizeMode: 'cover' },
  videoTopLeft: {
    position: 'absolute', left: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 6,
  },
  onBadge: { borderRadius: 6, backgroundColor: P.violet600, paddingHorizontal: 6, paddingVertical: 2 },
  onTxt: { fontSize: 10, fontWeight: '800', color: '#fff' },
  maximizeBtn: {
    position: 'absolute', right: 12, top: 12, height: 40, width: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)',
  },
  videoCtrls: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 20 },
  circleCtrl: {
    height: 48, width: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.5)',
  },
  bigRedBtn: { height: 48, width: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: P.red500, ...sh(0.3, 10) },
  pager: { marginTop: 12, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  pagerDot: { height: 6, width: 6, borderRadius: 3 },

  /* PiP */
  pip: { width: 100, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(139,92,246,0.5)', backgroundColor: 'rgba(15,23,42,0.95)', ...sh(0.45, 12) },
  pipImg: { width: '100%', aspectRatio: 16 / 9 },
  pipImgInner: { resizeMode: 'cover' },
  pipBadge: { position: 'absolute', left: 6, top: 6, flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.55)', paddingLeft: 2, paddingRight: 5, paddingVertical: 2 },
  pipDot: { height: 6, width: 6, borderRadius: 3, backgroundColor: P.red500 },
  pipTxt: { fontSize: 7, fontWeight: '800', letterSpacing: 0.5, color: '#fff' },

  /* Membres */
  membersSection: { marginTop: 16, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', padding: 16 },
  membersHead: { marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  onlineRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  onlineDot: { height: 8, width: 8, borderRadius: 4, backgroundColor: P.emerald400 },
  onlineTxt: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  seeAllBtn: { borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, paddingVertical: 8 },
  seeAllTxt: { fontSize: 14, color: '#fff' },
  membersRow: { gap: 16, paddingBottom: 4 },
  member: { minWidth: 66, alignItems: 'center' },
  avatarRing: { height: 56, width: 56, borderRadius: 28, padding: 2, alignItems: 'center', justifyContent: 'center' },
  avatarInner: { height: '100%', width: '100%', borderRadius: 28, backgroundColor: P.slate800 },
  avatarOnline: { position: 'absolute', bottom: 0, right: 0, height: 12, width: 12, borderRadius: 6, borderWidth: 2, borderColor: P.bg, backgroundColor: P.emerald400 },
  memberName: { marginTop: 8, fontSize: 12, color: '#fff', maxWidth: 66 },
  roleBadge: { marginTop: 4, borderRadius: 999, backgroundColor: P.violet600, paddingHorizontal: 8, paddingVertical: 2 },
  roleTxt: { fontSize: 10, fontWeight: '700', color: '#fff' },
  memberMore: { minWidth: 66, alignItems: 'center', justifyContent: 'center' },
  moreCircle: { height: 56, width: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)' },
  moreTxt: { color: P.violet400, fontSize: 13 },

  /* Chat / Questions */
  dualGrid: { marginTop: 16, flexDirection: 'row', gap: 12 },
  dualCard: { flex: 1, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', padding: 16 },
  dualHead: { marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dualTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  dualCount: { borderRadius: 999, backgroundColor: P.violet600, paddingHorizontal: 8, paddingVertical: 2 },
  dualCountTxt: { fontSize: 12, color: '#fff' },
  msgBox: { borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)', padding: 12 },
  msgName: { fontSize: 14, fontWeight: '600', color: P.violet400 },
  msgTxt: { marginTop: 4, fontSize: 14, color: 'rgba(255,255,255,0.8)' },

  /* Barre d'actions */
  navBar: {
    marginHorizontal: 16, marginBottom: 8, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: P.navBg, paddingHorizontal: 12, paddingVertical: 12,
  },
  navRow: { width: '100%', maxWidth: 400, alignSelf: 'center', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  navMic: {
    marginTop: -24, height: 72, width: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center',
    backgroundColor: P.violet600, borderWidth: 4, borderColor: P.navRing, ...sh(0.6, 24, P.violet600),
  },
  barAction: { flex: 1, maxWidth: 72, alignItems: 'center', justifyContent: 'flex-end', gap: 6, paddingVertical: 2 },
  barIcon: { height: 32, width: 32, alignItems: 'center', justifyContent: 'center' },
  barLabel: { fontSize: 9, fontWeight: '500', lineHeight: 11, textAlign: 'center', color: 'rgba(255,255,255,0.75)' },
});

/** Helper ombre. */
function sh(opacity: number, radius: number, color = '#000') {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation: 8,
  } as const;
}
