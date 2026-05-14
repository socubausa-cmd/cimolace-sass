import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { AIMessage, AIJob, CoachFeedback, GenerationJob, AITaskType } from '@/engines/types';

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

type AIStore = {
  // Coach state
  coachMessages: AIMessage[];
  coachFeedback: CoachFeedback | null;
  coachBusy: boolean;

  // Architect state
  architectMessages: AIMessage[];
  architectBusy: boolean;

  // Jobs
  pendingJobs: GenerationJob[];
  completedJobs: GenerationJob[];

  // Active generation
  activeJobId: string | null;

  // Actions — coach
  addCoachMessage: (role: 'user' | 'assistant', content: string, taskType?: AITaskType) => void;
  setCoachFeedback: (feedback: CoachFeedback | null) => void;
  setCoachBusy: (busy: boolean) => void;
  clearCoachMessages: () => void;

  // Actions — architect
  addArchitectMessage: (role: 'user' | 'assistant', content: string) => void;
  setArchitectBusy: (busy: boolean) => void;
  clearArchitectMessages: () => void;

  // Actions — jobs
  createJob: (type: AITaskType) => GenerationJob;
  updateJob: (id: string, patch: Partial<GenerationJob>) => void;
  completeJob: (id: string, result: unknown) => void;
  failJob: (id: string) => void;
  clearCompletedJobs: () => void;
};

export const useAIStore = create<AIStore>()(
  devtools(
    (set, get) => ({
      coachMessages: [],
      coachFeedback: null,
      coachBusy: false,
      architectMessages: [],
      architectBusy: false,
      pendingJobs: [],
      completedJobs: [],
      activeJobId: null,

      addCoachMessage: (role, content, taskType) => set((s) => ({
        coachMessages: [
          ...s.coachMessages,
          { id: genId(), role, content, timestamp: new Date().toISOString(), taskType },
        ],
      })),

      setCoachFeedback: (feedback) => set({ coachFeedback: feedback }),
      setCoachBusy: (busy) => set({ coachBusy: busy }),
      clearCoachMessages: () => set({ coachMessages: [], coachFeedback: null }),

      addArchitectMessage: (role, content) => set((s) => ({
        architectMessages: [
          ...s.architectMessages,
          { id: genId(), role, content, timestamp: new Date().toISOString() },
        ],
      })),

      setArchitectBusy: (busy) => set({ architectBusy: busy }),
      clearArchitectMessages: () => set({ architectMessages: [] }),

      createJob: (type) => {
        const job: GenerationJob = { id: genId(), type, progress: 0, status: 'running' };
        set((s) => ({ pendingJobs: [...s.pendingJobs, job], activeJobId: job.id }));
        return job;
      },

      updateJob: (id, patch) => set((s) => ({
        pendingJobs: s.pendingJobs.map((j) => j.id === id ? { ...j, ...patch } : j),
      })),

      completeJob: (id, result) => set((s) => {
        const job = s.pendingJobs.find((j) => j.id === id);
        if (!job) return s;
        const completed: GenerationJob = { ...job, status: 'done', progress: 100, result } as GenerationJob & { result: unknown };
        return {
          pendingJobs: s.pendingJobs.filter((j) => j.id !== id),
          completedJobs: [completed, ...s.completedJobs.slice(0, 19)],
          activeJobId: s.activeJobId === id ? null : s.activeJobId,
        };
      }),

      failJob: (id) => set((s) => ({
        pendingJobs: s.pendingJobs.map((j) => j.id === id ? { ...j, status: 'error' } : j),
        activeJobId: s.activeJobId === id ? null : s.activeJobId,
      })),

      clearCompletedJobs: () => set({ completedJobs: [] }),
    }),
    { name: 'ai-store' },
  ),
);
