/// <reference lib="deno.ns" />

import { corsHeaders } from './cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type NeuroAdmin = ReturnType<typeof createClient>;

export function neuroJson(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function createNeuroAdmin(): NeuroAdmin {
  // @ts-ignore Deno deploy
  const url = Deno.env.get('SUPABASE_URL') || '';
  // @ts-ignore Deno deploy
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  return createClient(url, key);
}

export async function neuroRequireAuthUser(
  admin: NeuroAdmin,
  req: Request,
): Promise<{ userId: string } | { response: Response }> {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return { response: neuroJson(401, { error: 'Missing Authorization' }) };
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return { response: neuroJson(401, { error: 'Invalid token' }) };
  return { userId: user.id };
}

export async function neuroAssertTeacherCanManageLive(
  admin: NeuroAdmin,
  sessionId: string,
  userId: string,
): Promise<{ ok: true } | { response: Response }> {
  const { data: ls, error: e1 } = await admin
    .from('live_sessions')
    .select('id, teacher_id')
    .eq('id', sessionId)
    .maybeSingle();
  if (e1 || !ls) return { response: neuroJson(404, { error: 'Session introuvable' }) };
  if (ls.teacher_id === userId) return { ok: true };

  const { data: parts } = await admin
    .from('live_session_participants')
    .select('role')
    .eq('live_session_id', sessionId)
    .eq('user_id', userId)
    .in('role', ['host', 'co_host', 'moderator'])
    .limit(1);

  if (parts?.length) return { ok: true };
  return { response: neuroJson(403, { error: 'Accès réservé à l’hôte ou aux modérateurs' }) };
}
