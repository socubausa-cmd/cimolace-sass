export function resolveVitrineContactEmailSync() {
  const raw = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_VITRINE_CONTACT_EMAIL : undefined;
  const fromEnv = typeof raw === 'string' ? raw.trim() : '';
  return fromEnv || '';
}
