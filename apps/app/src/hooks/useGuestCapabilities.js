/**
 * useGuestCapabilities
 * --------------------
 * Lit live_sessions.config.guest_permissions et renvoie un objet plat de
 * capacités pour l'invité (élève) dans une salle de classe virtuelle LIRI.
 *
 * Design :
 *   - Matrice de capacités, PAS de rôles. Un invité promu modérateur verra
 *     ses capacités évoluer côté serveur → realtime → UI sans reload.
 *   - Fallback DEFAULTS : si la colonne n'a pas encore été migrée ou si un
 *     champ manque, on applique des valeurs raisonnables pour une classe.
 *   - Le hook écoute les changements en temps réel (postgres_changes) et
 *     met à jour les capacités instantanément lorsque le prof coche/décoche
 *     un toggle dans LiveStudioSettingsPanel → Permissions élèves.
 *
 * Usage :
 *   const caps = useGuestCapabilities(sessionId, { enabled: isGuestUi });
 *   if (caps.canRaiseHand) { ... }
 *
 *   // Raccourcis hôte : si la session est hostée par l'utilisateur courant,
 *   // toutes les capacités sont true. On laisse le composant consommateur
 *   // gérer ce cas — ce hook reste strict "invité".
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Valeurs par défaut alignées sur la migration 202604221400.
 * On duplique ici (et PAS seulement côté SQL) pour que le composant soit
 * robuste même si la session a été créée avant la migration.
 */
export const GUEST_CAPABILITIES_DEFAULTS = Object.freeze({
  canRaiseHand: true,
  canReactEmoji: true,
  canChatPublic: true,
  canWhisperTeacher: true,
  canChatPeer: false,
  canRequestSpeak: true,
  canRequestScreenshare: false,
  canAnnotateWhiteboard: false,
  canUseVideoBlur: true,
  canUseAiCoach: true,
  canUseNeuronq: true,
  showMembersGrid: true,
  canExportNotes: true,
  canSendNotesToTeacher: true,
  /** Afficher le panneau « Cahier de notes » (saisie + captures). */
  canUsePersonalNotes: true,
  requireProctorConsent: false,
});

/** Normalise le shape snake_case (DB) → camelCase (JS). */
function normalizeGuestPermissions(raw) {
  const src = (raw && typeof raw === 'object') ? raw : {};
  return {
    canRaiseHand:          pickBool(src.can_raise_hand,          GUEST_CAPABILITIES_DEFAULTS.canRaiseHand),
    canReactEmoji:         pickBool(src.can_react_emoji,         GUEST_CAPABILITIES_DEFAULTS.canReactEmoji),
    canChatPublic:         pickBool(src.can_chat_public,         GUEST_CAPABILITIES_DEFAULTS.canChatPublic),
    canWhisperTeacher:     pickBool(src.can_whisper_teacher,     GUEST_CAPABILITIES_DEFAULTS.canWhisperTeacher),
    canChatPeer:           pickBool(src.can_chat_peer,           GUEST_CAPABILITIES_DEFAULTS.canChatPeer),
    canRequestSpeak:       pickBool(src.can_request_speak,       GUEST_CAPABILITIES_DEFAULTS.canRequestSpeak),
    canRequestScreenshare: pickBool(src.can_request_screenshare, GUEST_CAPABILITIES_DEFAULTS.canRequestScreenshare),
    canAnnotateWhiteboard: pickBool(src.can_annotate_whiteboard, GUEST_CAPABILITIES_DEFAULTS.canAnnotateWhiteboard),
    canUseVideoBlur:       pickBool(src.can_use_video_blur,      GUEST_CAPABILITIES_DEFAULTS.canUseVideoBlur),
    canUseAiCoach:         pickBool(src.can_use_ai_coach,        GUEST_CAPABILITIES_DEFAULTS.canUseAiCoach),
    canUseNeuronq:         pickBool(src.can_use_neuronq,         GUEST_CAPABILITIES_DEFAULTS.canUseNeuronq),
    showMembersGrid:       pickBool(src.show_members_grid,       GUEST_CAPABILITIES_DEFAULTS.showMembersGrid),
    canExportNotes:        pickBool(src.can_export_notes,        GUEST_CAPABILITIES_DEFAULTS.canExportNotes),
    canSendNotesToTeacher: pickBool(src.can_send_notes_to_teacher, GUEST_CAPABILITIES_DEFAULTS.canSendNotesToTeacher),
    canUsePersonalNotes: pickBool(src.can_use_personal_notes, GUEST_CAPABILITIES_DEFAULTS.canUsePersonalNotes),
    requireProctorConsent: pickBool(src.require_proctor_consent, GUEST_CAPABILITIES_DEFAULTS.requireProctorConsent),
  };
}

function pickBool(value, fallback) {
  if (value === true || value === false) return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

/** Shape inverse camelCase → snake_case (pour écrire depuis le panel hôte). */
export function serializeGuestPermissions(caps) {
  const c = (caps && typeof caps === 'object') ? caps : {};
  return {
    can_raise_hand:          !!c.canRaiseHand,
    can_react_emoji:         !!c.canReactEmoji,
    can_chat_public:         !!c.canChatPublic,
    can_whisper_teacher:     !!c.canWhisperTeacher,
    can_chat_peer:           !!c.canChatPeer,
    can_request_speak:       !!c.canRequestSpeak,
    can_request_screenshare: !!c.canRequestScreenshare,
    can_annotate_whiteboard: !!c.canAnnotateWhiteboard,
    can_use_video_blur:      !!c.canUseVideoBlur,
    can_use_ai_coach:        !!c.canUseAiCoach,
    can_use_neuronq:         !!c.canUseNeuronq,
    show_members_grid:       !!c.showMembersGrid,
    can_export_notes:        !!c.canExportNotes,
    can_send_notes_to_teacher: !!c.canSendNotesToTeacher,
    can_use_personal_notes: !!c.canUsePersonalNotes,
    require_proctor_consent: !!c.requireProctorConsent,
  };
}

/**
 * Hook principal.
 * @param {string|null|undefined} sessionId
 * @param {object} [opts]
 * @param {boolean} [opts.enabled=true] — désactive complètement le hook (ex. hôte)
 * @returns {{
 *   caps: typeof GUEST_CAPABILITIES_DEFAULTS,
 *   loading: boolean,
 *   error: Error|null,
 *   refetch: () => Promise<void>,
 * }}
 */
export function useGuestCapabilities(sessionId, opts = {}) {
  const { enabled = true } = opts;
  const [caps, setCaps] = useState(GUEST_CAPABILITIES_DEFAULTS);
  const [loading, setLoading] = useState(Boolean(enabled && sessionId));
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  // Fetch initial
  const fetchOnce = useMemo(() => async () => {
    if (!enabled || !sessionId) {
      setCaps(GUEST_CAPABILITIES_DEFAULTS);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('live_sessions')
        .select('config')
        .eq('id', sessionId)
        .maybeSingle();
      if (err) throw err;
      const raw = data?.config?.guest_permissions;
      if (mountedRef.current) {
        setCaps(normalizeGuestPermissions(raw));
        setError(null);
      }
    } catch (e) {
      if (mountedRef.current) setError(e);
      // On garde les defaults — classe virtuelle reste utilisable même offline
      console.warn('[useGuestCapabilities] fetch failed', e?.message || e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [enabled, sessionId]);

  useEffect(() => {
    void fetchOnce();
  }, [fetchOnce]);

  // Realtime : écoute les UPDATE sur live_sessions pour cette session
  useEffect(() => {
    if (!enabled || !sessionId) return undefined;
    // Nom de canal UNIQUE par montage : évite de réutiliser un canal déjà `subscribe()`
    // (le hook peut être monté 2× — LiveGuestPage + LiveHostPage — et un même topic réutilisé
    // ferait crasher « cannot add postgres_changes callbacks after subscribe() »).
    const channel = supabase
      .channel(`guest-caps:${sessionId}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          const raw = payload?.new?.config?.guest_permissions;
          if (mountedRef.current) setCaps(normalizeGuestPermissions(raw));
        },
      )
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch { /* noop */ }
    };
  }, [enabled, sessionId]);

  return { caps, loading, error, refetch: fetchOnce };
}

export default useGuestCapabilities;
