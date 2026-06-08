import { inngest } from '../inngest';

export type GenerateAiContentPayload = {
  prompt: string;
  tenantId: string;
  model?: string;
};

export const generateAiContentJob = inngest.createFunction(
  { id: 'generate-ai-content', name: 'Generate AI Content' },
  { event: 'ai/generate-content' },
  async ({ event, step }: { event: { data: GenerateAiContentPayload }; step: any }) => {
    const { prompt, tenantId, model = 'deepseek-chat' } = event.data;

    const result = await step.run('call-llm', async () => {
      const apiKey = process.env.DEEPSEEK_API_KEY ?? process.env.OPENAI_API_KEY ?? '';
      if (!apiKey || apiKey === 'replace_me') return { content: '⚠️ No AI key configured', model };

      const isDeepSeek = apiKey.startsWith('sk-') && apiKey.length < 40;
      const endpoint = isDeepSeek
        ? 'https://api.deepseek.com/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';
      const authHeader = isDeepSeek ? `Bearer ${apiKey}` : `Bearer ${apiKey}`;
      const modelName = isDeepSeek ? (model === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat') : 'gpt-4o-mini';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ model: modelName, messages: [{ role: 'user', content: prompt }], max_tokens: 2000 }),
      });
      const data = await response.json() as any;
      return { content: data.choices?.[0]?.message?.content ?? '', model: modelName };
    });

    // Log usage
    await step.run('log-usage', async () => {
      const supabaseUrl = process.env.SUPABASE_URL ?? '';
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
      if (supabaseUrl && serviceKey) {
        await fetch(`${supabaseUrl}/rest/v1/ai_requests`, {
          method: 'POST',
          headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ tenant_id: tenantId, model: result.model, prompt_tokens: prompt.length, created_at: new Date().toISOString() }),
        });
      }
    });

    return { success: true, content: result.content, model: result.model, tenantId };
  },
);
