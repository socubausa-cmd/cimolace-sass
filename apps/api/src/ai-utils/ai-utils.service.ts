/**
 * AiUtilsService — petits utilitaires IA (Groq) avec facturation crédits.
 *
 * Ports v1 :
 *   - ad-copy-generate       → generateAdCopy()
 *   - annual-program-generate → generateAnnualProgram()
 *   - reformulate-text       → reformulate()
 *   - post-call-report       → postCallReport()
 */

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { AiBillingService } from '../ai-billing/ai-billing.service';

const PLATFORM_HINTS: Record<string, string> = {
  facebook: 'Facebook Ads (fil dactualité). Limite titre 40 cars, description 125 cars.',
  instagram: 'Instagram (feed/reels). Ton visuel, inspirant, hashtags 5-8.',
  tiktok: 'TikTok Ads. Ton dynamique, GenZ. Hook 3s. CTA fort.',
  youtube: 'YouTube. Ton éducatif, hook fort dès le début.',
  google: 'Google Ads. Titre 30 cars max, description 90 cars max.',
  multi: 'Multi-plateforme. Ton professionnel et engageant.',
};

const OBJECTIVE_HINTS: Record<string, string> = {
  acquisition: 'Attirer prospects. CTA vers inscription.',
  conversion: 'Convertir en clients. Urgence, preuve sociale.',
  awareness: 'Notoriété. Valeur éducative.',
  retargeting: 'Relancer prospects. Rappel + incentive.',
  engagement: 'Générer interactions. Questions, émotions.',
};

const CYCLE_LABELS: Record<string, string> = {
  fondements: 'Cycle des Fondements (1ère année)',
  approfondissement: "Cycle d'Approfondissement (2e année)",
  maitrise: 'Cycle de Maîtrise (3e année)',
};

interface GroqResult {
  text: string;
  usage: { prompt_tokens: number; completion_tokens: number };
}

@Injectable()
export class AiUtilsService {
  private readonly logger = new Logger(AiUtilsService.name);
  private readonly model = 'llama-3.3-70b-versatile';

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly billing: AiBillingService,
  ) {}

  // ─── LLM helper ───────────────────────────────────────────────────────────

  private async callGroq(
    system: string,
    userPrompt: string,
    options?: { maxTokens?: number; temperature?: number },
  ): Promise<GroqResult> {
    const key = this.config.get<string>('GROQ_API_KEY');
    if (!key || key === 'replace_me') {
      throw new BadRequestException('GROQ_API_KEY non configuré');
    }
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: options?.maxTokens ?? 700,
        temperature: options?.temperature ?? 0.5,
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new BadRequestException(`Groq error ${res.status}: ${txt.slice(0, 200)}`);
    }
    const json: any = await res.json();
    return {
      text: json?.choices?.[0]?.message?.content?.trim() ?? '',
      usage: {
        prompt_tokens: json?.usage?.prompt_tokens ?? 0,
        completion_tokens: json?.usage?.completion_tokens ?? 0,
      },
    };
  }

  private async chargeGroq(tenantId: string, functionName: string, usage: { prompt_tokens: number; completion_tokens: number }) {
    try {
      await this.billing.chargeUsage(tenantId, {
        function_name: functionName,
        provider: 'groq',
        model: this.model,
        unit_type: 'tokens_in',
        unit_amount: usage.prompt_tokens,
      });
      await this.billing.chargeUsage(tenantId, {
        function_name: functionName,
        provider: 'groq',
        model: this.model,
        unit_type: 'tokens_out',
        unit_amount: usage.completion_tokens,
      });
    } catch (e) {
      this.logger.warn(`Billing failed for ${functionName}: ${(e as Error).message}`);
    }
  }

  private parseJson(raw: string): any {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (!match) return null;
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
  }

  // ─── 1. Ad copy ───────────────────────────────────────────────────────────

  async generateAdCopy(
    tenantId: string,
    input: {
      platform?: string;
      objective?: string;
      sourceTitle?: string;
      sourceDescription?: string;
      language?: string;
      tone?: string;
    },
  ) {
    const sourceTitle = (input.sourceTitle ?? '').trim();
    const sourceDescription = (input.sourceDescription ?? '').trim();
    if (!sourceTitle && !sourceDescription) {
      throw new BadRequestException('sourceTitle ou sourceDescription requis');
    }

    const platform = input.platform ?? 'facebook';
    const objective = input.objective ?? 'acquisition';
    const language = input.language ?? 'fr';
    const tone = input.tone ?? 'professional';
    const platformHint = PLATFORM_HINTS[platform] ?? PLATFORM_HINTS.multi;
    const objectiveHint = OBJECTIVE_HINTS[objective] ?? OBJECTIVE_HINTS.acquisition;
    const langLabel = language === 'fr' ? 'Français' : 'English';

    const system = `Tu es un expert en copywriting publicitaire digital.
Langue: ${langLabel}. Ton: ${tone}.
Plateforme: ${platformHint}
Objectif: ${objectiveHint}
Réponds UNIQUEMENT en JSON valide sans markdown. Format:
{
  "headline": "...",
  "description": "...",
  "cta": "...",
  "hashtags": ["...", "..."],
  "hook": "...",
  "variations": [
    { "headline": "...", "description": "...", "cta": "..." },
    { "headline": "...", "description": "...", "cta": "..." }
  ]
}`;

    const userPrompt = `Crée une publicité pour ce contenu:
Titre: ${sourceTitle}
Description: ${sourceDescription || '(aucune)'}

1 version principale + 2 variantes A/B. Le "hook" = phrase daccroche 5-10 mots.`;

    try {
      const result = await this.callGroq(system, userPrompt, { maxTokens: 700, temperature: 0.6 });
      await this.chargeGroq(tenantId, 'ai-utils.ad-copy', result.usage);
      const parsed = this.parseJson(result.text) ?? {};
      return {
        headline: parsed.headline ?? `Découvrez ${sourceTitle}`,
        description: parsed.description ?? sourceDescription,
        cta: parsed.cta ?? 'En savoir plus',
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
        hook: parsed.hook ?? '',
        variations: Array.isArray(parsed.variations) ? parsed.variations : [],
      };
    } catch (err) {
      this.logger.error(`ad-copy error: ${(err as Error).message}`);
      throw err;
    }
  }

  // ─── 2. Reformulate ───────────────────────────────────────────────────────

  async reformulate(tenantId: string, input: { text?: string; context?: string }) {
    const text = (input.text ?? '').trim();
    if (!text) throw new BadRequestException('text requis');
    const context = input.context ?? 'description';

    const system =
      context === 'title'
        ? `Tu es expert en pédagogie. Reformule le titre pour le rendre clair, professionnel, accrocheur. Réponds UNIQUEMENT avec le titre reformulé, sans guillemets ni explication. Langue française.`
        : `Tu es expert en pédagogie. Reformule la description pour la rendre claire, engageante, pédagogique. Garde le sens. Réponds UNIQUEMENT avec la description reformulée. Langue française.`;

    try {
      const result = await this.callGroq(system, text, { maxTokens: 400, temperature: 0.55 });
      await this.chargeGroq(tenantId, 'ai-utils.reformulate', result.usage);
      return { result: result.text || text, provider: 'groq', fallback: !result.text };
    } catch (err) {
      this.logger.warn(`reformulate fallback: ${(err as Error).message}`);
      return { result: text, provider: 'fallback', fallback: true };
    }
  }

  // ─── 3. Annual program (très simplifié — délègue au LLM pour le contenu) ──

  async generateAnnualProgram(
    tenantId: string,
    input: {
      school_year?: string;
      cycle?: string;
      sessions_per_week?: number;
      modules?: Array<{ number: number; title: string }>;
      pedagogical_notes?: string;
    },
  ) {
    const schoolYear = input.school_year ?? '2025-2026';
    const cycle = input.cycle ?? 'fondements';
    const sessionsPerWeek = input.sessions_per_week ?? 2;
    const modules =
      input.modules && input.modules.length > 0
        ? input.modules
        : Array.from({ length: 21 }, (_, i) => ({ number: i + 1, title: `Module ${i + 1}` }));

    const system = `Tu es LIRI Agent Pédagogique. Tu génères des programmes scolaires annuels pour ${CYCLE_LABELS[cycle] ?? cycle}.
Retourne UNIQUEMENT du JSON valide. Distribue les modules progressivement.`;

    const userPrompt = `Génère le programme annuel ${schoolYear}.
Séances/semaine: ${sessionsPerWeek}
Modules à couvrir: ${modules.map((m) => `${m.number}. ${m.title}`).join(', ')}
Notes: ${input.pedagogical_notes ?? 'Aucune'}

Sortie JSON:
{
  "title": "...",
  "description": "...",
  "weeks": [
    { "week_number": 1, "module_number": 1, "module_title": "...", "theme": "...", "pedagogical_objective": "...", "liri_segments": ["Objectif","Leçon"] }
  ]
}`;

    try {
      const result = await this.callGroq(system, userPrompt, { maxTokens: 6000, temperature: 0.3 });
      await this.chargeGroq(tenantId, 'ai-utils.annual-program', result.usage);
      const parsed = this.parseJson(result.text) ?? {};
      const weeks = Array.isArray(parsed.weeks) ? parsed.weeks : [];

      // Persistance optionnelle (table school_year_calendars existe)
      let calendarId: string | null = null;
      try {
        const { data: cal } = await (this.supabase.client as any)
          .from('school_year_calendars')
          .upsert(
            {
              school_year: schoolYear,
              cycle,
              title: parsed.title ?? `Programme ${cycle} ${schoolYear}`,
              description: parsed.description ?? '',
              weeks_count: weeks.length,
              total_modules: modules.length,
              sessions_per_week: sessionsPerWeek,
              status: 'draft',
              ai_generated: true,
              ai_model: 'groq',
              cimolace_tenant_id: tenantId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'cimolace_tenant_id,school_year,cycle' },
          )
          .select('id')
          .single();
        calendarId = cal?.id ?? null;

        if (calendarId && weeks.length > 0) {
          await (this.supabase.client as any)
            .from('annual_program_weeks')
            .delete()
            .eq('calendar_id', calendarId);

          await (this.supabase.client as any)
            .from('annual_program_weeks')
            .insert(
              weeks.map((w: any) => ({
                calendar_id: calendarId,
                week_number: w.week_number,
                module_number: w.module_number ?? null,
                module_title: w.module_title ?? null,
                theme: w.theme ?? null,
                pedagogical_objective: w.pedagogical_objective ?? null,
                liri_segments: w.liri_segments ?? [],
                cimolace_tenant_id: tenantId,
                status: 'planned',
              })),
            );
        }
      } catch (e) {
        this.logger.warn(`annual-program persist failed: ${(e as Error).message}`);
      }

      return {
        calendar_id: calendarId,
        school_year: schoolYear,
        cycle,
        title: parsed.title ?? `Programme ${cycle} ${schoolYear}`,
        description: parsed.description ?? '',
        weeks_count: weeks.length,
        weeks,
        provider: 'groq',
      };
    } catch (err) {
      this.logger.error(`annual-program error: ${(err as Error).message}`);
      throw err;
    }
  }

  // ─── 4. Post-call report ──────────────────────────────────────────────────

  async postCallReport(
    tenantId: string,
    userId: string,
    input: { liveSessionId?: string; durationSeconds?: number; sendInbox?: boolean },
  ) {
    if (!input.liveSessionId) throw new BadRequestException('liveSessionId requis');

    const { data: session } = await (this.supabase.client as any)
      .from('immersive_live_sessions')
      .select('id, title, host_user_id, guest_user_id, started_at, ended_at, conversation_key')
      .eq('id', input.liveSessionId)
      .maybeSingle();
    if (!session) throw new NotFoundException('Session introuvable');

    const ids = [session.host_user_id, session.guest_user_id].filter(Boolean);
    const { data: profs } = await (this.supabase.client as any)
      .from('profiles')
      .select('id, name, email')
      .in('id', ids);
    const profiles = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
    const host = profiles[session.host_user_id];
    const guest = profiles[session.guest_user_id];

    const duration =
      input.durationSeconds ??
      (session.ended_at && session.started_at
        ? Math.round((+new Date(session.ended_at) - +new Date(session.started_at)) / 1000)
        : 0);

    const fmtDur = (s: number) => {
      if (!s || s < 1) return "moins d'une minute";
      const m = Math.floor(s / 60);
      const sec = s % 60;
      if (m === 0) return `${sec} seconde${sec > 1 ? 's' : ''}`;
      if (sec === 0) return `${m} minute${m > 1 ? 's' : ''}`;
      return `${m} min ${sec}s`;
    };

    const now = new Date().toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });
    let summary = '';
    try {
      const result = await this.callGroq(
        "Assistant de Prorascience Academy. Résumé professionnel et concis (3-4 phrases) d'un appel vidéo immersif.",
        `Date: ${now}
Durée: ${fmtDur(duration)}
Initiateur: ${host?.name ?? 'Membre'}
Participant: ${guest?.name ?? 'Membre'}
Titre session: ${session.title ?? 'Live-Room'}
Rédige en français. Commence par "Session du [date]". Mentionne durée, participants, suggère prochaine étape.`,
        { maxTokens: 400, temperature: 0.4 },
      );
      summary = result.text;
      await this.chargeGroq(tenantId, 'ai-utils.post-call-report', result.usage);
    } catch {
      summary = `Session du ${now} — Appel immersif entre ${host?.name ?? 'M1'} et ${guest?.name ?? 'M2'}, durée ${fmtDur(duration)}.`;
    }

    const reportText = `**Rapport de session**\n\n${summary}\n\n_Généré par LIRI IA_`;

    if (input.sendInbox !== false && session.conversation_key) {
      try {
        const recipient =
          userId === session.host_user_id ? session.guest_user_id : session.host_user_id;
        await (this.supabase.client as any).from('messages').insert([
          {
            sender_id: userId,
            recipient_id: recipient,
            content: reportText,
            message_type: 'ai_report',
            metadata: JSON.stringify({
              liveSessionId: input.liveSessionId,
              durationSeconds: duration,
            }),
          },
        ]);
      } catch (e) {
        this.logger.warn(`inbox insert: ${(e as Error).message}`);
      }
    }

    return { ok: true, summary, duration: fmtDur(duration) };
  }
}
