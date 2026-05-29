/**
 * Événements UI → commandes native_input_command (LIRI_FULL_SYSTEM).
 */

import { mapPoint } from './mapper.js';

/** @typedef {import('./mapper.js').MapperState} MapperState */

/**
 * @typedef {(
 *   | { eventType: 'click'; x: number; y: number; timestampMs: number }
 *   | { eventType: 'double_click'; x: number; y: number; timestampMs: number }
 *   | { eventType: 'scroll'; x: number; y: number; deltaY: number; timestampMs: number }
 *   | { eventType: 'text_input'; text: string; timestampMs: number }
 *   | { eventType: 'key_down'; key: string; timestampMs: number }
 *   | { eventType: 'drag'; startX: number; startY: number; endX: number; endY: number; timestampMs: number }
 * )} InputEventPayload
 */

/**
 * @param {InputEventPayload} evt
 * @param {MapperState} mapper
 * @returns {Record<string, unknown> | null}
 */
export function buildCommand(evt, mapper) {
  if (evt.eventType === 'click') {
    return {
      commandType: 'click',
      targetCoordinates: mapPoint(evt.x, evt.y, mapper),
      timestampMs: evt.timestampMs,
    };
  }
  if (evt.eventType === 'double_click') {
    return {
      commandType: 'double_click',
      targetCoordinates: mapPoint(evt.x, evt.y, mapper),
      timestampMs: evt.timestampMs,
    };
  }
  if (evt.eventType === 'scroll') {
    return {
      commandType: 'scroll',
      targetCoordinates: mapPoint(evt.x, evt.y, mapper),
      deltaY: evt.deltaY,
      timestampMs: evt.timestampMs,
    };
  }
  if (evt.eventType === 'text_input') {
    return { commandType: 'type_text', text: evt.text, timestampMs: evt.timestampMs };
  }
  if (evt.eventType === 'key_down') {
    return { commandType: 'press_key', key: evt.key, timestampMs: evt.timestampMs };
  }
  if (evt.eventType === 'drag') {
    return {
      commandType: 'drag_to',
      start: mapPoint(evt.startX, evt.startY, mapper),
      end: mapPoint(evt.endX, evt.endY, mapper),
      timestampMs: evt.timestampMs,
    };
  }
  return null;
}
