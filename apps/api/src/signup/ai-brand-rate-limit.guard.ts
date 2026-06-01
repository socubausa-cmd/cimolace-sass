import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';

/**
 * Rate-limit léger en mémoire pour POST /signup/ai-brand (endpoint public +
 * coûteux : chaque appel = une requête LLM Groq facturée).
 *
 * Deux barrières :
 *   - par IP        : MAX_PER_IP requêtes / fenêtre
 *   - globale       : MAX_GLOBAL requêtes / fenêtre (plafonne la dépense même
 *                     sous abus distribué multi-IP)
 *
 * En mémoire ⇒ suffisant pour le replica unique actuel ; à migrer vers
 * Redis/@nestjs/throttler si on scale horizontalement. Ne remplace pas un
 * captcha mais coupe l'abus trivial.
 */
const WINDOW_MS = 60_000;
const MAX_PER_IP = 5;
const MAX_GLOBAL = 40;

const ipHits = new Map<string, number[]>();
let globalHits: number[] = [];

@Injectable()
export class AiBrandRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(AiBrandRateLimitGuard.name);

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const fwd = (req.headers?.['x-forwarded-for'] as string | undefined) ?? '';
    const ip =
      fwd.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown';
    const now = Date.now();

    // Barrière globale
    globalHits = globalHits.filter((t) => now - t < WINDOW_MS);
    if (globalHits.length >= MAX_GLOBAL) {
      this.logger.warn(`ai-brand global rate limit hit (${globalHits.length}/${MAX_GLOBAL})`);
      throw new HttpException(
        'Service très sollicité, réessaie dans une minute.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Barrière par IP
    const arr = (ipHits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    if (arr.length >= MAX_PER_IP) {
      throw new HttpException(
        'Trop de générations. Réessaie dans une minute.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    arr.push(now);
    ipHits.set(ip, arr);
    globalHits.push(now);

    // Nettoyage borné de la mémoire
    if (ipHits.size > 5000) {
      for (const [k, v] of ipHits) {
        if (!v.some((t) => now - t < WINDOW_MS)) ipHits.delete(k);
      }
    }
    return true;
  }
}
