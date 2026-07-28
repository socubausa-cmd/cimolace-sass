'use strict';
/**
 * Test — réinitialisation de mot de passe MARQUÉE PAR TENANT.
 *
 * Ce qu'il protège :
 *  - l'e-mail part du moteur DU TENANT (marque, expéditeur, clé Resend) et non
 *    de l'envoi intégré de Supabase, dont le gabarit est anglais et générique ;
 *  - la réponse est IDENTIQUE que le compte existe ou non — l'endpoint étant
 *    public, une réponse différenciée permettrait d'énumérer les inscrits.
 *
 *   npm run build && node --test test/password-reset.test.js   (depuis apps/api)
 */
const test = require('node:test');
const assert = require('node:assert');
const { PasswordResetService } = require('../dist/auth/password-reset.service.js');

function makeService({ tenant = null, link = null, generateThrows = false } = {}) {
  const sent = [];
  const calls = [];
  const auth = {
    getClient: () => ({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: tenant }) }) }),
      }),
      auth: {
        admin: {
          generateLink: async (params) => {
            calls.push(params);
            if (generateThrows) throw new Error('boom');
            if (!link) return { data: null, error: { message: 'User not found' } };
            return { data: { properties: { action_link: link } }, error: null };
          },
        },
      },
    }),
  };
  const email = {
    brandedHtml: (o) => `<html data-brand="${o.brand || ''}"><a href="${o.ctaUrl || ''}">${o.title}</a></html>`,
    sendRaw: async (tenantId, to, subject, html) => { sent.push({ tenantId, to, subject, html }); },
  };
  return { svc: new PasswordResetService(auth, email), sent, calls };
}

const base = {
  email: 'eleve@example.com',
  tenantSlug: 'isna',
  redirectTo: 'https://app.prorascience.org/update-password',
};

test('envoie via le moteur du tenant, avec sa marque et le lien généré', async () => {
  const link = 'https://projet.supabase.co/auth/v1/verify?token=abc&type=recovery';
  const { svc, sent, calls } = makeService({ tenant: { id: 't-1', name: 'PRORASCIENCE' }, link });

  assert.deepEqual(await svc.request(base), { sent: true });

  // Le lien est FABRIQUÉ, pas expédié par Supabase : c'est ce qui nous rend l'envoi.
  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'recovery');
  assert.equal(calls[0].email, 'eleve@example.com');
  assert.deepEqual(calls[0].options, { redirectTo: base.redirectTo });

  assert.equal(sent.length, 1);
  assert.equal(sent[0].tenantId, 't-1');
  assert.equal(sent[0].to, 'eleve@example.com');
  assert.match(sent[0].subject, /Réinitialiser/);
  assert.match(sent[0].subject, /PRORASCIENCE/);
  assert.ok(sent[0].html.includes(link), 'le lien doit figurer dans le corps');
});

test("normalise l'adresse avant de chercher le compte", async () => {
  const { svc, calls } = makeService({ tenant: { id: 't-1' }, link: 'https://x/y' });
  await svc.request({ ...base, email: '  ELEVE@Example.COM ' });
  assert.equal(calls[0].email, 'eleve@example.com');
});

test('compte inconnu : même réponse, aucun envoi', async () => {
  const { svc, sent } = makeService({ tenant: { id: 't-1' }, link: null });
  assert.deepEqual(await svc.request(base), { sent: true });
  assert.equal(sent.length, 0);
});

test('tenant inconnu : même réponse, aucun envoi', async () => {
  const { svc, sent } = makeService({ tenant: null, link: 'https://x/y' });
  assert.deepEqual(await svc.request({ ...base, tenantSlug: 'inexistant' }), { sent: true });
  assert.equal(sent.length, 0);
});

test("une panne interne n'est jamais exposée au client", async () => {
  const { svc, sent } = makeService({ tenant: { id: 't-1' }, generateThrows: true });
  assert.deepEqual(await svc.request(base), { sent: true });
  assert.equal(sent.length, 0);
});

test('adresse invalide : on ne sollicite même pas Supabase', async () => {
  const { svc, calls } = makeService({ tenant: { id: 't-1' }, link: 'https://x/y' });
  assert.deepEqual(await svc.request({ ...base, email: 'pas-une-adresse' }), { sent: true });
  assert.equal(calls.length, 0);
});
