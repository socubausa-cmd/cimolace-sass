/**
 * Tests unitaires — LiriVisionService
 *
 * Scénarios couverts :
 *  1.  describeImage → image trop petite → Error
 *  2.  describeImage → image trop volumineuse → Error
 *  3.  describeImage → clés absentes → Error (aucun fournisseur)
 *  4.  generateVisualImage → provider openai sans clé → Error
 *  5.  generateVisualImage → provider stability sans clé → Error
 *  6.  generateVisualImage → provider inconnu → Error
 *  7.  generateVisualImage → prompt vide → Error
 *  8.  segmentVision → clé OPENAI absente → Error
 *  9.  segmentVision → image trop petite → Error
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LiriVisionService } from './liri-vision.service';

const mockConfig = { get: jest.fn().mockReturnValue(undefined) };

// Minimal valid base64 image (100+ chars) — just padding
const VALID_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const HUGE_B64 = 'A'.repeat(6_300_000); // > 6.2M

describe('LiriVisionService', () => {
  let service: LiriVisionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfig.get.mockReturnValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiriVisionService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<LiriVisionService>(LiriVisionService);
  });

  // ── describeImage ─────────────────────────────────────────────────────────

  it('1. describeImage → image trop petite (<80 chars) → Error', async () => {
    await expect(
      service.describeImage({ imageBase64: 'abc123' }),
    ).rejects.toThrow('trop petite');
  });

  it('2. describeImage → image trop volumineuse → Error', async () => {
    await expect(
      service.describeImage({ imageBase64: HUGE_B64 }),
    ).rejects.toThrow('volumineuse');
  });

  it('3. describeImage → toutes clés absentes → Error aucun fournisseur', async () => {
    mockConfig.get.mockReturnValue(undefined);
    await expect(
      service.describeImage({ imageBase64: VALID_B64 }),
    ).rejects.toThrow('fournisseur');
  });

  it('4. describeImage → clé replace_me → Error aucun fournisseur', async () => {
    mockConfig.get.mockReturnValue('replace_me');
    await expect(
      service.describeImage({ imageBase64: VALID_B64 }),
    ).rejects.toThrow('fournisseur');
  });

  // ── generateVisualImage ───────────────────────────────────────────────────

  it('5. generateVisualImage → prompt vide → Error', async () => {
    await expect(service.generateVisualImage({ prompt: '' })).rejects.toThrow(
      'Prompt requis',
    );
  });

  it('6. generateVisualImage → provider openai sans clé → Error', async () => {
    mockConfig.get.mockReturnValue(undefined);
    await expect(
      service.generateVisualImage({
        prompt: 'Un paysage forestier',
        provider: 'openai',
      }),
    ).rejects.toThrow('OPENAI_API_KEY');
  });

  it('7. generateVisualImage → provider stability sans clé → Error', async () => {
    mockConfig.get.mockReturnValue(undefined);
    await expect(
      service.generateVisualImage({
        prompt: 'Un paysage forestier',
        provider: 'stability',
      }),
    ).rejects.toThrow('STABILITY_API_KEY');
  });

  it('8. generateVisualImage → provider inconnu → Error', async () => {
    await expect(
      service.generateVisualImage({
        prompt: 'Test',
        provider: 'unknown_provider',
      }),
    ).rejects.toThrow('Provider inconnu');
  });

  // ── segmentVision ─────────────────────────────────────────────────────────

  it('9. segmentVision → clé OPENAI absente → Error', async () => {
    mockConfig.get.mockReturnValue(undefined);
    await expect(
      service.segmentVision({ imageBase64: VALID_B64 }),
    ).rejects.toThrow('OPENAI_API_KEY');
  });

  it('10. segmentVision → image trop petite → Error', async () => {
    await expect(
      service.segmentVision({ imageBase64: 'small' }),
    ).rejects.toThrow('trop petite');
  });
});
