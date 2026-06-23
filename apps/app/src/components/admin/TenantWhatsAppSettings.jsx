/**
 * TenantWhatsAppSettings
 *
 * Numéro WhatsApp de l'école (la « chaîne ») notifié à chaque live programmé.
 * Édition NO-CODE, sans redéploiement.
 *
 * Comme TenantEmailSettings : tout passe par l'edge function `tenant-whatsapp`
 * qui résout le tenant par SLUG (fiable, public) + vérifie owner/admin côté
 * serveur. Le composant n'a PAS besoin du tenant_id. Style aligné sur le design
 * system LIRI (fond sombre + accent or `--school-accent`).
 *
 * Usage: <TenantWhatsAppSettings /> (slug résolu via useResolvedTenantSlug).
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, Save, Check, AlertCircle, MessageCircle } from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';
import { useResolvedTenantSlug } from '@/hooks/useResolvedTenantSlug';

const INPUT =
  'w-full rounded-lg border border-white/10 bg-[#0F1419] px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-[var(--school-accent,#D4AF37)] focus:outline-none disabled:opacity-50';
const E164 = /^\+[1-9]\d{6,14}$/;

export default function TenantWhatsAppSettings() {
  const { slug, loading: slugLoading } = useResolvedTenantSlug();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ whatsapp_school_number: '', whatsapp_channel_enabled: false });

  const call = useCallback(
    async (payload) => {
      const { data, error: err } = await supabase.functions.invoke('tenant-whatsapp', {
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
      setForm({
        whatsapp_school_number: data.whatsappNumber || '',
        whatsapp_channel_enabled: data.channelEnabled === true,
      });
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

  const save = async () => {
    setError('');
    setSaved(false);
    const num = form.whatsapp_school_number.trim();
    if (num && !E164.test(num)) {
      setError('Numéro invalide. Format international E.164 attendu, ex : +24166863336.');
      return;
    }
    setSaving(true);
    try {
      await call({
        action: 'save',
        whatsappNumber: num,
        channelEnabled: form.whatsapp_channel_enabled,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err?.message || "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const blocked = saving || loading;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="mb-1 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-[var(--school-accent,#D4AF37)]" />
        <h2 className="text-base font-bold text-white">Chaîne WhatsApp de l'école</h2>
      </div>
      <p className="mb-4 text-sm text-gray-400">
        Numéro WhatsApp de l'école notifié à chaque live programmé. Modifiable ici à tout moment,
        sans redéploiement.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              Numéro WhatsApp (format international)
            </label>
            <input
              type="tel"
              value={form.whatsapp_school_number}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp_school_number: e.target.value }))}
              placeholder="+24166863336"
              className={INPUT}
              disabled={blocked}
            />
            <p className="mt-1 text-xs text-gray-500">
              Format E.164 (indicatif pays + numéro, sans espaces). Ex : +24166863336.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={form.whatsapp_channel_enabled}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp_channel_enabled: e.target.checked }))}
              className="h-5 w-5 accent-[var(--school-accent,#D4AF37)]"
              disabled={blocked}
            />
            Notifier ce numéro à chaque live programmé
          </label>

          {error ? (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={blocked}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--school-accent,#D4AF37)] px-4 py-2 text-sm font-bold text-black hover:brightness-110 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </button>
            {saved ? (
              <span className="inline-flex items-center gap-1 text-sm text-emerald-300">
                <Check className="h-4 w-4" /> Enregistré
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
