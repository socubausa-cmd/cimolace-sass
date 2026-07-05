import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';
import { getStableLiveKitRoomOptions, stableLiveKitConnectOptions } from '@/lib/livekitStableClient';
import { liveJoinApi } from '@/lib/api-v2';

/**
 * Rejoindre un LIVE via un CODE (scénario A — accès provisoire, anonyme, sans
 * compte). Le code (classe rejouable ou individuel one-time) est échangé côté
 * serveur contre un token LiveKit VIEWER. Aucune membership n'est créée.
 * Mobile-first, thème chaud LIRI.
 */
export default function LiveJoinPage() {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState((searchParams.get('code') || '').toUpperCase());
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState({ state: 'idle', message: '' });
  const [room, setRoom] = useState(null); // { livekit_token, ws_url, session_title }

  async function handleJoin(e) {
    e.preventDefault();
    if (!code.trim()) { setStatus({ state: 'error', message: 'Saisissez votre code.' }); return; }
    if (!displayName.trim()) { setStatus({ state: 'error', message: 'Indiquez votre nom (affiché dans la salle).' }); return; }
    setStatus({ state: 'submitting', message: '' });
    try {
      const res = await liveJoinApi.redeem({ code: code.trim().toUpperCase(), displayName: displayName.trim() });
      if (res?.livekit_token && res?.ws_url) {
        setRoom(res);
      } else {
        setStatus({ state: 'error', message: 'Réponse invalide du serveur.' });
      }
    } catch (err) {
      setStatus({ state: 'error', message: err?.message || 'Accès impossible.' });
    }
  }

  // Salle rejointe → plein écran LiveKit (viewer : le token interdit la publication).
  if (room) {
    return (
      <div className="h-[100dvh] w-full bg-black">
        <Helmet><title>{room.session_title || 'Live'}</title></Helmet>
        <LiveKitRoom
          serverUrl={room.ws_url}
          token={room.livekit_token}
          connect
          video={false}
          audio={false}
          options={getStableLiveKitRoomOptions({ adaptiveStream: true, dynacast: true })}
          connectOptions={stableLiveKitConnectOptions}
          style={{ height: '100dvh' }}
        >
          <VideoConference />
        </LiveKitRoom>
      </div>
    );
  }

  const inputCls =
    'w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-white placeholder-gray-500 focus:border-[#d97757] focus:outline-none';

  return (
    <div className="min-h-[100dvh] bg-[#262624] text-white" style={{ '--school-accent': '#d97757' }}>
      <Helmet><title>Rejoindre le live</title></Helmet>
      <main className="mx-auto w-full max-w-md px-5 py-12">
        <h1 className="text-[22px] font-bold text-[#f5f4ee]">Rejoindre le live</h1>
        <p className="mt-1 text-[13px] text-[#b0ada3]">
          Entrez le code communiqué par votre professeur pour rejoindre la classe en direct.
        </p>

        <form onSubmit={handleJoin} className="mt-7 flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#b0ada3]">Code du live</label>
            <input
              type="text"
              className={`${inputCls} font-mono tracking-[0.35em] uppercase text-center text-lg`}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
              placeholder="XXXXXX"
              maxLength={8}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#b0ada3]">Votre nom</label>
            <input
              type="text"
              className={inputCls}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex : Marie D."
              maxLength={60}
              required
            />
          </div>

          {status.state === 'error' && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {status.message}
            </div>
          )}

          <button
            type="submit"
            disabled={status.state === 'submitting'}
            className="w-full cursor-pointer rounded-md bg-[#d97757] px-5 py-3 font-semibold text-black hover:bg-[#c2683f] disabled:opacity-50"
          >
            {status.state === 'submitting' ? 'Connexion…' : 'Rejoindre'}
          </button>
        </form>
      </main>
    </div>
  );
}
