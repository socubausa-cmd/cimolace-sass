import { useEffect, useMemo } from 'react';
import { mergeGuestMeshPermissions } from '@/lib/liriLive/joyKit';

/**
 * Permissions JoyKit / mesh invité fusionnées : droits combinés, statut textuel,
 * flag drive SmartBoard, et synchronisation du ref partagé.
 */
export function useLiveHostGuestMeshPerms({
  isGuestUi,
  guestMeshGrant,
  joyKitSignalGrant,
  guestJoyKitDriveRef,
}) {
  const guestMergedMeshPermissions = useMemo(
    () => (isGuestUi ? mergeGuestMeshPermissions(guestMeshGrant, joyKitSignalGrant) : null),
    [isGuestUi, guestMeshGrant, joyKitSignalGrant],
  );

  const guestMeshStatusLine = useMemo(() => {
    if (!isGuestUi) return '';
    const p = guestMergedMeshPermissions;
    if (!p) return '';
    const keys = Object.keys(p).filter((k) => p[k]);
    if (!keys.length) return '';
    return `Droits actifs : ${keys.slice(0, 4).join(', ')}${keys.length > 4 ? '…' : ''}`;
  }, [isGuestUi, guestMergedMeshPermissions]);

  const guestJoyKitDrive = useMemo(() => {
    const p = guestMergedMeshPermissions;
    return Boolean(p?.manipulate_active_scene || p?.open_smartboard_composer);
  }, [guestMergedMeshPermissions]);

  useEffect(() => {
    const p = guestMergedMeshPermissions;
    guestJoyKitDriveRef.current = Boolean(p?.manipulate_active_scene || p?.open_smartboard_composer);
  }, [guestMergedMeshPermissions, guestJoyKitDriveRef]);

  return { guestMergedMeshPermissions, guestMeshStatusLine, guestJoyKitDrive };
}
