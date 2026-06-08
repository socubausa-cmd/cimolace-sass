import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

const PROVIDERS = {
  deepseek: { url: 'https://api.deepseek.com/v1/chat/completions', key: process.env.DEEPSEEK_API_KEY, model: 'deepseek-chat' },
  openai: { url: 'https://api.openai.com/v1/chat/completions', key: process.env.OPENAI_API_KEY, model: 'gpt-4o-mini' },
  anthropic: { url: 'https://api.anthropic.com/v1/messages', key: process.env.ANTHROPIC_API_KEY, model: 'claude-3-5-haiku-20241022' },
};

async function callProvider(provider, prompt, maxTokens) {
  const cfg = PROVIDERS[provider];
  if (!cfg || !cfg.key || cfg.key === 'replace_me') return null;

  try {
    if (provider === 'anthropic') {
      const res = await fetch(cfg.url, {
        method: 'POST', headers: { 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens || 4096, messages: [{ role: 'user', content: prompt }] }),
      });
      if (res.ok) { const data = await res.json(); return data.content?.map(b => b.text || '').join('') || ''; }
    } else {
      const res = await fetch(cfg.url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
        body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens || 4096 }),
      });
      if (res.ok) { const data = await res.json(); return data.choices?.[0]?.message?.content || ''; }
    }
  } catch {}
  return null;
}

async function executeAIJob(job) {
  // Try providers in order: deepseek -> openai -> anthropic
  for (const provider of ['deepseek', 'openai', 'anthropic']) {
    const result = await callProvider(provider, job.prompt, job.max_tokens);
    if (result) return { result, provider };
  }
  throw new Error('Aucun fournisseur IA disponible');
}

export async function pollAIJobs() {
  const { data: jobs } = await supabase.from('ai_jobs')
    .select('*').eq('status', 'pending').limit(5);
  if (!jobs?.length) return 0;

  let completed = 0;
  for (const job of jobs) {
    await supabase.from('ai_jobs').update({ status: 'processing' }).eq('id', job.id);
    try {
      const { result, provider } = await executeAIJob(job);
      await supabase.from('ai_jobs').update({
        status: 'completed', result, provider, completed_at: new Date().toISOString(),
      }).eq('id', job.id);
      completed++;
      console.log('[ai-worker] Completed', job.id, 'via', provider);
    } catch (e) {
      await supabase.from('ai_jobs').update({ status: 'failed', error: e.message }).eq('id', job.id);
      console.error('[ai-worker] Failed', job.id, e.message);
    }
  }
  console.log('[ai-worker] Batch complete:', completed, '/', jobs.length);
  return completed;
}
