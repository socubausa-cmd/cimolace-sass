import React, { useEffect, useState } from 'react';
import { Stethoscope, Box, HeartPulse, FlaskConical, FileText, Check, ShoppingBag, Loader2, AlertCircle, User2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { medosApi } from '@/lib/api';
import { getStorefront } from '@/features/medos-cockpit/cockpit-api';

// Éléments cliniques préparables/partageables au patient pendant le live santé.
const SHARE_ITEMS = [
  { key: 'twin_3d', label: 'Jumeau 3D', desc: 'Corps 3D éducatif à présenter', icon: Box },
  { key: 'wheel', label: 'Roue de transformation', desc: 'Axes de progression du patient', icon: HeartPulse },
  { key: 'labs', label: 'Bilans & résultats', desc: 'Derniers marqueurs biologiques', icon: FlaskConical },
  { key: 'soap', label: 'Note SOAP', desc: 'Synthèse clinique (privée par défaut)', icon: FileText },
];

function fmtPrice(p, currency) {
  if (p == null) return '';
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR' }).format(p);
  } catch {
    return `${p} ${currency || ''}`.trim();
  }
}

const patientName = (p) =>
  [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim() || 'Patient sans nom';

/**
 * Étape « Dossier MEDOS » — visible uniquement en Live santé (medos_mode). On y
 * rattache le patient, on choisit les éléments cliniques à préparer (cockpit) et
 * on pré-sélectionne les produits de la boutique du tenant à présenter au patient.
 */
export function Step7MedosDossier({ draft, updateDraft }) {
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [patientsError, setPatientsError] = useState(null);
  const [shop, setShop] = useState({ products: [], brand: {} });
  const [shopLoading, setShopLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setPatientsLoading(true);
    medosApi
      .listPatients()
      .then((list) => {
        if (!alive) return;
        setPatients(Array.isArray(list) ? list : []);
        setPatientsError(null);
      })
      .catch((e) => {
        if (alive) setPatientsError(e?.message || 'Chargement des patients impossible');
      })
      .finally(() => {
        if (alive) setPatientsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    getStorefront()
      .then((sf) => {
        if (alive) setShop(sf || { products: [], brand: {} });
      })
      .catch(() => {
        if (alive) setShop({ products: [], brand: {} });
      })
      .finally(() => {
        if (alive) setShopLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const share = draft.medos_share || {};
  const selectedIds = Array.isArray(draft.medos_shop_product_ids) ? draft.medos_shop_product_ids : [];
  const products = Array.isArray(shop.products) ? shop.products : [];

  const onSelectPatient = (id) => {
    const p = patients.find((x) => x.id === id);
    updateDraft({ medos_patient_id: id, medos_patient_label: p ? patientName(p) : '' });
  };

  const toggleShare = (key) => updateDraft({ medos_share: { ...share, [key]: !share[key] } });

  const toggleProduct = (id) => {
    const next = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
    updateDraft({ medos_shop_product_ids: next });
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3 sm:gap-4">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d97757] bg-[#d97757]/12 text-[#d97757] shadow-[0_0_16px_-6px_rgba(217,119,87,0.35)]">
          <Stethoscope className="h-4 w-4 stroke-[2.5]" />
        </span>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-xl font-semibold tracking-tight text-white sm:text-[1.35rem]">Dossier MEDOS</h2>
          <p className="mt-1 text-sm text-gray-500">
            Rattachez le patient et préparez le cockpit clinique à partager pendant la téléconsultation.
          </p>
        </div>
      </div>

      {/* ── Patient rattaché ─────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label className="text-white/90">Patient</Label>
        {patientsError ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5 text-[13px] text-amber-300/90">
            <AlertCircle className="h-4 w-4 shrink-0" /> {patientsError}
          </div>
        ) : null}
        <Select value={draft.medos_patient_id || ''} onValueChange={onSelectPatient} disabled={patientsLoading}>
          <SelectTrigger className="h-12 rounded-lg border-[#2D3139] bg-[#0a0c10] px-3 text-white">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#d97757]/24 text-[#e8c3a0]">
                {patientsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <User2 className="h-4 w-4" />}
              </span>
              <SelectValue placeholder={patientsLoading ? 'Chargement des patients…' : 'Sélectionner un patient'} />
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-xl border-[#2D3139] bg-[#151a21]">
            {patients.length === 0 && !patientsLoading ? (
              <div className="px-3 py-2 text-[13px] text-gray-500">Aucun patient dans ce cabinet.</div>
            ) : null}
            {patients.map((p) => (
              <SelectItem key={p.id} value={p.id} className="rounded-lg focus:bg-[#d97757]/10 focus:text-[#d97757]">
                <span className="inline-flex items-center gap-2">
                  <User2 className="h-3.5 w-3.5" />
                  {patientName(p)}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[12px] text-gray-500">
          Optionnel : un live santé peut aussi être lancé sans dossier, ou préparé depuis un rendez-vous téléconsultation.
        </p>
      </div>

      {/* ── Éléments cliniques à préparer ────────────────────────────── */}
      <div className="space-y-3 border-t border-[#2D3139]/70 pt-5">
        <div>
          <Label className="text-white/90">Cockpit clinique à préparer</Label>
          <p className="mt-1 text-[12px] text-gray-500">Ce que le praticien pourra partager en un clic pendant le live.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SHARE_ITEMS.map((item) => {
            const Icon = item.icon;
            const on = !!share[item.key];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => toggleShare(item.key)}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors',
                  on ? 'border-[#d97757]/45 bg-[#d97757]/[0.08]' : 'border-[#2D3139] bg-[#0a0c10]/60 hover:border-[#d97757]/30',
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                      on ? 'bg-[#d97757] text-white' : 'bg-[#d97757]/20 text-[#d97757]',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-white">{item.label}</p>
                    <p className="text-[11.5px] leading-snug text-gray-400">{item.desc}</p>
                  </div>
                </div>
                <span
                  className={cn(
                    'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                    on ? 'bg-[#d97757]' : 'bg-white/15',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                      on ? 'translate-x-[22px]' : 'translate-x-0.5',
                    )}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Boutique du tenant à présenter ───────────────────────────── */}
      <div className="space-y-3 border-t border-[#2D3139]/70 pt-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-[#d97757]" />
            <Label className="text-white/90">
              Boutique{shop.brand?.name ? ` · ${shop.brand.name}` : ''}
            </Label>
          </div>
          <span className="text-[11.5px] text-gray-500">
            {selectedIds.length > 0 ? `${selectedIds.length} produit${selectedIds.length > 1 ? 's' : ''} choisi${selectedIds.length > 1 ? 's' : ''}` : 'aucun produit'}
          </span>
        </div>

        {shopLoading ? (
          <div className="flex items-center gap-2 px-1 py-3 text-[13px] text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement du catalogue…
          </div>
        ) : products.length === 0 ? (
          <p className="px-1 py-2 text-[13px] text-gray-500">
            Aucun catalogue configuré pour ce tenant.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {products.map((p) => {
              const on = selectedIds.includes(p.id);
              const img = p.image || (Array.isArray(p.images) ? p.images[0] : '');
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleProduct(p.id)}
                  className={cn(
                    'group relative overflow-hidden rounded-xl border text-left transition-all',
                    on ? 'border-[#d97757] ring-2 ring-[#d97757]/30' : 'border-[#2D3139] hover:border-[#d97757]/40',
                  )}
                >
                  <span
                    className={cn(
                      'absolute right-2 top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border transition-colors',
                      on ? 'border-[#d97757] bg-[#d97757] text-white' : 'border-white/30 bg-black/40 text-transparent',
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <div className="aspect-square w-full bg-[#f4efe7]">
                    {img ? (
                      <img src={img} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[#c9b8a5]">
                        <ShoppingBag className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5 bg-[#0a0c10] px-2.5 py-2">
                    <p className="truncate text-[12.5px] font-semibold text-white">{p.name}</p>
                    <p className="text-[12px] font-medium text-[#e8c3a0]">{fmtPrice(p.price, p.currency)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Step7MedosDossier;
