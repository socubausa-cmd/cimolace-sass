/**
 * Tests unitaires — PawaPayService
 *
 * Scénarios couverts :
 *  1.  isConfigured → clé absente → false
 *  2.  isConfigured → clé configurée → true
 *  3.  initiateDeposit → non configuré → ServiceUnavailableException
 *  4.  verifyWebhookSignature → signature correcte → true
 *  5.  verifyWebhookSignature → signature incorrecte → false
 *  6.  listActiveConfigurations → non configuré → ServiceUnavailableException
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { PawaPayService } from './pawapay.service';
import { createHmac } from 'crypto';

const mockConfig = { get: jest.fn() };

describe('PawaPayService', () => {
  let service: PawaPayService;

  const buildService = async (token: string, secret = '') => {
    mockConfig.get.mockImplementation((key: string) => {
      if (key === 'PAWAPAY_API_TOKEN') return token;
      if (key === 'PAWAPAY_SIGNING_SECRET') return secret;
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PawaPayService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    return module.get<PawaPayService>(PawaPayService);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. isConfigured → clé absente → false', async () => {
    service = await buildService('');
    expect(service.isConfigured).toBe(false);
  });

  it('2. isConfigured → clé replace_me → false', async () => {
    service = await buildService('replace_me');
    expect(service.isConfigured).toBe(false);
  });

  it('3. isConfigured → clé configurée → true', async () => {
    service = await buildService('pawa_real_token_123');
    expect(service.isConfigured).toBe(true);
  });

  it('4. initiateDeposit → non configuré → ServiceUnavailableException', async () => {
    service = await buildService('');
    await expect(
      service.initiateDeposit({
        depositId: 'd-001',
        amount: '1000',
        currency: 'XAF',
        correspondent: 'MTN_MOMO_CMR',
        payer: { type: 'MSISDN', address: { value: '237690000000' } },
        statementDescription: 'Test',
      } as any),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('5. verifyCallbackSignature → signature HMAC correcte → true', async () => {
    const secret = 'my-signing-secret';
    service = await buildService('token', secret);

    const payload = Buffer.from(
      JSON.stringify({ event: 'DEPOSIT_COMPLETED', depositId: 'd-001' }),
    );
    const sig = createHmac('sha256', secret).update(payload).digest('hex');

    const result = service.verifyCallbackSignature(payload, sig);
    expect(result).toBe(true);
  });

  it('6. verifyCallbackSignature → signature incorrecte → false', async () => {
    service = await buildService('token', 'my-signing-secret');
    const result = service.verifyCallbackSignature(
      Buffer.from('{"event":"test"}'),
      'wrong-sig',
    );
    expect(result).toBe(false);
  });

  it('7. getActiveConfig → non configuré → ServiceUnavailableException', async () => {
    service = await buildService('');
    await expect(service.getActiveConfig()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
