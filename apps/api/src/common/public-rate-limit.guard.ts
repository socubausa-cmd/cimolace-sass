import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';

/**
 * Rate-limit léger EN MÉMOIRE pour les endpoints ÉCRITURE PUBLICS (sans login) :
 * dons de cagnotte (Stripe/pawaPay) et prise de RDV séance de prière. Sans garde,
 * ces routes anonymes créent des sessions de paiement, des demandes de RDV et
 * envoient des e-mails → cible facile de spam. Deux barrières (par IP + globale),
 * séparées PAR ROUTE. En mémoire ⇒ suffisant pour le replica unique ; migrer vers
 * Redis/@nestjs/throttler au scale horizontal. Ne remplace pas un CAPTCHA mais
 * coupe l'abus trivial. Calqué sur `SignupRateLimitGuard`.
 */
const WINDOW_MS = 10 * 60_000; // 10 min

const ROUTE_LIMITS: Record<string, { perIp: number; global: number }> = {
  'booking-public/:slug/appointment-request': { perIp: 4, global: 50 },
  'cagnotte/:slug/stripe': { perIp: 12, global: 150 },
  'cagnotte/:slug/pawapay': { perIp: 12, global: 150 },
};
const DEFAULT_LIMIT = { perIp: 15, global: 200 };

const ipHits = new Map<string, number[]>();
const globalHits = new Map<string, number[]>();

@Injectable()
export class PublicRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(PublicRateLimitGuard.name);

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const routeKey = String(req.route?.path ?? req.path ?? 'public')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
    const limit = ROUTE_LIMITS[routeKey] ?? DEFAULT_LIMIT;

    const fwd = (req.headers?.['x-forwarded-for'] as string | undefined) ?? '';
    const ip = fwd.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();

    const g = (globalHits.get(routeKey) ?? []).filter((t) => now - t < WINDOW_MS);
    if (g.length >= limit.global) {
      this.logger.warn(`public rate limit GLOBAL sur ${routeKey} (${g.length}/${limit.global})`);
      throw new HttpException('Service très sollicité, réessayez dans quelques minutes.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const ipKey = `${routeKey}::${ip}`;
    const arr = (ipHits.get(ipKey) ?? []).filter((t) => now - t < WINDOW_MS);
    if (arr.length >= limit.perIp) {
      this.logger.warn(`public rate limit IP sur ${routeKey} ip=${ip} (${arr.length}/${limit.perIp})`);
      throw new HttpException('Trop de tentatives. Réessayez dans quelques minutes.', HttpStatus.TOO_MANY_REQUESTS);
    }

    arr.push(now);
    ipHits.set(ipKey, arr);
    g.push(now);
    globalHits.set(routeKey, g);

    if (ipHits.size > 10_000) {
      for (const [k, v] of ipHits) {
        if (!v.some((t) => now - t < WINDOW_MS)) ipHits.delete(k);
      }
    }
    return true;
  }
}
