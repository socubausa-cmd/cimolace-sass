import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { catalogApi, tenantsApi, type InfrastructureType } from '../lib/api';
import { INFRASTRUCTURES, formatServiceKey } from '../lib/infrastructures';

const PRODUCT_DETAILS: Record<
  InfrastructureType,
  {
    status: string;
    summary: string;
    primaryAction: string;
    primaryHref: string;
    nextSteps: string[];
    reference?: string;
  }
> = {
  school: {
    status: 'MVP utilisable',
    summary: 'Le module école utilise déjà le socle live payant : création live, checkout, access pass et LiveKit.',
    primaryAction: 'Voir les lives',
    primaryHref: '/dashboard/lives',
    nextSteps: [
      'Migrer les cours, élèves, replay et SmartBoard depuis la V1.',
      'Brancher Course Builder et LIRI après stabilisation du socle.',
      'Ajouter un dashboard école complet.',
    ],
    reference: 'docs/V1_TO_CIMOLACE_V2_MIGRATION_AUDIT.md',
  },
  medos: {
    status: 'Prototype à intégrer',
    summary: 'MedOS est identifié comme produit santé Cimolace, mais le backend complet doit être migré proprement après le catalogue.',
    primaryAction: 'Voir le plan MedOS',
    primaryHref: '/dashboard',
    nextSteps: [
      'Importer MedOS depuis isna_platform_v2 après validation RBAC/RLS.',
      'Créer dossiers patients, notes SOAP, prescriptions et audit trail.',
      'Aligner les pages marketing avec l’état réel du backend.',
    ],
    reference: 'docs/CIMOLACE_PLATFORM_AUDIT.md',
  },
  mbolo: {
    status: 'Blueprint ZahirWellness',
    summary: 'Mbolo/VirtuelMbolo doit devenir le moteur e-commerce Cimolace, construit à partir d’un clone audité de ZahirWellness.',
    primaryAction: 'Préparer la migration Mbolo',
    primaryHref: '/dashboard',
    nextSteps: [
      'Ne pas toucher au site ZahirWellness en ligne.',
      'Cloner/auditer le projet Zahir séparément.',
      'Extraire catalogue, panier, commandes, paiements et back-office en moteur multi-tenant.',
    ],
    reference: 'docs/ZAHIR_TO_MBOLO_MIGRATION_STRATEGY.md',
  },
  wellness: {
    status: 'Beta à cadrer',
    summary: 'Wellness réutilise les moteurs programmes, suivi santé, calendrier, chat et forum.',
    primaryAction: 'Retour au dashboard',
    primaryHref: '/dashboard',
    nextSteps: [
      'Définir les parcours coaching et programmes.',
      'Décider ce qui vient de MedOS et ce qui reste wellness.',
      'Ajouter les premiers écrans après MedOS/Mbolo.',
    ],
  },
  creator: {
    status: 'Beta à cadrer',
    summary: 'Creator regroupe studio, live, replay, paiement et marketing pour créateurs.',
    primaryAction: 'Retour au dashboard',
    primaryHref: '/dashboard',
    nextSteps: [
      'Migrer le studio et LIRI Live depuis la V1.',
      'Brancher replay et paiement après Pay Engine.',
      'Créer un dashboard studio minimal.',
    ],
  },
  temple: {
    status: 'Plus tard',
    summary: 'Temple est un vertical communauté/spiritualité basé sur live, calendrier, forum, paiement et chat.',
    primaryAction: 'Retour au dashboard',
    primaryHref: '/dashboard',
    nextSteps: [
      'Clarifier l’offre commerciale.',
      'Réutiliser forum/live/pay engine quand ils seront migrés.',
      'Ne pas prioriser avant School, Mbolo et MedOS.',
    ],
  },
  community: {
    status: 'Plus tard',
    summary: 'Communauté est un vertical forum/chat/événements avec paiement et notifications.',
    primaryAction: 'Retour au dashboard',
    primaryHref: '/dashboard',
    nextSteps: [
      'Migrer forum et messagerie depuis V1.',
      'Ajouter notifications et événements.',
      'Définir les rôles communautaires.',
    ],
  },
};

export function DashboardProduct({ type }: { type: InfrastructureType }) {
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: tenantsApi.current });
  const services = useQuery({ queryKey: ['tenant-services'], queryFn: catalogApi.tenantServices });
  const infra = INFRASTRUCTURES.find((item) => item.type === type);
  const details = PRODUCT_DETAILS[type];
  const activeServices = services.data?.filter((service) => service.active) ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">{tenant.data?.name ?? 'Cimolace tenant'}</p>
          <h1 className="font-semibold text-gray-900">{infra?.name ?? type}</h1>
        </div>
        <Link to="/dashboard" className="text-sm text-indigo-600 hover:underline">
          Vue générale
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gray-600">
                {details.status}
              </span>
              <h2 className="mt-4 text-3xl font-bold text-gray-900">{infra?.name ?? type}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">{details.summary}</p>
            </div>
            <Link
              to={details.primaryHref}
              className="inline-flex justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
            >
              {details.primaryAction}
            </Link>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="font-bold text-gray-900">Moteurs du template</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {(infra?.engines ?? []).map((engine) => (
                <span key={engine} className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                  {engine}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="font-bold text-gray-900">Moteurs actifs sur ce tenant</h3>
            {services.isLoading && <p className="mt-3 text-sm text-gray-500">Chargement...</p>}
            {!services.isLoading && activeServices.length === 0 && (
              <p className="mt-3 text-sm text-gray-500">Aucun moteur actif pour l'instant.</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {activeServices.map((service) => (
                <span key={service.service_key} className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700 border border-indigo-100">
                  {formatServiceKey(service.service_key)}
                </span>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="font-bold text-gray-900">Prochaines étapes</h3>
          <ul className="mt-4 space-y-2">
            {details.nextSteps.map((step) => (
              <li key={step} className="text-sm text-gray-600">
                {step}
              </li>
            ))}
          </ul>
          {details.reference && (
            <p className="mt-5 text-xs text-gray-400">
              Référence locale : <code>{details.reference}</code>
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
