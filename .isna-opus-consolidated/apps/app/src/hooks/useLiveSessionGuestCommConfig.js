import { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

function parseCommConfig(raw) {
  let cfg = raw;
  if (cfg == null) return {};
  if (typeof cfg === 'string') {
    try {
      cfg = JSON.parse(cfg);
    } catch {
      return {};
    }
  }
  if (typeof cfg !== 'object') return {};
  return cfg;
}

/**
 * Drapeaux communication invité issus de live_sessions.config (aligné LiveHostPage sessionCommFlags).
 */
export function useLiveSessionGuestCommConfig(sessionId) {
  const [flags, setFlags] = useState({
    student_audio_enabled: true,
    student_video_enabled: true,
    screen_share_enabled: true,
    hand_raise_enabled: true,
    neuronq_enabled: true,
  });

  useEffect(() => {
    if (!sessionId) return undefined;

    const apply = (cfg) => {
      setFlags({
        student_audio_enabled: cfg.student_audio_enabled !== false,
        student_video_enabled: cfg.student_video_enabled !== false,
        screen_share_enabled: cfg.screen_share_enabled !== false,
        hand_raise_enabled: cfg.hand_raise_enabled !== false,
        neuronq_enabled: cfg.neuronq_enabled !== false,
      });
    };

    const load = async () => {
      const { data } = await supabase.from('live_sessions').select('config').eq('id', sessionId).maybeSingle();
      apply(parseCommConfig(data?.config));
    };
    void load();

    const ch = supabase
      .channel(`liri-guest-comm-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          apply(parseCommConfig(payload.new?.config));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [sessionId]);

  return flags;
}
