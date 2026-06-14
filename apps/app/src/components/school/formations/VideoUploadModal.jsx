import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { getSupabaseFunctionErrorMessage } from '@/lib/supabaseEdgeInvoke';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Video, Upload, Check, Play, Pause, Volume2, Loader2, Sparkles, Camera, Smartphone, ChevronLeft, Wifi, AlertCircle } from 'lucide-react';
import CaptureStudioModal from './CaptureStudioModal';
import CaptureSourceManager from './CaptureSourceManager';

// ─── PhoneCapturePanel — QR code + WebRTC/upload from phone ─────────────────
function PhoneCapturePanel({ onBack, onVideoReady }) {
  const sessionId = React.useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  ).current;
  const [mode, setMode] = React.useState(null); // null | 'upload' | 'stream'
  const [waitingFor, setWaitingFor] = React.useState(false);
  const [received, setReceived] = React.useState(null);
  const [error, setError] = React.useState('');

  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}/companion-capture` : '/companion-capture';
  const uploadUrl = `${baseUrl}?session=${sessionId}&mode=upload`;
  const streamUrl = `${baseUrl}?session=${sessionId}&mode=stream`;
  const qrUrl = (url) => `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}&color=D4AF37&bgcolor=070d18`;

  // Listen for phone signals via Supabase Realtime
  React.useEffect(() => {
    if (!mode) return;
    setWaitingFor(true);
    const channel = supabase.channel(`capture-signal-${sessionId}`, { config: { broadcast: { self: false } } });
    channel.on('broadcast', { event: 'phone-upload-ready' }, ({ payload }) => {
      setReceived(payload);
      setWaitingFor(false);
      onVideoReady?.({
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
        title: 'Vidéo téléphone',
        description: '',
        type: 'upload',
        url: payload.url,
        storagePath: payload.path,
        duration: 5,
      });
    });
    channel.on('broadcast', { event: 'phone-ready' }, () => setWaitingFor(false));
    channel.subscribe();
    return () => { channel.unsubscribe(); };
  }, [mode, sessionId, onVideoReady]);

  if (!mode) {
    return (
      <div className="space-y-5">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" /> Retour aux sources
        </button>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-white flex items-center justify-center gap-2"><Smartphone className="w-4 h-4 text-[#D4AF37]" /> Caméra téléphone</p>
          <p className="text-xs text-gray-500">Scanne le QR code sur ton téléphone pour utiliser sa caméra</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setMode('upload')} className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 hover:border-[#D4AF37]/40 bg-white/2 hover:bg-[#D4AF37]/5 p-5 transition-all">
            <Upload className="w-8 h-8 text-[#D4AF37]" />
            <div className="text-center">
              <p className="text-xs font-semibold text-white">Filmer et envoyer</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Le téléphone filme, puis envoie la vidéo</p>
            </div>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-semibold">Simple + Fiable</span>
          </button>
          <button type="button" onClick={() => setMode('stream')} className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 hover:border-blue-500/40 bg-white/2 hover:bg-blue-500/5 p-5 transition-all">
            <Wifi className="w-8 h-8 text-blue-400" />
            <div className="text-center">
              <p className="text-xs font-semibold text-white">Flux en direct</p>
              <p className="text-[10px] text-gray-500 mt-0.5">WebRTC — stream live du téléphone au PC</p>
            </div>
            <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-semibold">Live</span>
          </button>
        </div>
      </div>
    );
  }

  const chosenUrl = mode === 'upload' ? uploadUrl : streamUrl;
  return (
    <div className="space-y-4">
      <button type="button" onClick={() => setMode(null)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" /> Choisir un autre mode
      </button>
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-white">{mode === 'upload' ? '📤 Filmer et envoyer' : '📡 Flux en direct'}</p>
        <p className="text-xs text-gray-500">Scanne ce QR code avec ton téléphone</p>
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-2xl border border-[#D4AF37]/30 p-3 bg-[#D4AF37]/5">
          <img src={qrUrl(chosenUrl)} alt="QR Code" className="w-48 h-48 rounded-xl" />
        </div>
        <p className="text-[10px] text-gray-600 text-center max-w-xs break-all">{chosenUrl}</p>
        {received ? (
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
            <Check className="w-5 h-5" /> Vidéo reçue — ajoutée au studio !
          </div>
        ) : waitingFor ? (
          <div className="flex items-center gap-2 text-blue-400 text-xs">
            <Loader2 className="w-4 h-4 animate-spin" /> En attente du téléphone…
          </div>
        ) : (
          <p className="text-xs text-gray-500">En attente de connexion…</p>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}

const VideoUploadModal = ({ isOpen, onClose, onSave }) => {
  const [creationMode, setCreationMode] = useState(null); // null | 'upload' | 'capture' | 'phone'
  const [captureSource, setCaptureSource] = useState('webcam');
  const [captureStudioOpen, setCaptureStudioOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('link');
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDone, setUploadDone] = useState(false);
  const [reformulateLoading, setReformulateLoading] = useState(false);
  const [data, setData] = useState({
    title: '',
    description: '',
    type: 'youtube', // youtube, vimeo, custom_url, file
    url: '',
    duration: 15
  });

  const newUuid = () => {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
    } catch {
      // ignore
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  // Preview Controls
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState([80]);
  const [progress, setProgress] = useState(0);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);

  const formatSecondsToTimeText = (seconds) => {
    const s = Number(seconds);
    if (!Number.isFinite(s) || s < 0) return '0:00';
    const mm = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${mm}:${String(ss).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (isOpen) {
      setCreationMode(null);
      setCaptureSource('webcam');
      setCaptureStudioOpen(false);
      setActiveTab('link');
      setLoading(false);
      setPreviewUrl('');
      setError('');
      setUploadProgress(0);
      setUploadDone(false);
      setData(prev => ({ ...prev, type: 'youtube', url: '' }));
      setIsPlaying(false);
      setProgress(0);
      setPreviewCurrentTime(0);
      setPreviewDuration(0);
    }
  }, [isOpen]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError('');
    setLoading(true);
    setUploadProgress(0);
    setUploadDone(false);
    try {
      const MAX_MB = 25;
      if (file.size > MAX_MB * 1024 * 1024) {
        throw new Error(`Vidéo trop grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite : ${MAX_MB} MB. Utilise une vidéo plus courte.`);
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase env manquant: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
      }

      const safeName = (file.name || 'video')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9._-]/g, '');
      const path = `uploads/${Date.now()}-${safeName}`;

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error('Session manquante. Connecte-toi avant de téléverser.');
      }

      const { data: publicData } = supabase.storage.from('videos').getPublicUrl(path);
      const publicUrl = publicData?.publicUrl || '';

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/videos/${encodeURIComponent(path).replace(/%2F/g, '/')}`);
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        xhr.setRequestHeader('apikey', supabaseAnonKey);
        xhr.setRequestHeader('x-upsert', 'false');
        if (file.type) xhr.setRequestHeader('content-type', file.type);

        xhr.upload.onprogress = (ev) => {
          if (!ev.lengthComputable) return;
          const pct = Math.round((ev.loaded / ev.total) * 100);
          setUploadProgress(pct);
        };

        xhr.onerror = () => reject(new Error('Erreur réseau pendant le téléversement'));
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else {
            reject(new Error(xhr.responseText || `Upload échoué (${xhr.status})`));
          }
        };

        xhr.send(file);
      });

      if (!publicUrl) {
        throw new Error("URL publique introuvable. Vérifie que le bucket 'videos' est public.");
      }

      setData((prev) => ({
        ...prev,
        type: 'upload',
        url: publicUrl,
        storagePath: path,
        title: prev.title || file.name,
      }));
      setPreviewUrl(publicUrl);
      setUploadProgress(100);
      setUploadDone(true);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const normalizeUrlForSave = () => {
    if (!data.url) return '';
    if (data.type === 'youtube') {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = data.url.match(regExp);
      if (match && match[2] && match[2].length === 11) {
        return `https://www.youtube.com/embed/${match[2]}`;
      }
      return data.url;
    }
    if (data.type === 'vimeo') {
      const regExp = /vimeo\.com\/(\d+)/;
      const match = data.url.match(regExp);
      if (match && match[1]) {
        return `https://player.vimeo.com/video/${match[1]}`;
      }
      return data.url;
    }
    return data.url;
  };

  const loadPreview = () => {
    if (!data.url) return;
    setLoading(true);
    
    let url = data.url;
    if (data.type === 'youtube') {
      // Extract ID and standardise
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = data.url.match(regExp);
      if (match && match[2].length === 11) {
        url = `https://www.youtube.com/embed/${match[2]}`;
      }
    } else if (data.type === 'vimeo') {
       // Simple Vimeo ID extraction
       const regExp = /vimeo\.com\/(\d+)/;
       const match = data.url.match(regExp);
       if (match) {
         url = `https://player.vimeo.com/video/${match[1]}`;
       }
    }

    setPreviewUrl(url);
    // Simulate duration detection
    setTimeout(() => {
       setLoading(false);
       if (data.duration === 15) { // Only update if default
          setData(prev => ({ ...prev, duration: Math.floor(Math.random() * 20) + 5 }));
       }
    }, 500);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const seekPreviewToSeconds = (seconds) => {
    if (!videoRef.current) return;
    const d = Number(videoRef.current.duration || previewDuration || 0);
    const next = Math.max(0, Math.min(Number(seconds) || 0, Number.isFinite(d) && d > 0 ? d : Number.MAX_SAFE_INTEGER));
    try {
      videoRef.current.currentTime = next;
      setPreviewCurrentTime(next);
    } catch {
      // ignore
    }
  };


  const handleReformulate = async (field) => {
    const text = data[field];
    if (!text || !text.trim()) return;
    setReformulateLoading(field);
    try {
      const { data, error } = await supabase.functions.invoke('reformulate-text', {
        body: { text, context: field },
      });
      if (error) throw new Error(await getSupabaseFunctionErrorMessage(error));
      if (data?.result) {
        setData((prev) => ({ ...prev, [field]: data.result }));
      }
    } catch {
      // silent fail — keep original text
    } finally {
      setReformulateLoading(false);
    }
  };

  const handleSave = () => {
    const normalized = normalizeUrlForSave();

    onSave({
       ...data,
       url: previewUrl || normalized || data.url,
       id: data?.id || newUuid()
    });
    onClose();
  };

  return (
    <>
    <CaptureStudioModal
      open={captureStudioOpen}
      source={captureSource}
      onClose={() => { setCaptureStudioOpen(false); setCreationMode(null); }}
      initialTitle={data.title}
      onVideoReady={(videoData) => {
        setData((prev) => ({ ...prev, ...videoData }));
        setPreviewUrl(videoData.url);
        setUploadDone(true);
        setCaptureStudioOpen(false);
        setCreationMode('upload');
      }}
    />
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#192734] border-white/10 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#D4AF37]"><Video className="w-5 h-5"/> Ajouter une vidéo</DialogTitle>
        </DialogHeader>

        {/* ── Mode selector ── */}
        {!creationMode && (
          <div className="py-2">
            <CaptureSourceManager
              onSelectSource={(sourceId) => {
                if (sourceId === 'upload') {
                  setCreationMode('upload');
                } else if (sourceId === 'phone') {
                  setCreationMode('phone');
                } else if (['webcam', 'screen', 'external'].includes(sourceId)) {
                  setCaptureSource(sourceId);
                  setCreationMode('capture');
                  setCaptureStudioOpen(true);
                }
              }}
            />
          </div>
        )}

        {creationMode === 'phone' && (
          <div className="py-4">
            <PhoneCapturePanel
              onBack={() => setCreationMode(null)}
              onVideoReady={(videoMeta) => {
                setData({ ...data, ...videoMeta });
                setCreationMode('upload');
              }}
            />
          </div>
        )}

        {creationMode === 'upload' && <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {/* Left Column: Inputs */}
           <div className="space-y-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-[#0F1419] border border-white/10 w-full grid grid-cols-2">
                  <TabsTrigger value="link" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">Lien Externe</TabsTrigger>
                  <TabsTrigger value="upload" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">Téléverser Fichier</TabsTrigger>
                </TabsList>

                <div className="mt-6 space-y-4">
                  <div className="space-y-2">
                     <Label>Titre de la vidéo</Label>
                     <Input value={data.title} onChange={e => setData({...data, title: e.target.value})} className="bg-[#0F1419] border-white/10" placeholder="Ex: Introduction au module..." />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Description générale</Label>
                      {data.description?.trim() && (
                        <button
                          type="button"
                          onClick={() => handleReformulate('description')}
                          disabled={reformulateLoading === 'description'}
                          className="flex items-center gap-1.5 text-xs text-[#D4AF37] hover:text-amber-400 disabled:opacity-50 transition-colors"
                          title="Reformuler avec l'IA"
                        >
                          {reformulateLoading === 'description'
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Sparkles className="w-3.5 h-3.5" />}
                          Reformuler avec l'IA
                        </button>
                      )}
                    </div>
                    <Textarea
                      value={data.description}
                      onChange={(e) => setData({ ...data, description: e.target.value })}
                      className="bg-[#0F1419] border-white/10 h-28"
                      placeholder="Décris brièvement l'objectif de cette vidéo..."
                    />
                  </div>
                  
                  <TabsContent value="link" className="space-y-4 mt-0">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <Label>Plateforme</Label>
                           <Select value={data.type} onValueChange={v => setData({...data, type: v})}>
                              <SelectTrigger className="bg-[#0F1419] border-white/10"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="youtube">YouTube</SelectItem>
                                 <SelectItem value="vimeo">Vimeo</SelectItem>
                                 <SelectItem value="custom_url">Autre URL</SelectItem>
                              </SelectContent>
                           </Select>
                        </div>
                        <div className="space-y-2">
                           <Label>Durée (min)</Label>
                           <Input type="number" value={data.duration} onChange={e => setData({...data, duration: parseInt(e.target.value)})} className="bg-[#0F1419] border-white/10" />
                        </div>
                     </div>
                     <div className="space-y-2">
                        <Label>Lien URL</Label>
                        <div className="flex gap-2">
                           <Input value={data.url} onChange={e => setData({...data, url: e.target.value})} placeholder="https://..." className="bg-[#0F1419] border-white/10" />
                           <Button onClick={loadPreview} className="bg-white/10 hover:bg-white/20 text-white" disabled={!data.url}>
                              {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Aperçu'}
                           </Button>
                        </div>
                     </div>
                  </TabsContent>

                  <TabsContent value="upload" className="space-y-4 mt-0">
                     <div className="border-2 border-dashed border-white/10 rounded-lg p-8 text-center bg-[#0F1419] hover:bg-white/5 transition-colors cursor-pointer relative group">
                        <input type="file" accept="video/mp4,video/webm,video/ogg" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                        <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2 group-hover:text-[#D4AF37] transition-colors"/>
                        <p className="text-sm text-gray-400">Cliquez pour sélectionner un fichier (MP4, WebM)</p>
                        {(data.type === 'upload' || data.type === 'file') && <p className="text-[#D4AF37] mt-2 font-bold"><Check className="inline w-4 h-4 mr-1"/> {data.title}</p>}
                        {loading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg"><Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin"/></div>}
                     </div>

                     {(loading || uploadProgress > 0) ? (
                       <div className="space-y-2">
                         <div className="flex items-center justify-between text-xs text-gray-400">
                           <span>Téléversement</span>
                           <span>{uploadProgress}%</span>
                         </div>
                         <div className="h-2 bg-white/10 rounded overflow-hidden">
                           <div className="h-full bg-[#D4AF37] transition-all" style={{ width: `${uploadProgress}%` }} />
                         </div>
                       </div>
                     ) : null}

                     {uploadDone && !error ? (
                       <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-sm text-green-200">
                         <span className="flex items-center gap-2"><Check className="w-4 h-4" /> Vidéo chargée</span>
                       </div>
                     ) : null}

                     {error ? (
                       <div className="text-sm text-red-300 border border-red-500/30 bg-red-500/10 rounded p-3">{error}</div>
                     ) : null}
                  </TabsContent>
                </div>
              </Tabs>
           </div>

           {/* Right Column: Preview */}
           <div className="space-y-4">
              <Label className="text-[#D4AF37]">Aperçu Vidéo</Label>
              <div className="aspect-video bg-black rounded-lg overflow-hidden border border-white/10 relative flex items-center justify-center group">
                 {!previewUrl ? (
                   <div className="text-gray-500 flex flex-col items-center">
                     <Video className="w-12 h-12 mb-2 opacity-20" />
                     <p className="text-sm">L'aperçu apparaîtra ici</p>
                   </div>
                 ) : (data.type === 'file' || data.type === 'upload') ? (
                   <>
                     <video
                       ref={videoRef}
                       src={previewUrl}
                       className="w-full h-full"
                       onLoadedMetadata={(e) => {
                         const d = Number(e?.target?.duration || 0);
                         setPreviewDuration(Number.isFinite(d) ? d : 0);
                       }}
                       onTimeUpdate={(e) => {
                         const t = Number(e?.target?.currentTime || 0);
                         const d = Number(e?.target?.duration || 0);
                         setPreviewCurrentTime(Number.isFinite(t) ? t : 0);
                         setPreviewDuration(Number.isFinite(d) ? d : 0);
                         setProgress(d ? (t / d) * 100 : 0);
                       }}
                       onPlay={() => setIsPlaying(true)}
                       onPause={() => setIsPlaying(false)}
                     />
                     <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-4">
                       <Button size="icon" variant="ghost" className="text-white hover:text-[#D4AF37]" onClick={togglePlay}>
                         {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                       </Button>
                       <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                         <div className="h-full bg-[#D4AF37]" style={{ width: `${progress}%` }} />
                       </div>
                       <div className="text-[10px] text-gray-300 w-20 text-right">{formatSecondsToTimeText(previewCurrentTime)}</div>
                       <div className="flex items-center gap-2 w-24">
                         <Volume2 className="w-4 h-4 text-white" />
                         <Slider
                           value={volume}
                           max={100}
                           step={1}
                           onValueChange={(v) => {
                             setVolume(v);
                             if (videoRef.current) videoRef.current.volume = v[0] / 100;
                           }}
                           className="w-full"
                         />
                       </div>
                     </div>
                   </>
                 ) : (
                   <iframe
                     src={previewUrl}
                     title="Preview"
                     className="w-full h-full"
                     allowFullScreen
                     allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                   />
                 )}
              </div>

              {(previewUrl && (data.type === 'file' || data.type === 'upload')) ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Navigation</span>
                    <span>
                      {formatSecondsToTimeText(previewCurrentTime)} / {formatSecondsToTimeText(previewDuration)}
                    </span>
                  </div>
                  <Slider
                    value={[previewDuration ? (previewCurrentTime / previewDuration) * 100 : 0]}
                    max={100}
                    step={0.1}
                    onValueChange={(v) => {
                      const pct = Array.isArray(v) ? v[0] : 0;
                      const next = previewDuration ? (pct / 100) * previewDuration : 0;
                      seekPreviewToSeconds(next);
                    }}
                  />
                </div>
              ) : null}

              {previewUrl ? (
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-200">
                  <p className="flex items-center gap-2"><Check className="w-4 h-4"/> Vidéo chargée avec succès</p>
                  <p className="text-xs opacity-70 mt-1">N'oubliez pas de vérifier le son et la qualité.</p>
                </div>
              ) : null}
           </div>
        </div>}

        {creationMode === 'upload' && (
        <DialogFooter className="mt-6 border-t border-white/10 pt-4">
          <Button variant="ghost" onClick={onClose} className="text-white hover:bg-white/10">Annuler</Button>
          <Button onClick={handleSave} disabled={!data.title || (!previewUrl && !data.url)} className="bg-[#D4AF37] text-black hover:bg-yellow-500 font-bold">
            Ajouter la vidéo
          </Button>
        </DialogFooter>
        )}

        {!creationMode && (
          <div className="flex justify-end pt-2 border-t border-white/10">
            <Button variant="ghost" onClick={onClose} className="text-gray-400 hover:text-white">Annuler</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
    );
};

export default VideoUploadModal;