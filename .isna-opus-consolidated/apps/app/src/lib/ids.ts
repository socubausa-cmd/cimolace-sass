/**
 * Centralized ID generator for the LIRI system.
 */

let counter = 0;

/** Fast short ID (not UUID). Unique within a session. */
export function genId(prefix = 'id'): string {
  counter++;
  return `${prefix}-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Generates a UUID v4. */
export function genUUID(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
}

/** Generates a short 8-char hex ID (for collab rooms, sessions). */
export function genShortId(): string {
  return Math.random().toString(16).slice(2, 10);
}

/** Generates a slug-style ID from a label. */
export function slugId(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) + '-' + genShortId();
}
