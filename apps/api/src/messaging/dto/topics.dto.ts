import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

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
  @IsIn(['video', 'live', 'class'])
  contextType?: string;

  /** Si visibility='context' : identifiant de la ressource rattachée. */
  @ValidateIf((o: CreateTopicDto) => o.visibility === 'context')
  @IsUUID()
  contextId?: string;
}

/** DTO — envoi d'un message dans un Sujet (réutilise la table `messages`). */
export class SendTopicMessageDto {
  @IsString() @MaxLength(10000) content: string;
}

/** Query — filtre de listing des Sujets. */
export class ListTopicsQueryDto {
  @IsOptional() @IsIn(['open', 'closed']) status?: string;
  @IsOptional() @IsIn(['public', 'private', 'context']) visibility?: string;
  @IsOptional() @IsIn(['video', 'live', 'class']) contextType?: string;
  @IsOptional() @IsUUID() contextId?: string;
}
