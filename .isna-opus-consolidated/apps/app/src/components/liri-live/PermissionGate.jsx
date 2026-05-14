import React, { Children, cloneElement, isValidElement } from 'react';
import { useLiriLivePermissionsContextOptional } from '@/components/liri-live/LiriLivePermissionsContext';

const DEFAULT_TOOLTIP = 'Demandez l’autorisation à l’hôte';

/**
 * Rend les enfants avec contrôles désactivés si l’action n’est pas autorisée (ne masque pas l’UI).
 *
 * @param {object} props
 * @param {import('@/lib/liriLive/livePermissions').LivePermissionAction} props.action
 * @param {boolean} [props.forceDisabled] — désactive même si autorisé (ex. autre garde externe)
 * @param {string} [props.disabledTooltip]
 * @param {React.ReactNode} props.children — un seul élément React recevant `disabled` / `aria-disabled`
 */
export default function PermissionGate({
  action,
  forceDisabled = false,
  disabledTooltip = DEFAULT_TOOLTIP,
  children,
}) {
  const ctx = useLiriLivePermissionsContextOptional();
  const allowed = ctx ? ctx.isAllowed(action) : true;
  const blocked = forceDisabled || !allowed;

  const child = Children.only(children);
  if (!isValidElement(child)) {
    return children;
  }

  const prevDisabled = Boolean(child.props.disabled);
  const mergedDisabled = blocked || prevDisabled;

  return cloneElement(child, {
    ...child.props,
    disabled: mergedDisabled,
    'aria-disabled': mergedDisabled ? true : child.props['aria-disabled'],
    title:
      blocked && !prevDisabled
        ? (child.props.title ?? disabledTooltip)
        : child.props.title,
    'data-liri-permission-gate': action,
    'data-liri-permission-blocked': blocked ? '1' : '0',
  });
}
