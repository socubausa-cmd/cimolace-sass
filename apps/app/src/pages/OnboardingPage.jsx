/**
 * Ancien onboarding (sélecteur d'infrastructures) — désormais hébergé sur Cimolace.
 * Cette page existe uniquement pour rétro-compatibilité des liens existants et
 * redirige vers cimolace.space/onboarding (ou localhost:3000/onboarding en dev).
 *
 * Pourquoi le changement :
 * - L'onboarding choisit QUELLE infrastructure créer (LIRI Studio, École, MedOS…)
 * - C'est une décision au niveau Cimolace (company host), pas tenant
 * - Donc la page doit s'afficher avec le branding Cimolace, pas le branding tenant
 */
import { useEffect } from 'react';

const CIMOLACE_URL =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3000/onboarding'
    : 'https://cimolace.space/onboarding';

export default function OnboardingPage() {
  useEffect(() => {
    // Préserve la query string (ex: ?infra=liri)
    const search = typeof window !== 'undefined' ? window.location.search : '';
    window.location.replace(`${CIMOLACE_URL}${search}`);
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0d1117',
        color: '#8b949e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
      }}
    >
      Redirection vers Cimolace…
    </div>
  );
}
