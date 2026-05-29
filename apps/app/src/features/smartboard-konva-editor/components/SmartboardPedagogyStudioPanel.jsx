/**
 * Studio pédagogique (J3) — onglets Plan du slide · Mindmap · Coach slide dans le panneau droit.
 */
import React, { useState } from 'react';
import { GitBranch, Network, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCourseCopilotStore } from '../store/useCourseCopilotStore';
import SlideProgressionPanel from './SlideProgressionPanel';
import CourseMindmapTree from './CourseMindmapTree';
import KonvaCoachSlidePanel from './KonvaCoachSlidePanel';

const SUB_TABS = [
  { id: 'plan', label: 'Plan', Icon: GitBranch },
  { id: 'mindmap', label: 'Mindmap', Icon: Network },
  { id: 'coach', label: 'Coach', Icon: Sparkles },
];

/**
 * @param {React.ComponentProps<typeof SlideProgressionPanel> & {
 *   subTab?: 'plan' | 'mindmap' | 'coach';
 *   onSubTabChange?: (t: 'plan' | 'mindmap' | 'coach') => void;
 *   onMindmapInsertNode?: (p: { nodeId: string; label: string }) => void;
 * }} props
 */
export default function SmartboardPedagogyStudioPanel(props) {
  const { subTab: controlledSub, onSubTabChange, onMindmapInsertNode, ...slideProps } = props;
  const [internalSub, setInternalSub] = useState(/** @type {'plan' | 'mindmap' | 'coach'} */ ('plan'));
  const controlled = controlledSub !== undefined && typeof onSubTabChange === 'function';
  const sub = controlled ? controlledSub : internalSub;
  const setSub = controlled ? onSubTabChange : setInternalSub;
  const course = useCourseCopilotStore((s) => s.course);
  const activeSlideIndex = useCourseCopilotStore((s) => s.activeSlideIndex);
  const slide = course?.slides?.[activeSlideIndex];
  const mindmapRoot = course?.mindmap;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 gap-0.5 border-b border-white/[0.07] bg-[#0a0c12] p-1">
        {SUB_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSub(/** @type {'plan' | 'mindmap' | 'coach'} */ (id))}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[9px] font-semibold uppercase tracking-wide transition-colors',
              sub === id
                ? 'bg-[#D4AF37]/15 text-[#f5dd8a]'
                : 'text-white/35 hover:bg-white/[0.04] hover:text-white/65',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
        {sub === 'plan' ? <SlideProgressionPanel {...slideProps} /> : null}
        {sub === 'mindmap' ? (
          <CourseMindmapTree
            root={mindmapRoot}
            activeSlideTitle={slide?.title ?? null}
            onInsertNode={onMindmapInsertNode}
          />
        ) : null}
        {sub === 'coach' ? (
          <div className="p-2">
            <KonvaCoachSlidePanel contextExtra="Studio pédagogique" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
