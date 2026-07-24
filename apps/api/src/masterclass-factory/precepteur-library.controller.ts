import { Controller, Get, NotFoundException, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * BIBLIOTHÈQUE DU PRÉCEPTEUR — les cours générés par l'agent TikTok→Précepteur
 * (tables `precepteur_courses`/`precepteur_sources`, RLS service-role → lecture via l'API).
 * Accessible à TOUT membre du tenant (élèves inclus) : c'est de la matière de cours.
 * Le front joue `course` via le lecteur Précepteur existant (conformCourseSync au rendu).
 */
@Controller('precepteur-library')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PrecepteurLibraryController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get()
  async list(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (this.supabase.client as any)
      .from('precepteur_courses')
      .select('id, title, status, model, created_at, source:precepteur_sources(external_id, url, title)')
      .eq('tenant_id', req.tenant.id)
      .order('created_at', { ascending: false })
      .limit(200);
    return { data: data ?? [] };
  }

  @Get(':id')
  async get(@Req() req: any, @Param('id') id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (this.supabase.client as any)
      .from('precepteur_courses')
      .select('id, title, course, manual_md, model, created_at, source:precepteur_sources(external_id, url, title)')
      .eq('tenant_id', req.tenant.id)
      .eq('id', id)
      .maybeSingle();
    if (!data) throw new NotFoundException('Cours introuvable.');
    return { data };
  }
}
