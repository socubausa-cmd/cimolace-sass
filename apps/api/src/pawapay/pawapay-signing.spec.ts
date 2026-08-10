/**
 * Tests unitaires — signature PawaPay par tenant (RFC 9421, ECDSA P-256).
 *
 * Vérifie que :
 *  - la signature produite est cryptographiquement valide (vérifiable par la clé publique) ;
 *  - les clés sont passées PAR APPEL (aucune fuite d'un tenant vers un autre) ;
 *  - des clés absentes → requête NON signée (jamais de repli plateforme implicite) ;
 *  - `decodePrivateKeyPem` accepte base64 ET PEM en clair ;
 *  - `validatePawapaySigning` distingue valide / invalide / non configuré,
 *    sans jamais divulguer la clé ni la signature.
 */
import { generateKeyPairSync, createHash, createVerify } from 'crypto';
import {
  buildPawapaySignatureHeaders,
  decodePrivateKeyPem,
  validatePawapaySigning,
} from './pawapay-signing';

function genKey() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  return { pem, pemB64: Buffer.from(pem, 'utf8').toString('base64'), publicKey };
}

/** Reconstruit la base de signature et vérifie la signature avec la clé publique. */
function verifyHeaders(
  publicKey: ReturnType<typeof genKey>['publicKey'],
  h: Record<string, string>,
  method: string,
  url: string,
  body: string,
  contentType = 'application/json',
): boolean {
  const u = new URL(url);
  const cd = `sha-512=:${createHash('sha512').update(body).digest('base64')}:`;
  const sigInput = h['Signature-Input'].replace(/^sig-pp=/, '');
  const base = [
    `"@method": ${method.toUpperCase()}`,
    `"@authority": ${u.host}`,
    `"@path": ${u.pathname}`,
    `"signature-date": ${h['Signature-Date']}`,
    `"content-digest": ${cd}`,
    `"content-type": ${contentType}`,
    `"content-length": ${Buffer.byteLength(body)}`,
    `"@signature-params": ${sigInput}`,
  ].join('\n');
  const sigB64 = h['Signature'].replace(/^sig-pp=:/, '').replace(/:$/, '');
  return createVerify('SHA256').update(base).verify(publicKey, sigB64, 'base64');
}

describe('pawapay-signing', () => {
  const URL_DEP = 'https://api.pawapay.io/v2/deposits';
  const BODY = JSON.stringify({ depositId: 'abc', amount: '100' });

  it('produit une signature vérifiable par la clé publique correspondante', () => {
    const { pem, publicKey } = genKey();
    const h = buildPawapaySignatureHeaders('POST', URL_DEP, BODY, 'application/json', {
      privateKeyPem: pem,
      keyId: 'tenant-a',
    });
    expect(h.Signature).toBeTruthy();
    expect(h['Signature-Input']).toContain('keyid="tenant-a"');
    expect(verifyHeaders(publicKey, h, 'POST', URL_DEP, BODY)).toBe(true);
  });

  it('isole les clés par appel : la sig du tenant A ne se vérifie pas avec la clé du tenant B', () => {
    const a = genKey();
    const b = genKey();
    const hA = buildPawapaySignatureHeaders('POST', URL_DEP, BODY, 'application/json', {
      privateKeyPem: a.pem,
      keyId: 'A',
    });
    const hB = buildPawapaySignatureHeaders('POST', URL_DEP, BODY, 'application/json', {
      privateKeyPem: b.pem,
      keyId: 'B',
    });
    expect(verifyHeaders(a.publicKey, hA, 'POST', URL_DEP, BODY)).toBe(true);
    expect(verifyHeaders(b.publicKey, hB, 'POST', URL_DEP, BODY)).toBe(true);
    // Croisé → doit échouer (preuve d'absence de fuite / état partagé).
    expect(verifyHeaders(b.publicKey, hA, 'POST', URL_DEP, BODY)).toBe(false);
    expect(verifyHeaders(a.publicKey, hB, 'POST', URL_DEP, BODY)).toBe(false);
  });

  it('renvoie {} (non signé) quand la clé ou le keyId manque — pas de repli implicite', () => {
    const { pem } = genKey();
    expect(
      buildPawapaySignatureHeaders('POST', URL_DEP, BODY, 'application/json', {
        privateKeyPem: '',
        keyId: '',
      }),
    ).toEqual({});
    expect(
      buildPawapaySignatureHeaders('POST', URL_DEP, BODY, 'application/json', {
        privateKeyPem: pem,
        keyId: '',
      }),
    ).toEqual({});
    expect(
      buildPawapaySignatureHeaders('POST', URL_DEP, BODY, 'application/json', {
        privateKeyPem: '',
        keyId: 'x',
      }),
    ).toEqual({});
  });

  it('decodePrivateKeyPem accepte base64 et PEM en clair', () => {
    const { pem, pemB64 } = genKey();
    expect(decodePrivateKeyPem(pemB64)).toContain('BEGIN PRIVATE KEY');
    expect(decodePrivateKeyPem(pem)).toContain('BEGIN PRIVATE KEY');
    expect(decodePrivateKeyPem('')).toBe('');
    expect(decodePrivateKeyPem(null)).toBe('');
  });

  it('validatePawapaySigning : valide / invalide / non configuré', () => {
    const { pemB64 } = genKey();
    const ok = validatePawapaySigning(pemB64, 'k');
    expect(ok.ok).toBe(true);
    expect(ok.configured).toBe(true);
    // Ne fuit jamais le secret dans le message.
    expect(ok.message).not.toContain(pemB64);

    const bad = validatePawapaySigning('bm90LWEta2V5', 'k'); // "not-a-key" en base64
    expect(bad.ok).toBe(false);
    expect(bad.configured).toBe(true);

    const none = validatePawapaySigning('', '');
    expect(none.ok).toBe(true);
    expect(none.configured).toBe(false);

    const missingKid = validatePawapaySigning(pemB64, '');
    expect(missingKid.ok).toBe(false);
  });
});
