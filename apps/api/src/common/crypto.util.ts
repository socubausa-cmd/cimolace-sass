import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCMTypes,
} from 'crypto';

/**
 * Chiffrement applicatif AES-256-GCM pour secrets tenant (clés de paiement,
 * webhooks, tokens d'agrégateurs…).
 *
 * Contrat :
 *   - encryptJson(obj): string  → sérialise `obj` en JSON puis chiffre.
 *   - decryptJson(str): object  → déchiffre puis JSON.parse.
 *
 * Clé : process.env.PLATFORM_ENCRYPTION_KEY = 64 caractères HEX (= 32 octets).
 *   - Volontairement LUE À L'USAGE, pas au boot : l'API doit pouvoir démarrer
 *     sans cette variable (les tenants sans paiement configuré n'en ont pas
 *     besoin). L'absence/format invalide lève une erreur CLAIRE uniquement
 *     quand on tente réellement de chiffrer/déchiffrer.
 *
 * Format de sortie (1 chaîne) : `iv:tag:ciphertext`
 *   - iv         : 12 octets, hex
 *   - tag        : 16 octets (auth tag GCM), hex
 *   - ciphertext : hex
 *   (Même convention que zoom-oauth.service.ts#encrypt, gardée homogène.)
 */

const ALGO: CipherGCMTypes = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits, recommandé pour GCM
const KEY_BYTES = 32; // AES-256
const KEY_HEX_LENGTH = KEY_BYTES * 2; // 64 caractères hex

/**
 * Résout et valide la clé de chiffrement DEPUIS L'ENV, à l'usage.
 * Lève une erreur explicite si absente ou mal formée — jamais au boot.
 */
function resolveKey(): Buffer {
  const keyHex = process.env.PLATFORM_ENCRYPTION_KEY;

  if (!keyHex) {
    // eslint-disable-next-line no-console
    console.warn(
      '[crypto.util] PLATFORM_ENCRYPTION_KEY manquante : impossible de chiffrer/déchiffrer les secrets de paiement tenant.',
    );
    throw new Error(
      'PLATFORM_ENCRYPTION_KEY manquante : configurez une clé hex de 64 caractères (32 octets) pour chiffrer les secrets de paiement.',
    );
  }

  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      'PLATFORM_ENCRYPTION_KEY invalide : attendu 64 caractères hexadécimaux (32 octets).',
    );
  }

  return Buffer.from(keyHex, 'hex');
}

/** Chiffre un objet JSON-sérialisable → chaîne `iv:tag:ciphertext`. */
export function encryptJson(obj: unknown): string {
  const key = resolveKey();
  const plaintext = JSON.stringify(obj ?? null);

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/** Déchiffre une chaîne `iv:tag:ciphertext` → objet JSON. */
export function decryptJson<T = Record<string, unknown>>(payload: string): T {
  const key = resolveKey();

  if (typeof payload !== 'string') {
    throw new Error('decryptJson : payload chiffré attendu sous forme de chaîne.');
  }

  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error(
      'decryptJson : format chiffré invalide (attendu iv:tag:ciphertext).',
    );
  }

  const [ivHex, tagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);

  return JSON.parse(decrypted.toString('utf8')) as T;
}

/** true si la clé de chiffrement est présente et bien formée (sans throw). */
export function isEncryptionConfigured(): boolean {
  const keyHex = process.env.PLATFORM_ENCRYPTION_KEY;
  return !!keyHex && new RegExp(`^[0-9a-fA-F]{${KEY_HEX_LENGTH}}$`).test(keyHex);
}
