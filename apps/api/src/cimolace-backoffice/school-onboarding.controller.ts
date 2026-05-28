import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { CimolaceBackofficeService } from './cimolace-backoffice.service';
import { ProvisionSchoolDto, PreviewProvisionSchoolDto } from './dto/provision-school.dto';

export class InitiateSchoolCheckoutDto {
  @ApiProperty({
    description: 'Slug du tenant école existant',
    example: 'ecole-fatima',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug invalide : minuscules, chiffres et tirets uniquement',
  })
  slug!: string;

  @ApiProperty({
    enum: ['starter', 'pro', 'business'],
    description: 'Plan souscrit',
    example: 'starter',
  })
  @IsIn(['starter', 'pro', 'business'])
  plan!: 'starter' | 'pro' | 'business';

  @ApiPropertyOptional({
    enum: ['stripe', 'chariow', 'cinetpay', 'pawapay'],
    description: 'Provider de paiement demandé. Stripe par défaut. PawaPay/Chariow/CinetPay pour mobile money.',
    example: 'pawapay',
  })
  @IsOptional()
  @IsIn(['stripe', 'chariow', 'cinetpay', 'pawapay'])
  provider?: 'stripe' | 'chariow' | 'cinetpay' | 'pawapay';

  @ApiPropertyOptional({
    description: 'Téléphone Mobile Money au format international E.164, requis pour PawaPay',
    example: '+237670000000',
  })
  @IsOptional()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'phoneNumber doit être au format international E.164',
  })
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Opérateur PawaPay, ex: MTN_MOMO_CMR',
    example: 'MTN_MOMO_CMR',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  pawapayProvider?: string;

  @ApiPropertyOptional({
    description: 'Pays ISO3 PawaPay, ex: CMR, CIV, RWA',
    example: 'CMR',
  })
  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  country?: string;

  @ApiPropertyOptional({ description: "URL de redirection apres paiement reussi" })
  @IsOptional()
  @IsUrl({ require_tld: false })
  success_url?: string;

  @ApiPropertyOptional({ description: "URL de redirection si le paiement est annule" })
  @IsOptional()
  @IsUrl({ require_tld: false })
  cancel_url?: string;
}

@ApiTags('School Onboarding')
@ApiBearerAuth()
@Controller('school-onboarding')
@UseGuards(JwtAuthGuard)
export class SchoolOnboardingController {
  constructor(private readonly svc: CimolaceBackofficeService) {}

  @Get('engines')
  getEngineManifest() {
    return (this.svc as any).getSchoolEngineManifest();
  }

  @Post('provision/preview')
  previewProvision(@Body() dto: PreviewProvisionSchoolDto) {
    return (this.svc as any).previewProvisionSchool(dto);
  }

  @Post('provision')
  provision(@Body() dto: ProvisionSchoolDto) {
    return (this.svc as any).provisionSchoolFromTemplate(dto);
  }

  /**
   * Initie un checkout pour un tenant ecole existant.
   * Retourne { checkoutUrl } — le frontend redirige vers cette URL.
   *
   * Prerequis : l'ecole doit avoir ete creee via POST /school-onboarding/provision.
   * Stripe, Chariow, CinetPay et PawaPay passent par le moteur billing Cimolace.
   */
  @Post('checkout')
  initiateSchoolCheckout(
    @CurrentUser() user: AuthUser,
    @Body() dto: InitiateSchoolCheckoutDto,
  ) {
    return (this.svc as any).initiateSchoolCheckout(dto, user);
  }
}
