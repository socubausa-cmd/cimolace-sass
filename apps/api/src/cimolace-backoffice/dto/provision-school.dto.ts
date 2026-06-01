import {
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProvisionSchoolDto {
  @ApiProperty({
    description: 'Nom affiche de la nouvelle ecole',
    maxLength: 120,
    example: 'Ecole Fatima',
  })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    description: 'Slug unique du tenant (minuscules, chiffres, tirets)',
    minLength: 2,
    maxLength: 64,
    example: 'ecole-fatima',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Slug invalide : minuscules, chiffres et tirets uniquement (ex: ecole-fatima)',
  })
  slug!: string;

  @ApiProperty({
    description: "Email de l'administrateur proprietaire",
    example: 'admin@ecole-fatima.org',
  })
  @IsEmail()
  owner_email!: string;

  @ApiPropertyOptional({ description: 'Raison sociale', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  business_name?: string;

  @ApiPropertyOptional({
    description: 'Domaine principal',
    example: 'ecolefatima.org',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  domain?: string;

  @ApiPropertyOptional({
    enum: ['starter', 'school', 'platform', 'enterprise'],
    description: 'Plan Cimolace (defaut: school)',
  })
  @IsOptional()
  @IsIn(['starter', 'school', 'platform', 'enterprise'])
  plan?: 'starter' | 'school' | 'platform' | 'enterprise';

  @ApiPropertyOptional({ description: 'URL du logo' })
  @IsOptional()
  @IsUrl()
  logo_url?: string;

  @ApiPropertyOptional({ description: 'URL du favicon' })
  @IsOptional()
  @IsString()
  favicon_url?: string;

  @ApiPropertyOptional({
    description: 'Couleurs de marque',
    example: { primary: '#0b1115', secondary: '#162331', accent: '#d4af37' },
  })
  @IsOptional()
  @IsObject()
  brand_colors?: { primary?: string; secondary?: string; accent?: string };

  @ApiPropertyOptional({
    description: 'Zones du shell qui consomment la charte du tenant',
    example: {
      header: true,
      footer: true,
      publicVitrine: true,
      memberApp: true,
      liveStudio: true,
      adminBackoffice: true,
    },
  })
  @IsOptional()
  @IsObject()
  branding_zones?: Record<string, boolean>;

  @ApiPropertyOptional({
    description: 'Police UI du shell école',
    example: 'Inter, system-ui, sans-serif',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  font_family?: string;

  @ApiPropertyOptional({
    description: 'Rayon UI du shell école',
    example: '12px',
    maxLength: 24,
  })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  radius?: string;

  @ApiPropertyOptional({ description: 'Email de contact public' })
  @IsOptional()
  @IsEmail()
  contact_email?: string;

  @ApiPropertyOptional({
    description: 'Memo operateur journalise',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class PreviewProvisionSchoolDto extends ProvisionSchoolDto {}
