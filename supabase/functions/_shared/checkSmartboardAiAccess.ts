import { corsHeaders } from './cors.ts';

/**
 * Backstop SERVEUR du gating `canSmartboardAI` (copilote IA du tableau LIRI).
 *
 * Le front masque déjà les actions IA en palier gratuit (NeuroInkPanel), mais un
 * appel direct à ces edge functions les contournerait. Ce helper REFUSE (403) si
 * le tenant est en palier GRATUIT. Il réplique `resolveTier` de
 * apps/api/src/billing/liri-entitlements.service.ts : un abonnement actif et non
 * expiré (status='active' ET current_period_end NULL ou > now) = payant/essai →
 * autorisé ; sinon = gratuit → refusé.
 *
 * FAIL-OPEN (renvoie null = autorisé) si la lecture billing échoue OU si le tenant
 * n'a pas pu être résolu — cohérent avec le NestJS : on ne casse jamais un live
 * payant à cause d'un glitch de lecture ; la facturation se régularise à froid.
 *
 * Usage (après resolveTenant) :
 *   const ctx = await resolveTenant(req, body);
 *   if (ctx) { const deny = await checkSmartboardAiAccess(ctx); if (deny) return deny; }
 */
export async function checkSmartboardAiAccess(
  ctx: { tenantId: string; supabase: { from: (t: string) => any } },
): Promise<Response | null> {
  try {
    const { data: sub, error } = await ctx.supabase
      .from('billing_subscriptions')
      .select('status, current_period_end')
      .eq('tenant_id', ctx.tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null; // fail-open
    const now = Date.now();
    const end = sub?.current_period_end ? new Date(sub.current_period_end).getTime() : null;
    const active = sub?.status === 'active' && (end === null || end > now);
    if (active) return null; // payant / essai → autorisé
    return new Response(
      JSON.stringify({
        error: 'TIER_RESTRICTED',
        code: 'smartboard_ai_paid_only',
        message:
          "Le copilote IA du tableau (Smartboard IA) est réservé aux forfaits LIRI. Passez à un forfait pour l'activer.",
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch {
    return null; // fail-open
  }
}
