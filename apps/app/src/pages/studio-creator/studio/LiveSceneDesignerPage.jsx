/**
 * Retouche manuelle d'UNE scène déjà publiée (`live_scenes`) dans le designer Konva.
 *
 * C'est le dernier maillon du tunnel « tableau vivant » : jusqu'ici l'enseignant
 * subissait la mise en page produite par le Master Factory sans pouvoir y toucher.
 *
 * ⛔ CONTRAINTE FONDATRICE — cet écran n'écrit JAMAIS une ligne complète.
 * `konvaSceneToLiveScenePatch` rend un patch PARTIEL, et `patchScene` l'applique tel
 * quel. `audio_url` (narration), `chapter_id`, `render_mode`, `name`, `order_index`
 * et les champs de `ia_data` que le canevas ne représente pas ne figurent jamais dans
 * ce qui part en base. Après enregistrement on RELIT la ligne et on affiche ces
 * champs : l'enseignant doit constater de ses yeux qu'il n'a rien perdu, parce que ce
 * dépôt a déjà connu cinq pertes silencieuses causées par des écritures qui
 * reconstruisaient au lieu de préserver.
 *
 * ⛔ SECOND PIÈGE — deux vocabulaires d'objets cohabitent et ne sont PAS le même :
 *   · le pont (`liveSceneKonvaBridge` / `smartboardCanvasModel`) produit des objets
 *     PLATS (`text`, `color`, `fontSize` à la racine) ;
 *   · l'éditeur Konva (`model/sceneModel`) rend `obj.content.text` et `obj.style.fill`.
 * Hydrater l'éditeur avec les objets plats tels quels donnerait un canevas de blocs
 * VIDES. Les deux adaptateurs ci-dessous font la traduction, et le retour repart de
 * l'objet plat d'origine (`...prev`) pour ne pas perdre les champs que le modèle Konva
 * ne transporte pas.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, ShieldCheck, AlertTriangle } from 'lucide-react';

import SmartboardKonvaEditorV1 from '@/features/smartboard-konva-editor/SmartboardKonvaEditorV1';
import { useSmartboardKonvaStore } from '@/features/smartboard-konva-editor/store/useSmartboardKonvaStore';
import { supabase } from '@/lib/customSupabaseClient';
import {
  liveSceneToKonvaScene,
  konvaSceneToLiveScenePatch,
  readSceneIaData,
} from '@/lib/liveSceneKonvaBridge';
// `patchScene` et NON `upsertScene` : cette dernière reconstruit la ligne entière et
// effacerait narration / chapitre / mode de rendu par simple omission.
import { patchScene } from '@/services/liveProduction/liveScenes';
import {
  studioCreatorCard,
  studioCreatorHeader,
  studioCreatorShellBg,
} from '@/components/studio-creator/studio/studioCreatorTheme';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------ adaptateurs plat ⇄ Konva */

function asText(v) {
  return typeof v === 'string' ? v : '';
}

/** Objet plat du pont → objet du modèle Konva (style/content imbriqués). */
function flatToKonvaObject(flat) {
  const type = flat?.type || 'rect';
  const base = {
    id: flat.id,
    type,
    x: flat.x ?? 0,
    y: flat.y ?? 0,
    width: flat.width ?? 200,
    height: flat.height ?? 80,
    rotation: flat.rotation ?? 0,
    layer: type === 'text' ? 1 : 0,
    visible: flat.visible !== false,
    locked: !!flat.locked,
    opacity: flat.opacity ?? 1,
    step: flat.step ?? 0,
    visibleFor: flat.visibleFor ?? 'both',
    mindmapNodeId: flat.mindmapNodeId ?? '',
    // Porteur du rôle `liri:ia/...` : c'est LUI qui rattache le bloc au champ
    // `ia_data` correspondant. Le perdre = l'édition ne remonterait plus nulle part.
    masterScriptRef: flat.masterScriptRef ?? '',
    sectionId: flat.sectionId ?? null,
  };

  if (type === 'text') {
    return {
      ...base,
      style: {
        fontFamily: flat.fontFamily || 'Inter, system-ui, sans-serif',
        fontSize: flat.fontSize ?? 24,
        fontWeight: String(flat.fontWeight ?? '400'),
        fontStyle: flat.italic ? 'italic' : 'normal',
        fill: flat.color || '#111',
        align: flat.textAlign || 'left',
        lineHeight: flat.lineHeight ?? 1.35,
        textDecoration: flat.underline ? 'underline' : (flat.strikethrough ? 'line-through' : ''),
      },
      content: { text: asText(flat.text) },
    };
  }

  if (type === 'image') {
    return { ...base, style: {}, content: { src: flat.src || flat.url || '' } };
  }

  return {
    ...base,
    style: {
      fill: flat.fill,
      stroke: flat.stroke,
      strokeWidth: flat.strokeWidth ?? 0,
      cornerRadius: flat.borderRadius ?? 0,
    },
    content: {},
  };
}

/**
 * Objet Konva retouché → objet plat.
 * `prev` = l'objet plat d'origine : on part de LUI et on n'écrase que ce que le
 * canevas sait décrire (le modèle Konva ne transporte pas `alt`, `underline`, etc.).
 */
function konvaToFlatObject(obj, prev) {
  const st = obj.style || {};
  const out = {
    ...(prev && typeof prev === 'object' ? prev : {}),
    id: obj.id,
    type: obj.type,
    x: Math.round(obj.x ?? 0),
    y: Math.round(obj.y ?? 0),
    width: Math.round(obj.width ?? 0),
    height: Math.round(obj.height ?? 0),
    rotation: obj.rotation ?? 0,
    opacity: obj.opacity ?? prev?.opacity ?? 1,
    locked: !!obj.locked,
    step: obj.step ?? prev?.step ?? 0,
    visibleFor: obj.visibleFor ?? prev?.visibleFor ?? 'both',
    mindmapNodeId: obj.mindmapNodeId ?? prev?.mindmapNodeId ?? '',
    masterScriptRef: obj.masterScriptRef ?? prev?.masterScriptRef ?? '',
  };

  if (obj.type === 'text') {
    out.text = asText(obj.content?.text);
    out.fontFamily = st.fontFamily ?? prev?.fontFamily;
    out.fontSize = st.fontSize ?? prev?.fontSize;
    out.fontWeight = String(st.fontWeight ?? prev?.fontWeight ?? '400');
    out.color = st.fill ?? prev?.color;
    out.textAlign = st.align ?? prev?.textAlign;
    out.lineHeight = st.lineHeight ?? prev?.lineHeight;
    out.italic = st.fontStyle === 'italic';
    if (typeof st.textDecoration === 'string' && st.textDecoration !== '') {
      out.underline = st.textDecoration.includes('underline');
      out.strikethrough = st.textDecoration.includes('line-through');
    }
    return out;
  }

  if (obj.type === 'image') {
    out.src = obj.content?.src || prev?.src || '';
    return out;
  }

  out.fill = st.fill ?? prev?.fill;
  out.stroke = st.stroke ?? prev?.stroke;
  out.strokeWidth = st.strokeWidth ?? prev?.strokeWidth ?? 0;
  out.borderRadius = st.cornerRadius ?? prev?.borderRadius ?? 0;
  return out;
}

/* ------------------------------------------------------------ champs à préserver */

const RENDER_MODE_LABELS = {
  progressive: 'révélation progressive',
  instant: 'tout afficher',
  spotlight: 'projecteur',
};

/**
 * Les champs que cet écran ne doit JAMAIS toucher, lus sur la ligne relue.
 * Affichés après enregistrement pour preuve visuelle de non-destruction.
 */
function readGuardedFields(scene) {
  const ia = readSceneIaData(scene) || {};
  return [
    {
      key: 'audio_url',
      label: 'Narration (MP3 de la scène)',
      present: !!scene?.audio_url,
      value: scene?.audio_url ? String(scene.audio_url) : '— aucune sur cette scène —',
    },
    {
      key: 'chapter_id',
      label: 'Chapitre',
      present: !!scene?.chapter_id,
      value: scene?.chapter_id ? String(scene.chapter_id) : '— non rattachée —',
    },
    {
      key: 'render_mode',
      label: 'Mode de rendu',
      present: !!scene?.render_mode,
      value: scene?.render_mode
        ? (RENDER_MODE_LABELS[scene.render_mode] || String(scene.render_mode))
        : '— non défini —',
    },
    {
      key: 'ia_sketch',
      label: 'Croquis (ia_data.sketch)',
      present: !!ia.sketch,
      value: ia.sketch ? 'présent' : '— aucun —',
    },
    {
      key: 'ia_slide_summary',
      label: 'Résumé de scène (ia_data.slide_summary)',
      present: !!ia.slide_summary,
      value: ia.slide_summary ? String(ia.slide_summary) : '— aucun —',
    },
    {
      key: 'ia_student_prompt',
      label: 'Question à l’élève (ia_data.student_prompt)',
      present: !!ia.student_prompt,
      value: ia.student_prompt ? String(ia.student_prompt) : '— aucune —',
    },
  ];
}

/** Comparaison brute avant/après : sert uniquement à afficher un verdict honnête. */
function sameValue(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return a === b;
  }
}

/* -------------------------------------------------------------------- composant */

export default function LiveSceneDesignerPage() {
  const { sessionId, sceneId } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');
  const [scene, setScene] = useState(null);
  const [konvaProject, setKonvaProject] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [report, setReport] = useState(null);

  /** Objets PLATS d'origine, par id : base du retour pour ne rien perdre en route. */
  const flatByIdRef = useRef(new Map());
  /** Mode détecté à l'ouverture ('ia' | 'elements') — le patch doit repartir du même. */
  const canvasModeRef = useRef('ia');
  /** Id de scène côté canevas (= id `live_scenes`) pour retrouver la bonne scène au save. */
  const canvasSceneIdRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus('loading');
      setErrorMessage('');
      if (!sessionId || !sceneId) {
        setErrorMessage('Adresse incomplète : il manque la session ou la scène.');
        setStatus('error');
        return;
      }
      const { data, error } = await supabase
        .from('live_scenes')
        .select('*')
        .eq('id', sceneId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setErrorMessage(`Lecture de la scène impossible : ${error.message}`);
        setStatus('error');
        return;
      }
      if (!data) {
        // Aucune ligne = inexistante OU filtrée par la RLS (autre tenant) : on ne peut
        // pas distinguer les deux côté client, le message le dit honnêtement.
        setErrorMessage(
          "Scène introuvable. Soit elle n'existe plus, soit elle appartient à un autre établissement et la sécurité de la base vous l'a masquée.",
        );
        setStatus('error');
        return;
      }
      if (data.live_session_id !== sessionId) {
        setErrorMessage(
          "Cette scène n'appartient pas à la session indiquée dans l'adresse. Rien n'a été chargé, par prudence.",
        );
        setStatus('error');
        return;
      }

      const bridged = liveSceneToKonvaScene(data);
      if (!bridged) {
        setErrorMessage("Cette scène n'a pas de contenu convertible en canevas.");
        setStatus('error');
        return;
      }

      const map = new Map();
      for (const o of bridged.objects) if (o?.id) map.set(o.id, o);
      flatByIdRef.current = map;
      canvasModeRef.current = bridged.mode;
      canvasSceneIdRef.current = bridged.id || data.id;

      setScene(data);
      setKonvaProject({
        version: 1,
        canvas: {
          width: bridged.canvas.width,
          height: bridged.canvas.height,
          background: 'transparent',
        },
        scenes: [{
          id: canvasSceneIdRef.current,
          name: bridged.name || 'Scène',
          objects: bridged.objects.map(flatToKonvaObject),
          sections: [],
          stateInitial: null,
        }],
        activeSceneId: canvasSceneIdRef.current,
      });
      setReport(null);
      setSaveError('');
      setStatus('ready');
    }
    load();
    return () => { cancelled = true; };
  }, [sessionId, sceneId]);

  const handleSave = useCallback(async () => {
    if (!scene) return;
    setSaving(true);
    setSaveError('');
    try {
      const project = useSmartboardKonvaStore.getState().project;
      const target =
        project?.scenes?.find((s) => s.id === canvasSceneIdRef.current)
        || project?.scenes?.find((s) => s.id === project.activeSceneId)
        || project?.scenes?.[0];
      if (!target) {
        setSaveError("Le canevas est vide : rien n'a été envoyé.");
        return;
      }

      const flatObjects = (target.objects || []).map((o) =>
        konvaToFlatObject(o, flatByIdRef.current.get(o.id)),
      );
      const patch = konvaSceneToLiveScenePatch(
        { objects: flatObjects, mode: canvasModeRef.current },
        scene,
        { mode: canvasModeRef.current },
      );

      if (!patch || Object.keys(patch).length === 0) {
        setSaveError('Aucune modification exploitable à enregistrer.');
        return;
      }

      const before = readGuardedFields(scene);
      const { error } = await patchScene(scene.id, patch);
      if (error) {
        setSaveError(`Enregistrement refusé par la base : ${error.message}`);
        return;
      }

      // On RELIT la ligne : le rapport ci-dessous doit décrire la base, pas nos intentions.
      const { data: after, error: reReadError } = await supabase
        .from('live_scenes')
        .select('*')
        .eq('id', scene.id)
        .maybeSingle();
      if (reReadError || !after) {
        setSaveError(
          "Enregistrement effectué, mais la relecture de contrôle a échoué : impossible d'affirmer ici ce qui a été préservé.",
        );
        return;
      }

      const afterFields = readGuardedFields(after);
      setScene(after);
      setReport({
        at: new Date(),
        patchedKeys: Object.keys(patch),
        fields: afterFields.map((f) => {
          const prev = before.find((b) => b.key === f.key);
          return { ...f, preserved: sameValue(prev?.value, f.value) };
        }),
      });
    } catch (e) {
      setSaveError(`Enregistrement interrompu : ${e?.message || String(e)}`);
    } finally {
      setSaving(false);
    }
  }, [scene]);

  const backToPreparation = useCallback(() => {
    navigate(`/studio/live-preparation/${sessionId}`);
  }, [navigate, sessionId]);

  const headerTitle = useMemo(() => scene?.name || 'Scène du direct', [scene]);

  return (
    <div
      data-live-scene-designer
      data-scene-id={sceneId || ''}
      data-live-session-id={sessionId || ''}
      data-designer-status={status}
      className={cn('flex h-screen flex-col overflow-hidden', studioCreatorShellBg)}
    >
      <header className={cn('flex shrink-0 items-center gap-3 px-4 py-3', studioCreatorHeader)}>
        <button
          type="button"
          onClick={backToPreparation}
          data-live-scene-designer-back
          className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-1.5 text-sm text-white/75 transition hover:border-[#e6b878]/50 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Revenir à la préparation
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white/90">{headerTitle}</p>
          <p className="truncate text-[11px] text-white/45">
            Retouche manuelle — seul ce que le canevas décrit sera enregistré.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || status !== 'ready'}
          data-live-scene-designer-save
          className="flex items-center gap-2 rounded-xl bg-[#d99a4e] px-4 py-2 text-sm font-semibold text-[#1a1206] transition hover:bg-[#e6b878] disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer dans le live
        </button>
      </header>

      {status === 'loading' && (
        <div className="flex flex-1 items-center justify-center text-sm text-white/50">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Chargement de la scène…
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className={cn('max-w-lg p-6 text-center', studioCreatorCard)} data-live-scene-designer-error>
            <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-[#e6b878]" />
            <p className="text-sm text-white/80">{errorMessage}</p>
            <button
              type="button"
              onClick={backToPreparation}
              className="mt-5 rounded-xl border border-white/15 px-4 py-2 text-sm text-white/75 transition hover:border-[#e6b878]/50 hover:text-white"
            >
              Revenir à la préparation
            </button>
          </div>
        </div>
      )}

      {status === 'ready' && konvaProject && (
        <div className="flex min-h-0 flex-1">
          <div className="relative min-h-0 min-w-0 flex-1">
            <SmartboardKonvaEditorV1
              // L'éditeur ne consomme `initialKonvaProject` qu'UNE fois (garde interne) :
              // sans remontage, changer de scène rouvrirait la précédente.
              key={sceneId}
              hideChrome
              embedDesignerLeftRail
              initialKonvaProject={konvaProject}
              longiaThreadScopeId={`live-scene-${sceneId}`}
              className="absolute inset-0"
            />
          </div>

          <aside className="flex w-[320px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-white/[0.08] p-3">
            {saveError && (
              <div
                data-live-scene-designer-save-error
                className="rounded-xl border border-[#e6b878]/40 bg-[#e6b878]/10 p-3 text-[12px] text-[#f2d6ac]"
              >
                {saveError}
              </div>
            )}

            {!report && (
              <div className={cn('p-3 text-[12px] leading-relaxed text-white/60', studioCreatorCard)}>
                Le canevas ne porte que le texte et la mise en page de la scène.
                La narration, le chapitre et le mode de rendu ne sont pas éditables ici,
                et ne sont pas non plus envoyés en base : ils restent intacts.
                <br />
                <span className="text-white/40">
                  Un bloc effacé du canevas n’efface PAS la donnée : le pont traite un bloc
                  absent comme « non modifié ». Pour changer un texte, réécrivez-le.
                </span>
              </div>
            )}

            {report && (
              <div
                data-scene-preservation
                className={cn('p-3', studioCreatorCard)}
              >
                <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-white/85">
                  <ShieldCheck className="h-4 w-4 text-[#d99a4e]" />
                  Relu en base après enregistrement
                </div>
                <p className="mb-3 text-[11px] text-white/45">
                  Champs envoyés : {report.patchedKeys.join(', ') || '—'}.
                  Tout le reste ci-dessous n’a pas été touché par cette page.
                </p>
                <ul className="space-y-2">
                  {report.fields.map((f) => (
                    <li
                      key={f.key}
                      data-preserved-field={f.key}
                      data-preserved={f.preserved ? 'true' : 'false'}
                      className="rounded-lg border border-white/[0.07] bg-black/20 p-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] uppercase tracking-wide text-white/45">{f.label}</span>
                        <span
                          className={cn(
                            'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold',
                            f.preserved ? 'bg-[#d99a4e]/20 text-[#e6b878]' : 'bg-red-500/20 text-red-300',
                          )}
                        >
                          {f.preserved ? 'préservé' : 'modifié'}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-[12px] text-white/75">{f.value}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
