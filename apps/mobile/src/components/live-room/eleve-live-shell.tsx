import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
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

import GridBackground from '@/components/live-host/grid-background';
import ImmersiveSmartboard, { type SmartboardSlide } from '@/components/live-host/immersive-smartboard';

/**
 * Coque LIVE ÉLÈVE (vue immersive) — parité avec la régie hôte (HostShell) :
 * même `ImmersiveSmartboard` (sans fond), le flux vidéo du PROF dans la zone
 * caméra, et une barre d'actions élève (lever la main / chat / quitter).
 *
 * Web-safe (aucun import LiveKit) : la vidéo distante est passée via `cameraNode`
 * (un <VideoTrack> côté natif, un placeholder côté web). Le chat est piloté par
 * props (`chatMessages` / `onSendChat`) → branché au data channel « chat » côté
 * natif, local côté web.
 */
const P = { bg: '#0A0A0F', panel: 'rgba(255,255,255,0.05)', line: 'rgba(255,255,255,0.10)', violet: '#8B5CF6', live: '#EF4444', ink: '#FFFFFF', muted: '#9CA3AF' };

export interface ChatMessage {
  id: string;
  author: string;
  text: string;
  me?: boolean;
}

/** Slide d'exemple tant que la synchro hôte→élève (data channel) n'est pas branchée. */
export const SAMPLE_ELEVE_SLIDE: SmartboardSlide = {
  chapter: 'CHAPITRE 3',
  title: 'La vitesse de la lumière',
  cameraZone: 'top-right',
  blocks: [
    { type: 'key-idea', text: 'La lumière se déplace dans le vide à une vitesse constante notée c.' },
    { type: 'formula', label: 'VALEUR OFFICIELLE', text: 'c = 299 792 458 m/s' },
    { type: 'retain', items: ["La vitesse de la lumière est la plus grande vitesse de l'univers.", 'Elle est la même dans le vide pour tous les observateurs.'] },
  ],
};

export interface EleveLiveShellProps {
  title?: string;
  participantCount?: number;
  slide?: SmartboardSlide;
  /** Flux vidéo du prof (distant) — <VideoTrack> natif ou placeholder web. */
  cameraNode?: React.ReactNode;
  onLeave?: () => void;
  /** Messages du chat (reçus via data channel côté natif). */
  chatMessages?: ChatMessage[];
  /** Envoi d'un message (publie sur le data channel côté natif). */
  onSendChat?: (text: string) => void;
  /** Lever / baisser la main (peut publier un signal). */
  onToggleHand?: (raised: boolean) => void;
  /** Position dans le déroulé (lecture seule côté élève). */
  slideIndex?: number;
  slideTotal?: number;
  /** Modération reçue de l'hôte (canal `mod`) : micro forcé coupé. */
  micLocked?: boolean;
  /** Modération : salle verrouillée (info). */
  roomLocked?: boolean;
}

export default function EleveLiveShell({
  title = 'Session live',
  participantCount = 0,
  slide = SAMPLE_ELEVE_SLIDE,
  cameraNode,
  onLeave,
  chatMessages,
  onSendChat,
  onToggleHand,
  slideIndex = 1,
  slideTotal = 10,
  micLocked = false,
  roomLocked = false,
}: EleveLiveShellProps) {
  const [hand, setHand] = useState(false);
  const [micLocal, setMicLocal] = useState(false);
  // Micro forcé coupé par l'hôte → priorité sur l'état local.
  const micOn = micLocked ? false : micLocal;
  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState('');
  // Repli local quand le parent ne fournit pas de liste (preview web).
  const [localMsgs, setLocalMsgs] = useState<ChatMessage[]>([]);
  const msgs = chatMessages ?? localMsgs;
  const scrollRef = useRef<ScrollView>(null);
  const unread = useRef(0);
  const [badge, setBadge] = useState(0);

  useEffect(() => {
    if (chatOpen) {
      setBadge(0);
      unread.current = 0;
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } else if (msgs.length) {
      unread.current += 0; // compteur géré à la réception ci-dessous
    }
  }, [chatOpen, msgs.length]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    if (onSendChat) onSendChat(text);
    else setLocalMsgs((m) => [...m, { id: `${m.length}-${text.slice(0, 6)}`, author: 'Moi', text, me: true }]);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const toggleHand = () => {
    setHand((v) => {
      onToggleHand?.(!v);
      return !v;
    });
  };

  const toggleChat = () => setChatOpen((v) => !v);

  return (
    <View style={s.root}>
      {/* Fond TABLEAU à carreaux — parité immersive avec la régie hôte. */}
      <GridBackground />
      <SafeAreaView edges={['top']} style={s.safe}>
        {/* Top bar */}
        <View style={s.top}>
          <View style={s.liveBadge}><View style={s.liveDot} /><Text style={s.liveTxt}>EN DIRECT</Text></View>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          <View style={s.count}><Feather name="users" size={13} color={P.muted} /><Text style={s.countTxt}>{participantCount}</Text></View>
        </View>

        {/* Bannière modération (signal `mod` de l'hôte). */}
        {(micLocked || roomLocked) && (
          <View style={s.modBanner}>
            <Feather name={micLocked ? 'mic-off' : 'lock'} size={14} color={P.violet} />
            <Text style={s.modBannerTxt}>
              {micLocked ? "L'hôte a coupé les micros" : 'Salle verrouillée par l’hôte'}
            </Text>
          </View>
        )}

        {/* Scène immersive (smartboard sans fond + caméra prof dans la zone) */}
        <View style={s.stage}>
          <ImmersiveSmartboard slide={slide} cameraNode={cameraNode} />

          {/* Overlay chat (drawer flottant) */}
          {chatOpen && (
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={s.chatWrap}
              pointerEvents="box-none"
            >
              <View style={s.chat}>
                <View style={s.chatHead}>
                  <Feather name="message-circle" size={15} color={P.violet} />
                  <Text style={s.chatHeadTxt}>Chat du live</Text>
                  <Pressable onPress={toggleChat} hitSlop={8} style={s.chatClose}>
                    <Feather name="chevron-down" size={18} color={P.muted} />
                  </Pressable>
                </View>
                <ScrollView ref={scrollRef} style={s.chatList} contentContainerStyle={s.chatListContent}>
                  {msgs.length === 0 ? (
                    <Text style={s.chatEmpty}>Pose ta question au prof ✋</Text>
                  ) : (
                    msgs.map((m) => (
                      <View key={m.id} style={[s.msg, m.me && s.msgMe]}>
                        {!m.me && <Text style={s.msgAuthor}>{m.author}</Text>}
                        <Text style={[s.msgTxt, m.me && s.msgTxtMe]}>{m.text}</Text>
                      </View>
                    ))
                  )}
                </ScrollView>
                <View style={s.chatInputRow}>
                  <TextInput
                    style={s.chatInput}
                    placeholder="Message…"
                    placeholderTextColor={P.muted}
                    value={draft}
                    onChangeText={setDraft}
                    onSubmitEditing={send}
                    returnKeyType="send"
                  />
                  <Pressable style={({ pressed }) => [s.chatSend, pressed && s.pressed]} onPress={send}>
                    <Feather name="send" size={17} color="#fff" />
                  </Pressable>
                </View>
              </View>
            </KeyboardAvoidingView>
          )}
        </View>

        {/* Indicateur de slide (lecture seule) */}
        {!chatOpen && (
          <View style={s.slideIndicator}>
            <Text style={s.slideIndicatorTxt}>{slideIndex} / {slideTotal}</Text>
          </View>
        )}

        {/* Barre d'actions élève */}
        <SafeAreaView edges={['bottom']} style={s.bar}>
          <Action
            icon={micLocked ? 'mic-off' : micOn ? 'mic' : 'mic-off'}
            label={micLocked ? 'Coupé' : micOn ? 'Micro' : 'Muet'}
            active={micOn}
            accent={micLocked ? P.live : undefined}
            disabled={micLocked}
            onPress={() => !micLocked && setMicLocal((v) => !v)}
          />
          <Action icon="message-circle" label="Chat" active={chatOpen} badge={badge} onPress={toggleChat} />
          <Action icon="alert-circle" label="Lever la main" active={hand} accent={P.violet} onPress={toggleHand} />
          <Pressable style={({ pressed }) => [s.leave, pressed && s.pressed]} onPress={onLeave}>
            <Feather name="x" size={18} color="#fff" />
            <Text style={s.leaveTxt}>Quitter</Text>
          </Pressable>
        </SafeAreaView>
      </SafeAreaView>
    </View>
  );
}

function Action({ icon, label, active, accent, badge, disabled, onPress }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; active?: boolean; accent?: string; badge?: number; disabled?: boolean; onPress?: () => void }) {
  return (
    <Pressable style={({ pressed }) => [s.action, disabled && s.actionDisabled, pressed && !disabled && s.pressed]} onPress={onPress} disabled={disabled}>
      <View style={[s.actionCircle, active && { backgroundColor: accent ?? P.violet, borderColor: accent ?? P.violet }, disabled && { borderColor: accent ?? P.line }]}>
        <Feather name={icon} size={19} color={disabled ? accent ?? P.muted : active ? '#fff' : P.ink} />
        {!!badge && badge > 0 && (
          <View style={s.actionBadge}><Text style={s.actionBadgeTxt}>{badge > 9 ? '9+' : badge}</Text></View>
        )}
      </View>
      <Text style={s.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.bg },
  safe: { flex: 1 },
  pressed: { opacity: 0.7 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  modBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 14, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(139,92,246,0.15)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.4)' },
  modBannerTxt: { color: P.ink, fontSize: 13, fontWeight: '600', flex: 1 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: P.live, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveTxt: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  title: { color: P.ink, fontSize: 15, fontWeight: '700', flex: 1 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: P.panel, borderRadius: 13, paddingHorizontal: 9, paddingVertical: 5 },
  countTxt: { color: P.muted, fontSize: 12.5, fontWeight: '600' },
  stage: { flex: 1 },
  slideIndicator: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 8 },
  slideIndicatorTxt: { color: P.muted, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 16, paddingTop: 12 },
  action: { alignItems: 'center', gap: 4, width: 72 },
  actionCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: P.line, alignItems: 'center', justifyContent: 'center' },
  actionBadge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: P.live, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  actionBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  actionLabel: { color: P.muted, fontSize: 11, fontWeight: '600' },
  actionDisabled: { opacity: 0.55 },
  leave: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: P.live, borderRadius: 16, paddingVertical: 13, paddingHorizontal: 20 },
  leaveTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Chat overlay
  chatWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, justifyContent: 'flex-end' },
  chat: { margin: 10, maxHeight: '64%', backgroundColor: 'rgba(12,12,18,0.92)', borderRadius: 18, borderWidth: 1, borderColor: P.line, overflow: 'hidden' },
  chatHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: P.line },
  chatHeadTxt: { color: P.ink, fontSize: 14, fontWeight: '700', flex: 1 },
  chatClose: { padding: 2 },
  chatList: { paddingHorizontal: 12 },
  chatListContent: { paddingVertical: 10, gap: 8 },
  chatEmpty: { color: P.muted, fontSize: 13, textAlign: 'center', paddingVertical: 18 },
  msg: { alignSelf: 'flex-start', maxWidth: '82%', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  msgMe: { alignSelf: 'flex-end', backgroundColor: P.violet },
  msgAuthor: { color: P.violet, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  msgTxt: { color: P.ink, fontSize: 13.5, lineHeight: 18 },
  msgTxtMe: { color: '#fff' },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: P.line },
  chatInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: P.ink, fontSize: 14 },
  chatSend: { width: 42, height: 42, borderRadius: 21, backgroundColor: P.violet, alignItems: 'center', justifyContent: 'center' },
});
