import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { medosApi, type MedForm } from '../lib/api';

type Field = { id: string; label: string; type: string; required?: boolean; options?: string[] };

const asFields = (form: MedForm): Field[] =>
  (Array.isArray(form.fields) ? form.fields : []).map((x: Record<string, unknown>) => ({
    id: String(x.id ?? ''),
    label: String(x.label ?? x.id ?? ''),
    type: String(x.type ?? 'text'),
    required: Boolean(x.required),
    options: Array.isArray(x.options) ? (x.options as unknown[]).map(String) : undefined,
  }));

const CATEGORY_LABEL: Record<string, string> = {
  intake: 'Anamnèse', assessment: 'Bilan', consent: 'Consentement', followup: 'Suivi', custom: 'Formulaire',
};

export function PatientFormsView() {
  const forms = useQuery({ queryKey: ['medos-my-forms'], queryFn: medosApi.listMyForms });
  const [active, setActive] = useState<MedForm | null>(null);

  if (active) return <FormFill form={active} onBack={() => setActive(null)} />;

  return (
    <section>
      <div className="mb-5">
        <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Actif</span>
        <h2 className="mt-3 text-2xl font-bold text-gray-900">Formulaires à compléter</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Remplissez les questionnaires demandés par votre praticien (bilan, anamnèse, consentement…).
        </p>
      </div>

      {forms.isLoading && <p className="text-sm text-gray-500">Chargement des formulaires…</p>}
      {forms.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {forms.error instanceof Error ? forms.error.message : 'Impossible de charger les formulaires.'}
        </div>
      )}
      {forms.data && forms.data.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <h3 className="font-semibold text-gray-900">Aucun formulaire</h3>
          <p className="mt-2 text-sm text-gray-500">Votre praticien n'a pas encore mis de formulaire à votre disposition.</p>
        </div>
      )}

      {forms.data && forms.data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {forms.data.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setActive(f)}
              className="rounded-lg border border-gray-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  {CATEGORY_LABEL[f.category] ?? 'Formulaire'}
                </span>
                <span className="text-xs text-gray-400">{asFields(f).length} question(s)</span>
              </div>
              <h3 className="mt-3 font-semibold text-gray-900">{f.title}</h3>
              {f.description && <p className="mt-1 text-sm leading-6 text-gray-600">{f.description}</p>}
              <span className="mt-3 inline-block text-sm font-medium text-indigo-600">Remplir →</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function FormFill({ form, onBack }: { form: MedForm; onBack: () => void }) {
  const fields = asFields(form);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const submit = useMutation({
    mutationFn: () => medosApi.submitMyFormResponse(form.id, answers),
  });

  const set = (id: string, value: unknown) => setAnswers((a) => ({ ...a, [id]: value }));

  const onSubmit = () => {
    const missing = fields.find((f) => f.required && !answers[f.id]);
    if (missing) { setError(`« ${missing.label} » est obligatoire.`); return; }
    setError(null);
    submit.mutate();
  };

  if (submit.isSuccess) {
    return (
      <section className="rounded-lg border border-green-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl">✓</div>
        <h2 className="mt-4 text-xl font-bold text-gray-900">Merci !</h2>
        <p className="mt-2 text-sm text-gray-600">Votre réponse a bien été transmise à votre praticien.</p>
        <button type="button" onClick={onBack} className="mt-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
          Retour aux formulaires
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <button type="button" onClick={onBack} className="mb-4 text-sm text-indigo-600 hover:underline">← Formulaires</button>
      <h2 className="text-2xl font-bold text-gray-900">{form.title}</h2>
      {form.description && <p className="mt-1 text-sm leading-6 text-gray-600">{form.description}</p>}

      <div className="mt-6 grid gap-5">
        {fields.map((f) => (
          <div key={f.id}>
            <label className="mb-1.5 block text-sm font-semibold text-gray-800">
              {f.label}{f.required && <span className="ml-0.5 text-red-500">*</span>}
            </label>
            <FieldInput field={f} value={answers[f.id]} onChange={(v) => set(f.id, v)} />
          </div>
        ))}
      </div>

      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {submit.isError && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {submit.error instanceof Error ? submit.error.message : "Échec de l'envoi."}
        </p>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={submit.isPending}
        className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
      >
        {submit.isPending ? 'Envoi…' : 'Envoyer mes réponses'}
      </button>
    </section>
  );
}

function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }) {
  const cls = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200';
  switch (field.type) {
    case 'textarea':
      return <textarea className={cls} rows={3} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
      return <input type="number" className={cls} value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value)} />;
    case 'date':
      return <input type="date" className={cls} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
    case 'select':
      return (
        <select className={cls} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          <option value="">— Choisir —</option>
          {(field.options ?? []).map((o, i) => <option key={i} value={o}>{o}</option>)}
        </select>
      );
    case 'checkbox':
      return (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          J'accepte / Je confirme
        </label>
      );
    default:
      return <input type="text" className={cls} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
  }
}
