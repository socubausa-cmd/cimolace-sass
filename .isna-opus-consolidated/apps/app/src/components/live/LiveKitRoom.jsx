/**
 * LiveKit Room — Intégration vidéo/audio
 * Mode secret : élève ne voit que le professeur
 * Mode public : tous visibles
 */
import React, { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { useAuth } from '@/hooks/useAuth';
import { getLiveKitToken } from '@/services/livekitApi';
import { getStableLiveKitRoomOptions, stableLiveKitConnectOptions } from '@/lib/livekitStableClient';
import { Loader2, VideoOff, MicOff } from 'lucide-react';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function LiveKitRoom({ liveSessionId, session, isTeacher, onConnected, onDisconnected, children }) {
  const { user } = useAuth();
  const [room, setRoom] = useState(null);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const localVideoRef = useRef(null);

  useEffect(() => {
    if (!liveSessionId || !user?.id) return;

    let roomInstance = null;

    const connect = async () => {
      try {
        const { token, livekitUrl, roomName } = await getLiveKitToken(liveSessionId);
        roomInstance = new Room(
          getStableLiveKitRoomOptions({
            adaptiveStream: true,
            dynacast: true,
          })
        );

        roomInstance.on(RoomEvent.Connected, () => {
          setRoom(roomInstance);
          setConnecting(false);
          onConnected?.(roomInstance);
        });

        roomInstance.on(RoomEvent.Disconnected, () => {
          setRoom(null);
          onDisconnected?.();
        });

        await roomInstance.connect(livekitUrl, token, stableLiveKitConnectOptions);
      } catch (err) {
        setError(err?.message || 'Erreur de connexion');
        setConnecting(false);
      }
    };

    connect();

    return () => {
      if (roomInstance) {
        roomInstance.disconnect(true);
      }
    };
  }, [liveSessionId, user?.id]);

  if (connecting) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0F1419]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#D4AF37] mx-auto mb-4" />
          <p className="text-gray-400">Connexion à la salle...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0F1419]">
        <div className="text-center text-red-400">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return children ? children(room) : null;
}
