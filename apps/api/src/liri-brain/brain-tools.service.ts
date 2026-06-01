import { Injectable, Logger } from '@nestjs/common';
import type { TenantContext } from '../tenant/tenant.types';
import { CoursesService } from '../courses/courses.service';
import { ForumService } from '../forum/forum.service';
import { SecretariatService } from '../secretariat/secretariat.service';
import { LiveService } from '../live/live.service';
import { BookingService } from '../booking/booking.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GrowthService } from '../growth/growth.service';

/**
 * BrainToolsService — registre d'outils que LIRI Brain (le LLM) peut appeler
 * (function-calling). Chaque outil mappe vers un SERVICE NestJS existant.
 *
 * Garde-fous :
 *  - Le `tenant` vient TOUJOURS du contexte serveur (jamais d'un argument LLM).
 *  - RBAC re-vérifié ici (les services sont appelés hors @RolesGuard).
 *  - Les actions d'écriture portent `requiresConfirmation` → human-in-the-loop côté UI.
 *
 * Intégration (prochaine étape) : `streamChat()` expose `getToolSpecs(role)` au
 * provider (Anthropic `tools` / OpenAI·DeepSeek `tools`), puis boucle
 * tool_use → execute() → tool_result. Cette boucle SSE est volontairement
 * laissée pour un second passage (à valider en exécution avec les clés).
 */

export interface BrainToolContext {
  tenant: TenantContext;
  userId: string;
  /** Rôle effectif de l'appelant (tenant.userRole). */
  role: string;
}

export interface BrainToolSpec {
  name: string;
  description: string;
  /** JSON Schema des paramètres (format attendu par les API LLM). */
  parameters: Record<string, unknown>;
  allowedRoles: string[] | '*';
  requiresConfirmation: boolean;
}

interface BrainToolDef extends BrainToolSpec {
  handler: (args: Record<string, any>, ctx: BrainToolContext) => Promise<unknown>;
}

const ANY = '*' as const;
const str = (v: unknown) => String(v ?? '').trim();

@Injectable()
export class BrainToolsService {
  private readonly logger = new Logger(BrainToolsService.name);
  private readonly tools: BrainToolDef[];

  constructor(
    private readonly courses: CoursesService,
    private readonly forum: ForumService,
    private readonly secretariat: SecretariatService,
    private readonly live: LiveService,
    private readonly booking: BookingService,
    private readonly notifications: NotificationsService,
    private readonly growth: GrowthService,
  ) {
    this.tools = this.buildRegistry();
  }

  /** Specs exposables au LLM, filtrées par rôle (puis, plus tard, par moteurs actifs du tenant). */
  getToolSpecs(role: string): BrainToolSpec[] {
    return this.tools
      .filter((t) => this.roleAllowed(t, role))
      .map(({ handler: _handler, ...spec }) => spec);
  }

  requiresConfirmation(name: string): boolean {
    return this.tools.find((t) => t.name === name)?.requiresConfirmation ?? false;
  }

  /**
   * Exécute un outil. RBAC + tenant forcés ici. À appeler depuis la boucle
   * function-calling, et UNIQUEMENT après confirmation utilisateur si requiresConfirmation.
   */
  async execute(
    name: string,
    args: Record<string, any>,
    ctx: BrainToolContext,
  ): Promise<unknown> {
    const tool = this.tools.find((t) => t.name === name);
    if (!tool) throw new Error(`Outil inconnu: ${name}`);
    if (!this.roleAllowed(tool, ctx.role)) {
      throw new Error(`Rôle « ${ctx.role} » non autorisé pour l'outil ${name}`);
    }
    this.logger.log(`exec tool=${name} tenant=${ctx.tenant.id} role=${ctx.role}`);
    return tool.handler(args ?? {}, ctx);
  }

  private roleAllowed(t: BrainToolSpec, role: string): boolean {
    return t.allowedRoles === ANY || t.allowedRoles.includes(role);
  }

  private buildRegistry(): BrainToolDef[] {
    return [
      // ── LECTURE (exécution automatique) ──────────────────────────────────
      {
        name: 'list_courses',
        description: "Liste les cours de l'école (id, titre, statut).",
        parameters: { type: 'object', properties: {}, required: [] },
        allowedRoles: ANY,
        requiresConfirmation: false,
        handler: (_a, ctx) => this.courses.listCourses(ctx.tenant.id),
      },
      {
        name: 'get_course',
        description: "Détail d'un cours (modules / leçons).",
        parameters: {
          type: 'object',
          properties: { course_id: { type: 'string', description: 'UUID du cours' } },
          required: ['course_id'],
        },
        allowedRoles: ANY,
        requiresConfirmation: false,
        handler: (a, ctx) => this.courses.getCourse(ctx.tenant.id, str(a.course_id)),
      },
      {
        name: 'get_my_course_progress',
        description: "Progression de l'utilisateur courant sur un cours donné.",
        parameters: {
          type: 'object',
          properties: { course_id: { type: 'string' } },
          required: ['course_id'],
        },
        allowedRoles: ANY,
        requiresConfirmation: false,
        handler: (a, ctx) =>
          this.courses.getProgress(ctx.tenant.id, ctx.userId, str(a.course_id)),
      },
      {
        name: 'search_forum',
        description: 'Recherche des sujets du forum par mots-clés.',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
        allowedRoles: ANY,
        requiresConfirmation: false,
        handler: (a, ctx) => this.forum.searchTopics(ctx.tenant.id, str(a.query)),
      },
      {
        name: 'list_forum_topics',
        description: 'Liste les sujets du forum (filtre optionnel par catégorie).',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string' },
            page: { type: 'number' },
            limit: { type: 'number' },
          },
          required: [],
        },
        allowedRoles: ANY,
        requiresConfirmation: false,
        handler: (a, ctx) =>
          this.forum.listTopics(
            ctx.tenant.id,
            a.category ? str(a.category) : undefined,
            Number(a.page) || 1,
            Number(a.limit) || 20,
          ),
      },
      {
        name: 'list_enrollments',
        description: "Liste les inscriptions de l'école (réservé secrétariat/admin). Filtre statut optionnel.",
        parameters: {
          type: 'object',
          properties: { status: { type: 'string' } },
          required: [],
        },
        allowedRoles: ['owner', 'admin', 'secretariat'],
        requiresConfirmation: false,
        handler: (a, ctx) =>
          this.secretariat.listEnrollments(ctx.tenant.id, a.status ? str(a.status) : undefined),
      },

      // ── LIRI Live ────────────────────────────────────────────────────────
      {
        name: 'list_lives',
        description: "Liste les sessions live de l'école (id, titre, statut, date).",
        parameters: { type: 'object', properties: {}, required: [] },
        allowedRoles: ANY,
        requiresConfirmation: false,
        handler: (_a, ctx) => this.live.findAll(ctx.tenant.id),
      },
      {
        name: 'get_live',
        description: "Détail d'une session live (par id).",
        parameters: {
          type: 'object',
          properties: { live_id: { type: 'string', description: 'UUID de la session live' } },
          required: ['live_id'],
        },
        allowedRoles: ANY,
        requiresConfirmation: false,
        handler: (a, ctx) => this.live.findOne(ctx.tenant.id, str(a.live_id)),
      },

      // ── Cours : détail (modules / leçons) ────────────────────────────────
      {
        name: 'list_modules',
        description: "Liste les modules d'un cours.",
        parameters: {
          type: 'object',
          properties: { course_id: { type: 'string' } },
          required: ['course_id'],
        },
        allowedRoles: ANY,
        requiresConfirmation: false,
        handler: (a, ctx) => this.courses.listModules(ctx.tenant.id, str(a.course_id)),
      },
      {
        name: 'list_lessons',
        description: "Liste les leçons d'un module.",
        parameters: {
          type: 'object',
          properties: { module_id: { type: 'string' } },
          required: ['module_id'],
        },
        allowedRoles: ANY,
        requiresConfirmation: false,
        handler: (a, ctx) => this.courses.listLessons(ctx.tenant.id, str(a.module_id)),
      },

      // ── Forum : détail ───────────────────────────────────────────────────
      {
        name: 'list_forum_categories',
        description: 'Liste les catégories du forum.',
        parameters: { type: 'object', properties: {}, required: [] },
        allowedRoles: ANY,
        requiresConfirmation: false,
        handler: (_a, ctx) => this.forum.listCategories(ctx.tenant.id),
      },
      {
        name: 'get_forum_topic',
        description: "Détail d'un sujet de forum (par id).",
        parameters: {
          type: 'object',
          properties: { topic_id: { type: 'string' } },
          required: ['topic_id'],
        },
        allowedRoles: ANY,
        requiresConfirmation: false,
        handler: (a, ctx) => this.forum.getTopic(ctx.tenant.id, str(a.topic_id)),
      },
      {
        name: 'list_forum_posts',
        description: "Liste les messages (réponses) d'un sujet de forum.",
        parameters: {
          type: 'object',
          properties: { topic_id: { type: 'string' } },
          required: ['topic_id'],
        },
        allowedRoles: ANY,
        requiresConfirmation: false,
        handler: (a, ctx) => this.forum.listPosts(ctx.tenant.id, str(a.topic_id)),
      },

      // ── Rendez-vous (booking) ────────────────────────────────────────────
      {
        name: 'list_booking_slots',
        description:
          'Liste les créneaux de rendez-vous disponibles. Filtres dates ISO 8601 optionnels (from / to).',
        parameters: {
          type: 'object',
          properties: { from: { type: 'string' }, to: { type: 'string' } },
          required: [],
        },
        allowedRoles: ANY,
        requiresConfirmation: false,
        handler: (a, ctx) =>
          this.booking.listSlots(
            ctx.tenant.id,
            a.from ? str(a.from) : undefined,
            a.to ? str(a.to) : undefined,
          ),
      },
      {
        name: 'list_my_appointments',
        description: "Liste les rendez-vous (un élève ne voit que les siens).",
        parameters: { type: 'object', properties: {}, required: [] },
        allowedRoles: ANY,
        requiresConfirmation: false,
        handler: (_a, ctx) => this.booking.listAppointments(ctx.tenant.id, ctx.userId, ctx.role),
      },

      // ── Notifications ────────────────────────────────────────────────────
      {
        name: 'list_my_notifications',
        description: "Liste les notifications de l'utilisateur courant.",
        parameters: { type: 'object', properties: {}, required: [] },
        allowedRoles: ANY,
        requiresConfirmation: false,
        handler: (_a, ctx) => this.notifications.getUserNotifications(ctx.tenant.id, ctx.userId),
      },

      // ── Statistiques école (growth) ──────────────────────────────────────
      {
        name: 'get_school_stats',
        description:
          "Statistiques de l'école : nombre de membres, de lives, de cours, et revenus encaissés. Réservé à la direction.",
        parameters: { type: 'object', properties: {}, required: [] },
        allowedRoles: ['owner', 'admin', 'secretariat'],
        requiresConfirmation: false,
        handler: (_a, ctx) => this.growth.getTenantStats(ctx.tenant.id),
      },

      // ── ÉCRITURE (confirmation humaine obligatoire) ──────────────────────
      {
        name: 'create_forum_topic',
        description:
          "Crée un sujet de forum (ex. publier un clip / replay dans une discussion). Action d'écriture : nécessite confirmation.",
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            content: { type: 'string' },
            category: { type: 'string' },
          },
          required: ['title', 'content'],
        },
        allowedRoles: ANY,
        requiresConfirmation: true,
        handler: (a, ctx) =>
          this.forum.createTopic(ctx.tenant, ctx.userId, {
            title: str(a.title),
            content: str(a.content),
            category: a.category ? str(a.category) : undefined,
          }),
      },
      {
        name: 'reply_forum_topic',
        description:
          "Publie une réponse dans un sujet de forum existant. Action d'écriture : nécessite confirmation.",
        parameters: {
          type: 'object',
          properties: {
            topic_id: { type: 'string', description: 'UUID du sujet' },
            content: { type: 'string' },
          },
          required: ['topic_id', 'content'],
        },
        allowedRoles: ANY,
        requiresConfirmation: true,
        handler: (a, ctx) =>
          this.forum.createPost(ctx.tenant, str(a.topic_id), ctx.userId, {
            content: str(a.content),
          }),
      },
    ];
  }
}
