import { useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { mergeSmartboardSceneFlags } from '@/lib/smartboardNavigatorScenes';
import {
  serializeGuestPermissions,
  GUEST_CAPABILITIES_DEFAULTS,
} from '@/hooks/useGuestCapabilities';

/**
 * Persistance config session en DB : control_mesh, patch config générique,
 * et toggles rapides IA / comm / permissions invité / scènes SmartBoard.
 */
export function useLiveHostConfigActions({
  sessionId,
  isGuestUi,
  toast,
  setSessionQuickIaFlags,
  setSessionCommFlags,
  setSessionGuestPermissions,
  setSmartboardSceneFlags,
}) {
  const persistControlMeshToConfig = useCallback(async (grants) => {
    if (!sessionId) return;
    try {
      const { data: row } = await supabase.from('live_sessions').select('config').eq('id', sessionId).maybeSingle();
      let c = {};
      try {
        c = typeof row?.config === 'string' ? JSON.parse(row.config) : (row?.config || {});
      } catch { /* ignore */ }
      const list = Object.entries(grants).map(([userId, v]) => ({
        userId,
        profileId: v.profileId,
        name: v.name,
        expiresAt: v.expiresAt,
      }));
      await supabase
        .from('live_sessions')
        .update({
          config: { ...c, control_mesh: { grants: list, updated_at: new Date().toISOString() } },
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
    } catch { /* ignore */ }
  }, [sessionId]);

  const persistSessionConfigPatch = useCallback(
    async (patch) => {
      if (!sessionId || isGuestUi) return;
      try {
        const { data: row } = await supabase.from('live_sessions').select('config').eq('id', sessionId).maybeSingle();
        let c = {};
        try {
          c = typeof row?.config === 'string' ? JSON.parse(row.config) : (row?.config || {});
        } catch { /* ignore */ }
        const { error } = await supabase.from('live_sessions').update({
          config: { ...c, ...patch },
          updated_at: new Date().toISOString(),
        }).eq('id', sessionId);
        if (error) throw error;
      } catch (e) {
        console.warn('[LiveHost] persistSessionConfigPatch', e?.message);
        toast({
          title: 'Enregistrement impossible',
          description: e?.message || "Réessayez.",
          variant: 'destructive',
        });
      }
    },
    [sessionId, isGuestUi, toast],
  );

  const handleQuickIaToggle = useCallback(
    (key, v) => {
      setSessionQuickIaFlags((prev) => ({ ...prev, [key]: v }));
      void persistSessionConfigPatch({ [key]: v });
    },
    [persistSessionConfigPatch, setSessionQuickIaFlags],
  );

  const handleQuickCommToggle = useCallback(
    (key, v) => {
      setSessionCommFlags((prev) => ({ ...prev, [key]: v }));
      void persistSessionConfigPatch({ [key]: v });
    },
    [persistSessionConfigPatch, setSessionCommFlags],
  );

  const handleGuestPermissionsChange = useCallback(
    (next) => {
      const merged = {
        ...serializeGuestPermissions(GUEST_CAPABILITIES_DEFAULTS),
        ...(next || {}),
      };
      setSessionGuestPermissions(merged);
      void persistSessionConfigPatch({ guest_permissions: merged });
    },
    [persistSessionConfigPatch, setSessionGuestPermissions],
  );

  const handleQuickSmartboardSceneToggle = useCallback(
    (id, v) => {
      setSmartboardSceneFlags((prev) => {
        const next = mergeSmartboardSceneFlags({ ...prev, [id]: v });
        void persistSessionConfigPatch({ smartboard_scenes: next });
        return next;
      });
    },
    [persistSessionConfigPatch, setSmartboardSceneFlags],
  );

  return {
    persistControlMeshToConfig,
    persistSessionConfigPatch,
    handleQuickIaToggle,
    handleQuickCommToggle,
    handleGuestPermissionsChange,
    handleQuickSmartboardSceneToggle,
  };
}
