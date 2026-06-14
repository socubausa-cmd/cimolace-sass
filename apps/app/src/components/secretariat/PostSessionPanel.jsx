/**
 * PostSessionPanel — Formulaire post-session du secrétariat
 *
 * Sauvegarde via Netlify function `booking-post-session` :
 *   - Notes internes (non visibles par l'élève)
 *   - Résumé de la session
 *   - Prochaine action recommandée
 *   - Statut final (completed | no_show)
 */

import React, { useState } from 'react';
import { Loader2, Save, FileText, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const NEXT_ACTIONS = [
  { value: 'none',             label: 'Aucune action requise' },
  { value: 'inscription',      label: 'Orientation vers une inscription' },
  { value: 'autre_entretien',  label: 'Autre entretien à planifier' },
  { value: 'document_requis',  label: 'Document requis de l\'élève' },
  { value: 'suivi_email',      label: 'Suivi par email' },
  { value: 'escalade',         label: 'Escalade vers un responsable' },
];

export default function PostSessionPanel({ appointment, session, onDone, onCancel }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    finalStatus: 'completed',
    notes:       '',
    summary:     '',
    nextAction:  'none',
  });
  const [saving, setSaving] = useState(false);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!appointment?.id) return;
    setSaving(true);
    try {
      const token = session?.access_token;
      if (!token) throw new Error('Session expirée');
      const res = await fetch('/.netlify/functions/booking-post-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          appointmentId: appointment.id,
          finalStatus:   form.finalStatus,
          notes:         form.notes.trim() || null,
          summary:       form.summary.trim() || null,
          nextAction:    form.nextAction,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur serveur');
      toast({ title: 'Rapport enregistré', description: 'La session est clôturée avec succès.' });
      onDone?.({ finalStatus: form.finalStatus });
    } catch (e) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4 bg-[#0a0f1a]/60">
      {/* Title */}
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-[var(--school-accent)]" />
        <p className="text-sm font-semibold text-white">Rapport post-session</p>
      </div>

      {/* Statut final */}
      <div className="space-y-1">
        <label className="text-xs text-gray-500 uppercase tracking-wider">Statut final</label>
        <div className="flex gap-2">
          {[
            { value: 'completed', label: 'Terminé', color: 'emerald' },
            { value: 'no_show',   label: 'Absent',  color: 'red' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => set('finalStatus', opt.value)}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${
                form.finalStatus === opt.value
                  ? opt.color === 'emerald'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-red-500/20 border-red-500/50 text-red-300'
                  : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/25'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Résumé */}
      <div className="space-y-1">
        <label className="text-xs text-gray-500 uppercase tracking-wider">Résumé de la session</label>
        <textarea
          value={form.summary}
          onChange={e => set('summary', e.target.value)}
          placeholder="Points abordés, décisions prises…"
          rows={3}
          className="w-full resize-none rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] transition-colors"
        />
      </div>

      {/* Notes internes */}
      <div className="space-y-1">
        <label className="text-xs text-gray-500 uppercase tracking-wider">Notes internes <span className="text-gray-600">(non visibles par l'élève)</span></label>
        <textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Observations, contexte, points de vigilance…"
          rows={2}
          className="w-full resize-none rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] transition-colors"
        />
      </div>

      {/* Prochaine action */}
      <div className="space-y-1">
        <label className="text-xs text-gray-500 uppercase tracking-wider">Prochaine action</label>
        <div className="relative">
          <select
            value={form.nextAction}
            onChange={e => set('nextAction', e.target.value)}
            className="w-full appearance-none rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 pr-9 text-sm text-white focus:outline-none focus:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] transition-colors cursor-pointer"
          >
            {NEXT_ACTIONS.map(a => (
              <option key={a.value} value={a.value} className="bg-[#0f1520] text-white">
                {a.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          variant="ghost"
          onClick={onCancel}
          disabled={saving}
          className="text-gray-500 hover:text-white hover:bg-white/5"
        >
          Annuler
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-[var(--school-accent)] text-black hover:bg-amber-400 font-semibold flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer le rapport
        </Button>
      </div>
    </div>
  );
}
