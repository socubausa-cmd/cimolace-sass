import React, { useMemo, useState } from 'react';
import { TranscriptLine, tsToSeconds, formatTime } from './types';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';

type Props = {
  transcript: TranscriptLine[];
  currentTimeSeconds: number;
  onSeek: (timeSeconds: number) => void;
  buttonOnly?: boolean;
};

const TranscriptPanel: React.FC<Props> = ({ transcript, currentTimeSeconds, onSeek, buttonOnly = false }) => {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [translateLang, setTranslateLang] = useState('en');
  const [translateLoading, setTranslateLoading] = useState(false);
  const [translatedLines, setTranslatedLines] = useState<{ timeSeconds: number; text: string }[] | null>(null);
  const [showTranslated, setShowTranslated] = useState(false);

  const lines = useMemo(() => {
    return (transcript || [])
      .map((l: any) => ({
        timeSeconds: tsToSeconds({ timeSeconds: l.timeSeconds, time: l.time ?? l.t }) ?? 0,
        text: String(l.text ?? l.x ?? '').trim(),
      }))
      .filter((l) => l.text)
      .sort((a, b) => a.timeSeconds - b.timeSeconds);
  }, [transcript]);

  const activeIdx = useMemo(() => {
    if (lines.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].timeSeconds <= currentTimeSeconds + 0.25) idx = i;
    }
    return idx;
  }, [lines, currentTimeSeconds]);

  const windowedLines = useMemo(() => {
    if (lines.length === 0) return [];
    if (activeIdx < 0) return lines.slice(0, 10);
    const start = Math.max(0, activeIdx - 3);
    const end = Math.min(lines.length, activeIdx + 6);
    return lines.slice(start, end);
  }, [lines, activeIdx]);

  const renderList = (items: { timeSeconds: number; text: string }[]) => (
    <div className="space-y-1 p-2">
      {items.map((l, idx) => {
        const absoluteIdx = lines.findIndex((x) => x.timeSeconds === l.timeSeconds && x.text === l.text);
        const active = absoluteIdx >= 0 ? absoluteIdx === activeIdx : false;
        return (
          <button
            key={`${l.timeSeconds}-${idx}`}
            type="button"
            onClick={() => onSeek(l.timeSeconds)}
            className={
              active
                ? 'w-full text-left px-3 py-2 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex gap-3 items-start'
                : 'w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 border border-transparent flex gap-3 items-start'
            }
          >
            <span className="flex-shrink-0 text-[11px] font-mono text-[#D4AF37] bg-[#D4AF37]/10 px-1.5 py-0.5 rounded mt-0.5 min-w-[44px] text-center">
              {formatTime(l.timeSeconds)}
            </span>
            <span className="flex-1 text-sm text-gray-100 leading-relaxed">{l.text}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="h-full overflow-auto">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-xs text-gray-400 uppercase tracking-wider">Transcription</div>
        {lines.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="h-7 text-[11px] border-white/10 text-white hover:bg-white/5"
            onClick={() => setOpen(true)}
          >
            Voir tout
          </Button>
        ) : null}
      </div>

      {lines.length === 0 ? (
        <div className="text-sm text-gray-500">Aucune transcription</div>
      ) : (
        buttonOnly ? null : (
          <div className="space-y-2">
            <div className="text-[11px] text-gray-500">
              Affichage progressif (autour du temps courant)
            </div>
            {renderList(windowedLines)}
          </div>
        )
      )}

      {open ? (
        <div className="fixed inset-0 z-[80]">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity"
            onClick={() => {
              if (!minimized) setOpen(false);
            }}
          />

          {minimized ? (
            <div className="absolute bottom-4 right-4">
              <div className="bg-[#0F1419]/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur px-3 py-2 flex items-center gap-2">
                <div className="text-xs text-gray-200 font-semibold">Transcription</div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-7 px-2 border-white/10 text-white hover:bg-white/5"
                  onClick={() => setMinimized(false)}
                >
                  Ouvrir
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-7 px-2 border-white/10 text-white hover:bg-white/5"
                  onClick={() => {
                    setMinimized(false);
                    setOpen(false);
                  }}
                >
                  Fermer
                </Button>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-end md:items-center justify-center p-3 md:p-6">
              <div className="w-[98vw] md:w-[920px] h-[82vh] bg-[#0F1419]/95 border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur">
                <div className="h-12 px-3 flex items-center justify-between border-b border-white/10 bg-black/30">
                  <div className="font-bold text-sm">Transcription</div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 border-white/10 text-white hover:bg-white/5"
                      onClick={() => setMinimized(true)}
                    >
                      Réduire
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!translatedLines || translateLoading}
                      className="h-8 border-white/10 text-white hover:bg-white/5"
                      onClick={() => setShowTranslated((v) => !v)}
                    >
                      {showTranslated ? 'Original' : 'Traduction'}
                    </Button>
                    <select
                      value={translateLang}
                      onChange={(e) => setTranslateLang(e.target.value)}
                      className="h-8 rounded-md bg-black/30 border border-white/10 text-white text-xs px-2"
                      aria-label="Langue de traduction"
                    >
                      <option value="en">EN</option>
                      <option value="fr">FR</option>
                      <option value="es">ES</option>
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={translateLoading}
                      className="h-8 border-white/10 text-white hover:bg-white/5"
                      onClick={async () => {
                        setTranslateLoading(true);
                        try {
                          const payload = lines.map((l) => ({ timeSeconds: l.timeSeconds, text: l.text }));
                          const { data, error } = await supabase.functions.invoke('translate-transcript', {
                            body: {
                              transcript: payload,
                              targetLang: translateLang,
                            },
                          });
                          if (error) throw error;
                          const out = Array.isArray((data as any)?.transcript) ? (data as any).transcript : [];
                          const normalized = out
                            .map((l: any) => ({
                              timeSeconds: Number(l?.timeSeconds ?? 0),
                              text: String(l?.text ?? '').trim(),
                            }))
                            .filter((l: any) => Number.isFinite(l.timeSeconds) && l.text);
                          setTranslatedLines(normalized);
                          setShowTranslated(true);
                        } finally {
                          setTranslateLoading(false);
                        }
                      }}
                    >
                      Traduire
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 border-white/10 text-white hover:bg-white/5"
                      onClick={() => {
                        setMinimized(false);
                        setOpen(false);
                      }}
                    >
                      Fermer
                    </Button>
                  </div>
                </div>

                <div className="h-[calc(82vh-3rem)] overflow-y-auto">
                  {renderList(showTranslated && translatedLines ? translatedLines : lines)}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default TranscriptPanel;
