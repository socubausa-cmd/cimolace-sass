/**
 * WeekDayEditorPanel — Éditeur des jours et blocs pédagogiques d'une semaine.
 * Pédagogie du Futur / ISNA Platform V2
 */
import React, { useCallback, useEffect, useState } from 'react';
import { X, Plus, Trash2, Pencil, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import {
  WEEKDAY_GRID_LABELS,
  PEDAGOGY_TYPE_OPTIONS,
  BLOCK_TYPE_OPTIONS,
  nextDayNumber,
  nextSortOrder,
} from '@/lib/schoolPathPedagogyConstants';
import PedagogicalBlockEditor from './PedagogicalBlockEditor';

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
  goldMid: 'rgba(212,175,55,0.28)',
  violet: '#7C3AED',
  violetDim: 'rgba(124,58,237,0.12)',
  violetMid: 'rgba(124,58,237,0.28)',
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

/* ─── pedagogy badge colour map ─────────────────────────────────────────── */
const PEDAGOGY_COLOR = {
  generic:                { bg: T.surface3,  color: T.t2 },
  opening_live:           { bg: T.goldDim,   color: T.gold },
  smartboard_session:     { bg: T.violetDim, color: T.violet },
  friction_block:         { bg: 'rgba(239,68,68,0.12)', color: T.danger },
  recall_block:           { bg: T.cyanDim,   color: T.cyan },
  closure_live:           { bg: T.goldMid,   color: T.gold },
  experiment_block:       { bg: T.tealDim,   color: T.teal },
  previsualisation_video: { bg: 'rgba(245,158,11,0.12)', color: T.warning },
};

function pedagogyLabel(value) {
  const opt = PEDAGOGY_TYPE_OPTIONS.find((o) => o.value === value);
  return opt ? opt.label : value;
}

function blockTypeLabel(value) {
  const opt = BLOCK_TYPE_OPTIONS.find((o) => o.value === value);
  return opt ? opt.label : value;
}

/* ─── small shared atoms ─────────────────────────────────────────────────── */
function Badge({ value }) {
  const style = PEDAGOGY_COLOR[value] || { bg: T.surface3, color: T.t2 };
  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.03em',
      backgroundColor: style.bg,
      color: style.color,
      border: `1px solid ${style.color}33`,
    }}>
      {pedagogyLabel(value)}
    </span>
  );
}

function IconBtn({ onClick, title, color = T.t3, children, disabled }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        background: 'none',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color,
        padding: '4px 6px',
        borderRadius: 4,
        display: 'inline-flex',
        alignItems: 'center',
        opacity: disabled ? 0.4 : 1,
        transition: 'color 0.15s',
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div style={{ height: 1, background: T.border, margin: '8px 0' }} />;
}

/* ─── AddDayForm ─────────────────────────────────────────────────────────── */
function AddDayForm({ existingDayNumbers, onAdd, onCancel, busy }) {
  const [dayNumber, setDayNumber] = useState('');
  const [pedagogy, setPedagogy] = useState('generic');
  const [title, setTitle] = useState('');

  const available = WEEKDAY_GRID_LABELS.filter(
    (w) => !existingDayNumbers.includes(w.n)
  );

  useEffect(() => {
    if (available.length && !dayNumber) setDayNumber(String(available[0].n));
  }, [available, dayNumber]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!dayNumber) return;
    onAdd({ day_number: Number(dayNumber), pedagogy_type: pedagogy, title: title.trim() || pedagogyLabel(pedagogy) });
  };

  const inputStyle = {
    background: T.surface3,
    border: `1px solid ${T.borderMid}`,
    borderRadius: 6,
    color: T.t1,
    padding: '6px 10px',
    fontSize: 13,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  const selectStyle = { ...inputStyle };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label style={{ fontSize: 11, color: T.t3, display: 'block', marginBottom: 3 }}>Jour de la semaine</label>
          <select value={dayNumber} onChange={(e) => setDayNumber(e.target.value)} style={selectStyle}>
            {available.map((w) => (
              <option key={w.n} value={w.n}>{w.short} (Jour {w.n})</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: T.t3, display: 'block', marginBottom: 3 }}>Type pédagogique</label>
          <select value={pedagogy} onChange={(e) => setPedagogy(e.target.value)} style={selectStyle}>
            {PEDAGOGY_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label style={{ fontSize: 11, color: T.t3, display: 'block', marginBottom: 3 }}>Titre du jour (optionnel)</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex : Séance d'ouverture"
          style={inputStyle}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button type="button" onClick={onCancel} style={{
          background: 'none', border: `1px solid ${T.border}`, borderRadius: 6,
          color: T.t3, padding: '6px 14px', fontSize: 13, cursor: 'pointer',
        }}>Annuler</button>
        <button type="submit" disabled={busy || !dayNumber} style={{
          background: T.teal, border: 'none', borderRadius: 6,
          color: '#0b0b0f', padding: '6px 16px', fontSize: 13,
          fontWeight: 600, cursor: busy || !dayNumber ? 'not-allowed' : 'pointer',
          opacity: busy || !dayNumber ? 0.6 : 1,
        }}>
          {busy ? 'Ajout…' : 'Ajouter'}
        </button>
      </div>
    </form>
  );
}

/* ─── EditDayForm ────────────────────────────────────────────────────────── */
function EditDayForm({ day, onSave, onCancel, busy }) {
  const [pedagogy, setPedagogy] = useState(day.pedagogy_type || 'generic');
  const [title, setTitle] = useState(day.title || '');

  const inputStyle = {
    background: T.surface3, border: `1px solid ${T.borderMid}`,
    borderRadius: 6, color: T.t1, padding: '6px 10px',
    fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ pedagogy_type: pedagogy, title: title.trim() }); }}
      style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      <div>
        <label style={{ fontSize: 11, color: T.t3, display: 'block', marginBottom: 3 }}>Type pédagogique</label>
        <select value={pedagogy} onChange={(e) => setPedagogy(e.target.value)} style={inputStyle}>
          {PEDAGOGY_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={{ fontSize: 11, color: T.t3, display: 'block', marginBottom: 3 }}>Titre</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{
          background: 'none', border: `1px solid ${T.border}`, borderRadius: 6,
          color: T.t3, padding: '5px 12px', fontSize: 12, cursor: 'pointer',
        }}>Annuler</button>
        <button type="submit" disabled={busy} style={{
          background: T.teal, border: 'none', borderRadius: 6,
          color: '#0b0b0f', padding: '5px 14px', fontSize: 12,
          fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer',
          opacity: busy ? 0.6 : 1,
        }}>Enregistrer</button>
      </div>
    </form>
  );
}

/* ─── BlockRow ───────────────────────────────────────────────────────────── */
function BlockRow({ block, onEdit, onDelete, busy }) {
  const colorMap = {
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
  const accent = colorMap[block.block_type] || T.t3;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '5px 8px', borderRadius: 6,
      background: T.surface2, border: `1px solid ${T.border}`,
      marginBottom: 4,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        backgroundColor: accent, flexShrink: 0,
      }} />
      <span style={{ fontSize: 11, color: T.t3, minWidth: 22, textAlign: 'right' }}>
        #{block.sort_order}
      </span>
      <span style={{ flex: 1, fontSize: 13, color: T.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {block.title || blockTypeLabel(block.block_type)}
      </span>
      <span style={{
        fontSize: 10, color: accent, background: `${accent}18`,
        border: `1px solid ${accent}33`, borderRadius: 4, padding: '1px 6px',
      }}>
        {blockTypeLabel(block.block_type)}
      </span>
      <IconBtn onClick={() => onEdit(block)} title="Modifier" color={T.t3} disabled={busy}>
        <Pencil size={13} />
      </IconBtn>
      <IconBtn onClick={() => onDelete(block.id)} title="Supprimer" color={T.danger} disabled={busy}>
        <Trash2 size={13} />
      </IconBtn>
    </div>
  );
}

/* ─── DayCard ────────────────────────────────────────────────────────────── */
function DayCard({ day, onDayUpdated, onDayDeleted, busy, setBusy, setError }) {
  const [expanded, setExpanded] = useState(false);
  const [editingDay, setEditingDay] = useState(false);
  const [addingBlock, setAddingBlock] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null); // block object
  const [blocks, setBlocks] = useState(day.pedagogical_blocks || []);

  const weekLabel = WEEKDAY_GRID_LABELS.find((w) => w.n === day.day_number);
  const weekShort = weekLabel ? weekLabel.short : `Jour ${day.day_number}`;

  const handleDeleteDay = async () => {
    if (!window.confirm(`Supprimer le jour "${day.title || weekShort}" et tous ses blocs ?`)) return;
    setBusy(true);
    const { error } = await supabase.from('week_days').delete().eq('id', day.id);
    setBusy(false);
    if (error) { setError(error.message); return; }
    onDayDeleted(day.id);
  };

  const handleSaveDay = async (patch) => {
    setBusy(true);
    const { data, error } = await supabase
      .from('week_days')
      .update(patch)
      .eq('id', day.id)
      .select()
      .single();
    setBusy(false);
    if (error) { setError(error.message); return; }
    setEditingDay(false);
    onDayUpdated(data);
  };

  const handleBlockSaved = (savedBlock) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === savedBlock.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = savedBlock;
        return next;
      }
      return [...prev, savedBlock].sort((a, b) => a.sort_order - b.sort_order);
    });
    setAddingBlock(false);
    setEditingBlock(null);
  };

  const handleDeleteBlock = async (blockId) => {
    if (!window.confirm('Supprimer ce bloc ?')) return;
    setBusy(true);
    const { error } = await supabase.from('pedagogical_blocks').delete().eq('id', blockId);
    setBusy(false);
    if (error) { setError(error.message); return; }
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
  };

  const sortedBlocks = [...blocks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 10,
      marginBottom: 10,
      overflow: 'hidden',
    }}>
      {/* Day header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px',
        background: T.surface2,
        borderBottom: expanded ? `1px solid ${T.border}` : 'none',
        cursor: 'pointer',
        userSelect: 'none',
      }} onClick={() => setExpanded((v) => !v)}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: T.teal,
          background: T.tealDim, border: `1px solid ${T.teal}33`,
          borderRadius: 5, padding: '2px 8px', minWidth: 36, textAlign: 'center',
        }}>
          {weekShort}
        </span>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.t1 }}>
          {day.title || `Jour ${day.day_number}`}
        </span>
        <Badge value={day.pedagogy_type || 'generic'} />
        <span style={{ fontSize: 11, color: T.t3, marginLeft: 4 }}>
          {sortedBlocks.length} bloc{sortedBlocks.length !== 1 ? 's' : ''}
        </span>
        <IconBtn
          onClick={(e) => { e.stopPropagation(); setEditingDay((v) => !v); setExpanded(true); }}
          title="Modifier le jour" color={T.t3} disabled={busy}
        >
          <Pencil size={13} />
        </IconBtn>
        <IconBtn
          onClick={(e) => { e.stopPropagation(); handleDeleteDay(); }}
          title="Supprimer le jour" color={T.danger} disabled={busy}
        >
          <Trash2 size={13} />
        </IconBtn>
        {expanded ? <ChevronUp size={14} color={T.t3} /> : <ChevronDown size={14} color={T.t3} />}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '12px 14px' }}>
          {/* Edit day form */}
          {editingDay && (
            <>
              <EditDayForm
                day={day}
                onSave={handleSaveDay}
                onCancel={() => setEditingDay(false)}
                busy={busy}
              />
              <Divider />
            </>
          )}

          {/* Block list */}
          {sortedBlocks.length === 0 && !addingBlock && (
            <p style={{ fontSize: 12, color: T.t3, margin: '0 0 8px', fontStyle: 'italic' }}>
              Aucun bloc. Ajoutez votre premier bloc pédagogique.
            </p>
          )}
          {sortedBlocks.map((block) =>
            editingBlock?.id === block.id ? (
              <div key={block.id} style={{ marginBottom: 8 }}>
                <PedagogicalBlockEditor
                  dayId={day.id}
                  block={block}
                  onSave={handleBlockSaved}
                  onCancel={() => setEditingBlock(null)}
                />
              </div>
            ) : (
              <BlockRow
                key={block.id}
                block={block}
                onEdit={setEditingBlock}
                onDelete={handleDeleteBlock}
                busy={busy}
              />
            )
          )}

          {/* Add block inline */}
          {addingBlock && (
            <div style={{ marginTop: 8 }}>
              <PedagogicalBlockEditor
                dayId={day.id}
                block={null}
                onSave={handleBlockSaved}
                onCancel={() => setAddingBlock(false)}
              />
            </div>
          )}

          {!addingBlock && !editingBlock && (
            <button
              onClick={() => setAddingBlock(true)}
              disabled={busy}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                marginTop: 6, padding: '5px 12px',
                background: T.tealDim, border: `1px dashed ${T.teal}55`,
                borderRadius: 6, color: T.teal, fontSize: 12,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.5 : 1,
              }}
            >
              <Plus size={13} />
              Ajouter un bloc
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── WeekDayEditorPanel (main export) ─────────────────────────────────── */
export default function WeekDayEditorPanel({ weekId, weekTitle, onClose }) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showAddDay, setShowAddDay] = useState(false);

  /* ── load days + blocks on mount ───────────────────────────────────────── */
  const loadDays = useCallback(async () => {
    if (!weekId) return;
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('week_days')
      .select('*, pedagogical_blocks(*)')
      .eq('week_id', weekId)
      .order('day_number');
    setLoading(false);
    if (err) { setError(err.message); return; }
    setDays(data || []);
  }, [weekId]);

  useEffect(() => { loadDays(); }, [loadDays]);

  /* ── add day ────────────────────────────────────────────────────────────── */
  const handleAddDay = async ({ day_number, pedagogy_type, title }) => {
    setBusy(true);
    setError('');
    const { data, error: err } = await supabase
      .from('week_days')
      .insert({ week_id: weekId, day_number, pedagogy_type, title })
      .select('*, pedagogical_blocks(*)')
      .single();
    setBusy(false);
    if (err) { setError(err.message); return; }
    setDays((prev) => [...prev, data].sort((a, b) => a.day_number - b.day_number));
    setShowAddDay(false);
  };

  /* ── day update/delete callbacks ────────────────────────────────────────── */
  const handleDayUpdated = useCallback((updated) => {
    setDays((prev) => prev.map((d) => d.id === updated.id ? { ...d, ...updated } : d));
  }, []);

  const handleDayDeleted = useCallback((id) => {
    setDays((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const existingDayNumbers = days.map((d) => d.day_number);

  /* ── render ─────────────────────────────────────────────────────────────── */
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 760,
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        background: T.bg,
        border: `1px solid ${T.borderMid}`,
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
      }}>
        {/* ── Panel header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 20px',
          background: T.surface,
          borderBottom: `1px solid ${T.border}`,
          flexShrink: 0,
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 11, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Semaine
            </p>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: T.t1 }}>
              {weekTitle || `Semaine ${weekId}`}
            </h2>
          </div>
          {loading && <Loader2 size={16} color={T.teal} style={{ animation: 'spin 1s linear infinite' }} />}
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: T.t3, padding: '4px 6px', borderRadius: 6,
              display: 'flex', alignItems: 'center',
            }}
            title="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div style={{
            padding: '8px 20px', background: 'rgba(239,68,68,0.12)',
            borderBottom: `1px solid rgba(239,68,68,0.25)`,
            color: T.danger, fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* ── Scrollable day list ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {!loading && days.length === 0 && !showAddDay && (
            <p style={{ color: T.t3, fontSize: 14, textAlign: 'center', marginTop: 32, fontStyle: 'italic' }}>
              Aucun jour configuré pour cette semaine.
            </p>
          )}

          {days.map((day) => (
            <DayCard
              key={day.id}
              day={day}
              onDayUpdated={handleDayUpdated}
              onDayDeleted={handleDayDeleted}
              busy={busy}
              setBusy={setBusy}
              setError={setError}
            />
          ))}

          {/* Add day section */}
          {showAddDay ? (
            <div style={{
              background: T.surface,
              border: `1px solid ${T.teal}44`,
              borderRadius: 10,
              padding: '14px 16px',
              marginTop: 8,
            }}>
              <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: T.teal, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Nouveau jour
              </p>
              <AddDayForm
                existingDayNumbers={existingDayNumbers}
                onAdd={handleAddDay}
                onCancel={() => setShowAddDay(false)}
                busy={busy}
              />
            </div>
          ) : (
            existingDayNumbers.length < 7 && (
              <button
                onClick={() => setShowAddDay(true)}
                disabled={busy}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', marginTop: 8, padding: '10px 16px',
                  background: T.tealDim, border: `1px dashed ${T.teal}55`,
                  borderRadius: 10, color: T.teal, fontSize: 13, fontWeight: 600,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.5 : 1,
                  justifyContent: 'center',
                }}
              >
                <Plus size={15} />
                Ajouter un jour
              </button>
            )
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '10px 20px',
          borderTop: `1px solid ${T.border}`,
          background: T.surface,
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 12, color: T.t3 }}>
            {days.length} / 7 jours configurés
          </span>
          <button
            onClick={onClose}
            style={{
              background: T.surface3, border: `1px solid ${T.borderMid}`,
              borderRadius: 7, color: T.t1, padding: '7px 18px', fontSize: 13,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
