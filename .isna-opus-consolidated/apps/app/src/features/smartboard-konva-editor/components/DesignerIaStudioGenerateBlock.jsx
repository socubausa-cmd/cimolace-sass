/**
 * Génération d’images via Edge `generate-visual-image` + galerie `designer_ia_images`.
 * Même pipeline que l’onglet Import du designer (CanvaDesignPanel).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import {
  DESIGNER_IA_IMAGE_SIZES,
  fetchDesignerImageGallery,
  invokeGenerateVisualImage,
  pushLegacyLocalDesignerImage,
} from '../lib/designerIaImageHistory';
import { mkImageObject } from '../model/sceneModel';

const ENGINE_OPTIONS = [
  { value: 'auto', label: 'Auto (DALL·E si clé OpenAI, sinon Imagen Gemini)' },
  { value: 'gemini', label: 'Google Imagen (clé GEMINI / AI Studio)' },
  { value: 'dalle', label: 'OpenAI DALL·E 3 uniquement' },
];

export default function DesignerIaStudioGenerateBlock({ addObject, className }) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('1792x1024');
  const [engine, setEngine] = useState('auto');
  const [busy, setBusy] = useState(false);
  const [gallery, setGallery] = useState([]);

  const refresh = useCallback(async () => {
    const rows = await fetchDesignerImageGallery(supabase);
    setGallery(rows);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onGenerate = async () => {
    const p = prompt.trim();
    if (!p || busy) return;
    setBusy(true);
    try {
      const { data, error } = await invokeGenerateVisualImage(supabase, {
        prompt: p,
        size,
        provider: engine,
      });
      if (error) throw new Error(error.message || 'Edge function');
      const url = data?.imageUrl || data?.url;
      if (url) {
        if (!data?.persisted) {
          pushLegacyLocalDesignerImage({ url, prompt: p, size: data?.size || size });
        }
        void refresh();
        addObject(mkImageObject(url, { width: 480, height: 275, x: 120, y: 100 }));
      } else if (data?.error) {
        const msg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        console.error('IA image:', data.error);
        toast({
          variant: 'destructive',
          title: 'Génération IA',
          description: msg || 'Réponse sans image.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Génération IA',
          description: 'Aucune image dans la réponse du serveur.',
        });
      }
    } catch (e) {
      console.error('generate-visual-image', e);
      toast({
        variant: 'destructive',
        title: 'Génération IA',
        description: String(e?.message || e),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <div className="space-y-1.5 rounded-xl border border-violet-500/25 bg-violet-950/25 p-2.5">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-violet-300/80">
          IA visuelle (Supabase)
        </p>
        <p className="text-[10px] leading-snug text-white/40">
          Edge <code className="rounded bg-black/40 px-1 text-[9px]">generate-visual-image</code>
          {' '}— DALL·E 3, xAI en secours, ou{' '}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-300 underline decoration-violet-500/40 underline-offset-2 hover:text-violet-200"
          >
            Google AI Studio
          </a>
          {' '}(Imagen via <code className="rounded bg-black/40 px-1 text-[9px]">GEMINI_API_KEY</code>).
          {' '}Stockage <code className="rounded bg-black/40 px-1 text-[9px]">smartboard-canvas</code>, métadonnées{' '}
          <code className="rounded bg-black/40 px-1 text-[9px]">designer_ia_images</code>.
        </p>
        <label className="block text-[11px] text-white/45">
          Moteur
          <select
            value={engine}
            onChange={(e) => setEngine(e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-white/12 bg-black/50 py-1 text-[12px] text-white/85"
          >
            {ENGINE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ex. illustration pédagogique, schéma doré sur fond sombre…"
          className="w-full rounded-lg border border-white/12 bg-black/40 px-2 py-1.5 text-[12px] text-white placeholder-white/25"
        />
        <label className="block text-[11px] text-white/45">
          Format
          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-white/12 bg-black/50 py-1 text-[12px] text-white/85"
          >
            {DESIGNER_IA_IMAGE_SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy || !prompt.trim()}
          onClick={() => void onGenerate()}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet-400/35 bg-violet-900/35 py-2 text-[13px] font-medium text-violet-100 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Générer et placer sur le canvas
        </button>
        {gallery.length > 0 ? (
          <div className="border-t border-white/10 pt-2">
            <p className="mb-1 text-[11px] font-medium text-white/40">Galerie (clic = placer)</p>
            <div className="flex max-h-[min(75vh,900px)] flex-wrap gap-1 overflow-y-auto [scrollbar-width:thin]">
              {gallery.map((h) => (
                <button
                  key={h.id || h.url}
                  type="button"
                  title={h.prompt || 'Image'}
                  onClick={() => addObject(mkImageObject(h.url, { width: 480, height: 275, x: 140, y: 120 }))}
                  className="shrink-0 overflow-hidden rounded border border-white/10 hover:border-violet-400/45"
                >
                  <img src={h.url} alt="" className="h-11 w-16 object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
