/**
 * TenantEmailSettings
 *
 * Configuration NO-CODE de l'expéditeur email de l'école (multi-tenant).
 * L'owner/admin renseigne le nom d'expéditeur, le domaine d'envoi et l'URL du
 * portail ; il peut ajouter son domaine dans Resend, copier les DNS, puis
 * vérifier — sans coder ni redéployer.
 *
 * Compte d'envoi : « central Cimolace » par défaut, ou « son propre compte
 * Resend » (BYO / domaine custom) en collant une clé (jamais réaffichée).
 * Les opérations Resend passent par l'edge function `resend-domain` (la clé
 * n'est jamais exposée au front).
 *
 * Usage: <TenantEmailSettings tenantId={tenant.id} />
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, Save, Check, AlertCircle, Mail, ShieldCheck, RefreshCw, Globe } from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';

const INPUT =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400';

export default function TenantEmailSettings({ tenantId }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(''); // '' | 'configure' | 'verify'
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [verified, setVerified] = useState(false);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState({
    email_from_name: '',
    email_domain: '',
    app_base_url: '',
    resendApiKey: '',
  });

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('tenant_notification_settings')
        .select('email_from_name, email_domain, app_base_url, email_verified')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (data) {
        setForm((f) => ({
          ...f,
          email_from_name: data.email_from_name || '',
          email_domain: data.email_domain || '',
          app_base_url: data.app_base_url || '',
        }));
        setVerified(data.email_verified === true);
      }
    } catch (err) {
      console.error('[TenantEmailSettings] load', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const upsertBasics = () =>
    supabase.from('tenant_notification_settings').upsert(
      {
        tenant_id: tenantId,
        email_from_name: form.email_from_name.trim() || null,
        app_base_url: form.app_base_url.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id' },
    );

  const saveBasics = async () => {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const { error: err } = await upsertBasics();
      if (err) throw err;
      setNotice('Réglages enregistrés.');
      setTimeout(() => setNotice(''), 2500);
    } catch (err) {
      setError(err?.message || "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const configureDomain = async () => {
    setError('');
    setNotice('');
    setRecords([]);
    const dom = form.email_domain.trim();
    if (!dom) {
      setError("Renseigne le domaine d'envoi (ex : prorascience.org).");
      return;
    }
    setBusy('configure');
    try {
      await upsertBasics();
      const { data, error: err } = await supabase.functions.invoke('resend-domain', {
        body: {
          action: 'add',
          tenantId,
          domain: dom,
          resendApiKey: form.resendApiKey.trim() || undefined,
        },
      });
      if (err) throw err;
      if (data?.error) {
        setError(data.error);
        return;
      }
      setRecords(data.records || []);
      setVerified(data.status === 'verified');
      setForm((f) => ({ ...f, resendApiKey: '' })); // ne pas conserver la clé en mémoire
      setNotice('Domaine ajouté. Ajoute les DNS ci-dessous chez ton registrar, puis clique « Vérifier ».');
    } catch (err) {
      setError(err?.message || 'Échec de la configuration du domaine.');
    } finally {
      setBusy('');
    }
  };

  const verifyDomain = async () => {
    setError('');
    setNotice('');
    setBusy('verify');
    try {
      const { data, error: err } = await supabase.functions.invoke('resend-domain', {
        body: { action: 'verify', tenantId },
      });
      if (err) throw err;
      if (data?.error) {
        setError(data.error);
        return;
      }
      setRecords(data.records || []);
      setVerified(data.verified === true);
      setNotice(
        data.verified
          ? 'Domaine vérifié ✅ — les emails de cette école partiront de son domaine.'
          : `Statut : ${data.status || 'en attente'}. Les DNS ne sont pas encore propagés — réessaie dans quelques minutes.`,
      );
    } catch (err) {
      setError(err?.message || 'Échec de la vérification.');
    } finally {
      setBusy('');
    }
  };

  const fromPreview = form.email_domain.trim()
    ? `${form.email_from_name.trim() ? `${form.email_from_name.trim()} ` : ''}<noreply@${form.email_domain.trim()}>`
    : '—';

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <div className="mb-1 flex items-center gap-2">
          <Mail className="h-5 w-5 text-indigo-600" />
          <h2 className="text-xl font-semibold">Expéditeur email de l'école</h2>
          {verified ? (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" /> Domaine vérifié
            </span>
          ) : (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              <AlertCircle className="h-3.5 w-3.5" /> Non vérifié
            </span>
          )}
        </div>
        <p className="mb-4 text-sm text-gray-600">
          D'où partent les emails de l'école (rappels et invitations live). Configurable ici, sans
          redéploiement.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Nom d'expéditeur</label>
                <input
                  type="text"
                  value={form.email_from_name}
                  onChange={(e) => setForm((f) => ({ ...f, email_from_name: e.target.value }))}
                  placeholder="ISNA Prorascience"
                  className={INPUT}
                  disabled={saving || !!busy}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Domaine d'envoi</label>
                <input
                  type="text"
                  value={form.email_domain}
                  onChange={(e) => setForm((f) => ({ ...f, email_domain: e.target.value }))}
                  placeholder="prorascience.org"
                  className={INPUT}
                  disabled={saving || !!busy}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                URL du portail (liens des emails)
              </label>
              <div className="relative">
                <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="url"
                  value={form.app_base_url}
                  onChange={(e) => setForm((f) => ({ ...f, app_base_url: e.target.value }))}
                  placeholder="https://prorascience.org"
                  className={`${INPUT} pl-9`}
                  disabled={saving || !!busy}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Clé Resend de l'école <span className="font-normal text-gray-400">(optionnel)</span>
              </label>
              <input
                type="password"
                value={form.resendApiKey}
                onChange={(e) => setForm((f) => ({ ...f, resendApiKey: e.target.value }))}
                placeholder="re_…  (laisser vide = compte Cimolace central)"
                className={INPUT}
                autoComplete="off"
                disabled={saving || !!busy}
              />
              <p className="mt-1 text-xs text-gray-400">
                Pour utiliser le propre compte Resend de l'école (domaine custom), colle sa clé API.
                Vide = envoi via le compte central Cimolace.
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
              Les emails partiront de : <span className="font-mono text-gray-800">{fromPreview}</span>
            </div>

            {error ? (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            ) : null}
            {notice ? (
              <div className="flex items-center gap-2 text-sm text-indigo-700">
                <Check className="h-4 w-4 shrink-0" /> {notice}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={saveBasics}
                disabled={saving || !!busy}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </button>
              <button
                type="button"
                onClick={configureDomain}
                disabled={saving || !!busy}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {busy === 'configure' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                Configurer le domaine
              </button>
              <button
                type="button"
                onClick={verifyDomain}
                disabled={saving || !!busy}
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
              >
                {busy === 'verify' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Vérifier
              </button>
            </div>

            {records.length > 0 ? (
              <div className="mt-2 rounded-lg border border-gray-200">
                <div className="border-b border-gray-100 px-4 py-2 text-sm font-semibold text-gray-700">
                  Enregistrements DNS à ajouter chez ton registrar
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-left text-gray-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 font-medium">Nom / Host</th>
                        <th className="px-3 py-2 font-medium">Valeur</th>
                        <th className="px-3 py-2 font-medium">Priorité</th>
                        <th className="px-3 py-2 font-medium">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {records.map((r, i) => (
                        <tr key={i} className="align-top">
                          <td className="px-3 py-2 font-mono">{r.type}</td>
                          <td className="px-3 py-2 font-mono break-all">{r.name}</td>
                          <td className="px-3 py-2 font-mono break-all">{r.value}</td>
                          <td className="px-3 py-2 font-mono">{r.priority ?? '—'}</td>
                          <td className="px-3 py-2">
                            {r.status === 'verified' ? (
                              <span className="text-emerald-600">✓</span>
                            ) : (
                              <span className="text-amber-600">en attente</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="px-4 py-2 text-xs text-gray-400">
                  Copie ces enregistrements chez ton fournisseur de domaine (Vercel, Cloudflare…), puis
                  clique « Vérifier ». La propagation DNS peut prendre quelques minutes.
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
