import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateBannerDto } from './dto/create-banner.dto';
import type { CreatePopupDto } from './dto/create-popup.dto';
import type { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import type { UpdateBannerDto } from './dto/update-banner.dto';
import type { UpdatePopupDto } from './dto/update-popup.dto';
import type { UpdatePromoCodeDto } from './dto/update-promo-code.dto';

const PROMO_CODE_COLUMNS =
  'id, code, discount_type, discount_value, max_uses, uses_count, expires_at, is_active, created_at';
const POPUP_COLUMNS = 'id, title, content, trigger_type, is_active, created_at';
const BANNER_COLUMNS = 'id, text, cta_url, cta_label, is_active, created_at';

@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {}

  private assertEnabled(): void {
    if (!this.config.get<string>('USE_API_V2_MARKETING')) {
      throw new NotImplementedException(
        'Marketing API désactivée (USE_API_V2_MARKETING non défini)',
      );
    }
  }

  async findAllPromoCodes(tenantId: string) {
    this.assertEnabled();
    const { data, error } = await this.supabase.client
      .from('promo_codes')
      .select(PROMO_CODE_COLUMNS)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) this.fail('findAll promo_codes', error);
    return data ?? [];
  }

  async createPromoCode(dto: CreatePromoCodeDto, tenantId: string) {
    this.assertEnabled();
    const { data, error } = await this.supabase.client
      .from('promo_codes')
      .insert({
        tenant_id: tenantId,
        code: dto.code.trim().toUpperCase(),
        discount_type: dto.discountType,
        discount_value: dto.discountValue,
        max_uses: dto.maxUses ?? null,
        expires_at: dto.expiresAt ?? null,
        is_active: dto.isActive ?? true,
      })
      .select(PROMO_CODE_COLUMNS)
      .single();

    if (error?.code === '23505') {
      throw new ConflictException('Ce code promo existe déjà pour ce tenant');
    }
    if (error) this.fail('create promo_code', error);
    return data;
  }

  async findOnePromoCode(id: string, tenantId: string) {
    this.assertEnabled();
    const { data, error } = await this.supabase.client
      .from('promo_codes')
      .select(PROMO_CODE_COLUMNS)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) this.fail('findOne promo_code', error);
    if (!data) throw new NotFoundException(`Code promo "${id}" introuvable`);
    return data;
  }

  async updatePromoCode(id: string, dto: UpdatePromoCodeDto, tenantId: string) {
    this.assertEnabled();
    const { data, error } = await this.supabase.client
      .from('promo_codes')
      .update({
        ...(dto.code !== undefined
          ? { code: dto.code.trim().toUpperCase() }
          : {}),
        ...(dto.discountType !== undefined
          ? { discount_type: dto.discountType }
          : {}),
        ...(dto.discountValue !== undefined
          ? { discount_value: dto.discountValue }
          : {}),
        ...(dto.maxUses !== undefined ? { max_uses: dto.maxUses } : {}),
        ...(dto.expiresAt !== undefined ? { expires_at: dto.expiresAt } : {}),
        ...(dto.isActive !== undefined ? { is_active: dto.isActive } : {}),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select(PROMO_CODE_COLUMNS)
      .maybeSingle();

    if (error?.code === '23505') {
      throw new ConflictException('Ce code promo existe déjà pour ce tenant');
    }
    if (error) this.fail('update promo_code', error);
    if (!data) throw new NotFoundException(`Code promo "${id}" introuvable`);
    return data;
  }

  async removePromoCode(id: string, tenantId: string) {
    this.assertEnabled();
    await this.findOnePromoCode(id, tenantId);
    const { error } = await this.supabase.client
      .from('promo_codes')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) this.fail('remove promo_code', error);
    return { id };
  }

  async findAllPopups(tenantId: string) {
    this.assertEnabled();
    const { data, error } = await this.supabase.client
      .from('popups')
      .select(POPUP_COLUMNS)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) this.fail('findAll popups', error);
    return data ?? [];
  }

  async createPopup(dto: CreatePopupDto, tenantId: string) {
    this.assertEnabled();
    const { data, error } = await this.supabase.client
      .from('popups')
      .insert({
        tenant_id: tenantId,
        title: dto.title,
        content: dto.content,
        trigger_type: dto.triggerType,
        is_active: dto.isActive ?? true,
      })
      .select(POPUP_COLUMNS)
      .single();

    if (error) this.fail('create popup', error);
    return data;
  }

  async findOnePopup(id: string, tenantId: string) {
    this.assertEnabled();
    const { data, error } = await this.supabase.client
      .from('popups')
      .select(POPUP_COLUMNS)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) this.fail('findOne popup', error);
    if (!data) throw new NotFoundException(`Popup "${id}" introuvable`);
    return data;
  }

  async updatePopup(id: string, dto: UpdatePopupDto, tenantId: string) {
    this.assertEnabled();
    const { data, error } = await this.supabase.client
      .from('popups')
      .update({
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.triggerType !== undefined
          ? { trigger_type: dto.triggerType }
          : {}),
        ...(dto.isActive !== undefined ? { is_active: dto.isActive } : {}),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select(POPUP_COLUMNS)
      .maybeSingle();

    if (error) this.fail('update popup', error);
    if (!data) throw new NotFoundException(`Popup "${id}" introuvable`);
    return data;
  }

  async removePopup(id: string, tenantId: string) {
    this.assertEnabled();
    await this.findOnePopup(id, tenantId);
    const { error } = await this.supabase.client
      .from('popups')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) this.fail('remove popup', error);
    return { id };
  }

  async findAllBanners(tenantId: string) {
    this.assertEnabled();
    const { data, error } = await this.supabase.client
      .from('banners')
      .select(BANNER_COLUMNS)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) this.fail('findAll banners', error);
    return data ?? [];
  }

  async createBanner(dto: CreateBannerDto, tenantId: string) {
    this.assertEnabled();
    const { data, error } = await this.supabase.client
      .from('banners')
      .insert({
        tenant_id: tenantId,
        text: dto.text,
        cta_url: dto.ctaUrl,
        cta_label: dto.ctaLabel,
        is_active: dto.isActive ?? true,
      })
      .select(BANNER_COLUMNS)
      .single();

    if (error) this.fail('create banner', error);
    return data;
  }

  async findOneBanner(id: string, tenantId: string) {
    this.assertEnabled();
    const { data, error } = await this.supabase.client
      .from('banners')
      .select(BANNER_COLUMNS)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) this.fail('findOne banner', error);
    if (!data) throw new NotFoundException(`Bannière "${id}" introuvable`);
    return data;
  }

  async updateBanner(id: string, dto: UpdateBannerDto, tenantId: string) {
    this.assertEnabled();
    const { data, error } = await this.supabase.client
      .from('banners')
      .update({
        ...(dto.text !== undefined ? { text: dto.text } : {}),
        ...(dto.ctaUrl !== undefined ? { cta_url: dto.ctaUrl } : {}),
        ...(dto.ctaLabel !== undefined ? { cta_label: dto.ctaLabel } : {}),
        ...(dto.isActive !== undefined ? { is_active: dto.isActive } : {}),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select(BANNER_COLUMNS)
      .maybeSingle();

    if (error) this.fail('update banner', error);
    if (!data) throw new NotFoundException(`Bannière "${id}" introuvable`);
    return data;
  }

  async removeBanner(id: string, tenantId: string) {
    this.assertEnabled();
    await this.findOneBanner(id, tenantId);
    const { error } = await this.supabase.client
      .from('banners')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) this.fail('remove banner', error);
    return { id };
  }

  private fail(action: string, error: { message: string }): never {
    this.logger.error(action, error.message);
    throw new InternalServerErrorException('Erreur interne');
  }
}
