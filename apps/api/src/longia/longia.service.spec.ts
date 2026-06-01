/**
 * Tests unitaires — LongiaService
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LongiaService } from './longia.service';
import { SupabaseService } from '../supabase/supabase.service';

const mockSupabase = { client: { from: jest.fn() } };
const mockConfig = { get: jest.fn().mockReturnValue(undefined) };

describe('LongiaService', () => {
  let service: LongiaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfig.get.mockReturnValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LongiaService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<LongiaService>(LongiaService);
  });

  it('1. chatCompletion → clé absente → retourne fallback', async () => {
    const result = await service.chatCompletion([
      { role: 'user', content: 'Bonjour' },
    ]);
    expect(typeof result).toBe('string');
    expect(result).toContain('Fallback');
  });

  it('2. chatCompletion → clé replace_me → retourne fallback', async () => {
    mockConfig.get.mockReturnValue('replace_me');
    const result = await service.chatCompletion([
      { role: 'user', content: 'Bonjour' },
    ]);
    expect(result).toContain('Fallback');
  });

  it('3. analyzeDocument → retourne objet analysis', async () => {
    const result = await service.analyzeDocument('Contenu à analyser.');
    expect(result).toHaveProperty('analysis');
    expect(typeof result.analysis).toBe('string');
  });

  it('4. coverPromptAssistant → retourne objet suggestions', async () => {
    const result = await service.coverPromptAssistant(
      'Un cours sur les mathématiques',
      'académique',
    );
    expect(result).toHaveProperty('suggestions');
  });

  it('5. streamChat → clé absente → yield message erreur + done', async () => {
    const chunks: { content: string; done: boolean }[] = [];
    for await (const chunk of service.streamChat([
      { role: 'user', content: 'test' },
    ])) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[chunks.length - 1].done).toBe(true);
    expect(chunks[0].content).toContain('DEEPSEEK_API_KEY');
  });
});
