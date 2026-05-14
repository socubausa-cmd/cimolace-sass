import { useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import {
  normalizeArenaLayoutMode,
  normalizeArenaPanelUserIds,
} from '@/lib/liriArenaLayout';

/**
 * Assigne `guestResyncSmartboardFromDbRef` : relit `live_sessions.config` et applique
 * diapo + arène via `smartBoardStageRef.applyHostSmartboardBroadcast` (invité spectateur).
 */
export function useLiveHostGuestResyncSmartboardFromDb({
  sessionId,
  guestResyncSmartboardFromDbRef,
  smartBoardStageRef,
  setArenaLayoutMode,
  setArenaGuestFocusUserId,
  setArenaPanelUserIds,
}) {
  useEffect(() => {
    guestResyncSmartboardFromDbRef.current = async () => {
      if (!sessionId) return;
      const loadAndApply = async () => {
        const apply = smartBoardStageRef.current?.applyHostSmartboardBroadcast;
        if (typeof apply !== 'function') return false;
        try {
          const { data } = await supabase.from('live_sessions').select('config').eq('id', sessionId).maybeSingle();
          if (!data?.config) return true;
          let c = {};
          try {
            c = typeof data.config === 'string' ? JSON.parse(data.config) : (data.config || {});
          } catch {
            return true;
          }
          const step = Number(c.current_step_index);
          const payload = {};
          if (Number.isFinite(step)) {
            payload.slideIndex = step;
            payload.nativeSlideIndex = step;
            payload.importSlideIndex = step;
          }
          if (typeof c.arena_layout_mode === 'string') {
            setArenaLayoutMode(normalizeArenaLayoutMode(c.arena_layout_mode));
          }
          if (Object.prototype.hasOwnProperty.call(c, 'arena_guest_focus_user_id')) {
            const g = c.arena_guest_focus_user_id;
            setArenaGuestFocusUserId(g != null && g !== '' ? String(g) : null);
          }
          if (Object.prototype.hasOwnProperty.call(c, 'arena_panel_user_ids')) {
            setArenaPanelUserIds(normalizeArenaPanelUserIds(c.arena_panel_user_ids));
          }
          queueMicrotask(() => apply(payload));
        } catch {
          /* ignore */
        }
        return true;
      };
      if (!(await loadAndApply())) {
        setTimeout(() => {
          void loadAndApply();
        }, 200);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs + setters stables
  }, [sessionId]);
}
