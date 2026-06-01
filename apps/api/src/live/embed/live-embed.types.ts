/**
 * Types pour le système d'embed LIRI Live.
 * Permet d'intégrer un live dans n'importe quel site externe
 * (WordPress, Wix, site custom) via une iframe sécurisée.
 */

export interface LiveEmbedTokenPayload {
  /** ID du tenant propriétaire de la session */
  tenant_id: string;
  /** ID de la live_session LiveKit */
  session_id: string;
  /** Rôle de l'utilisateur dans la room */
  role: LiveEmbedRole;
  /** Origin HTTP du site qui a demandé le token */
  origin: string;
  /** Issuer — toujours 'cimolace-liri-embed' pour vérification */
  iss: 'cimolace-liri-embed';
  /** iat / exp gérés par JwtService */
  iat?: number;
  exp?: number;
}

/**
 * Rôles disponibles pour un participant embed.
 *
 * - viewer   : regarde uniquement (canPublish: false)
 * - co_host  : caméra/micro activés, modération partielle
 * - host     : accès complet (canPublish + roomAdmin + enregistrement)
 */
export type LiveEmbedRole = 'viewer' | 'co_host' | 'host';

/** Durée de vie du token embed en secondes (30 min) */
export const EMBED_TOKEN_TTL_SECONDS = 60 * 30;

/** Durée de vie du token LiveKit émis pour un viewer embed (1h) */
export const LIVEKIT_VIEWER_TOKEN_TTL = '1h';
