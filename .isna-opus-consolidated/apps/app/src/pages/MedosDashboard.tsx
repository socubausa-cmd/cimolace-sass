import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { catalogApi, medosApi, tenantsApi } from '../lib/api';
import { formatServiceKey } from '../lib/infrastructures';

export function MedosDashboard() {
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: tenantsApi.current });
  const services = useQuery({ queryKey: ['tenant-services'], queryFn: catalogApi.tenantServices });

  const activeServices = services.data?.filter((s) => s.active) ?? [];
  const medosEngines = activeServices.filter((s) =>
    s.service_key.startsWith('medos_') || s.service_key.includes('med_'),
  );
  const queryError = tenant.error ?? services.error;
  const authError = queryError instanceof Error && /unauthorized|401|non authentifié/i.test(queryError.message);
  const hasMedos = tenant.data?.infrastructure_type === 'medos' || medosEngines.length > 0;
  const patients = useQuery({
    queryKey: ['medos-patients'],
    queryFn: medosApi.listPatients,
    enabled: hasMedos,
  });
  const activePatients = patients.data?.filter((patient) => patient.status === 'active').length ?? 0;
  const consentedPatients = patients.data?.filter((patient) => patient.consent_given).length ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">{tenant.data?.name ?? 'Cimolace tenant'}</p>
          <h1 className="font-semibold text-gray-900">MedOS</h1>
        </div>
        <Link to="/dashboard" className="text-sm text-indigo-600 hover:underline">
          Dashboard
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {tenant.isError && !authError && <p className="text-red-600 text-sm mb-4">{tenant.error.message}</p>}
        {patients.isError && <p className="text-red-600 text-sm mb-4">{patients.error.message}</p>}

        {authError && (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-6 mb-6">
            <h2 className="text-lg font-bold text-amber-950">Session MedOS requise</h2>
            <p className="text-sm text-amber-800 mt-2">
              Connectez un access token Supabase et un tenant slug pour charger les dossiers patients et activer MedOS
              sur le tenant de démonstration.
            </p>
            <Link
              to="/dashboard/infrastructure"
              className="mt-4 inline-flex rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 transition-colors"
            >
              Configurer la session
            </Link>
          </section>
        )}

        {!authError && !hasMedos && (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-6 mb-6">
            <h2 className="text-lg font-bold text-amber-950">MedOS non activé</h2>
            <p className="text-sm text-amber-800 mt-2">
              Ce tenant n'a pas encore le moteur MedOS activé. Activez l'infrastructure MedOS pour accéder aux
              dossiers patients et notes cliniques.
            </p>
            <Link
              to="/dashboard/infrastructure"
              className="mt-4 inline-flex rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 transition-colors"
            >
              Activer MedOS
            </Link>
          </section>
        )}

        {!authError && hasMedos && (
          <>
            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 border border-green-200">
                      Phase 1A active
                    </span>
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      Livrable MVP praticien
                    </span>
                  </div>
                  <h2 className="mt-4 text-2xl font-bold text-gray-900">Dossiers patients et notes cliniques</h2>
                  <p className="mt-2 max-w-2xl text-sm text-gray-600">
                    Gérez les dossiers patients, les notes SOAP, signez et partagez les consultations.
                    L'audit médical est actif et obligatoire.
                  </p>
                </div>
                <Link
                  to="/dashboard/medos/patients"
                  className="inline-flex justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
                >
                  Voir les patients
                </Link>
              </div>
            </section>

            <section className="mb-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">Patients</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {patients.isLoading ? '...' : patients.data?.length ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">Dossiers actifs</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {patients.isLoading ? '...' : activePatients}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">Consentements</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {patients.isLoading ? '...' : consentedPatients}
                </p>
              </div>
            </section>

            <div className="grid gap-6 md:grid-cols-2">
              <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="font-bold text-gray-900">Moteurs MedOS actifs</h3>
                {medosEngines.length === 0 && (
                  <p className="mt-3 text-sm text-gray-500">
                    Socle MedOS actif pour les dossiers patients, notes cliniques et audit médical.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {medosEngines.map((svc) => (
                    <span
                      key={svc.service_key}
                      className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700 border border-indigo-100"
                    >
                      {formatServiceKey(svc.service_key)}
                    </span>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="font-bold text-gray-900">Sécurité & Audit</h3>
                <ul className="mt-4 space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <span className="text-green-600 font-bold">OK</span> Audit médical obligatoire
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600 font-bold">OK</span> RBAC par rôle
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600 font-bold">OK</span> Isolation tenant par tenant_id
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600 font-bold">OK</span> Protection double signature
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600 font-bold">OK</span> Route patient dédiée
                  </li>
                </ul>
              </section>
            </div>

            <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="font-bold text-gray-900">Phase 1B à venir</h3>
              <p className="mt-2 text-sm text-gray-600">
                Formulaires médicaux, suivi santé (health tracking), prescriptions, PDF, IA charting et portail
                patient complet seront intégrés progressivement après validation du socle actuel.
              </p>
            </section>

            <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="font-bold text-gray-900">Accès rapides</h3>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  to="/dashboard/medos/patients"
                  className="rounded-lg bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 border border-indigo-100 hover:bg-indigo-100 transition-colors"
                >
                  Patients
                </Link>
                <Link
                  to="/dashboard/infrastructure"
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Gérer l'infrastructure
                </Link>
                <Link
                  to="/dashboard/medos/me"
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Espace patient
                </Link>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
