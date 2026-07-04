import React, { useMemo, useCallback, useRef } from 'react';
import { Clapperboard, Layers, MapPin, RefreshCw, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useNleProjectStore } from '@/features/nle-engine/store/useNleProjectStore';
import {
  cutTransition,
  crossfadeTransition,
  dipToBlackTransition,
} from '@/lib/nleEngine/nleProjectModel';

const TRANSITION_OPTIONS = [
  { value: 'cut', label: 'Coupe' },
  { value: 'crossfade', label: 'Fondu enchaîné' },
  { value: 'dip_to_black', label: 'Fondu au noir' },
];

/** @param {string} type @param {number} durationSec */
function transitionFromType(type, durationSec) {
  const d = Math.max(0, Number(durationSec) || 0);
  if (type === 'crossfade') return crossfadeTransition(d);
  if (type === 'dip_to_black') return dipToBlackTransition(d);
  return cutTransition();
}

function formatTc(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  const cs = Math.floor((s % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(cs).padStart(2, '0')}`;
}

/**
 * @param {{
 *   previewDuration: number;
 *   chapters: Array<{ startText?: string; endText?: string; label?: string }>;
 *   currentTime: number;
 *   onSeek: (sec: number) => void;
 * }} props
 */
export default function NleEngineWorkspace({ previewDuration, chapters, currentTime, onSeek }) {
  const project = useNleProjectStore((s) => s.project);
  const pixelsPerSecond = useNleProjectStore((s) => s.pixelsPerSecond);
  const setPixelsPerSecond = useNleProjectStore((s) => s.setPixelsPerSecond);
  const syncChapters = useNleProjectStore((s) => s.syncChapters);
  const selectClip = useNleProjectStore((s) => s.selectClip);
  const selectedClipId = useNleProjectStore((s) => s.selectedClipId);
  const selectedTrackId = useNleProjectStore((s) => s.selectedTrackId);
  const updateClip = useNleProjectStore((s) => s.updateClip);
  const addMarker = useNleProjectStore((s) => s.addMarker);
  const setProjectName = useNleProjectStore((s) => s.setProjectName);
  const setMasterVolumeDb = useNleProjectStore((s) => s.setMasterVolumeDb);

  const duration = Math.max(project.duration || 0, previewDuration || 0, 1);
  const timelineWidth = Math.max(640, duration * pixelsPerSecond);

  const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const onRulerClick = useCallback(
    (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const t = (x / rect.width) * duration;
      onSeek(Math.max(0, Math.min(t, duration)));
    },
    [duration, onSeek]
  );

  const selectedClip = useMemo(() => {
    if (!selectedTrackId || !selectedClipId) return null;
    const tr = project.tracks.find((t) => t.id === selectedTrackId);
    return tr?.clips?.find((c) => c.id === selectedClipId) || null;
  }, [project.tracks, selectedTrackId, selectedClipId]);

  const selectedTrackIsVideo = useMemo(
    () => project.tracks.find((t) => t.id === selectedTrackId)?.type === 'video',
    [project.tracks, selectedTrackId]
  );

  /** @type {React.MutableRefObject<{ pointerId: number, trackId: string, clipId: string, startClientX: number, origStart: number } | null>} */
  const clipDragRef = useRef(null);

  const onClipPointerDown = useCallback(
    (e, trackId, clip) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      selectClip(trackId, clip.id);
      clipDragRef.current = {
        pointerId: e.pointerId,
        trackId,
        clipId: clip.id,
        startClientX: e.clientX,
        origStart: clip.startOnTimeline,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [selectClip]
  );

  const onClipPointerMove = useCallback(
    (e) => {
      const d = clipDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const dx = e.clientX - d.startClientX;
      const dt = dx / pixelsPerSecond;
      const next = Math.max(0, d.origStart + dt);
      updateClip(d.trackId, d.clipId, { startOnTimeline: next });
    },
    [pixelsPerSecond, updateClip]
  );

  const onClipPointerUp = useCallback((e) => {
    const d = clipDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    clipDragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="rounded-2xl border border-[color-mix(in_srgb,var(--coral)_25%,transparent)] bg-[#262624] overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-black/30 px-4 py-3">
        <Clapperboard className="h-5 w-5 text-[var(--coral)]" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider text-[color-mix(in_srgb,var(--coral)_70%,transparent)] font-semibold">Moteur NLE</p>
          <p className="text-xs text-white/50">Pistes vidéo/audio, clips, marqueurs — export FFmpeg aligné sur ce plan</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            className="h-8 w-[200px] bg-[#1f1e1c] border-white/10 text-sm"
            value={project.name}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Nom du montage"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/10 text-white hover:bg-white/5"
            onClick={() => syncChapters(chapters, previewDuration)}
            title="Reconstruire la piste caméra à partir des chapitres IN/OUT"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Sync chapitres
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/10 text-white hover:bg-white/5"
            onClick={() => addMarker(currentTime, 'Marqueur')}
          >
            <MapPin className="h-3.5 w-3.5 mr-1.5" />
            Marqueur
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-0 min-h-[320px]">
        <div className="min-w-0 flex flex-col border-r border-white/10">
          <div className="flex items-center gap-3 px-3 py-2 border-b border-white/10 bg-black/20">
            <ZoomIn className="h-4 w-4 text-white/40" />
            <Label className="text-[10px] text-white/40 whitespace-nowrap">Zoom</Label>
            <Slider
              className="w-40"
              min={24}
              max={480}
              step={4}
              value={[pixelsPerSecond]}
              onValueChange={(v) => setPixelsPerSecond(Array.isArray(v) ? v[0] : v)}
            />
            <span className="text-[10px] font-mono text-white/50">{pixelsPerSecond}px/s</span>
            <span className="ml-auto text-[11px] font-mono text-[color-mix(in_srgb,var(--coral)_90%,transparent)]">
              {formatTc(currentTime)} / {formatTc(duration)}
            </span>
          </div>

          <div
            className="relative h-8 cursor-pointer border-b border-white/10 bg-[#1f1e1c]"
            onClick={onRulerClick}
            style={{ width: timelineWidth, minWidth: '100%' }}
          >
            <div className="absolute inset-0 flex text-[9px] font-mono text-white/25">
              {Array.from({ length: Math.ceil(duration / 10) + 1 }, (_, i) => i * 10).map((t) => (
                <span
                  key={t}
                  className="absolute border-l border-white/15 pl-0.5"
                  style={{ left: `${(t / duration) * 100}%` }}
                >
                  {Math.floor(t / 60)}:{String(t % 60).padStart(2, '0')}
                </span>
              ))}
            </div>
            <div
              className="absolute top-0 bottom-0 w-px bg-[var(--coral)] z-10 pointer-events-none"
              style={{ left: `${playheadPct}%` }}
            />
          </div>

          <div className="overflow-x-auto flex-1 min-h-[200px]">
            <div style={{ width: timelineWidth, minWidth: '100%' }}>
              {project.tracks.map((tr) => (
                <div
                  key={tr.id}
                  className={cn(
                    'flex border-b border-white/[0.06] min-h-[52px] relative',
                    tr.type === 'audio' ? 'bg-[#2b2926]' : 'bg-[#30302e]'
                  )}
                >
                  <div className="w-[140px] shrink-0 border-r border-white/10 px-2 py-2 flex items-start gap-1.5">
                    <Layers className="h-3.5 w-3.5 mt-0.5 text-white/35" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-white/80 truncate">{tr.name}</p>
                      <p className="text-[9px] text-white/35 uppercase">{tr.type}</p>
                    </div>
                  </div>
                  <div className="flex-1 relative">
                    {tr.clips.map((c) => {
                      const left = (c.startOnTimeline / duration) * 100;
                      const width = (c.duration / duration) * 100;
                      const active = selectedClipId === c.id && selectedTrackId === tr.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={cn(
                            'absolute top-1 bottom-1 rounded-md border text-left px-2 py-1 overflow-hidden transition-colors cursor-grab active:cursor-grabbing touch-none select-none',
                            tr.type === 'video'
                              ? 'bg-[#c2683f]/25 border-[#d97757]/40 hover:bg-[#c2683f]/35'
                              : 'bg-[#7a9b6c]/20 border-[#9fbf8f]/35 hover:bg-[#7a9b6c]/30',
                            active && 'ring-2 ring-[color-mix(in_srgb,var(--coral)_80%,transparent)]'
                          )}
                          style={{ left: `${left}%`, width: `${width}%` }}
                          onPointerDown={(e) => onClipPointerDown(e, tr.id, c)}
                          onPointerMove={onClipPointerMove}
                          onPointerUp={onClipPointerUp}
                          onPointerCancel={onClipPointerUp}
                        >
                          <p className="text-[10px] font-medium text-white/95 truncate">{c.label}</p>
                          <p className="text-[9px] text-white/40 font-mono">
                            {c.duration.toFixed(1)}s
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="border-t lg:border-t-0 lg:border-l border-white/10 bg-black/25 p-4 space-y-4">
          <div>
            <Label className="text-[10px] text-white/40 uppercase">Mixage master</Label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-white/50 w-8">dB</span>
              <Slider
                min={-24}
                max={12}
                step={0.5}
                value={[project.mix.masterVolumeDb]}
                onValueChange={(v) => setMasterVolumeDb(Array.isArray(v) ? v[0] : v)}
                className="flex-1"
              />
              <span className="text-[11px] font-mono text-white/70 w-10">
                {project.mix.masterVolumeDb.toFixed(1)}
              </span>
            </div>
          </div>

          {selectedClip ? (
            <div className="space-y-2 rounded-lg border border-white/10 bg-black/30 p-3">
              <p className="text-[11px] font-semibold text-[color-mix(in_srgb,var(--coral)_90%,transparent)]">Clip sélectionné</p>
              <Input
                className="h-8 bg-[#1f1e1c] border-white/10 text-xs"
                value={selectedClip.label}
                onChange={(e) =>
                  updateClip(selectedTrackId, selectedClip.id, { label: e.target.value })
                }
              />
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <Label className="text-white/40">Début timeline (s)</Label>
                  <Input
                    className="h-7 mt-0.5 bg-[#1f1e1c] border-white/10 font-mono text-[10px]"
                    value={selectedClip.startOnTimeline.toFixed(2)}
                    onChange={(e) =>
                      updateClip(selectedTrackId, selectedClip.id, {
                        startOnTimeline: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-white/40">Durée</Label>
                  <Input
                    className="h-7 mt-0.5 bg-[#1f1e1c] border-white/10 font-mono text-[10px]"
                    value={selectedClip.duration.toFixed(2)}
                    onChange={(e) =>
                      updateClip(selectedTrackId, selectedClip.id, {
                        duration: Math.max(0.1, Number(e.target.value) || 0.1),
                      })
                    }
                  />
                </div>
              </div>
              {selectedTrackIsVideo ? (
                <div className="space-y-2 text-[10px] border-t border-white/10 pt-2">
                  <div>
                    <Label className="text-white/40">sourceRef (multi-fichier)</Label>
                    <Input
                      className="h-7 mt-0.5 bg-[#1f1e1c] border-white/10 font-mono text-[10px]"
                      placeholder="main"
                      value={String(selectedClip.sourceRef ?? '')}
                      onChange={(e) =>
                        updateClip(selectedTrackId, selectedClip.id, { sourceRef: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-white/40">Opacité export</Label>
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={[typeof selectedClip.opacity === 'number' ? selectedClip.opacity : 1]}
                      onValueChange={(v) =>
                        updateClip(selectedTrackId, selectedClip.id, {
                          opacity: Math.max(0, Math.min(1, Array.isArray(v) ? v[0] : v)),
                        })
                      }
                      className="mt-1"
                    />
                    <p className="text-[10px] font-mono text-white/45 mt-0.5">
                      {(
                        (typeof selectedClip.opacity === 'number' ? selectedClip.opacity : 1) * 100
                      ).toFixed(0)}
                      %
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <Label className="text-white/40">Trim IN (source s)</Label>
                  <Input
                    className="h-7 mt-0.5 bg-[#1f1e1c] border-white/10 font-mono text-[10px]"
                    value={String(selectedClip.trimIn ?? 0)}
                    onChange={(e) => {
                      const v = Math.max(0, Number(e.target.value) || 0);
                      let out = Number(selectedClip.trimOut) || 0;
                      if (out <= v) out = v + 0.1;
                      updateClip(selectedTrackId, selectedClip.id, {
                        trimIn: v,
                        trimOut: out,
                      });
                    }}
                  />
                </div>
                <div>
                  <Label className="text-white/40">Trim OUT (source s)</Label>
                  <Input
                    className="h-7 mt-0.5 bg-[#1f1e1c] border-white/10 font-mono text-[10px]"
                    value={String(selectedClip.trimOut ?? 0)}
                    onChange={(e) => {
                      const lo = Number(selectedClip.trimIn) || 0;
                      const v = Math.max(lo + 0.05, Number(e.target.value) || lo + 1);
                      updateClip(selectedTrackId, selectedClip.id, { trimOut: v });
                    }}
                  />
                </div>
              </div>
              {selectedTrackIsVideo && selectedClip.transitionIn && selectedClip.transitionOut ? (
                <div className="space-y-2 pt-1 border-t border-white/10">
                  <p className="text-[10px] text-white/45 uppercase">Transitions (export FFmpeg)</p>
                  {['transitionIn', 'transitionOut'].map((key) => {
                    const trn = selectedClip[key];
                    const type = String(trn?.type || 'cut');
                    const dur = Number(trn?.durationSec) || 0;
                    const label = key === 'transitionIn' ? 'Entrée' : 'Sortie';
                    return (
                      <div key={key} className="grid grid-cols-[1fr_72px] gap-2 items-end">
                        <div>
                          <Label className="text-white/40 text-[10px]">{label}</Label>
                          <select
                            className="mt-0.5 w-full h-7 rounded-md border border-white/10 bg-[#1f1e1c] px-2 text-[10px] text-white/90"
                            value={type}
                            onChange={(e) => {
                              const nextType = e.target.value;
                              const nextDur = nextType === 'cut' ? 0 : Math.max(0.1, dur || 0.4);
                              updateClip(selectedTrackId, selectedClip.id, {
                                [key]: transitionFromType(nextType, nextDur),
                              });
                            }}
                          >
                            {TRANSITION_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label className="text-white/40 text-[10px]">s</Label>
                          <Input
                            className="h-7 mt-0.5 bg-[#1f1e1c] border-white/10 font-mono text-[10px]"
                            disabled={type === 'cut'}
                            value={type === 'cut' ? '0' : dur.toFixed(2)}
                            onChange={(e) =>
                              updateClip(selectedTrackId, selectedClip.id, {
                                [key]: transitionFromType(type, Number(e.target.value) || 0),
                              })
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-[11px] text-white/35">Sélectionne un clip sur la timeline.</p>
          )}

          {project.markers.length > 0 ? (
            <div>
              <p className="text-[10px] text-white/40 uppercase mb-1">Marqueurs</p>
              <ul className="max-h-[120px] overflow-auto space-y-1 text-[10px] text-white/60">
                {project.markers.map((m) => (
                  <li key={m.id} className="flex justify-between gap-2">
                    <span className="truncate">{m.label || '—'}</span>
                    <button
                      type="button"
                      className="text-[color-mix(in_srgb,var(--coral)_80%,transparent)] hover:underline shrink-0"
                      onClick={() => onSeek(m.timeSec)}
                    >
                      {formatTc(m.timeSec)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
