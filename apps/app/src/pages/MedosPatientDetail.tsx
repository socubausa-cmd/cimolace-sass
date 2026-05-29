import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { medosApi, tenantsApi, type CreateMedNote, type MedNote } from '../lib/api';

export function MedosPatientDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const tenant = useQuery({ queryKey: ['tenant'], queryFn: tenantsApi.current });
  const patient = useQuery({
    queryKey: ['medos-patient', id],
    queryFn: () => medosApi.getPatient(id!),
    enabled: !!id,
  });
  const notes = useQuery({
    queryKey: ['medos-notes', id],
    queryFn: () => medosApi.listNotes(id!),
    enabled: !!id,
  });

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteForm, setNoteForm] = useState<CreateMedNote>({});
  const [noteError, setNoteError] = useState('');
  const [actionError, setActionError] = useState('');
  const hasNoteContent = Object.values(noteForm).some((value) =>
    typeof value === 'string' ? value.trim().length > 0 : Array.isArray(value) ? value.length > 0 : Boolean(value),
  );

  const createNoteMutation = useMutation({
    mutationFn: (body: CreateMedNote) => medosApi.createNote(id!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medos-notes', id] });
      setShowNoteForm(false);
      setNoteForm({});
      setNoteError('');
    },
    onError: (err: Error) => setNoteError(err.message),
  });

  const signMutation = useMutation({
    mutationFn: medosApi.signNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medos-notes', id] });
      setActionError('');
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const shareMutation = useMutation({
    mutationFn: ({ noteId, shared }: { noteId: string; shared: boolean }) =>
      medosApi.shareNote(noteId, shared),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medos-notes', id] });
      setActionError('');
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const p = patient.data;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">{tenant.data?.name ?? 'Cimolace tenant'}</p>
          <h1 className="font-semibold text-gray-900">
            {p ? `${p.first_name} ${p.last_name}` : 'Patient'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/dashboard/medos/patients" className="text-sm text-indigo-600 hover:underline">
            Patients
          </Link>
          <Link to="/dashboard/medos" className="text-sm text-gray-500 hover:underline">
            MedOS
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {patient.isLoading && <p className="text-gray-500 text-sm">Chargement...</p>}
        {patient.isError && <p className="text-red-600 text-sm">{patient.error.message}</p>}

        {p && (
          <>
            {/* Patient Info */}
            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Dossier patient</h2>
              <div className="grid gap-4 md:grid-cols-3 text-sm">
                <div>
                  <span className="text-gray-500">ID</span>
                  <p className="text-gray-900 font-mono text-xs mt-0.5">{p.id}</p>
                </div>
                <div>
                  <span className="text-gray-500">Statut</span>
                  <p className="text-gray-900 mt-0.5">
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
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Date de naissance</span>
                  <p className="text-gray-900 mt-0.5">{p.date_of_birth ?? 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Genre</span>
                  <p className="text-gray-900 mt-0.5">{p.gender ?? 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Groupe sanguin</span>
                  <p className="text-gray-900 mt-0.5">{p.blood_type ?? 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Consentement</span>
                  <p className="text-gray-900 mt-0.5">
                    {p.consent_given ? 'Donné' : 'Non donné'}
                    {p.consent_date && <span className="text-xs text-gray-400 ml-1">({p.consent_date})</span>}
                  </p>
                </div>
              </div>
            </section>

            {/* Notes */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                Notes ({notes.data?.length ?? 0})
              </h2>
              <button
                type="button"
                onClick={() => setShowNoteForm(!showNoteForm)}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
              >
                {showNoteForm ? 'Fermer' : 'Nouvelle note'}
              </button>
            </div>

            {actionError && <p className="text-red-600 text-sm mb-4">{actionError}</p>}
            {noteError && <p className="text-red-600 text-sm mb-4">{noteError}</p>}

            {showNoteForm && (
              <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-6">
                <h3 className="font-bold text-gray-900 mb-4">Créer une note SOAP</h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!hasNoteContent) {
                      setNoteError('Ajoutez au moins une section SOAP ou une note libre');
                      return;
                    }
                    createNoteMutation.mutate(noteForm);
                  }}
                  className="grid gap-4"
                >
                  {(['subjective', 'objective', 'assessment', 'plan'] as const).map((field) => (
                    <div key={field}>
                      <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                        {field}
                      </label>
                      <textarea
                        value={noteForm[field] ?? ''}
                        onChange={(e) => setNoteForm({ ...noteForm, [field]: e.target.value || undefined })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        rows={2}
                        placeholder={`Section ${field}...`}
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Texte libre</label>
                    <textarea
                      value={noteForm.free_text ?? ''}
                      onChange={(e) => setNoteForm({ ...noteForm, free_text: e.target.value || undefined })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      rows={2}
                      placeholder="Notes additionnelles..."
                    />
                  </div>
                  <div>
                    <button
                      type="submit"
                      disabled={createNoteMutation.isPending || !hasNoteContent}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {createNoteMutation.isPending ? 'Création...' : 'Créer la note'}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {notes.isLoading && <p className="text-gray-500 text-sm">Chargement des notes...</p>}

            {notes.data && notes.data.length === 0 && !showNoteForm && (
              <section className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
                <h3 className="font-semibold text-gray-900">Aucune note clinique</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Créez une note SOAP, puis signez-la ou partagez-la avec le patient quand elle est prête.
                </p>
                <button
                  type="button"
                  onClick={() => setShowNoteForm(true)}
                  className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                  Créer une note
                </button>
              </section>
            )}

            {notes.data && notes.data.length > 0 && (
              <div className="grid gap-4">
                {notes.data.map((note: MedNote) => (
                  <div
                    key={note.id}
                    className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-400 font-mono">{note.id.slice(0, 8)}...</span>
                        {note.is_signed && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                            Signée
                          </span>
                        )}
                        {note.is_shared_with_patient && (
                          <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 border border-purple-200">
                            Partagée
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!note.is_signed && (
                          <button
                            type="button"
                            onClick={() => signMutation.mutate(note.id)}
                            disabled={signMutation.isPending}
                            className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                          >
                            {signMutation.isPending ? '...' : 'Signer'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            shareMutation.mutate({
                              noteId: note.id,
                              shared: !note.is_shared_with_patient,
                            })
                          }
                          disabled={shareMutation.isPending}
                          className={`rounded-lg px-3 py-1 text-xs font-medium border transition-colors disabled:opacity-50 ${
                            note.is_shared_with_patient
                              ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                              : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {shareMutation.isPending
                            ? '...'
                            : note.is_shared_with_patient
                              ? 'Dépublier'
                              : 'Partager'}
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm">
                      {note.subjective && (
                        <div>
                          <span className="font-medium text-gray-700">S (Subjective) :</span>{' '}
                          <span className="text-gray-600">{note.subjective}</span>
                        </div>
                      )}
                      {note.objective && (
                        <div>
                          <span className="font-medium text-gray-700">O (Objective) :</span>{' '}
                          <span className="text-gray-600">{note.objective}</span>
                        </div>
                      )}
                      {note.assessment && (
                        <div>
                          <span className="font-medium text-gray-700">A (Assessment) :</span>{' '}
                          <span className="text-gray-600">{note.assessment}</span>
                        </div>
                      )}
                      {note.plan && (
                        <div>
                          <span className="font-medium text-gray-700">P (Plan) :</span>{' '}
                          <span className="text-gray-600">{note.plan}</span>
                        </div>
                      )}
                      {note.free_text && (
                        <div>
                          <span className="font-medium text-gray-700">Note :</span>{' '}
                          <span className="text-gray-600">{note.free_text}</span>
                        </div>
                      )}
                    </div>

                    {note.signed_at && (
                      <p className="mt-3 text-xs text-gray-400">
                        Signée le {new Date(note.signed_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
