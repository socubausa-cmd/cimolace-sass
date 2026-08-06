import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCcw, Search, Mail, CreditCard, Smartphone, Download, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { boutiqueAdminApi } from '@/lib/api-v2';

const STATUTS = [
  { value: '', label: 'Toutes' },
  { value: 'completed', label: 'Payées' },
  { value: 'pending', label: 'En attente' },
  { value: 'failed', label: 'Échouées' },
];

const eur = (cents) =>
  `${(Number(cents || 0) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/**
 * Montant RÉELLEMENT débité. Piège : `display_amount` est en CENTIMES pour l'euro
 * (Stripe) mais en UNITÉS entières pour le franc CFA (pawaPay) — les additionner
 * ou les formater pareil donnerait un chiffre faux.
 */
function montantDebite(o) {
  if (o.displayAmount == null) return '—';
  if ((o.displayCurrency || 'EUR') === 'EUR') return eur(o.displayAmount);
  return `${Number(o.displayAmount).toLocaleString('fr-FR')} ${o.displayCurrency}`;
}

const ICONE_STATUT = {
  completed: { Icon: CheckCircle2, classe: 'text-emerald-300', libelle: 'Payée' },
  pending: { Icon: Clock, classe: 'text-amber-300', libelle: 'En attente' },
  failed: { Icon: XCircle, classe: 'text-red-300', libelle: 'Échouée' },
  refunded: { Icon: XCircle, classe: 'text-gray-400', libelle: 'Remboursée' },
};

export default function BookOrdersPanel() {
  const { toast } = useToast();
  const [data, setData] = useState({ orders: [], summary: null });
  const [statut, setStatut] = useState('');
  const [recherche, setRecherche] = useState('');
  const [chargement, setChargement] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState('');

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      setData(await boutiqueAdminApi.orders(statut ? { statut } : undefined));
    } catch (e) {
      toast({ title: 'Ventes', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setChargement(false);
    }
  }, [statut, toast]);

  useEffect(() => { void charger(); }, [charger]);

  const lignes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return data.orders;
    return data.orders.filter((o) =>
      [o.buyerEmail, o.buyerName, o.buyerPhone, o.country].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [data.orders, recherche]);

  const s = data.summary || {};
  const devises = Object.entries(s.byCurrency || {});

  const renvoyer = async (o) => {
    setEnvoiEnCours(o.id);
    try {
      await boutiqueAdminApi.resendLink(o.id);
      toast({ title: 'Lien renvoyé', description: `Un nouveau lien de téléchargement est parti à ${o.buyerEmail}.` });
      void charger();
    } catch (e) {
      toast({ title: 'Renvoi impossible', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setEnvoiEnCours('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="premium-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">Ventes du livre</h2>
            <p className="text-sm text-gray-400">
              Chaque exemplaire vendu porte le nom de l’acheteuse. Vous pouvez lui renvoyer son lien s’il a expiré.
            </p>
          </div>
          <Button variant="outline" className="border-white/10 text-white hover:bg-white/5"
            onClick={() => charger()} disabled={chargement}>
            {chargement ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi libelle="Exemplaires vendus" valeur={s.completed ?? 0} />
        <Kpi libelle="Chiffre d’affaires" valeur={eur(s.revenueCents)} indice="équivalent EUR" />
        <Kpi libelle="Paiements en attente" valeur={s.pending ?? 0} />
        <Kpi libelle="Échecs" valeur={s.failed ?? 0} />
      </div>

      {devises.length > 0 && (
        <div className="premium-panel p-4">
          <p className="text-xs text-gray-400 mb-2">Réellement encaissé, par devise</p>
          <div className="flex flex-wrap gap-2">
            {devises.map(([cur, montant]) => (
              <Badge key={cur} className="bg-amber-500/15 text-amber-200 border-amber-500/30">
                {cur === 'EUR' ? eur(montant) : `${Number(montant).toLocaleString('fr-FR')} ${cur}`}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="premium-panel p-5 space-y-3">
        <div className="flex flex-wrap gap-2">
          {STATUTS.map((opt) => (
            <button type="button" key={opt.value || 'all'} onClick={() => setStatut(opt.value)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                statut === opt.value
                  ? 'border-[var(--school-accent)] bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)]'
                  : 'border-white/10 text-gray-300 hover:bg-white/5'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-500" />
          <Input value={recherche} onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher une acheteuse (e-mail, nom, téléphone)…" className="pl-9" />
        </div>
      </div>

      {lignes.length === 0 ? (
        <div className="premium-panel p-8 text-center">
          <p className="text-sm text-gray-400">
            {chargement ? 'Chargement…' : 'Aucune vente pour l’instant. Le mur se remplira au premier achat.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {lignes.map((o) => {
            const st = ICONE_STATUT[o.status] || ICONE_STATUT.pending;
            const expire = o.downloadExpiresAt && new Date(o.downloadExpiresAt) < new Date();
            return (
              <article key={o.id} className="premium-panel p-5 border border-white/10 rounded-xl">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-white font-semibold truncate">
                      {o.buyerName || o.buyerEmail}
                      <span className={`ml-2 inline-flex items-center gap-1 text-xs ${st.classe}`}>
                        <st.Icon className="w-3.5 h-3.5" />{st.libelle}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {o.buyerEmail}
                      {o.buyerPhone ? ` • ${o.buyerPhone}` : ''}
                      {o.country ? ` • ${o.country}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1">
                        {o.provider === 'stripe'
                          ? <><CreditCard className="w-3.5 h-3.5" />Carte</>
                          : <><Smartphone className="w-3.5 h-3.5" />Mobile Money</>}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Download className="w-3.5 h-3.5" />
                        {o.downloadCount} téléchargement{o.downloadCount > 1 ? 's' : ''}
                        {expire ? ' • lien expiré' : ''}
                      </span>
                      <span>{new Date(o.completedAt || o.createdAt).toLocaleString('fr-FR')}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-lg font-bold text-white">{montantDebite(o)}</span>
                    {o.status === 'completed' && (
                      <Button variant="outline" className="border-white/10 text-white hover:bg-white/5"
                        onClick={() => renvoyer(o)} disabled={envoiEnCours === o.id}>
                        {envoiEnCours === o.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <><Mail className="w-4 h-4 mr-2" />Renvoyer le lien</>}
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Kpi({ libelle, valeur, indice }) {
  return (
    <div className="premium-panel p-4">
      <p className="text-xs text-gray-400">{libelle}</p>
      <p className="text-2xl font-bold text-white mt-1">{valeur}</p>
      {indice ? <p className="text-[11px] text-gray-500 mt-0.5">{indice}</p> : null}
    </div>
  );
}
