import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { ensureFreshSession } from '@/lib/supabaseResilience';

function formationIdFromDayContentRow(row) {
  const d = row?.formation_days;
  const day = Array.isArray(d) ? d[0] : d;
  const w = day?.formation_weeks;
  const week = Array.isArray(w) ? w[0] : w;
  const m = week?.modules;
  const mod = Array.isArray(m) ? m[0] : m;
  return mod?.formation_id ?? null;
}

async function enrichMergedArenaSessions(merged) {
  const arenaIds = merged.filter((s) => s.source !== 'immersive').map((s) => s.id).filter(Boolean);

  const neuroBySession = {};
  if (arenaIds.length > 0) {
    const { data: neuroRows } = await supabase
      .from('live_neuro_recall_state')
      .select('live_session_id, workflow_status, postproduction_content_id, replay_public_url')
      .in('live_session_id', arenaIds);
    (neuroRows || []).forEach((r) => {
      if (r?.live_session_id) neuroBySession[r.live_session_id] = r;
    });
  }

  const contentIds = [
    ...new Set(
      Object.values(neuroBySession)
        .map((r) => r.postproduction_content_id)
        .filter(Boolean),
    ),
  ];

  const formationByContent = {};
  if (contentIds.length > 0) {
    const { data: fdcRows } = await supabase
      .from('formation_day_contents')
      .select('id, formation_days(formation_weeks(modules(formation_id)))')
      .in('id', contentIds);
    (fdcRows || []).forEach((row) => {
      if (row?.id) formationByContent[row.id] = formationIdFromDayContentRow(row);
    });
  }

  return merged.map((s) => {
    if (s.source === 'immersive') return s;
    const nr = neuroBySession[s.id] || null;
    const cid = nr?.postproduction_content_id;
    const neuro_replay_formation_id = cid ? formationByContent[cid] ?? null : null;
    return { ...s, neuroRecall: nr, neuro_replay_formation_id };
  });
}

/**
 * Sessions live « actionnables » pour l’utilisateur : arena (live_sessions),
 * invitations, visibilité publique, salle d’attente, et live immersif messagerie.
 * Sans `userId` : uniquement les lives **publics** en statut `live` (badge accueil invité).
 * Enrichit les lignes arène avec live_neuro_recall_state + formation liée au contenu post-prod.
 *
 * @param {string|null|undefined} userId
 */
export function useLiveAlertsForUser(userId) {
  const [sessions, setSessions] = useState([]);
  const uid = userId || null;

  const loadPublicLives = useCallback(async () => {
    try {
      await ensureFreshSession(supabase, 120);
      const { data: visRows, error: visErr } = await supabase
        .from('live_visibility_rules')
        .select(`
          live_sessions!inner(id, title, description, cover_image_url, status, scheduled_at, started_at, ended_at, teacher_id)
        `)
        .eq('is_public', true)
        .eq('live_sessions.status', 'live')
        .limit(8);
      if (visErr) throw visErr;
      const publicLive = (visRows || []).map((r) => r.live_sessions).filter(Boolean);
      const merged = publicLive.map((ls) => ({ ...ls, source: 'public' }));
      const enriched = await enrichMergedArenaSessions(merged);
      setSessions(enriched);
    } catch (err) {
      console.warn('[useLiveAlertsForUser] public lives', err?.message || err);
      setSessions([]);
    }
  }, []);

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      await ensureFreshSession(supabase, 120);
      const { data: invitations } = await supabase
        .from('live_invitations')
        .select(`
          id, status, invitation_type,
          live_sessions!inner(id, title, description, cover_image_url, status, scheduled_at, started_at, ended_at, teacher_id)
        `)
        .eq('user_id', uid)
        .in('status', ['pending', 'sent', 'seen', 'accepted'])
        .in('live_sessions.status', ['scheduled', 'live'])
        .order('created_at', { ascending: false })
        .limit(5);

      let publicLive = [];
      const { data: visRows, error: visErr } = await supabase
        .from('live_visibility_rules')
        .select(`
          live_sessions!inner(id, title, description, cover_image_url, status, scheduled_at, started_at, ended_at, teacher_id)
        `)
        .eq('is_public', true)
        .eq('live_sessions.status', 'live')
        .limit(6);
      if (!visErr && Array.isArray(visRows)) {
        publicLive = visRows.map((r) => r.live_sessions).filter(Boolean);
      }

      const { data: waitingEntries } = await supabase
        .from('live_waiting_room_entries')
        .select(`
          id, status,
          live_sessions!inner(id, title, description, cover_image_url, status, scheduled_at, started_at, ended_at, teacher_id)
        `)
        .eq('user_id', uid)
        .eq('status', 'waiting')
        .limit(3);

      const { data: immersiveRows } = await supabase
        .from('immersive_live_sessions')
        .select('id, title, status, host_user_id, guest_user_id, created_at, started_at, ended_at, updated_at')
        .or(`host_user_id.eq.${uid},guest_user_id.eq.${uid}`)
        .in('status', ['active', 'pending'])
        .is('ended_at', null)
        .order('created_at', { ascending: false })
        .limit(5);

      const fromInvites = (invitations || []).map((inv) => ({
        ...inv.live_sessions,
        invite_status: inv.status,
        invitation_type: inv.invitation_type,
        source: 'invited',
      }));

      const fromPublic = (publicLive || [])
        .filter((ls) => !fromInvites.find((i) => i.id === ls.id))
        .map((ls) => ({ ...ls, source: 'public' }));

      const fromWaiting = (waitingEntries || []).map((e) => ({
        ...e.live_sessions,
        source: 'waiting_approval',
      }));

      const fromImmersive = (immersiveRows || []).map((r) => ({
        id: r.id,
        title: (r.title && String(r.title).trim()) || 'Live vidéo (messagerie)',
        status: r.status === 'active' ? 'live' : 'scheduled',
        scheduled_at: r.created_at,
        started_at: r.started_at || r.updated_at || r.created_at,
        ended_at: r.ended_at,
        immersive_created_at: r.created_at,
        immersive_updated_at: r.updated_at,
        teacher_id: r.host_user_id,
        source: 'immersive',
        immersive_status: r.status,
        immersive_session_id: r.id,
      }));

      const all = [...fromInvites, ...fromPublic, ...fromWaiting, ...fromImmersive];
      const seen = new Set();
      const merged = all.filter((s) => {
        if (!s?.id || seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });

      const enriched = await enrichMergedArenaSessions(merged);
      setSessions(enriched);
    } catch (err) {
      console.warn('[useLiveAlertsForUser]', err?.message || err);
    }
  }, [uid]);

  const loadDebouncedRef = useRef(null);
  const scheduleLoad = useCallback(() => {
    clearTimeout(loadDebouncedRef.current);
    loadDebouncedRef.current = setTimeout(() => {
      load();
    }, 350);
  }, [load]);

  const publicDebouncedRef = useRef(null);
  const schedulePublicLoad = useCallback(() => {
    clearTimeout(publicDebouncedRef.current);
    publicDebouncedRef.current = setTimeout(() => {
      loadPublicLives();
    }, 350);
  }, [loadPublicLives]);

  useEffect(() => {
    if (uid) {
      load();
      const interval = setInterval(load, 12_000);
      return () => clearInterval(interval);
    }
    loadPublicLives();
    const interval = setInterval(loadPublicLives, 12_000);
    return () => clearInterval(interval);
  }, [uid, load, loadPublicLives]);

  useEffect(() => {
    if (!uid) return undefined;
    const ch = supabase
      .channel(`live_alerts_${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_invitations', filter: `user_id=eq.${uid}` }, scheduleLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_waiting_room_entries', filter: `user_id=eq.${uid}` }, scheduleLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_visibility_rules' }, scheduleLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions' }, scheduleLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_neuro_recall_state' }, scheduleLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'formation_day_contents' }, scheduleLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'immersive_live_sessions', filter: `host_user_id=eq.${uid}` }, scheduleLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'immersive_live_sessions', filter: `guest_user_id=eq.${uid}` }, scheduleLoad)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid, scheduleLoad]);

  useEffect(() => {
    if (uid) return undefined;
    const ch = supabase
      .channel('live_alerts_public_anon')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_visibility_rules' }, schedulePublicLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions' }, schedulePublicLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_neuro_recall_state' }, schedulePublicLoad)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid, schedulePublicLoad]);

  return sessions;
}
