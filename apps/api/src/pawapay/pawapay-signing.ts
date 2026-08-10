import { createHash, createSign } from 'crypto';

/**
 * Signature des requêtes financières PawaPay (RFC 9421, ECDSA P-256 SHA-256).
 *
 * Fonctions PURES, sans état d'instance : les clés sont passées PAR APPEL. C'est
 * ce qui permet de signer avec les clés DU TENANT (chacun son compte PawaPay)
 * sans jamais risquer qu'une requête d'un tenant parte signée avec la clé d'un
 * autre — écueil garanti par tout singleton mutable partagé entre requêtes
 * concurrentes.
 *
 * Contrainte de sécurité : ces fonctions ne journalisent RIEN et ne renvoient
 * jamais la clé privée ni la signature ailleurs que dans les en-têtes destinés
 * à PawaPay.
 */

export type PawapaySigning = { privateKeyPem: string; keyId: string };

/**
 * Décode une clé privée PEM. Accepte soit un PEM en clair (contient
 * « -----BEGIN »), soit un PEM encodé base64 mono-ligne — forme utilisée par la
 * variable d'env `PAWAPAY_PRIVATE_KEY` ET par le champ tenant `private_key`.
 */
export function decodePrivateKeyPem(raw: string | undefined | null): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (s.includes('-----BEGIN')) return s;
  try {
    return Buffer.from(s, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

/**
 * Construit les en-têtes de signature RFC 9421 attendus par PawaPay lorsque
 * « Only accept signed requests » est activé. Renvoie {} si les clés sont
 * absentes → la requête part non signée (comportement historique). PEUT lever
 * si la clé est malformée : les appelants qui ne veulent jamais casser la
 * requête doivent envelopper dans un try/catch (cf. PawaPayService.signHeaders).
 */
export function buildPawapaySignatureHeaders(
  method: string,
  url: string,
  body: string,
  contentType: string,
  signing: PawapaySigning,
): Record<string, string> {
  const { privateKeyPem, keyId } = signing;
  if (!privateKeyPem || !keyId) return {};

  const u = new URL(url);
  const created = Math.floor(Date.now() / 1000);
  const expires = created + 60;
  const sigDate = new Date().toISOString();
  const contentDigest = `sha-512=:${createHash('sha512').update(body).digest('base64')}:`;
  const contentLength = Buffer.byteLength(body).toString();
  const components = [
    '@method',
    '@authority',
    '@path',
    'signature-date',
    'content-digest',
    'content-type',
    'content-length',
  ];
  const params = `(${components.map((c) => `"${c}"`).join(' ')});alg="ecdsa-p256-sha256";keyid="${keyId}";created=${created};expires=${expires}`;
  const base = [
    `"@method": ${method.toUpperCase()}`,
    `"@authority": ${u.host}`,
    `"@path": ${u.pathname}`,
    `"signature-date": ${sigDate}`,
    `"content-digest": ${contentDigest}`,
    `"content-type": ${contentType}`,
    `"content-length": ${contentLength}`,
    `"@signature-params": ${params}`,
  ].join('\n');
  // PawaPay vérifie la signature ECDSA en DER (encodage par défaut de crypto.sign,
  // cf. leur exemple officiel signed-deposit-example.js), PAS en IEEE-P1363.
  const signature = createSign('SHA256').update(base).sign(privateKeyPem, 'base64');
  return {
    'Content-Digest': contentDigest,
    'Content-Length': contentLength,
    'Signature-Date': sigDate,
    'Signature-Input': `sig-pp=${params}`,
    Signature: `sig-pp=:${signature}:`,
  };
}

/**
 * Valide LOCALEMENT une paire (clé privée, key_id) sans contacter PawaPay :
 * parse la clé et produit une signature de test. Aucun mouvement de fonds.
 * Sert au bouton « tester la connexion » pour exercer le chemin de signature du
 * tenant et détecter immédiatement une clé malformée.
 *
 * Sécurité : ne renvoie JAMAIS la clé ni la signature dans le message.
 */
export function validatePawapaySigning(
  privateKeyRaw: string | undefined | null,
  keyId: string | undefined | null,
): { ok: boolean; message: string; configured: boolean } {
  const pem = decodePrivateKeyPem(privateKeyRaw);
  const kid = String(keyId ?? '').trim();
  if (!pem && !kid) {
    return {
      ok: true,
      configured: false,
      message:
        'Aucune clé de signature configurée (les requêtes partiront non signées ; à renseigner si votre compte PawaPay exige des requêtes signées).',
    };
  }
  if (!pem) return { ok: false, configured: true, message: 'Clé privée de signature absente ou illisible.' };
  if (!kid) return { ok: false, configured: true, message: 'Identifiant de clé (key_id) manquant.' };
  try {
    const headers = buildPawapaySignatureHeaders(
      'POST',
      'https://api.pawapay.io/v2/deposits',
      '{"test":true}',
      'application/json',
      { privateKeyPem: pem, keyId: kid },
    );
    if (!headers.Signature) {
      return { ok: false, configured: true, message: 'La clé de signature n’a produit aucune signature (clé invalide ?).' };
    }
    return { ok: true, configured: true, message: 'Clés de signature valides (signature générée localement).' };
  } catch (e) {
    return { ok: false, configured: true, message: `Clé de signature invalide : ${(e as Error).message}` };
  }
}
