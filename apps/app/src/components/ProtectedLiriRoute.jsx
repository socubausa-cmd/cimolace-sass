import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import ProtectedRoleRoute from '@/components/ProtectedRoleRoute';
import { useBilling } from '@/contexts/BillingContext';
import { catalogApi } from '@/lib/api-v2';
import LiriUpgradeWall from '@/components/liri/LiriUpgradeWall';

/**
 * Gate « produit LIRI » : l'accès au portail créateur LIRI (/liri, /studio/*) est
 * réservé aux tenants qui ONT LIRI — c.-à-d. un abonnement actif OU au moins un
 * moteur LIRI activé dans tenant_services (le provisioning au paiement les active).
 *
 * Modèle (décision 2026-06-14) : gate DUR derrière le paiement. ISNA et les
 * payeurs existants sont « grandfathered » PAR LA DONNÉE (migration
 * 20260614140000 : abo comp + backfill tenant_services), donc AUCUN tenant en dur
 * ici. Un nouveau compte gratuit (signup → plan free, sans abo ni moteur) est
 * redirigé vers le portail de souscription tant qu'il n'a pas payé.
 *
 * FAIL-OPEN : si la résolution des services échoue (réseau/erreur), on n'bloque
 * PAS (on n'enferme jamais un client sur une incertitude technique). On ne bloque
 * que lorsqu'on a déterminé avec certitude : aucun abo actif ET aucun moteur LIRI.
 *
 * NB téléconsult MEDOS : la salle hôte est `/studio/live-arena/:sessionId`, une
 * route SÉPARÉE (matchée avant `/studio/*`) qui garde son propre garde → ce gate
 * ne la touche pas.
 */

// Moteurs qui matérialisent « ce tenant a LIRI » (cf. ENGINE_CATALOG / PLAN_SERVICE_MAP).
const LIRI_SERVICE_KEYS = new Set([
  'liri_live',
  'liri_replay',
  'studio_creator',
  'liri_brain',
  'liri_masterclass',
  'liri_smartboard',
  'liri_neuro_recall',
  'course_builder',
]);

const Loader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-[#0F1419]">
    <Loader2 className="h-8 w-8 animate-spin text-[var(--school-accent)]" />
  </div>
);

function LiriAccessGate({ children }) {
  const { loading: billingLoading, status, inGrace } = useBilling();
  const [svc, setSvc] = useState({ loading: true, hasLiri: false, errored: false });

  useEffect(() => {
    let alive = true;
    catalogApi
      .getTenantServices()
      .then((rows) => {
        if (!alive) return;
        const hasLiri = (Array.isArray(rows) ? rows : []).some(
          (s) => s?.active && LIRI_SERVICE_KEYS.has(String(s?.service_key)),
        );
        setSvc({ loading: false, hasLiri, errored: false });
      })
      .catch(() => {
        // Incertitude technique → fail-open (ne pas enfermer le client).
        if (alive) setSvc({ loading: false, hasLiri: false, errored: true });
      });
    return () => {
      alive = false;
    };
  }, []);

  if (billingLoading || svc.loading) return <Loader />;

  const subOk = status === 'active' || (status === 'past_due' && inGrace);
  // Bloque UNIQUEMENT si on est certain : pas d'erreur, pas de moteur LIRI, pas d'abo.
  const allow = svc.errored || svc.hasLiri || subOk;

  if (allow) return children;
  // Pas de forfait LIRI → mur d'upgrade rendu EN PLACE, DANS le realm LIRI (audit cloison
  // 3-realms, racine ② : ne JAMAIS renvoyer vers /cimolace/billing). La facturation — grille
  // des forfaits + carte Stripe + Mobile Money PawaPay — se fait ici même, sur le host neutre.
  return <LiriUpgradeWall />;
}

export default function ProtectedLiriRoute({ children, allowedRoles = [], allowTenantRole = false }) {
  return (
    <ProtectedRoleRoute allowedRoles={allowedRoles} allowTenantRole={allowTenantRole}>
      <LiriAccessGate>{children}</LiriAccessGate>
    </ProtectedRoleRoute>
  );
}
