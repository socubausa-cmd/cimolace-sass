import { z } from 'zod';
import { applyOrchestratorSlideAction } from '@/lib/liri-orchestrator/service';

const actionSchema = z.object({
  projectId: z.string().min(1),
  chapterId: z.string().min(1),
  step: z.string().min(1),
  action: z.enum(['generate', 'regenerate', 'validate', 'next']),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ success: false, error: 'Payload invalide' }, { status: 400 });
    }
    const result = await applyOrchestratorSlideAction(parsed.data);
    if (!result.success) {
      return Response.json(result, { status: 404 });
    }
    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Erreur action slide' },
      { status: 500 },
    );
  }
}
