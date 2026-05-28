/**
 * Modes d'embedding MEDOS supportés par le widget JS + iframe.
 * Chaque mode a un scope par défaut qui restreint les endpoints accessibles
 * avec le JWT embed-token issu.
 */
export type EmbedMode =
  | 'patient-portal'      // Lecture dossier patient + notes partagées + journal
  | 'appointment-booker'  // Prise de RDV (scheduling à venir)
  | 'consent-form'        // Formulaire de consentement
  | 'intake-form'         // Anamnèse premier RDV
  | 'health-tracker';     // Journal santé (mood, sleep, vitals)

export type EmbedScope = string; // ex: 'med:notes:read'

/**
 * Mapping mode → liste de scopes attribués au JWT embed-token.
 * Le EmbedTokenGuard vérifie que la route appelée est dans le scope.
 *
 * Convention de scope : `<engine>:<resource>:<action>`
 *   - engine    : med (MEDOS)
 *   - resource  : patient, notes, forms, health, appointments
 *   - action    : read, write, list
 */
export const EMBED_SCOPES_BY_MODE: Record<EmbedMode, EmbedScope[]> = {
  'patient-portal': [
    'med:me:read',
    'med:notes:read',
    'med:forms:read',
    'med:forms:submit',
    'med:health:read',
    'med:health:write',
  ],
  'appointment-booker': [
    'med:me:read',
    'med:appointments:read',
    'med:appointments:write',
  ],
  'consent-form': [
    'med:forms:read',
    'med:forms:submit',
  ],
  'intake-form': [
    'med:forms:read',
    'med:forms:submit',
  ],
  'health-tracker': [
    'med:me:read',
    'med:health:read',
    'med:health:write',
  ],
};

export const isValidEmbedMode = (s: unknown): s is EmbedMode =>
  typeof s === 'string' && s in EMBED_SCOPES_BY_MODE;

/**
 * Payload du JWT embed-token, signé côté serveur Cimolace.
 * Durée de vie courte (15 min) — le widget réclame un nouveau token quand il expire.
 */
export type EmbedJwtPayload = {
  /** Tenant_id concerné (pas le slug, pour stabilité) */
  tenant_id: string;
  /** Mode d'embedding qui a issuré le token */
  mode: EmbedMode;
  /** Scopes accordés */
  scope: EmbedScope[];
  /** Origin qui a demandé le token (utile pour audit) */
  origin: string;
  /** Issuer */
  iss: 'cimolace-medos-embed';
  /** Subject — pour les modes patient-portal, c'est le patient_user_id résolu côté Cimolace */
  sub?: string;
};
