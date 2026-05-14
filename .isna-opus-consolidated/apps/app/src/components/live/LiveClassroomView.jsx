/**
 * Vue Classroom Live — Intégration LiveKit
 * Mode secret : seul le professeur visible pour les élèves
 * Toggle enseignant : bascule secret/public
 */
import React, { useState, useEffect } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useRoom,
  useLocalParticipant,
} from '@livekit/components-react';
import { useAuth } from '@/hooks/useAuth';
import { getLiveKitToken } from '@/services/livekitApi';
import { useLiveSessionRealtime } from '@/hooks/useLiveSessionRealtime';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Hand, Loader2, Eye, EyeOff, MessageSquare, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiveChatPanel } from './LiveChatPanel';
import { UserPicker } from './UserPicker';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getStableLiveKitRoomOptions, stableLiveKitConnectOptions } from '@/lib/livekitStableClient';

/** Chrome : débloquer Web Audio après un geste (LiveKit / RoomAudioRenderer). */
function LiveKitAudioGestureUnlock() {
  const room = useRoom();
  useEffect(() => {
    if (!room) return undefined;
    const unlock = () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      room.startAudio?.().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [room]);
  return null;
}

/**
 * Élèves : allume / éteint la caméra locale quand le prof bascule secret → public (sans recharger).
 */
function StudentCameraVisibilitySync({ isTeacher, visibilityMode }) {
  const { localParticipant } = useLocalParticipant();
  useEffect(() => {
    if (!localParticipant || isTeacher) return;
    const wantVideo = visibilityMode === 'public';
    localParticipant.setCameraEnabled(wantVideo).catch(() => {});
  }, [isTeacher, visibilityMode, localParticipant]);
  return null;
}

export function LiveClassroomView({ liveSessionId, session, isTeacher, onLeave }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tokenData, setTokenData] = useState(null);
  const [error, setError] = useState(null);
  const [switchingVisibility, setSwitchingVisibility] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSelected, setInviteSelected] = useState([]);
  const [inviting, setInviting] = useState(false);
  const [canInviteAsMember, setCanInviteAsMember] = useState(false);

  useEffect(() => {
    if (!liveSessionId || !user?.id || isTeacher) return;
    supabase
      .from('live_session_participants')
      .select('can_invite_others')
      .eq('live_session_id', liveSessionId)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          setCanInviteAsMember(false);
          return;
        }
        setCanInviteAsMember(data?.can_invite_others === true);
      });
  }, [liveSessionId, user?.id, isTeacher]);

  const canInvite = isTeacher || canInviteAsMember;

  const { handRaises, visibilityMode, broadcastHandRaise, broadcastVisibilityMode } = useLiveSessionRealtime(liveSessionId, {
    initialVisibilityMode: session?.visibility_mode,
  });

  const handleInvite = async () => {
    if (!liveSessionId || !user?.id || inviteSelected.length === 0) return;
    setInviting(true);
    try {
      const participants = inviteSelected.map((u) => ({
        live_session_id: liveSessionId,
        user_id: typeof u === 'object' ? u.id : u,
        role: 'student',
      }));
      const { error: err } = await supabase.from('live_session_participants').upsert(participants, {
        onConflict: 'live_session_id,user_id',
        ignoreDuplicates: true,
      });
      if (err) throw err;
      toast({ title: 'Invitations envoyées', description: `${inviteSelected.length} personne(s) invitée(s).` });
      setInviteOpen(false);
      setInviteSelected([]);
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  const handleToggleVisibility = async () => {
    if (!isTeacher || !liveSessionId) return;
    const nextMode = visibilityMode === 'secret' ? 'public' : 'secret';
    setSwitchingVisibility(true);
    try {
      const { error: err } = await supabase
        .from('live_sessions')
        .update({ visibility_mode: nextMode })
        .eq('id', liveSessionId);
      if (err) throw err;
      broadcastVisibilityMode(nextMode);
      setSwitchingVisibility(false);
      toast({
        title: nextMode === 'public' ? 'Mode public activé' : 'Mode secret activé',
        description:
          nextMode === 'public'
            ? 'Les élèves peuvent activer leur caméra (sync automatique ou contrôles LiveKit).'
            : 'Seul le professeur reste en vidéo ; les caméras élèves sont coupées.',
      });
    } catch (e) {
      setSwitchingVisibility(false);
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (!liveSessionId || !user?.id) return;
    getLiveKitToken(liveSessionId)
      .then(setTokenData)
      .catch((err) => setError(err?.message));
  }, [liveSessionId, user?.id]);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0F1419]">
        <div className="text-center text-red-400 p-4">{error}</div>
      </div>
    );
  }

  if (!tokenData) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0F1419]">
        <Loader2 className="w-12 h-12 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  const publishVideo = isTeacher || visibilityMode === 'public';

  return (
    <LiveKitRoom
      token={tokenData.token}
      serverUrl={tokenData.livekitUrl}
      connect={true}
      audio={true}
      video={publishVideo}
      options={getStableLiveKitRoomOptions({ adaptiveStream: true, dynacast: true })}
      connectOptions={stableLiveKitConnectOptions}
      onDisconnected={onLeave}
      className="flex-1 flex flex-col"
    >
      <LiveKitAudioGestureUnlock />
      <StudentCameraVisibilitySync isTeacher={isTeacher} visibilityMode={visibilityMode} />
      <RoomAudioRenderer />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <VideoConference />
        </div>
        {chatOpen && (
          <LiveChatPanel
            liveSessionId={liveSessionId}
            userId={user?.id}
            userName={user?.name || user?.email}
          />
        )}
      </div>
      {/* Barre de contrôle */}
      <div className="p-2 bg-[#192734] border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          {isTeacher && (
            <>
              <div className="flex items-center gap-2">
                <Hand className="w-4 h-4 text-[#D4AF37]" />
                <span className="text-sm text-gray-300">{handRaises.length} main(s) levée(s)</span>
                {handRaises.length > 0 && (
                  <span className="text-xs text-gray-500">({handRaises.map((h) => h.userName || 'Élève').join(', ')})</span>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10"
                onClick={() => setInviteOpen(true)}
              >
                <UserPlus className="w-4 h-4 mr-2" /> Inviter
              </Button>
              <div className="flex items-center gap-2">
                <EyeOff className={cn('w-4 h-4', visibilityMode === 'secret' && 'text-[#D4AF37]')} />
                <Switch
                  id="visibility-mode"
                  checked={visibilityMode === 'public'}
                  onCheckedChange={handleToggleVisibility}
                  disabled={switchingVisibility}
                  className="data-[state=checked]:bg-[#D4AF37]"
                />
                <Eye className={cn('w-4 h-4', visibilityMode === 'public' && 'text-[#D4AF37]')} />
                <Label htmlFor="visibility-mode" className="text-sm text-gray-400 cursor-pointer">
                  {visibilityMode === 'secret' ? 'Secret' : 'Public'}
                </Label>
              </div>
            </>
          )}
          {!isTeacher && (
            <>
              {canInvite && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10"
                  onClick={() => setInviteOpen(true)}
                >
                  <UserPlus className="w-4 h-4 mr-2" /> Inviter
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10"
                onClick={async () => {
                  broadcastHandRaise(true, { userId: user?.id, userName: user?.name || user?.email });
                  await supabase.from('hand_raise_events').insert({ live_session_id: liveSessionId, user_id: user?.id });
                }}
              >
                <Hand className="w-4 h-4 mr-2" /> Lever la main
              </Button>
            </>
          )}
        </div>
        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-[#D4AF37]" onClick={() => setChatOpen((o) => !o)}>
          <MessageSquare className="w-4 h-4 mr-1" /> {chatOpen ? 'Masquer chat' : 'Afficher chat'}
        </Button>
      </div>
      {!isTeacher && visibilityMode === 'public' && (
        <div className="px-3 py-1.5 bg-amber-500/10 border-t border-amber-500/30 text-amber-200 text-xs">
          Mode public : vous pouvez activer votre caméra depuis les contrôles LiveKit si besoin.
        </div>
      )}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md !bg-[#0d1117] !border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Inviter des participants</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <UserPicker selected={inviteSelected} onChange={setInviteSelected} />
            <Button
              onClick={handleInvite}
              disabled={inviteSelected.length === 0 || inviting}
              className="w-full bg-[#D4AF37] text-black"
            >
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Inviter (${inviteSelected.length})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </LiveKitRoom>
  );
}
