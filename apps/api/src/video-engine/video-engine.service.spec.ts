import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { VideoEngineService } from './video-engine.service';

type QueryResult = { data?: unknown; error?: { message: string } | null };

function chain(result: QueryResult) {
  const q: any = {
    select: jest.fn(() => q),
    eq: jest.fn(() => q),
    order: jest.fn(() => q),
    insert: jest.fn(() => q),
    update: jest.fn(() => q),
    delete: jest.fn(() => q),
    then: (resolve: (v: QueryResult) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
    single: jest.fn(async () => result),
  };
  return q;
}

function makeService(from: jest.Mock, config: Record<string, string> = {}) {
  const configSvc = { get: (key: string) => config[key] ?? undefined } as unknown as ConfigService;
  return new VideoEngineService({ client: { from } } as never, configSvc);
}

const TENANT_ID = 'tenant-abc';
const USER_ID = 'user-xyz';

const MOCK_ASSET = {
  id: 'asset-1',
  tenant_id: TENANT_ID,
  uploaded_by: USER_ID,
  provider: 'local',
  provider_asset_id: null,
  playback_id: null,
  playback_url: null,
  thumbnail_url: null,
  duration_sec: null,
  status: 'waiting',
  metadata: {},
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('VideoEngineService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('listAssets', () => {
    it('returns all assets for a tenant', async () => {
      const assets = [MOCK_ASSET];
      const q = chain({ data: assets });
      const from = jest.fn(() => q);
      const svc = makeService(from);

      const result = await svc.listAssets(TENANT_ID);

      expect(from).toHaveBeenCalledWith('video_assets');
      expect(result).toEqual(assets);
    });

    it('returns empty array when no assets', async () => {
      const q = chain({ data: null });
      const from = jest.fn(() => q);
      const svc = makeService(from);

      const result = await svc.listAssets(TENANT_ID);
      expect(result).toEqual([]);
    });
  });

  describe('getAsset', () => {
    it('returns asset when found', async () => {
      const q = chain({ data: MOCK_ASSET, error: null });
      const from = jest.fn(() => q);
      const svc = makeService(from);

      const result = await svc.getAsset(TENANT_ID, 'asset-1');
      expect(result).toEqual(MOCK_ASSET);
    });

    it('throws NotFoundException when asset not found', async () => {
      const q = chain({ data: null, error: { message: 'not found' } });
      const from = jest.fn(() => q);
      const svc = makeService(from);

      await expect(svc.getAsset(TENANT_ID, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createAsset — local provider', () => {
    it('creates a local asset when no provider keys set', async () => {
      const q = chain({ data: MOCK_ASSET, error: null });
      const from = jest.fn(() => q);
      const svc = makeService(from, {}); // no MUX or CF keys

      const result = await svc.createAsset(TENANT_ID, USER_ID, {
        title: 'Test video',
      });

      expect(from).toHaveBeenCalledWith('video_assets');
      expect(result).toEqual(MOCK_ASSET);
    });

    it('throws when DB insert fails', async () => {
      const q = chain({ data: null, error: { message: 'DB error' } });
      const from = jest.fn(() => q);
      const svc = makeService(from, {});

      await expect(
        svc.createAsset(TENANT_ID, USER_ID, { title: 'Fail' }),
      ).rejects.toThrow('DB error');
    });
  });

  describe('deleteAsset', () => {
    it('deletes existing asset', async () => {
      // First call returns the asset, second call for delete
      const getQ = chain({ data: MOCK_ASSET, error: null });
      const delQ = chain({ data: null, error: null });
      let callCount = 0;
      const from = jest.fn(() => {
        callCount++;
        return callCount === 1 ? getQ : delQ;
      });
      const svc = makeService(from);

      await expect(svc.deleteAsset(TENANT_ID, 'asset-1')).resolves.toBeUndefined();
    });

    it('throws when asset does not exist', async () => {
      const q = chain({ data: null, error: { message: 'not found' } });
      const from = jest.fn(() => q);
      const svc = makeService(from);

      await expect(svc.deleteAsset(TENANT_ID, 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('handleProviderWebhook', () => {
    it('handles mux video.asset.ready webhook', async () => {
      const q = chain({ data: null, error: null });
      const from = jest.fn(() => q);
      const svc = makeService(from);

      await svc.handleProviderWebhook('mux', {
        type: 'video.asset.ready',
        data: {
          id: 'mux-asset-id',
          playback_ids: [{ id: 'pb-123', policy: 'public' }],
          duration: 120.5,
          status: 'ready',
        },
      });

      expect(from).toHaveBeenCalledWith('video_assets');
    });

    it('handles unknown provider gracefully', async () => {
      const q = chain({ data: null, error: null });
      const from = jest.fn(() => q);
      const svc = makeService(from);

      await expect(
        svc.handleProviderWebhook('unknown', { type: 'test' }),
      ).resolves.toBeUndefined();
    });
  });
});
