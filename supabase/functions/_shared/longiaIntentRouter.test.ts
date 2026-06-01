import { describe, expect, it } from 'vitest';
import { routeLongiaLlmMode } from './longiaIntentRouter.ts';

describe('longiaIntentRouter', () => {
  it('coach + heavy JSON intent upgrades to architect', () => {
    const r = routeLongiaLlmMode('coach', [
      { role: 'user', content: 'Génère un JSON valide pour ma scène Konva avec 3 textes.' },
    ]);
    expect(r.effectiveMode).toBe('architect');
    expect(r.reason).toBe('intent_heavy_upgrade');
  });

  it('coach + short UI question stays coach', () => {
    const r = routeLongiaLlmMode('coach', [{ role: 'user', content: 'Comment grouper deux rectangles ?' }]);
    expect(r.effectiveMode).toBe('coach');
    expect(r.reason).toBe('client_coach');
  });

  it('architect + trivial greeting downgrades to coach', () => {
    const r = routeLongiaLlmMode('architect', [{ role: 'user', content: 'Bonjour !' }]);
    expect(r.effectiveMode).toBe('coach');
    expect(r.reason).toBe('architect_hub_social_downgrade');
  });

  it('architect + real request stays architect', () => {
    const r = routeLongiaLlmMode('architect', [
      { role: 'user', content: 'Propose un plan détaillé pour mon cours sur les fractions.' },
    ]);
    expect(r.effectiveMode).toBe('architect');
    expect(r.reason).toBe('client_architect');
  });
});
