import { z } from 'zod';
import { getOrchestratorStatus } from '@/lib/liri-orchestrator/service';

const querySchema = z.object({
  projectId: z.string().min(1),
});

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    projectId: url.searchParams.get('projectId'),
  });

  if (!parsed.success) {
    return Response.json({ success: false, error: 'projectId requis' }, { status: 400 });
  }

  const status = await getOrchestratorStatus(parsed.data.projectId);
  if (!status) {
    return Response.json({ success: false, error: 'Projet introuvable' }, { status: 404 });
  }

  return Response.json(status);
}
