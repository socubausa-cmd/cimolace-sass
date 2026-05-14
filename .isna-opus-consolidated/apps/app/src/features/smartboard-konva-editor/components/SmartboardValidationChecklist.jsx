import React from 'react';
import { cn } from '@/lib/utils';
import {
  DEFAULT_VALIDATION_CHECKLIST,
  VALIDATION_CHECKLIST_LABELS_FR,
  countValidationChecked,
} from '../lib/liriValidationChecklist';
import { useCourseCopilotStore } from '../store/useCourseCopilotStore';

/**
 * Checklist validation finale (Module 7).
 */
export default function SmartboardValidationChecklist({ className }) {
  const validationChecklist = useCourseCopilotStore((s) => s.validationChecklist);
  const setItem = useCourseCopilotStore((s) => s.setValidationChecklistItem);
  const n = countValidationChecked(validationChecklist);
  const total = Object.keys(DEFAULT_VALIDATION_CHECKLIST).length;

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-[9px] font-medium text-white/45">
        Cochez au fur et à mesure — enregistré dans le workspace ({n}/{total}).
      </p>
      <ul className="space-y-1.5">
        {(/** @type {(keyof typeof DEFAULT_VALIDATION_CHECKLIST)[]} */ (Object.keys(DEFAULT_VALIDATION_CHECKLIST))).map(
          (key) => (
            <li key={key}>
              <label className="flex cursor-pointer items-start gap-2 text-[9px] text-white/72">
                <input
                  type="checkbox"
                  checked={validationChecklist[key]}
                  onChange={(e) => setItem(key, e.target.checked)}
                  className="mt-0.5 rounded border-white/25 bg-black/40"
                />
                <span>{VALIDATION_CHECKLIST_LABELS_FR[key]}</span>
              </label>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
