import {
  normalizeSecretaryProfile,
  scoreSecretary,
  rankSecretaries,
  matchingStrategy,
  isSecretaryOnline,
  type Secretary,
} from './secretary-matching';
import { detectVisitorContext, openingHoursForRegion } from './timezone-routing';

const nowIso = () => new Date().toISOString();

/** Secrétaire de test : par défaut active, en ligne, ouverte 24h. */
function sec(over: Partial<Secretary> = {}): Secretary {
  return {
    id: 's1',
    name: 'S1',
    timezone: 'Africa/Libreville',
    region: 'GABON',
    country: 'GA',
    startHour: 0,
    endHour: 24,
    active: true,
    online: true,
    lastSeenAt: nowIso(),
    slaMs: 300_000,
    ...over,
  };
}

describe('timezone-routing', () => {
  it('detectVisitorContext mappe le fuseau vers une région', () => {
    expect(detectVisitorContext({ timezone: 'America/New_York' }).region).toBe('US');
    expect(detectVisitorContext({ timezone: 'Europe/Paris' }).region).toBe('FRANCE');
    expect(detectVisitorContext({ timezone: 'Africa/Libreville' }).region).toBe('GABON');
  });

  it('openingHoursForRegion diffère par région', () => {
    expect(openingHoursForRegion('US')).toEqual({ startHour: 9, endHour: 18 });
    expect(openingHoursForRegion('GABON')).toEqual({ startHour: 8, endHour: 20 });
  });
});

describe('secretary-matching', () => {
  it('normalizeSecretaryProfile déduit la région du fuseau', () => {
    const s = normalizeSecretaryProfile({ id: 'x', timezone: 'America/Chicago' });
    expect(s.region).toBe('US');
    expect(s.active).toBe(false);
  });

  it('isSecretaryOnline respecte le SLA', () => {
    expect(isSecretaryOnline(sec({ online: true, lastSeenAt: nowIso() }))).toBe(true);
    expect(
      isSecretaryOnline(sec({ online: true, lastSeenAt: new Date(Date.now() - 10 * 60_000).toISOString() })),
    ).toBe(false); // 10 min > SLA 5 min
    expect(isSecretaryOnline(sec({ online: false }))).toBe(false);
  });

  it('scoreSecretary : même région + en ligne score plus haut que région différente hors ligne', () => {
    const same = scoreSecretary({ secretary: sec(), visitorRegion: 'GABON', slotDate: Date.now() });
    const diff = scoreSecretary({
      secretary: sec({ region: 'US', timezone: 'America/New_York', online: false }),
      visitorRegion: 'GABON',
      slotDate: Date.now(),
    });
    expect(same).toBeGreaterThan(diff);
  });

  it('rankSecretaries filtre les inactives et trie par score décroissant', () => {
    const ranked = rankSecretaries({
      secretaries: [
        sec({ id: 'inactive', active: false }),
        sec({ id: 'far', region: 'US', timezone: 'America/New_York', online: false }),
        sec({ id: 'near', region: 'GABON' }),
      ],
      visitorRegion: 'GABON',
      slotDate: Date.now(),
    });
    expect(ranked.map((r) => r.id)).not.toContain('inactive');
    expect(ranked[0].id).toBe('near');
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });

  it('matchingStrategy = local quand un secrétariat de la région du visiteur est ouvert', () => {
    const res = matchingStrategy({
      secretaries: [sec({ region: 'GABON' })],
      visitorRegion: 'GABON',
    });
    expect(res.strategy).toBe('local');
  });

  it('matchingStrategy = closed quand personne n\'est ouvert/en ligne', () => {
    const res = matchingStrategy({
      secretaries: [sec({ online: false })],
      visitorRegion: 'GABON',
    });
    expect(res.strategy).toBe('closed');
  });
});
