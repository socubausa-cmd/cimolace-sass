import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const DEFAULT_LABEL = 'Demandez l’autorisation à l’hôte';

/**
 * Bouton toujours désactivé avec tooltip explicite (pattern « action visible mais bloquée »).
 */
export default function DisabledActionButton({
  children,
  tooltip = DEFAULT_LABEL,
  className,
  variant = 'outline',
  size = 'default',
  ...rest
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex max-w-full">
            <Button
              type="button"
              variant={variant}
              size={size}
              className={className}
              disabled
              {...rest}
            >
              {children}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
