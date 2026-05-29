import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CalendarClock, Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';

/**
 * File d'attente des demandes de report (visiteurs / élèves) — validation par le secrétariat.
 */
export function SecretariatRescheduleQueue({ onProcessed }) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  /** `${requestId}:${decision}` pendant l'appel API */
  const [pendingKey, setPendingKey] = useState(null);
  const [notes, setNotes] = useState({});

  const load = useCallback(async () => {
    if (!session?.access_token) {
      setLoading(false);
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/.netlify/functions/booking-reschedule-list-staff', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Erreur chargement');
      setItems(Array.isArray(payload.requests) ? payload.requests : []);
    } catch (e) {
      toast({ title: 'Demandes de report', description: e?.message || 'Erreur', variant: 'destructive' });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const isPending = (requestId, decision) => pendingKey === `${requestId}:${decision}`;
  const rowBusy = (requestId) => pendingKey?.startsWith(`${requestId}:`);

  const decide = async (requestId, decision) => {
    if (!session?.access_token) return;
    setPendingKey(`${requestId}:${decision}`);
    try {
      const res = await fetch('/.netlify/functions/booking-reschedule-staff-decide', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          requestId,
          decision,
          staffNote: notes[requestId] || '',
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Action impossible');
      toast({
        title: decision === 'approved' ? 'Report accepté' : 'Demande refusée',
        description: 'Le participant a été notifié.',
      });
      setItems((prev) => prev.filter((x) => x.id !== requestId));
      setNotes((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      onProcessed?.();
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Réessayez.', variant: 'destructive' });
    } finally {
      setPendingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6 flex items-center justify-center gap-2 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
        <span className="text-sm">Chargement des demandes de report…</span>
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-bold text-violet-200 flex items-center gap-2">
          <CalendarClock className="w-5 h-5" />
          Demandes de report ({items.length})
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-white/15 text-gray-300"
          onClick={() => void load()}
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          Actualiser
        </Button>
      </div>
      <p className="text-xs text-violet-200/70">
        Validez ou refusez le nouveau créneau proposé. Le participant reçoit une notification.
      </p>
      <div className="space-y-4">
        {items.map((r) => (
          <motion.div
            key={r.id}
            layout
            className="rounded-xl border border-white/10 bg-[#0F1419]/70 p-4 space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
              <div>
                <p className="font-medium text-white">
                  {r.student?.name || r.student?.email || 'Participant'}
                </p>
                <p className="text-xs text-gray-500">
                  Réf.{' '}
                  <span className="font-mono text-[#D4AF37]">
                    {String(r.appointment?.bookingReference || r.appointmentId || '').slice(0, 14).toUpperCase()}
                  </span>
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  <span className="text-gray-500">Créneau actuel :</span>{' '}
                  {r.appointment?.scheduledAt
                    ? new Date(r.appointment.scheduledAt).toLocaleString('fr-FR', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : '—'}
                </p>
                <p className="text-sm text-emerald-200/90 mt-1">
                  <span className="text-gray-500">Proposition :</span>{' '}
                  {r.proposedScheduledAt
                    ? new Date(r.proposedScheduledAt).toLocaleString('fr-FR', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : '—'}
                </p>
                <p className="text-sm text-gray-300 mt-2">
                  <span className="text-gray-500">Justification :</span> {r.justification}
                </p>
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Note interne (optionnelle, visible dans la notification)</Label>
              <Textarea
                value={notes[r.id] || ''}
                onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                placeholder="Ex. créneau validé avec le secrétariat AF…"
                className="mt-1 bg-[#0a0e14] border-white/10 text-sm min-h-[64px]"
                rows={2}
              />
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-red-500/30 text-red-300 hover:bg-red-500/10"
                disabled={rowBusy(r.id)}
                onClick={() => void decide(r.id, 'rejected')}
              >
                {isPending(r.id, 'rejected') ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <XCircle className="w-4 h-4 mr-1" />
                    Refuser
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-500"
                disabled={rowBusy(r.id)}
                onClick={() => void decide(r.id, 'approved')}
              >
                {isPending(r.id, 'approved') ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Accepter le report
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default SecretariatRescheduleQueue;
