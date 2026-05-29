import { z } from 'zod';
import { startOrchestrator } from '@/lib/liri-orchestrator/service';

const startSchema = z.object({
  projectId: z.string().min(1).optional(),
  rawText: z.string().min(20).max(120000),
  courseType: z
    .enum(['spiritual', 'math', 'science', 'keynote', 'technical', 'business', 'general'])
    .optional(),
  memory: z
    .object({
      course_style: z.string().optional(),
      pedagogy_model: z.string().optional(),
      visual_identity: z.string().optional(),
      tone: z.string().optional(),
      target_audience: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ success: false, error: 'Payload invalide pour /start' }, { status: 400 });
    }

    const started = await startOrchestrator(parsed.data);
    return Response.json({
      success: true,
      projectId: started.projectId,
      status: started.alreadyRunning ? 'already_running' : 'started',
      polling_hint_ms: 1200,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur interne orchestrateur',
      },
      { status: 500 },
    );
  }
}
