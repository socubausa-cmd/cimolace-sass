const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTimedTranscript, groupLiveCues, isPrivateNetworkAddress } = require('../dist/masterclass-factory/source-adapters.service.js');

test('LIVE parse les repères minute et heure sans inventer le texte libre', () => {
  assert.deepEqual(parseTimedTranscript('[02:14] Première idée\n[1:02:14] Conclusion\nSans repère'), [
    { t: 134, text: 'Première idée' },
    { t: 3734, text: 'Conclusion' },
  ]);
});

test('LIVE agrège les captions courtes en fenêtres exploitables', () => {
  assert.deepEqual(groupLiveCues([{ t: 0, text: 'Une' }, { t: 4, text: 'idée' }, { t: 30, text: 'Suite' }]), [
    { t: 0, text: 'Une idée' },
    { t: 30, text: 'Suite' },
  ]);
});

test('extracteur URL bloque les réseaux privés IPv4, IPv6 et loopback', () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '172.16.2.3', '192.168.1.2', '169.254.1.1', '::1', 'fd00::1', 'fe80::1']) {
    assert.equal(isPrivateNetworkAddress(address), true, address);
  }
  assert.equal(isPrivateNetworkAddress('1.1.1.1'), false);
  assert.equal(isPrivateNetworkAddress('2606:4700:4700::1111'), false);
});
