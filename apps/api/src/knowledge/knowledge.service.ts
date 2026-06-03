import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';

/**
 * KnowledgeService — RAG (migration des Edge Functions V1 `embed-knowledge` /
 * `match_knowledge` vers NestJS).
 *
 * Embeddings : modèle **gte-small** (384 dims) via `@xenova/transformers`
 * (transformers.js, self-hosted, sans clé API — comme le choix V1). Le pipeline
 * est chargé paresseusement et mis en cache pour la durée de vie du process.
 *
 * ⚠️ Table `knowledge_base` + RPC `match_knowledge` : voir la migration
 * `supabase/migrations/20260603_knowledge_base_rag.sql` (à appliquer à la main).
 */
const WRITE_ROLES = ['owner', 'admin', 'teacher', 'secretariat'];

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  private embedderPromise: Promise<(text: string, opts: any) => Promise<{ data: Float32Array }>> | null = null;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Charge (une seule fois) le pipeline gte-small. L'import dynamique passe par
   * `new Function` pour empêcher TS de le transformer en `require()` — le paquet
   * `@xenova/transformers` est ESM-only et le build NestJS est CommonJS.
   */
  private getEmbedder() {
    if (!this.embedderPromise) {
      this.embedderPromise = (async () => {
        const dynamicImport = new Function('s', 'return import(s)') as (s: string) => Promise<any>;
        const { pipeline } = await dynamicImport('@xenova/transformers');
        this.logger.log('Chargement du modèle d’embedding Supabase/gte-small…');
        const p = await pipeline('feature-extraction', 'Supabase/gte-small');
        this.logger.log('Modèle gte-small prêt (384 dims).');
        return p;
      })();
    }
    return this.embedderPromise;
  }

  /** Embedding gte-small d'un texte → vecteur 384 dims normalisé. */
  async embed(text: string): Promise<number[]> {
    const input = String(text ?? '').trim().slice(0, 4000);
    if (!input) throw new BadRequestException('Texte vide');
    const embedder = await this.getEmbedder();
    const out = await embedder(input, { pooling: 'mean', normalize: true });
    return Array.from(out.data as Float32Array);
  }

  private assertCanWrite(tenant: TenantContext) {
    if (!WRITE_ROLES.includes(tenant.userRole)) {
      throw new ForbiddenException('Rôle non autorisé à modifier la base de connaissances');
    }
  }

  /** Ingestion : embed + insert/update d'une entrée `knowledge_base`. */
  async ingest(
    tenant: TenantContext,
    input: { title?: string; topic?: string; content?: string; source?: string; id?: string },
  ) {
    const content = String(input.content ?? '').trim();
    if (!content) throw new BadRequestException('content requis');
    if (!input.title && !input.id) throw new BadRequestException('title requis pour une nouvelle entrée');
    this.assertCanWrite(tenant);

    const embedding = await this.embed([input.title, input.topic, content].filter(Boolean).join('\n'));
    const row: Record<string, unknown> = {
      tenant_id: tenant.id,
      content,
      embedding,
      updated_at: new Date().toISOString(),
    };
    if (input.title !== undefined) row.title = input.title;
    if (input.topic !== undefined) row.topic = input.topic || null;
    if (input.source !== undefined) row.source = input.source || null;

    const client = this.supabase.client as any;
    if (input.id) {
      const { data, error } = await client
        .from('knowledge_base')
        .update(row)
        .eq('id', input.id)
        .eq('tenant_id', tenant.id)
        .select('id, title')
        .single();
      if (error) throw new BadRequestException(error.message);
      return data;
    }
    const { data, error } = await client.from('knowledge_base').insert(row).select('id, title').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async list(tenantId: string) {
    const { data } = await (this.supabase.client as any)
      .from('knowledge_base')
      .select('id, title, topic, source, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(100);
    return data ?? [];
  }

  async remove(tenantId: string, id: string) {
    const { error } = await (this.supabase.client as any)
      .from('knowledge_base')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw new BadRequestException(error.message);
    return { deleted: true };
  }

  /** Recherche sémantique : embed la requête + RPC `match_knowledge` (scopée tenant). */
  async search(
    tenantId: string,
    query: string,
    opts?: { matchCount?: number; threshold?: number },
  ): Promise<any[]> {
    const q = String(query ?? '').trim();
    if (!q) throw new BadRequestException('query requise');
    const query_embedding = await this.embed(q);
    const { data, error } = await (this.supabase.client as any).rpc('match_knowledge', {
      query_embedding,
      match_threshold: opts?.threshold ?? 0.5,
      match_count: opts?.matchCount ?? 5,
      p_tenant_id: tenantId,
    });
    if (error) throw new BadRequestException(error.message);
    return (data as any[]) ?? [];
  }

  /** RAG : recherche + réponse LLM (Groq) ancrée sur la base, avec sources citées. */
  async answer(tenantId: string, question: string, opts?: { matchCount?: number }) {
    const sources = await this.search(tenantId, question, {
      matchCount: opts?.matchCount ?? 5,
      threshold: 0.3,
    });
    if (!sources.length) {
      return {
        answer: "Je n'ai pas trouvé d'information pertinente dans la base de connaissances.",
        sources: [],
      };
    }
    const context = sources
      .map((s, i) => `[${i + 1}] ${s.title}${s.topic ? ' — ' + s.topic : ''}\n${s.content}`)
      .join('\n\n');
    const system =
      "Tu es l'assistant de l'école. Réponds en français, UNIQUEMENT à partir des extraits fournis ci-dessous. Cite tes sources par leur numéro entre crochets [n]. Si l'information n'y figure pas, dis-le clairement sans inventer.";
    const answer = await this.callLlm(system, `Question : ${question}\n\nExtraits :\n${context}`);
    return {
      answer,
      sources: sources.map((s, i) => ({ n: i + 1, id: s.id, title: s.title, similarity: s.similarity })),
    };
  }

  private async callLlm(system: string, user: string): Promise<string> {
    const key = this.config.get<string>('GROQ_API_KEY');
    if (!key || key === 'replace_me') return '⚠️ Aucun fournisseur LLM configuré (GROQ_API_KEY).';
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.2,
          max_tokens: 800,
        }),
        signal: AbortSignal.timeout(45000),
      });
      if (!res.ok) return `⚠️ Erreur LLM: ${res.status}`;
      const json: any = await res.json();
      return json?.choices?.[0]?.message?.content?.trim() ?? '';
    } catch (e) {
      return `⚠️ ${String(e)}`;
    }
  }
}
