import { corsHeaders } from './cors.ts';

/**
 * Bootstrap owner : désactivé par défaut (évite abus de l’API admin Auth).
 * Mettre ALLOW_OWNER_SETUP_FUNCTIONS=true le temps d’initialiser le compte, puis retirer.
 */
export function assertOwnerSetupAllowed(): Response | null {
  // @ts-ignore Deno
  const allowed = String(Deno.env.get('ALLOW_OWNER_SETUP_FUNCTIONS') || '').toLowerCase();
  if (allowed === 'true' || allowed === '1') return null;
  return new Response(
    JSON.stringify({
      success: false,
      error:
        'Fonction désactivée. Définir ALLOW_OWNER_SETUP_FUNCTIONS=true (bootstrap uniquement), puis retirer.',
    }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}
