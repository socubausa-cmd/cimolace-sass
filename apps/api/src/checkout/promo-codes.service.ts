import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

/**
 * CODES PROMO (Studio monétisation propriétaire) — table `billing_promo_codes` (RLS sans policy =
 * service_role via l'API uniquement). Un code porte SOIT un pourcentage, SOIT un montant fixe, est
 * tenant-scopé, peut être restreint à certains plans (`applies_to`), expirer, et être limité en
 * nombre d'utilisations. `redeemed_count` = utilisations INITIÉES (incrémenté à la création du
 * checkout — pas au paiement confirmé ; suffisant pour le pilotage fondateur).
 */
@Injectable()
export class PromoCodesService {
  private readonly logger = new Logger(PromoCodesService.name);

  constructor(private readonly auth: AuthService) {}

  private get sb() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.auth.getClient() as any;
  }

  private async tenantIdBySlug(slug: string): Promise<string | null> {
    const { data } = await this.sb.from('tenants').select('id').eq('slug', slug).maybeSingle();
    return data?.id ?? null;
  }

  async list(tenantId: string) {
    const { data } = await this.sb
      .from('billing_promo_codes')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    return data ?? [];
  }

  async create(tenantId: string, body: {
    code?: string; percentOff?: number; amountOffCents?: number;
    appliesTo?: string[]; expiresAt?: string; maxRedemptions?: number;
  }) {
    const code = String(body.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,32}$/.test(code)) {
      throw new BadRequestException('Code invalide (3-32 caractères A-Z 0-9 -).');
    }
    const pct = body.percentOff != null ? Math.round(Number(body.percentOff)) : null;
    const amt = body.amountOffCents != null ? Math.round(Number(body.amountOffCents)) : null;
    if ((pct == null) === (amt == null)) {
      throw new BadRequestException('Renseigne SOIT un pourcentage, SOIT un montant fixe.');
    }
    if (pct != null && (pct < 1 || pct > 100)) throw new BadRequestException('Pourcentage entre 1 et 100.');
    if (amt != null && amt <= 0) throw new BadRequestException('Montant de réduction invalide.');
    const row = {
      tenant_id: tenantId,
      code,
      percent_off: pct,
      amount_off_cents: amt,
      applies_to: Array.isArray(body.appliesTo) && body.appliesTo.length ? body.appliesTo : null,
      expires_at: body.expiresAt || null,
      max_redemptions: body.maxRedemptions != null ? Math.max(1, Math.round(Number(body.maxRedemptions))) : null,
    };
    const { data, error } = await this.sb.from('billing_promo_codes').insert(row).select('*').single();
    if (error) {
      if (String(error.message || '').includes('duplicate')) {
        throw new BadRequestException(`Le code ${code} existe déjà.`);
      }
      throw new BadRequestException(error.message);
    }
    return data;
  }

  async update(tenantId: string, id: string, patch: { isActive?: boolean; expiresAt?: string | null; maxRedemptions?: number | null }) {
    const upd: Record<string, unknown> = {};
    if (patch.isActive !== undefined) upd.is_active = !!patch.isActive;
    if (patch.expiresAt !== undefined) upd.expires_at = patch.expiresAt;
    if (patch.maxRedemptions !== undefined) upd.max_redemptions = patch.maxRedemptions;
    const { data, error } = await this.sb
      .from('billing_promo_codes')
      .update(upd)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async remove(tenantId: string, id: string) {
    const { error } = await this.sb.from('billing_promo_codes').delete().eq('id', id).eq('tenant_id', tenantId);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  /** Le code est-il utilisable (actif, non expiré, quota restant, applicable au plan) ? */
  private codeUsable(row: any, planSlug?: string | null): { ok: boolean; reason?: string } {
    if (!row) return { ok: false, reason: 'Code inconnu.' };
    if (!row.is_active) return { ok: false, reason: 'Code désactivé.' };
    if (row.expires_at && Date.parse(row.expires_at) < Date.now()) return { ok: false, reason: 'Code expiré.' };
    if (row.max_redemptions != null && row.redeemed_count >= row.max_redemptions) {
      return { ok: false, reason: 'Code épuisé (limite d\'utilisations atteinte).' };
    }
    if (Array.isArray(row.applies_to) && row.applies_to.length && planSlug && !row.applies_to.includes(planSlug)) {
      return { ok: false, reason: 'Ce code ne s\'applique pas à cette offre.' };
    }
    return { ok: true };
  }

  private discounted(amountCents: number, row: any): number {
    if (row.percent_off != null) return Math.max(0, Math.round(amountCents * (100 - row.percent_off) / 100));
    return Math.max(0, amountCents - (row.amount_off_cents || 0));
  }

  /**
   * Valide un code pour un tenant/plan et renvoie le prix remisé (lecture seule, pour l'UI).
   * amountCents optionnel : si absent et planSlug fourni, le prix est lu depuis billing_plans.
   */
  async validate(tenantSlug: string, code: string, planSlug?: string, amountCents?: number) {
    const tenantId = await this.tenantIdBySlug(tenantSlug);
    if (!tenantId) throw new BadRequestException('Organisation inconnue.');
    const { data: row } = await this.sb
      .from('billing_promo_codes')
      .select('*')
      .eq('tenant_id', tenantId)
      .ilike('code', String(code || '').trim())
      .maybeSingle();
    const usable = this.codeUsable(row, planSlug);
    if (!usable.ok) return { valid: false, reason: usable.reason };
    let base = amountCents ?? null;
    if (base == null && planSlug) {
      const { data: plan } = await this.sb
        .from('billing_plans').select('price_cents').eq('key', planSlug).maybeSingle();
      base = plan?.price_cents ?? null;
    }
    const discountedCents = base != null ? this.discounted(base, row) : null;
    return {
      valid: true,
      code: row.code,
      percentOff: row.percent_off,
      amountOffCents: row.amount_off_cents,
      baseCents: base,
      discountedCents,
    };
  }

  /**
   * APPLIQUE un code au montant d'un checkout (appelé par offering-checkout.resolveAmount).
   * Vérifie l'utilisabilité, incrémente `redeemed_count`, renvoie le montant remisé.
   * Lève si le code est fourni mais invalide (l'utilisateur croit avoir une réduction).
   */
  async apply(tenantSlug: string, code: string, planSlug: string | null, amountCents: number): Promise<number> {
    const tenantId = await this.tenantIdBySlug(tenantSlug);
    if (!tenantId) throw new BadRequestException('Organisation inconnue.');
    const { data: row } = await this.sb
      .from('billing_promo_codes')
      .select('*')
      .eq('tenant_id', tenantId)
      .ilike('code', String(code || '').trim())
      .maybeSingle();
    const usable = this.codeUsable(row, planSlug);
    if (!usable.ok) throw new BadRequestException(usable.reason || 'Code promo invalide.');
    const next = this.discounted(amountCents, row);
    // Un prix remisé sous le minimum encaissable (50 c) casserait Stripe/PawaPay : on refuse
    // (un accès 100 % offert passe par le flux « accès offert », pas par un coupon).
    if (next < 50) throw new BadRequestException('Ce code réduit le prix sous le minimum encaissable.');
    await this.sb
      .from('billing_promo_codes')
      .update({ redeemed_count: (row.redeemed_count || 0) + 1 })
      .eq('id', row.id);
    this.logger.log(`promo ${row.code} appliqué (${amountCents}→${next} cents, plan=${planSlug ?? '—'})`);
    return next;
  }
}
