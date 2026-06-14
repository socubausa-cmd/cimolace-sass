import React from 'react';
import { Button } from '@/components/ui/button';
import { useLiriLivePermissionsContextOptional } from '@/components/liri/liri-live/LiriLivePermissionsContext';

/**
 * Demande d'accès pour une action LivePermissions (délègue à requestPermission du contexte).
 */
export default function RequestAccessButton({
  action,
  children = 'Demander accès',
  variant = 'outline',
  size = 'sm',
  className,
  onRequest,
  ...rest
}) {
  const ctx = useLiriLivePermissionsContextOptional();

  const handleClick = () => {
    if (typeof onRequest === 'function') {
      onRequest(action);
      return;
    }
    if (ctx) {
      void Promise.resolve(ctx.requestPermission(action)).catch(() => {});
    }
  };

  if (!ctx) return null;
  if (ctx.isAllowed(action)) return null;

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      {...rest}
    >
      {children}
    </Button>
  );
}
