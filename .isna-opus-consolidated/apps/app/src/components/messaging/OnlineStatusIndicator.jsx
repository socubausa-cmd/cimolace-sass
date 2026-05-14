import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const OnlineStatusIndicator = ({ status, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };

  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
    away: 'bg-yellow-500',
    dnd: 'bg-red-500'
  };

  const statusLabels = {
    online: 'En ligne',
    offline: 'Hors ligne',
    away: 'Absent',
    dnd: 'Ne pas déranger'
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-block rounded-full border-2 border-[#0F1419] ${sizeClasses[size]} ${statusColors[status] || statusColors.offline}`} />
        </TooltipTrigger>
        <TooltipContent>
          <p>{statusLabels[status] || 'Inconnu'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default OnlineStatusIndicator;