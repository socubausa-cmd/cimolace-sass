import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LiveService } from '../live/live.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';

/**
 * Mbolo Live Shopping — domain wrapper around Liri.
 *
 * Demonstrates the canonical pattern documented in the P5 handoff: any
 * engine that needs video calls Liri.issueTokenForSession with its own
 * purpose. Mbolo does NOT import LiveKitService.
 *
 * Today this is a minimal proof of concept: a single endpoint that issues
 * a Liri token for a Mbolo "live sale" — the seller as host, the viewer
 * as guest. The Mbolo schema doesn't yet have a `mbolo_live_sales` table,
 * so we use the product_id as external_ref. When the full schema lands,
 * swap that for the actual sale row id.
 */
@Injectable()
export class MboloLiveService {
  private readonly logger = new Logger(MboloLiveService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly liri: LiveService,
  ) {}

  /**
   * Issue a Liri token for a Mbolo live shopping session tied to a product.
   * Re-joining the same product reuses the same LiveKit room.
   */
  async joinProductLive(
    tenant: TenantContext,
    userId: string,
    productId: string,
    role: 'seller' | 'viewer',
    displayName?: string,
  ) {
    // Minimal access control: verify the product exists in this tenant.
    // The real Mbolo flow would also check the seller owns the product etc.
    const { data: product } = await this.supabase.client
      .from('mbolo_products')
      .select('id, name, vendor_id')
      .eq('tenant_id', tenant.id)
      .eq('id', productId)
      .single();
    if (!product) throw new NotFoundException('Produit introuvable');

    // Sellers get host privileges (publish + roomAdmin). Viewers subscribe only.
    return this.liri.issueTokenForSession({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      externalRef: `mbolo_live_${productId}`,
      purpose: 'live_shopping',
      userId,
      displayName,
      role: role === 'seller' ? 'host' : 'guest',
      metadata: {
        product_id: productId,
        product_name: (product as any).name,
        vendor_id: (product as any).vendor_id,
      },
    });
  }

  /**
   * Mark the live as ended (seller hangs up). Liri computes the duration.
   */
  async endProductLive(tenant: TenantContext, productId: string) {
    return this.liri.endLiriSession(tenant.id, `mbolo_live_${productId}`);
  }
}
