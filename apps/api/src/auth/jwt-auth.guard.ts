import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Override pour convertir TOUTES les erreurs d'auth (token manquant,
   * invalide, expiré, JWKS down, etc.) en UnauthorizedException 401 propre.
   *
   * Sans ça, Passport renvoie une Error native que le GlobalExceptionFilter
   * convertit en 500 — fausse alerte qui masque le vrai problème (401).
   */
  handleRequest<TUser = unknown>(err: unknown, user: TUser, info: unknown): TUser {
    if (err || !user) {
      const reason =
        (info as { message?: string })?.message ??
        (err as { message?: string })?.message ??
        'Authentification requise';
      throw new UnauthorizedException(reason);
    }
    return user;
  }
}
