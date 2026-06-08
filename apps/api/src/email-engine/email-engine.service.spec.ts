/**
 * Tests unitaires — EmailEngineService
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailEngineService } from './email-engine.service';
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
  chain.maybeSingle = jest.fn().mockResolvedValue(singleResult);
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

describe('EmailEngineService', () => {
  let service: EmailEngineService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSupabase.client.from.mockReset();
    // Default: no Resend key
    mockConfig.get.mockImplementation((key: string) => {
      if (key === 'RESEND_API_KEY') return '';
      if (key === 'RESEND_FROM') return 'noreply@test.com';
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailEngineService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<EmailEngineService>(EmailEngineService);
  });

  it('1. listTemplates → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: [], error: null }),
    );
    const result = await service.listTemplates(TENANT_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it('2. createTemplate → retourne template', async () => {
    const fakeTemplate = {
      id: 'tpl-001',
      template_key: 'welcome',
      subject: 'Bienvenue',
    };
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: fakeTemplate, error: null }),
    );
    const result = await service.createTemplate(TENANT_ID, {
      template_key: 'welcome',
      subject: 'Bienvenue',
      html_content: '<p>Bonjour</p>',
    } as any);
    expect(result).toMatchObject({ id: 'tpl-001' });
  });

  it('3. sendEmail → clé absente → retourne status disabled', async () => {
    const result = await service.sendEmail(TENANT_ID, {
      to: 'dest@example.com',
      templateKey: 'welcome',
      data: {},
    });
    expect(result).toMatchObject({ status: 'disabled' });
  });

  it('4. sendEmail → clé replace_me → retourne status disabled', async () => {
    mockConfig.get.mockImplementation((key: string) => {
      if (key === 'RESEND_API_KEY') return 'replace_me';
      return '';
    });
    const module = await Test.createTestingModule({
      providers: [
        EmailEngineService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    const svc = module.get<EmailEngineService>(EmailEngineService);

    const result = await svc.sendEmail(TENANT_ID, {
      to: 'dest@example.com',
      templateKey: 'welcome',
      data: {},
    });
    expect(result).toMatchObject({ status: 'disabled' });
  });

  it('5. listCampaigns → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: [], error: null }),
    );
    const result = await service.listCampaigns(TENANT_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it('6. listInboundEmails → retourne tableau', async () => {
    mockSupabase.client.from.mockReturnValueOnce(
      buildChain({ data: [], error: null }),
    );
    const result = await service.listInboundEmails(TENANT_ID);
    expect(Array.isArray(result)).toBe(true);
  });
});
