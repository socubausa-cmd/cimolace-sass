import { create } from 'zustand';
import {
  createEmptyNleProject,
  parseNleProject,
  syncVideoTrackFromChapters,
  recomputeDuration,
  createClip,
} from '@/lib/nleEngine/nleProjectModel';

export const useNleProjectStore = create((set, get) => ({
  project: createEmptyNleProject(),
  selectedClipId: null,
  selectedTrackId: null,
  /** Zoom timeline : pixels par seconde */
  pixelsPerSecond: 88,

  hydrate: (raw) => set({ project: parseNleProject(raw) }),

  reset: () =>
    set({
      project: createEmptyNleProject(),
      selectedClipId: null,
      selectedTrackId: null,
    }),

  setPixelsPerSecond: (n) =>
    set({ pixelsPerSecond: Math.max(24, Math.min(480, Math.floor(Number(n) || 88))) }),

  syncChapters: (chapters, durationSec) =>
    set((s) => ({
      project: recomputeDuration(
        syncVideoTrackFromChapters({ ...s.project }, chapters, durationSec || 600)
      ),
    })),

  selectClip: (trackId, clipId) => set({ selectedTrackId: trackId, selectedClipId: clipId }),

  clearSelection: () => set({ selectedClipId: null, selectedTrackId: null }),

  updateClip: (trackId, clipId, patch) =>
    set((s) => {
      const tr = s.project.tracks.find((t) => t.id === trackId);
      if (!tr) return s;
      const clips = tr.clips.map((c) =>
        c.id === clipId ? createClip({ ...c, ...patch, id: c.id }) : c
      );
      const tracks = s.project.tracks.map((t) => (t.id === trackId ? { ...t, clips } : t));
      return { project: recomputeDuration({ ...s.project, tracks }) };
    }),

  addMarker: (timeSec, label) =>
    set((s) => ({
      project: {
        ...s.project,
        markers: [
          ...s.project.markers,
          {
            id: `mk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            timeSec: Math.max(0, Number(timeSec) || 0),
            label: String(label || ''),
          },
        ],
      },
    })),

  setMasterVolumeDb: (db) =>
    set((s) => ({
      project: {
        ...s.project,
        mix: { ...s.project.mix, masterVolumeDb: Math.max(-96, Math.min(12, Number(db) || 0)) },
      },
    })),

  setProjectName: (name) => set((s) => ({ project: { ...s.project, name: String(name || '') } })),

  /** Objet sérialisable pour Supabase JSONB */
  getSerializableProject: () => JSON.parse(JSON.stringify(get().project)),
}));
