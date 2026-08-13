import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import { cagnotteApi } from '@/lib/api-v2';
import { Clapperboard, Loader2, Plus, Trash2, Save, ArrowUp, ArrowDown, ExternalLink, Users, BadgeCheck, Lock } from 'lucide-react';

/**
 * LiriStudioCagnottePage — /liri/studio : administration de la campagne
 * « studio pédagogique » (financement participatif par équipement).
 * Catalogue (prix, image, description, ordre), achats réels (date, prix payé,
 * photo, preuve), contributions reçues, clôture. Chaque équipement = une
 * campagne cagnotte réelle : l'enregistrement met les objectifs à jour.
 */

const INPUT = 'rounded-lg border border-white/10 bg-[#262624] px-2.5 py-2 text-sm text-[#f5f4ee] outline-none focus:border-[#d97757] [color-scheme:dark]';
const BTN_ICON = 'grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-[#f5f4ee]/60 transition-colors hover:border-[#d97757]/40 hover:text-[#f5f4ee] disabled:opacity-30';
const eur = (cents) => `${Math.round((cents || 0) / 100).toLocaleString('fr-FR')} €`;

export default function LiriStudioCagnottePage() {
  return (
    <LiriPortalShell active="studio-cagnotte">
      <Corps />
    </LiriPortalShell>
  );
}

function Corps() {
  const [vue, setVue] = useState(null);       // studioAdmin() complet
  const [equipements, setEquipements] = useState([]);
  const [titre, setTitre] = useState('');
  const [intro, setIntro] = useState('');
  const [cloturee, setCloturee] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [voirContribs, setVoirContribs] = useState(null); // slug déplié

  const charger = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const v = await cagnotteApi.studioAdmin();
      setVue(v);
      setTitre(v.titre || ''); setIntro(v.intro || ''); setCloturee(v.cloturee === true);
      setEquipements((v.equipements || []).map((e) => ({ ...e, achete: e.achete || null })));
    } catch (e) { setErr(e?.response?.data?.error?.message || 'Chargement impossible.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const save = async () => {
    setSaving(true); setErr(''); setMsg('');
    try {
      const v = await cagnotteApi.studioAdminSave({
        titre, intro, cloturee,
        equipements: equipements.map((e, i) => ({ ...e, ordre: i + 1 })),
      });
      setVue(v);
      setEquipements((v.equipements || []).map((e) => ({ ...e, achete: e.achete || null })));
      setMsg('Enregistré ✓ La page publique /studio-pedagogique reflète immédiatement le catalogue.');
    } catch (e) { setErr(e?.response?.data?.error?.message || 'Enregistrement impossible.'); }
    finally { setSaving(false); }
  };

  const maj = (i, patch) => setEquipements((arr) => arr.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const majAchete = (i, patch) => setEquipements((arr) => arr.map((e, j) => (j === i ? { ...e, achete: { date: '', prixPayeEur: 0, photo: '', facture: '', installe: false, ...(e.achete || {}), ...patch } } : e)));
  const bouger = (i, d) => setEquipements((arr) => { const j = i + d; if (j < 0 || j >= arr.length) return arr; const c = [...arr]; [c[i], c[j]] = [c[j], c[i]]; return c; });
  const retirer = (i) => setEquipements((arr) => arr.filter((_, j) => j !== i));
  const ajouter = () => setEquipements((arr) => [...arr, { slug: '', label: '', prixEur: 100, desc: '', utilite: '', image: '', achete: null }]);

  const contribsPar = useMemo(() => {
    const m = new Map();
    for (const c of vue?.contributions || []) {
      if (!m.has(c.campaign_slug)) m.set(c.campaign_slug, []);
      m.get(c.campaign_slug).push(c);
    }
    return m;
  }, [vue]);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-xl font-extrabold text-[#f5f4ee]">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#d97757]/15 text-[#e8a184]"><Clapperboard className="h-5 w-5" /></span>
            Cagnotte du studio pédagogique
          </h1>
          <p className="mt-1.5 text-[13px] text-[#f5f4ee]/60">
            Page publique : <a href="/studio-pedagogique" target="_blank" rel="noreferrer" className="font-semibold text-[#e8a184] hover:underline">/studio-pedagogique <ExternalLink className="inline h-3 w-3" /></a> —
            objectif global calculé automatiquement : <strong className="text-[#f5f4ee]">{vue ? eur(vue.objectifCents) : '…'}</strong> · collecté : <strong className="text-[#e8a184]">{vue ? eur(vue.collecteCents) : '…'}</strong>
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
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />)}</div>
      ) : (
        <>
          <section className="mb-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="grid gap-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#f5f4ee]/45">Titre de la campagne</span>
                <input className={`${INPUT} w-full`} value={titre} maxLength={120} onChange={(e) => setTitre(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#f5f4ee]/45">Texte d'introduction</span>
                <textarea rows={2} className={`${INPUT} w-full resize-none`} value={intro} maxLength={800} onChange={(e) => setIntro(e.target.value)} />
              </label>
              <label className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#f5f4ee]/80">
                <input type="checkbox" checked={cloturee} onChange={(e) => setCloturee(e.target.checked)} className="h-4 w-4 accent-[#d97757]" />
                <Lock className="h-3.5 w-3.5" /> Clôturer la campagne (plus aucune contribution possible)
              </label>
            </div>
          </section>

          <div className="space-y-4">
            {equipements.map((e, i) => {
              const contribs = contribsPar.get(e.slug) || [];
              const confirmees = contribs.filter((c) => c.status === 'completed');
              return (
                <div key={e.slug || i} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    {e.image && <img src={e.image} alt="" className="h-16 w-24 shrink-0 rounded-lg bg-[#1d1b19] object-contain" />}
                    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[2fr_1fr]">
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#f5f4ee]/45">Nom</span>
                        <input className={`${INPUT} w-full`} value={e.label} maxLength={80} onChange={(ev) => maj(i, { label: ev.target.value })} />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#f5f4ee]/45">Prix estimatif (€)</span>
                        <input type="number" min="1" className={`${INPUT} w-full`} value={e.prixEur} onChange={(ev) => maj(i, { prixEur: Number(ev.target.value) })} />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#f5f4ee]/45">Image (URL — /studio/… ou https://)</span>
                        <input className={`${INPUT} w-full`} value={e.image} maxLength={300} onChange={(ev) => maj(i, { image: ev.target.value })} />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#f5f4ee]/45">Accroche</span>
                        <input className={`${INPUT} w-full`} value={e.desc} maxLength={300} onChange={(ev) => maj(i, { desc: ev.target.value })} />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#f5f4ee]/45">Utilité dans le studio</span>
                        <textarea rows={2} className={`${INPUT} w-full resize-none`} value={e.utilite} maxLength={700} onChange={(ev) => maj(i, { utilite: ev.target.value })} />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#f5f4ee]/45">Présentation longue (fiche portfolio — paragraphes séparés par une ligne vide)</span>
                        <textarea rows={4} className={`${INPUT} w-full resize-none`} value={e.presentation || ''} maxLength={2500} onChange={(ev) => maj(i, { presentation: ev.target.value })} />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#f5f4ee]/45">Galerie de la fiche (une image par ligne — /studio/… ou https://, 8 max)</span>
                        <textarea rows={2} className={`${INPUT} w-full resize-none`} value={(e.images || []).join('\n')} maxLength={2500}
                          onChange={(ev) => maj(i, { images: ev.target.value.split('\n').map((u) => u.trim()).filter(Boolean) })} />
                      </label>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => bouger(i, -1)} disabled={i === 0} className={BTN_ICON} title="Monter"><ArrowUp className="h-4 w-4" /></button>
                        <button type="button" onClick={() => bouger(i, 1)} disabled={i === equipements.length - 1} className={BTN_ICON} title="Descendre"><ArrowDown className="h-4 w-4" /></button>
                        <button type="button" onClick={() => retirer(i)} className={`${BTN_ICON} hover:border-red-400/40 hover:text-red-300`} title="Retirer"><Trash2 className="h-4 w-4" /></button>
                      </div>
                      {typeof e.collecteCents === 'number' && (
                        <p className="text-right text-[12px] text-[#f5f4ee]/55">{eur(e.collecteCents)} collectés · {e.pct ?? 0} %</p>
                      )}
                      <button type="button" onClick={() => setVoirContribs(voirContribs === e.slug ? null : e.slug)}
                        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#e8a184] hover:underline">
                        <Users className="h-3.5 w-3.5" /> {confirmees.length} contribution{confirmees.length > 1 ? 's' : ''}
                      </button>
                    </div>
                  </div>

                  {/* Achat réel — preuve pour les contributeurs */}
                  <details className="mt-3 rounded-xl border border-white/[0.06] bg-[#262624]/60 p-3" open={!!e.achete}>
                    <summary className="cursor-pointer text-[12.5px] font-semibold text-[#f5f4ee]/70"><BadgeCheck className="mr-1 inline h-3.5 w-3.5 text-[#a9d4b0]" /> Achat réel (visible des contributeurs)</summary>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="block"><span className="mb-1 block text-[11px] text-[#f5f4ee]/45">Date d'achat</span>
                        <input type="date" className={`${INPUT} w-full`} value={e.achete?.date || ''} onChange={(ev) => majAchete(i, { date: ev.target.value })} /></label>
                      <label className="block"><span className="mb-1 block text-[11px] text-[#f5f4ee]/45">Prix réellement payé (€)</span>
                        <input type="number" min="0" className={`${INPUT} w-full`} value={e.achete?.prixPayeEur || ''} onChange={(ev) => majAchete(i, { prixPayeEur: Number(ev.target.value) })} /></label>
                      <label className="block"><span className="mb-1 block text-[11px] text-[#f5f4ee]/45">Photo réelle (URL)</span>
                        <input className={`${INPUT} w-full`} value={e.achete?.photo || ''} onChange={(ev) => majAchete(i, { photo: ev.target.value })} /></label>
                      <label className="block"><span className="mb-1 block text-[11px] text-[#f5f4ee]/45">Facture / preuve (URL)</span>
                        <input className={`${INPUT} w-full`} value={e.achete?.facture || ''} onChange={(ev) => majAchete(i, { facture: ev.target.value })} /></label>
                      <label className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-[#f5f4ee]/75 sm:col-span-2">
                        <input type="checkbox" checked={e.achete?.installe === true} onChange={(ev) => majAchete(i, { installe: ev.target.checked })} className="h-4 w-4 accent-[#d97757]" />
                        Installé dans le studio
                      </label>
                    </div>
                  </details>

                  {voirContribs === e.slug && (
                    <div className="mt-3 overflow-x-auto rounded-xl border border-white/[0.06]">
                      <table className="w-full text-left text-[12.5px]">
                        <thead><tr className="border-b border-white/[0.06] text-[#f5f4ee]/50">
                          <th className="px-3 py-2 font-semibold">Contributeur</th><th className="px-3 py-2 font-semibold">Montant</th>
                          <th className="px-3 py-2 font-semibold">Moyen</th><th className="px-3 py-2 font-semibold">Statut</th><th className="px-3 py-2 font-semibold">Date</th>
                        </tr></thead>
                        <tbody>
                          {contribs.length === 0 && <tr><td colSpan={5} className="px-3 py-3 text-[#f5f4ee]/45">Aucune contribution pour l'instant.</td></tr>}
                          {contribs.map((c) => (
                            <tr key={c.id} className="border-b border-white/[0.04] text-[#f5f4ee]/80">
                              <td className="px-3 py-2">{c.donor_name || 'Anonyme'}{c.donor_email ? ` · ${c.donor_email}` : ''}</td>
                              <td className="px-3 py-2 font-bold">{c.display_currency && c.display_currency !== 'EUR' ? `${Number(c.display_amount).toLocaleString('fr-FR')} ${c.display_currency}` : eur(c.amount_cents)}</td>
                              <td className="px-3 py-2">{c.provider}</td>
                              <td className="px-3 py-2">{c.status === 'completed' ? '✓ confirmée' : c.status}</td>
                              <td className="px-3 py-2">{String(c.completed_at || c.created_at || '').slice(0, 10)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
            <button type="button" onClick={ajouter}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[13px] font-semibold text-[#f5f4ee]/75 transition-colors hover:border-[#d97757]/40 hover:text-[#f5f4ee]">
              <Plus className="h-4 w-4" /> Ajouter un équipement
            </button>
          </div>
        </>
      )}
    </div>
  );
}
