import { inngest } from '../inngest';

export type ProcessVideoPayload = {
  recordingId: string;
  tenantId: string;
  sourceUrl: string;
};

export const processVideoJob = inngest.createFunction(
  { id: 'process-video', name: 'Process Video Recording' },
  { event: 'video/process' },
  async ({ event, step }: { event: { data: ProcessVideoPayload }; step: any }) => {
    const { recordingId, tenantId, sourceUrl } = event.data;

    // Step 1: Download video metadata
    const meta = await step.run('fetch-metadata', async () => {
      const response = await fetch(sourceUrl, { method: 'HEAD' });
      return { size: response.headers.get('content-length'), type: response.headers.get('content-type') };
    });

    // Step 2: Update recording status
    await step.run('update-status', async () => {
      const supabaseUrl = process.env.SUPABASE_URL ?? '';
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
      if (supabaseUrl && serviceKey) {
        await fetch(`${supabaseUrl}/rest/v1/live_recordings?id=eq.${recordingId}`, {
          method: 'PATCH',
          headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ status: 'processing', raw_response: { size: meta.size, type: meta.type } }),
        });
      }
    });

    // Step 3: Generate thumbnail / transcode (placeholder)
    await step.run('transcode', async () => {
      // In production: call Cloudflare Stream or Mux API
      return { status: 'transcoded', provider: 'cloudflare_stream' };
    });

    // Step 4: Mark as completed
    await step.run('mark-completed', async () => {
      const supabaseUrl = process.env.SUPABASE_URL ?? '';
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
      if (supabaseUrl && serviceKey) {
        await fetch(`${supabaseUrl}/rest/v1/live_recordings?id=eq.${recordingId}`, {
          method: 'PATCH',
          headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
        });
      }
    });

    return { success: true, recordingId, tenantId };
  },
);
