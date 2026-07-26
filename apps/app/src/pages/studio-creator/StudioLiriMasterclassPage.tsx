/**
 * StudioLiriMasterclassPage — Masterclass Factory
 * Route: /studio/liri/masterclass
 * Interface de génération IA 21/26 segments
 * V2 port from isna_app V1
 */
import React, { useState, useCallback } from 'react';
import { DEFAULT_TENANT_SLUG } from '@/config/platform';
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
          'X-Tenant-Slug': localStorage.getItem('tenantSlug') || DEFAULT_TENANT_SLUG,
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
          'X-Tenant-Slug': localStorage.getItem('tenantSlug') || DEFAULT_TENANT_SLUG,
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
      className="flex min-h-screen flex-col text-[#f5f4ee]"
      style={{
        // Le repli du fond tenant devient le #262624 de la charte : quand un
        // tenant ne surcharge pas --school-background, la page tombait sur le
        // bleu nuit #0a0a14.
        background: 'var(--school-background, #262624)',
        fontFamily: 'var(--school-font-family, Inter, system-ui, sans-serif)',
        ...cssVars,
      }}
      data-school-shell="masterclass-factory"
      data-tenant-brand={branding.name}
    >
      <header className="flex items-center gap-4 px-6 py-4 border-b border-[#f5f4ee]/[0.09]" style={{ background: shellTheme.topBarBackground }}>
        <Link to="/studio/liri" className="text-[#f5f4ee]/65 hover:text-[#d97757] transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-[#f5f4ee]">Masterclass Factory</h1>
          <p className="text-[11px] text-[#f5f4ee]/65">{branding.name} · Génération IA de cours complets</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
        {/* Model selection */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {MODELS.map(m => (
            // Modèle sélectionné = corail (était violet). Non sélectionné =
            // encre neutre, mais assez contrastée pour rester lisible : c'est
            // un choix, pas un élément désactivé.
            <button key={m.id} onClick={() => setModel(m.id)}
              className={cn('rounded-xl border p-4 text-left transition-all',
                model === m.id ? 'border-[#d97757]/45 bg-[#d97757]/10' : 'border-[#f5f4ee]/[0.09] hover:border-[#d97757]/30')}
              style={{ borderRadius: 'var(--school-radius, 12px)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Brain className={cn('h-4 w-4', model === m.id ? 'text-[#e08a5f]' : 'text-[#f5f4ee]/65')} />
                <span className={cn('text-[13px] font-medium', model === m.id ? 'text-[#e8a97f]' : 'text-[#f5f4ee]/80')}>{m.label}</span>
              </div>
              <p className="text-[11px] text-[#f5f4ee]/65">{m.desc}</p>
              <p className="text-[10px] text-[#f5f4ee]/60 mt-1">{m.segments} segments</p>
            </button>
          ))}
        </div>

        {/* Source text */}
        <div className="mb-4">
          <label className="flex items-center gap-2 text-[12px] text-[#f5f4ee]/65 mb-2">
            <FileText className="h-4 w-4" /> Texte source
          </label>
          <textarea value={sourceText} onChange={e => setSourceText(e.target.value)}
            placeholder="Collez votre document source ici (PDF, notes, transcription...)"
            rows={12}
            className="w-full resize-none rounded-xl border border-[#f5f4ee]/10 bg-[#2b2a27] px-4 py-3 text-[13px] text-[#f5f4ee]/80 placeholder-[#f5f4ee]/45 outline-none focus:border-[#d97757]/50 leading-relaxed"
            style={{ borderRadius: 'var(--school-radius, 12px)' }} />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-[12px] text-[#ef6a52] mb-4">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mb-8">
          {/* La hiérarchie plein / contourné existait déjà : on la garde, en
              corail. Encre sombre sur le plein (5,3:1 contre 2,8:1 en blanc). */}
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-2 rounded-xl bg-[#d97757] px-5 py-2.5 text-[13px] font-semibold text-[#1f1e1c] hover:bg-[#e08a5f] disabled:opacity-50 transition-all"
            style={{ borderRadius: 'var(--school-radius, 12px)' }}>
            {generating && step === 'generating' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Générer (synchrone)
          </button>
          <button onClick={handleOrchestrate} disabled={generating}
            className="flex items-center gap-2 rounded-xl border border-[#d97757]/35 bg-[#d97757]/10 px-5 py-2.5 text-[13px] font-medium text-[#e8a97f] hover:bg-[#d97757]/20 disabled:opacity-50 transition-all"
            style={{ borderRadius: 'var(--school-radius, 12px)' }}>
            <Layers className="h-4 w-4" />
            Orchestrer (chaîne différée)
          </button>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[#8fbf7a]">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-[13px] font-medium">Génération terminée</span>
              {result.orchestrated && <span className="text-[11px] text-[#f5f4ee]/65">(chaîne différée — projet {result.projectId?.slice(0, 8)}...)</span>}
            </div>

            {result.deck_title && (
              <div className="rounded-xl border border-[#f5f4ee]/[0.09] bg-[#30302e] p-4">
                <h2 className="text-[16px] font-bold text-[#f5f4ee] mb-1">{result.deck_title}</h2>
                <p className="text-[12px] text-[#f5f4ee]/80 mb-3">{result.subtitle}</p>
                <div className="flex gap-3 text-[11px] text-[#f5f4ee]/65">
                  <span>{result.chapters?.length || 0} chapitres</span>
                  <span>•</span>
                  <span>Modèle : {result.pedagogical_model}</span>
                  <span>•</span>
                  <span>Moteur : {result.provider || 'repli'}</span>
                </div>
              </div>
            )}

            {result.chapters?.map((ch: any, i: number) => (
              <div key={ch.id || i} className="rounded-xl border border-[#f5f4ee]/[0.09] bg-[#30302e] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#d97757]/15 text-[10px] font-bold text-[#e08a5f]">
                    {i + 1}
                  </span>
                  <h3 className="text-[14px] font-semibold text-[#f5f4ee]">{ch.title}</h3>
                  <span className="text-[10px] text-[#f5f4ee]/65">{ch.duration}</span>
                </div>
                <p className="text-[11px] text-[#f5f4ee]/80 mb-3">{ch.objective}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {/* Vignettes de segments sur #1f1e1c (bloc « aperçu » de la
                      charte) : le nom à /80 et le titre à /65 restent lisibles
                      malgré leurs 10 et 9 px — ils étaient à /60 et /25. */}
                  {ch.segments?.map((seg: any) => (
                    <div key={seg.segment_id} className="rounded-lg border border-[#f5f4ee]/[0.07] bg-[#1f1e1c] px-2.5 py-1.5">
                      <div className="text-[10px] font-medium text-[#f5f4ee]/80">{seg.segment_id}. {seg.name}</div>
                      <div className="text-[9px] text-[#f5f4ee]/65 truncate">{seg.title}</div>
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
