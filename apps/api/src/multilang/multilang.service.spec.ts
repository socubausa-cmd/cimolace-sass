/**
 * Tests unitaires — MultilangService
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MultilangService } from './multilang.service';

const mockConfig = { get: jest.fn().mockReturnValue(undefined) };

describe('MultilangService', () => {
  let service: MultilangService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfig.get.mockReturnValue(undefined);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MultilangService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<MultilangService>(MultilangService);
  });

  it('1. translateContent → clé absente → retourne fallback', async () => {
    const result = await service.translateContent('Bonjour le monde', 'en');
    expect(result.targetLang).toBe('en');
    expect(result.translation).toContain('non disponible');
  });

  it('2. translateContent → clé replace_me → retourne fallback', async () => {
    mockConfig.get.mockReturnValue('replace_me');
    const result = await service.translateContent('Bonjour', 'ar', 'fr');
    expect(result.translation).toContain('non disponible');
  });

  it('3. multilangLive → traduction multi-langues → retourne objet par langue', async () => {
    const result = await service.multilangLive('Transcription du cours', [
      'en',
      'ar',
    ]);
    expect(result).toHaveProperty('en');
    expect(result).toHaveProperty('ar');
  });

  it('4. multilangVideo → retourne titre + translations', async () => {
    const result = await service.multilangVideo(
      'Contenu vidéo',
      ['en'],
      'Titre du cours',
    );
    expect(result).toHaveProperty('title', 'Titre du cours');
    expect(result).toHaveProperty('translations');
    expect(result.translations).toHaveProperty('en');
  });
});
