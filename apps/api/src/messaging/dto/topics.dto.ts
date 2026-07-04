import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO — création d'un Sujet (conversation kind='topic').
 * Socle ADDITIF « forum connecté » : un Sujet est une conversation greffée sur la
 * messagerie existante, avec un titre (subject), une visibilité, et un contexte
 * optionnel (vidéo/live/cours).
 */
export class CreateTopicDto {
  @IsString() @MaxLength(300) subject: string;

  /** Premier message du Sujet (optionnel — un Sujet peut être ouvert vide). */
  @IsOptional() @IsString() @MaxLength(10000) content?: string;

  /** public = tout membre actif du tenant ; private/context = participants. */
  @IsOptional() @IsIn(['public', 'private', 'context']) visibility?: string;

  /** Si visibility='context' : type de ressource rattachée. */
  @ValidateIf((o: CreateTopicDto) => o.visibility === 'context')
  @IsIn(['video', 'live', 'class', 'course'])
  contextType?: string;

  /** Si visibility='context' : identifiant de la ressource rattachée. */
  @ValidateIf((o: CreateTopicDto) => o.visibility === 'context')
  @IsUUID()
  contextId?: string;
}

/**
 * DTO — get-or-create idempotent d'un Sujet rattaché à un contexte (Phase C vidéo).
 *
 * Sert le panneau Questions du lecteur : à la 1re ouverture, le front demande
 * (find-or-create) LE Sujet `kind='topic'`, visibility='context', du couple
 * (context_type, context_id). Pour context_type='video', `courseId` est requis :
 * il sert au contrôle d'accès « inscrit au cours » (EXISTS student_progress).
 *
 * context_type='course' (LOT 3) : Sujet du COURS lui-même (context_id = courses.id).
 * Alimenté côté serveur à la finalisation d'une post-prod de cours (cf.
 * CourseBuilderService.saveVersion → TopicsService.publishCourseContentTopic) ;
 * c'est aussi la cible de l'unification du forum (questions de cours).
 */
export class GetOrCreateContextTopicDto {
  /** Type de ressource rattachée (obligatoire). */
  @IsIn(['video', 'live', 'class', 'course']) contextType: string;

  /** Identifiant de la ressource (= video_id = formation_day_contents.id, ou courses.id pour 'course'). */
  @IsUUID() contextId: string;

  /**
   * Cours porteur — requis pour context_type='video' (contrôle d'accès inscription).
   * = courses.id. Ignoré pour les autres types de contexte.
   */
  @ValidateIf((o: GetOrCreateContextTopicDto) => o.contextType === 'video')
  @IsUUID()
  courseId?: string;

  /** Titre par défaut à la création (un Sujet déjà existant garde le sien). */
  @IsOptional() @IsString() @MaxLength(300) subject?: string;
}

/** DTO — envoi d'un message dans un Sujet (réutilise la table `messages`). */
export class SendTopicMessageDto {
  @IsString() @MaxLength(10000) content: string;
}

/**
 * DTO — Phase D : consolidation POST-LIVE du chat d'une session dans son Sujet.
 *
 * À l'issue d'un live (status='ended'), l'encadrant déclenche la copie du chat
 * éphémère (live_session_chat) dans le Sujet durable kind='topic' du couple
 * ('live', liveSessionId). `courseId` est optionnel : s'il est fourni il sert
 * de garde supplémentaire à la résolution d'accès, mais le contrôle réel passe
 * par la garde live (staff requis pour publier). Opération IDEMPOTENTE.
 */
export class PublishLiveTopicDto {
  /** Identifiant de la session live (= live_sessions.id = context_id du Sujet). */
  @IsUUID() liveSessionId: string;

  /** Titre du Sujet à la création s'il n'existe pas encore (sinon ignoré). */
  @IsOptional() @IsString() @MaxLength(300) subject?: string;
}

/** Query — filtre de listing des Sujets. */
export class ListTopicsQueryDto {
  @IsOptional() @IsIn(['open', 'closed']) status?: string;
  @IsOptional() @IsIn(['public', 'private', 'context']) visibility?: string;
  @IsOptional() @IsIn(['video', 'live', 'class']) contextType?: string;
  @IsOptional() @IsUUID() contextId?: string;
}

/**
 * Query — lecture FORUM des Sujets publics (LOT 1).
 * `limit` borne la réponse (1..200, défaut appliqué côté service si absent).
 */
export class ListForumTopicsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
