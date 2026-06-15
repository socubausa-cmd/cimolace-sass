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
      <div className="rounded-[14px] border border-violet-200 bg-violet-50 p-6 flex items-center justify-center gap-2 text-[#52525B]">
        <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
        <span className="text-sm">Chargement des demandes de report…</span>
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[14px] border border-violet-200 bg-violet-50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-bold text-violet-700 flex items-center gap-2">
          <CalendarClock className="w-5 h-5" />
          Demandes de report ({items.length})
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-black/[0.12] bg-white text-[#52525B] hover:bg-[#F4F5F7]"
          onClick={() => void load()}
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          Actualiser
        </Button>
      </div>
      <p className="text-xs text-violet-700/80">
        Validez ou refusez le nouveau créneau proposé. Le participant reçoit une notification.
      </p>
      <div className="space-y-4">
        {items.map((r) => (
          <motion.div
            key={r.id}
            layout
            className="rounded-xl border border-black/[0.08] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
              <div>
                <p className="font-medium text-[#18181B]">
                  {r.student?.name || r.student?.email || 'Participant'}
                </p>
                <p className="text-xs text-[#71717A]">
                  Réf.{' '}
                  <span className="font-mono text-[#8A6D1A]">
                    {String(r.appointment?.bookingReference || r.appointmentId || '').slice(0, 14).toUpperCase()}
                  </span>
                </p>
                <p className="text-sm text-[#52525B] mt-1">
                  <span className="text-[#71717A]">Créneau actuel :</span>{' '}
                  {r.appointment?.scheduledAt
                    ? new Date(r.appointment.scheduledAt).toLocaleString('fr-FR', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : '—'}
                </p>
                <p className="text-sm text-emerald-700 mt-1">
                  <span className="text-[#71717A]">Proposition :</span>{' '}
                  {r.proposedScheduledAt
                    ? new Date(r.proposedScheduledAt).toLocaleString('fr-FR', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : '—'}
                </p>
                <p className="text-sm text-[#52525B] mt-2">
                  <span className="text-[#71717A]">Justification :</span> {r.justification}
                </p>
              </div>
            </div>
            <div>
              <Label className="text-xs text-[#71717A]">Note interne (optionnelle, visible dans la notification)</Label>
              <Textarea
                value={notes[r.id] || ''}
                onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                placeholder="Ex. créneau validé avec le secrétariat AF…"
                className="mt-1 bg-[#F4F5F7] border-black/[0.08] text-[#18181B] text-sm min-h-[64px]"
                rows={2}
              />
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-red-300 text-red-700 hover:bg-red-50"
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
