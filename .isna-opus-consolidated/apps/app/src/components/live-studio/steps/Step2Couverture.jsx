import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { ImagePlus, Upload, Sparkles, Loader2, Wand2, MessageSquare, ArrowLeft, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import {
  invokeGenerateVisualImage,
  invokeStudioCoverPromptAssistant,
  pushLegacyLocalDesignerImage,
} from '@/features/smartboard-konva-editor/lib/designerIaImageHistory';

/** Même pipeline que le Designer SmartBoard / Coach : Edge `generate-visual-image`. */
const COVER_SIZE = '1792x1024';
const THUMB_SIZE = '1024x1024';

/** Variantes LIRI IMAGE PRO (studio-cover-prompt-assistant) → tailles API */
const VARIANT_POSTER = 'poster';
const VARIANT_TIKTOK = 'tiktok';
const VARIANT_AD = 'ad';

function sizeForImageVariant(variant, architectTarget) {
  if (variant === VARIANT_TIKTOK) return '1024x1792';
  if (variant === VARIANT_AD) return '1024x1024';
  return architectTarget === 'cover' ? COVER_SIZE : THUMB_SIZE;
}

function parseQualityScore(data) {
  const q = data?.quality_score;
  if (typeof q === 'number' && Number.isFinite(q)) return q;
  if (q != null && q !== '') {
    const n = parseFloat(String(q));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

const ENGINE_OPTIONS = [
  { value: 'auto', label: 'Auto (OpenAI ou Imagen selon les clés)' },
  { value: 'gemini', label: 'Google Imagen (Gemini API)' },
  { value: 'dalle', label: 'DALL·E 3 uniquement' },
];

/** Étapes : idée → discussion OpenAI (multi-tours) → prévisualisation → génération image */
const FLOW_EDIT = 'edit';
const FLOW_CHAT = 'chat';
const FLOW_PREVIEW = 'preview';

export function Step2Couverture({ draft, updateDraft }) {
  const fileRef = useRef(null);
  const { toast } = useToast();

  const [architectOpen, setArchitectOpen] = useState(false);
  const [architectTarget, setArchitectTarget] = useState('cover'); // 'cover' | 'thumbnail'
  const [architectPrompt, setArchitectPrompt] = useState('');
  const [architectEngine, setArchitectEngine] = useState('auto');
  const [architectBusy, setArchitectBusy] = useState(false);
  const [architectInterpretBusy, setArchitectInterpretBusy] = useState(false);

  const [architectFlowPhase, setArchitectFlowPhase] = useState(FLOW_EDIT);
  const [architectChatMessages, setArchitectChatMessages] = useState([]);
  const [coverChatInput, setCoverChatInput] = useState('');
  const chatScrollRef = useRef(null);

  const [architectAssistantMsg, setArchitectAssistantMsg] = useState('');
  const [refinedPromptEn, setRefinedPromptEn] = useState('');
  const [promptPosterEn, setPromptPosterEn] = useState('');
  const [promptTiktokEn, setPromptTiktokEn] = useState('');
  const [promptAdEn, setPromptAdEn] = useState('');
  const [selectedImageVariant, setSelectedImageVariant] = useState(VARIANT_POSTER);
  const [qualityScore, setQualityScore] = useState(null);
  const [correctionNoteFr, setCorrectionNoteFr] = useState('');
  const [riskNoteFr, setRiskNoteFr] = useState('');
  const [weakPromptCorrected, setWeakPromptCorrected] = useState(false);
  const [previewPromptsTouched, setPreviewPromptsTouched] = useState(false);
  const [whatWillBeCreatedFr, setWhatWillBeCreatedFr] = useState('');
  const [compositionNotesFr, setCompositionNotesFr] = useState('');

  const applyArchitectReadyPayload = useCallback((data) => {
    const poster = String(data.prompt_poster_16_9_en || data.refined_image_prompt_en || '').trim();
    const tiktok = String(data.prompt_tiktok_9_16_en || '').trim() || poster;
    const ad = String(data.prompt_ad_4_5_en || '').trim() || poster;
    const refined = String(data.refined_image_prompt_en || '').trim() || poster;
    setPromptPosterEn(poster);
    setPromptTiktokEn(tiktok);
    setPromptAdEn(ad);
    setRefinedPromptEn(refined);
    setWhatWillBeCreatedFr(String(data.what_will_be_created_fr || '').trim());
    setCompositionNotesFr(String(data.composition_notes_fr || '').trim());
    setArchitectAssistantMsg(String(data.assistant_message_fr || '').trim());
    setCorrectionNoteFr(String(data.correction_note_fr || '').trim());
    setRiskNoteFr(String(data.risk_note_fr || '').trim());
    setWeakPromptCorrected(Boolean(data.weak_prompt_corrected));
    setQualityScore(parseQualityScore(data));
    setPreviewPromptsTouched(false);
    setSelectedImageVariant(VARIANT_POSTER);
  }, []);

  const resetArchitectModal = useCallback(() => {
    setArchitectFlowPhase(FLOW_EDIT);
    setArchitectChatMessages([]);
    setCoverChatInput('');
    setArchitectAssistantMsg('');
    setRefinedPromptEn('');
    setPromptPosterEn('');
    setPromptTiktokEn('');
    setPromptAdEn('');
    setSelectedImageVariant(VARIANT_POSTER);
    setQualityScore(null);
    setCorrectionNoteFr('');
    setRiskNoteFr('');
    setWeakPromptCorrected(false);
    setPreviewPromptsTouched(false);
    setWhatWillBeCreatedFr('');
    setCompositionNotesFr('');
    setArchitectPrompt('');
    setArchitectInterpretBusy(false);
  }, []);

  const openArchitect = (target) => {
    resetArchitectModal();
    setArchitectTarget(target);
    setArchitectOpen(true);
  };

  const architectAnyBusy = architectBusy || architectInterpretBusy;

  const handleFile = (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateDraft({ [field]: reader.result });
    reader.readAsDataURL(file);
  };

  const liveContextPayload = useCallback(
    () => ({
      title: String(draft?.title || '').trim(),
      description: String(draft?.description || '').trim(),
      session_type: String(draft?.session_type || ''),
      category: String(draft?.category || ''),
    }),
    [draft?.title, draft?.description, draft?.session_type, draft?.category],
  );

  const liveCtxSummary = useMemo(
    () => ({
      title: String(draft?.title || '').trim(),
      description: String(draft?.description || '').trim(),
    }),
    [draft?.title, draft?.description],
  );

  const runInterpretOpenAI = useCallback(async () => {
    const idea = architectPrompt.trim();
    if (!idea || architectInterpretBusy) return;

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.access_token) {
      toast({
        variant: 'destructive',
        title: 'Connexion requise',
        description: 'Connectez-vous pour utiliser Architect IA.',
      });
      return;
    }

    setArchitectInterpretBusy(true);
    try {
      const { data, error } = await invokeStudioCoverPromptAssistant(supabase, {
        step: 'interpret',
        target: architectTarget === 'thumbnail' ? 'thumbnail' : 'cover',
        liveContext: liveContextPayload(),
        userPrompt: idea,
      });
      if (error) throw new Error(error.message || 'Edge function');
      if (data?.error) {
        const msg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        throw new Error(msg);
      }

      const intro = String(data?.assistant_message_fr || '').trim();
      const qs = Array.isArray(data?.questions) ? data.questions : [];

      if (data?.phase === 'need_info') {
        let firstBubble = intro;
        if (qs.length > 0) {
          const bullets = qs.map((q) => `• ${String(q?.label || '').trim()}`).filter(Boolean).join('\n');
          firstBubble = firstBubble
            ? `${firstBubble}\n\nPour affiner :\n${bullets}`
            : `Pour affiner :\n${bullets}`;
        }
        setArchitectAssistantMsg(intro);
        setArchitectChatMessages([{ role: 'assistant', content: firstBubble || intro || 'Comment souhaitez-vous présenter ce live visuellement ?' }]);
        setCoverChatInput('');
        setArchitectFlowPhase(FLOW_CHAT);
      } else {
        applyArchitectReadyPayload(data);
        setArchitectFlowPhase(FLOW_PREVIEW);
      }
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Assistant OpenAI',
        description: String(e?.message || e),
      });
    } finally {
      setArchitectInterpretBusy(false);
    }
  }, [
    architectPrompt,
    architectInterpretBusy,
    architectTarget,
    liveContextPayload,
    toast,
    applyArchitectReadyPayload,
  ]);

  const runChatTurn = useCallback(async () => {
    const idea = architectPrompt.trim();
    const reply = coverChatInput.trim();
    if (!idea || !reply || architectInterpretBusy) return;

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.access_token) {
      toast({
        variant: 'destructive',
        title: 'Connexion requise',
        description: 'Connectez-vous pour utiliser Architect IA.',
      });
      return;
    }

    const nextThread = [...architectChatMessages, { role: 'user', content: reply }];
    setArchitectChatMessages(nextThread);
    setCoverChatInput('');
    setArchitectInterpretBusy(true);

    try {
      const { data, error } = await invokeStudioCoverPromptAssistant(supabase, {
        step: 'chat',
        target: architectTarget === 'thumbnail' ? 'thumbnail' : 'cover',
        liveContext: liveContextPayload(),
        initialUserPrompt: idea,
        messages: nextThread,
      });
      if (error) throw new Error(error.message || 'Edge function');
      if (data?.error) {
        const msg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        throw new Error(msg);
      }

      const ast = String(data?.assistant_message_fr || '').trim();

      if (data?.phase === 'ready') {
        applyArchitectReadyPayload(data);
        setArchitectChatMessages((prev) => [...prev, { role: 'assistant', content: ast }]);
        setArchitectFlowPhase(FLOW_PREVIEW);
      } else {
        setArchitectChatMessages((prev) => [...prev, { role: 'assistant', content: ast || '…' }]);
      }
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Discussion OpenAI',
        description: String(e?.message || e),
      });
      setArchitectChatMessages((prev) => prev.slice(0, -1));
      setCoverChatInput(reply);
    } finally {
      setArchitectInterpretBusy(false);
    }
  }, [
    architectPrompt,
    architectChatMessages,
    coverChatInput,
    architectInterpretBusy,
    architectTarget,
    liveContextPayload,
    toast,
    applyArchitectReadyPayload,
  ]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [architectChatMessages, architectFlowPhase]);

  const previewPromptEn =
    selectedImageVariant === VARIANT_TIKTOK
      ? promptTiktokEn
      : selectedImageVariant === VARIANT_AD
        ? promptAdEn
        : promptPosterEn;

  const qualityBlocked =
    architectFlowPhase === FLOW_PREVIEW &&
    typeof qualityScore === 'number' &&
    qualityScore > 0 &&
    qualityScore < 85 &&
    !previewPromptsTouched;

  const handlePreviewPromptChange = useCallback((value) => {
    setPreviewPromptsTouched(true);
    if (selectedImageVariant === VARIANT_TIKTOK) setPromptTiktokEn(value);
    else if (selectedImageVariant === VARIANT_AD) setPromptAdEn(value);
    else {
      setPromptPosterEn(value);
      setRefinedPromptEn(value);
    }
  }, [selectedImageVariant]);

  const runArchitectGenerate = useCallback(async () => {
    const inPreview = architectFlowPhase === FLOW_PREVIEW;
    const prompt = inPreview ? previewPromptEn.trim() : architectPrompt.trim();
    if (!prompt || architectBusy) return;

    if (inPreview && qualityBlocked) {
      toast({
        variant: 'destructive',
        title: 'Qualité insuffisante',
        description:
          'Le score LIRI est sous 85/100. Éditez les prompts (onglets TikTok / Affiche / Pub) ou relancez l’assistant avec plus de détails.',
      });
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.access_token) {
      toast({
        variant: 'destructive',
        title: 'Connexion requise',
        description: 'Connectez-vous pour utiliser Architect IA.',
      });
      return;
    }

    const size = inPreview
      ? sizeForImageVariant(selectedImageVariant, architectTarget)
      : architectTarget === 'cover'
        ? COVER_SIZE
        : THUMB_SIZE;
    const field = architectTarget === 'cover' ? 'cover_image_url' : 'thumbnail_url';

    setArchitectBusy(true);
    try {
      const { data, error } = await invokeGenerateVisualImage(supabase, {
        prompt,
        size,
        provider: architectEngine,
      });
      if (error) throw new Error(error.message || 'Edge function');
      const url = data?.imageUrl || data?.url;
      if (url) {
        if (!data?.persisted) {
          pushLegacyLocalDesignerImage({ url, prompt, size: data?.size || size });
        }
        updateDraft({ [field]: url });
        toast({
          title: 'Image générée',
          description:
            architectTarget === 'cover'
              ? 'Couverture mise à jour via Architect.'
              : 'Miniature mise à jour via Architect.',
        });
        setArchitectOpen(false);
        resetArchitectModal();
      } else if (data?.error) {
        const msg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        throw new Error(msg);
      } else {
        throw new Error('Réponse sans image.');
      }
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Architect IA',
        description: String(e?.message || e),
      });
    } finally {
      setArchitectBusy(false);
    }
  }, [
    architectPrompt,
    architectBusy,
    architectFlowPhase,
    previewPromptEn,
    qualityBlocked,
    selectedImageVariant,
    architectTarget,
    architectEngine,
    toast,
    updateDraft,
    resetArchitectModal,
  ]);

  return (
    <div className="space-y-8 live-step-layout">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-1">Image de couverture</h2>
        <p className="text-gray-400">Donnez une identité visuelle à votre live.</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4 rounded-2xl border border-white/10 bg-[#0F1419]/40 p-5 md:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Label className="text-gray-300">Image principale</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openArchitect('cover')}
            className="shrink-0 rounded-xl border-[#7B61FF]/40 bg-[#7B61FF]/10 text-[#c4b5fd] hover:bg-[#7B61FF]/20 hover:text-white"
          >
            <Sparkles className="mr-2 h-4 w-4 text-[#7B61FF]" />
            Architect IA — couverture
          </Button>
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileRef.current?.click();
            }
          }}
          className={cn(
            'aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden',
            draft.cover_image_url
              ? 'border-[#7B61FF]/30 bg-[#0F1419] shadow-[0_0_0_1px_rgba(123,97,255,0.08)]'
              : 'border-white/20 hover:border-[#7B61FF]/50 hover:bg-white/5',
          )}
          style={draft.cover_image_url ? { backgroundImage: `url(${draft.cover_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
        >
          {!draft.cover_image_url && (
            <>
              <ImagePlus className="w-12 h-12 text-gray-500 mb-2" />
              <span className="text-sm text-gray-400">Cliquez pour ajouter une image</span>
              <span className="text-xs text-gray-500 mt-1">PNG, JPG — 16:9 recommandé · ou générez avec Architect</span>
            </>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e, 'cover_image_url')}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        className="space-y-4 rounded-2xl border border-white/10 bg-[#0F1419]/40 p-5 md:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Label className="text-gray-300">Miniature (optionnel)</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openArchitect('thumbnail')}
            className="shrink-0 rounded-xl border-[#7B61FF]/40 bg-[#7B61FF]/10 text-[#c4b5fd] hover:bg-[#7B61FF]/20 hover:text-white"
          >
            <Sparkles className="mr-2 h-4 w-4 text-[#7B61FF]" />
            Architect IA — miniature
          </Button>
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => document.getElementById('thumb-input')?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              document.getElementById('thumb-input')?.click();
            }
          }}
          className="flex items-center gap-4 p-4 rounded-xl border border-white/10 hover:border-[#7B61FF]/30 cursor-pointer transition-all bg-black/20"
        >
          <div
            className="w-20 h-12 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden flex-shrink-0 border border-white/10"
            style={
              draft.thumbnail_url
                ? { backgroundImage: `url(${draft.thumbnail_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : {}
            }
          >
            {!draft.thumbnail_url && <Upload className="w-6 h-6 text-gray-500" />}
          </div>
          <span className="text-sm text-gray-400">Même image ou miniature dédiée — ou génération IA ci-dessus</span>
        </div>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          id="thumb-input"
          onChange={(e) => handleFile(e, 'thumbnail_url')}
        />
      </motion.div>

      <Dialog
        open={architectOpen}
        onOpenChange={(open) => {
          if (!open && architectAnyBusy) return;
          if (!open) {
            resetArchitectModal();
            setArchitectOpen(false);
            return;
          }
          setArchitectOpen(true);
        }}
      >
        {/* Shell Live Studio = z-[2000] — overlay/dialog globaux z-[1000] resteraient dessous sans cette montée */}
        <DialogContent
          overlayClassName="z-[2500]"
          className="z-[2501] flex max-h-[min(92vh,760px)] max-w-lg flex-col overflow-hidden overflow-y-auto border-[#2D3139] bg-[#12141a] text-white sm:rounded-2xl"
        >
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-[#7B61FF]" />
              Architect IA — image pour le live
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-sm leading-relaxed">
              OpenAI applique le flux <strong className="font-medium text-[#c4b5fd]/95">LIRI IMAGE PRO</strong> : analyse, score qualité, trois prompts (TikTok 9:16, affiche 16:9, pub 4:5), puis génération via{' '}
              <code className="rounded bg-black/40 px-1 text-[11px]">generate-visual-image</code>{' '}
              (facturation / quotas selon votre configuration Supabase).
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-2">
            <div className="rounded-xl border border-[#7B61FF]/20 bg-[#7B61FF]/[0.06] px-3 py-2 text-xs text-[#c4b5fd]/95">
              Cible enregistrée :{' '}
              <strong className="text-white">
                {architectTarget === 'cover' ? `couverture live (${COVER_SIZE} par défaut)` : `miniature (${THUMB_SIZE} par défaut)`}
              </strong>
              {architectFlowPhase === FLOW_PREVIEW ? (
                <span className="block mt-1 text-[11px] text-[#c4b5fd]/80">
                  Tailles API par onglet : TikTok{' '}
                  <code className="rounded bg-black/30 px-1">1024×1792</code> · Affiche{' '}
                  <code className="rounded bg-black/30 px-1">
                    {architectTarget === 'cover' ? COVER_SIZE : THUMB_SIZE}
                  </code>{' '}
                  · Pub 4:5 <code className="rounded bg-black/30 px-1">{THUMB_SIZE}</code> (cadrage 4:5 dans le prompt).
                </span>
              ) : null}
            </div>

            {(liveCtxSummary.title || liveCtxSummary.description) && (
              <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[11px] leading-relaxed text-gray-400">
                <span className="font-medium text-gray-500">Contexte live (étape Informations)</span>
                {liveCtxSummary.title ? (
                  <p className="mt-1 text-gray-300">
                    <span className="text-gray-500">Titre · </span>
                    {liveCtxSummary.title}
                  </p>
                ) : null}
                {liveCtxSummary.description ? (
                  <p className="mt-1 line-clamp-4 text-gray-400">{liveCtxSummary.description}</p>
                ) : null}
              </div>
            )}
            {!liveCtxSummary.title && !liveCtxSummary.description && (
              <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200/90">
                Astuce : renseignez le titre et la description du live (étape précédente) pour que l&apos;assistant cible mieux le sujet.
              </p>
            )}

            {architectFlowPhase === FLOW_EDIT && (
              <>
                <label className="block text-xs font-medium text-gray-400">
                  Moteur image
                  <select
                    value={architectEngine}
                    onChange={(e) => setArchitectEngine(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/12 bg-black/40 py-2 px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-[#7B61FF]/45"
                  >
                    {ENGINE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-gray-400">
                  Votre idée (prompt initial)
                  <Textarea
                    value={architectPrompt}
                    onChange={(e) => setArchitectPrompt(e.target.value)}
                    placeholder="Ex. : ambiance cyberpunk pour un cours de physique, violet et néons bleus…"
                    className="mt-1.5 min-h-[120px] rounded-xl border-[#2D3139] bg-[#0a0c10] text-white placeholder:text-gray-600 focus-visible:ring-[#7B61FF]/45"
                  />
                </label>
              </>
            )}

            {architectFlowPhase === FLOW_CHAT && (
              <div className="flex min-h-[260px] flex-col gap-3">
                <p className="text-xs font-medium text-[#c4b5fd]/90">
                  <MessageSquare className="mr-1.5 inline h-3.5 w-3.5 align-text-bottom" />
                  Discussion avec OpenAI — précisez le sujet, le public ou le style jusqu&apos;à la prévisualisation.
                </p>
                <div
                  ref={chatScrollRef}
                  className="max-h-[min(42vh,320px)] space-y-3 overflow-y-auto rounded-xl border border-white/[0.08] bg-black/30 p-3"
                >
                  {architectChatMessages.map((m, i) => (
                    <div
                      key={`${i}-${m.role}`}
                      className={cn(
                        'max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap',
                        m.role === 'assistant'
                          ? 'mr-auto border border-[#7B61FF]/25 bg-[#7B61FF]/[0.08] text-gray-100'
                          : 'ml-auto border border-white/10 bg-white/[0.06] text-gray-200',
                      )}
                    >
                      {m.content}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Textarea
                    value={coverChatInput}
                    onChange={(e) => setCoverChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void runChatTurn();
                      }
                    }}
                    placeholder="Votre réponse… (Entrée pour envoyer, Maj+Entrée pour une ligne)"
                    rows={3}
                    disabled={architectInterpretBusy}
                    className="min-h-[72px] flex-1 resize-none rounded-xl border-[#2D3139] bg-[#0a0c10] text-sm text-white placeholder:text-gray-600 focus-visible:ring-[#7B61FF]/45"
                  />
                  <Button
                    type="button"
                    variant="accent"
                    className="h-auto shrink-0 self-stretch rounded-xl px-4"
                    disabled={architectInterpretBusy || !coverChatInput.trim()}
                    onClick={() => void runChatTurn()}
                  >
                    {architectInterpretBusy ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {architectFlowPhase === FLOW_PREVIEW && (
              <div className="space-y-4">
                {architectAssistantMsg ? (
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-gray-300">
                    <p className="whitespace-pre-wrap">{architectAssistantMsg}</p>
                  </div>
                ) : null}

                {typeof qualityScore === 'number' && Number.isFinite(qualityScore) ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#7B61FF]/25 bg-[#7B61FF]/[0.07] px-3 py-2 text-xs">
                    <span className="font-semibold text-[#c4b5fd]">Score LIRI · {qualityScore}/100</span>
                    {weakPromptCorrected && correctionNoteFr ? (
                      <span className="text-gray-400">
                        <span className="font-medium text-gray-500">Correction · </span>
                        {correctionNoteFr}
                      </span>
                    ) : null}
                    {riskNoteFr ? (
                      <span className="text-amber-200/90">
                        <span className="font-medium text-amber-500/90">Risque · </span>
                        {riskNoteFr}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {qualityBlocked ? (
                  <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] leading-relaxed text-rose-100/95">
                    Prompts jugés sous le seuil 85/100 — modifiez le texte ci-dessous pour débloquer la génération, ou relancez « Affiner » avec plus de détails.
                  </p>
                ) : null}

                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300/95">
                    Ce qui sera créé
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-200 whitespace-pre-wrap">
                    {whatWillBeCreatedFr || '—'}
                  </p>
                </div>
                {compositionNotesFr ? (
                  <div className="rounded-xl border border-white/10 px-3 py-2 text-xs text-gray-400">
                    <span className="font-medium text-gray-500">Composition · </span>
                    {compositionNotesFr}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                    Prompts LIRI IMAGE PRO (anglais — par format)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: VARIANT_TIKTOK, label: 'TikTok 9:16', hint: '1024×1792' },
                      { id: VARIANT_POSTER, label: 'Affiche 16:9', hint: architectTarget === 'cover' ? COVER_SIZE : THUMB_SIZE },
                      { id: VARIANT_AD, label: 'Pub 4:5', hint: `${THUMB_SIZE} + cadrage 4:5` },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSelectedImageVariant(tab.id)}
                        className={cn(
                          'rounded-xl border px-3 py-1.5 text-left text-[11px] transition-colors',
                          selectedImageVariant === tab.id
                            ? 'border-[#7B61FF]/55 bg-[#7B61FF]/15 text-white'
                            : 'border-white/12 bg-black/25 text-gray-400 hover:border-[#7B61FF]/35 hover:text-gray-200',
                        )}
                      >
                        <span className="block font-medium">{tab.label}</span>
                        <span className="block text-[10px] text-gray-500">{tab.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block text-xs font-medium text-gray-400">
                  Prompt envoyé au moteur pour cet onglet (modifiable — débloque si score bas)
                  <Textarea
                    value={previewPromptEn}
                    onChange={(e) => handlePreviewPromptChange(e.target.value)}
                    className="mt-1.5 min-h-[120px] rounded-xl border-[#2D3139] bg-[#0a0c10] font-mono text-[13px] leading-relaxed text-gray-100 focus-visible:ring-[#7B61FF]/45"
                  />
                </label>
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-white/[0.06] pt-4 flex-col-reverse sm:flex-row sm:justify-between sm:gap-3">
            {architectFlowPhase === FLOW_EDIT && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-white/15"
                  onClick={() => setArchitectOpen(false)}
                  disabled={architectAnyBusy}
                >
                  Annuler
                </Button>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-white/15"
                    disabled={architectAnyBusy || !architectPrompt.trim()}
                    onClick={() => void runArchitectGenerate()}
                  >
                    {architectBusy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="mr-2 h-4 w-4 opacity-80" />
                    )}
                    Générer sans affiner
                  </Button>
                  <Button
                    type="button"
                    variant="accent"
                    className="rounded-xl"
                    disabled={architectAnyBusy || !architectPrompt.trim()}
                    onClick={() => void runInterpretOpenAI()}
                  >
                    {architectInterpretBusy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <MessageSquare className="mr-2 h-4 w-4" />
                    )}
                    Affiner avec OpenAI
                  </Button>
                </div>
              </>
            )}

            {architectFlowPhase === FLOW_CHAT && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-white/15"
                  onClick={() => setArchitectOpen(false)}
                  disabled={architectAnyBusy}
                >
                  Annuler
                </Button>
                <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-white/15"
                    disabled={architectAnyBusy}
                    onClick={() => {
                      setArchitectFlowPhase(FLOW_EDIT);
                      setArchitectChatMessages([]);
                      setCoverChatInput('');
                      setArchitectAssistantMsg('');
                    }}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Modifier l&apos;idée
                  </Button>
                </div>
              </>
            )}

            {architectFlowPhase === FLOW_PREVIEW && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-white/15"
                  onClick={() => setArchitectOpen(false)}
                  disabled={architectAnyBusy}
                >
                  Annuler
                </Button>
                <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-white/15"
                    disabled={architectAnyBusy}
                    onClick={() => {
                      setArchitectFlowPhase(FLOW_EDIT);
                      setArchitectChatMessages([]);
                      setCoverChatInput('');
                      setRefinedPromptEn('');
                      setPromptPosterEn('');
                      setPromptTiktokEn('');
                      setPromptAdEn('');
                      setQualityScore(null);
                      setCorrectionNoteFr('');
                      setRiskNoteFr('');
                      setWeakPromptCorrected(false);
                      setPreviewPromptsTouched(false);
                      setWhatWillBeCreatedFr('');
                      setCompositionNotesFr('');
                      setArchitectAssistantMsg('');
                    }}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Modifier l&apos;idée
                  </Button>
                  <Button
                    type="button"
                    variant="accent"
                    className="rounded-xl"
                    disabled={architectAnyBusy || !previewPromptEn.trim() || qualityBlocked}
                    onClick={() => void runArchitectGenerate()}
                  >
                    {architectBusy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="mr-2 h-4 w-4" />
                    )}
                    Générer l&apos;image
                  </Button>
                </div>
              </>
            )}
          </DialogFooter>

          <AnimatePresence>
            {architectAnyBusy && (
              <motion.div
                key="architect-loading"
                role="status"
                aria-live="polite"
                aria-busy="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="pointer-events-auto absolute inset-0 z-[9999] flex flex-col items-center justify-center gap-5 rounded-[inherit] bg-[#070910]/[0.97] px-6 backdrop-blur-md"
              >
                <motion.div
                  className="relative flex h-20 w-20 items-center justify-center"
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <span className="absolute inset-0 rounded-full bg-[#7B61FF]/25 blur-xl" />
                  <motion.span
                    className="absolute inset-2 rounded-full border-2 border-[#7B61FF]/50 border-t-transparent"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
                  />
                  <img
                    src="/liri-logo-mark.png"
                    alt=""
                    aria-hidden
                    draggable={false}
                    className="relative z-[1] h-10 w-10 object-contain drop-shadow-[0_0_14px_rgba(123,97,255,0.45)]"
                  />
                </motion.div>
                <div className="space-y-1 text-center">
                  <p className="text-sm font-semibold text-white">
                    {architectInterpretBusy ? 'OpenAI analyse votre projet…' : 'Génération en cours…'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {architectInterpretBusy
                      ? architectFlowPhase === FLOW_CHAT
                        ? 'Échange multi-tours avec OpenAI — poursuivez jusqu’à la prévisualisation du prompt.'
                        : 'Préparation du prompt ou discussion — selon le titre et la description du live.'
                      : "L'Architect compose votre image — souvent quelques secondes, parfois jusqu'à deux minutes selon le moteur."}
                  </p>
                </div>
                <div className="w-full max-w-[280px] space-y-2">
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.08] ring-1 ring-inset ring-white/[0.06]">
                    <motion.div
                      className="h-full w-[42%] rounded-full bg-gradient-to-r from-[#4c1d95] via-[#7B61FF] to-[#c4b5fd] shadow-[0_0_18px_rgba(123,97,255,0.45)]"
                      initial={{ x: '-100%' }}
                      animate={{ x: ['-100%', '280%'] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                  <p className="text-center text-[10px] uppercase tracking-[0.2em] text-[#7B61FF]/90">
                    {architectInterpretBusy ? 'studio-cover-prompt-assistant' : 'generate-visual-image'}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </div>
  );
}
