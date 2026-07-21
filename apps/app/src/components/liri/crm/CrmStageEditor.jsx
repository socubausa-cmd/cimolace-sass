import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, ChevronUp, ChevronDown, Trophy, Ban, Loader2, GripVertical } from 'lucide-react';
import { crmApi } from '@/lib/api-v2';
import { useToast } from '@/components/ui/use-toast';

/* ── Éditeur d'étapes du pipeline (#10) — ajout / renommage / win% / gagné-perdu / ordre / suppression.
   Charte LIRI : warm dark, accent coral. Chaque changement persiste via /crm/stages. */

export default function CrmStageEditor({ pipelineId, onClose, onChanged }) {
  const { toast } = useToast();
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const dirty = useRef(false);
  const err = (e) => toast({ title: 'Étapes', description: String(e?.message || e), variant: 'destructive' });

  const load = useCallback(async () => {
    if (!pipelineId) return;
    setLoading(true);
    try {
      const s = await crmApi.listStages(pipelineId);
      setStages((Array.isArray(s) ? s : s?.stages ?? []).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)));
    } catch (e) { err(e); } finally { setLoading(false); }
  }, [pipelineId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => { if (dirty.current) onChanged?.(); onClose(); };

  const patch = async (id, body) => {
    setBusy(true);
    try { await crmApi.updateStage(id, body); dirty.current = true; await load(); }
    catch (e) { err(e); } finally { setBusy(false); }
  };
  const add = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await crmApi.createStage({ pipeline_id: pipelineId, name, position: stages.length, win_probability: 10 });
      setNewName(''); dirty.current = true; await load();
    } catch (e) { err(e); } finally { setBusy(false); }
  };
  const del = async (id) => {
    if (busy) return;
    setBusy(true);
    try { await crmApi.deleteStage(id); dirty.current = true; await load(); }
    catch (e) { err(e); } finally { setBusy(false); }
  };
  const move = async (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= stages.length || busy) return;
    const a = stages[idx]; const b = stages[j];
    setBusy(true);
    try {
      await crmApi.updateStage(a.id, { position: b.position ?? j });
      await crmApi.updateStage(b.id, { position: a.position ?? idx });
      dirty.current = true; await load();
    } catch (e) { err(e); } finally { setBusy(false); }
  };
  const renameOnBlur = (s, value) => {
    const name = value.trim();
    if (name && name !== s.name) patch(s.id, { name });
  };
  const setWon = (s) => patch(s.id, { is_won: !s.is_won, is_lost: false });
  const setLost = (s) => patch(s.id, { is_lost: !s.is_lost, is_won: false });

  return createPortal(
    <div className="fixed inset-0 z-[65] flex items-start justify-center px-4 pt-[8vh]" onClick={close}>
      <div className="absolute inset-0 backdrop-blur-[2px]" style={{ background: 'rgba(15,12,10,.55)' }} />
      <div
        role="dialog" aria-modal="true" aria-label="Gérer les étapes"
        className="relative w-full max-w-[560px] overflow-hidden rounded-2xl border lp-line shadow-2xl"
        style={{ background: 'var(--crm-sunken, #211f1b)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b lp-line px-5 py-4">
          <div>
            <h2 className="text-[16px] font-semibold lp-ink">Étapes du pipeline</h2>
            <p className="mt-0.5 text-[12px] lp-faint">Un deal déplacé dans une étape « gagné/perdu » change de statut automatiquement.</p>
          </div>
          <div className="flex items-center gap-2">
            {busy && <Loader2 size={15} className="animate-spin lp-faint" />}
            <button type="button" aria-label="Fermer" onClick={close} className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg lp-muted lp-railbtn lp-tr"><X size={17} /></button>
          </div>
        </header>

        <div className="lp-scroll max-h-[56vh] overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 rounded-xl lp-panel animate-pulse" />)}</div>
          ) : (
            <div className="space-y-1.5">
              {stages.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 rounded-xl border lp-line lp-panel70 px-2.5 py-2">
                  <div className="flex shrink-0 flex-col">
                    <button type="button" aria-label="Monter" disabled={i === 0} onClick={() => move(i, -1)} className="cursor-pointer lp-faint hover:lp-ink disabled:opacity-25"><ChevronUp size={13} /></button>
                    <button type="button" aria-label="Descendre" disabled={i === stages.length - 1} onClick={() => move(i, 1)} className="cursor-pointer lp-faint hover:lp-ink disabled:opacity-25"><ChevronDown size={13} /></button>
                  </div>
                  <GripVertical size={13} className="shrink-0 lp-faint" />
                  <input
                    defaultValue={s.name} key={`${s.id}-${s.name}`}
                    onBlur={(e) => renameOnBlur(s, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    className="min-w-0 flex-1 bg-transparent py-1 text-[13.5px] lp-ink outline-none"
                  />
                  <div className="flex shrink-0 items-center gap-1 text-[11.5px] lp-faint">
                    <input
                      type="number" min={0} max={100} defaultValue={s.win_probability ?? 0} key={`${s.id}-p-${s.win_probability}`}
                      onBlur={(e) => { const v = Math.max(0, Math.min(100, Number(e.target.value) || 0)); if (v !== (s.win_probability ?? 0)) patch(s.id, { win_probability: v }); }}
                      className="w-11 rounded-md border lp-line bg-transparent px-1.5 py-1 text-right lp-ink outline-none"
                    /> %
                  </div>
                  <button type="button" aria-label="Étape gagnée" onClick={() => setWon(s)} title="Marque les deals comme gagnés"
                    className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg lp-tr"
                    style={s.is_won ? { background: 'color-mix(in srgb, var(--crm-accent) 16%, transparent)', color: 'var(--crm-accent-soft, #e08a63)' } : { color: 'var(--faint)' }}><Trophy size={13} /></button>
                  <button type="button" aria-label="Étape perdue" onClick={() => setLost(s)} title="Marque les deals comme perdus"
                    className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg lp-tr"
                    style={s.is_lost ? { background: 'rgba(220,180,120,.14)', color: 'var(--crm-gold, #cba36b)' } : { color: 'var(--faint)' }}><Ban size={13} /></button>
                  <button type="button" aria-label="Supprimer l'étape" disabled={stages.length <= 1} onClick={() => del(s.id)}
                    className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg lp-tr disabled:opacity-25" style={{ color: 'var(--crm-accent-2, #e0a48f)' }}><Trash2 size={13} /></button>
                </div>
              ))}
              {stages.length === 0 && <p className="px-1 py-4 text-center text-[12.5px] lp-faint">Aucune étape.</p>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t lp-line px-4 py-3">
          <input
            value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Nom de la nouvelle étape…"
            className="min-w-0 flex-1 rounded-lg border lp-line bg-[rgba(245,244,238,.03)] px-3 py-2 text-[13.5px] lp-ink outline-none placeholder:text-[var(--faint)]"
          />
          <button type="button" onClick={add} disabled={busy || !newName.trim()}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-white lp-ember lp-tr disabled:opacity-45">
            <Plus size={15} /> Ajouter
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
