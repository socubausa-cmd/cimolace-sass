import { describe, expect, it } from 'vitest';
import { validateCoachArchitectHandoff } from './validateCoachArchitectHandoff.ts';

const validV1 = {
  action: 'design_update',
  intervention_level: 'medium',
  context: { slide_goal: 'test' },
  problems_detected: ['a'],
  objectives: ['b'],
  instructions: { layout: { type: 'x' } },
};

describe('validateCoachArchitectHandoff', () => {
  it('accepte le socle v1 minimal', () => {
    const v = validateCoachArchitectHandoff(validV1);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.value.action).toBe('design_update');
      expect(v.value.intervention_level).toBe('medium');
      expect(v.value.architect_extension_v2).toBeUndefined();
    }
  });

  it('rejette action incorrecte', () => {
    const v = validateCoachArchitectHandoff({ ...validV1, action: 'other' });
    expect(v.ok).toBe(false);
  });

  it('accepte architect_extension_v2 optionnelle avec types valides', () => {
    const v = validateCoachArchitectHandoff({
      ...validV1,
      architect_extension_v2: {
        render_type: 'cinematic_poster',
        photo_actions: ['soft_blend'],
        requires_user_validation: true,
      },
    });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.value.architect_extension_v2?.render_type).toBe('cinematic_poster');
      expect(v.value.architect_extension_v2?.requires_user_validation).toBe(true);
    }
  });

  it('rejette architect_extension_v2 invalide', () => {
    const v = validateCoachArchitectHandoff({
      ...validV1,
      architect_extension_v2: { requires_user_validation: 'oui' },
    });
    expect(v.ok).toBe(false);
  });
});
