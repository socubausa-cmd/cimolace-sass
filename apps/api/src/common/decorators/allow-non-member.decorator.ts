import { SetMetadata } from "@nestjs/common";

export const ALLOW_NON_MEMBER_KEY = "allowNonMember";

/**
 * Opt-out EXPLICITE du fail-closed tenant.
 *
 * Par défaut, TenantGuard exige désormais une `tenant_memberships` active : un
 * utilisateur authentifié NON-membre est rejeté (403). Ce décorateur autorise,
 * sur un handler (ou une classe) précis, un authentifié SANS membership à
 * atteindre l'endpoint — le contexte tenant est résolu par slug via
 * `TenantService.resolveTenantAllowNonMember` (userRole peut être null).
 *
 * À N'UTILISER que sur des surfaces qui n'exposent PAS de données tenant
 * sensibles et dont un non-membre a légitimement besoin : viewer d'un live
 * public (mbolo live-shopping, token viewer immersive-live), assistant IA
 * invité (longia). Ne JAMAIS l'appliquer à une lecture de données scopée par
 * tenant_id (fuite cross-tenant).
 */
export const AllowNonMember = () => SetMetadata(ALLOW_NON_MEMBER_KEY, true);
