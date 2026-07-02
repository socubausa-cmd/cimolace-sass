/**
 * MobileMoneyModal — paiement Mobile Money (PawaPay, Afrique) d'un forfait.
 *
 * Brique PARTAGÉE (extraite du flux prouvé de CimolaceBillingDashboardPage) : pays →
 * opérateur → téléphone → `subscribe(provider='pawapay')` (facture en XAF) → `collect`
 * → push USSD → polling `syncMobileMoney` jusqu'à COMPLETED (compte PawaPay partagé, pas
 * de webhook). Réutilisée par la facturation Cimolace ET par le mur d'upgrade LIRI
 * (`LiriUpgradeWall`) — même flux de paiement, aucune divergence.
 *
 * Le rendu est déjà « chaud » (coral #d97757 / fond #1b1712) → s'intègre au portail LIRI
 * sans re-skin. Props : { plan:{key,label}, onClose, onPaid, onViewInvoices? }.
 */
import { useState, useEffect } from 'react';
import { billingApi } from '@/lib/api';
import { Smartphone, X, Check, AlertCircle, Loader2, FileText } from 'lucide-react';

// Pays Mobile Money (PawaPay) — Afrique. Indicatif utilisé pour préfixer le numéro E.164.
const MM_COUNTRIES = [
  { code: 'CMR', name: 'Cameroun', dial: '+237' },
  { code: 'CIV', name: "Côte d'Ivoire", dial: '+225' },
  { code: 'SEN', name: 'Sénégal', dial: '+221' },
  { code: 'GAB', name: 'Gabon', dial: '+241' },
  { code: 'BEN', name: 'Bénin', dial: '+229' },
  { code: 'TGO', name: 'Togo', dial: '+228' },
  { code: 'BFA', name: 'Burkina Faso', dial: '+226' },
  { code: 'COD', name: 'RD Congo', dial: '+243' },
  { code: 'GHA', name: 'Ghana', dial: '+233' },
];
// Opérateurs de secours (codes PawaPay standard) si l'active-conf ne renvoie rien.
const MM_FALLBACK_PROVIDERS = {
  CMR: [{ provider: 'MTN_MOMO_CMR', displayName: 'MTN MoMo' }, { provider: 'ORANGE_CMR', displayName: 'Orange Money' }],
  CIV: [{ provider: 'MTN_MOMO_CIV', displayName: 'MTN MoMo' }, { provider: 'ORANGE_CIV', displayName: 'Orange Money' }, { provider: 'MOOV_CIV', displayName: 'Moov Money' }, { provider: 'WAVE_CIV', displayName: 'Wave' }],
  SEN: [{ provider: 'ORANGE_SEN', displayName: 'Orange Money' }, { provider: 'FREE_SEN', displayName: 'Free Money' }, { provider: 'WAVE_SEN', displayName: 'Wave' }],
  GAB: [{ provider: 'AIRTEL_GAB', displayName: 'Airtel Money' }, { provider: 'MOOV_GAB', displayName: 'Moov Money' }],
  BEN: [{ provider: 'MTN_MOMO_BEN', displayName: 'MTN MoMo' }, { provider: 'MOOV_BEN', displayName: 'Moov Money' }],
  TGO: [{ provider: 'TOGOCOM_TGO', displayName: 'Togocom T-Money' }, { provider: 'MOOV_TGO', displayName: 'Moov Money' }],
  BFA: [{ provider: 'ORANGE_BFA', displayName: 'Orange Money' }, { provider: 'MOOV_BFA', displayName: 'Moov Money' }],
  COD: [{ provider: 'ORANGE_COD', displayName: 'Orange Money' }, { provider: 'AIRTEL_COD', displayName: 'Airtel Money' }, { provider: 'VODACOM_MPESA_COD', displayName: 'M-Pesa (Vodacom)' }],
  GHA: [{ provider: 'MTN_MOMO_GHA', displayName: 'MTN MoMo' }, { provider: 'VODAFONE_GHA', displayName: 'Telecel Cash' }, { provider: 'AIRTELTIGO_GHA', displayName: 'AirtelTigo' }],
};
const mmProviderCode = (p) => (typeof p === 'string' ? p : (p?.provider || p?.code || p?.correspondent || p?.id || ''));
const mmProviderName = (p) => (typeof p === 'string' ? p : (p?.name || p?.displayName || p?.label || mmProviderCode(p)));

export default function MobileMoneyModal({ plan, onClose, onPaid, onViewInvoices }) {
  const [country, setCountry] = useState('CMR');
  const [providers, setProviders] = useState([]);
  const [provider, setProvider] = useState('');
  const [dial, setDial] = useState('+237');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [payStatus, setPayStatus] = useState(null); // null | 'waiting' | 'activated' | 'failed'

  // Compte PawaPay partagé (pas de webhook cimolace) → on interroge nous-mêmes le
  // statut du dépôt après « Demande envoyée », jusqu'à activation (COMPLETED) ou échec.
  useEffect(() => {
    if (!result) return undefined;
    setPayStatus('waiting');
    let tries = 0;
    const id = setInterval(async () => {
      tries += 1;
      try {
        const s = await billingApi.syncMobileMoney();
        if (s?.activated) { setPayStatus('activated'); clearInterval(id); onPaid?.(); return; }
        if (s?.failed) { setPayStatus('failed'); clearInterval(id); return; }
      } catch { /* réseau : on retente au tick suivant */ }
      if (tries >= 45) clearInterval(id); // ~3 min max
    }, 4000);
    return () => clearInterval(id);
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    setProviders([]); setProvider('');
    setDial((MM_COUNTRIES.find((x) => x.code === country) || {}).dial || '+237');
    const applyList = (list) => {
      const arr = (Array.isArray(list) && list.length) ? list : (MM_FALLBACK_PROVIDERS[country] || []);
      setProviders(arr); setProvider(mmProviderCode(arr[0]) || '');
    };
    billingApi.pawapayProviders(country)
      .then((list) => { if (!cancelled) applyList(list); })
      .catch(() => { if (!cancelled) applyList([]); });
    return () => { cancelled = true; };
  }, [country]);

  const pay = async () => {
    setBusy(true); setError(null); setResult(null);
    try {
      const digits = phone.replace(/[^0-9]/g, '');
      const phoneNumber = phone.trim().startsWith('+') ? phone.replace(/\s/g, '') : `${dial}${digits.replace(/^0+/, '')}`;
      if (!provider) throw new Error('Choisis un opérateur mobile money.');
      if (digits.length < 6) throw new Error('Numéro de téléphone invalide.');
      const sub = await billingApi.subscribe(plan.key, 'pawapay');
      const r = await billingApi.collect(sub.subscription_id, { phoneNumber, provider, country });
      setResult({ ...r, phoneNumber });
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Échec de la collecte mobile money.');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-[#1b1712] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2"><Smartphone className="w-5 h-5 text-[#e6b878]" /><h3 className="font-bold text-white">Payer en Mobile Money</h3></div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/40 hover:bg-white/10 hover:text-white/70"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-white/50 mb-4">{plan?.label} — Orange Money · MTN MoMo · Moov… (Afrique).</p>
        {result ? (
          <div className="rounded-xl border border-[#e6b878]/30 bg-[#e6b878]/[0.08] p-4 text-sm text-white/80">
            {payStatus === 'activated' ? (
              <>
                <div className="flex items-center gap-2 font-semibold text-[#d97757] mb-1.5"><Check className="w-4 h-4" /> Paiement confirmé</div>
                <p>Ton abonnement <strong>{plan?.label}</strong> est désormais <strong>activé</strong>. Merci ! 🎉</p>
                {onViewInvoices && <button onClick={onViewInvoices} className="mt-3 w-full px-4 py-2 rounded-lg bg-[#d97757] text-white text-sm font-semibold hover:bg-[#c9673f] flex items-center justify-center gap-2"><FileText className="w-4 h-4" /> Voir ma facture / mon reçu</button>}
              </>
            ) : payStatus === 'failed' ? (
              <>
                <div className="flex items-center gap-2 font-semibold text-red-300 mb-1.5"><AlertCircle className="w-4 h-4" /> Paiement non abouti</div>
                <p>Le paiement a été refusé ou annulé sur le téléphone. Ferme cette fenêtre et réessaie.</p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 font-semibold text-[#e6b878] mb-1.5"><Check className="w-4 h-4" /> Demande envoyée</div>
                <p>📲 Une demande de <strong>{result.currency} {result.amount}</strong> a été poussée sur <strong>{result.phoneNumber}</strong>. Compose ton code Mobile Money sur ton téléphone pour valider.</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-white/60"><Loader2 className="w-3.5 h-3.5 animate-spin" /> En attente de ta validation sur le téléphone…</div>
              </>
            )}
            <button onClick={onClose} className="mt-3 w-full px-4 py-2 rounded-lg border border-white/[0.12] text-white/70 text-sm hover:bg-white/[0.06]">Fermer</button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="text-[11px] text-white/50">Pays</span>
              <select value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1 w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-white">
                {MM_COUNTRIES.map((c) => <option key={c.code} value={c.code} className="bg-[#1b1712]">{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] text-white/50">Opérateur</span>
              <select value={provider} onChange={(e) => setProvider(e.target.value)} disabled={!providers.length} className="mt-1 w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-white disabled:opacity-50">
                {!providers.length && <option value="" className="bg-[#1b1712]">— chargement… —</option>}
                {providers.map((p, i) => <option key={i} value={mmProviderCode(p)} className="bg-[#1b1712]">{mmProviderName(p)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] text-white/50">Numéro Mobile Money</span>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 py-2 text-sm text-white/60 shrink-0">{dial}</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="6XX XX XX XX" inputMode="tel" className="w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/30" />
              </div>
            </label>
            {error && <p className="text-xs text-red-300 flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{error}</p>}
            <button onClick={pay} disabled={busy} className="w-full mt-1 px-4 py-2.5 rounded-xl bg-[#d97757] text-white font-bold text-sm hover:bg-[#c9673f] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />} Envoyer le paiement
            </button>
            <p className="text-[10px] text-white/35 text-center">Tu recevras une demande de validation sur ton téléphone.</p>
          </div>
        )}
      </div>
    </div>
  );
}
