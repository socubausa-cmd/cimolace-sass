/**
 * CIMOLACE AUTH CONTEXT
 * Alias vers SupabaseAuthContext pour compatibilité avec le router CIMOLACE
 */

export { AuthProvider as CimolaceAuthProvider, useAuth as useCimolaceAuth } from './SupabaseAuthContext';
export { default } from './SupabaseAuthContext';
