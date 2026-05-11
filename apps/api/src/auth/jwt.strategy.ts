import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { createPublicKey, type JsonWebKey } from 'crypto';
import { ExtractJwt, Strategy, type StrategyOptions } from 'passport-jwt';

export type SupabaseAccessTokenPayload = {
  sub: string;
  role?: string;
  email?: string;
  aud?: string | string[];
  iss?: string;
};

type JwtHeader = {
  alg?: string;
  kid?: string;
};

type JwksResponse = {
  keys?: Array<JsonWebKey & { kid?: string }>;
};

let cachedJwks: { expiresAt: number; keys: JwksResponse['keys'] } | null = null;

function decodeJwtHeader(rawJwtToken: string): JwtHeader {
  const [encodedHeader] = rawJwtToken.split('.');
  if (!encodedHeader) return {};

  const json = Buffer.from(encodedHeader, 'base64url').toString('utf8');
  return JSON.parse(json) as JwtHeader;
}

async function fetchJwks(jwksUrl: string): Promise<JwksResponse['keys']> {
  const now = Date.now();
  if (cachedJwks && cachedJwks.expiresAt > now) return cachedJwks.keys;

  const response = await fetch(jwksUrl);
  if (!response.ok) {
    throw new Error(`JWKS Supabase indisponible (${response.status})`);
  }

  const body = (await response.json()) as JwksResponse;
  cachedJwks = {
    expiresAt: now + 5 * 60 * 1000,
    keys: body.keys ?? [],
  };
  return cachedJwks.keys;
}

function createSupabaseSecretProvider(config: ConfigService) {
  const hmacSecret = config.get<string>('SUPABASE_JWT_SECRET') ?? '';
  const supabaseUrl = config.get<string>('SUPABASE_URL')?.replace(/\/$/, '');
  const jwksUrl =
    config.get<string>('SUPABASE_JWKS_URL') ??
    (supabaseUrl ? `${supabaseUrl}/auth/v1/.well-known/jwks.json` : '');

  if ((!hmacSecret || hmacSecret === 'replace_me') && !jwksUrl) {
    throw new Error(
      'Configure SUPABASE_JWT_SECRET ou SUPABASE_JWKS_URL/SUPABASE_URL dans apps/api/.env',
    );
  }

  return (_request: unknown, rawJwtToken: string, done: (err: unknown, secret?: string | Buffer) => void) => {
    void (async () => {
      const header = decodeJwtHeader(rawJwtToken);

      if (header.alg?.startsWith('HS')) {
        if (!hmacSecret || hmacSecret === 'replace_me') {
          throw new Error('SUPABASE_JWT_SECRET manquant pour token HS256');
        }
        done(null, hmacSecret);
        return;
      }

      if (header.alg === 'ES256') {
        if (!header.kid) throw new Error('Token ES256 sans kid');
        if (!jwksUrl) throw new Error('SUPABASE_JWKS_URL manquant');

        const keys = await fetchJwks(jwksUrl);
        const jwk = keys?.find((key) => key.kid === header.kid);
        if (!jwk) throw new Error(`Clé JWKS introuvable pour kid=${header.kid}`);

        const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
        done(null, publicKey.export({ type: 'spki', format: 'pem' }));
        return;
      }

      throw new Error(`Algorithme JWT Supabase non supporté: ${header.alg ?? 'inconnu'}`);
    })().catch((error: unknown) => done(error));
  };
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const issuer = config.get<string>('SUPABASE_JWT_ISSUER')?.trim();
    const audience = config.get<string>('SUPABASE_JWT_AUD')?.trim();

    const opts: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: createSupabaseSecretProvider(config),
      algorithms: ['HS256', 'ES256'],
    };

    if (issuer) opts.issuer = issuer;
    if (audience) opts.audience = audience;

    super(opts);
  }

  validate(payload: SupabaseAccessTokenPayload) {
    if (!payload?.sub) {
      throw new UnauthorizedException();
    }
    return {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    };
  }
}
