import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, RefreshCcw, Search, Phone, Mail, Video, MessageCircle, MapPin, Calendar, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { boutiqueAdminApi } from '@/lib/api-v2';

/** Le pipeline, dans l'ordre où une demande le traverse. */
const ETAPES = [
  { value: 'nouvelle', label: 'Nouvelles' },
  { value: 'contactee', label: 'Contactées' },
  { value: 'planifiee', label: 'Planifiées' },
  { value: 'terminee', label: 'Terminées' },
  { value: 'annulee', label: 'Annulées' },
];

const CANAL = {
  visio: { Icon: Video, label: 'Visioconférence' },
  whatsapp: { Icon: MessageCircle, label: 'WhatsApp' },
  telephone: { Icon: Phone, label: 'Téléphone' },
  presentiel: { Icon: MapPin, label: 'En présentiel' },
};

export default function AccompanimentRequestsPanel() {
  const { toast } = useToast();
  const [data, setData] = useState({ requests: [], summary: {} });
  const [statut, setStatut] = useState('');
  const [recherche, setRecherche] = useState('');
  const [chargement, setChargement] = useState(false);
  const [enCours, setEnCours] = useState('');

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      setData(await boutiqueAdminApi.requests(statut ? { statut } : undefined));
    } catch (e) {
      toast({ title: 'Demandes', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setChargement(false);
    }
  }, [statut, toast]);

  useEffect(() => { void charger(); }, [charger]);

  const lignes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return data.requests;
    return data.requests.filter((r) =>
      [r.fullName, r.email, r.phone, r.country, r.message].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [data.requests, recherche]);

  const avancer = async (r, nouveau) => {
    setEnCours(r.id);
    try {
      await boutiqueAdminApi.updateRequest(r.id, nouveau);
      void charger();
    } catch (e) {
      toast({ title: 'Mise à jour impossible', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setEnCours('');
    }
  };

  const nouvelles = data.summary?.nouvelle || 0;

  return (
    <div className="space-y-4">
      <div className="premium-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">Demandes d’accompagnement</h2>
            <p className="text-sm text-gray-400">
              Ces femmes attendent votre appel. Nous leur avons promis une réponse sous 48 heures ouvrées.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {nouvelles > 0 && (
              <Badge className="bg-amber-500/15 text-amber-200 border-amber-500/30">
                {nouvelles} à rappeler
              </Badge>
            )}
            <Button variant="outline" className="border-white/10 text-white hover:bg-white/5"
              onClick={() => charger()} disabled={chargement}>
              {chargement ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="premium-panel p-5 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setStatut('')}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              statut === ''
                ? 'border-[var(--school-accent)] bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)]'
                : 'border-white/10 text-gray-300 hover:bg-white/5'
            }`}>
            Toutes
          </button>
          {ETAPES.map((e) => (
            <button type="button" key={e.value} onClick={() => setStatut(e.value)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                statut === e.value
                  ? 'border-[var(--school-accent)] bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)]'
                  : 'border-white/10 text-gray-300 hover:bg-white/5'
              }`}>
              {e.label}{data.summary?.[e.value] ? ` (${data.summary[e.value]})` : ''}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-500" />
          <Input value={recherche} onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher une demande (nom, e-mail, téléphone)…" className="pl-9" />
        </div>
      </div>

      <div className="premium-panel p-4 flex gap-3 items-start">
        <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-400 leading-relaxed">
          Ce que ces femmes écrivent ici peut être lourd. Si l’une d’elles décrit un danger immédiat,
          orientez-la vers les secours ou une association de son pays avant toute proposition d’accompagnement.
        </p>
      </div>

      {lignes.length === 0 ? (
        <div className="premium-panel p-8 text-center">
          <p className="text-sm text-gray-400">
            {chargement ? 'Chargement…' : 'Aucune demande pour l’instant.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {lignes.map((r) => {
            const c = CANAL[r.channel] || null;
            return (
              <article key={r.id} className="premium-panel p-5 border border-white/10 rounded-xl">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-white font-semibold">{r.fullName}</p>
                    <p className="text-xs text-gray-400 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 hover:underline">
                        <Mail className="w-3.5 h-3.5" />{r.email}
                      </a>
                      {r.phone && (
                        <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 hover:underline">
                          <Phone className="w-3.5 h-3.5" />{r.phone}
                        </a>
                      )}
                      {r.country && <span>{r.country}</span>}
                      {c && <span className="inline-flex items-center gap-1"><c.Icon className="w-3.5 h-3.5" />{c.label}</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 flex flex-wrap items-center gap-x-3">
                      {r.formulaKey && (
                        <Badge className="bg-amber-500/15 text-amber-200 border-amber-500/30">{r.formulaKey}</Badge>
                      )}
                      {(r.preferredAt || r.preferredNote) && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {r.preferredAt ? new Date(r.preferredAt).toLocaleString('fr-FR') : r.preferredNote}
                        </span>
                      )}
                      <span>reçue le {new Date(r.createdAt).toLocaleDateString('fr-FR')}</span>
                    </p>
                  </div>
                </div>

                {r.message && (
                  <p className="mt-3 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap rounded-lg bg-white/[0.03] p-3">
                    {r.message}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {ETAPES.map((e) => (
                    <button type="button" key={e.value} disabled={enCours === r.id || r.status === e.value}
                      onClick={() => avancer(r, e.value)}
                      className={`rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:opacity-60 ${
                        r.status === e.value
                          ? 'border-[var(--school-accent)] bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)]'
                          : 'border-white/10 text-gray-300 hover:bg-white/5'
                      }`}>
                      {e.label.replace(/s$/, '')}
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
