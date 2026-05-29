/**
 * ImageAdjustmentPanel — sliders brightness/contrast/saturation/blur + LUT presets.
 * Used in the Properties panel when an image element is selected.
 */
import React, { useCallback } from 'react';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_ADJUSTMENTS, lutToAdjustments } from '@/engines/image-engine';

const LUT_PRESETS = [
  { id: 'none', label: 'Original' },
  { id: 'cool', label: 'Froid' },
  { id: 'warm', label: 'Chaud' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'dramatic', label: 'Dramatique' },
  { id: 'matte', label: 'Mat' },
  { id: 'fade', label: 'Fade' },
];

function Slider({ label, value, min, max, step = 1, onChange, unit = '' }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/50">{label}</span>
        <span className="text-[11px] font-medium text-white/70">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#D4AF37]"
      />
    </div>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-white/50">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          'relative h-5 w-9 rounded-full transition-colors',
          value ? 'bg-[#D4AF37]' : 'bg-white/15',
        )}
      >
        <span className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
          value ? 'translate-x-4' : 'translate-x-0.5',
        )} />
      </button>
    </div>
  );
}

export default function ImageAdjustmentPanel({ adjustments = DEFAULT_ADJUSTMENTS, onChange, className }) {
  const update = useCallback((patch) => {
    onChange({ ...adjustments, ...patch });
  }, [adjustments, onChange]);

  const applyLut = (lutId) => {
    const lutAdj = lutToAdjustments(lutId);
    onChange({ ...DEFAULT_ADJUSTMENTS, ...lutAdj, lut: lutId });
  };

  const reset = () => onChange({ ...DEFAULT_ADJUSTMENTS });

  return (
    <div className={cn('flex flex-col gap-4 p-3', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-3.5 w-3.5 text-white/40" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Ajustements</span>
        <button
          onClick={reset}
          className="ml-auto flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>

      {/* LUT presets */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] text-white/30 uppercase tracking-wider">Preset</span>
        <div className="flex flex-wrap gap-1.5">
          {LUT_PRESETS.map((lut) => (
            <button
              key={lut.id}
              onClick={() => applyLut(lut.id)}
              className={cn(
                'rounded-md border px-2 py-1 text-[10px] transition-colors',
                adjustments.lut === lut.id
                  ? 'border-[#D4AF37]/40 bg-[#D4AF37]/15 text-[#D4AF37]'
                  : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60',
              )}
            >
              {lut.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <div className="flex flex-col gap-3">
        <Slider label="Luminosité" value={adjustments.brightness} min={-100} max={100} onChange={(v) => update({ brightness: v })} />
        <Slider label="Contraste" value={adjustments.contrast} min={-100} max={100} onChange={(v) => update({ contrast: v })} />
        <Slider label="Saturation" value={adjustments.saturation} min={-100} max={100} onChange={(v) => update({ saturation: v })} />
        <Slider label="Flou" value={adjustments.blur} min={0} max={100} onChange={(v) => update({ blur: v })} />
        <Slider label="Teinte" value={adjustments.hue} min={0} max={360} onChange={(v) => update({ hue: v })} unit="°" />
      </div>

      {/* Toggles */}
      <div className="flex flex-col gap-2.5">
        <Toggle label="Niveaux de gris" value={adjustments.grayscale} onChange={(v) => update({ grayscale: v })} />
        <Toggle label="Sépia" value={adjustments.sepia} onChange={(v) => update({ sepia: v })} />
      </div>
    </div>
  );
}
