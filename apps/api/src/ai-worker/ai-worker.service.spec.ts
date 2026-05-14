import { ConfigService } from '@nestjs/config';
import { AiWorkerService } from './ai-worker.service';

type QueryResult = { data?: unknown; error?: { message: string } | null };

function chain(result: QueryResult) {
  const q: any = {
    select: jest.fn(() => q),
    eq: jest.fn(() => q),
    order: jest.fn(() => q),
    limit: jest.fn(() => q),
    insert: jest.fn(() => q),
    update: jest.fn(() => q),
    then: (resolve: (v: QueryResult) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
    single: jest.fn(async () => result),
  };
  return q;
}

function makeService(from: jest.Mock, config: Record<string, string> = {}) {
  const configSvc = { get: (key: string) => config[key] ?? undefined } as unknown as ConfigService;
  return new AiWorkerService({ client: { from } } as never, configSvc);
}

const TENANT_ID = 'tenant-1';

const MOCK_JOB = {
  id: 'job-1',
  tenant_id: TENANT_ID,
  type: 'summarize' as const,
  payload: { content: 'Hello world test content for summarization purposes.' },
  result: null,
  status: 'queued' as const,
  model: 'deepseek-chat',
  error_msg: null,
  created_at: '2026-01-01T00:00:00Z',
};

describe('AiWorkerService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('enqueue', () => {
    it('creates a new AI job', async () => {
      const q = chain({ data: MOCK_JOB, error: null });
      const from = jest.fn(() => q);
      const svc = makeService(from);

      // Mock processNext so it doesn't actually run an AI call
      jest.spyOn(svc as any, 'processNext').mockResolvedValue(undefined);

      const result = await svc.enqueue(TENANT_ID, {
        type: 'summarize',
        payload: { content: 'Test content' },
      });

      expect(from).toHaveBeenCalledWith('ai_jobs');
      expect(result).toEqual(MOCK_JOB);
    });

    it('throws when DB insert fails', async () => {
      const q = chain({ data: null, error: { message: 'DB insert failed' } });
      const from = jest.fn(() => q);
      const svc = makeService(from);

      jest.spyOn(svc as any, 'processNext').mockResolvedValue(undefined);

      await expect(
        svc.enqueue(TENANT_ID, { type: 'summarize', payload: { content: 'x' } }),
      ).rejects.toThrow('DB insert failed');
    });
  });

  describe('listJobs', () => {
    it('returns jobs list', async () => {
      const jobs = [MOCK_JOB];
      const q = chain({ data: jobs });
      const from = jest.fn(() => q);
      const svc = makeService(from);

      const result = await svc.listJobs(TENANT_ID);
      expect(result).toEqual(jobs);
    });

    it('returns empty array when no jobs', async () => {
      const q = chain({ data: null });
      const from = jest.fn(() => q);
      const svc = makeService(from);

      const result = await svc.listJobs(TENANT_ID);
      expect(result).toEqual([]);
    });
  });

  describe('getJob', () => {
    it('returns job when found', async () => {
      const q = chain({ data: MOCK_JOB });
      const from = jest.fn(() => q);
      const svc = makeService(from);

      const result = await svc.getJob(TENANT_ID, 'job-1');
      expect(result).toEqual(MOCK_JOB);
    });

    it('returns null when not found', async () => {
      const q = chain({ data: null });
      const from = jest.fn(() => q);
      const svc = makeService(from);

      const result = await svc.getJob(TENANT_ID, 'bad-id');
      expect(result).toBeNull();
    });
  });

  describe('processNext', () => {
    it('does nothing when no queued jobs', async () => {
      const q = chain({ data: [] });
      const from = jest.fn(() => q);
      const svc = makeService(from);

      await expect(svc.processNext()).resolves.toBeUndefined();
    });

    it('processes a queued job and marks it completed', async () => {
      const completedJob = { ...MOCK_JOB, status: 'completed' };
      let callCount = 0;

      const from = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          // Fetch queued jobs
          return chain({ data: [MOCK_JOB] });
        }
        // All subsequent DB calls (update processing, update completed)
        return chain({ data: completedJob, error: null });
      });

      // Config with no API keys → uses mock response
      const svc = makeService(from, {});

      await svc.processNext();

      // Should have called from() at least 3 times:
      // 1) list queued jobs, 2) update to processing, 3) update to completed
      expect(from).toHaveBeenCalledTimes(3);
    });

    it('marks job as failed when LLM throws', async () => {
      const badJob = {
        ...MOCK_JOB,
        type: 'enhance_segment' as const,
        payload: {}, // missing 'content' → will throw
      };

      let callCount = 0;
      const from = jest.fn(() => {
        callCount++;
        if (callCount === 1) return chain({ data: [badJob] });
        return chain({ data: null, error: null });
      });

      const svc = makeService(from, {});
      await svc.processNext();

      // Calls: 1) list, 2) update processing, 3) update failed
      expect(from).toHaveBeenCalledTimes(3);
    });

    it('is re-entrant safe (skips if already processing)', async () => {
      const q = chain({ data: [MOCK_JOB] });
      const from = jest.fn(() => q);
      const svc = makeService(from, {});

      // Simulate already processing
      (svc as any).processing = true;
      await svc.processNext();

      // Should not have called from() at all
      expect(from).not.toHaveBeenCalled();
    });
  });

  describe('mock LLM responses (no API key)', () => {
    it('enhance_segment returns mock result when DeepSeek not configured', async () => {
      const job = {
        ...MOCK_JOB,
        type: 'enhance_segment' as const,
        payload: { content: 'Contenu à améliorer', segmentId: 'seg-1' },
        model: 'deepseek-chat',
      };

      let callCount = 0;
      const from = jest.fn(() => {
        callCount++;
        if (callCount === 1) return chain({ data: [job] });
        return chain({ data: null, error: null });
      });

      const svc = makeService(from, {}); // no DEEPSEEK_API_KEY
      await svc.processNext();

      // 1) list, 2) mark processing, 3) update segment (segmentId provided), 4) mark completed
      expect(from).toHaveBeenCalledTimes(4);
    });
  });
});
