import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { MedChartingService } from './med-charting.service';
import { SupabaseService } from '../supabase/supabase.service';

// ─── Mocks globaux ────────────────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockConfig = { get: jest.fn() };

/**
 * Crée une chaîne Supabase fluide dont chaque méthode retourne la même chaîne,
 * sauf `.single()` et `.order()` qui sont configurés individuellement par test.
 */
function buildChain(
  singleResults: Array<{ data: unknown; error: unknown }> = [],
) {
  const single = jest.fn();
  singleResults.forEach((r) => single.mockResolvedValueOnce(r));

  const chain: Record<string, jest.Mock> = {};
  const methods = ['insert', 'update', 'select', 'eq', 'neq', 'in', 'order'];
  methods.forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.single = single;
  return chain;
}

const mockSupabase = { client: { from: jest.fn() } };

// ─── Tenant fixture ───────────────────────────────────────────────────────

const tenant = {
  id: 'tenant-uuid',
  slug: 'isna',
  name: 'ISNA',
  userRole: 'practitioner',
};

// ─── Suite ────────────────────────────────────────────────────────────────

describe('MedChartingService', () => {
  let service: MedChartingService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedChartingService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<MedChartingService>(MedChartingService);
  });

  // ── transcribeAudio ─────────────────────────────────────────────────────

  describe('transcribeAudio', () => {
    it('lève 500 si DEEPGRAM_API_KEY absent', async () => {
      mockConfig.get.mockReturnValue(undefined);
      await expect(
        service.transcribeAudio('https://example.com/audio.mp3'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('transcrit avec succès via Deepgram', async () => {
      mockConfig.get.mockReturnValue('dg-test-key');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            channels: [
              {
                alternatives: [
                  { transcript: 'Le patient se plaint de fièvre.' },
                ],
              },
            ],
          },
        }),
      });

      const result = await service.transcribeAudio(
        'https://example.com/audio.mp3',
        'fr',
      );
      expect(result).toBe('Le patient se plaint de fièvre.');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('deepgram.com'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('lève 500 si Deepgram retourne une erreur HTTP', async () => {
      mockConfig.get.mockReturnValue('dg-test-key');
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(
        service.transcribeAudio('https://example.com/audio.mp3'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('lève 500 si la transcription est vide', async () => {
      mockConfig.get.mockReturnValue('dg-test-key');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: { channels: [{ alternatives: [{ transcript: '   ' }] }] },
        }),
      });

      await expect(
        service.transcribeAudio('https://example.com/audio.mp3'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ── generateSoapNote ────────────────────────────────────────────────────

  describe('generateSoapNote', () => {
    const soapJson = JSON.stringify({
      subjective: 'Fièvre 39°C depuis 2 jours',
      objective: 'Gorge rouge, ganglions cervicaux',
      assessment: 'Angine bactérienne probable',
      plan: 'Amoxicilline 1g x2/j pendant 7 jours',
      free_text: null,
      icd10_suggestions: [{ code: 'J03.9', description: 'Amygdalite aiguë' }],
    });

    it('lève 500 si ANTHROPIC_API_KEY absent', async () => {
      mockConfig.get.mockReturnValue(undefined);
      await expect(service.generateSoapNote('transcript')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('génère une note SOAP structurée via Claude', async () => {
      mockConfig.get.mockReturnValue('sk-ant-test');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: soapJson }],
          usage: { output_tokens: 300 },
        }),
      });

      const result = await service.generateSoapNote(
        'Transcript de la consultation',
      );

      expect(result.subjective).toBe('Fièvre 39°C depuis 2 jours');
      expect(result.assessment).toBe('Angine bactérienne probable');
      expect(result.icd10_suggestions).toHaveLength(1);
      expect(result.icd10_suggestions[0].code).toBe('J03.9');
      expect(result.tokens_used).toBe(300);
      expect(result.model_used).toBe('claude-3-5-sonnet-20241022');
    });

    it('accepte une réponse Claude enveloppée dans des backticks', async () => {
      mockConfig.get.mockReturnValue('sk-ant-test');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: `\`\`\`json\n${soapJson}\n\`\`\`` }],
          usage: { output_tokens: 200 },
        }),
      });

      const result = await service.generateSoapNote('Transcript');
      expect(result.subjective).toBe('Fièvre 39°C depuis 2 jours');
    });

    it('lève 500 si Claude retourne du JSON invalide', async () => {
      mockConfig.get.mockReturnValue('sk-ant-test');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: 'Voici la note : ...' }],
          usage: { output_tokens: 50 },
        }),
      });

      await expect(service.generateSoapNote('Transcript')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('lève 500 si Claude retourne une erreur HTTP', async () => {
      mockConfig.get.mockReturnValue('sk-ant-test');
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 529,
        text: async () => 'Overloaded',
      });

      await expect(service.generateSoapNote('Transcript')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('intègre le context_hint dans le message utilisateur', async () => {
      mockConfig.get.mockReturnValue('sk-ant-test');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: soapJson }],
          usage: { output_tokens: 100 },
        }),
      });

      await service.generateSoapNote('Transcript', 'Patient diabétique type 2');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages[0].content).toContain('Patient diabétique type 2');
    });
  });

  // ── getJobStatus ─────────────────────────────────────────────────────────

  describe('getJobStatus', () => {
    it('retourne le job si trouvé', async () => {
      const jobRow = { id: 'job-1', status: 'completed', tenant_id: tenant.id };
      const chain = buildChain([{ data: jobRow, error: null }]);
      mockSupabase.client.from.mockReturnValueOnce(chain);

      const result = await service.getJobStatus(tenant as any, 'job-1');
      expect(result.id).toBe('job-1');
      expect(result.status).toBe('completed');
    });

    it('lève NotFoundException si job absent', async () => {
      const chain = buildChain([
        { data: null, error: { message: 'not found' } },
      ]);
      mockSupabase.client.from.mockReturnValueOnce(chain);

      await expect(
        service.getJobStatus(tenant as any, 'job-inexistant'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── listJobsForPatient ───────────────────────────────────────────────────

  describe('listJobsForPatient', () => {
    it('retourne la liste des jobs du patient', async () => {
      const jobs = [
        { id: 'job-1', status: 'completed' },
        { id: 'job-2', status: 'failed' },
      ];
      // listJobsForPatient : from().select().eq().eq().order()
      const chain = buildChain();
      chain.order = jest
        .fn()
        .mockResolvedValueOnce({ data: jobs, error: null });
      mockSupabase.client.from.mockReturnValueOnce(chain);

      const result = await service.listJobsForPatient(
        tenant as any,
        'patient-1',
      );
      expect(result).toHaveLength(2);
    });
  });

  // ── startChartingJob ─────────────────────────────────────────────────────

  describe('startChartingJob', () => {
    it("lève NotFoundException si le patient n'existe pas", async () => {
      // from('med_patients').select().eq().eq().single() → null
      const chain = buildChain([
        { data: null, error: { message: 'not found' } },
      ]);
      mockSupabase.client.from.mockReturnValueOnce(chain);

      await expect(
        service.startChartingJob(tenant as any, 'practitioner-1', {
          patient_id: 'patient-inexistant',
          audio_url: 'https://example.com/audio.mp3',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('crée le job et démarre le pipeline en arrière-plan', async () => {
      const createdJob = {
        id: 'job-new',
        status: 'pending',
        tenant_id: tenant.id,
        patient_id: 'patient-1',
        practitioner_id: 'practitioner-1',
        audio_url: 'https://example.com/audio.mp3',
        note_id: null,
      };

      // from('med_patients') → patient trouvé
      const patientChain = buildChain([
        { data: { id: 'patient-1' }, error: null },
      ]);
      mockSupabase.client.from.mockReturnValueOnce(patientChain);

      // from('med_charting_jobs') → job créé
      const jobChain = buildChain([{ data: createdJob, error: null }]);
      mockSupabase.client.from.mockReturnValueOnce(jobChain);

      // Spy sur runPipeline pour ne pas exécuter le vrai pipeline
      const runPipelineSpy = jest
        .spyOn(service as any, 'runPipeline')
        .mockResolvedValueOnce(undefined);

      const result = await service.startChartingJob(
        tenant as any,
        'practitioner-1',
        {
          patient_id: 'patient-1',
          audio_url: 'https://example.com/audio.mp3',
        },
      );

      expect(result.id).toBe('job-new');
      expect(result.status).toBe('pending');
      expect(runPipelineSpy).toHaveBeenCalled();
    });
  });
});
