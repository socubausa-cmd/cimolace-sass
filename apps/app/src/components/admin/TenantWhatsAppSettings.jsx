/**
 * TenantWhatsAppSettings
 *
 * Section « Chaîne WhatsApp de l'école » pour TenantAdminSettingsPage.
 * Permet à un owner/admin de définir le NUMÉRO WhatsApp de l'école (la « chaîne »)
 * qui reçoit une notification à chaque live programmé — SANS redéployer ni coder.
 *
 * Le numéro n'est pas un secret : il vit dans tenant_notification_settings (RLS
 * owner/admin). Les identifiants Twilio restent côté serveur (env du worker).
 *
 * Usage: <TenantWhatsAppSettings tenantId={tenant.id} />
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, Save, Check, AlertCircle, MessageCircle } from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';

const INPUT =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400';
const E164 = /^\+[1-9]\d{6,14}$/;

export default function TenantWhatsAppSettings({ tenantId }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ whatsapp_school_number: '', whatsapp_channel_enabled: false });

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('tenant_notification_settings')
        .select('whatsapp_school_number, whatsapp_channel_enabled')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (data) {
        setForm({
          whatsapp_school_number: data.whatsapp_school_number || '',
          whatsapp_channel_enabled: data.whatsapp_channel_enabled ?? false,
        });
      }
    } catch (err) {
      console.error('[TenantWhatsAppSettings] load', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

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
      const { error: err } = await supabase.from('tenant_notification_settings').upsert(
        {
          tenant_id: tenantId,
          whatsapp_school_number: num || null,
          whatsapp_channel_enabled: form.whatsapp_channel_enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' },
      );
      if (err) throw err;
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err?.message || 'Échec de l’enregistrement.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <div className="mb-1 flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-emerald-600" />
          <h2 className="text-xl font-semibold">Chaîne WhatsApp de l’école</h2>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          Numéro WhatsApp de l’école notifié à chaque live programmé. Modifiable ici à tout
          moment, sans redéploiement.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Numéro WhatsApp (format international)
              </label>
              <input
                type="tel"
                value={form.whatsapp_school_number}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp_school_number: e.target.value }))}
                placeholder="+24166863336"
                className={INPUT}
                disabled={saving}
              />
              <p className="mt-1 text-xs text-gray-400">
                Format E.164 (indicatif pays + numéro, sans espaces). Ex : +24166863336.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.whatsapp_channel_enabled}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp_channel_enabled: e.target.checked }))}
                className="h-5 w-5"
                disabled={saving}
              />
              Notifier ce numéro à chaque live programmé
            </label>

            {error ? (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </button>
              {saved ? (
                <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
                  <Check className="h-4 w-4" /> Enregistré
                </span>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
