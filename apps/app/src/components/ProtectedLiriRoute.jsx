import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import ProtectedRoleRoute from '@/components/ProtectedRoleRoute';
import { useBilling } from '@/contexts/BillingContext';
import { useAuth } from '@/hooks/useAuth';
import { catalogApi } from '@/lib/api-v2';
import { authStore } from '@/lib/auth-store';
import LiriUpgradeWall from '@/components/liri/LiriUpgradeWall';

// Rôles « staff » — font tourner l'école, exemptés du forfait par-membre.
const STAFF_ROLES = ['owner', 'admin', 'teacher', 'secretariat', 'practitioner', 'clinic_admin'];

// Cache module-level du résultat « ce tenant a-t-il LIRI ? » (par slug). Sans lui, le garde
// refait getTenantServices à CHAQUE navigation gardée → spinner plein écran à chaque clic
// (Forum→Messages→Temple…). Avec le cache, il résout instantanément dès la 2e page.
const _svcCache = new Map(); // slug -> { hasLiri, errored }

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
  <div className="flex h-screen w-full items-center justify-center bg-[#262624]">
    <Loader2 className="h-8 w-8 animate-spin text-[#d97757]" />
  </div>
);

function LiriAccessGate({ children }) {
  const { loading: billingLoading, status, inGrace } = useBilling();
  const { user, tenantRole } = useAuth();
  const location = useLocation();
  const slug = authStore.getTenantSlug?.() || '';
  const cached = _svcCache.get(slug);
  const [svc, setSvc] = useState(cached ? { loading: false, ...cached } : { loading: true, hasLiri: false, errored: false });

  useEffect(() => {
    const hit = _svcCache.get(slug);
    if (hit) { setSvc({ loading: false, ...hit }); return; } // cache → aucun spinner à la 2e navigation
    let alive = true;
    catalogApi
      .getTenantServices()
      .then((rows) => {
        const hasLiri = (Array.isArray(rows) ? rows : []).some(
          (s) => s?.active && LIRI_SERVICE_KEYS.has(String(s?.service_key)),
        );
        _svcCache.set(slug, { hasLiri, errored: false });
        if (alive) setSvc({ loading: false, hasLiri, errored: false });
      })
      .catch(() => {
        // Incertitude technique → fail-open (ne pas enfermer le client).
        _svcCache.set(slug, { hasLiri: false, errored: true });
        if (alive) setSvc({ loading: false, hasLiri: false, errored: true });
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  if (billingLoading || svc.loading) return <Loader />;

  // ── NIVEAU 1 — le TENANT a-t-il LIRI ? (vente SaaS Cimolace) ─────────────────
  // fail-open sur incertitude technique (ne jamais enfermer sur une erreur réseau).
  const tenantHasLiri = svc.errored || svc.hasLiri;

  // ── NIVEAU 2 — le MEMBRE a-t-il un forfait actif ? (vente du tenant à ses élèves) ──
  // GATE DUR (décision fondateur) : l'espace /liri est réservé — sans forfait actif,
  // l'élève ne voit PAS le tableau de bord. EXEMPTÉS : le staff (fait tourner l'école)
  // et les pages de souscription/compte (sinon impossible de payer pour entrer).
  // `status` vient de /billing/subscriptions/status = l'abo DU MEMBRE (filtré user_id),
  // donc le grandfathering TENANT ne fait plus passer un élève sans forfait.
  const role = String(user?.role || '').toLowerCase();
  const tRole = String(user?.tenant_role || '').toLowerCase();
  // `tenantRole` = rôle décodé du JWT (fiable, présent tôt) → un owner/staff n'est jamais
  // renvoyé vers le mur d'upgrade quand `user.role`/`user.tenant_role` tardent à se résoudre.
  const jwtRole = String(tenantRole || '').toLowerCase();
  const isStaff = STAFF_ROLES.includes(role) || STAFF_ROLES.includes(tRole) || STAFF_ROLES.includes(jwtRole);
  const path = String(location?.pathname || '');
  const isBillingPath = path.startsWith('/liri/forfaits') || path.startsWith('/liri/compte');
  const subOk = status === 'active' || (status === 'past_due' && inGrace);
  const memberOk = isStaff || isBillingPath || subOk;

  if (tenantHasLiri && memberOk) return children;
  // Pas d'accès → mur d'upgrade rendu EN PLACE, DANS le realm LIRI (audit cloison 3-realms,
  // racine ② : ne JAMAIS renvoyer vers /cimolace/billing). La facturation — grille des forfaits
  // + carte Stripe + Mobile Money PawaPay — se fait ici même, sur le host neutre.
  return <LiriUpgradeWall />;
}

export default function ProtectedLiriRoute({ children, allowedRoles = [], allowTenantRole = false }) {
  return (
    <ProtectedRoleRoute allowedRoles={allowedRoles} allowTenantRole={allowTenantRole}>
      <LiriAccessGate>{children}</LiriAccessGate>
    </ProtectedRoleRoute>
  );
}
