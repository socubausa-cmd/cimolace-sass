import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { medosApi, tenantsApi, type CreateMedPatient } from '../lib/api';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function MedosPatients() {
  const queryClient = useQueryClient();
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: tenantsApi.current });
  const patients = useQuery({ queryKey: ['medos-patients'], queryFn: medosApi.listPatients });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateMedPatient>({
    patient_user_id: '',
    first_name: '',
    last_name: '',
  });
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');

  const createMutation = useMutation({
    mutationFn: medosApi.createPatient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medos-patients'] });
      setShowForm(false);
      setForm({ patient_user_id: '', first_name: '', last_name: '' });
      setFormError('');
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const filteredPatients = patients.data?.filter((patient) => {
    const value = `${patient.first_name} ${patient.last_name} ${patient.patient_user_id}`.toLowerCase();
    return value.includes(search.trim().toLowerCase());
  }) ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">{tenant.data?.name ?? 'Cimolace tenant'}</p>
          <h1 className="font-semibold text-gray-900">Patients MedOS</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/dashboard/medos" className="text-sm text-indigo-600 hover:underline">
            MedOS
          </Link>
          <Link to="/dashboard" className="text-sm text-gray-500 hover:underline">
            Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {patients.data ? `${patients.data.length} patient${patients.data.length > 1 ? 's' : ''}` : 'Patients'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">Phase 1A : dossiers patients, notes SOAP, signature et partage.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            {showForm ? 'Fermer' : 'Nouveau patient'}
          </button>
        </div>

        {patients.isError && <p className="text-red-600 text-sm mb-4">{patients.error.message}</p>}
        {formError && <p className="text-red-600 text-sm mb-4">{formError}</p>}

        {showForm && (
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-6">
            <h3 className="font-bold text-gray-900 mb-4">Créer un dossier patient</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.patient_user_id || !form.first_name || !form.last_name) {
                  setFormError('patient_user_id, first_name et last_name sont obligatoires');
                  return;
                }
                if (!UUID_RE.test(form.patient_user_id)) {
                  setFormError('patient_user_id doit être un UUID Supabase valide');
                  return;
                }
                createMutation.mutate(form);
              }}
              className="grid gap-4 md:grid-cols-2"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User ID (UUID)</label>
                <input
                  type="text"
                  value={form.patient_user_id}
                  onChange={(e) => setForm({ ...form, patient_user_id: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="00000000-0000-0000-0000-000000000000"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">ID utilisateur Supabase du patient.</p>
              </div>
              <div />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                <input
                  type="text"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de naissance</label>
                <input
                  type="date"
                  value={form.date_of_birth ?? ''}
                  onChange={(e) => setForm({ ...form, date_of_birth: e.target.value || undefined })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Genre</label>
                <select
                  value={form.gender ?? ''}
                  onChange={(e) => setForm({ ...form, gender: e.target.value || undefined })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">--</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Groupe sanguin</label>
                <input
                  type="text"
                  value={form.blood_type ?? ''}
                  onChange={(e) => setForm({ ...form, blood_type: e.target.value || undefined })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="ex: O+"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Consentement</label>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={form.consent_given ?? false}
                    onChange={(e) => setForm({ ...form, consent_given: e.target.checked })}
                    className="rounded"
                  />
                  Consentement donné
                </label>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Objet du consentement</label>
                <input
                  type="text"
                  value={form.consent_purpose ?? ''}
                  onChange={(e) => setForm({ ...form, consent_purpose: e.target.value || undefined })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex : suivi médical et partage des notes signées"
                />
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {createMutation.isPending ? 'Création...' : 'Créer le patient'}
                </button>
              </div>
            </form>
          </section>
        )}

        {patients.isLoading && <p className="text-gray-500 text-sm">Chargement des patients...</p>}

        {patients.data && patients.data.length > 0 && (
          <div className="mb-4">
            <label className="sr-only" htmlFor="patient-search">Rechercher un patient</label>
            <input
              id="patient-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Rechercher par nom ou ID utilisateur"
            />
          </div>
        )}

        {patients.data && patients.data.length === 0 && !showForm && (
          <section className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
            <h3 className="font-semibold text-gray-900">Aucun dossier patient</h3>
            <p className="mt-2 text-sm text-gray-500">
              Créez le premier dossier avec l'ID utilisateur Supabase du patient pour tester le parcours Phase 1A.
            </p>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              Créer un dossier patient
            </button>
          </section>
        )}

        {patients.data && patients.data.length > 0 && filteredPatients.length === 0 && (
          <p className="text-gray-500 text-sm">Aucun patient ne correspond à cette recherche.</p>
        )}

        {filteredPatients.length > 0 && (
          <div className="grid gap-3">
            {filteredPatients.map((p) => (
              <Link
                key={p.id}
                to={`/dashboard/medos/patients/${p.id}`}
                className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm hover:border-indigo-300 hover:shadow transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {p.first_name} {p.last_name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 break-words">
                      {p.date_of_birth ?? 'N/A'} · {p.gender ?? 'N/A'} · {p.blood_type ?? 'N/A'}
                    </p>
                    <p className="mt-1 font-mono text-xs text-gray-400 break-all">{p.patient_user_id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.status === 'active'
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : p.status === 'archived'
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {p.status}
                    </span>
                    <span className="text-gray-400">Ouvrir</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
