import { IsIn, IsString } from 'class-validator';

export const INFRA_TYPES = [
  'school',
  'medos',
  'mbolo',
  'wellness',
  'creator',
  'temple',
  'community',
] as const;

export type InfraType = (typeof INFRA_TYPES)[number];

export class ApplyTemplateDto {
  @IsString()
  @IsIn(INFRA_TYPES)
  infrastructure_type: InfraType;
}
