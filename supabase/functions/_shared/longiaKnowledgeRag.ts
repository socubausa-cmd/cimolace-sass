/**
 * Extraits base documentaire (pgvector match_knowledge, 384 dims) pour enrichir le system prompt LONGIA.
 * Pas de plafond artificiel côté concaténation : on inclut tous les passages renvoyés par la RPC.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Entrée embedding (gte-small) — aligné embed-knowledge, évite entrées gigantesques anormales. */
const MAX_QUERY_EMBED_CHARS = 32000;

export async function fetchLongiaKnowledgeRagSnippets(
  admin: SupabaseClient,
  queryText: string,
  opts?: { matchCount?: number; threshold?: number },
): Promise<string> {
  const q = String(queryText || '').trim().slice(0, MAX_QUERY_EMBED_CHARS);
  if (!q) return '';

  const matchCount = Math.max(1, Math.min(2000, opts?.matchCount ?? 500));
  const threshold = typeof opts?.threshold === 'number' ? opts.threshold : 0.35;

  try {
    // @ts-ignore Deno — même pipeline que embed-knowledge
    const aiSession = new Supabase.ai.Session('gte-small');
    const embeddingRaw = await aiSession.run(q, { mean_pool: true, normalize: true });
    const query_embedding = Array.from(embeddingRaw as number[]);

    const { data: rows, error } = await admin.rpc('match_knowledge', {
      query_embedding,
      match_threshold: threshold,
      match_count: matchCount,
    });

    if (error) {
      console.warn('[longiaKnowledgeRag] match_knowledge', error.message);
      return '';
    }

    const list = Array.isArray(rows) ? rows : [];
    if (list.length === 0) return '';

    const parts: string[] = [];
    for (const row of list as Array<{ title?: string; topic?: string; content?: string; similarity?: number }>) {
      const title = String(row?.title || '').trim();
      const topic = String(row?.topic || '').trim();
      const content = String(row?.content || '').trim();
      const sim = typeof row?.similarity === 'number' ? row.similarity.toFixed(3) : '';
      const block = [`[${sim}] ${title || 'Sans titre'}${topic ? ` — ${topic}` : ''}`, content].join('\n');
      parts.push(block);
    }

    return (
      '\n\n=== EXTRAITS BASE DOCUMENTAIRE (RAG — à citer si pertinent, ne pas inventer hors extrait) ===\n' +
      parts.join('\n\n---\n\n') +
      '\n=== FIN EXTRAITS ===\n'
    );
  } catch (e) {
    console.warn('[longiaKnowledgeRag]', (e as Error)?.message || e);
    return '';
  }
}
