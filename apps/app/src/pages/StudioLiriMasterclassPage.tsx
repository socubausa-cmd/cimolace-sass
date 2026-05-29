/**
 * StudioLiriMasterclassPage — Masterclass Factory
 * Route: /studio/liri/masterclass
 * Interface de génération IA 21/26 segments
 * V2 port from isna_app V1
 */
import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, FileText, ArrowLeft, Loader2, CheckCircle2,
  BookOpen, Brain, Layers, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { useTenantBranding } from '@/hooks/useTenantBranding';

const MODELS = [
  { id: 'liri-v1', label: 'LIRI 21 Segments', desc: 'Modèle pédagogique classique — 21 segments par chapitre', segments: 21 },
  { id: 'failure-v2', label: 'Échec Productif 26', desc: 'Apprentissage par l\'échec — 26 segments par chapitre', segments: 26 },
];

export default function StudioLiriMasterclassPage() {
  const { branding, cssVars, shellTheme } = useTenantBranding();
  const [sourceText, setSourceText] = useState('');
  const [model, setModel] = useState('liri-v1');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'input' | 'generating' | 'done'>('input');

  const handleGenerate = useCallback(async () => {
    if (!sourceText.trim()) { setError('Saisissez un texte source'); return; }
    setStep('generating');
    setGenerating(true);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/masterclass-factory/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'X-Tenant-Slug': localStorage.getItem('tenantSlug') || 'isna',
        },
        body: JSON.stringify({ sourceText, pedagogicalModel: model }),
      });
      const json = await res.json();
      if (json.data) { setResult(json.data); setStep('done'); }
      else setError(json.error?.message || 'Erreur génération');
    } catch (e: any) {
      setError(e.message);
      setStep('input');
    } finally {
      setGenerating(false);
    }
  }, [sourceText, model]);

  const handleOrchestrate = useCallback(async () => {
    if (!sourceText.trim()) { setError('Saisissez un texte source'); return; }
    setGenerating(true);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/masterclass-factory/orchestrate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'X-Tenant-Slug': localStorage.getItem('tenantSlug') || 'isna',
        },
        body: JSON.stringify({ sourceText, pedagogicalModel: model, title: 'Projet Masterclass' }),
      });
      const json = await res.json();
      if (json.data) {
        setResult({ ...json.data, orchestrated: true });
        setStep('done');
      } else setError(json.error?.message || 'Erreur');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }, [sourceText, model]);

  return (
    <div
      className="flex min-h-screen flex-col text-white"
      style={{
        background: 'var(--school-background, #0a0a14)',
        fontFamily: 'var(--school-font-family, Inter, system-ui, sans-serif)',
        ...cssVars,
      }}
      data-school-shell="masterclass-factory"
      data-tenant-brand={branding.name}
    >
      <header className="flex items-center gap-4 px-6 py-4 border-b border-white/[0.06]" style={{ background: shellTheme.topBarBackground }}>
        <Link to="/studio/liri" className="text-white/40 hover:text-white/70">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-white">Masterclass Factory</h1>
          <p className="text-[11px] text-white/30">{branding.name} · Génération IA de cours complets</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
        {/* Model selection */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {MODELS.map(m => (
            <button key={m.id} onClick={() => setModel(m.id)}
              className={cn('rounded-xl border p-4 text-left transition-all',
                model === m.id ? 'border-violet-500/40 bg-violet-500/10' : 'border-white/[0.08] hover:border-white/15')}
              style={{ borderRadius: 'var(--school-radius, 12px)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Brain className={cn('h-4 w-4', model === m.id ? 'text-violet-400' : 'text-white/40')} />
                <span className={cn('text-[13px] font-medium', model === m.id ? 'text-violet-300' : 'text-white/70')}>{m.label}</span>
              </div>
              <p className="text-[11px] text-white/30">{m.desc}</p>
              <p className="text-[10px] text-white/20 mt-1">{m.segments} segments</p>
            </button>
          ))}
        </div>

        {/* Source text */}
        <div className="mb-4">
          <label className="flex items-center gap-2 text-[12px] text-white/40 mb-2">
            <FileText className="h-4 w-4" /> Texte source
          </label>
          <textarea value={sourceText} onChange={e => setSourceText(e.target.value)}
            placeholder="Collez votre document source ici (PDF, notes, transcription...)"
            rows={12}
            className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] text-white/80 placeholder-white/22 outline-none focus:border-violet-500/40 leading-relaxed"
            style={{ borderRadius: 'var(--school-radius, 12px)' }} />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-[12px] text-red-400 mb-4">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mb-8">
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-all"
            style={{ borderRadius: 'var(--school-radius, 12px)' }}>
            {generating && step === 'generating' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Générer (synchrone)
          </button>
          <button onClick={handleOrchestrate} disabled={generating}
            className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-5 py-2.5 text-[13px] font-medium text-violet-300 hover:bg-violet-500/20 disabled:opacity-50 transition-all"
            style={{ borderRadius: 'var(--school-radius, 12px)' }}>
            <Layers className="h-4 w-4" />
            Orchestrer (pipeline async)
          </button>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-[13px] font-medium">Génération terminée</span>
              {result.orchestrated && <span className="text-[11px] text-white/30">(pipeline async — projet {result.projectId?.slice(0, 8)}...)</span>}
            </div>

            {result.deck_title && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <h2 className="text-[16px] font-bold text-white mb-1">{result.deck_title}</h2>
                <p className="text-[12px] text-white/40 mb-3">{result.subtitle}</p>
                <div className="flex gap-3 text-[11px] text-white/30">
                  <span>{result.chapters?.length || 0} chapitres</span>
                  <span>•</span>
                  <span>Modèle: {result.pedagogical_model}</span>
                  <span>•</span>
                  <span>Provider: {result.provider || 'fallback'}</span>
                </div>
              </div>
            )}

            {result.chapters?.map((ch: any, i: number) => (
              <div key={ch.id || i} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-bold text-violet-400">
                    {i + 1}
                  </span>
                  <h3 className="text-[14px] font-semibold text-white">{ch.title}</h3>
                  <span className="text-[10px] text-white/20">{ch.duration}</span>
                </div>
                <p className="text-[11px] text-white/40 mb-3">{ch.objective}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {ch.segments?.map((seg: any) => (
                    <div key={seg.segment_id} className="rounded-lg border border-white/[0.04] bg-white/[0.01] px-2.5 py-1.5">
                      <div className="text-[10px] font-medium text-white/60">{seg.segment_id}. {seg.name}</div>
                      <div className="text-[9px] text-white/25 truncate">{seg.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
