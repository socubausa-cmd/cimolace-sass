import React from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function TBtn({ active, disabled, onClick, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        if (!disabled) onClick();
      }}
      disabled={disabled}
      title={title}
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] transition-colors',
        disabled && 'cursor-not-allowed opacity-35',
        !disabled && active && 'bg-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] text-[#f5dd8a]',
        !disabled && !active && 'text-white/50 hover:bg-white/[0.08] hover:text-white/90',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Barre type Word pour blocs texte du canevas SmartBoard (un style par calque).
 * @param {{ textObj: Record<string, unknown> | null, onPatch: (patch: Record<string, unknown>) => void, disabled?: boolean, className?: string }} props
 */
export default function CanvasTextFormatToolbar({ textObj, onPatch, disabled, className }) {
  const off = disabled || !textObj || textObj.type !== 'text';
  const fw = String(textObj?.fontWeight ?? '400');
  const isBold = fw === '700' || fw === 'bold' || Number(fw) >= 600;
  const isItalic = Boolean(textObj?.italic);
  const isUnderline = Boolean(textObj?.underline);
  const isStrike = Boolean(textObj?.strikethrough);
  const align = String(textObj?.textAlign || 'left');

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-0.5 rounded-lg border border-white/10 bg-[#0d1525]/80 p-1',
        className,
      )}
    >
      <TBtn
        active={isBold}
        disabled={off}
        title="Gras"
        onClick={() => onPatch({ fontWeight: isBold ? '400' : '700' })}
      >
        <Bold className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn
        active={isItalic}
        disabled={off}
        title="Italique"
        onClick={() => onPatch({ italic: !isItalic })}
      >
        <Italic className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn
        active={isUnderline}
        disabled={off}
        title="Souligné"
        onClick={() => onPatch({ underline: !isUnderline })}
      >
        <Underline className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn
        active={isStrike}
        disabled={off}
        title="Barré"
        onClick={() => onPatch({ strikethrough: !isStrike })}
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </TBtn>
      <div className="mx-0.5 h-5 w-px bg-white/15" />
      <TBtn
        active={align === 'left'}
        disabled={off}
        title="Aligner à gauche"
        onClick={() => onPatch({ textAlign: 'left' })}
      >
        <AlignLeft className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn
        active={align === 'center'}
        disabled={off}
        title="Centrer"
        onClick={() => onPatch({ textAlign: 'center' })}
      >
        <AlignCenter className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn
        active={align === 'right'}
        disabled={off}
        title="Aligner à droite"
        onClick={() => onPatch({ textAlign: 'right' })}
      >
        <AlignRight className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn
        active={align === 'justify'}
        disabled={off}
        title="Justifier"
        onClick={() => onPatch({ textAlign: 'justify' })}
      >
        <AlignJustify className="h-3.5 w-3.5" />
      </TBtn>
    </div>
  );
}
