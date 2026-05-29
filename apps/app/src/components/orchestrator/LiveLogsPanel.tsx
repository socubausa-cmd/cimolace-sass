import React from 'react';

interface Props {
  logs: string[];
}

export function LiveLogsPanel({ logs }: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-200/80">Logs Live</p>
      <div className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
        {(logs || []).slice(0, 40).map((entry, idx) => (
          <p key={`${entry}-${idx}`} className="rounded-md bg-white/[0.03] px-2 py-1 text-[10px] text-white/70">
            {entry}
          </p>
        ))}
        {!logs?.length ? <p className="text-[10px] text-white/45">Aucun log pour le moment.</p> : null}
      </div>
    </div>
  );
}

export default LiveLogsPanel;
