import React from 'react';

interface Props {
  sourceText: string;
  onSourceChange: (v: string) => void;
  onGenerate: () => void;
  status: 'idle' | 'running' | 'done' | 'error';
  error: string | null;
  progressLabel: string;
}

export default function SlideGenerationPanel({
  sourceText,
  onSourceChange,
  onGenerate,
  status,
  error,
  progressLabel,
}: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0A101D] p-3">
      <p className="mb-2 text-xs font-semibold text-white/70">Source SmartBoard</p>
      <textarea
        value={sourceText}
        onChange={(e) => onSourceChange(e.target.value)}
        rows={6}
        className="w-full rounded-lg border border-white/10 bg-black/30 p-2 text-sm text-white"
        placeholder="Collez votre plan masterclass..."
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onGenerate}
          disabled={status === 'running' || !sourceText.trim()}
          className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {status === 'running' ? 'Génération...' : 'Générer slide par slide'}
        </button>
        <span className="text-xs text-white/60">{progressLabel}</span>
      </div>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

