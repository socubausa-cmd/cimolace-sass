import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Link, useSearchParams } from 'react-router-dom';
import { Headphones, Music, Trash2, Upload } from 'lucide-react';
import { AudioScenePanel, demoLiriAudioScenes } from '@/lib/liriAudioScene';
import ElementToolbar from '@/components/live-room/studio/ElementToolbar';
import SlideSidebar from '@/components/live-room/studio/SlideSidebar';
import SlideCanvas from '@/components/live-room/studio/SlideCanvas';
import SlideNavigator from '@/components/live-room/studio/SlideNavigator';
import AssetPicker from '@/components/live-room/studio/AssetPicker';
import { supabase } from '@/lib/customSupabaseClient';
import useTenantBranding from '@/hooks/useTenantBranding';

function mkId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

const baseSlide = () => ({
  id: mkId('slide'),
  title: 'Nouvelle scène',
  styleVariant: 'premium-dark',
  layoutType: 'free',
  backgroundMode: 'immersive-dark',
  elements: [
    { id: mkId('title'), type: 'title', content: 'Titre de scène', x: 48, y: 56, width: 520, height: 80, zIndex: 2, animation: 'fade-up' },
  ],
});

export default function StudioLiveImmersivePage() {
  const { user } = useAuth();
  const { branding, cssVars } = useTenantBranding();
  const [searchParams] = useSearchParams();
  const [recipientId, setRecipientId] = useState(searchParams.get('recipientId') || '');
  const [slides, setSlides] = useState([baseSlide()]);
  const [loadingSlides, setLoadingSlides] = useState(false);
  const [saveState, setSaveState] = useState('idle');
  const [index, setIndex] = useState(0);
  const [immersiveSessionId, setImmersiveSessionId] = useState(null);
  const [ambientTracks, setAmbientTracks] = useState([]);
  const [ambientSaving, setAmbientSaving] = useState(false);
  const [ambientMsg, setAmbientMsg] = useState('');

  const conversationKey = useMemo(() => {
    if (!user?.id || !recipientId) return '';
    const sorted = [user.id, recipientId].sort();
    return `dm:${sorted[0]}:${sorted[1]}`;
  }, [recipientId, user?.id]);

  const current = slides[index] || slides[0];

  const persist = useCallback(async (nextSlides) => {
    setSlides(nextSlides);
    if (!user?.id || !conversationKey) return;
    setSaveState('saving');
    const rows = nextSlides.map((slide, orderIndex) => ({
      conversation_key: conversationKey,
      order_index: orderIndex,
      title: slide.title || `Scène ${orderIndex + 1}`,
      style_variant: slide.styleVariant || 'premium-dark',
      layout_type: slide.layoutType || 'free',
      background_mode: slide.backgroundMode || 'immersive-dark',
      data_json: slide,
      created_by: user.id,
    }));

    const del = await supabase
      .from('immersive_live_slides')
      .delete()
      .eq('conversation_key', conversationKey)
      .eq('created_by', user.id);
    if (del.error) {
      setSaveState('error');
      return;
    }
    if (rows.length > 0) {
      const ins = await supabase.from('immersive_live_slides').insert(rows);
      if (ins.error) {
        setSaveState('error');
        return;
      }
    }
    setSaveState('saved');
  }, [conversationKey, user?.id]);

  useEffect(() => {
    if (!user?.id || !conversationKey) return;
    let cancelled = false;
    const loadSlides = async () => {
      setLoadingSlides(true);
      const { data, error } = await supabase
        .from('immersive_live_slides')
        .select('data_json, order_index')
        .eq('conversation_key', conversationKey)
        .eq('created_by', user.id)
        .order('order_index', { ascending: true });
      setLoadingSlides(false);
      if (cancelled) return;
      if (error || !data || data.length === 0) {
        setSlides([baseSlide()]);
        setIndex(0);
        return;
      }
      const loaded = data
        .map((row) => row.data_json)
        .filter(Boolean);
      setSlides(loaded.length > 0 ? loaded : [baseSlide()]);
      setIndex(0);
    };
    void loadSlides();
    return () => {
      cancelled = true;
    };
  }, [conversationKey, user?.id]);

  const loadAmbientSession = useCallback(async () => {
    if (!user?.id || !conversationKey) return;
    const { data: row } = await supabase
      .from('immersive_live_sessions')
      .select('id, ambient_tracks_json')
      .eq('conversation_key', conversationKey)
      .eq('host_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (row?.id) {
      setImmersiveSessionId(row.id);
      setAmbientTracks(Array.isArray(row.ambient_tracks_json) ? row.ambient_tracks_json : []);
      return;
    }
    setImmersiveSessionId(null);
    setAmbientTracks([]);
  }, [conversationKey, user?.id]);

  useEffect(() => {
    void loadAmbientSession();
  }, [loadAmbientSession]);

  const ensureAmbientSession = useCallback(async () => {
    if (!user?.id || !conversationKey) return null;
    const { data: row } = await supabase
      .from('immersive_live_sessions')
      .select('id')
      .eq('conversation_key', conversationKey)
      .eq('host_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (row?.id) return row.id;
    const { data: created, error } = await supabase
      .from('immersive_live_sessions')
      .insert({
        conversation_key: conversationKey,
        title: 'Préparation live immersif',
        host_user_id: user.id,
        guest_user_id: recipientId || null,
        status: 'pending',
      })
      .select('id')
      .single();
    if (error || !created?.id) {
      setAmbientMsg(error?.message || 'Impossible de créer la session (RLS / invité requis).');
      return null;
    }
    return created.id;
  }, [conversationKey, recipientId, user?.id]);

  const persistAmbient = useCallback(
    async (nextTracks) => {
      setAmbientSaving(true);
      setAmbientMsg('');
      const sid = immersiveSessionId || (await ensureAmbientSession());
      if (!sid) {
        setAmbientSaving(false);
        return;
      }
      setImmersiveSessionId(sid);
      const { error } = await supabase.from('immersive_live_sessions').update({ ambient_tracks_json: nextTracks }).eq('id', sid);
      setAmbientSaving(false);
      if (error) {
        setAmbientMsg(error.message);
        return;
      }
      setAmbientTracks(nextTracks);
    },
    [ensureAmbientSession, immersiveSessionId],
  );

  const handleAmbientUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user?.id) return;
    if (!file.type.startsWith('audio/')) {
      setAmbientMsg('Choisis un fichier audio (MP3, etc.).');
      return;
    }
    const bucket = import.meta.env.VITE_SUPABASE_LIVE_RECORDINGS_BUCKET || 'live-recordings';
    const path = `ambient/${user.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
    setAmbientSaving(true);
    setAmbientMsg('');
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type || 'audio/mpeg',
      upsert: true,
    });
    if (upErr) {
      setAmbientSaving(false);
      setAmbientMsg(upErr.message);
      return;
    }
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    const url = pub?.publicUrl;
    if (!url) {
      setAmbientSaving(false);
      setAmbientMsg("URL publique indisponible — vérifie que le bucket autorise l'accès lecture.");
      return;
    }
    const label = file.name.replace(/\.[^.]+$/, '');
    const next = [...ambientTracks, { url, label, volume: 0.35 }];
    await persistAmbient(next);
  };

  const removeAmbient = async (idx) => {
    const next = ambientTracks.filter((_, i) => i !== idx);
    await persistAmbient(next);
  };

  const addElement = (type) => {
    const next = [...slides];
    const target = next[index];
    if (!target) return;
    target.elements = [
      ...target.elements,
      {
        id: mkId(type),
        type,
        content: type === 'title' ? 'Nouveau titre' : type === 'paragraph' ? 'Texte descriptif...' : type === 'quote' ? 'Citation...' : 'Élément',
        x: 72,
        y: 132 + target.elements.length * 54,
        width: type === 'image' ? 320 : 420,
        height: type === 'image' ? 220 : 80,
        zIndex: 2 + target.elements.length,
        animation: 'fade',
      },
    ];
    void persist(next);
  };

  const addSlide = () => {
    const next = [...slides, baseSlide()];
    void persist(next);
    setIndex(next.length - 1);
  };

  const addImage = (src) => {
    const next = [...slides];
    const target = next[index];
    if (!target) return;
    target.elements = [
      ...target.elements,
      { id: mkId('img'), type: 'image', src, x: 560, y: 86, width: 300, height: 220, zIndex: 5, animation: 'spotlight' },
    ];
    void persist(next);
  };

  return (
    <div
      className="min-h-[calc(100dvh-5rem)] text-white p-4 md:p-6"
      data-school-shell="studio-live-immersive"
      data-tenant-brand={branding.slug}
      style={{
        ...cssVars,
        background: 'var(--school-background, #090D14)',
        fontFamily: 'var(--school-font-family, Inter, sans-serif)',
      }}
    >
      <div className="max-w-[1400px] mx-auto space-y-4">
        <div className="rounded-2xl border border-white/10 bg-[#0d1420]/75 backdrop-blur-xl px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div>
            <p className="text-xs text-gray-400">Studio Live Immersif</p>
            <h1 className="text-sm md:text-base font-semibold">Constructeur de scènes immersives</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {loadingSlides ? 'Chargement...' : saveState === 'saving' ? 'Enregistrement...' : saveState === 'saved' ? 'Enregistré sur Supabase' : saveState === 'error' ? 'Erreur de sauvegarde' : 'Prêt'}
            </p>
          </div>
          <div className="inline-flex flex-wrap items-center gap-2">
            <Link
              to="/studio/live-preparation"
              className="h-9 inline-flex items-center rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 text-[11px] font-medium text-amber-200 hover:bg-amber-500/15"
            >
              Studio production (blueprint)
            </Link>
            <input
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              placeholder="ID interlocuteur (optionnel)"
              className="h-9 w-52 rounded-xl bg-black/25 border border-white/10 px-3 text-xs outline-none focus:border-[color:var(--school-accent,#D4AF37)]"
            />
            <SlideNavigator
              index={index}
              total={slides.length}
              onPrev={() => setIndex((i) => Math.max(0, i - 1))}
              onNext={() => setIndex((i) => Math.min(slides.length - 1, i + 1))}
              onAdd={addSlide}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <ElementToolbar onAdd={addElement} />
          <AssetPicker onPick={addImage} />
        </div>

        <div className="rounded-2xl border border-violet-500/25 bg-[#0d1420]/80 px-4 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-violet-300" />
            <div>
              <p className="text-xs font-semibold text-white/90">Atmosphère de salle (MP3)</p>
              <p className="text-[11px] text-white/45">
                Fonds sonores joués en arrière-plan pendant le live (volume bas). Stockés sur la session immersive — même flux que
                le SmartBoard.
              </p>
            </div>
          </div>
          {!conversationKey ? (
            <p className="text-xs text-amber-200/80">Renseigne l'ID interlocuteur pour lier la conversation.</p>
          ) : (
            <>
              <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/80 cursor-pointer hover:bg-white/5">
                <Upload className="w-3.5 h-3.5" />
                Ajouter un MP3
                <input type="file" accept="audio/*,.mp3,audio/mpeg" className="hidden" onChange={(e) => void handleAmbientUpload(e)} />
              </label>
              {ambientSaving ? <p className="text-[11px] text-white/50">Enregistrement…</p> : null}
              {ambientMsg ? <p className="text-[11px] text-red-400">{ambientMsg}</p> : null}
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {ambientTracks.map((t, i) => (
                  <li key={`${t.url}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[11px]">
                    <span className="truncate text-white/85">{t.label || 'Piste'}</span>
                    <button type="button" onClick={() => void removeAmbient(i)} className="text-white/40 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div
          className="rounded-2xl border px-4 py-4 space-y-3"
          style={{
            background: 'var(--school-shell-panel, rgba(13, 20, 32, 0.8))',
            borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 20%, transparent)',
            borderRadius: 'var(--school-radius, 1rem)',
          }}
        >
          <div className="flex items-center gap-2">
            <Headphones className="w-4 h-4 text-[var(--school-accent,#D4AF37)]" />
            <div>
              <p className="text-xs font-semibold text-white/90">Moteur audio scènes (LIRI)</p>
              <p className="text-[11px] text-white/45">
                Web Audio API — crossfade, ducking, événements SmartBoard. Démo avec pistes Pixabay ; à brancher sur vos scènes
                rituel / cours.
              </p>
            </div>
          </div>
          <AudioScenePanel scenes={demoLiriAudioScenes} />
        </div>

        <div className="flex gap-4 min-h-[560px]">
          <SlideSidebar slides={slides} activeIndex={index} onSelect={setIndex} />
          <SlideCanvas slide={current} />
        </div>
      </div>
    </div>
  );
}
