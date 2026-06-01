/**
 * Tests unitaires — SmsEngineService
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SmsEngineService } from './sms-engine.service';
import { SupabaseService } from '../supabase/supabase.service';

function buildChain(
  singleResult = { data: null as unknown, error: null as unknown },
) {
  const chain: Record<string, jest.Mock> = {};
  [
    'select',
    'insert',
    'update',
    'upsert',
    'delete',
    'eq',
    'neq',
    'in',
    'limit',
    'order',
  ].forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.single = jest.fn().mockResolvedValue(singleResult);
  chain.then = jest
    .fn()
    .mockImplementation((cb: (v: unknown) => unknown) =>
      Promise.resolve(cb({ data: [], error: null })),
    );
  return chain;
}

const mockSupabase = { client: { from: jest.fn() } };
const mockConfig = { get: jest.fn() };
const TENANT_ID = 'tenant-0001';

describe('SmsEngineService', () => {
  let service: SmsEngineService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabase.client.from.mockReset();
    mockConfig.get.mockImplementation((key: string) => {
      if (key === 'TWILIO_ACCOUNT_SID') return '';
      if (key === 'TWILIO_AUTH_TOKEN') return '';
      if (key === 'TWILIO_PHONE_NUMBER') return '';
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsEngineService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<SmsEngineService>(SmsEngineService);
  });

  it('1. sendSms → clé Twilio absente → status disabled', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: null }),
    ); // insert log
    const result = await service.sendSms(TENANT_ID, '+33600000000', 'Test SMS');
    expect(result).toMatchObject({ status: 'disabled' });
  });

  it('2. sendWhatsApp → insère log → retourne placeholder', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: null, error: null }),
    );
    const result = await service.sendWhatsApp(
      TENANT_ID,
      '+33600000000',
      'welcome',
      ['Prénom'],
    );
    expect(result).toMatchObject({ status: 'whatsapp_placeholder' });
  });

  it('3. getLogs SMS → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: [], error: null }),
    );
    const result = await service.getLogs(TENANT_ID, 'sms');
    expect(Array.isArray(result)).toBe(true);
  });

  it('4. getLogs WhatsApp → requête whatsapp_logs', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: [], error: null }),
    );
    const result = await service.getLogs(TENANT_ID, 'whatsapp');
    expect(Array.isArray(result)).toBe(true);
  });
});
