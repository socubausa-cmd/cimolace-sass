import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  designerShellMicroLabel,
  designerShellSegmentedRail,
  designerShellSegmentedSlot,
  designerShellDeviceRow,
} from '@/lib/liriDesignerShellClasses';

/**
 * Caméra / micro studio : 2 périphériques = interrupteur segmenté ; sinon liste de boutons.
 * Partagé par LiveStudioSettingsPanel et LiveSettingsPanel.
 */
export function StudioDevicePicker({
  devices,
  activeId,
  onPick,
  icon: Icon,
  kindFr,
  emptyMessage,
  switchHintTwo,
  switchHintMany,
}) {
  const shortLabel = (d, index) => {
    const raw = (d.label || '').trim();
    if (raw.length > 0 && raw.length <= 34) return raw;
    if (raw.length > 34) return `${raw.slice(0, 32)}…`;
    return `${kindFr} ${index + 1}`;
  };

  if (!devices.length) {
    return <p className="px-1 text-xs text-white/30">{emptyMessage}</p>;
  }

  if (devices.length === 2) {
    return (
      <div className="space-y-2">
        <p className={designerShellMicroLabel}>{switchHintTwo}</p>
        <div className={designerShellSegmentedRail}>
          {devices.map((d, i) => {
            const active = activeId === d.deviceId;
            return (
              <button
                key={d.deviceId}
                type="button"
                onClick={() => onPick?.(d.deviceId)}
                className={designerShellSegmentedSlot(active)}
              >
                <Icon className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-amber-200/90' : 'text-white/40')} />
                <span className="line-clamp-2 text-center text-[10px] font-semibold leading-tight">
                  {shortLabel(d, i)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {devices.length > 2 ? (
        <p className={cn(designerShellMicroLabel, 'mb-0.5')}>{switchHintMany}</p>
      ) : null}
      {devices.map((d, i) => {
        const active = activeId === d.deviceId;
        return (
          <button
            key={d.deviceId}
            type="button"
            onClick={() => onPick?.(d.deviceId)}
            className={designerShellDeviceRow(active)}
          >
            <Icon className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-amber-200/80' : 'text-white/40')} />
            <span className="min-w-0 flex-1 truncate text-xs font-medium">{shortLabel(d, i)}</span>
            {active ? <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-amber-300/90" /> : null}
          </button>
        );
      })}
    </div>
  );
}
