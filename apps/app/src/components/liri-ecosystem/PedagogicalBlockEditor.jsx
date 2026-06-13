/**
 * PedagogicalBlockEditor — Formulaire de création/édition d'un bloc pédagogique.
 * Pédagogie du Futur / ISNA Platform V2
 */
import React, { useEffect, useState } from 'react';
import { Plus, Trash2, X, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { BLOCK_TYPE_OPTIONS } from '@/lib/schoolPathPedagogyConstants';

/* ─── design tokens ─────────────────────────────────────────────────────── */
const T = {
  bg: '#0b0b0f',
  surface: '#12111a',
  surface2: 'rgba(25,39,52,0.5)',
  surface3: '#1e2840',
  border: 'rgba(255,255,255,0.07)',
  borderMid: 'rgba(255,255,255,0.12)',
  gold: '#D4AF37',
  goldDim: 'rgba(212,175,55,0.12)',
  violet: '#7C3AED',
  violetDim: 'rgba(124,58,237,0.12)',
  cyan: '#00E5FF',
  cyanDim: 'rgba(0,229,255,0.08)',
  success: '#22C55E',
  danger: '#EF4444',
  warning: '#F59E0B',
  t1: '#F5F5F7',
  t2: 'rgba(245,245,247,0.65)',
  t3: 'rgba(245,245,247,0.38)',
  t4: 'rgba(245,245,247,0.16)',
  teal: '#2dd4bf',
  tealDim: 'rgba(45,212,191,0.12)',
};

/* ─── per-type accent colours ─────────────────────────────────────────── */
const TYPE_ACCENT = {
  previsualisation_video: T.warning,
  opening_live:           T.gold,
  smartboard_session:     T.violet,
  friction_block:         T.danger,
  doctrinal_video:        T.warning,
  experiment_block:       T.teal,
  closure_live:           T.gold,
  recall_block:           T.cyan,
  quiz_block:             '#a78bfa',
  mindmap_block:          '#34d399',
  summary_block:          T.t2,
};

/* ─── shared style helpers ────────────────────────────────────────────── */
function inputStyle(extra = {}) {
  return {
    background: T.surface3,
    border: `1px solid ${T.borderMid}`,
    borderRadius: 6,
    color: T.t1,
    padding: '7px 10px',
    fontSize: 13,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    ...extra,
  };
}

function label(text, required) {
  return (
    <label style={{ fontSize: 11, color: T.t3, display: 'block', marginBottom: 4, letterSpacing: '0.02em' }}>
      {text}
      {required && <span style={{ color: T.danger, marginLeft: 2 }}>*</span>}
    </label>
  );
}

function FieldGroup({ children, style }) {
  return <div style={{ marginBottom: 12, ...style }}>{children}</div>;
}

function SectionTitle({ children }) {
  return (
    <p style={{
      margin: '14px 0 8px',
      fontSize: 11, fontWeight: 700, color: T.teal,
      textTransform: 'uppercase', letterSpacing: '0.06em',
      borderBottom: `1px solid ${T.tealDim}`,
      paddingBottom: 4,
    }}>
      {children}
    </p>
  );
}

function AddItemBtn({ onClick, label: lbl }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 5,
      marginTop: 6, padding: '4px 10px',
      background: T.tealDim, border: `1px dashed ${T.teal}55`,
      borderRadius: 5, color: T.teal, fontSize: 12, cursor: 'pointer',
    }}>
      <Plus size={12} />
      {lbl}
    </button>
  );
}

/* ─── dynamic DATA fields by block type ──────────────────────────────── */

function VideoFields({ data, onChange }) {
  return (
    <>
      <FieldGroup>
        {label('URL de la vidéo', true)}
        <input
          value={data.video_url || ''}
          onChange={(e) => onChange({ ...data, video_url: e.target.value })}
          placeholder="https://…"
          style={inputStyle()}
        />
      </FieldGroup>
      <FieldGroup>
        {label('Durée (secondes)')}
        <input
          type="number" min="0"
          value={data.duration_seconds || ''}
          onChange={(e) => onChange({ ...data, duration_seconds: Number(e.target.value) })}
          placeholder="Ex : 300"
          style={inputStyle({ width: 160 })}
        />
      </FieldGroup>
    </>
  );
}

function LiveFields({ data, onChange }) {
  return (
    <FieldGroup>
      {label('Date/heure planifiée', true)}
      <input
        type="datetime-local"
        value={data.scheduled_at ? data.scheduled_at.slice(0, 16) : ''}
        onChange={(e) => onChange({ ...data, scheduled_at: e.target.value })}
        style={inputStyle({ width: 240 })}
      />
    </FieldGroup>
  );
}

function SmartboardFields({ data, onChange }) {
  return (
    <FieldGroup>
      {label('ID du deck SmartBoard')}
      <input
        value={data.deck_id || ''}
        onChange={(e) => onChange({ ...data, deck_id: e.target.value })}
        placeholder="deck_xxxxxx"
        style={inputStyle()}
      />
    </FieldGroup>
  );
}

function FrictionFields({ data, onChange }) {
  return (
    <>
      <FieldGroup>
        {label('Texte du défi', true)}
        <textarea
          value={data.challenge_text || ''}
          onChange={(e) => onChange({ ...data, challenge_text: e.target.value })}
          rows={3}
          placeholder="Décrivez le défi ou la friction pédagogique…"
          style={inputStyle({ resize: 'vertical' })}
        />
      </FieldGroup>
      <FieldGroup>
        {label('Indice (optionnel)')}
        <textarea
          value={data.hint_text || ''}
          onChange={(e) => onChange({ ...data, hint_text: e.target.value })}
          rows={2}
          placeholder="Indice pour débloquer l'apprenant…"
          style={inputStyle({ resize: 'vertical' })}
        />
      </FieldGroup>
    </>
  );
}

function ExperimentFields({ data, onChange }) {
  return (
    <FieldGroup>
      {label('Instructions', true)}
      <textarea
        value={data.instructions || ''}
        onChange={(e) => onChange({ ...data, instructions: e.target.value })}
        rows={4}
        placeholder="Décrivez les étapes de l'expérimentation…"
        style={inputStyle({ resize: 'vertical' })}
      />
    </FieldGroup>
  );
}

function RecallFields({ data, onChange }) {
  return (
    <FieldGroup>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          id="auto_from_session"
          type="checkbox"
          checked={!!data.auto_from_session}
          onChange={(e) => onChange({ ...data, auto_from_session: e.target.checked })}
          style={{ accentColor: T.teal, width: 16, height: 16 }}
        />
        <label htmlFor="auto_from_session" style={{ fontSize: 13, color: T.t2, cursor: 'pointer' }}>
          Générer automatiquement depuis la session précédente
        </label>
      </div>
    </FieldGroup>
  );
}

/* ─── QuizBuilder ────────────────────────────────────────────────────── */
function QuizBuilder({ data, onChange }) {
  const questions = data.questions || [];

  const updateQuestion = (idx, patch) => {
    const next = questions.map((q, i) => (i === idx ? { ...q, ...patch } : q));
    onChange({ ...data, questions: next });
  };

  const addQuestion = () => {
    onChange({
      ...data,
      questions: [...questions, { question: '', answers: ['', ''], correct_index: 0 }],
    });
  };

  const removeQuestion = (idx) => {
    onChange({ ...data, questions: questions.filter((_, i) => i !== idx) });
  };

  const updateAnswer = (qIdx, aIdx, value) => {
    const next = questions.map((q, i) => {
      if (i !== qIdx) return q;
      const answers = q.answers.map((a, j) => (j === aIdx ? value : a));
      return { ...q, answers };
    });
    onChange({ ...data, questions: next });
  };

  const addAnswer = (qIdx) => {
    const next = questions.map((q, i) => {
      if (i !== qIdx) return q;
      return { ...q, answers: [...q.answers, ''] };
    });
    onChange({ ...data, questions: next });
  };

  const removeAnswer = (qIdx, aIdx) => {
    const next = questions.map((q, i) => {
      if (i !== qIdx) return q;
      const answers = q.answers.filter((_, j) => j !== aIdx);
      const correct_index = q.correct_index >= answers.length ? 0 : q.correct_index;
      return { ...q, answers, correct_index };
    });
    onChange({ ...data, questions: next });
  };

  return (
    <div>
      {questions.map((q, qi) => (
        <div key={qi} style={{
          background: T.surface2, border: `1px solid ${T.border}`,
          borderRadius: 8, padding: '10px 12px', marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: T.teal, fontWeight: 700, paddingTop: 2, minWidth: 20 }}>Q{qi + 1}</span>
            <input
              value={q.question}
              onChange={(e) => updateQuestion(qi, { question: e.target.value })}
              placeholder={`Question ${qi + 1}`}
              style={inputStyle({ flex: 1 })}
            />
            <button type="button" onClick={() => removeQuestion(qi)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: T.danger, padding: '4px 5px',
            }}>
              <Trash2 size={13} />
            </button>
          </div>

          <div style={{ paddingLeft: 28 }}>
            {label('Réponses (cocher la bonne)')}
            {q.answers.map((a, ai) => (
              <div key={ai} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <input
                  type="radio"
                  name={`correct_q${qi}`}
                  checked={q.correct_index === ai}
                  onChange={() => updateQuestion(qi, { correct_index: ai })}
                  style={{ accentColor: T.success, flexShrink: 0 }}
                />
                <input
                  value={a}
                  onChange={(e) => updateAnswer(qi, ai, e.target.value)}
                  placeholder={`Réponse ${ai + 1}`}
                  style={inputStyle({ flex: 1 })}
                />
                {q.answers.length > 2 && (
                  <button type="button" onClick={() => removeAnswer(qi, ai)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: T.t3, padding: '2px 4px',
                  }}>
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
            <AddItemBtn onClick={() => addAnswer(qi)} label="Ajouter une réponse" />
          </div>
        </div>
      ))}
      <AddItemBtn onClick={addQuestion} label="Ajouter une question" />
    </div>
  );
}

/* ─── MindmapFields ──────────────────────────────────────────────────── */
function MindmapFields({ data, onChange }) {
  return (
    <FieldGroup>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          id="auto_generate"
          type="checkbox"
          checked={!!data.auto_generate}
          onChange={(e) => onChange({ ...data, auto_generate: e.target.checked })}
          style={{ accentColor: T.teal, width: 16, height: 16 }}
        />
        <label htmlFor="auto_generate" style={{ fontSize: 13, color: T.t2, cursor: 'pointer' }}>
          Générer automatiquement la mindmap depuis les contenus du jour
        </label>
      </div>
    </FieldGroup>
  );
}

/* ─── SummaryBuilder ─────────────────────────────────────────────────── */
function SummaryBuilder({ data, onChange }) {
  const points = data.key_points || [];

  const updatePoint = (idx, value) => {
    const next = points.map((p, i) => (i === idx ? value : p));
    onChange({ ...data, key_points: next });
  };

  const addPoint = () => onChange({ ...data, key_points: [...points, ''] });

  const removePoint = (idx) => onChange({
    ...data,
    key_points: points.filter((_, i) => i !== idx),
  });

  return (
    <div>
      {points.map((pt, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: T.t3, minWidth: 18 }}>{i + 1}.</span>
          <input
            value={pt}
            onChange={(e) => updatePoint(i, e.target.value)}
            placeholder={`Point clé ${i + 1}`}
            style={inputStyle({ flex: 1 })}
          />
          <button type="button" onClick={() => removePoint(i)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: T.t3, padding: '2px 4px',
          }}>
            <X size={12} />
          </button>
        </div>
      ))}
      <AddItemBtn onClick={addPoint} label="Ajouter un point clé" />
    </div>
  );
}

/* ─── DATA section dispatcher ─────────────────────────────────────────── */
function DataSection({ blockType, data, onChange }) {
  switch (blockType) {
    case 'previsualisation_video':
    case 'doctrinal_video':
      return <VideoFields data={data} onChange={onChange} />;
    case 'opening_live':
    case 'closure_live':
      return <LiveFields data={data} onChange={onChange} />;
    case 'smartboard_session':
      return <SmartboardFields data={data} onChange={onChange} />;
    case 'friction_block':
      return <FrictionFields data={data} onChange={onChange} />;
    case 'experiment_block':
      return <ExperimentFields data={data} onChange={onChange} />;
    case 'recall_block':
      return <RecallFields data={data} onChange={onChange} />;
    case 'quiz_block':
      return <QuizBuilder data={data} onChange={onChange} />;
    case 'mindmap_block':
      return <MindmapFields data={data} onChange={onChange} />;
    case 'summary_block':
      return <SummaryBuilder data={data} onChange={onChange} />;
    default:
      return (
        <p style={{ fontSize: 12, color: T.t3, fontStyle: 'italic' }}>
          Aucune configuration spécifique pour ce type.
        </p>
      );
  }
}

/* ─── PedagogicalBlockEditor (main export) ─────────────────────────── */
export default function PedagogicalBlockEditor({ dayId, block, onSave, onCancel }) {
  const isEdit = !!block;

  const [blockType, setBlockType] = useState(block?.block_type || BLOCK_TYPE_OPTIONS[0].value);
  const [title, setTitle] = useState(block?.title || '');
  const [sortOrder, setSortOrder] = useState(block?.sort_order ?? 0);
  const [data, setData] = useState(block?.data || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  /* reset data when type changes (keep only if same type) */
  const handleTypeChange = (newType) => {
    if (newType !== blockType) setData({});
    setBlockType(newType);
  };

  const accent = TYPE_ACCENT[blockType] || T.t2;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const payload = {
      day_id: dayId,
      block_type: blockType,
      title: title.trim(),
      sort_order: Number(sortOrder),
      data,
    };

    let result;
    if (isEdit) {
      result = await supabase
        .from('pedagogical_blocks')
        .update(payload)
        .eq('id', block.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('pedagogical_blocks')
        .insert(payload)
        .select()
        .single();
    }

    setSaving(false);
    if (result.error) {
      setError(result.error.message || 'Erreur lors de la sauvegarde');
      return;
    }
    onSave(result.data);
  };

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${accent}44`,
      borderRadius: 10,
      padding: '14px 16px',
      boxShadow: `0 0 0 1px ${accent}18 inset`,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <p style={{
          margin: 0, fontSize: 12, fontWeight: 700, color: accent,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {isEdit ? 'Modifier le bloc' : 'Nouveau bloc pédagogique'}
        </p>
        <button type="button" onClick={onCancel} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: T.t3, padding: '2px 4px',
        }}>
          <X size={15} />
        </button>
      </div>

      {error && (
        <div style={{
          padding: '7px 10px', marginBottom: 12,
          background: 'rgba(239,68,68,0.12)', border: `1px solid rgba(239,68,68,0.3)`,
          borderRadius: 6, color: T.danger, fontSize: 12,
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* ── Core fields ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
          <FieldGroup style={{ marginBottom: 0 }}>
            {label('Type de bloc', true)}
            <select
              value={blockType}
              onChange={(e) => handleTypeChange(e.target.value)}
              style={{
                ...inputStyle(),
                borderColor: `${accent}55`,
                color: accent,
              }}
            >
              {BLOCK_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </FieldGroup>

          <FieldGroup style={{ marginBottom: 0 }}>
            {label('Ordre d\'affichage')}
            <input
              type="number" min="0"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              style={inputStyle({ width: '100%' })}
            />
          </FieldGroup>
        </div>

        <FieldGroup>
          {label('Titre du bloc')}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`Ex : ${BLOCK_TYPE_OPTIONS.find((o) => o.value === blockType)?.label || 'Bloc'}`}
            style={inputStyle()}
          />
        </FieldGroup>

        {/* ── Dynamic data fields ── */}
        <SectionTitle>Configuration — {BLOCK_TYPE_OPTIONS.find((o) => o.value === blockType)?.label}</SectionTitle>
        <DataSection blockType={blockType} data={data} onChange={setData} />

        {/* ── Actions ── */}
        <div style={{
          display: 'flex', gap: 8, justifyContent: 'flex-end',
          marginTop: 16, paddingTop: 12, borderTop: `1px solid ${T.border}`,
        }}>
          <button type="button" onClick={onCancel} disabled={saving} style={{
            background: 'none', border: `1px solid ${T.border}`,
            borderRadius: 7, color: T.t3, padding: '7px 16px', fontSize: 13,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.5 : 1,
          }}>
            Annuler
          </button>
          <button type="submit" disabled={saving} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: accent, border: 'none', borderRadius: 7,
            color: '#0b0b0f', padding: '7px 20px', fontSize: 13, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}>
            {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
            {saving ? 'Sauvegarde…' : isEdit ? 'Enregistrer' : 'Créer le bloc'}
          </button>
        </div>
      </form>
    </div>
  );
}
