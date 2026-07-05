import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';

/**
 * Rate-limit léger EN MÉMOIRE pour l'auto-inscription PUBLIQUE au « lien de groupe »
 * (POST /med/teleconsult-invite-public/register). Sans garde, quiconque possède le
 * lien pourrait créer des invitations en masse → spam de la salle d'attente + lignes
 * DB. Deux barrières : par IP (une personne s'inscrit une fois, quelques retries
 * tolérés) + globale (protège même face à des IP distribuées).
 *
 * En mémoire ⇒ suffisant pour le replica unique actuel ; migrer Redis/@nestjs/
 * throttler au scale horizontal. Ne remplace pas un CAPTCHA mais coupe l'abus
 * trivial. Calqué sur `SignupRateLimitGuard`. Le cap par SÉANCE (nombre max de
 * participants) est en plus, côté service (`selfRegisterInvite`).
 */
const WINDOW_MS = 10 * 60_000; // 10 min
const PER_IP = 8; // 1 inscription par personne (+ quelques retours arrière)
const GLOBAL = 200; // gros événement multi-invités = surtout des IP distinctes

const ipHits = new Map<string, number[]>();
let globalHits: number[] = [];

@Injectable()
export class TeleconsultRegisterRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(TeleconsultRegisterRateLimitGuard.name);

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const fwd = (req.headers?.['x-forwarded-for'] as string | undefined) ?? '';
    const ip =
      fwd.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown';
    const now = Date.now();

    globalHits = globalHits.filter((t) => now - t < WINDOW_MS);
    if (globalHits.length >= GLOBAL) {
      this.logger.warn(
        `teleconsult register rate limit GLOBAL (${globalHits.length}/${GLOBAL})`,
      );
      throw new HttpException(
        'Service très sollicité, réessayez dans quelques minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const arr = (ipHits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    if (arr.length >= PER_IP) {
      this.logger.warn(
        `teleconsult register rate limit IP=${ip} (${arr.length}/${PER_IP})`,
      );
      throw new HttpException(
        'Trop de tentatives. Réessayez dans quelques minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    arr.push(now);
    ipHits.set(ip, arr);
    globalHits.push(now);

    // Nettoyage borné mémoire.
    if (ipHits.size > 10_000) {
      for (const [k, v] of ipHits) {
        if (!v.some((t) => now - t < WINDOW_MS)) ipHits.delete(k);
      }
    }
    return true;
  }
}
