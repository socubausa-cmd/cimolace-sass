import { describe, expect, it } from 'vitest';
import { buildCommand } from './commandBridge.js';

const mapper = { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 };

describe('buildCommand', () => {
  it('builds click', () => {
    const cmd = buildCommand(
      { eventType: 'click', x: 10, y: 20, timestampMs: 1 },
      mapper,
    );
    expect(cmd).toEqual({
      commandType: 'click',
      targetCoordinates: { x: 10, y: 20 },
      timestampMs: 1,
    });
  });

  it('builds scroll with deltaY', () => {
    const cmd = buildCommand(
      { eventType: 'scroll', x: 5, y: 5, deltaY: -120, timestampMs: 2 },
      mapper,
    );
    expect(cmd?.commandType).toBe('scroll');
    expect(cmd?.deltaY).toBe(-120);
  });
});
