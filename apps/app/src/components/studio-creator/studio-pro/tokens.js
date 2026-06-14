/**
 * Rétro-compat : les tokens de design vivent désormais dans un module NEUTRE
 * partagé (@/styles/proTokens) pour que LIRI puisse les utiliser sans dépendre
 * de studio-creator. Ce shim conserve les imports internes de studio-pro.
 */
export * from '@/styles/proTokens';
