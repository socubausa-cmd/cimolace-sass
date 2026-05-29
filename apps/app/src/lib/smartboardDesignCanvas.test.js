import { describe, expect, it } from 'vitest';
import {
  computeDesignCanvasScaleContain,
  computeSmartboardCanvasScale,
  computeSmartboardCanvasScaleCover,
  getSmartboardMobileReadabilitySummary,
  resolveArchitectDesignCanvasForApiRequest,
  resolveProgressiveSlideDesignSize,
  SMARTBOARD_DESIGN_HEIGHT,
  SMARTBOARD_DESIGN_WIDTH,
} from './smartboardDesignCanvas';

describe('smartboardDesignCanvas', () => {
  it('exports Architect dimensions', () => {
    expect(SMARTBOARD_DESIGN_WIDTH).toBe(1037);
    expect(SMARTBOARD_DESIGN_HEIGHT).toBe(750);
  });

  it('computeSmartboardCanvasScale uses contain', () => {
    expect(computeSmartboardCanvasScale(1037, 750)).toBe(1);
    expect(computeSmartboardCanvasScale(518.5, 375)).toBeCloseTo(0.5);
    expect(computeSmartboardCanvasScale(2000, 2000)).toBeGreaterThan(1);
  });

  it('computeSmartboardCanvasScaleCover fills viewport', () => {
    expect(computeSmartboardCanvasScaleCover(1037, 750)).toBe(1);
    expect(computeSmartboardCanvasScaleCover(2074, 750)).toBe(2);
    expect(computeSmartboardCanvasScaleCover(1037, 1500)).toBe(2);
    expect(computeSmartboardCanvasScaleCover(400, 400)).toBeGreaterThan(computeSmartboardCanvasScale(400, 400));
  });

  it('resolveProgressiveSlideDesignSize reads design_canvas then format', () => {
    expect(resolveProgressiveSlideDesignSize(null).width).toBe(1037);
    expect(
      resolveProgressiveSlideDesignSize({
        design_canvas: { width: 1200, height: 800 },
      }).height,
    ).toBe(800);
    expect(
      resolveProgressiveSlideDesignSize({
        format: { width: 900, height: 650 },
      }).width,
    ).toBe(900);
  });

  it('computeDesignCanvasScaleContain matches legacy when design is 1037×750', () => {
    expect(computeDesignCanvasScaleContain(518.5, 375, 1037, 750)).toBeCloseTo(0.5);
    expect(computeDesignCanvasScaleContain(400, 300, 2000, 1000)).toBeCloseTo(0.2);
  });

  it('resolveArchitectDesignCanvasForApiRequest falls back to viewport estimate when live unset', () => {
    const o = resolveArchitectDesignCanvasForApiRequest();
    expect(o && o.width >= 640 && o.height >= 480).toBe(true);
  });

  it('getSmartboardMobileReadabilitySummary scales 1037×750 into a vertical phone stage', () => {
    const r = getSmartboardMobileReadabilitySummary();
    expect(r.device).toBe('phone');
    expect(r.status).toBe('ok');
    expect(r.scaleContain).toBeCloseTo(Math.min(390 / 1037, (844 - 168) / 750), 4);
  });

  it('getSmartboardMobileReadabilitySummary has higher scale on tablet than on phone', () => {
    const phone = getSmartboardMobileReadabilitySummary();
    const tab = getSmartboardMobileReadabilitySummary({ tablet: true });
    expect(tab.device).toBe('tablet');
    expect(tab.scaleContain).toBeGreaterThan(phone.scaleContain);
  });
});
