import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';
import type {
  CreateTopicDto,
  GetOrCreateContextTopicDto,
  ListTopicsQueryDto,
} from './dto/topics.dto';

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

  /**
   * Phase C — get-or-create IDEMPOTENT du Sujet rattaché à un contexte (vidéo de
   * cours, live, classe). Un seul Sujet par couple (context_type, context_id) dans
   * le tenant. Appelé par le panneau Questions du lecteur à sa 1re ouverture.
   *
   * Ordre STRICT (sécurité d'abord) :
   *   1) contrôle d'accès AVANT toute écriture (inscrit au cours OU encadrant) ;
   *   2) FIND : si le Sujet existe → le renvoyer tel quel, SANS rendre le user
   *      participant (la lecture seule reste lecture seule ; il rejoint le fil à sa
   *      1re contribution via postMessage, exactement comme le socle public) ;
   *   3) CREATE (si absent) : réutilise createTopic en visibility='context' (insert
   *      conversation + créateur participant, AUCUN 1er message → Sujet ouvert vide).
   *
   * Concurrence : deux ouvertures simultanées pourraient créer 2 lignes. On capture
   * la violation d'unicité (index UNIQUE partiel recommandé) et on refait le FIND
   * pour renvoyer l'existant — idempotence garantie même sous course.
   */
  async getOrCreateContextTopic(
    tenant: TenantContext,
    userId: string,
    dto: GetOrCreateContextTopicDto,
  ) {
    // 1) Accès AVANT toute écriture — refus = 403, aucune création.
    await this.assertContextAccess(tenant, userId, {
      contextType: dto.contextType,
      contextId: dto.contextId,
      courseId: dto.courseId,
    });

    // 2) FIND : le Sujet de ce contexte existe-t-il déjà dans le tenant ?
    const existing = await this.findContextTopic(
      tenant.id,
      dto.contextType,
      dto.contextId,
    );
    if (existing) return existing;

    // 3) CREATE — réutilise EXACTEMENT le créateur du socle (visibility='context').
    const subject =
      dto.subject && dto.subject.trim()
        ? dto.subject.trim()
        : this.defaultContextSubject(dto.contextType);
    try {
      return await this.createTopic(tenant, userId, {
        subject,
        visibility: 'context',
        contextType: dto.contextType,
        contextId: dto.contextId,
      });
    } catch (err: any) {
      // 23505 = unique_violation : une ouverture concurrente a gagné la course.
      // On refait le FIND et on renvoie l'existant (idempotence).
      if (this.isUniqueViolation(err)) {
        const raced = await this.findContextTopic(
          tenant.id,
          dto.contextType,
          dto.contextId,
        );
        if (raced) return raced;
      }
      throw err;
    }
  }

  /**
   * Phase D — CONSOLIDATION POST-LIVE : copie le chat éphémère d'une session live
   * (live_session_chat) dans le Sujet durable kind='topic' du couple ('live',
   * liveSessionId), pour que les échanges survivent à la fin du live.
   *
   * RÉSERVÉ AUX ENCADRANTS (staff du tenant) : c'est une action privilégiée et
   * non réversible (on écrit dans le fil durable au nom des participants). Un élève
   * ne peut PAS déclencher la consolidation.
   *
   * IDEMPOTENT : un message sentinelle de subject déterministe
   * (`__live_consolidated__:<liveSessionId>`) marque qu'une consolidation a déjà eu
   * lieu pour cette session. Si la sentinelle existe, on renvoie le Sujet inchangé
   * (aucune duplication même sur double-clic / double-cron).
   *
   * Sécurité d'isolation : la session doit appartenir au tenant (sinon 404). On
   * réutilise getOrCreateContextTopic (qui re-vérifie l'accès et crée le Sujet à la
   * volée s'il n'existe pas), puis on insère les messages au nom de leurs auteurs
   * d'origine (sender_id = user_id du chat), en préservant l'ordre chronologique.
   */
  async publishLiveTopic(
    tenant: TenantContext,
    userId: string,
    liveSessionId: string,
    subject?: string,
  ) {
    // 1) Garde : seul un encadrant publie (le chat live appartient au cadre du cours).
    if (!this.isStaffRole(tenant)) {
      throw new ForbiddenException(
        'Consolidation réservée à un encadrant du tenant',
      );
    }

    // 2) Isolation : la session doit exister ET appartenir à CE tenant.
    const { data: session } = await this.db
      .from('live_sessions')
      .select('id, tenant_id')
      .eq('id', liveSessionId)
      .eq('tenant_id', tenant.id)
      .maybeSingle();
    if (!session) throw new NotFoundException('Session live introuvable');

    // 3) Sujet cible (get-or-create idempotent ; l'accès staff est déjà acquis).
    const topic = await this.getOrCreateContextTopic(tenant, userId, {
      contextType: 'live',
      contextId: liveSessionId,
      subject,
    });

    // 4) Idempotence : sentinelle déjà posée ? → consolidation déjà faite, on sort.
    const sentinel = this.liveConsolidationSentinel(liveSessionId);
    const { data: already } = await this.db
      .from('messages')
      .select('id')
      .eq('conversation_id', topic.id)
      .eq('tenant_id', tenant.id)
      .eq('subject', sentinel)
      .limit(1)
      .maybeSingle();
    if (already) {
      return { topic, consolidated: 0, alreadyConsolidated: true };
    }

    // 5) Lire le chat éphémère du live (ordre chronologique).
    const { data: chat } = await this.db
      .from('live_session_chat')
      .select('user_id, message, created_at')
      .eq('live_session_id', liveSessionId)
      .order('created_at', { ascending: true });
    const rows = (chat ?? []) as Array<{
      user_id: string;
      message: string;
      created_at: string;
    }>;

    // 6) Insérer les messages au nom de leurs auteurs (préserve created_at + ordre).
    //    On reste sur le sous-ensemble de colonnes prouvé en prod par postMessage :
    //    tenant_id, conversation_id, sender_id, recipient_id, content, subject (+created_at).
    let consolidated = 0;
    if (rows.length) {
      const payload = rows.map((r) => ({
        tenant_id: tenant.id,
        conversation_id: topic.id,
        sender_id: r.user_id,
        recipient_id: null,
        content: r.message,
        subject: topic.subject ?? '',
        created_at: r.created_at,
      }));
      const { error } = await this.db.from('messages').insert(payload);
      if (error) throw new BadRequestException(error.message);
      consolidated = rows.length;
    }

    // 7) Poser la sentinelle (verrou d'idempotence) APRÈS la copie réussie.
    await this.db.from('messages').insert({
      tenant_id: tenant.id,
      conversation_id: topic.id,
      sender_id: userId,
      recipient_id: null,
      content: `Chat du live consolidé (${consolidated} message(s)).`,
      subject: sentinel,
    });

    // 8) Remonter le Sujet dans le listing.
    await this.db
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', topic.id)
      .eq('tenant_id', tenant.id);

    return { topic, consolidated, alreadyConsolidated: false };
  }

  /**
   * LOT 3 — POST-PRODUCTION D'UN COURS : à la finalisation d'une post-prod de
   * contenu vidéo (CourseBuilderService.saveVersion), on s'assure qu'un Sujet
   * durable kind='topic', context_type='course' existe pour le COURS porteur du
   * contenu (context_id = courses.id) → le forum « connecté » référence le cours.
   *
   * `contentId` = formation_day_contents.id (la vidéo post-produite). On résout le
   * cours porteur via la chaîne studio
   *   formation_day_contents → formation_days → formation_weeks → modules → courses
   * (même résolution que isEnrolledInVideoCourse), en confirmant courses.tenant_id =
   * tenant (isolation). Puis get-or-create IDEMPOTENT du Sujet du cours.
   *
   * NON BLOQUANT par conception : c'est un effet de bord de la sauvegarde post-prod.
   * Si la chaîne est rompue (contenu standalone day_id NULL, cross-tenant, cours
   * introuvable), on renvoie { topic: null, skipped } SANS lever — la sauvegarde du
   * snapshot ne doit jamais échouer à cause du forum. L'appelant ignore le résultat.
   *
   * Sécurité : réutilise getOrCreateContextTopic qui re-vérifie l'accès AVANT toute
   * écriture (ici l'appelant est un encadrant → court-circuit isStaffRole).
   */
  async publishCourseContentTopic(
    tenant: TenantContext,
    userId: string,
    contentId: string,
    subject?: string,
  ): Promise<{ topic: any | null; skipped?: string }> {
    if (!contentId) return { topic: null, skipped: 'no_content_id' };

    const courseId = await this.resolveCourseIdForContent(tenant.id, contentId);
    if (!courseId) return { topic: null, skipped: 'course_not_resolved' };

    const topic = await this.getOrCreateContextTopic(tenant, userId, {
      contextType: 'course',
      contextId: courseId,
      // courseId sert au contrôle d'accès des types 'video' ; pour 'course' il est
      // redondant (contextId EST déjà le course_id) mais on le fournit par cohérence.
      courseId,
      subject:
        subject && subject.trim()
          ? subject.trim()
          : this.defaultContextSubject('course'),
    });
    return { topic };
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

  /**
   * Lecture FORUM des Sujets PUBLICS du tenant (chemin LOT 1 « forum connecté »).
   *
   * Renvoie les conversations kind='topic', visibility='public' du tenant, triées
   * par updated_at desc, avec un sous-ensemble de colonnes stable + `message_count`
   * (compte des messages du fil). C'est la source que le forum (StudentForumRedesign)
   * consomme via l'API NestJS — les messages étant lus en service_role, le front ne
   * peut pas compter en PostgREST direct, d'où ce compte côté serveur.
   *
   * Différences VOLONTAIRES avec listTopics (qui sert la page Messagerie d'un user) :
   *   • PAS de scope « participant / membre » : le forum n'expose QUE le public du
   *     tenant (un Sujet public est lisible par toute la communauté du tenant) ;
   *   • la requête reste tenant-scopée (tenant_id) → aucune fuite cross-tenant ;
   *   • lecture seule, aucune écriture (idempotent, sans effet de bord).
   *
   * `limit` est borné (défaut 100, max 200) pour éviter une réponse non bornée.
   */
  async listForumTopics(
    tenant: TenantContext,
    opts: { limit?: number } = {},
  ): Promise<
    Array<{
      id: string;
      subject: string | null;
      context_type: string | null;
      context_id: string | null;
      created_by: string | null;
      created_at: string;
      updated_at: string;
      message_count: number;
    }>
  > {
    const limit = Math.min(Math.max(opts.limit ?? 100, 1), 200);

    const { data, error } = await this.db
      .from('conversations')
      .select(
        'id, subject, context_type, context_id, created_by, created_at, updated_at',
      )
      .eq('tenant_id', tenant.id)
      .eq('kind', 'topic')
      .eq('visibility', 'public')
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (error) throw new BadRequestException(error.message);

    const topics = (data ?? []) as Array<{
      id: string;
      subject: string | null;
      context_type: string | null;
      context_id: string | null;
      created_by: string | null;
      created_at: string;
      updated_at: string;
    }>;
    if (!topics.length) return [];

    // Compte des messages par Sujet (service_role) — un count exact, head-only (pas
    // de lignes ramenées), tenant-scopé. On parallélise pour rester rapide sur la
    // page forum (volume borné par `limit`).
    const counts = await Promise.all(
      topics.map(async (topic) => {
        const { count } = await this.db
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .eq('conversation_id', topic.id);
        return count ?? 0;
      }),
    );

    return topics.map((topic, i) => ({
      ...topic,
      message_count: counts[i],
    }));
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

    // Phase C — Sujet rattaché à une VIDÉO : un inscrit au cours (ou un encadrant)
    // peut LIRE le Sujet sans en être participant. Il ne devient participant qu'à
    // sa 1re contribution (postMessage auto-join), comme le socle public.
    if (
      topic.visibility === 'context' &&
      topic.context_type === 'video' &&
      (this.isStaffRole(tenant) ||
        (await this.isEnrolledInVideoCourse(
          tenant.id,
          userId,
          topic.context_id,
        )))
    ) {
      return { topic, isParticipant };
    }

    // Phase D — Sujet rattaché à un LIVE : FAIL-CLOSED. Peut LIRE sans être
    // participant du Sujet seulement si encadrant OU si l'UNE des conditions de
    // hasLiveTopicAccess tient (participant effectif au live = table canonique,
    // admis en salle d'attente, ou membre du cours/formation lié). Comme la vidéo,
    // il ne rejoint le fil qu'à sa 1re contribution (postMessage auto-join).
    if (
      topic.visibility === 'context' &&
      topic.context_type === 'live' &&
      (this.isStaffRole(tenant) ||
        (await this.hasLiveTopicAccess(tenant, userId, topic.context_id)))
    ) {
      return { topic, isParticipant };
    }

    // LOT 3 — Sujet rattaché à un COURS (context_id = courses.id) : un inscrit au
    // cours (ou un encadrant) peut LIRE sans être participant ; il ne rejoint le fil
    // qu'à sa 1re contribution (postMessage auto-join), comme la vidéo et le live.
    if (
      topic.visibility === 'context' &&
      topic.context_type === 'course' &&
      (this.isStaffRole(tenant) ||
        (await this.isEnrolledInCourse(tenant.id, userId, topic.context_id)))
    ) {
      return { topic, isParticipant };
    }

    throw new ForbiddenException('Accès refusé à ce sujet');
  }

  /**
   * Contrôle d'accès « a accès au contexte » AVANT toute écriture (get-or-create).
   * Règle (Phase C) pour context_type='video' :
   *   (A) inscrit au cours = EXISTS student_progress(tenant, user, course_id), OU
   *   (B) encadrant = isStaffRole(tenant).
   * Règle (Phase D) pour context_type='live' : FAIL-CLOSED via assertLiveAccess
   *   (encadrant OU participant au live OU admis salle d'attente OU membre du cours lié).
   * Pour 'class' (pas encore de notion d'appartenance fine), on retombe sur la garde
   * générique « membre actif du tenant OU encadrant ».
   */
  private async assertContextAccess(
    tenant: TenantContext,
    userId: string,
    ctx: { contextType: string; contextId: string; courseId?: string },
  ): Promise<void> {
    if (this.isStaffRole(tenant)) return;

    if (ctx.contextType === 'video') {
      if (
        ctx.courseId &&
        (await this.isEnrolledInCourse(tenant.id, userId, ctx.courseId))
      ) {
        return;
      }
      throw new ForbiddenException('Accès refusé : non inscrit à ce cours');
    }

    if (ctx.contextType === 'live') {
      // FAIL-CLOSED : participant au live OU admis salle d'attente OU membre du
      // cours/formation lié (le staff a déjà court-circuité plus haut).
      if (await this.hasLiveTopicAccess(tenant, userId, ctx.contextId)) return;
      throw new ForbiddenException('Accès refusé : non participant à ce live');
    }

    // LOT 3 — context_type='course' : Sujet du cours lui-même (contextId = courses.id).
    // FAIL-CLOSED : seul un inscrit au cours (EXISTS student_progress, voie
    // tenant-robuste) y accède (le staff a déjà court-circuité plus haut). La
    // création « système » à la finalisation post-prod passe par un encadrant, donc
    // par le court-circuit isStaffRole ; cette branche couvre les accès non-staff.
    if (ctx.contextType === 'course') {
      if (await this.isEnrolledInCourse(tenant.id, userId, ctx.contextId)) return;
      throw new ForbiddenException('Accès refusé : non inscrit à ce cours');
    }

    // class : garde générique (membre actif du tenant).
    if (await this.isActiveMember(tenant.id, userId)) return;
    throw new ForbiddenException('Accès refusé à ce contexte');
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

  // ── Phase C — contexte vidéo ─────────────────────────────────────────────────

  /** Cherche LE Sujet d'un contexte donné dans le tenant (kind='topic'). */
  private async findContextTopic(
    tenantId: string,
    contextType: string,
    contextId: string,
  ): Promise<any | null> {
    const { data } = await this.db
      .from('conversations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('kind', 'topic')
      .eq('context_type', contextType)
      .eq('context_id', contextId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  }

  /**
   * Inscription au cours (vérité terrain) = il EXISTE une ligne student_progress
   * pour (user, course). On NE filtre PAS sur `status` : l'insert écrit 'active' mais
   * le CHECK d'origine ne le prévoit pas → status non fiable ; la PRÉSENCE de la ligne
   * fait foi. Requête service_role (bypass RLS).
   *
   * Tenant-scoping ROBUSTE : on tente d'abord la voie scopée
   * student_progress.tenant_id ; mais l'inscription côté app (MyFormationsPage,
   * EleveCoursePage) insère SANS tenant_id (colonne sans default/trigger en prod →
   * souvent NULL/divergente). Donc, si la voie scopée ne trouve rien, on retombe sur :
   * « le cours appartient bien à CE tenant (courses.tenant_id, fiable) ET il existe une
   * ligne student_progress(user, course) ». Cela évite de refuser à tort un inscrit
   * légitime, sans relâcher l'isolation tenant (course_id étant la PK globale du cours,
   * il ne peut appartenir qu'à un seul tenant).
   */
  private async isEnrolledInCourse(
    tenantId: string,
    userId: string,
    courseId: string,
  ): Promise<boolean> {
    if (!courseId) return false;

    // Voie 1 — scopée tenant (cas nominal si la ligne porte bien tenant_id).
    const scoped = await this.db
      .from('student_progress')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .limit(1)
      .maybeSingle();
    if (scoped.data) return true;

    // Voie 2 — fallback fiable : le cours est-il bien à ce tenant ?
    const { data: course } = await this.db
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!course) return false;

    // …et existe-t-il une inscription (user, course), tenant_id non fiable mis à part ?
    const { data: prog } = await this.db
      .from('student_progress')
      .select('id')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .limit(1)
      .maybeSingle();
    return !!prog;
  }

  /**
   * Variante pour le contrôle d'accès EN LECTURE d'un Sujet vidéo déjà existant :
   * on ne dispose que du video_id (= formation_day_contents.id), pas du course_id.
   * On résout le cours porteur via la chaîne studio
   *   formation_day_contents → formation_days → formation_weeks → modules → courses
   * (embedded PostgREST), en confirmant courses.tenant_id = tenant (sécurité), puis
   * on délègue à isEnrolledInCourse. Fail-closed si la chaîne est rompue (contenu
   * standalone day_id NULL, ou cross-tenant).
   */
  private async isEnrolledInVideoCourse(
    tenantId: string,
    userId: string,
    videoId: string | null,
  ): Promise<boolean> {
    if (!videoId) return false;
    const { data } = await this.db
      .from('formation_day_contents')
      .select(
        'id, formation_days!inner(formation_weeks!inner(modules!inner(formation_id, courses!inner(id, tenant_id))))',
      )
      .eq('id', videoId)
      .maybeSingle();

    const course =
      data?.formation_days?.formation_weeks?.modules?.courses ?? null;
    if (!course || course.tenant_id !== tenantId) return false;

    return this.isEnrolledInCourse(tenantId, userId, course.id);
  }

  /**
   * LOT 3 — Résout le COURS porteur d'un contenu (formation_day_contents.id) via la
   * chaîne studio formation_day_contents → formation_days → formation_weeks →
   * modules → courses (embedded PostgREST, même jointure que isEnrolledInVideoCourse).
   * Confirme courses.tenant_id = tenant (isolation) et renvoie courses.id, ou null si
   * la chaîne est rompue (contenu standalone day_id NULL, ou cross-tenant). Requête
   * service_role (bypass RLS).
   */
  private async resolveCourseIdForContent(
    tenantId: string,
    contentId: string,
  ): Promise<string | null> {
    if (!contentId) return null;
    const { data } = await this.db
      .from('formation_day_contents')
      .select(
        'id, formation_days!inner(formation_weeks!inner(modules!inner(formation_id, courses!inner(id, tenant_id))))',
      )
      .eq('id', contentId)
      .maybeSingle();

    const course =
      data?.formation_days?.formation_weeks?.modules?.courses ?? null;
    if (!course || course.tenant_id !== tenantId) return null;
    return (course.id as string) ?? null;
  }

  // ── Phase D — contexte live ──────────────────────────────────────────────────

  /**
   * Porte d'accès UNIFIÉE au Sujet d'un live (signaux « rattaché à CETTE session »).
   * Les appelants traitent le staff générique séparément (isStaffRole) ; cette porte
   * couvre en plus l'hôte/formateur déclaré de la session (dont le rôle tenant peut
   * ne pas être « staff ») et les participants. FAIL-CLOSED : renvoie true seulement
   * si l'UNE des conditions tient, dans cet ordre de fiabilité :
   *   (1) PARTICIPANT EFFECTIF : ligne live_session_participants (peuplée par le
   *       webhook LiveKit = présence réelle en room) → signal canonique ;
   *   (2) ADMIS PAR L'HÔTE en salle d'attente : live_waiting_room_entries au statut
   *       'admitted' (ou équivalent host-set) — PAS 'waiting' (auto-inscriptible) ;
   *   (3) MEMBRE DU COURS LIÉ : si la session porte un formation_id rattaché à un
   *       cours de CE tenant, un inscrit à ce cours est légitime (signal SECONDAIRE
   *       et fragile — formation_id est souvent NULL — donc en dernier recours).
   * Toutes les sous-requêtes sont scopées au tenant via live_sessions.tenant_id :
   * un context_id qui n'appartient pas au tenant échoue (NotFound → false).
   */
  private async hasLiveTopicAccess(
    tenant: TenantContext,
    userId: string,
    liveSessionId: string | null,
  ): Promise<boolean> {
    if (!liveSessionId) return false;

    // Sécurité d'isolation : la session doit appartenir à CE tenant. (host_user_id
    // et formation_id servent ensuite aux signaux d'accès, sans requête en plus.)
    const { data: session } = await this.db
      .from('live_sessions')
      .select('id, tenant_id, host_user_id, teacher_id, formation_id')
      .eq('id', liveSessionId)
      .eq('tenant_id', tenant.id)
      .maybeSingle();
    if (!session) return false;

    // L'hôte/formateur déclaré de la session est évidemment légitime (couvre le cas
    // où son rôle tenant ne serait pas « staff » mais qu'il anime ce live précis).
    if (session.host_user_id === userId || session.teacher_id === userId) {
      return true;
    }

    // (1) Participant effectif (table canonique).
    if (await this.isLiveSessionParticipant(liveSessionId, userId)) return true;

    // (2) Admis en salle d'attente.
    if (await this.isAdmittedToLiveWaitingRoom(liveSessionId, userId)) return true;

    // (3) Membre du cours lié (fallback secondaire, seulement si formation_id présent).
    if (
      session.formation_id &&
      (await this.isMemberOfLiveCourse(tenant.id, userId, session.formation_id))
    ) {
      return true;
    }

    return false;
  }

  /**
   * Participant EFFECTIF au live = il EXISTE une ligne live_session_participants
   * pour (session, user). Source canonique « qui a participé » (peuplée par le
   * webhook LiveKit participant_joined + par le front avant room.connect). Le
   * tenant-scoping est porté par l'appelant (hasLiveTopicAccess a déjà confirmé
   * que la session est du tenant). Requête service_role (bypass RLS).
   */
  private async isLiveSessionParticipant(
    liveSessionId: string,
    userId: string,
  ): Promise<boolean> {
    const { data } = await this.db
      .from('live_session_participants')
      .select('user_id')
      .eq('live_session_id', liveSessionId)
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    return !!data;
  }

  /**
   * ADMIS PAR L'HÔTE en salle d'attente du live — signal d'accès au Sujet.
   *
   * ⚠️ SÉCURITÉ (revue adversariale Phase D) : le statut 'waiting' ne donne AUCUN
   * accès. Raison : 'waiting' est AUTO-INSCRIPTIBLE par n'importe quel authentifié —
   * le front (LiveWaitingRoomPage) fait un INSERT direct {live_session_id, user_id,
   * status:'waiting'} et la RLS INSERT de la salle d'attente n'exige que
   * user_id = auth.uid() (aucun gate d'invitation ni de tenant-membership). Accepter
   * 'waiting' laisserait tout élève s'auto-inscrire sur n'importe quel live de son
   * tenant puis LIRE son Sujet — fuite. Seule une ADMISSION par l'hôte (statut passé
   * à 'admitted') prouve un rattachement légitime.
   *
   * On utilise donc une ALLOWLIST POSITIVE de statuts d'admission (fail-closed) :
   *   • 'admitted' = schéma prod (full_schema) — vérité terrain (CHECK prod vérifié =
   *     waiting|admitted|rejected|left) ;
   *   • 'accepted'|'lobby'|'audio_only'|'host_camera' = vocabulaire smart-entry
   *     (autres environnements) — tous posés par l'HÔTE, donc légitimes.
   * Exclus : 'waiting'/'host_pending' (pré-admission, auto-inscriptibles), 'rejected',
   * 'left'. NB : un participant EFFECTIF (room) est déjà couvert en amont par
   * isLiveSessionParticipant ; cette porte ne sert qu'aux admis pas encore connectés.
   */
  private async isAdmittedToLiveWaitingRoom(
    liveSessionId: string,
    userId: string,
  ): Promise<boolean> {
    const { data } = await this.db
      .from('live_waiting_room_entries')
      .select('status')
      .eq('live_session_id', liveSessionId)
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (!data) return false;
    const status = String(data.status ?? '').toLowerCase();
    // Allowlist d'ADMISSION par l'hôte. 'waiting' (auto-inscriptible) volontairement absent.
    const ADMITTED_STATUSES = new Set([
      'admitted',
      'accepted',
      'lobby',
      'audio_only',
      'host_camera',
    ]);
    return ADMITTED_STATUSES.has(status);
  }

  /**
   * Membre du cours/formation liée au live (fallback SECONDAIRE).
   *
   * Vérité terrain du modèle : dans ce schéma, « formation » = une ligne `courses`
   * (modules.formation_id REFERENCES courses.id), et le front rattache le live au
   * cours via live_sessions.formation_id = courses.id (cf. useStudentLiveSessions :
   * il bâtit la liste depuis student_progress.course_id puis filtre
   * live_sessions.formation_id IN (...)). Donc formation_id EST un courses.id : on
   * vérifie que ce cours appartient au tenant (isolation) puis on délègue le test
   * d'inscription à isEnrolledInCourse (même logique tenant-robuste que la vidéo).
   *
   * Signal VOLONTAIREMENT en dernier recours : formation_id est souvent NULL (lien
   * sans FK strict en prod) → on ne s'appuie jamais dessus comme garde principale.
   */
  private async isMemberOfLiveCourse(
    tenantId: string,
    userId: string,
    formationId: string | null,
  ): Promise<boolean> {
    if (!formationId) return false;
    return this.isEnrolledInCourse(tenantId, userId, formationId);
  }

  /**
   * Marqueur d'idempotence (subject déterministe) d'une consolidation post-live.
   * Stocké sur un message sentinelle du Sujet ; sa présence = chat déjà consolidé.
   */
  private liveConsolidationSentinel(liveSessionId: string): string {
    return `__live_consolidated__:${liveSessionId}`;
  }

  /** Titre par défaut d'un Sujet de contexte (création seulement). */
  private defaultContextSubject(contextType: string): string {
    if (contextType === 'video') return 'Questions — vidéo du cours';
    if (contextType === 'live') return 'Questions — live';
    if (contextType === 'class') return 'Questions — classe';
    if (contextType === 'course') return 'Questions — cours';
    return 'Questions';
  }

  /** Détecte une violation d'unicité Postgres (code 23505) remontée par PostgREST. */
  private isUniqueViolation(err: any): boolean {
    const code = err?.code ?? err?.cause?.code ?? err?.response?.data?.code;
    if (code === '23505') return true;
    const msg = String(err?.message ?? '').toLowerCase();
    return msg.includes('duplicate key') || msg.includes('unique constraint');
  }
}
