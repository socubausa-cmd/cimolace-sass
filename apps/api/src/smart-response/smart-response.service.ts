/**
 * SmartResponseService — Q&A IA + Knowledge Base + threads conversation.
 *
 * Ported depuis netlify/functions/response-* (v1) → NestJS.
 *
 * Endpoints :
 *   - query()              : Q&A IA depuis un message visiteur (DeepSeek/Groq + KB)
 *   - listKnowledge()      : liste de la KB
 *   - upsertKnowledge()    : ajout/édition d'une entrée
 *   - deleteKnowledge()    : suppression
 *   - ingestKnowledge()    : ingestion d'un texte (split → multiple entries)
 *   - listThreads()        : threads pour secrétariat
 *   - threadMessages()     : messages d'un thread
 *   - secretariatReply()   : réponse manuelle du secrétariat
 *   - followup()           : déclencher une relance
 */

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { AiBillingService } from '../ai-billing/ai-billing.service';

@Injectable()
export class SmartResponseService {
  private readonly logger = new Logger(SmartResponseService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly billing: AiBillingService,
  ) {}

  // ─── 1. KB CRUD ───────────────────────────────────────────────────────────

  async listKnowledge(tenantId: string, params?: { limit?: number; active?: boolean }) {
    let q = (this.supabase.client as any)
      .from('response_knowledge_entries')
      .select('id, title, content, source_label, source_url, intents, keywords, priority, is_active, created_at')
      .eq('tenant_id', tenantId)
      .order('priority', { ascending: false })
      .limit(params?.limit ?? 100);

    if (params?.active !== undefined) q = q.eq('is_active', params.active);

    const { data } = await q;
    return data ?? [];
  }

  async upsertKnowledge(
    tenantId: string,
    userId: string | null,
    input: {
      id?: string;
      title: string;
      content: string;
      intents?: string[];
      keywords?: string[];
      priority?: number;
      source_label?: string;
      source_url?: string;
      is_active?: boolean;
    },
  ) {
    if (!input.title || !input.content) {
      throw new BadRequestException('title et content requis');
    }

    const payload = {
      tenant_id: tenantId,
      title: input.title,
      content: input.content,
      intents: input.intents ?? [],
      keywords: input.keywords ?? [],
      priority: input.priority ?? 50,
      source_label: input.source_label ?? 'manual',
      source_url: input.source_url ?? null,
      is_active: input.is_active ?? true,
      created_by: userId,
      updated_at: new Date().toISOString(),
    };

    if (input.id) {
      const { data, error } = await (this.supabase.client as any)
        .from('response_knowledge_entries')
        .update(payload)
        .eq('id', input.id)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();
      if (error) throw new BadRequestException(error.message);
      return data;
    }

    const { data, error } = await (this.supabase.client as any)
      .from('response_knowledge_entries')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteKnowledge(tenantId: string, id: string) {
    await (this.supabase.client as any)
      .from('response_knowledge_entries')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);
    return { success: true };
  }

  async ingestKnowledge(
    tenantId: string,
    userId: string | null,
    input: { sourceLabel?: string; sourceUrl?: string; rawText: string },
  ) {
    if (!input.rawText?.trim()) throw new BadRequestException('rawText requis');

    // Split en chunks de ~800 chars (paragraphes)
    const chunks = input.rawText
      .split(/\n\s*\n/)
      .map((c) => c.trim())
      .filter((c) => c.length > 80);

    const entries: any[] = [];
    for (const chunk of chunks.slice(0, 30)) {
      const title = chunk.split('\n')[0].slice(0, 100);
      const content = chunk;
      entries.push({
        tenant_id: tenantId,
        title,
        content,
        source_label: input.sourceLabel ?? 'site_scan',
        source_url: input.sourceUrl ?? null,
        priority: 50,
        is_active: true,
        created_by: userId,
      });
    }

    if (entries.length === 0) {
      return { inserted: 0, message: 'Aucun chunk valide trouvé' };
    }

    const { data, error } = await (this.supabase.client as any)
      .from('response_knowledge_entries')
      .insert(entries)
      .select('id');

    if (error) throw new BadRequestException(error.message);
    return { inserted: data?.length ?? 0, entries: data };
  }

  // ─── 2. Intent detection (simple — peut être amélioré avec embeddings) ────

  private detectIntent(message: string): string {
    const m = message.toLowerCase();
    if (/prix|tarif|combien|coût|payer/.test(m)) return 'pricing';
    if (/inscri|enroll|rejoin|adhé/.test(m)) return 'enrollment';
    if (/rdv|rendez.vous|appointment|book|consult/.test(m)) return 'booking';
    if (/cours|formation|class|leçon/.test(m)) return 'course_info';
    if (/aide|support|problème|bug|erreur/.test(m)) return 'support';
    if (/horaire|heure|quand|disponib/.test(m)) return 'schedule';
    if (/contact|téléphone|email|message/.test(m)) return 'contact';
    return 'general';
  }

  private scoreEntry(entry: any, message: string, intent: string): number {
    const src = message.toLowerCase();
    const intentMatch = (entry.intents ?? []).includes(intent) ? 5 : 0;
    const keywordScore = (entry.keywords ?? []).reduce(
      (acc: number, kw: string) => (src.includes(kw.toLowerCase()) ? acc + 2 : acc),
      0,
    );
    const textScore =
      src.length > 8 && (entry.content ?? '').toLowerCase().includes(src.slice(0, Math.min(24, src.length)))
        ? 1
        : 0;
    return intentMatch + keywordScore + textScore + (Number(entry.priority ?? 0) / 100);
  }

  // ─── 3. Query Q&A (cœur du chatbot) ───────────────────────────────────────

  async query(
    tenantId: string,
    input: {
      message: string;
      threadId?: string;
      visitorName?: string;
      visitorEmail?: string;
    },
  ) {
    if (!input.message?.trim()) throw new BadRequestException('message requis');

    const start = Date.now();
    const intent = this.detectIntent(input.message);

    // 1. Récupérer ou créer le thread
    let thread = null;
    if (input.threadId) {
      const { data } = await (this.supabase.client as any)
        .from('conversation_threads')
        .select('*')
        .eq('id', input.threadId)
        .maybeSingle();
      thread = data;
    }
    if (!thread) {
      // Note : conversation_threads est une table v1 héritée sans tenant_id.
      // L'isolation par tenant se fait via response_engine_logs (qui a tenant_id).
      const { data: created } = await (this.supabase.client as any)
        .from('conversation_threads')
        .insert({
          visitor_name: input.visitorName ?? null,
          visitor_email: input.visitorEmail ?? null,
          status: 'open',
          source: 'chatbot',
        })
        .select('*')
        .single();
      thread = created;
    }

    // 2. Enregistrer le message visiteur
    await (this.supabase.client as any).from('conversation_messages').insert({
      thread_id: thread.id,
      sender_type: 'visitor',
      message: input.message,
    });

    // 3. Trouver la meilleure entrée KB
    const { data: kbEntries } = await (this.supabase.client as any)
      .from('response_knowledge_entries')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(120);

    const ranked = (kbEntries ?? [])
      .map((entry: any) => ({ entry, score: this.scoreEntry(entry, input.message, intent) }))
      .sort((a: any, b: any) => b.score - a.score);

    const topMatch = ranked[0]?.score >= 2 ? ranked[0] : null;

    // 4. Composer la réponse via LLM (Groq)
    const answer = await this.composeAnswer(tenantId, input.message, topMatch?.entry, intent);

    // 5. Enregistrer la réponse
    await (this.supabase.client as any).from('conversation_messages').insert({
      thread_id: thread.id,
      sender_type: 'bot',
      message: answer.text,
    });

    // 6. Logger
    await (this.supabase.client as any).from('response_engine_logs').insert({
      tenant_id: tenantId,
      thread_id: thread.id,
      intent,
      message: input.message.slice(0, 500),
      matched_kb_id: topMatch?.entry?.id ?? null,
      match_score: topMatch?.score ?? null,
      route: answer.escalate ? 'escalation' : 'auto_reply',
      latency_ms: Date.now() - start,
    });

    return {
      thread_id: thread.id,
      intent,
      answer: answer.text,
      escalate: answer.escalate,
      matched_kb: topMatch?.entry ? {
        id: topMatch.entry.id,
        title: topMatch.entry.title,
        score: topMatch.score,
      } : null,
      latency_ms: Date.now() - start,
    };
  }

  private async composeAnswer(
    tenantId: string,
    message: string,
    kbEntry: any | null,
    intent: string,
  ): Promise<{ text: string; escalate: boolean }> {
    const groqKey = this.config.get<string>('GROQ_API_KEY');

    if (!groqKey || groqKey === 'replace_me') {
      // Fallback sans LLM
      if (kbEntry) return { text: kbEntry.content.slice(0, 500), escalate: false };
      return {
        text: 'Bonjour ! Je transmets votre message à un membre de l\'équipe qui vous répondra rapidement.',
        escalate: true,
      };
    }

    const context = kbEntry
      ? `Contexte (article KB pertinent) :\nTitre: ${kbEntry.title}\nContenu: ${kbEntry.content.slice(0, 1500)}`
      : 'Aucune information précise dans la base de connaissances.';

    const prompt = `Tu es l'assistant IA de l'école/secrétariat LIRI. Réponds de manière concise (max 4 phrases), professionnelle et chaleureuse.

Intent détecté : ${intent}

${context}

Question du visiteur : "${message}"

Si l'information précise n'est pas dans le contexte, dis-le honnêtement et propose qu'un membre de l'équipe recontacte le visiteur.`;

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'Assistant pédagogique LIRI.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 300,
          temperature: 0.4,
        }),
        signal: AbortSignal.timeout(20000),
      });

      const json = await res.json();
      const text = json?.choices?.[0]?.message?.content?.trim() ?? '';
      const usage = json?.usage ?? {};

      // Billing
      try {
        await this.billing.chargeUsage(tenantId, {
          function_name: 'smart-response.query',
          provider: 'groq',
          model: 'llama-3.3-70b-versatile',
          unit_type: 'tokens_in',
          unit_amount: usage.prompt_tokens ?? 0,
        });
        await this.billing.chargeUsage(tenantId, {
          function_name: 'smart-response.query',
          provider: 'groq',
          model: 'llama-3.3-70b-versatile',
          unit_type: 'tokens_out',
          unit_amount: usage.completion_tokens ?? 0,
        });
      } catch (_) { /* billing non bloquant */ }

      const escalate = !kbEntry || (kbEntry && this.scoreEntry(kbEntry, message, intent) < 4);
      return { text: text || 'Je transmets votre demande à un membre de l\'équipe.', escalate };
    } catch (err) {
      this.logger.warn(`LLM compose failed: ${(err as Error).message}`);
      if (kbEntry) return { text: kbEntry.content.slice(0, 500), escalate: false };
      return {
        text: 'Bonjour ! Un membre de l\'équipe vous répondra rapidement.',
        escalate: true,
      };
    }
  }

  // ─── 4. Threads secrétariat ───────────────────────────────────────────────

  async listThreads(
    tenantId: string,
    params?: { status?: string; limit?: number; assigned_to?: string },
  ) {
    // Filtrer les threads via les logs (qui ont tenant_id)
    const { data: logs } = await (this.supabase.client as any)
      .from('response_engine_logs')
      .select('thread_id')
      .eq('tenant_id', tenantId)
      .limit(500);
    const threadIds = Array.from(new Set((logs ?? []).map((l: any) => l.thread_id).filter(Boolean)));
    if (!threadIds.length) return [];

    let q = (this.supabase.client as any)
      .from('conversation_threads')
      .select('*')
      .in('id', threadIds)
      .order('updated_at', { ascending: false })
      .limit(params?.limit ?? 50);

    if (params?.status) q = q.eq('status', params.status);
    if (params?.assigned_to) q = q.eq('assigned_to', params.assigned_to);

    const { data } = await q;
    return data ?? [];
  }

  async threadMessages(tenantId: string, threadId: string) {
    // Vérif via response_engine_logs que ce thread appartient à ce tenant
    const { data: logCheck } = await (this.supabase.client as any)
      .from('response_engine_logs')
      .select('id')
      .eq('thread_id', threadId)
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();
    if (!logCheck) throw new NotFoundException('Thread introuvable pour ce tenant');

    const { data: thread } = await (this.supabase.client as any)
      .from('conversation_threads')
      .select('id, visitor_name, visitor_email, status')
      .eq('id', threadId)
      .maybeSingle();

    if (!thread) throw new NotFoundException('Thread introuvable');

    const { data: messages } = await (this.supabase.client as any)
      .from('conversation_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    return { thread, messages: messages ?? [] };
  }

  async secretariatReply(
    tenantId: string,
    userId: string | null,
    input: { threadId: string; message: string; status?: string },
  ) {
    if (!input.threadId || !input.message) {
      throw new BadRequestException('threadId et message requis');
    }

    // Vérif via response_engine_logs (table v1 conversation_threads sans tenant_id)
    const { data: logCheck } = await (this.supabase.client as any)
      .from('response_engine_logs')
      .select('id')
      .eq('thread_id', input.threadId)
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();
    if (!logCheck) throw new NotFoundException('Thread introuvable pour ce tenant');

    // Insérer le message
    const { data: msg } = await (this.supabase.client as any)
      .from('conversation_messages')
      .insert({
        thread_id: input.threadId,
        sender_type: 'secretariat',
        sender_user_id: userId,
        message: input.message,
      })
      .select('*')
      .single();

    // Mettre à jour le statut du thread si fourni
    if (input.status) {
      await (this.supabase.client as any)
        .from('conversation_threads')
        .update({ status: input.status, updated_at: new Date().toISOString() })
        .eq('id', input.threadId);
    }

    return msg;
  }

  // ─── 5. Followup (relance programmée) ─────────────────────────────────────

  async createFollowup(
    tenantId: string,
    input: { threadId: string; scheduledAt: string; reason?: string; template?: string; payload?: any },
  ) {
    const { data, error } = await (this.supabase.client as any)
      .from('response_engine_followups')
      .insert({
        tenant_id: tenantId,
        thread_id: input.threadId,
        scheduled_at: input.scheduledAt,
        reason: input.reason,
        template: input.template,
        payload: input.payload ?? {},
        status: 'pending',
      })
      .select('*')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }
}
