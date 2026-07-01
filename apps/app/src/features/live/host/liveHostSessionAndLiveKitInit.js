/**
 * Chargement session Supabase + hydratation config + connexion LiveKit (événements room).
 * Appelé depuis LiveHostPage — isCancelled() doit retourner true au cleanup de l'effet React.
 */
import { supabase } from '@/lib/customSupabaseClient';
import { updateLiveSession } from '@/services/liveProduction/liveSession';
import { getLiveKitToken, createLiveRoom } from '@/services/livekitApi';
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  DisconnectReason,
} from 'livekit-client';
import { getStableLiveKitRoomOptions, stableLiveKitConnectOptions } from '@/lib/livekitStableClient';
import { registerLiveSessionParticipant } from '@/features/live/host/liveHostPersistence';
import { devLogLiveHostEnded, nt } from '@/features/live/host/liveHostUtils';
import { normalizeScriptSections } from '@/features/live/host/liveSmartboardLegacySlides';
import { LIRI_MOCK_SCRIPT_SECTIONS } from '@/lib/liriHostUiMocks';
import { normalizeLiveSceneToSlide, buildLiveScenesFromUploadedSlides } from '@/lib/liveSceneNormalize';
import { arenaLayoutForSessionType, normalizeArenaLayoutMode } from '@/lib/liriArenaLayout';
import { mergeSmartboardSceneFlags } from '@/lib/smartboardNavigatorScenes';
import { serializeGuestPermissions, GUEST_CAPABILITIES_DEFAULTS } from '@/hooks/useGuestCapabilities';
import { parseLangList } from '@/lib/liriMultilangApi';
import { playLiriHostEventChime } from '@/lib/liriHostEventChime';
import { describeLiveKitMediaError } from '@/lib/liveKitParticipantVideo';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Plusieurs tentatives : cold start Netlify / réseau transitoire.
 * @param {string} sessionId
 * @param {number} [attempts]
 */
async function getLiveKitTokenWithRetry(sessionId, attempts = 3) {
  let lastErr = /** @type {Error | null} */ (null);
  for (let i = 0; i < attempts; i += 1) {
    if (i > 0) {
      await new Promise((r) => {
        setTimeout(r, 400 * i);
      });
    }
    try {
      const data = await getLiveKitToken(sessionId);
      if (data?.token && data?.livekitUrl) return data;
      lastErr = new Error('Réponse LiveKit incomplète (token ou URL manquant).');
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr || new Error('Token LiveKit indisponible.');
}

/**
 * @param {object} ctx
 * @param {() => boolean} ctx.isCancelled
 */
export async function runLiveHostSessionAndLiveKitInit(ctx) {
  const {
    isCancelled,
    sessionId,
    user,
    startedAt,
    stepRef,
    roomRef,
    liveDisconnectTimerRef,
    pendingMeshRestoreRef,
    sharingScreenRef,
    isGuestUiRef,
    guestJoyKitDriveRef,
    guestResyncSmartboardFromDbRef,
    resyncSmartboardRef,
    arenaHostAlertSoundRef,
    hostSfxCtxRef,
    setPhase,
    setPhaseError,
    setLiveKitMediaAvailable,
    setLiriLiveKitDomFlag,
    setLiriLiveKitDomError,
    setSessionTitle,
    setStartedAt,
    setTeacherId,
    setSessionFormationId,
    setSessionType,
    setProductionLiveType,
    setLiveEtapes,
    setStep,
    setSmartboardSceneFlags,
    setSessionQuickIaFlags,
    setSessionCommFlags,
    setSessionGuestPermissions,
    setHostMultilang,
    setGuestMultilangConfig,
    setSharedImageGallery,
    setSharedImageLoop,
    setShopProducts,
    setProgressivePlayback,
    setAmbientTracks,
    applyLiriAudioFromConfig,
    setMeshGrantsByUserId,
    setLiveScenes,
    setPanels,
    setDebateArena,
    setGuestProctorModalOpen,
    setLiveKitMediaEpoch,
    setLiveKitScreenEpoch,
    setSharingScreen,
    setMicOn,
    setCameraOn,
    setArenaLayoutMode,
    arenaLayoutModeRef,
    toast,
    buildParticipantList,
  } = ctx;

  const markLiveKitMedia = (available) => {
    setLiveKitMediaAvailable?.(available);
  };

      try {
        setPhase(PHASE.LOADING);
        setPhaseError('');
        markLiveKitMedia(false);
        setLiriLiveKitDomFlag('off');
        setLiriLiveKitDomError('');

        // 1. Charger session + live_scenes
        const { data: sess, error: sessErr } = await supabase
          .from('live_sessions')
          .select(`
            id, title, teacher_id, formation_id, status, config, started_at, session_type, debate_id, production_live_type,
            slides:live_scenes(id, name, order_index, content_payload_json, is_active)
          `)
          .eq('id', sessionId)
          .maybeSingle();

        if (sessErr || !sess) throw new Error(sessErr?.message || 'Session introuvable.');
        if (isCancelled()) return;

        if (sess.status === 'ended' || sess.status === 'cancelled') {
          if (!isCancelled()) {
            devLogLiveHostEnded('init_session_already_ended', { dbStatus: sess.status }, sessionId);
            setPhase(PHASE.ENDED);
          }
          return;
        }

        if (sess.title) setSessionTitle(sess.title);
        if (sess.started_at) setStartedAt(sess.started_at);
        setTeacherId(sess.teacher_id ?? null);
        setSessionFormationId(sess.formation_id ?? null);
        setSessionType?.(sess.session_type ?? null);

        // Normaliser le config
        let cfg = {};
        try { cfg = typeof sess.config === 'string' ? JSON.parse(sess.config) : (sess.config || {}); } catch { /* ignore */ }

        // Type de production (ex. 'medos' = live santé → cockpit clinique embarqué).
        setProductionLiveType?.(cfg?.production_live_type ?? sess.production_live_type ?? null);

        // Affichage initial : config arène persistée sinon dérivé du type de live (Formation/Conférence/Débat).
        try {
          const initialArenaLayout = (typeof cfg.arena_layout_mode === 'string' && cfg.arena_layout_mode)
            ? normalizeArenaLayoutMode(cfg.arena_layout_mode)
            : arenaLayoutForSessionType(sess.session_type);
          if (initialArenaLayout && arenaLayoutModeRef) {
            arenaLayoutModeRef.current = initialArenaLayout;
            setArenaLayoutMode?.(initialArenaLayout);
          }
        } catch { /* ignore */ }

        // Script sections (MasterScript)
        const sections = cfg.smartboard_master_script_sections;
        if (Array.isArray(sections) && sections.length > 0) {
          setLiveEtapes(normalizeScriptSections(sections));
        } else {
          setLiveEtapes(normalizeScriptSections(LIRI_MOCK_SCRIPT_SECTIONS));
        }

        // Restaurer le step depuis DB config (si hôte recharge en cours de live)
        const savedStep = Number(cfg.current_step_index);
        if (Number.isFinite(savedStep) && savedStep > 0) {
          stepRef.current = savedStep;
          setStep(savedStep);
        }

        // Live MEDOS (santé) : PAS de smartboard Formation (deck IA/mindmaps, quiz) — le
        // partage clinique passe par le cockpit (jumeau 3D/examens/SOAP). On garde tableau
        // blanc + galerie image + partage d'écran + diapo importée.
        const isMedosLiveScenes = (cfg?.production_live_type ?? sess.production_live_type) === 'medos';
        setSmartboardSceneFlags(mergeSmartboardSceneFlags(
          isMedosLiveScenes
            ? { smartboard: false, quiz: false, browser: false, shop: false, embed: false, secure_app_share: false, camera2: false, board: true, image: true, screen: true, diapo: true }
            : cfg?.smartboard_scenes,
        ));
        setSessionQuickIaFlags({
          quiz_enabled: cfg.quiz_enabled === true,
          polls_enabled: cfg.polls_enabled === true,
          ai_summary_enabled: cfg.ai_summary_enabled === true,
          ai_mindmap_enabled: cfg.ai_mindmap_enabled === true,
          neuronq_enabled: cfg.neuronq_enabled !== false,
          neuro_recall_enabled: cfg.neuro_recall_enabled === true,
        });
        setSessionCommFlags({
          chat_enabled: cfg.chat_enabled !== false,
          hand_raise_enabled: cfg.hand_raise_enabled !== false,
          screen_share_enabled: cfg.screen_share_enabled !== false,
          student_audio_enabled: cfg.student_audio_enabled !== false,
          student_video_enabled: cfg.student_video_enabled !== false,
          guest_member_inspect_enabled: cfg.guest_member_inspect_enabled === true,
          proctoring_camera_consent_required: cfg.proctoring_camera_consent_required === true,
          host_remote_camera_enabled: cfg.host_remote_camera_enabled === true,
        });
        if (cfg.guest_permissions && typeof cfg.guest_permissions === 'object') {
          setSessionGuestPermissions({
            ...serializeGuestPermissions(GUEST_CAPABILITIES_DEFAULTS),
            ...cfg.guest_permissions,
          });
        }
        const ml = cfg.liri_multilang;
        if (ml && typeof ml === 'object') {
          const mlEnabled = ml.enabled === true;
          const mlSource = String(ml.source_lang || 'fr').slice(0, 12).toLowerCase();
          const mlTargets = Array.isArray(ml.target_langs)
            ? ml.target_langs.map((x) => String(x).toLowerCase().slice(0, 12)).filter(Boolean).slice(0, 12)
            : parseLangList(String(ml.target_langs || ''));
          const mlLangs = mlTargets.length ? mlTargets : ['en'];
          setHostMultilang({
            enabled: mlEnabled,
            sourceLang: mlSource,
            targetsStr: mlLangs.join(', '),
            guestBrowserTtsOffered: ml.guest_browser_tts_offered !== false,
            guestEdgeTtsOffered: ml.guest_edge_tts_offered === true,
            livekitInterpreterEnabled: ml.livekit_interpreter_enabled === true,
          });
          setGuestMultilangConfig({
            enabled: mlEnabled,
            sourceLang: mlSource,
            targetLangs: mlLangs,
            guest_browser_tts_offered: ml.guest_browser_tts_offered !== false,
            guest_edge_tts_offered: ml.guest_edge_tts_offered === true,
            livekit_interpreter_enabled: ml.livekit_interpreter_enabled === true,
          });
        } else {
          setHostMultilang({
            enabled: false,
            sourceLang: 'fr',
            targetsStr: 'en',
            guestBrowserTtsOffered: true,
            guestEdgeTtsOffered: false,
            livekitInterpreterEnabled: false,
          });
          setGuestMultilangConfig({
            enabled: false,
            sourceLang: 'fr',
            targetLangs: [],
            guest_browser_tts_offered: true,
            guest_edge_tts_offered: false,
            livekit_interpreter_enabled: false,
          });
        }
        if (Array.isArray(cfg?.smartboard_shared_images) && cfg.smartboard_shared_images.length > 0) {
          setSharedImageGallery(cfg.smartboard_shared_images);
        }
        setSharedImageLoop(cfg?.smartboard_shared_images_loop === true);
        if (Array.isArray(cfg?.smartboard_shop_products)) {
          setShopProducts(cfg.smartboard_shop_products);
        }
        if (typeof cfg.smartboard_progressive_playback === 'boolean') {
          setProgressivePlayback(cfg.smartboard_progressive_playback);
        }

        // Ambiance sonore — même logique qu'Arena (ambient_tracks JSON)
        if (Array.isArray(sess.ambient_tracks_json) && sess.ambient_tracks_json.length > 0) {
          setAmbientTracks(sess.ambient_tracks_json);
        } else if (Array.isArray(cfg?.ambient_tracks) && cfg.ambient_tracks.length > 0) {
          setAmbientTracks(cfg.ambient_tracks);
        } else if (typeof cfg?.ambient_tracks_json === 'string' && cfg.ambient_tracks_json) {
          try {
            const parsed = JSON.parse(cfg.ambient_tracks_json);
            if (Array.isArray(parsed)) setAmbientTracks(parsed);
          } catch {
            // ignore JSON parse error
          }
        } else {
          setAmbientTracks([]);
        }

        const inviteGuestPath = typeof window !== 'undefined' && sessionId && window.location.pathname === `/live/${sessionId}`;
        applyLiriAudioFromConfig(cfg, { devDemo: import.meta.env.DEV && !inviteGuestPath });

        // Control Mesh — restaurer grants encore valides (persistés dans config)
        if (!inviteGuestPath && Array.isArray(cfg.control_mesh?.grants) && cfg.control_mesh.grants.length > 0) {
          const nowMs = Date.now();
          const nextGrants = {};
          for (const g of cfg.control_mesh.grants) {
            const exp = Number(g.expiresAt);
            if (g.userId && exp > nowMs) {
              nextGrants[String(g.userId)] = {
                profileId: g.profileId || 'guest_speaker',
                name: typeof g.name === 'string' ? g.name : '',
                expiresAt: exp,
              };
            }
          }
          if (Object.keys(nextGrants).length) {
            pendingMeshRestoreRef.current = nextGrants;
            setMeshGrantsByUserId(nextGrants);
          }
        }

        // live_scenes : fetch DIRECT (l'embed `slides:live_scenes` de la requête
        // session ne revient pas via supabaseCompat → API NestJS, qui ne renvoie
        // pas les ressources embarquées Supabase). On lit donc la table directement.
        let sceneRows = Array.isArray(sess.slides) ? sess.slides : [];
        if (sceneRows.length === 0) {
          const { data: directScenes } = await supabase
            .from('live_scenes')
            .select('id, name, order_index, content_payload_json, is_active')
            .eq('live_session_id', sessionId)
            .order('order_index', { ascending: true });
          if (Array.isArray(directScenes) && directScenes.length > 0) sceneRows = directScenes;
        }

        // live_scenes + brouillon wizard + diapos importées (aligné LiveArena)
        let initialSlides = [];
        if (sceneRows.length > 0) {
          initialSlides = [...sceneRows].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        } else if (Array.isArray(cfg?.smartboard_element_scenes) && cfg.smartboard_element_scenes.length > 0) {
          initialSlides = [...cfg.smartboard_element_scenes].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        }
        const uploadedSlideScenes = buildLiveScenesFromUploadedSlides(cfg?.smartboard_slides);
        if (uploadedSlideScenes.length) {
          initialSlides = [...initialSlides, ...uploadedSlideScenes].sort(
            (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
          );
        }
        if (initialSlides.length > 0) {
          const normalized = initialSlides.map(normalizeLiveSceneToSlide).filter(Boolean);
          if (normalized.length > 0) setLiveScenes(normalized);
        }

        // Notif de connexion
        setPanels(prev => prev.map((p, i) => i === 2 ? {
          ...p,
          events: [...p.events, { avatar: 'Système', msg: `Session chargée — ${sess.title || sessionId}`, type: 'info', time: nt() }]
        } : p));

        // ── DebateCore : charger si debate_id présent ──────────────────────
        let debateParticipantRole = null;
        if (sess.debate_id) {
          const [{ data: deb }, { data: rws }, { data: mePart }] = await Promise.all([
            supabase.from('debates')
              .select('id,title,status,round_count,seconds_per_turn,moderator_id,neuronq_enabled,ai_judge_enabled,ai_weight,arena_current_round,arena_active_side,arena_turn_deadline')
              .eq('id', sess.debate_id).maybeSingle(),
            supabase.from('debate_rounds')
              .select('id,round_number,status,score_a,score_b,ai_score_a,ai_score_b,active_side,round_label,brief_public')
              .eq('debate_id', sess.debate_id).order('round_number', { ascending: true }),
            supabase.from('debate_participants').select('role,side')
              .eq('debate_id', sess.debate_id).eq('user_id', user?.id ?? '').maybeSingle(),
          ]);
          debateParticipantRole = mePart?.role ?? null;
          if (deb) {
            const rounds = rws || [];
            setDebateArena({
              debateId: deb.id, title: deb.title, status: deb.status,
              roundCount: deb.round_count, secondsPerTurn: deb.seconds_per_turn,
              neuronqEnabled: deb.neuronq_enabled !== false,
              aiJudgeEnabled: Boolean(deb.ai_judge_enabled),
              aiWeight: deb.ai_weight != null ? Number(deb.ai_weight) : 0.3,
              myRole: mePart?.role ?? null, mySide: mePart?.side ?? null,
              scoreA: rounds.reduce((s, r) => s + (Number(r.score_a) || 0), 0),
              scoreB: rounds.reduce((s, r) => s + (Number(r.score_b) || 0), 0),
              rounds,
              arenaCurrentRound: deb.arena_current_round ?? 1,
              arenaActiveSide: deb.arena_active_side ?? null,
              arenaTurnDeadline: deb.arena_turn_deadline ?? null,
            });
          }
        }

        const inviteGuestPathEarly =
          typeof window !== 'undefined' && sessionId && window.location.pathname === `/live/${sessionId}`;
        const isLiveHostUserEarly = Boolean(
          user?.id && sess.teacher_id != null && String(user.id) === String(sess.teacher_id),
        );
        const isGuestSessionEarly = inviteGuestPathEarly && !isLiveHostUserEarly;

        if (isGuestSessionEarly && !user?.id) {
          if (!isCancelled()) setPhase(PHASE.LOADING);
          return;
        }

        const proctorConsentRequired = cfg.proctoring_camera_consent_required === true;
        const skipProctorGate = debateParticipantRole === 'viewer';
        if (proctorConsentRequired && isGuestSessionEarly && !skipProctorGate && user?.id) {
          let consented = false;
          const { data: consentRow, error: consentErr } = await supabase
            .from('live_session_proctor_consents')
            .select('id')
            .eq('live_session_id', sessionId)
            .eq('user_id', user.id)
            .maybeSingle();
          if (!consentErr && consentRow) consented = true;
          if (!consented) {
            try {
              consented =
                typeof window !== 'undefined' &&
                localStorage.getItem(`liri-proctor-cam-${sessionId}-${user.id}`) === '1';
            } catch {
              /* ignore */
            }
          }
          if (!consented) {
            if (!isCancelled()) {
              setGuestProctorModalOpen(true);
              setPhase(PHASE.LOADING);
            }
            return;
          }
          if (consented && !consentRow) {
            try {
              await supabase.from('live_session_proctor_consents').upsert(
                {
                  live_session_id: sessionId,
                  user_id: user.id,
                  accepted_at: new Date().toISOString(),
                },
                { onConflict: 'live_session_id,user_id' },
              );
            } catch {
              /* ignore */
            }
          }
        }

        // 2. Provisionner la salle LiveKit si absente
        const hasRoom = Boolean(sess.video_room_id || sess.livekit_room_name);
        if (!hasRoom) {
          try { await createLiveRoom(sessionId); } catch (e) { console.warn('[LiveHost] createLiveRoom:', e?.message); }
        }

        // 3. Token LiveKit
        setPhase(PHASE.CONNECTING);
        let tokenFetchError = null;
        const tokenData = await getLiveKitTokenWithRetry(sessionId).catch((e) => {
          tokenFetchError = e;
          return null;
        });
        if (isCancelled()) return;

        if (!tokenData?.token || !tokenData?.livekitUrl) {
          // Erreur API (403 attente, non autorisé, session pas « live », etc.) — afficher le message au lieu d'un échec silencieux
          if (tokenFetchError?.message) {
            setPhaseError(tokenFetchError.message);
          }
          // Pas de token LiveKit → mode sans vidéo, UI fonctionnelle quand même
          markLiveKitMedia(false);
          setLiriLiveKitDomFlag('off');
          setLiriLiveKitDomError(tokenFetchError?.message || 'Pas de token LiveKit');
          setPhase(PHASE.LIVE);
          if (sessionId) {
            await registerLiveSessionParticipant(supabase, sessionId, user?.id, sess.teacher_id,
              typeof window !== 'undefined' && window.location.pathname.startsWith('/live/host/'));
            const now = new Date().toISOString();
            updateLiveSession(sessionId, { status: 'live', started_at: now })
              .then(({ data }) => { if (data?.started_at) setStartedAt(data.started_at); })
              .catch(() => {});
          }
          return;
        }

        // Avant `room.connect` : persister `live_session_participants` pour que la RLS des apartés
        // (`live_session_private_messages`) soit satisfaite avant que l'hôte ne voie le peer distant
        // (sinon course : ParticipantConnected côté formateur vs Connected + upsert côté invité).
        if (sessionId && user?.id) {
          await registerLiveSessionParticipant(supabase, sessionId, user?.id, sess.teacher_id);
        }

        // 3. Connexion LiveKit
        if (roomRef.current) {
          try { await roomRef.current.disconnect(); } catch { /* ignore */ }
          roomRef.current = null;
        }

        // Pas de résolution vidéo imposée (ex. 720p) : sur certaines webcams / OS cela provoque
        // OverconstrainedError et la caméra ne démarre jamais pour l'hôte ni l'invité.
        const room = new Room(getStableLiveKitRoomOptions({
          adaptiveStream: true,
          dynacast: true,
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        }));
        roomRef.current = room;

        room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
          if (isCancelled() || !room.localParticipant) return;
          const isLocal = participant.identity === room.localParticipant.identity;
          if (track.source === Track.Source.Microphone && !isLocal) {
            const audioEl = track.attach();
            audioEl.style.display = 'none';
            audioEl.dataset.lkAudio = '1';
            document.body.appendChild(audioEl);
          }
          if (track.source === Track.Source.Camera) {
            setLiveKitMediaEpoch((e) => e + 1);
          }
          if (track.source === Track.Source.ScreenShare && !isLocal) {
            setLiveKitScreenEpoch((e) => e + 1);
          }
          buildParticipantList(room);
        });
        room.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
          if (isCancelled()) return;
          try {
            const els = track.detach();
            els.forEach((el) => { try { el.remove(); } catch { /* ignore */ } });
          } catch { /* ignore */ }
          if (track.source === Track.Source.Camera) {
            setLiveKitMediaEpoch((e) => e + 1);
          }
          const isLocal = participant && room.localParticipant
            && participant.identity === room.localParticipant.identity;
          if (track.source === Track.Source.ScreenShare && !isLocal) {
            setLiveKitScreenEpoch((e) => e + 1);
          }
        });

        room.on(RoomEvent.Connected, async () => {
          clearTimeout(liveDisconnectTimerRef.current);
          liveDisconnectTimerRef.current = null;
          if (!isCancelled()) {
            setPhase(PHASE.LIVE);
            setLiriLiveKitDomFlag('connected');
            setLiriLiveKitDomError('');
            markLiveKitMedia(true);
            buildParticipantList(room);
            try {
              room.startAudio?.().catch(() => {});
            } catch { /* ignore */ }
            setPanels(prev => prev.map((p, i) => i === 2 ? {
              ...p,
              events: [...p.events, { avatar: 'LiveKit', msg: 'Salle vidéo connectée', type: 'join', time: nt() }]
            } : p));
            // Marquer la session comme live + définir started_at si pas encore fait
            // Attendre l'upsert participant : sinon RLS sur live_session_private_messages refuse l'aparté hôte→invité.
            if (sessionId) {
              await registerLiveSessionParticipant(supabase, sessionId, user?.id, sess.teacher_id,
              typeof window !== 'undefined' && window.location.pathname.startsWith('/live/host/'));
              const now = new Date().toISOString();
              updateLiveSession(sessionId, { status: 'live', started_at: now })
                .then(({ data }) => { if (data?.started_at && !startedAt) setStartedAt(data.started_at); })
                .catch(() => {});
            }
          }
        });

        room.on(RoomEvent.ParticipantConnected, (p) => {
          if (!isCancelled()) {
            buildParticipantList(room);
            const name = p.name || p.identity || 'Participant';
            setPanels(prev => prev.map((panel, i) => i === 2 ? {
              ...panel,
              events: [...panel.events, { avatar: name, msg: `${name} a rejoint la salle`, type: 'join', time: nt() }]
            } : panel));
            if (arenaHostAlertSoundRef.current) playLiriHostEventChime(hostSfxCtxRef.current, 'join');
          }
        });

        room.on(RoomEvent.ParticipantDisconnected, (p) => {
          if (!isCancelled()) {
            buildParticipantList(room);
            const name = p.name || p.identity || 'Participant';
            setPanels(prev => prev.map((panel, i) => i === 2 ? {
              ...panel,
              events: [...panel.events, { avatar: name, msg: `${name} a quitté la salle`, type: 'leave', time: nt() }]
            } : panel));
            if (arenaHostAlertSoundRef.current) playLiriHostEventChime(hostSfxCtxRef.current, 'leave');
          }
        });

        room.on(RoomEvent.Reconnected, () => {
          clearTimeout(liveDisconnectTimerRef.current);
          liveDisconnectTimerRef.current = null;
          setLiveKitScreenEpoch((e) => e + 1);
          queueMicrotask(() => {
            if (isGuestUiRef.current && !guestJoyKitDriveRef.current) {
              guestResyncSmartboardFromDbRef.current?.();
            } else {
              resyncSmartboardRef.current?.();
            }
          });
        });

        room.on(RoomEvent.LocalTrackPublished, (pub) => {
          if (pub.source === Track.Source.Camera) {
            setLiveKitMediaEpoch((e) => e + 1);
            return;
          }
          if (pub.source !== Track.Source.ScreenShare) return;
          sharingScreenRef.current = true;
          setSharingScreen(true);
          setLiveKitScreenEpoch((e) => e + 1);
          queueMicrotask(() => resyncSmartboardRef.current?.());
        });
        room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
          if (pub.source === Track.Source.Camera) {
            setLiveKitMediaEpoch((e) => e + 1);
            return;
          }
          if (pub.source !== Track.Source.ScreenShare) return;
          sharingScreenRef.current = false;
          setSharingScreen(false);
          queueMicrotask(() => resyncSmartboardRef.current?.());
        });

        room.on(RoomEvent.Disconnected, (reason) => {
          if (isCancelled()) return;
          clearTimeout(liveDisconnectTimerRef.current);
          liveDisconnectTimerRef.current = null;
          // Ne plus forcer PHASE.ENDED après une coupure : le timer (8s puis 90s) faisait
          // terminer le live ~1–2 min après un simple glitch réseau alors que LiveKit peut se reconnecter.
          // Fin de session : bouton STOP, statut DB ended/cancelled, ou flux invité realtime.
          if (reason === DisconnectReason.CLIENT_INITIATED) {
            return;
          }
          setPanels((prev) => prev.map((p, i) => (i === 2 ? {
            ...p,
            events: [...p.events, {
              avatar: 'LiveKit',
              msg: 'Connexion vidéo interrompue — reconnexion automatique si possible. Si le flux ne revient pas, rechargez la page.',
              type: 'info',
              time: nt(),
            }],
          } : p)));
        });

        room.on(RoomEvent.ConnectionStateChanged, (state) => {
          if (state === ConnectionState.Reconnecting) {
            // brief reconnect — will be cleared by Reconnected event
          }
        });

        {
          for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
              if (attempt > 0) {
                await new Promise((r) => setTimeout(r, 1800));
              }
              await room.connect(tokenData.livekitUrl, tokenData.token, stableLiveKitConnectOptions);
              break;
            } catch (e) {
              if (attempt === 1) throw e;
              try {
                console.warn('[LiveHost] room.connect tentative', attempt + 1, e?.message || e);
              } catch {
                /* ignore */
              }
            }
          }
        }
        if (!isCancelled()) {
          markLiveKitMedia(true);
          const inviteGuestPath =
            typeof window !== 'undefined' && sessionId && window.location.pathname === `/live/${sessionId}`;
          const isLiveHostUser = Boolean(
            user?.id && sess.teacher_id != null && String(user.id) === String(sess.teacher_id),
          );
          const isGuestSession = inviteGuestPath && !isLiveHostUser;

          if (isGuestSession) {
            // Aligné LiveArena : spectateur débat (canPublish=false) → pas de capture locale ; sinon respecter la config salle.
            if (debateParticipantRole === 'viewer') {
              try {
                await room.localParticipant.setMicrophoneEnabled(false);
                await room.localParticipant.setCameraEnabled(false);
              } catch { /* ignore */ }
              setMicOn(false);
              setCameraOn(false);
            } else {
              try {
                await room.localParticipant.enableCameraAndMicrophone();
                if (!isCancelled()) {
                  if (cfg.student_audio_enabled === false) {
                    await room.localParticipant.setMicrophoneEnabled(false).catch(() => {});
                    setMicOn(false);
                  } else {
                    setMicOn(true);
                  }
                  if (cfg.student_video_enabled === false) {
                    await room.localParticipant.setCameraEnabled(false).catch(() => {});
                    setCameraOn(false);
                  } else {
                    setCameraOn(true);
                  }
                  setLiveKitMediaEpoch((e) => e + 1);
                }
              } catch (camErr) {
                console.warn('[LiveHost] Caméra/micro (invité):', camErr?.message);
                if (!isCancelled()) {
                  setMicOn(false);
                  setCameraOn(false);
                  toast({
                    title: 'Caméra / micro (invité)',
                    description: describeLiveKitMediaError(camErr),
                    variant: 'destructive',
                  });
                }
              }
            }
          } else {
            try {
              await room.localParticipant.enableCameraAndMicrophone();
              if (!isCancelled()) {
                setMicOn(true);
                setCameraOn(true);
                setLiveKitMediaEpoch((e) => e + 1);
              }
            } catch (camErr) {
              console.warn('[LiveHost] Caméra/micro:', camErr?.message);
              if (!isCancelled()) {
                setMicOn(false);
                setCameraOn(false);
                toast({
                  title: 'Caméra / micro',
                  description: describeLiveKitMediaError(camErr),
                  variant: 'destructive',
                });
              }
            }
          }
        }
      } catch (err) {
        if (!isCancelled()) {
          const em = err?.message || 'Erreur de connexion';
          setPhaseError(em);
          const roomOk = roomRef.current?.state === ConnectionState.Connected;
          if (roomOk) {
            markLiveKitMedia(true);
            setLiriLiveKitDomFlag('connected');
            setLiriLiveKitDomError(em);
          } else {
            markLiveKitMedia(false);
            setLiriLiveKitDomFlag('off');
            setLiriLiveKitDomError(em);
          }
          setPhase(PHASE.LIVE); // Degrade gracefully — show UI without LiveKit
        }
      }
}
