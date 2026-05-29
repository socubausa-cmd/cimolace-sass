import { describe, it, expect } from 'vitest';
import {
  DESIGNER_IA_IMAGE_SIZES,
  invokeGenerateVisualImage,
  invokeStudioCoverPromptAssistant,
} from './designerIaImageHistory.js';

describe('designerIaImageHistory', () => {
  it('expose des formats pour generate-visual-image', () => {
    expect(Array.isArray(DESIGNER_IA_IMAGE_SIZES)).toBe(true);
    expect(DESIGNER_IA_IMAGE_SIZES.length).toBeGreaterThan(0);
    expect(DESIGNER_IA_IMAGE_SIZES[0]).toHaveProperty('value');
    expect(DESIGNER_IA_IMAGE_SIZES[0]).toHaveProperty('label');
  });

  it('invokeGenerateVisualImage est une fonction (client Supabase)', () => {
    expect(typeof invokeGenerateVisualImage).toBe('function');
  });

  it('invokeStudioCoverPromptAssistant est une fonction (Edge studio-cover-prompt-assistant)', () => {
    expect(typeof invokeStudioCoverPromptAssistant).toBe('function');
  });
});
