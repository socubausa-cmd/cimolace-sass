import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import {
  labelForAppointmentType,
  mapAppointmentTypeToLiveSessionType,
  appointmentNeedsStudioPrep,
  studioPreparationPath,
} from '@/lib/agendaEventModel';
import { seedLiveScriptSectionsFromWizard } from '@/lib/seedLiveScriptFromConfig';
import { generateLiveJoinCodeRaw } from '@/lib/liveJoinCode';
import { resolveCimolaceTenantIdForInsert } from '@/lib/tenant/fetchTenantContext';

const isSchemaMismatchError = (error) => {
  const msg = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '');
  return code === '42703' || msg.includes('column') || msg.includes('does not exist');
};

/** Chaîne Supabase : .select() doit précéder .eq() / .order() sur une lecture. */
const fetchTeacherLiveSessions = (teacherId, selectColumns) =>
  supabase
    .from('live_sessions')
    .select(selectColumns)
    .eq('teacher_id', teacherId)
    .gte('scheduled_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(200);

const LIVE_SELECT_FULL =
  'id, title, session_type, scheduled_at, status, video_room_url, visibility_mode, duration_minutes, preparation_status, production_live_type, appointment_id, teacher_id, cimolace_tenant_id';
const LIVE_SELECT_MIN = 'id, title, session_type, scheduled_at, status, video_room_url, visibility_mode, teacher_id';

export function useTeacherAppointments(teacherId) {
  const [appointments, setAppointments] = useState([]);
  const [liveSessions, setLiveSessions] = useState([]);
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [hostProfile, setHostProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!teacherId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [apptRes, availRes, hostRes] = await Promise.all([
        supabase
          .from('appointments')
          .select(
            'id, student_id, teacher_id, type, scheduled_at, status, video_meeting_url, duration_minutes, live_session_id, notes'
          )
          .eq('teacher_id', teacherId)
          .gte('scheduled_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('scheduled_at', { ascending: true })
          .limit(200),
        supabase.from('availability_slots').select('*').eq('user_id', teacherId),
        supabase.from('profiles').select('id, name, email').eq('id', teacherId).maybeSingle(),
      ]);

      let liveRes = await fetchTeacherLiveSessions(teacherId, LIVE_SELECT_FULL);
      if (liveRes.error && isSchemaMismatchError(liveRes.error)) {
        liveRes = await fetchTeacherLiveSessions(teacherId, LIVE_SELECT_MIN);
      }

      // Défensif : l'API peut renvoyer une enveloppe { data: [...] } — on garantit des tableaux.
      const asArray = (v) => (Array.isArray(v) ? v : (Array.isArray(v?.data) ? v.data : []));
      const appts = apptRes.error ? [] : asArray(apptRes.data);
      const lives = liveRes.error
        ? []
        : asArray(liveRes.data).map((l) => ({
            ...l,
            video_room_url: l.video_room_url || null,
            visibility_mode: l.visibility_mode || 'secret',
            duration_minutes: l.duration_minutes ?? null,
            preparation_status: l.preparation_status || 'draft',
          }));
      const slots = availRes.error ? [] : asArray(availRes.data);

      const studentIds = [...new Set(appts.map((a) => a.student_id))];
      const { data: profiles } = studentIds.length
        ? await supabase.from('profiles').select('id, name, email').in('id', studentIds)
        : { data: [] };
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

      setHostProfile(hostRes.data || null);
      setAppointments(appts.map((a) => ({ ...a, student: profileMap[a.student_id] })));
      setLiveSessions(lives);
      setAvailabilitySlots(slots);
    } catch (e) {
      setError(e);
      setAppointments([]);
      setLiveSessions([]);
      setAvailabilitySlots([]);
      setHostProfile(null);
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const liveById = useMemo(
    () => Object.fromEntries((liveSessions || []).map((l) => [l.id, l])),
    [liveSessions]
  );

  const agendaEvents = useMemo(() => {
    const hostName = hostProfile?.name || hostProfile?.email;
    const ap = appointments
      .filter((a) => !['cancelled'].includes(a.status))
      .map((a) => {
        const linked = a.live_session_id ? liveById[a.live_session_id] : null;
        return {
          key: `appt-${a.id}`,
          id: a.id,
          source: 'appointments',
          title: `${a.type} — ${a.student?.name || 'Élève'}`,
          scheduled_at: a.scheduled_at,
          status: a.status,
          video_url: a.video_meeting_url,
          student: a.student,
          duration_minutes: a.duration_minutes,
          teacher_id: a.teacher_id,
          appointment_type: a.type,
          live_session_id: a.live_session_id,
          notes: a.notes,
          studioPrepPath: studioPreparationPath({
            source: 'appointments',
            id: a.id,
            live_session_id: a.live_session_id,
          }),
          studioRecommended: appointmentNeedsStudioPrep(a.type),
          displayType: labelForAppointmentType(a.type),
          hostName,
          linked_preparation_status: linked?.preparation_status,
          preparation_status: null,
        };
      });

    const lv = liveSessions
      .filter((l) => l.status !== 'cancelled')
      .map((l) => ({
        key: `live-${l.id}`,
        id: l.id,
        source: 'live_sessions',
        title: l.title,
        scheduled_at: l.scheduled_at,
        status: l.status,
        video_url: l.video_room_url,
        duration_minutes: l.duration_minutes,
        teacher_id: l.teacher_id,
        session_type: l.session_type,
        production_live_type: l.production_live_type,
        preparation_status: l.preparation_status || 'draft',
        appointment_id: l.appointment_id,
        studioPrepPath: studioPreparationPath({ source: 'live_sessions', id: l.id }),
        studioRecommended: true,
        hostName,
        student: null,
      }));

    return [...ap, ...lv].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  }, [appointments, liveSessions, liveById, hostProfile]);

  const ensureStudioForAppointment = useCallback(
    async (appointmentId) => {
      const appt = appointments.find((x) => x.id === appointmentId);
      if (!appt?.teacher_id) return { error: new Error('Rendez-vous introuvable'), sessionId: null };
      if (appt.live_session_id) return { error: null, sessionId: appt.live_session_id };

      const sessionType = mapAppointmentTypeToLiveSessionType(appt.type);
      const title = `${labelForAppointmentType(appt.type)} — ${appt.student?.name || 'Élève'}`;
      const tenantId = await resolveCimolaceTenantIdForInsert();
      const studioRow = {
        appointment_id: appt.id,
        teacher_id: appt.teacher_id,
        title,
        session_type: sessionType,
        scheduled_at: appt.scheduled_at,
        duration_minutes: appt.duration_minutes || 30,
        status: 'scheduled',
        visibility_mode: 'secret',
        config: {},
        ...(tenantId ? { cimolace_tenant_id: tenantId } : {}),
      };
      let insRes = await supabase.from('live_sessions').insert(studioRow).select('id').single();
      if (insRes.error && isSchemaMismatchError(insRes.error)) {
        const { cimolace_tenant_id: _t, ...legacy } = studioRow;
        insRes = await supabase.from('live_sessions').insert(legacy).select('id').single();
      }
      const { data: ins, error } = insRes;
      if (error) return { error, sessionId: null };

      const { error: uerr } = await supabase
        .from('appointments')
        .update({ live_session_id: ins.id })
        .eq('id', appt.id);
      if (uerr) return { error: uerr, sessionId: null };

      await supabase.from('live_session_participants').upsert(
        {
          live_session_id: ins.id,
          user_id: appt.student_id,
          role: 'student',
        },
        { onConflict: 'live_session_id,user_id', ignoreDuplicates: true }
      );

      await refresh();
      return { error: null, sessionId: ins.id };
    },
    [appointments, refresh]
  );

  const createLiveSession = useCallback(
    async (data) => {
      const effectiveTeacherId = data.teacher_id ?? teacherId;
      if (!effectiveTeacherId) {
        return { error: new Error('Sélectionnez un enseignant ou reconnectez-vous.') };
      }
      const cfg = data.config && typeof data.config === 'object' ? data.config : {};
      const cover_image_url = data.cover_image_url ?? cfg.cover_image_url ?? null;
      const duration_minutes = data.duration_minutes ?? cfg.duration_minutes ?? 60;
      let ambient_tracks_json = data.ambient_tracks_json;
      if (!Array.isArray(ambient_tracks_json)) {
        if (Array.isArray(cfg.ambient_tracks)) ambient_tracks_json = cfg.ambient_tracks;
        else if (typeof cfg.ambient_tracks_json === 'string' && cfg.ambient_tracks_json) {
          try {
            ambient_tracks_json = JSON.parse(cfg.ambient_tracks_json);
          } catch {
            ambient_tracks_json = [];
          }
        } else {
          ambient_tracks_json = [];
        }
      }
      if (!Array.isArray(ambient_tracks_json)) ambient_tracks_json = [];

      const startImmediately = data.start_immediately === true;
      const scheduledAt = startImmediately ? new Date().toISOString() : data.scheduled_at;
      const nowIso = new Date().toISOString();
      const explicitTenant =
        (typeof data.cimolace_tenant_id === 'string' && data.cimolace_tenant_id) ||
        (typeof data.cimolaceTenantId === 'string' && data.cimolaceTenantId) ||
        null;
      const resolvedTenantId = explicitTenant || (await resolveCimolaceTenantIdForInsert());

      // ── Type « Débat » : créer le débat (debates + rounds + participant modérateur) ──────
      // et l'attacher au live via debate_id. Le runtime (bandeau/panel) le charge ensuite.
      let debateId = (typeof data.debate_id === 'string' && data.debate_id) ? data.debate_id : null;
      if (!debateId && data.session_type === 'debate') {
        const roundCount = Math.min(50, Math.max(1, parseInt(data.debate_round_count, 10) || 3));
        const secondsPerTurn = Math.min(7200, Math.max(30, parseInt(data.debate_seconds_per_turn, 10) || 300));
        const { data: deb, error: debErr } = await supabase
          .from('debates')
          .insert({
            title: data.title,
            topic: data.title,
            description: data.description || null,
            scheduled_at: scheduledAt,
            round_count: roundCount,
            seconds_per_turn: secondsPerTurn,
            access_mode: 'private',
            vote_type: 'per_round_ab',
            neuronq_enabled: true,
            ai_judge_enabled: false,
            ai_weight: 0.3,
            moderator_id: effectiveTeacherId,
            created_by: effectiveTeacherId,
            status: 'draft',
            ...(resolvedTenantId ? { tenant_id: resolvedTenantId } : {}),
          })
          .select('id')
          .single();
        if (debErr || !deb?.id) {
          return { error: new Error(`Création du débat impossible : ${debErr?.message || 'erreur inconnue'}`) };
        }
        debateId = deb.id;
        const roundsRows = Array.from({ length: roundCount }, (_, i) => ({
          debate_id: debateId, round_number: i + 1, status: 'pending',
        }));
        await supabase.from('debate_rounds').insert(roundsRows);
        // Participant modérateur (best-effort : RLS peut bloquer si staff ≠ enseignant).
        try {
          await supabase.from('debate_participants').insert({
            debate_id: debateId, user_id: effectiveTeacherId, role: 'moderator', side: null, ready_status: 'ready',
          });
        } catch { /* non bloquant */ }
      }

      /* Toujours créer en « scheduled » d'abord : le trigger « live démarré » doit voir les invitations
         déjà en base (livekit-send-invitations) avant le passage en status live. */
      const baseInsert = {
        teacher_id: effectiveTeacherId,
        // host_user_id : colonne NOT NULL + la RLS INSERT live_sessions l'exige. = le créateur
        // (pour un enseignant qui crée son live, créateur = teacher).
        host_user_id: effectiveTeacherId,
        title: data.title,
        description: data.description,
        // contrainte CHECK live_sessions_session_type_check : 'class' valide, 'classe' REJETÉ.
        session_type: (data.session_type && data.session_type !== 'classe') ? data.session_type : 'class',
        scheduled_at: scheduledAt,
        // (colonne `visibility_mode` retirée : elle N'EXISTE PAS dans le schéma — la visibilité
        //  secret/public passe par `room_mode` / `config`, posés par le wizard. L'ancienne ligne
        //  faisait échouer l'insert « column not found ».)
        status: 'scheduled',
        started_at: null,
        cover_image_url,
        duration_minutes,
        ambient_tracks_json,
        config: data.config || {},
        // La RLS INSERT exige `tenant_id` (= tenant du membre). ⚠️ La colonne s'appelle
        // `tenant_id` — `cimolace_tenant_id` N'EXISTE PAS dans le schéma (l'ancien code la posait
        // → insert en échec « column not found » → wizard ne créait jamais le live).
        ...(resolvedTenantId ? { tenant_id: resolvedTenantId } : {}),
        ...(debateId ? { debate_id: debateId } : {}),
      };

      let insertResult = await supabase
        .from('live_sessions')
        .insert({
          ...baseInsert,
          join_code: generateLiveJoinCodeRaw(),
        })
        .select('id, join_code')
        .single();

      if (insertResult.error?.code === '23505') {
        for (let i = 0; i < 8 && insertResult.error?.code === '23505'; i += 1) {
          insertResult = await supabase
            .from('live_sessions')
            .insert({
              ...baseInsert,
              join_code: generateLiveJoinCodeRaw(),
            })
            .select('id, join_code')
            .single();
        }
      }

      if (insertResult.error && isSchemaMismatchError(insertResult.error)) {
        const { cimolace_tenant_id: _tid, ...legacyBase } = baseInsert;
        insertResult = await supabase
          .from('live_sessions')
          .insert({
            ...legacyBase,
            join_code: generateLiveJoinCodeRaw(),
          })
          .select('id, join_code')
          .single();
        if (insertResult.error && isSchemaMismatchError(insertResult.error)) {
          insertResult = await supabase.from('live_sessions').insert(legacyBase).select('id').single();
        }
      }

      const err = insertResult.error;
      if (err) return { error: err };
      const inserted = insertResult.data;
      const sessionId = inserted?.id;
      const join_code = inserted?.join_code ?? null;
      // Lien retour débat → live (best-effort, comme « Lancer l'arène »).
      if (debateId && sessionId) {
        try { await supabase.from('debates').update({ live_session_id: sessionId }).eq('id', debateId); } catch { /* non bloquant */ }
      }
      const invitedIds = data.invited_user_ids || [];
      const allowMembersInvite = data.allow_members_invite === true;
      if (sessionId && invitedIds.length > 0) {
        const participants = invitedIds.map((uid) => ({
          live_session_id: sessionId,
          user_id: uid,
          role: 'student',
          can_invite_others: allowMembersInvite,
        }));
        await supabase.from('live_session_participants').upsert(participants, {
          onConflict: 'live_session_id,user_id',
          ignoreDuplicates: true,
        });
      }

      // ── Moyens de diffusion choisis par le créateur ────────────────────────
      // Persistés dans live_visibility_rules (lue par le worker de notifs + les
      // écrans élève). AVANT, ces choix partaient UNIQUEMENT vers la fonction
      // Netlify d'invitations (souvent indisponible) → perdus. RLS write OK pour le
      // créateur (teacher_id=auth.uid()) ou un staff owner/admin/secretariat.
      if (sessionId) {
        try {
          await supabase.from('live_visibility_rules').upsert(
            {
              live_session_id: sessionId,
              is_public:
                data.is_public === true
                || String(data.visibility_mode || '').toLowerCase() === 'public',
              notify_dashboard: data.notify_dashboard !== false,
              notify_email: data.notify_email === true,
              notify_whatsapp: data.notify_whatsapp === true,
            },
            { onConflict: 'live_session_id' },
          );
        } catch (e) {
          // Non bloquant : la création du live ne doit pas échouer si la règle ne s'écrit pas.
          if (import.meta.env.DEV) console.warn('[createLiveSession] visibility_rules', e?.message || e);
        }
      }

      // ── Invitations intelligentes (Smart Entry / LIRI) ─────────────────────
      let inviteEmailReport = null;
      if (sessionId) {
        try {
          const { data: authData } = await supabase.auth.getSession();
          const invRes = await fetch('/.netlify/functions/livekit-send-invitations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authData?.session?.access_token || ''}`,
            },
            body: JSON.stringify({
              liveSessionId:               sessionId,
              invited_users:               data.invited_users || [],
              invited_classes:             data.invited_classes || [],
              invited_modules:             data.invited_modules || [],
              invited_roles:               data.invited_roles || [],
              access_mode:                 data.access_mode || 'free',
              password:                    data.password || '',
              waiting_room:                data.waiting_room !== false,
              waiting_room_audio_enabled:  data.waiting_room_audio_enabled || false,
              waiting_room_show_plan:      data.waiting_room_show_plan || false,
              waiting_room_show_details:   data.waiting_room_show_details !== false,
              waiting_room_welcome_message: data.waiting_room_welcome_message || '',
              notify_dashboard:            data.notify_dashboard !== false,
              notify_email:                data.notify_email || false,
              notify_whatsapp:             data.notify_whatsapp === true,
              is_public:
                data.is_public === true
                || String(data.visibility_mode || '').toLowerCase() === 'public',
              visibility_mode:             data.visibility_mode || 'secret',
            }),
          });
          const invData = await invRes.json().catch(() => ({}));
          if (!invRes.ok) {
            console.warn('[createLiveSession] livekit-send-invitations HTTP', invRes.status, invData);
          } else if (invData?.email_report) {
            inviteEmailReport = invData.email_report;
          }
        } catch (invErr) {
          console.warn('[createLiveSession] Smart invitations:', invErr.message);
        }
      }

      if (sessionId && startImmediately) {
        const { error: liveErr } = await supabase
          .from('live_sessions')
          .update({ status: 'live', started_at: nowIso })
          .eq('id', sessionId);
        if (liveErr) {
          console.warn('[createLiveSession] passage live:', liveErr.message);
        }
      }

      const wizardScript = cfg.smartboard_master_script_sections;
      if (sessionId && Array.isArray(wizardScript) && wizardScript.length > 0) {
        const { data: authData } = await supabase.auth.getSession();
        const uid = authData?.session?.user?.id;
        if (uid) {
          await seedLiveScriptSectionsFromWizard({
            supabase,
            sessionId,
            userId: uid,
            sections: wizardScript,
          });
        }
      }

      await refresh();
      return { error: null, sessionId, join_code, inviteEmailReport };
    },
    [teacherId, refresh]
  );

  const updateLiveSession = useCallback(
    async (id, updates) => {
      const { error: err } = await supabase.from('live_sessions').update(updates).eq('id', id);
      if (err) return { error: err };
      await refresh();
      return { error: null };
    },
    [refresh]
  );

  return {
    appointments,
    liveSessions,
    availabilitySlots,
    agendaEvents,
    hostProfile,
    loading,
    error,
    refresh,
    createLiveSession,
    updateLiveSession,
    ensureStudioForAppointment,
  };
}
