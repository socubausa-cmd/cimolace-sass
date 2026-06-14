import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, Image, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { courseBuilderApi } from '@/lib/api-v2';

function toTextArea(value) {
  if (Array.isArray(value)) return value.join('\n');
  return '';
}

async function invokeIllustrationRegenerate({ contentId, segmentIndex, prompt }) {
  // Rebranché sur NestJS (l'edge course-builder-segment-illustration-regenerate n'existe pas → 404).
  return courseBuilderApi.segmentIllustrationRegenerate({ contentId, segmentIndex, prompt });
}

export default function SegmentAIEditorPanel({
  contentId,
  segmentIndex,
  segmentLabel = '',
  value = null,
  loading = false,
  persistedInDb = true,
  onChangeField,
  onGenerate,
  onGenerateAll,
  onApprove,
  onReject,
  onIllustrationUpdated,
}) {
  const ai = value || {};
  const [illoLoading, setIlloLoading] = useState(false);
  const [illoError, setIlloError] = useState('');
  const [illoPromptEdit, setIlloPromptEdit] = useState('');
  const [showIlloEditor, setShowIlloEditor] = useState(false);

  const handleRegenerateIllustration = async (customPrompt) => {
    if (!contentId || segmentIndex == null) return;
    setIlloLoading(true);
    setIlloError('');
    try {
      const result = await invokeIllustrationRegenerate({
        contentId,
        segmentIndex,
        prompt: customPrompt || ai.illustration_prompt || '',
      });
      onIllustrationUpdated?.({
        illustration_url: result.illustration_url,
        illustration_prompt: result.prompt,
      });
      onChangeField?.('illustration_url', result.illustration_url);
      onChangeField?.('illustration_prompt', result.prompt);
      setShowIlloEditor(false);
    } catch (e) {
      setIlloError(String(e?.message || e));
    } finally {
      setIlloLoading(false);
    }
  };

  const statusColors = {
    draft: 'text-gray-400',
    generated: 'text-blue-400',
    approved: 'text-emerald-400',
    rejected: 'text-red-400',
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#131d2d]/95 p-4 space-y-4">
      {/* Header with actions */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-gray-500">Assistance IA segmentée</p>
          <h3 className="text-sm font-semibold text-white mt-0.5">{segmentLabel || 'Segment non sélectionné'}</h3>
          {ai.status && (
            <span className={`text-[10px] font-medium ${statusColors[ai.status] || 'text-gray-400'}`}>
              • {ai.status}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" className="border-white/10 text-white hover:bg-white/5" onClick={onGenerate} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
            Générer segment
          </Button>
          <Button type="button" size="sm" variant="outline" className="border-white/10 text-white hover:bg-white/5" onClick={onGenerateAll} disabled={loading}>
            Générer tous
          </Button>
          <Button type="button" size="sm" className="bg-[#D4AF37] text-black hover:bg-yellow-500 font-semibold" onClick={onApprove} disabled={loading}>
            <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Valider
          </Button>
          <Button type="button" size="sm" variant="outline" className="border-red-500/30 text-red-200 hover:bg-red-500/10" onClick={onReject} disabled={loading}>
            <XCircle className="w-3.5 h-3.5 mr-1.5" /> Rejeter
          </Button>
        </div>
      </div>

      {/* Main fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-400">Titre du chapitre</Label>
          <Input className="bg-[#0F1419] border-white/10" value={ai.chapter_title || ''} onChange={(e) => onChangeField?.('chapter_title', e.target.value)} placeholder="Titre proposé par l'IA" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-400">Sous-titre</Label>
          <Input className="bg-[#0F1419] border-white/10" value={ai.subtitle || ''} onChange={(e) => onChangeField?.('subtitle', e.target.value)} placeholder="Sous-titre pédagogique" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-gray-400">Résumé pédagogique</Label>
        <Textarea className="bg-[#0F1419] border-white/10 min-h-[80px]" value={ai.summary_text || ''} onChange={(e) => onChangeField?.('summary_text', e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-gray-400">Reformulation simple</Label>
        <Textarea className="bg-[#0F1419] border-white/10 min-h-[80px]" value={ai.reformulation_text || ''} onChange={(e) => onChangeField?.('reformulation_text', e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-400">Points clés (1 ligne = 1 point)</Label>
          <Textarea
            className="bg-[#0F1419] border-white/10 min-h-[100px]"
            value={toTextArea(ai.key_points_json)}
            onChange={(e) =>
              onChangeField?.('key_points_json', String(e.target.value || '').split('\n').map((l) => l.trim()).filter(Boolean))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-400">À retenir</Label>
          <Textarea className="bg-[#0F1419] border-white/10 min-h-[100px]" value={ai.retention_text || ''} onChange={(e) => onChangeField?.('retention_text', e.target.value)} />
        </div>
      </div>

      {/* Illustration section */}
      <div className="rounded-xl border border-white/10 bg-[#0a111d] p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-xs font-semibold text-white">Illustration IA</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowIlloEditor((v) => !v)}
              className="text-[10px] text-gray-400 hover:text-white transition-colors"
            >
              {showIlloEditor ? 'Fermer' : 'Modifier le prompt'}
            </button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-white/10 text-white hover:bg-white/5 h-7 text-xs px-2"
              onClick={() => handleRegenerateIllustration(illoPromptEdit || ai.illustration_prompt || '')}
              disabled={illoLoading || !contentId}
              title="Regénérer l'illustration avec l'IA"
            >
              {illoLoading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />}
              <span className="ml-1">Regénérer</span>
            </Button>
          </div>
        </div>

        {/* Illustration preview */}
        {ai.illustration_url ? (
          <div className="relative rounded-lg overflow-hidden border border-white/10" style={{ aspectRatio: '16/9' }}>
            <img
              src={ai.illustration_url}
              alt={ai.illustration_prompt || 'Illustration IA'}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            <div className="absolute bottom-2 left-2 right-2">
              <p className="text-[10px] text-white/60 truncate">{ai.illustration_prompt}</p>
            </div>
          </div>
        ) : (
          <div className="aspect-video rounded-lg border border-dashed border-white/10 flex flex-col items-center justify-center gap-2 bg-white/2">
            <Image className="w-8 h-8 text-gray-600" />
            <p className="text-xs text-gray-500 text-center max-w-[200px]">
              {contentId ? 'Génère le segment IA pour obtenir une illustration automatique' : 'Sélectionne un segment'}
            </p>
          </div>
        )}

        {/* Prompt editor */}
        {showIlloEditor && (
          <div className="space-y-2">
            <Label className="text-xs text-gray-400">Prompt d'illustration (personnalisé)</Label>
            <div className="flex gap-2">
              <Textarea
                className="bg-[#0F1419] border-white/10 min-h-[60px] flex-1 text-xs"
                value={illoPromptEdit || ai.illustration_prompt || ''}
                onChange={(e) => setIlloPromptEdit(e.target.value)}
                placeholder="Ex: concept abstrait de l'apprentissage, cerveau lumineux, bleu et or..."
              />
              <Button
                type="button"
                size="sm"
                className="bg-[#D4AF37] text-black hover:bg-amber-500 self-end"
                onClick={() => handleRegenerateIllustration(illoPromptEdit)}
                disabled={illoLoading}
              >
                {illoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'OK'}
              </Button>
            </div>
          </div>
        )}

        {illoError && (
          <p className="text-xs text-red-300 border border-red-500/20 bg-red-500/10 rounded p-2">{illoError}</p>
        )}
      </div>

      {/* Question de compréhension */}
      {ai.comprehension_question && (
        <div className="rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-3">
          <p className="text-[10px] uppercase tracking-widest text-[#D4AF37]/60 font-semibold mb-1">Question de compréhension</p>
          <p className="text-sm text-[#D4AF37] italic">{ai.comprehension_question}</p>
        </div>
      )}
    </div>
  );
}
