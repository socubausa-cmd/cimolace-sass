import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * Un tour de conversation (fil de l'assistant patient). `role` est borné
 * à user/assistant (jamais 'system' côté client). `content` borné en taille
 * pour limiter les tokens — l'historique est de toute façon tronqué côté
 * serveur aux ~6 derniers messages.
 */
export class AssistantTurnDto {
  @ApiProperty({ enum: ['user', 'assistant'], example: 'user' })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @ApiProperty({ example: 'Pourquoi mon score de digestion est-il bas ?' })
  @IsString()
  @MaxLength(2000)
  content!: string;
}

/**
 * Corps de POST /med/twin-me/assistant.
 *
 * PAS de patientId : le patient est résolu via le JWT (req.user.id) +
 * X-Tenant-Slug, exactement comme /med/twin-me/state.
 */
export class AssistantMessageDto {
  @ApiProperty({
    example: 'Que veulent dire mes indicateurs et que puis-je améliorer ?',
    description: 'Question du patient en clair (FR).',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  @ApiPropertyOptional({
    type: [AssistantTurnDto],
    description:
      "Tours précédents du fil (optionnel). Tronqué côté serveur aux ~6 derniers messages pour borner les tokens.",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AssistantTurnDto)
  history?: AssistantTurnDto[];
}
