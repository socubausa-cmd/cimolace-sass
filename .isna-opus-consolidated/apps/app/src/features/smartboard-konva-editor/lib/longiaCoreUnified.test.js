import { describe, expect, it } from 'vitest';
import { enrichLocalLongiaForStore, mergeApiLongiaForStore } from './longiaCoreUnified.js';

describe('mergeApiLongiaForStore', () => {
  it('maps unified + merged suggestions', () => {
    const p = mergeApiLongiaForStore(
      {
        text: 'Bonjour',
        primaryActions: [{ label: 'Agir', action: 'dup' }],
        secondarySuggestions: [{ label: 'Idée', action: 'nearest_templates' }],
        suggestions: [],
        unified: {
          message: 'Bonjour',
          understanding: { task: 'test' },
          actions: [{ label: 'Agir', action: 'dup' }],
          suggestions: [{ label: 'Idée', action: 'nearest_templates' }],
          preview: 'Aperçu',
          explanations: ['Ligne 1'],
        },
        intent: null,
      },
      undefined,
    );
    expect(p.text).toBe('Bonjour');
    expect(p.suggestions.length).toBe(2);
    expect(p.longiaUnified?.actions?.length).toBe(1);
    expect(p.longiaUnified?.suggestions?.length).toBe(1);
    expect(p.longiaUnified?.preview).toBe('Aperçu');
  });

  it('builds unified when API has no unified key', () => {
    const p = mergeApiLongiaForStore(
      {
        text: 'Hi',
        primaryActions: [{ label: 'A', action: 'x' }],
        secondarySuggestions: [],
        suggestions: [{ label: 'A', action: 'x' }],
        intent: { task: 'chat' },
      },
      'Hi',
    );
    expect(p.longiaUnified?.message).toBe('Hi');
    expect(p.longiaUnified?.understanding?.intent).toEqual({ task: 'chat' });
    expect(p.longiaComposed).toBeNull();
  });

  it('prefers composed v1 when present', () => {
    const p = mergeApiLongiaForStore({
      text: 'legacy',
      composed: {
        message: 'Salut',
        tone_mode: 'human',
        strategy: 'human_first',
        understanding: { intent: 'social_greeting' },
        actions: [{ id: 'a_1', label: 'Document', action: 'start_guided_flow', variant: 'primary' }],
        suggestions: [],
        explanations: [{ label: 'Note', content: 'Détail' }],
      },
    });
    expect(p.text).toBe('Salut');
    expect(p.tone_mode).toBe('human');
    expect(p.longiaComposed?.strategy).toBe('human_first');
    expect(p.longiaUnified?.actions?.[0]?.payload?.variant).toBe('primary');
    expect(Array.isArray(p.longiaUnified?.explanations)).toBe(true);
  });
});

describe('enrichLocalLongiaForStore', () => {
  it('puts local chips in actions tier', () => {
    const p = enrichLocalLongiaForStore({
      text: 'Local',
      suggestions: [{ label: 'Architect', action: 'use_architect_mode' }],
      strategy: 'local_coach',
    });
    expect(p.longiaUnified?.actions?.length).toBe(1);
    expect(p.longiaUnified?.suggestions?.length).toBe(0);
    expect(p.suggestions.length).toBe(1);
    expect(p.longiaComposed?.response_id).toMatch(/^lr_local_/);
  });
});
