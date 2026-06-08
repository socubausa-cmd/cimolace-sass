import { ConfigService } from '@nestjs/config';
import { SupabaseService } from './supabase.service';

// ── createClient mock ─────────────────────────────────────────────────────────
const mockClient = { from: jest.fn(), auth: {} };

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockClient),
}));

import { createClient } from '@supabase/supabase-js';
const mockCreateClient = createClient as jest.MockedFunction<
  typeof createClient
>;

// ── helpers ───────────────────────────────────────────────────────────────────
const TEST_URL = 'https://test.supabase.co';
const TEST_KEY = 'service-role-key-test';

function makeConfig(url = TEST_URL, key = TEST_KEY): ConfigService {
  return {
    getOrThrow: jest.fn((k: string) => {
      if (k === 'SUPABASE_URL') return url;
      if (k === 'SUPABASE_SERVICE_ROLE_KEY') return key;
      throw new Error(`Missing env: ${k}`);
    }),
  } as unknown as ConfigService;
}

// ── tests ─────────────────────────────────────────────────────────────────────
describe('SupabaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockReturnValue(mockClient as any);
  });

  describe('constructor', () => {
    it('creates the Supabase client with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY', () => {
      const config = makeConfig();
      new SupabaseService(config);

      expect(mockCreateClient).toHaveBeenCalledTimes(1);
      expect(mockCreateClient).toHaveBeenCalledWith(
        TEST_URL,
        TEST_KEY,
        expect.objectContaining({ auth: { persistSession: false } }),
      );
    });

    it('calls getOrThrow (not get) for SUPABASE_URL', () => {
      const config = makeConfig();
      new SupabaseService(config);

      expect(config.getOrThrow).toHaveBeenCalledWith('SUPABASE_URL');
    });

    it('calls getOrThrow (not get) for SUPABASE_SERVICE_ROLE_KEY', () => {
      const config = makeConfig();
      new SupabaseService(config);

      expect(config.getOrThrow).toHaveBeenCalledWith(
        'SUPABASE_SERVICE_ROLE_KEY',
      );
    });

    it('passes persistSession: false in auth options', () => {
      const config = makeConfig();
      new SupabaseService(config);

      const [, , options] = mockCreateClient.mock.calls[0];
      expect((options as any)?.auth?.persistSession).toBe(false);
    });

    it('throws when SUPABASE_URL is missing', () => {
      const config = {
        getOrThrow: jest.fn((k: string) => {
          if (k === 'SUPABASE_URL')
            throw new Error('SUPABASE_URL is not defined');
          return TEST_KEY;
        }),
      } as unknown as ConfigService;

      expect(() => new SupabaseService(config)).toThrow(
        'SUPABASE_URL is not defined',
      );
    });

    it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
      const config = {
        getOrThrow: jest.fn((k: string) => {
          if (k === 'SUPABASE_URL') return TEST_URL;
          throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined');
        }),
      } as unknown as ConfigService;

      expect(() => new SupabaseService(config)).toThrow(
        'SUPABASE_SERVICE_ROLE_KEY is not defined',
      );
    });
  });

  describe('client', () => {
    it('exposes the created client on the .client property', () => {
      const config = makeConfig();
      const service = new SupabaseService(config);

      expect(service.client).toBe(mockClient);
    });

    it('client property is readonly (set at construction, not replaced)', () => {
      const config = makeConfig();
      const service = new SupabaseService(config);
      const original = service.client;

      // The client created on construction is the one available
      expect(service.client).toBe(original);
    });

    it('each SupabaseService instance gets the client returned by createClient', () => {
      const client1 = { from: jest.fn(), id: 1 };
      const client2 = { from: jest.fn(), id: 2 };

      mockCreateClient
        .mockReturnValueOnce(client1 as any)
        .mockReturnValueOnce(client2 as any);

      const s1 = new SupabaseService(
        makeConfig('https://url1.supabase.co', 'key1'),
      );
      const s2 = new SupabaseService(
        makeConfig('https://url2.supabase.co', 'key2'),
      );

      expect(s1.client).toBe(client1);
      expect(s2.client).toBe(client2);
    });

    it('passes the exact URL and key from config to createClient', () => {
      const customUrl = 'https://custom-project.supabase.co';
      const customKey = 'custom-service-role-key-xyz';

      new SupabaseService(makeConfig(customUrl, customKey));

      expect(mockCreateClient).toHaveBeenCalledWith(
        customUrl,
        customKey,
        expect.anything(),
      );
    });
  });
});
