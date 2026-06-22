import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, RefreshCw, AlertTriangle } from 'lucide-react';
import { useSystemSettings } from '@/hooks/useAdmin';
import { useToast } from '@/components/ui/use-toast';
import TenantEmailSettings from '@/components/admin/TenantEmailSettings';

const SettingsPage = () => {
  const { toast } = useToast();
  const { settings, loading, error, refresh, save } = useSystemSettings();
  const [form, setForm] = useState(settings);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleSave = async () => {
    const payload = {
      site_name: String(form.site_name || '').trim(),
      contact_email: String(form.contact_email || '').trim(),
      session_expiration_minutes: Number(form.session_expiration_minutes || 60),
      force_2fa_admin: !!form.force_2fa_admin,
    };
    const { error: saveErr } = await save(payload);
    if (saveErr) {
      toast({ title: 'Erreur', description: saveErr.message || 'Sauvegarde impossible', variant: 'destructive' });
      return;
    }
    toast({ title: 'Succès', description: 'Paramètres enregistrés.' });
  };

  return (
    <div className="text-white">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-serif font-bold">Paramètres Système</h1>
          <div className="flex items-center gap-2">
            <Button onClick={refresh} variant="outline" className="border-white/10 text-white hover:bg-white/5 gap-2" disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
            </Button>
            <Button onClick={handleSave} className="bg-[var(--school-accent)] text-black hover:bg-[#b5952f] gap-2" disabled={loading}>
            <Save className="w-4 h-4" /> Sauvegarder
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-300 mt-0.5" />
            <p className="text-red-200 text-sm">
              {String(error?.message || error)}. Si la table `app_settings` n'existe pas encore, exécute la migration Supabase ajoutée.
            </p>
          </div>
        ) : null}

        <div className="space-y-8">
          <div className="premium-panel p-6">
            <h2 className="text-xl font-bold mb-4 text-[var(--school-accent)]">Général</h2>
            <div className="grid gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Nom du Site</label>
                <Input
                  value={form.site_name || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, site_name: e.target.value }))}
                  className="bg-[#0F1419] border-white/10"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Email de Contact</label>
                <Input
                  value={form.contact_email || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, contact_email: e.target.value }))}
                  className="bg-[#0F1419] border-white/10"
                />
              </div>
            </div>
          </div>

          <div className="premium-panel p-6">
            <h2 className="text-xl font-bold mb-4 text-[var(--school-accent)]">Sécurité</h2>
            <div className="grid gap-6">
               <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Expiration Session (minutes)</label>
                  <Input
                    type="number"
                    value={form.session_expiration_minutes ?? 60}
                    onChange={(e) => setForm((prev) => ({ ...prev, session_expiration_minutes: Number(e.target.value || 0) }))}
                    className="bg-[#0F1419] border-white/10"
                  />
               </div>
               <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="2fa"
                    className="w-4 h-4 rounded border-gray-300"
                    checked={!!form.force_2fa_admin}
                    onChange={(e) => setForm((prev) => ({ ...prev, force_2fa_admin: e.target.checked }))}
                  />
                  <label htmlFor="2fa" className="text-sm text-gray-300">Forcer l'authentification à deux facteurs pour les admins</label>
               </div>
            </div>
          </div>

          {/* Expéditeur email — configuration no-code Resend (slug résolu côté edge) */}
          <TenantEmailSettings />
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;