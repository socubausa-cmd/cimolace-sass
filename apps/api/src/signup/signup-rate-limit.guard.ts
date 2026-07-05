import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';

/**
 * Rate-limit léger en mémoire pour les endpoints PUBLICS de signup tenant.
 * Sans garde, `POST /signup/tenant` (crée compte + tenant + essai 7j auto-confirmé)
 * permettait le FARMING d'accès « paid » en masse. Deux barrières (IP + globale),
 * SÉPARÉES PAR ROUTE (le `check-slug` appelé pendant la frappe ne doit pas épuiser
 * le quota de création de tenant).
 *
 * En mémoire ⇒ suffisant pour le replica unique actuel ; migrer vers Redis/
 * @nestjs/throttler au scale horizontal. Ne remplace pas un CAPTCHA mais coupe
 * l'abus trivial.
 */
const WINDOW_MS = 10 * 60_000; // 10 min

// Limites par route (path). Création de tenant = stricte ; check-slug = large
// (appelé en frappe, débounce côté front).
const ROUTE_LIMITS: Record<string, { perIp: number; global: number }> = {
  'signup/tenant': { perIp: 6, global: 60 },
  'signup/tenant/check-slug': { perIp: 60, global: 600 },
};
const DEFAULT_LIMIT = { perIp: 20, global: 200 };

const ipHits = new Map<string, number[]>();
const globalHits = new Map<string, number[]>();

@Injectable()
export class SignupRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(SignupRateLimitGuard.name);

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const routeKey = String(req.route?.path ?? req.path ?? 'signup')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
    const limit = ROUTE_LIMITS[routeKey] ?? DEFAULT_LIMIT;

    const fwd = (req.headers?.['x-forwarded-for'] as string | undefined) ?? '';
    const ip = fwd.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();

    // Barrière globale (par route)
    const g = (globalHits.get(routeKey) ?? []).filter((t) => now - t < WINDOW_MS);
    if (g.length >= limit.global) {
      this.logger.warn(`signup rate limit GLOBAL sur ${routeKey} (${g.length}/${limit.global})`);
      throw new HttpException('Service très sollicité, réessayez dans quelques minutes.', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Barrière par IP (namespacée par route)
    const ipKey = `${routeKey}::${ip}`;
    const arr = (ipHits.get(ipKey) ?? []).filter((t) => now - t < WINDOW_MS);
    if (arr.length >= limit.perIp) {
      this.logger.warn(`signup rate limit IP sur ${routeKey} ip=${ip} (${arr.length}/${limit.perIp})`);
      throw new HttpException('Trop de tentatives. Réessayez dans quelques minutes.', HttpStatus.TOO_MANY_REQUESTS);
    }

    arr.push(now);
    ipHits.set(ipKey, arr);
    g.push(now);
    globalHits.set(routeKey, g);

    // Nettoyage borné mémoire
    if (ipHits.size > 10_000) {
      for (const [k, v] of ipHits) {
        if (!v.some((t) => now - t < WINDOW_MS)) ipHits.delete(k);
      }
    }
    return true;
  }
}
