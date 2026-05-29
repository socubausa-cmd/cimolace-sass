import React, { useMemo, useState } from 'react';
import { Sparkles, Upload, FileText, Scissors, CheckCircle2 } from 'lucide-react';
import { StudioBuilder } from '../StudioBuilder';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const STEPS = [
  { id: 1, key: 'infos', label: 'Informations', icon: '🧾' },
  { id: 2, key: 'video', label: 'Vidéo', icon: '🎬' },
  { id: 3, key: 'transcript', label: 'Transcription', icon: '📝' },
  { id: 4, key: 'segments', label: 'Horodatages', icon: '⏱️' },
  { id: 5, key: 'finalize', label: 'Finaliser', icon: '✅' },
];

const formatSeconds = (seconds) => {
  const s = Number(seconds || 0);
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${mm}:${String(ss).padStart(2, '0')}`;
};

function autoSegmentsFromTranscript(lines = []) {
  if (!Array.isArray(lines) || lines.length === 0) return [];
  const points = lines
    .map((line) => Number(line?.timeSeconds ?? 0))
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => a - b);
  if (points.length === 0) return [];
  const out = [];
  let segmentStart = points[0];
  let cursor = segmentStart;
  let idx = 1;
  for (const p of points) {
    if (p - cursor >= 100) {
      out.push({
        startText: formatSeconds(segmentStart),
        endText: formatSeconds(p),
        label: `Chapitre ${idx++}`,
      });
      segmentStart = p;
    }
    cursor = p;
  }
  const last = points[points.length - 1];
  out.push({
    startText: formatSeconds(segmentStart),
    endText: formatSeconds(Math.max(last + 20, segmentStart + 30)),
    label: `Chapitre ${idx}`,
  });
  return out;
}

function StepInfo({ draft, updateDraft }) {
  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold text-white">Créer un cours IA</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Titre</Label>
          <Input className="bg-[#0F1419] border-white/10" value={draft.title || ''} onChange={(e) => updateDraft({ title: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Niveau</Label>
          <select
            className="h-10 w-full rounded-md bg-[#0F1419] border border-white/10 px-3 text-sm"
            value={draft.level || 'intermediaire'}
            onChange={(e) => updateDraft({ level: e.target.value })}
          >
            <option value="debutant">Débutant</option>
            <option value="intermediaire">Intermédiaire</option>
            <option value="avance">Avancé</option>
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea className="bg-[#0F1419] border-white/10 min-h-[110px]" value={draft.description || ''} onChange={(e) => updateDraft({ description: e.target.value })} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Catégorie</Label>
          <Input className="bg-[#0F1419] border-white/10" value={draft.category || ''} onChange={(e) => updateDraft({ category: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Langue</Label>
          <Input className="bg-[#0F1419] border-white/10" value={draft.language || 'fr'} onChange={(e) => updateDraft({ language: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

function StepVideo({ draft, updateDraft }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
      const filePath = `course-builder/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const up = await supabase.storage.from('videos').upload(filePath, file, { upsert: false });
      if (up.error) throw up.error;
      const signed = await supabase.storage.from('videos').createSignedUrl(filePath, 60 * 60);
      const url = signed?.data?.signedUrl || '';

      const videoEl = document.createElement('video');
      videoEl.preload = 'metadata';
      videoEl.src = URL.createObjectURL(file);
      await new Promise((resolve, reject) => {
        videoEl.onloadedmetadata = resolve;
        videoEl.onerror = reject;
      });
      const duration = Number(videoEl.duration || 0);
      URL.revokeObjectURL(videoEl.src);

      updateDraft({
        video_url: url,
        video_storage_path: filePath,
        duration_seconds: duration,
      });
      if (duration > 1020) {
        toast({
          title: 'Vidéo longue détectée',
          description: 'Plus de 17 minutes: il est recommandé de découper en plusieurs capsules.',
        });
      }
    } catch (err) {
      toast({ title: 'Upload échoué', description: String(err?.message || err), variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-white">Import vidéo</h2>
      <div className="space-y-2">
        <Label>URL vidéo (optionnel)</Label>
        <Input
          className="bg-[#0F1419] border-white/10"
          value={draft.video_url || ''}
          onChange={(e) => updateDraft({ video_url: e.target.value })}
          placeholder="https://..."
        />
      </div>
      <div className="space-y-2">
        <Label>Ou uploader un fichier</Label>
        <input type="file" accept="video/*" onChange={onPickFile} className="block w-full text-sm" />
        {uploading ? <p className="text-xs text-gray-400">Upload en cours...</p> : null}
      </div>
      <Card className="bg-[#0F1419] border-white/10">
        <CardContent className="p-4 text-sm text-gray-300">
          Durée détectée: {draft.duration_seconds ? `${Math.round(draft.duration_seconds)}s` : '—'}
          {Number(draft.duration_seconds || 0) > 1020 ? (
            <p className="mt-2 text-amber-300">Suggestion: découper en Partie 1 / 2 / 3.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function StepTranscript({ draft, updateDraft }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const run = async () => {
    if (!draft.video_url) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-transcript', {
        body: { url: draft.video_url, language: draft.language || 'fr' },
      });
      if (error) throw error;
      const transcript = Array.isArray(data?.transcript) ? data.transcript : [];
      updateDraft({ transcript });
    } catch (e) {
      toast({ title: 'Transcription IA', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-white">Transcription</h2>
      <Button onClick={run} disabled={loading || !draft.video_url} className="bg-[#D4AF37] text-black hover:bg-yellow-500">
        {loading ? 'Génération...' : 'Générer transcription'}
      </Button>
      <Textarea
        className="bg-[#0F1419] border-white/10 min-h-[240px]"
        value={(draft.transcript || []).map((l) => `[${l.time || '0:00'}] ${l.text || ''}`).join('\n')}
        onChange={(e) => {
          const lines = String(e.target.value || '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line, idx) => ({ time: `${idx}:00`, text: line.replace(/^\[[^\]]+\]\s*/, '') }));
          updateDraft({ transcript: lines });
        }}
      />
    </div>
  );
}

function StepSegments({ draft, updateDraft }) {
  const segments = draft.segments || [];
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-white">Horodatages</h2>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="border-white/10 text-white hover:bg-white/5"
          onClick={() => {
            const generated = autoSegmentsFromTranscript(draft.transcript || []);
            updateDraft({ segments: generated });
          }}
        >
          Générer automatiquement
        </Button>
        <Button
          variant="outline"
          className="border-white/10 text-white hover:bg-white/5"
          onClick={() => updateDraft({ segments: [...segments, { startText: '', endText: '', label: '' }] })}
        >
          Ajouter segment
        </Button>
      </div>
      <div className="space-y-2">
        {segments.map((s, idx) => (
          <div key={`seg-${idx}`} className="grid grid-cols-12 gap-2">
            <Input className="col-span-2 bg-[#0F1419] border-white/10" value={s.startText || ''} onChange={(e) => {
              const next = [...segments];
              next[idx] = { ...next[idx], startText: e.target.value };
              updateDraft({ segments: next });
            }} placeholder="0:00" />
            <Input className="col-span-2 bg-[#0F1419] border-white/10" value={s.endText || ''} onChange={(e) => {
              const next = [...segments];
              next[idx] = { ...next[idx], endText: e.target.value };
              updateDraft({ segments: next });
            }} placeholder="0:30" />
            <Input className="col-span-7 bg-[#0F1419] border-white/10" value={s.label || ''} onChange={(e) => {
              const next = [...segments];
              next[idx] = { ...next[idx], label: e.target.value };
              updateDraft({ segments: next });
            }} placeholder="Titre du segment" />
            <Button size="icon" variant="ghost" className="col-span-1" onClick={() => updateDraft({ segments: segments.filter((_, i) => i !== idx) })}>×</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepFinalize({ draft, onSubmit, creating }) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-white">Prêt à lancer la post-production</h2>
      <Card className="bg-[#0F1419] border-[#D4AF37]/30">
        <CardContent className="p-4 text-sm text-gray-200 space-y-1">
          <p>Titre: {draft.title || '—'}</p>
          <p>Durée: {draft.duration_seconds ? `${Math.round(draft.duration_seconds)}s` : '—'}</p>
          <p>Transcription: {(draft.transcript || []).length} lignes</p>
          <p>Segments: {(draft.segments || []).length}</p>
        </CardContent>
      </Card>
      <p className="text-xs text-gray-400">
        Le workflow crée une formation brouillon + un contenu vidéo, puis ouvre le{' '}
        <strong className="text-white/55">SmartBoard Designer</strong> avec la post-production (transcription, pipeline…)
        sur ce contenu. La page post-prod plein écran reste disponible via le hub studio.
      </p>
      <Button onClick={onSubmit} disabled={creating} className="bg-[#D4AF37] text-black hover:bg-yellow-500">
        {creating ? 'Création...' : 'Créer et ouvrir le studio'}
      </Button>
    </div>
  );
}

const STEP_COMPONENTS = {
  infos: StepInfo,
  video: StepVideo,
  transcript: StepTranscript,
  segments: StepSegments,
  finalize: StepFinalize,
};

function Preview({ draft }) {
  const transcriptCount = (draft?.transcript || []).length;
  const segmentsCount = (draft?.segments || []).length;
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/10 bg-[#0F1419]/60 p-4">
        <div className="text-xs text-gray-400 mb-1">Prorascience Course Builder AI</div>
        <div className="text-sm text-white font-semibold">{draft?.title || 'Nouveau cours IA'}</div>
        <div className="text-xs text-gray-500 mt-1">{draft?.description || 'Ajoutez une description.'}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-white/10 bg-[#0F1419]/60 p-3">
          <Upload className="w-4 h-4 text-[#D4AF37] mb-1" />
          Durée: {draft?.duration_seconds ? `${Math.round(draft.duration_seconds)}s` : '—'}
        </div>
        <div className="rounded-lg border border-white/10 bg-[#0F1419]/60 p-3">
          <FileText className="w-4 h-4 text-[#D4AF37] mb-1" />
          Transcript: {transcriptCount}
        </div>
        <div className="rounded-lg border border-white/10 bg-[#0F1419]/60 p-3">
          <Scissors className="w-4 h-4 text-[#D4AF37] mb-1" />
          Segments: {segmentsCount}
        </div>
        <div className="rounded-lg border border-white/10 bg-[#0F1419]/60 p-3">
          <Sparkles className="w-4 h-4 text-[#D4AF37] mb-1" />
          Mode: SmartBoard
        </div>
      </div>
    </div>
  );
}

export default function CourseBuilderStudioBuilder(props) {
  const preview = useMemo(() => <Preview draft={props.draft} />, [props.draft]);
  return (
    <StudioBuilder
      steps={STEPS}
      stepComponents={STEP_COMPONENTS}
      title="Studio de post-production pédagogique IA"
      subtitle="Créer, transcrire, segmenter, puis ouvrir la post-production masterclass"
      previewComponent={preview}
      validateStep={({ stepKey, draft }) => {
        if (stepKey === 'infos' && !String(draft?.title || '').trim()) return { valid: false, message: 'Le titre est requis.' };
        if (stepKey === 'video' && !String(draft?.video_url || '').trim()) return { valid: false, message: 'Ajoutez une vidéo (URL ou upload).' };
        if (stepKey === 'transcript' && (!Array.isArray(draft?.transcript) || draft.transcript.length === 0)) return { valid: false, message: 'Générez ou éditez une transcription.' };
        if (stepKey === 'segments' && (!Array.isArray(draft?.segments) || draft.segments.length === 0)) return { valid: false, message: 'Ajoutez des segments.' };
        return { valid: true };
      }}
      getStepCompletion={({ stepKey, draft }) => {
        if (stepKey === 'infos') return Boolean(String(draft?.title || '').trim());
        if (stepKey === 'video') return Boolean(String(draft?.video_url || '').trim());
        if (stepKey === 'transcript') return Boolean((draft?.transcript || []).length);
        if (stepKey === 'segments') return Boolean((draft?.segments || []).length);
        if (stepKey === 'finalize') return true;
        return false;
      }}
      {...props}
    />
  );
}
