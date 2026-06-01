"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ───────── TYPES ───────── */
type Recording = {
  id: string;
  zoom_meeting_number: number;
  topic: string;
  agenda: string | null;
  start_time: string | null;
  duration_min: number;
  status: string;
  is_published: boolean;
  category: string | null;
  tags: string[] | null;
  thumbnail_url: string | null;
  playback_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type SyncLog = {
  id: string;
  status: string;
  recordings_found: number;
  recordings_new: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4002";

export default function ZoomAdminPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"recordings" | "sync" | "publish">("recordings");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Auth : récupérer le token JWT depuis le localStorage (admin app)
  useEffect(() => {
    const token = localStorage.getItem("sb-access-token") || localStorage.getItem("supabase.auth.token");
    if (token) {
      setAuthToken(token);
    }
  }, []);

  const headers = useCallback(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (authToken) h["Authorization"] = `Bearer ${authToken}`;
    return h;
  }, [authToken]);

  const api = useCallback(async (path: string, options?: RequestInit) => {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...headers(), ...options?.headers },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  }, [headers]);

  // Charger les données
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [recData, logsData, authData] = await Promise.all([
        api("/zoom-engine/recordings?limit=50").catch(() => ({ data: [], total: 0 })),
        api("/zoom-engine/sync-logs?limit=5").catch(() => []),
        api("/zoom-engine/auth/status").catch(() => ({ connected: false })),
      ]);
      setRecordings(recData.data || []);
      setTotal(recData.total || 0);
      setSyncLogs(Array.isArray(logsData) ? logsData : []);
      setConnected(authData.connected || false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { if (authToken) loadData(); }, [authToken, loadData]);

  // Sync
  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const result = await api("/zoom-engine/sync", {
        method: "POST",
        body: JSON.stringify({ days: 30 }),
      });
      setMessage({ type: "success", text: `${result.found} enregistrement(s) trouvé(s), ${result.new} nouveau(x)` });
      await loadData();
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    } finally {
      setSyncing(false);
    }
  };

  // Publier une vidéo
  const handlePublish = async (recordingId: string) => {
    setMessage(null);
    try {
      await api("/zoom-engine/publish", {
        method: "POST",
        body: JSON.stringify({ recording_id: recordingId }),
      });
      setMessage({ type: "success", text: "Vidéo publiée sur le site public ✅" });
      await loadData();
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    }
  };

  // Connecter Zoom
  const handleConnect = async () => {
    try {
      const data = await api("/zoom-engine/auth/url");
      window.open(data.url, "_blank", "width=600,height=700");
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    }
  };

  if (!authToken) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center mb-6">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <h1 className="text-2xl font-light text-white mb-3">Accès restreint</h1>
          <p className="text-white/40 text-sm mb-8">
            Connectez-vous d&apos;abord à l&apos;interface d&apos;administration pour accéder à ce tableau de bord.
          </p>
          <a href="/login" className="inline-flex bg-amber-500/10 border border-amber-500/20 text-amber-300 px-6 py-3 rounded-full text-sm hover:bg-amber-500/20 transition-all">
            Se connecter
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-light tracking-wide">
              <span className="text-amber-400/70">✦</span> Zoom Engine
            </h1>
            <span className={`text-xs px-2 py-1 rounded-full ${connected ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
              {connected ? "Connecté" : "Déconnecté"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {!connected && (
              <button onClick={handleConnect} className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-300 px-4 py-2 rounded-full hover:bg-blue-500/20 transition-all">
                + Connecter Zoom
              </button>
            )}
            <button onClick={loadData} className="text-white/30 hover:text-white/60 p-2" title="Rafraîchir">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
              </svg>
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6 flex gap-6 text-sm">
          {(["recordings", "sync", "publish"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 border-b-2 transition-all ${tab === t ? "border-amber-400/50 text-amber-200" : "border-transparent text-white/30 hover:text-white/50"}`}
            >
              {t === "recordings" && "Enregistrements"}
              {t === "sync" && "Synchronisation"}
              {t === "publish" && "Publication"}
            </button>
          ))}
        </div>
      </header>

      {/* Messages */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={`text-sm px-6 py-3 ${message.type === "success" ? "bg-green-500/5 text-green-300" : "bg-red-500/5 text-red-300"}`}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Onglet Recordings */}
        {tab === "recordings" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <p className="text-white/30 text-sm">{total} enregistrement(s)</p>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 px-5 py-2 rounded-full hover:bg-amber-500/20 disabled:opacity-50 transition-all"
              >
                {syncing ? "Sync en cours..." : "Synchroniser"}
              </button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : recordings.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-white/20 text-lg font-light">Aucun enregistrement</p>
                <p className="text-white/10 text-sm mt-2">Connectez votre compte Zoom et lancez une synchronisation.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recordings.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center gap-4 bg-white/[0.02] border border-white/5 rounded-xl p-4 hover:bg-white/[0.04] transition-colors"
                  >
                    {/* Thumbnail */}
                    <div className="w-24 h-14 rounded-lg bg-zinc-900 flex-shrink-0 overflow-hidden">
                      {rec.thumbnail_url ? (
                        <img src={rec.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/10">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{rec.topic}</p>
                      <div className="flex items-center gap-3 text-xs text-white/30 mt-1">
                        {rec.duration_min && <span>{rec.duration_min} min</span>}
                        {rec.start_time && <span>{new Date(rec.start_time).toLocaleDateString("fr-FR")}</span>}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                          rec.status === "downloaded" ? "bg-blue-500/10 text-blue-300" :
                          rec.status === "published" ? "bg-green-500/10 text-green-300" :
                          rec.status === "error" ? "bg-red-500/10 text-red-300" :
                          "bg-white/5 text-white/30"
                        }`}>
                          {rec.status}
                        </span>
                        {rec.category && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/5 text-amber-400/60 text-[10px]">
                            {rec.category}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {rec.playback_url && (
                        <a
                          href={rec.playback_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white/30 hover:text-white/60 p-2 transition-colors"
                          title="Voir"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                          </svg>
                        </a>
                      )}
                      {!rec.is_published && rec.playback_url && (
                        <button
                          onClick={() => handlePublish(rec.id)}
                          className="text-xs text-amber-400/50 hover:text-amber-300 px-3 py-1.5 rounded-full hover:bg-amber-500/10 transition-all"
                        >
                          Publier
                        </button>
                      )}
                      {rec.is_published && (
                        <span className="text-xs text-green-500/50">Publiée</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Onglet Synchronisation */}
        {tab === "sync" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-light text-white/70">Historique des synchronisations</h2>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 px-5 py-2 rounded-full hover:bg-amber-500/20 disabled:opacity-50 transition-all"
              >
                {syncing ? "Sync en cours..." : "Lancer une sync"}
              </button>
            </div>

            {syncLogs.length === 0 ? (
              <p className="text-white/20 text-center py-12">Aucune synchronisation effectuée</p>
            ) : (
              <div className="space-y-2">
                {syncLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-xl p-4">
                    <div className="flex items-center gap-4">
                      <span className={`w-2 h-2 rounded-full ${
                        log.status === "success" ? "bg-green-500" :
                        log.status === "error" ? "bg-red-500" : "bg-yellow-500"
                      }`} />
                      <div>
                        <p className="text-sm text-white/70">
                          {log.recordings_found} trouvée(s) · {log.recordings_new} nouvelle(s)
                        </p>
                        <p className="text-xs text-white/20 mt-0.5">
                          {new Date(log.started_at).toLocaleString("fr-FR")}
                          {log.completed_at && ` · ${Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)}s`}
                        </p>
                      </div>
                    </div>
                    {log.error_message && (
                      <p className="text-xs text-red-400/70 max-w-xs truncate">{log.error_message}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Onglet Publication */}
        {tab === "publish" && (
          <div>
            <h2 className="text-lg font-light text-white/70 mb-4">Publication sur le site public</h2>
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-8 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.5">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <p className="text-white/60 text-sm mb-2">
                Les vidéos publiées apparaissent sur la page publique.
              </p>
              <p className="text-white/20 text-xs">
                Allez dans l&apos;onglet "Enregistrements" et cliquez "Publier" sur une vidéo téléchargée.
              </p>
              <a
                href="/youtube"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-6 text-xs text-amber-400/50 hover:text-amber-300 px-5 py-2 rounded-full border border-amber-500/20 hover:bg-amber-500/10 transition-all"
              >
                Voir le site public →
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
