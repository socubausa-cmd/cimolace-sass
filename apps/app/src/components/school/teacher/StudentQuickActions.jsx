import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, Video, Loader2 } from 'lucide-react';

/**
 * StudentQuickActions — actions prof depuis la fiche élève.
 * - « Message privé » (DM — à brancher quand le moteur de messagerie 1-à-1 sera prêt).
 * - « Programmer un live » : crée une séance live avec l'élève via le booking
 *   (POST /booking/students/:id/schedule-live) puis ouvre la salle hôte.
 */
export default function StudentQuickActions({ student }) {
  const [loading, setLoading] = useState(false);

  const handleScheduleLive = async () => {
    if (!student?.id || loading) return;
    setLoading(true);
    try {
      const { bookingApi } = await import('@/lib/api');
      const res = await bookingApi.scheduleLiveWithStudent(student.id, {
        title: `Séance — ${student.name || ''}`.trim(),
      });
      if (res?.liveSessionId) {
        window.location.href = `/live/host/${res.liveSessionId}`;
        return;
      }
      throw new Error('Séance non créée');
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e?.message || 'Impossible de programmer la séance');
    } finally {
      setLoading(false);
    }
  };

  const [dmLoading, setDmLoading] = useState(false);
  const handleMessage = async () => {
    if (!student?.id || dmLoading) return;
    setDmLoading(true);
    try {
      const { chatApi } = await import('@/lib/api');
      const room = await chatApi.openDirect(student.id); // même moteur que le chat du live
      if (room?.id) {
        // TODO: ouvrir le panneau de messagerie unifié sur cette room.
        // eslint-disable-next-line no-alert
        alert(`Conversation privée prête avec ${student.name || 'l\'élève'}.`);
        return;
      }
      throw new Error('Conversation indisponible');
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e?.message || 'Impossible d\'ouvrir la conversation');
    } finally {
      setDmLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" className="gap-2" onClick={handleMessage} disabled={dmLoading}>
        {dmLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />} Message privé
      </Button>
      <Button
        onClick={handleScheduleLive}
        disabled={loading}
        className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 font-bold gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
        Programmer un live
      </Button>
    </div>
  );
}
