import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';
import {
  AUDIT_RESOURCE_KEY,
  AuditAction,
  AuditResourceConfig,
} from './decorators/audit-resource.decorator';

type MedosRequest = Request & {
  user?: { id: string };
  tenant?: TenantContext;
};

const HTTP_VERB_TO_ACTION: Record<string, AuditAction> = {
  GET: 'read',
  POST: 'create',
  PATCH: 'update',
  PUT: 'update',
  DELETE: 'delete',
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Intercepteur d'audit médical MEDOS.
 *
 * Pour chaque endpoint marqué `@AuditResource(...)`, écrit une entrée dans
 * `med_audit_log` après réponse réussie. Append-only, jamais bloquant : un
 * échec d'audit est loggé mais ne casse pas la requête métier (sinon
 * l'application devient indisponible si la table est down).
 *
 * Le mode "best effort" est volontaire — pour les opérations critiques
 * (sign, share), le service doit AUSSI écrire l'audit en transaction.
 */
@Injectable()
export class MedAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MedAuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const config = this.reflector.getAllAndOverride<
      AuditResourceConfig | undefined
    >(AUDIT_RESOURCE_KEY, [ctx.getHandler(), ctx.getClass()]);

    if (!config) {
      return next.handle();
    }

    const req = ctx.switchToHttp().getRequest<MedosRequest>();

    return next.handle().pipe(
      tap((responseData) => {
        // Fire-and-forget : on n'attend pas l'écriture en DB
        this.writeAuditEntry(config, req, responseData).catch((err) => {
          this.logger.error(
            `med_audit_log write failed for ${req.method} ${req.url}: ${err?.message}`,
          );
        });
      }),
    );
  }

  private async writeAuditEntry(
    config: AuditResourceConfig,
    req: MedosRequest,
    responseData: unknown,
  ): Promise<void> {
    const tenant = req.tenant;
    const actorId = req.user?.id;

    if (!tenant?.id || !actorId) {
      // Pas de tenant ni d'utilisateur identifié : ne devrait pas arriver
      // si les guards sont en place, mais on évite quand même de crasher.
      return;
    }

    const action: AuditAction =
      config.action ?? HTTP_VERB_TO_ACTION[req.method] ?? 'read';

    // Résoudre resource_id depuis les params, le body, ou la réponse
    const resourceId = this.resolveResourceId(config, req, responseData);

    // IP : prendre X-Forwarded-For si présent (proxy), sinon socket
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ??
      req.socket?.remoteAddress ??
      null;

    const userAgent =
      (req.headers['user-agent'] as string | undefined) ?? null;

    const { error } = await (this.supabase.client as any)
      .from('med_audit_log')
      .insert({
        tenant_id: tenant.id,
        actor_id: actorId,
        resource: config.resource,
        resource_id: resourceId,
        action,
        ip_address: ip,
        user_agent: userAgent,
        metadata: {
          method: req.method,
          path: req.url,
        },
      });

    if (error) {
      this.logger.error(`med_audit_log insert error: ${error.message}`);
    }
  }

  private resolveResourceId(
    config: AuditResourceConfig,
    req: MedosRequest,
    responseData: unknown,
  ): string | null {
    // 1. Param de route explicite (ex: idParam='id' -> req.params.id)
    if (config.idParam) {
      const fromParams = (req.params as Record<string, string> | undefined)?.[
        config.idParam
      ];
      if (fromParams && UUID_PATTERN.test(fromParams)) {
        return fromParams;
      }
    }

    // 2. Pour les POST (création), récupérer l'id depuis la réponse
    if (req.method === 'POST') {
      const dataObj = responseData as
        | { id?: string; data?: { id?: string } }
        | undefined;
      const idFromResponse = dataObj?.id ?? dataObj?.data?.id;
      if (idFromResponse && UUID_PATTERN.test(idFromResponse)) {
        return idFromResponse;
      }
    }

    // 3. Sinon : NULL (cas list / collection)
    return null;
  }
}
