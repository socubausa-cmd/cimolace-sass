/// <reference lib="deno.ns" />

import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// @ts-ignore Deno runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { title, topic, content, source, id } = body as {
      title?: string;
      topic?: string;
      content?: string;
      source?: string;
      id?: string; // if provided, update instead of insert
    };

    if (!content) {
      return new Response(JSON.stringify({ error: 'content is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!title && !id) {
      return new Response(JSON.stringify({ error: 'title is required for new entries' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate embedding using Supabase built-in AI (gte-small → 384 dims, no API key needed)
    // @ts-ignore Deno runtime
    const aiSession = new Supabase.ai.Session('gte-small');
    const inputText = [title, topic, content].filter(Boolean).join('\n').slice(0, 4000);
    const embeddingRaw = await aiSession.run(inputText, {
      mean_pool: true,
      normalize: true,
    });
    const embedding = Array.from(embeddingRaw as number[]);

    // @ts-ignore Deno runtime
    const supabaseAdmin = createClient(
      // @ts-ignore Deno runtime
      Deno.env.get('SUPABASE_URL')!,
      // @ts-ignore Deno runtime
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let result;
    if (id) {
      // Update existing entry
      const { data, error } = await supabaseAdmin
        .from('knowledge_base')
        .update({ title, topic: topic || null, content, source: source || null, embedding, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id, title')
        .single();
      if (error) throw error;
      result = data;
    } else {
      // Insert new entry
      const { data, error } = await supabaseAdmin
        .from('knowledge_base')
        .insert({ title, topic: topic || null, content, source: source || null, embedding })
        .select('id, title')
        .single();
      if (error) throw error;
      result = data;
    }

    return new Response(JSON.stringify({ success: true, id: result.id, title: result.title }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String((e as Error)?.message || e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
