import React, { useCallback, useEffect, useState } from 'react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import { bookingApi } from '@/lib/api-v2';
import { Globe, Loader2, Plus, Trash2, Save, ArrowUp, ArrowDown, Eye, EyeOff, ExternalLink } from 'lucide-react';

/**
 * LiriVitrinePage — /liri/vitrine : les LIENS DE NAVIGATION de la vitrine
 * prorascience.org (menu « Services »), gérés no-code par le fondateur.
 * Stockage : tenants.metadata.vitrine_nav via bookingApi.updateSettings
 * (même moteur que les réglages agenda). La vitrine lit la version PUBLIQUE
 * (GET /booking-public/:slug/vitrine-nav) et retombe sur ses défauts si vide.
 */

const INPUT = 'rounded-lg border border-white/10 bg-[#262624] px-2.5 py-2 text-sm text-[#f5f4ee] outline-none focus:border-[#d97757]';
const BTN_ICON = 'grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-[#f5f4ee]/60 transition-colors hover:border-[#d97757]/40 hover:text-[#f5f4ee] disabled:opacity-30 disabled:hover:border-white/10';

// Proposés en un clic quand la liste est vide — les mêmes que les défauts de la vitrine.
const MODELES = [
  { label: 'Consultation', href: '/reserver', desc: 'Avec le Manikongo — 50 € · 30 min', visible: true },
  { label: 'Cagnotte & projets', href: '/cagnotte', desc: 'Soutenir les projets du temple', visible: true },
  { label: 'La Revue', href: '/femme-nouvelle', desc: 'La Femme Nouvelle', visible: true },
];

export default function LiriVitrinePage() {
  return (
    <LiriPortalShell active="vitrine">
      <VitrineBody />
    </LiriPortalShell>
  );
}

function VitrineBody() {
  const [liens, setLiens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const s = await bookingApi.getSettings();
      setLiens(Array.isArray(s?.vitrineNav) ? s.vitrineNav : []);
    } catch (e) { setErr(e?.response?.data?.error?.message || 'Impossible de charger les liens.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true); setErr(''); setMsg('');
    try {
      const s = await bookingApi.updateSettings({ vitrineNav: liens });
      setLiens(Array.isArray(s?.vitrineNav) ? s.vitrineNav : []);
      setMsg('Liens enregistrés ✓ La vitrine les affiche immédiatement dans le menu « Services ».');
    } catch (e) { setErr(e?.response?.data?.error?.message || 'Enregistrement impossible.'); }
    finally { setSaving(false); }
  };

  const maj = (i, patch) => setLiens((arr) => arr.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const bouger = (i, delta) => setLiens((arr) => {
    const j = i + delta; if (j < 0 || j >= arr.length) return arr;
    const copie = [...arr]; [copie[i], copie[j]] = [copie[j], copie[i]]; return copie;
  });
  const retirer = (i) => setLiens((arr) => arr.filter((_, j) => j !== i));
  const ajouter = () => setLiens((arr) => [...arr, { label: '', href: '/', desc: '', visible: true }]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-xl font-extrabold text-[#f5f4ee]">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#d97757]/15 text-[#e8a184]"><Globe className="h-5 w-5" /></span>
            Vitrine — menu « Services »
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#f5f4ee]/60">
            Ces liens apparaissent dans la navigation de <a className="font-semibold text-[#e8a184] hover:underline" href="https://prorascience.org" target="_blank" rel="noreferrer">prorascience.org <ExternalLink className="inline h-3 w-3" /></a> (menu déroulant « Services », bureau et mobile).
            Masquer un lien le retire du site sans le supprimer ici.
          </p>
        </div>
        <button type="button" disabled={saving || loading} onClick={save}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#d97757] px-4 py-2.5 text-[13.5px] font-bold text-[#1c1a18] transition-all hover:bg-[#e08b6d] disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
        </button>
      </div>

      {err && <p role="alert" className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{err}</p>}
      {msg && <p className="mb-4 rounded-lg border border-[#7fb98a]/30 bg-[#7fb98a]/10 px-3 py-2 text-[13px] text-[#a9d4b0]" aria-live="polite">{msg}</p>}

      {loading ? (
        <div className="space-y-3" aria-label="Chargement des liens">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />)}
        </div>
      ) : liens.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-center">
          <p className="text-[14px] font-semibold text-[#f5f4ee]/80">La vitrine affiche pour l'instant ses trois liens par défaut.</p>
          <p className="mx-auto mt-1 max-w-[52ch] text-[12.5px] leading-relaxed text-[#f5f4ee]/50">
            Consultation, Cagnotte &amp; projets, La Revue. Chargez-les ici pour les modifier, les réordonner ou en ajouter d'autres.
          </p>
          <button type="button" onClick={() => setLiens(MODELES)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#d97757] px-4 py-2.5 text-[13.5px] font-bold text-[#1c1a18] transition-all hover:bg-[#e08b6d]">
            <Plus className="h-4 w-4" /> Charger les trois liens et personnaliser
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {liens.map((l, i) => (
            <div key={i} className={`rounded-2xl border p-4 transition-colors ${l.visible === false ? 'border-white/[0.06] bg-white/[0.01] opacity-70' : 'border-white/[0.08] bg-white/[0.02]'}`}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_1fr]">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#f5f4ee]/45">Libellé</span>
                    <input className={`${INPUT} w-full`} value={l.label} maxLength={40} placeholder="Ex : Consultation"
                      onChange={(e) => maj(i, { label: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#f5f4ee]/45">Lien</span>
                    <input className={`${INPUT} w-full`} value={l.href} maxLength={200} placeholder="/reserver ou https://…"
                      onChange={(e) => maj(i, { href: e.target.value })} />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#f5f4ee]/45">Description (facultative — affichée sous le libellé)</span>
                    <input className={`${INPUT} w-full`} value={l.desc || ''} maxLength={80} placeholder="Ex : Avec le Manikongo — 50 € · 30 min"
                      onChange={(e) => maj(i, { desc: e.target.value })} />
                  </label>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 pt-5">
                  <button type="button" onClick={() => maj(i, { visible: l.visible === false })} className={BTN_ICON}
                    title={l.visible === false ? 'Masqué sur la vitrine — cliquer pour afficher' : 'Visible sur la vitrine — cliquer pour masquer'}>
                    {l.visible === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button type="button" onClick={() => bouger(i, -1)} disabled={i === 0} className={BTN_ICON} title="Monter"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" onClick={() => bouger(i, 1)} disabled={i === liens.length - 1} className={BTN_ICON} title="Descendre"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" onClick={() => retirer(i)} className={`${BTN_ICON} hover:border-red-400/40 hover:text-red-300`} title="Retirer"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
          <button type="button" onClick={ajouter}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[13px] font-semibold text-[#f5f4ee]/75 transition-colors hover:border-[#d97757]/40 hover:text-[#f5f4ee]">
            <Plus className="h-4 w-4" /> Ajouter un lien
          </button>
        </div>
      )}
    </div>
  );
}
