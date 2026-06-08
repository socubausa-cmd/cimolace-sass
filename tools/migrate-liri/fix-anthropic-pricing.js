const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.fwfupxvmwtxbtbjdeqvu:hgUTaXqu1vZmX7vC@aws-1-eu-central-1.pooler.supabase.com:6543/postgres' });

(async () => {
  await c.connect();

  await c.query(`
    INSERT INTO ai_pricing (provider, model, unit_type, credits_per_unit, unit_label) VALUES
      ('anthropic', 'claude-haiku-4-5',   'tokens_in',  0.0008, '1 token entrée'),
      ('anthropic', 'claude-haiku-4-5',   'tokens_out', 0.004,  '1 token sortie'),
      ('anthropic', 'claude-sonnet-4-5',  'tokens_in',  0.003,  '1 token entrée'),
      ('anthropic', 'claude-sonnet-4-5',  'tokens_out', 0.015,  '1 token sortie'),
      ('anthropic', 'claude-opus-4-5',    'tokens_in',  0.015,  '1 token entrée premium'),
      ('anthropic', 'claude-opus-4-5',    'tokens_out', 0.075,  '1 token sortie premium'),
      ('anthropic', 'claude-opus-4-7',    'tokens_in',  0.015,  '1 token entrée premium'),
      ('anthropic', 'claude-opus-4-7',    'tokens_out', 0.075,  '1 token sortie premium'),
      -- Modèles avec date par défaut (au cas où SDK retourne avec date)
      ('anthropic', 'claude-haiku-4-5-20251001',  'tokens_in',  0.0008, '1 token entrée'),
      ('anthropic', 'claude-haiku-4-5-20251001',  'tokens_out', 0.004,  '1 token sortie'),
      -- Llama via Groq pour smartboard chat
      ('groq', 'llama-3.1-8b-instant',  'tokens_in',  0.00005, '1 token entrée'),
      ('groq', 'llama-3.1-8b-instant',  'tokens_out', 0.00008, '1 token sortie'),
      ('groq', 'meta-llama/llama-4-scout-17b-16e-instruct',  'tokens_in',  0.0001, '1 token entrée'),
      ('groq', 'meta-llama/llama-4-scout-17b-16e-instruct',  'tokens_out', 0.00015, '1 token sortie')
    ON CONFLICT (provider, model, unit_type) DO UPDATE SET credits_per_unit = EXCLUDED.credits_per_unit
  `);

  const total = await c.query('SELECT count(*) FROM ai_pricing');
  console.log('Total pricing rows:', total.rows[0].count);
  const byProvider = await c.query('SELECT provider, count(*) FROM ai_pricing GROUP BY provider ORDER BY provider');
  byProvider.rows.forEach(r => console.log(' ', r.provider, ':', r.count));

  await c.end();
})();
