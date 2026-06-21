import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';
import type { CreateTopicDto, ListTopicsQueryDto } from './dto/topics.dto';

/**
 * TopicsService — socle ADDITIF « forum connecté ».
 *
 * Un « Sujet » est une conversation `kind='topic'` greffée sur la messagerie
 * existante (tables prod conversations/conversation_participants/messages). Ce
 * chemin est PARALLÈLE au DM (regroupement par paire dans useRealtimeMessaging) :
 * un Sujet est un groupe sans paire fixe, donc il ne réutilise PAS la RPC
 * find_or_create_conversation.
 *
 * Toutes les écritures passent par le client service_role (qui bypass la RLS),
 * comme le reste du module messaging, et sont scopées par tenant_id. Les règles
 * de visibilité (public = membre actif / private|context = participant) sont
 * appliquées EN CODE ici (la RLS topic n'est qu'un garde-fou pour les accès
 * directs Supabase côté front).
 */
@Injectable()
export class TopicsService {
  constructor(private readonly supabase: SupabaseService) {}

  private get db(): any {
    return this.supabase.client;
  }

  /** Crée un Sujet (conversation kind='topic') + son créateur participant + 1er message optionnel. */
  async createTopic(tenant: TenantContext, userId: string, dto: CreateTopicDto) {
    const visibility = dto.visibility ?? 'private';
    const isContext = visibility === 'context';

    const { data: conv, error } = await this.db
      .from('conversations')
      .insert({
        tenant_id: tenant.id,
        kind: 'topic',
        // legacy `type` borné à 'direct'|'group' en prod : un Sujet (groupe sans
        // paire fixe) se range sous 'group' pour rester compatible avec le CHECK.
        type: 'group',
        name: dto.subject,
        subject: dto.subject,
        status: 'open',
        visibility,
        context_type: isContext ? (dto.contextType ?? null) : null,
        context_id: isContext ? (dto.contextId ?? null) : null,
        created_by: userId,
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    if (!conv) throw new BadRequestException('Échec création du sujet');

    // Le créateur est toujours participant (nécessaire pour la RLS private/context).
    await this.db
      .from('conversation_participants')
      .upsert(
        { tenant_id: tenant.id, conversation_id: conv.id, user_id: userId },
        { onConflict: 'conversation_id,user_id' },
      );

    // Premier message optionnel — réutilise la table `messages` (recipient_id NULL
    // côté Sujet : pas de destinataire unique, c'est un fil de groupe).
    if (dto.content && dto.content.trim()) {
      const { error: msgErr } = await this.db.from('messages').insert({
        tenant_id: tenant.id,
        conversation_id: conv.id,
        sender_id: userId,
        recipient_id: null,
        content: dto.content,
        subject: dto.subject,
      });
      if (msgErr) throw new BadRequestException(msgErr.message);
    }

    return conv;
  }

  /** Liste les Sujets accessibles au user dans le tenant (public OU participant). */
  async listTopics(
    tenant: TenantContext,
    userId: string,
    q: ListTopicsQueryDto = {},
  ) {
    // 1) Sujets PUBLICS du tenant (visibles si le user est membre actif).
    let publicIds: string[] = [];
    if (await this.isActiveMember(tenant.id, userId)) {
      const { data: pubs } = await this.db
        .from('conversations')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('kind', 'topic')
        .eq('visibility', 'public');
      publicIds = (pubs ?? []).map((r: any) => r.id);
    }

    // 2) Sujets dont le user est participant (private/context inclus).
    const { data: parts } = await this.db
      .from('conversation_participants')
      .select('conversation_id')
      .eq('tenant_id', tenant.id)
      .eq('user_id', userId);
    const partIds = (parts ?? []).map((r: any) => r.conversation_id);

    const allIds = Array.from(new Set([...publicIds, ...partIds]));
    if (!allIds.length) return [];

    let query = this.db
      .from('conversations')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('kind', 'topic')
      .in('id', allIds);

    if (q.status) query = query.eq('status', q.status);
    if (q.visibility) query = query.eq('visibility', q.visibility);
    if (q.contextType) query = query.eq('context_type', q.contextType);
    if (q.contextId) query = query.eq('context_id', q.contextId);

    const { data, error } = await query.order('updated_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  /** Détail d'un Sujet — soumis au contrôle d'accès (public+membre OU participant). */
  async getTopic(tenant: TenantContext, userId: string, topicId: string) {
    const { topic } = await this.assertCanAccess(tenant, userId, topicId);
    return topic;
  }

  /** Messages d'un Sujet — même contrôle d'accès que getTopic. */
  async getTopicMessages(tenant: TenantContext, userId: string, topicId: string) {
    await this.assertCanAccess(tenant, userId, topicId);
    const { data, error } = await this.db
      .from('messages')
      .select('*')
      .eq('conversation_id', topicId)
      .eq('tenant_id', tenant.id)
      .order('created_at');
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  /**
   * Envoie un message dans un Sujet (réutilise l'insert `messages` du DM, mais sans
   * destinataire unique : recipient_id NULL). Refuse si le Sujet est clôturé.
   * Un membre actif qui poste dans un Sujet PUBLIC en devient participant.
   */
  async postMessage(
    tenant: TenantContext,
    userId: string,
    topicId: string,
    content: string,
  ) {
    const { topic, isParticipant } = await this.assertCanAccess(
      tenant,
      userId,
      topicId,
    );
    if (topic.status === 'closed') {
      throw new ForbiddenException('Sujet clôturé : envoi impossible');
    }

    // Rejoindre le fil à la première contribution (utile pour la RLS + le listing).
    if (!isParticipant) {
      await this.db
        .from('conversation_participants')
        .upsert(
          { tenant_id: tenant.id, conversation_id: topicId, user_id: userId },
          { onConflict: 'conversation_id,user_id' },
        );
    }

    const { data, error } = await this.db
      .from('messages')
      .insert({
        tenant_id: tenant.id,
        conversation_id: topicId,
        sender_id: userId,
        recipient_id: null,
        content,
        subject: topic.subject ?? '',
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);

    // Remonte le Sujet dans le listing (tri updated_at).
    await this.db
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', topicId)
      .eq('tenant_id', tenant.id);

    return data;
  }

  /** Clôture un Sujet (status='closed'). Réservé au créateur ou aux rôles d'encadrement. */
  async closeTopic(tenant: TenantContext, userId: string, topicId: string) {
    return this.setStatus(tenant, userId, topicId, 'closed');
  }

  /** Rouvre un Sujet (status='open'). Réservé au créateur ou aux rôles d'encadrement. */
  async reopenTopic(tenant: TenantContext, userId: string, topicId: string) {
    return this.setStatus(tenant, userId, topicId, 'open');
  }

  // ── Internes ───────────────────────────────────────────────────────────────

  private async setStatus(
    tenant: TenantContext,
    userId: string,
    topicId: string,
    status: 'open' | 'closed',
  ) {
    const { data: topic } = await this.db
      .from('conversations')
      .select('id, created_by, kind')
      .eq('id', topicId)
      .eq('tenant_id', tenant.id)
      .eq('kind', 'topic')
      .maybeSingle();
    if (!topic) throw new NotFoundException('Sujet introuvable');

    if (topic.created_by !== userId && !this.isStaffRole(tenant)) {
      throw new ForbiddenException('Action réservée au créateur ou à un encadrant');
    }

    const { data, error } = await this.db
      .from('conversations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', topicId)
      .eq('tenant_id', tenant.id)
      .eq('kind', 'topic')
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Sujet introuvable');
    return data;
  }

  /**
   * Charge le Sujet et vérifie que le user peut y accéder :
   *  - visibility='public' → membre ACTIF du tenant suffit ;
   *  - visibility in ('private','context') → doit être participant.
   * Retourne aussi `isParticipant` (réutilisé par postMessage pour l'auto-join).
   */
  private async assertCanAccess(
    tenant: TenantContext,
    userId: string,
    topicId: string,
  ): Promise<{ topic: any; isParticipant: boolean }> {
    const { data: topic } = await this.db
      .from('conversations')
      .select('*')
      .eq('id', topicId)
      .eq('tenant_id', tenant.id)
      .eq('kind', 'topic')
      .maybeSingle();
    if (!topic) throw new NotFoundException('Sujet introuvable');

    const { data: part } = await this.db
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', topicId)
      .eq('user_id', userId)
      .maybeSingle();
    const isParticipant = !!part;

    if (isParticipant) return { topic, isParticipant };

    if (
      topic.visibility === 'public' &&
      (await this.isActiveMember(tenant.id, userId))
    ) {
      return { topic, isParticipant };
    }

    throw new ForbiddenException('Accès refusé à ce sujet');
  }

  private isStaffRole(tenant: TenantContext): boolean {
    return ['owner', 'admin', 'teacher'].includes(tenant.userRole as string);
  }

  private async isActiveMember(
    tenantId: string,
    userId: string,
  ): Promise<boolean> {
    const { data } = await this.db
      .from('tenant_memberships')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    return !!data;
  }
}
