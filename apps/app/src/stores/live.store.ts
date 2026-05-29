import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { BoardState } from '@/engines/types';

type LiveStore = {
  // State
  liveStep: number;
  maxSteps: number;
  spotlightTarget: string | null;
  dimmedIds: string[];
  studentViewState: BoardState | null;
  teacherViewState: BoardState | null;
  isLiveActive: boolean;
  sessionId: string | null;
  participantCount: number;
  broadcastBusy: boolean;
  broadcastStatus: string;

  // Actions — progression
  setLiveStep: (step: number) => void;
  setMaxSteps: (max: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  resetSteps: () => void;

  // Actions — spotlight
  setSpotlightTarget: (id: string | null) => void;
  setDimmedIds: (ids: string[]) => void;
  clearSpotlight: () => void;

  // Actions — views
  setStudentViewState: (state: BoardState | null) => void;
  setTeacherViewState: (state: BoardState | null) => void;

  // Actions — session
  startLive: (sessionId: string) => void;
  stopLive: () => void;
  setParticipantCount: (count: number) => void;
  setBroadcastBusy: (busy: boolean) => void;
  setBroadcastStatus: (status: string) => void;
};

export const useLiveStore = create<LiveStore>()(
  devtools(
    (set, get) => ({
      liveStep: 0,
      maxSteps: 0,
      spotlightTarget: null,
      dimmedIds: [],
      studentViewState: null,
      teacherViewState: null,
      isLiveActive: false,
      sessionId: null,
      participantCount: 0,
      broadcastBusy: false,
      broadcastStatus: '',

      setLiveStep: (step) => set({ liveStep: Math.max(0, Math.min(step, get().maxSteps)) }),
      setMaxSteps: (max) => set({ maxSteps: max }),
      nextStep: () => set((s) => ({ liveStep: Math.min(s.liveStep + 1, s.maxSteps) })),
      prevStep: () => set((s) => ({ liveStep: Math.max(s.liveStep - 1, 0) })),
      resetSteps: () => set({ liveStep: 0 }),

      setSpotlightTarget: (id) => set({ spotlightTarget: id }),
      setDimmedIds: (ids) => set({ dimmedIds: ids }),
      clearSpotlight: () => set({ spotlightTarget: null, dimmedIds: [] }),

      setStudentViewState: (state) => set({ studentViewState: state }),
      setTeacherViewState: (state) => set({ teacherViewState: state }),

      startLive: (sessionId) => set({ isLiveActive: true, sessionId, liveStep: 0 }),
      stopLive: () => set({ isLiveActive: false, sessionId: null, participantCount: 0, broadcastStatus: '' }),
      setParticipantCount: (count) => set({ participantCount: count }),
      setBroadcastBusy: (busy) => set({ broadcastBusy: busy }),
      setBroadcastStatus: (status) => set({ broadcastStatus: status }),
    }),
    { name: 'live-store' },
  ),
);
