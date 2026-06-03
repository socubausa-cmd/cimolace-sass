import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthService } from '../auth/auth.service';
import { PawaPayService } from '../pawapay/pawapay.service';
import { CreateOfferingDepositDto } from './create-offering-deposit.dto';

/**
 * Montants des paliers mentorat Ngowazulu, en centimes EUR.
 * Source de vérité serveur : le montant n'est JAMAIS fourni par le client pour un abonnement.
 * (Aligné sur apps/app/src/config/ngowazuluMentoratOffers.js)
 */
const NGOWAZULU_PLAN_AMOUNTS_EUR_CENTS: Record<string, number> = {
  'ngowazulu-mentorat-1x-month': 5500,
  'ngowazulu-mentorat-1x-week': 18000,
  'ngowazulu-mentorat-2x-week': 30000,
  'ngowazulu-mentorat-urgent-3x-week': 50000,
};

const ISNA_TENANT_SLUG = 'isna';

@Injectable()
export class OfferingCheckoutService {
  private readonly logger = new Logger(OfferingCheckoutService.name);

  constructor(
    private readonly auth: AuthService,
    private readonly pawapay: PawaPayService,
  ) {}

  private get supabase() {
    return this.auth.getClient();
  }

  /** Accès non-typé à pawapay_deposits (table hors types Supabase générés). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get ppDeposits() {
    return (this.supabase as any).from('pawapay_deposits');
  }

  /**
   * Initie un dépôt Mobile Money pour un abonnement mentorat, une consultation
   * ou une offrande. Le depositId est généré avant l'appel pawaPay (idempotence).
   * Renvoie une erreur explicite si PAWAPAY_API_TOKEN n'est pas configuré.
   */
  async createMobileMoneyDeposit(userId: string, dto: CreateOfferingDepositDto) {
    // 1) Montant — calculé serveur pour un abonnement, fourni pour consultation/don
    let amountCents: number;
    let planSlug: string | null = null;

    if (dto.kind === 'subscription') {
      planSlug = dto.planSlug ?? null;
      const amt = planSlug ? NGOWAZULU_PLAN_AMOUNTS_EUR_CENTS[planSlug] : undefined;
      if (!amt) {
        throw new BadRequestException('Offre mentorat inconnue (planSlug invalide)');
      }
      amountCents = amt;
    } else {
      if (!dto.amountCents || dto.amountCents < 100) {
        throw new BadRequestException(
          dto.kind === 'donation'
            ? "Montant de l'offrande invalide (min 1,00)"
            : 'Montant de la consultation requis (min 1,00)',
        );
      }
      amountCents = dto.amountCents;
      planSlug = dto.planSlug ?? null;
    }

    // 2) Tenant isna actif
    const { data: tenant } = await this.supabase
      .from('tenants')
      .select('id')
      .eq('slug', ISNA_TENANT_SLUG)
      .eq('status', 'active')
      .maybeSingle();
    if (!tenant) throw new NotFoundException('Tenant isna introuvable ou inactif');

    // 3) Garde claire si pawaPay n'est pas configuré (évite d'insérer un dépôt orphelin)
    if (!this.pawapay.isConfigured) {
      throw new ServiceUnavailableException(
        'Paiement Mobile Money indisponible : PAWAPAY_API_TOKEN non configuré côté serveur.',
      );
    }

    // 4) Persister AVANT l'appel pawaPay (point de vérité / idempotence réseau)
    const depositId = randomUUID();
    const currency = 'EUR';
    const { error: insErr } = await this.ppDeposits.insert({
      deposit_id: depositId,
      tenant_id: tenant.id,
      user_id: userId,
      amount_cents: amountCents,
      currency,
      provider: dto.provider,
      phone_number: dto.phoneNumber,
      country: dto.country.toUpperCase(),
      pawapay_status: 'PENDING',
      kind: dto.kind,
      plan_slug: planSlug,
    });
    if (insErr) {
      this.logger.error('insert pawapay_deposit (offering)', insErr.message);
      throw new ServiceUnavailableException(
        `Impossible d'enregistrer le paiement (migration pawapay_deposits requise ?) : ${insErr.message}`,
      );
    }

    // 5) Appel pawaPay
    const result = await this.pawapay.initiateDeposit({
      depositId,
      amount: String(Math.round(amountCents)),
      currency,
      payer: {
        type: 'MMO',
        accountDetails: { phoneNumber: dto.phoneNumber, provider: dto.provider },
      },
      statementDescription: 'PRORASCIENCE'.slice(0, 22),
      metadata: {
        userId,
        tenantId: tenant.id,
        kind: dto.kind,
        planSlug: planSlug ?? '',
      },
    });

    await this.ppDeposits
      .update({ pawapay_status: result.status })
      .eq('deposit_id', depositId);

    return { depositId, status: result.status, amountCents, currency };
  }

  /** Statut d'un dépôt (scopé à l'utilisateur). */
  async getStatus(depositId: string, userId: string) {
    const { data: deposit } = await this.ppDeposits
      .select('deposit_id, user_id, pawapay_status')
      .eq('deposit_id', depositId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!deposit) throw new NotFoundException('Dépôt introuvable');
    if (deposit.pawapay_status === 'COMPLETED') {
      return { depositId, status: 'COMPLETED', isCompleted: true };
    }
    const remote = await this.pawapay.getDepositStatus(depositId);
    const status = remote?.status ?? deposit.pawapay_status;
    if (remote && remote.status !== deposit.pawapay_status) {
      await this.ppDeposits.update({ pawapay_status: remote.status }).eq('deposit_id', depositId);
    }
    return { depositId, status, isCompleted: status === 'COMPLETED' };
  }

  /** Opérateurs Mobile Money disponibles (filtrable par pays ISO3). */
  async getProviders(country?: string) {
    return this.pawapay.getActiveConfig(country);
  }
}
