import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import { livesApi, checkoutApi } from '@/lib/api';

export function LiveJoin() {
  const { id } = useParams<{ id: string }>();
  const [roomToken, setRoomToken] = useState<{ token: string; roomName: string } | null>(null);

  const liveQuery = useQuery({
    queryKey: ['live', id],
    queryFn: () => livesApi.get(id!),
    enabled: !!id,
  });

  const tokenMutation = useMutation({
    mutationFn: () => livesApi.token(id!),
    onSuccess: (data) => setRoomToken(data),
  });

  const checkoutMutation = useMutation({
    mutationFn: () => checkoutApi.createSession(id!),
    onSuccess: (data) => { window.location.href = data.checkoutUrl; },
  });

  if (liveQuery.isLoading) return <p className="p-6 text-gray-500">Chargement…</p>;
  const live = liveQuery.data;

  if (roomToken) {
    return (
      <LiveKitRoom
        serverUrl={import.meta.env.VITE_LIVEKIT_URL ?? 'wss://localhost:7880'}
        token={roomToken.token}
        connect={true}
        video={true}
        audio={true}
        style={{ height: '100vh' }}
      >
        <VideoConference />
      </LiveKitRoom>
    );
  }

  const price =
    live && live.priceCents === 0
      ? 'Gratuit'
      : live
        ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: live.currency }).format(
            live.priceCents / 100,
          )
        : null;

  const canShowCheckout =
    tokenMutation.isError || liveQuery.isError || new URLSearchParams(window.location.search).get('payment') === 'cancelled';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          {live?.title ?? 'Live payant'}
        </h1>
        {live ? (
          <>
            <p className="text-gray-500 text-sm mb-1">
              {new Date(live.scheduledAt).toLocaleString('fr-FR', {
                dateStyle: 'long',
                timeStyle: 'short',
              })}
            </p>
            <p className="text-gray-700 font-medium mb-6">{price}</p>
          </>
        ) : (
          <p className="text-gray-500 text-sm mb-6">
            Votre accès sera vérifié au moment de rejoindre le live.
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => tokenMutation.mutate()}
            disabled={tokenMutation.isPending}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {tokenMutation.isPending ? 'Connexion…' : 'Rejoindre le live'}
          </button>

          {canShowCheckout && (
            <button
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending}
              className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {checkoutMutation.isPending ? 'Redirection…' : 'Payer pour accéder'}
            </button>
          )}
        </div>

        {canShowCheckout && !checkoutMutation.isPending && (
          <p className="text-amber-600 text-xs mt-3">
            Accès refusé. Achetez un accès pour rejoindre ce live.
          </p>
        )}
        {checkoutMutation.isError && (
          <p className="text-red-600 text-xs mt-3">{checkoutMutation.error.message}</p>
        )}
      </div>
    </div>
  );
}
