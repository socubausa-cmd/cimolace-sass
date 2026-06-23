/**
 * TenantEmailSettings
 *
 * Configuration NO-CODE de l'expéditeur email de l'école (multi-tenant).
 * TOUTES les opérations passent par l'edge function `resend-domain`, qui résout
 * le tenant par SLUG (signal fiable, public) + vérifie owner/admin côté serveur.
 * Le composant n'a PAS besoin du tenant_id ni d'accès direct à Supabase.
 *
 * Style aligné sur le design system LIRI (fond sombre + accent or `--school-accent`).
 *
 * Usage: <TenantEmailSettings /> (le slug est résolu via useResolvedTenantSlug).
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, Save, Check, AlertCircle, Mail, ShieldCheck, RefreshCw, Globe } from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';
import { useResolvedTenantSlug } from '@/hooks/useResolvedTenantSlug';

const INPUT =
  'w-full rounded-lg border border-white/10 bg-[#0F1419] px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-[var(--school-accent,#D4AF37)] focus:outline-none disabled:opacity-50';

export default function TenantEmailSettings() {
  const { slug, loading: slugLoading } = useResolvedTenantSlug();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(''); // '' | 'configure' | 'verify'
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [verified, setVerified] = useState(false);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState({ email_from_name: '', email_domain: '', app_base_url: '', resendApiKey: '' });

  const call = useCallback(
    async (payload) => {
      const { data, error: err } = await supabase.functions.invoke('resend-domain', {
        body: { ...payload, slug },
      });
      if (err) throw err;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    [slug],
  );

  const load = useCallback(async () => {
    if (slugLoading) return;
    if (!slug) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await call({ action: 'get' });
      setForm((f) => ({
        ...f,
        email_from_name: data.emailFromName || '',
        email_domain: data.emailDomain || '',
        app_base_url: data.appBaseUrl || '',
      }));
      setVerified(data.emailVerified === true);
      setError('');
    } catch (err) {
      setError(err?.message || '');
    } finally {
      setLoading(false);
    }
  }, [slug, slugLoading, call]);

  useEffect(() => {
    load();
  }, [load]);

  const saveBasics = async () => {
    setError(''); setNotice(''); setSaving(true);
    try {
      await call({ action: 'save', emailFromName: form.email_from_name, appBaseUrl: form.app_base_url });
      setNotice('Réglages enregistrés.');
      setTimeout(() => setNotice(''), 2500);
    } catch (err) {
      setError(err?.message || "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const configureDomain = async () => {
    setError(''); setNotice(''); setRecords([]);
    const dom = form.email_domain.trim();
    if (!dom) { setError("Renseigne le domaine d'envoi (ex : prorascience.org)."); return; }
    setBusy('configure');
    try {
      await call({ action: 'save', emailFromName: form.email_from_name, appBaseUrl: form.app_base_url });
      const data = await call({ action: 'add', domain: dom, resendApiKey: form.resendApiKey.trim() || undefined });
      setRecords(data.records || []);
      setVerified(data.status === 'verified');
      setForm((f) => ({ ...f, resendApiKey: '' }));
      setNotice('Domaine ajouté. Ajoute les DNS ci-dessous chez ton registrar, puis clique « Vérifier ».');
    } catch (err) {
      setError(err?.message || 'Échec de la configuration du domaine.');
    } finally {
      setBusy('');
    }
  };

  const verifyDomain = async () => {
    setError(''); setNotice(''); setBusy('verify');
    try {
      const data = await call({ action: 'verify' });
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
  const blocked = saving || !!busy || loading;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="mb-1 flex items-center gap-2">
        <Mail className="h-5 w-5 text-[var(--school-accent,#D4AF37)]" />
        <h2 className="text-base font-bold text-white">Expéditeur email de l'école</h2>
        {verified ? (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" /> Domaine vérifié
          </span>
        ) : (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
            <AlertCircle className="h-3.5 w-3.5" /> Non vérifié
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-gray-400">
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
              <label className="mb-1 block text-sm font-medium text-gray-300">Nom d'expéditeur</label>
              <input
                type="text"
                value={form.email_from_name}
                onChange={(e) => setForm((f) => ({ ...f, email_from_name: e.target.value }))}
                placeholder="ISNA Prorascience"
                className={INPUT}
                disabled={blocked}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Domaine d'envoi</label>
              <input
                type="text"
                value={form.email_domain}
                onChange={(e) => setForm((f) => ({ ...f, email_domain: e.target.value }))}
                placeholder="prorascience.org"
                className={INPUT}
                disabled={blocked}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              URL du portail (liens des emails)
            </label>
            <div className="relative">
              <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type="url"
                value={form.app_base_url}
                onChange={(e) => setForm((f) => ({ ...f, app_base_url: e.target.value }))}
                placeholder="https://prorascience.org"
                className={`${INPUT} pl-9`}
                disabled={blocked}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              Clé Resend de l'école <span className="font-normal text-gray-500">(optionnel)</span>
            </label>
            <input
              type="password"
              value={form.resendApiKey}
              onChange={(e) => setForm((f) => ({ ...f, resendApiKey: e.target.value }))}
              placeholder="re_…  (laisser vide = compte Cimolace central)"
              className={INPUT}
              autoComplete="off"
              disabled={blocked}
            />
            <p className="mt-1 text-xs text-gray-500">
              Pour utiliser le propre compte Resend de l'école (domaine custom), colle sa clé API.
              Vide = envoi via le compte central Cimolace.
            </p>
          </div>

          <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-gray-400">
            Les emails partiront de :{' '}
            <span className="font-mono text-[var(--school-accent,#D4AF37)]">{fromPreview}</span>
          </div>

          {error ? (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          ) : null}
          {notice ? (
            <div className="flex items-center gap-2 text-sm text-emerald-300">
              <Check className="h-4 w-4 shrink-0" /> {notice}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={saveBasics}
              disabled={blocked}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </button>
            <button
              type="button"
              onClick={configureDomain}
              disabled={blocked}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--school-accent,#D4AF37)] px-4 py-2 text-sm font-bold text-black hover:brightness-110 disabled:opacity-50"
            >
              {busy === 'configure' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              Configurer le domaine
            </button>
            <button
              type="button"
              onClick={verifyDomain}
              disabled={blocked}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--school-accent,#D4AF37)]/40 px-4 py-2 text-sm font-semibold text-[var(--school-accent,#D4AF37)] hover:bg-[var(--school-accent,#D4AF37)]/10 disabled:opacity-50"
            >
              {busy === 'verify' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Vérifier
            </button>
          </div>

          {records.length > 0 ? (
            <div className="mt-2 overflow-hidden rounded-lg border border-white/10">
              <div className="border-b border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white">
                Enregistrements DNS à ajouter chez ton registrar
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-white/5 text-left text-gray-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Nom / Host</th>
                      <th className="px-3 py-2 font-medium">Valeur</th>
                      <th className="px-3 py-2 font-medium">Priorité</th>
                      <th className="px-3 py-2 font-medium">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {records.map((r, i) => (
                      <tr key={i} className="align-top">
                        <td className="px-3 py-2 font-mono">{r.type}</td>
                        <td className="px-3 py-2 font-mono break-all">{r.name}</td>
                        <td className="px-3 py-2 font-mono break-all text-gray-400">{r.value}</td>
                        <td className="px-3 py-2 font-mono">{r.priority ?? '—'}</td>
                        <td className="px-3 py-2">
                          {r.status === 'verified' ? (
                            <span className="text-emerald-400">✓ vérifié</span>
                          ) : (
                            <span className="text-amber-400">en attente</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-4 py-2 text-xs text-gray-500">
                Copie ces enregistrements chez ton fournisseur de domaine (Vercel, Cloudflare…), puis
                clique « Vérifier ». La propagation DNS peut prendre quelques minutes.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
