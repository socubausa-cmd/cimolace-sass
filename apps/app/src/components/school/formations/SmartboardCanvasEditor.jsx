/**
 * SmartboardCanvasEditor — studio canevas type Canva (1037×750) pour infographies cours.
 * Banque de polices filtrable, icônes / graphiques, calques, undo/redo, formes, images.
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Layers, Undo2, Redo2, Trash2, Copy, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { uploadSmartboardCanvasImage } from '@/lib/uploadSmartboardCanvasImage';
import { SB_ICON_LIBRARY } from '@/config/smartboardEditorTools';
import { filterCanvasFonts, SB_CANVAS_FONT_CATEGORIES } from '@/config/smartboardCanvasFonts';
import {
  CANVAS_W,
  CANVAS_H,
  SB_CANVAS_GOLD,
  SB_CANVAS_GOLD_DIM,
  SB_CANVAS_TEMPLATES,
  mkCanvasText,
  mkCanvasShape,
  genCanvasObjectId,
} from '@/lib/smartboardCanvasModel';
import CanvasTextFormatToolbar from '@/components/school/formations/CanvasTextFormatToolbar';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const GOLD = SB_CANVAS_GOLD;
const GOLD_DIM = SB_CANVAS_GOLD_DIM;
const GOLD_B = `2px solid ${GOLD}`;

const TOOL_TABS = [
  { id: 'text', label: 'Texte', icon: 'T' },
  { id: 'templates', label: 'Modèles', icon: '▦' },
  { id: 'shapes', label: 'Formes', icon: '◻' },
  { id: 'elements', label: 'Graphiques', icon: '⬡' },
  { id: 'images', label: 'Images', icon: '🖼' },
  { id: 'layers', label: 'Calques', icon: '≡' },
];

const ALL_GRAPHICS = Object.entries(SB_ICON_LIBRARY).flatMap(([, cat]) =>
  (cat.items || []).map((icon) => ({ icon, category: cat.label })),
);

function RenderObject({ obj, scale, selected, onMouseDown }) {
  const style = {
    position: 'absolute',
    left: obj.x * scale,
    top: obj.y * scale,
    width: obj.width * scale,
    height: obj.height * scale,
    opacity: obj.opacity ?? 1,
    transform: `rotate(${obj.rotation || 0}deg)`,
    cursor: obj.locked ? 'not-allowed' : 'move',
    userSelect: 'none',
    boxSizing: 'border-box',
  };

  if (obj.type === 'text') {
    const ta = obj.textAlign || 'left';
    const td = [];
    if (obj.underline) td.push('underline');
    if (obj.strikethrough) td.push('line-through');
    const lhRaw = obj.lineHeight;
    const lh =
      lhRaw != null && lhRaw !== '' && !Number.isNaN(Number(lhRaw)) ? Number(lhRaw) : 1.35;
    return (
      <div
        style={{
          ...style,
          fontFamily: obj.fontFamily,
          fontSize: (obj.fontSize || 16) * scale,
          fontWeight: obj.fontWeight || '400',
          fontStyle: obj.italic ? 'italic' : 'normal',
          color: obj.color || '#111',
          textAlign: ta,
          textDecoration: td.length ? td.join(' ') : undefined,
          lineHeight: lh,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          padding: `${2 * scale}px ${4 * scale}px`,
          outline: selected ? GOLD_B : 'none',
          background: selected ? GOLD_DIM : 'transparent',
          borderRadius: 4,
          display: 'block',
          boxSizing: 'border-box',
        }}
        onMouseDown={onMouseDown}
      >
        {obj.text}
      </div>
    );
  }

  if (obj.type === 'rect') {
    return (
      <div
        style={{
          ...style,
          background: obj.fill || GOLD_DIM,
          border: `${(obj.strokeWidth || 1) * scale}px solid ${obj.stroke || GOLD}`,
          borderRadius: (obj.borderRadius || 8) * scale,
          outline: selected ? GOLD_B : 'none',
        }}
        onMouseDown={onMouseDown}
      />
    );
  }

  if (obj.type === 'circle') {
    return (
      <div
        style={{
          ...style,
          background: obj.fill || GOLD_DIM,
          border: `${(obj.strokeWidth || 1) * scale}px solid ${obj.stroke || GOLD}`,
          borderRadius: '50%',
          outline: selected ? GOLD_B : 'none',
        }}
        onMouseDown={onMouseDown}
      />
    );
  }

  if (obj.type === 'arrow') {
    return (
      <div
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          outline: selected ? GOLD_B : 'none',
        }}
        onMouseDown={onMouseDown}
      >
        <div style={{ flex: 1, height: 3 * scale, background: obj.fill || GOLD }} />
        <div
          style={{
            width: 0,
            height: 0,
            borderTop: `${10 * scale}px solid transparent`,
            borderBottom: `${10 * scale}px solid transparent`,
            borderLeft: `${16 * scale}px solid ${obj.fill || GOLD}`,
          }}
        />
      </div>
    );
  }

  if (obj.type === 'image' && obj.src) {
    return (
      <div
        style={{
          ...style,
          outline: selected ? GOLD_B : 'none',
          overflow: 'hidden',
        }}
        onMouseDown={onMouseDown}
      >
        <img src={obj.src} alt="" className="h-full w-full object-contain pointer-events-none" draggable={false} />
      </div>
    );
  }

  return null;
}

const HANDLES = ['tl', 'tm', 'tr', 'ml', 'mr', 'bl', 'bm', 'br'];

function SelectionHandles({ obj, scale, onHandleDown }) {
  const hw = 8;
  const positions = {
    tl: { left: obj.x * scale - hw / 2, top: obj.y * scale - hw / 2 },
    tm: { left: (obj.x + obj.width / 2) * scale - hw / 2, top: obj.y * scale - hw / 2 },
    tr: { left: (obj.x + obj.width) * scale - hw / 2, top: obj.y * scale - hw / 2 },
    ml: { left: obj.x * scale - hw / 2, top: (obj.y + obj.height / 2) * scale - hw / 2 },
    mr: { left: (obj.x + obj.width) * scale - hw / 2, top: (obj.y + obj.height / 2) * scale - hw / 2 },
    bl: { left: obj.x * scale - hw / 2, top: (obj.y + obj.height) * scale - hw / 2 },
    bm: { left: (obj.x + obj.width / 2) * scale - hw / 2, top: (obj.y + obj.height) * scale - hw / 2 },
    br: { left: (obj.x + obj.width) * scale - hw / 2, top: (obj.y + obj.height) * scale - hw / 2 },
  };
  const cursors = {
    tl: 'nwse-resize',
    tm: 'ns-resize',
    tr: 'nesw-resize',
    ml: 'ew-resize',
    mr: 'ew-resize',
    bl: 'nesw-resize',
    bm: 'ns-resize',
    br: 'nwse-resize',
  };
  return (
    <>
      {HANDLES.map((h) => (
        <div
          key={h}
          role="presentation"
          onMouseDown={(e) => {
            e.stopPropagation();
            onHandleDown(h, e);
          }}
          style={{
            position: 'absolute',
            ...positions[h],
            width: hw,
            height: hw,
            background: '#fff',
            border: `2px solid ${GOLD}`,
            borderRadius: 2,
            cursor: cursors[h],
            zIndex: 1000,
            pointerEvents: 'all',
          }}
        />
      ))}
    </>
  );
}

export default function SmartboardCanvasEditor({
  objects,
  onObjectsChange,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [activeTool, setActiveTool] = useState('text');
  const [canvasScale, setCanvasScale] = useState(0.52);
  const [fontSearch, setFontSearch] = useState('');
  const [fontCat, setFontCat] = useState('');
  const [graphicSearch, setGraphicSearch] = useState('');
  const [rightTab, setRightTab] = useState('props'); // props | layers
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');

  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const dragRef = useRef(null);
  const objectsRef = useRef(objects);
  objectsRef.current = objects;

  const commit = useCallback(
    (next) => {
      const cur = objectsRef.current;
      pastRef.current.push(JSON.stringify(cur));
      if (pastRef.current.length > 48) pastRef.current.shift();
      futureRef.current = [];
      onObjectsChange(next);
    },
    [onObjectsChange],
  );

  const undo = useCallback(() => {
    const past = pastRef.current;
    if (!past.length) return;
    const prev = past.pop();
    futureRef.current.push(JSON.stringify(objectsRef.current));
    try {
      onObjectsChange(JSON.parse(prev));
    } catch {
      /* ignore */
    }
  }, [onObjectsChange]);

  const redo = useCallback(() => {
    const fut = futureRef.current;
    if (!fut.length) return;
    const nxt = fut.pop();
    pastRef.current.push(JSON.stringify(objectsRef.current));
    try {
      onObjectsChange(JSON.parse(nxt));
    } catch {
      /* ignore */
    }
  }, [onObjectsChange]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.closest?.('input, textarea, select')) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd' && selectedId) {
        e.preventDefault();
        const obj = objects.find((o) => o.id === selectedId);
        if (obj) {
          const dup = { ...obj, id: genCanvasObjectId(), x: obj.x + 16, y: obj.y + 16 };
          commit([...objects, dup]);
          setSelectedId(dup.id);
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId && !e.target?.closest?.('input, textarea')) {
          e.preventDefault();
          commit(objects.filter((o) => o.id !== selectedId));
          setSelectedId(null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [objects, selectedId, commit, undo, redo]);

  const selectedObj = objects.find((o) => o.id === selectedId) || null;

  const updateObject = useCallback(
    (id, delta) => {
      commit(objects.map((o) => (o.id === id ? { ...o, ...delta } : o)));
    },
    [objects, commit],
  );

  const addObject = useCallback(
    (type, props) => {
      if (type === 'template') {
        const tpl = SB_CANVAS_TEMPLATES[props];
        if (!tpl) return;
        const newObjs = tpl.objects.map((o) => ({ ...o, id: genCanvasObjectId() }));
        commit([...objects, ...newObjs]);
        return;
      }
      if (type === 'image') {
        const obj = {
          id: genCanvasObjectId(),
          type: 'image',
          x: 100,
          y: 100,
          width: props.width || 320,
          height: props.height || 220,
          src: props.src,
          opacity: 1,
          rotation: 0,
          locked: false,
          visibleFor: 'both',
          step: 0,
          mindmapNodeId: '',
          masterScriptRef: '',
        };
        commit([...objects, obj]);
        setSelectedId(obj.id);
        return;
      }
      const centerX = Math.round(CANVAS_W / 2 - (props?.width || 200) / 2);
      const centerY = Math.round(CANVAS_H / 2 - (props?.height || 100) / 2);
      const obj =
        type === 'text'
          ? mkCanvasText({ x: centerX, y: centerY, ...props })
          : mkCanvasShape(type, { x: centerX, y: centerY, ...props });
      commit([...objects, obj]);
      setSelectedId(obj.id);
    },
    [objects, commit],
  );

  const deleteObject = useCallback(
    (id) => {
      commit(objects.filter((o) => o.id !== id));
      setSelectedId(null);
    },
    [objects, commit],
  );

  const duplicateObject = useCallback(
    (id) => {
      const obj = objects.find((o) => o.id === id);
      if (!obj) return;
      const dup = { ...obj, id: genCanvasObjectId(), x: obj.x + 20, y: obj.y + 20 };
      commit([...objects, dup]);
      setSelectedId(dup.id);
    },
    [objects, commit],
  );

  const moveLayer = useCallback(
    (id, dir) => {
      const i = objects.findIndex((o) => o.id === id);
      if (i < 0) return;
      const j = i + dir;
      if (j < 0 || j >= objects.length) return;
      const next = [...objects];
      [next[i], next[j]] = [next[j], next[i]];
      commit(next);
    },
    [objects, commit],
  );

  const onObjectMouseDown = useCallback(
    (e, id) => {
      e.stopPropagation();
      const obj = objects.find((o) => o.id === id);
      if (!obj || obj.locked) return;
      setSelectedId(id);
      pastRef.current.push(JSON.stringify(objectsRef.current));
      if (pastRef.current.length > 48) pastRef.current.shift();
      futureRef.current = [];
      const startX = e.clientX;
      const startY = e.clientY;
      const objX = obj.x;
      const objY = obj.y;
      dragRef.current = { id, startX, startY, objX, objY };

      const onMove = (me) => {
        if (!dragRef.current) return;
        const dx = (me.clientX - startX) / canvasScale;
        const dy = (me.clientY - startY) / canvasScale;
        onObjectsChange(
          objectsRef.current.map((o) =>
            o.id === id ? { ...o, x: Math.round(objX + dx), y: Math.round(objY + dy) } : o,
          ),
        );
      };
      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [objects, canvasScale, onObjectsChange],
  );

  const onHandleMouseDown = useCallback(
    (e, handle, id) => {
      e.stopPropagation();
      const obj = objects.find((o) => o.id === id);
      if (!obj) return;
      pastRef.current.push(JSON.stringify(objectsRef.current));
      if (pastRef.current.length > 48) pastRef.current.shift();
      futureRef.current = [];
      const startX = e.clientX;
      const startY = e.clientY;
      const origObj = { ...obj };

      const onMove = (me) => {
        const dx = (me.clientX - startX) / canvasScale;
        const dy = (me.clientY - startY) / canvasScale;
        let { x, y, width, height } = origObj;
        if (handle.includes('r')) width = Math.max(30, origObj.width + dx);
        if (handle.includes('l')) {
          x = origObj.x + dx;
          width = Math.max(30, origObj.width - dx);
        }
        if (handle.includes('b')) height = Math.max(20, origObj.height + dy);
        if (handle.includes('t')) {
          y = origObj.y + dy;
          height = Math.max(20, origObj.height - dy);
        }
        onObjectsChange(
          objectsRef.current.map((o) =>
            o.id === id ? { ...o, x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) } : o,
          ),
        );
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [objects, canvasScale, onObjectsChange],
  );

  const filteredFonts = useMemo(() => filterCanvasFonts(fontSearch, fontCat || null), [fontSearch, fontCat]);
  const filteredGraphics = useMemo(() => {
    const q = graphicSearch.trim().toLowerCase();
    if (!q) return ALL_GRAPHICS;
    return ALL_GRAPHICS.filter(
      (g) => g.icon.includes(q) || g.category.toLowerCase().includes(q),
    );
  }, [graphicSearch]);

  const inp =
    'w-full rounded-lg border border-white/15 bg-[#0d1525] px-2 py-1.5 text-[11px] text-white placeholder:text-gray-600 outline-none focus:border-[#D4AF37]/50';

  return (
    <div className="flex h-full min-h-0 flex-col bg-gradient-to-b from-[#0a1120] to-[#070d18] text-white font-sans">
      {/* Barre type Canva */}
      <div className="flex h-11 flex-shrink-0 items-center gap-2 border-b border-white/10 px-3 bg-black/30">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">Studio</span>
        <div className="h-5 w-px bg-white/15" />
        <button
          type="button"
          onClick={undo}
          className="rounded-md p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
          title="Annuler (⌘Z)"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={redo}
          className="rounded-md p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
          title="Refaire (⇧⌘Z)"
        >
          <Redo2 className="h-4 w-4" />
        </button>
        <div className="h-5 w-px bg-white/15" />
        <label className="text-[10px] text-gray-500 whitespace-nowrap">Zoom</label>
        <select
          value={canvasScale}
          onChange={(e) => setCanvasScale(+e.target.value)}
          className="rounded-md border border-white/15 bg-[#0d1525] px-2 py-1 text-[11px] text-white"
        >
          {[0.35, 0.45, 0.52, 0.6, 0.72, 0.85, 1].map((z) => (
            <option key={z} value={z}>
              {Math.round(z * 100)}%
            </option>
          ))}
        </select>
        <span className="ml-auto text-[10px] text-gray-500 tabular-nums">
          {CANVAS_W}×{CANVAS_H} · {objects.length} calque{objects.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Rail gauche — outils */}
        <div className="flex w-[200px] flex-shrink-0 flex-col border-r border-white/10 bg-black/20">
          <div className="flex flex-wrap gap-0.5 border-b border-white/10 p-1.5">
            {TOOL_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTool(t.id)}
                className={`flex flex-1 min-w-[56px] flex-col items-center gap-0.5 rounded-lg py-1.5 text-[9px] font-semibold ${
                  activeTool === t.id ? 'bg-[#D4AF37]/15 text-[#D4AF37]' : 'text-gray-500 hover:bg-white/5'
                }`}
              >
                <span className="text-sm">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {activeTool === 'templates' && (
              <>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Modèles</p>
                <p className="text-[9px] leading-snug text-gray-500">
                  Une page par canevas (pas de pagination ni en-tête/pied automatiques comme Word). Les modèles « Admin »
                  simulent courrier, PV et attestation sur une plaque unique — export possible via capture / PDF selon le
                  flux cours.
                </p>
                {Object.entries(SB_CANVAS_TEMPLATES).map(([key, tpl]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => addObject('template', key)}
                    className="w-full rounded-lg border border-white/10 bg-[#0d1525] px-2 py-2 text-left text-[11px] text-gray-200 hover:border-[#D4AF37]/40"
                  >
                    {tpl.name}
                  </button>
                ))}
              </>
            )}

            {activeTool === 'text' && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    addObject('text', {
                      fontSize: 40,
                      fontWeight: '700',
                      fontFamily: '"Playfair Display", Georgia, serif',
                      color: GOLD,
                      width: 720,
                      height: 72,
                      text: 'Titre',
                      textAlign: 'center',
                    })
                  }
                  className="w-full rounded-lg bg-[#D4AF37] py-2 text-[11px] font-bold text-black"
                >
                  + Zone de texte
                </button>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Mise en forme</p>
                <CanvasTextFormatToolbar
                  textObj={selectedObj?.type === 'text' ? selectedObj : null}
                  onPatch={(patch) => selectedId && updateObject(selectedId, patch)}
                />
                {(!selectedId || selectedObj?.type !== 'text') && (
                  <p className="text-[9px] leading-snug text-amber-500/85">
                    Sélectionnez un bloc texte sur le canevas pour activer les outils (gras, alignement…).
                  </p>
                )}
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 pt-1">Styles rapides</p>
                {[
                  { label: 'Sous-titre', props: { fontSize: 22, fontWeight: '600', color: '#555', text: 'Sous-titre' } },
                  { label: 'Corps', props: { fontSize: 16, fontWeight: '400', color: '#333', text: 'Paragraphe…', width: 480, height: 100 } },
                  { label: 'Citation', props: { fontSize: 18, italic: true, fontFamily: 'Georgia, serif', text: '« Citation »' } },
                  { label: 'Badge', props: { fontSize: 12, fontWeight: '700', color: '#fff', text: String(isnaTenantConfig.branding.name || 'École').toUpperCase(), width: 200, height: 36, textAlign: 'center' } },
                ].map((row) => (
                  <button
                    key={row.label}
                    type="button"
                    onClick={() => addObject('text', row.props)}
                    className="w-full rounded-lg border border-white/10 px-2 py-1.5 text-left text-[11px] hover:border-[#D4AF37]/35"
                  >
                    {row.label}
                  </button>
                ))}
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 pt-2">Polices</p>
                <input
                  className={inp}
                  placeholder="Rechercher une police…"
                  value={fontSearch}
                  onChange={(e) => setFontSearch(e.target.value)}
                />
                <select
                  className={inp}
                  value={fontCat}
                  onChange={(e) => setFontCat(e.target.value)}
                >
                  <option value="">Toutes catégories</option>
                  {SB_CANVAS_FONT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {filteredFonts.slice(0, 24).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      disabled={!selectedId || selectedObj?.type !== 'text'}
                      onClick={() => selectedId && updateObject(selectedId, { fontFamily: f.family })}
                      className="w-full truncate rounded border border-white/10 bg-[#0d1525] px-2 py-1 text-left text-[10px] hover:border-[#D4AF37]/40 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{ fontFamily: f.family }}
                      title={f.family}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-gray-600">
                  {selectedId && selectedObj?.type === 'text'
                    ? 'Cliquez une police pour l\'appliquer au texte sélectionné.'
                    : 'Sélectionnez un bloc texte pour changer la police.'}
                </p>
              </>
            )}

            {activeTool === 'shapes' && (
              <>
                {[
                  { label: 'Rectangle', type: 'rect', props: { fill: 'rgba(26,95,168,0.08)', stroke: 'rgba(26,95,168,0.4)', borderRadius: 10, width: 240, height: 140 } },
                  { label: 'Cercle', type: 'circle', props: { fill: GOLD_DIM, stroke: GOLD, width: 140, height: 140 } },
                  { label: 'Carte info', type: 'rect', props: { fill: 'rgba(26,122,74,0.08)', stroke: 'rgba(26,122,74,0.4)', borderRadius: 14, width: 280, height: 180 } },
                  { label: 'Encadré or', type: 'rect', props: { fill: GOLD_DIM, stroke: GOLD, borderRadius: 12, width: 300, height: 160 } },
                  { label: 'Flèche', type: 'arrow', props: { fill: GOLD, width: 200, height: 20 } },
                ].map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => addObject(s.type, s.props)}
                    className="w-full rounded-lg border border-white/10 px-2 py-2 text-left text-[11px] hover:border-[#D4AF37]/35"
                  >
                    {s.label}
                  </button>
                ))}
              </>
            )}

            {activeTool === 'elements' && (
              <>
                <input
                  className={inp}
                  placeholder="Rechercher icône, symbole…"
                  value={graphicSearch}
                  onChange={(e) => setGraphicSearch(e.target.value)}
                />
                <div className="grid grid-cols-6 gap-1 max-h-[min(52vh,420px)] overflow-y-auto">
                  {filteredGraphics.slice(0, 200).map((g, i) => (
                    <button
                      key={`${g.icon}-${i}`}
                      type="button"
                      onClick={() => addObject('text', { text: g.icon, fontSize: 40, width: 72, height: 72, textAlign: 'center', color: '#333' })}
                      className="flex h-9 w-9 items-center justify-center rounded border border-white/10 text-lg hover:border-[#D4AF37]/50"
                      title={g.category}
                    >
                      {g.icon}
                    </button>
                  ))}
                </div>
              </>
            )}

            {activeTool === 'images' && (
              <div className="space-y-2">
                <label
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#D4AF37]/40 bg-[#D4AF37]/5 py-8 text-center text-[11px] text-[#D4AF37] ${
                    imageUploading ? 'pointer-events-none opacity-50' : ''
                  }`}
                >
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                    className="hidden"
                    disabled={imageUploading}
                    onChange={async (e) => {
                      const input = e.target;
                      const file = input.files?.[0];
                      input.value = '';
                      if (!file) return;
                      setImageUploadError('');
                      setImageUploading(true);
                      try {
                        const { url } = await uploadSmartboardCanvasImage(file);
                        addObject('image', { src: url, width: 320, height: 220 });
                      } catch (err) {
                        setImageUploadError(err?.message || 'Téléversement impossible');
                      } finally {
                        setImageUploading(false);
                      }
                    }}
                  />
                  {imageUploading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Envoi vers le bucket…
                    </span>
                  ) : (
                    'Importer une image (Supabase)'
                  )}
                </label>
                <p className="text-[9px] leading-snug text-gray-500">
                  Stockage persistant · max ~10 Mo · bucket <code className="text-gray-400">smartboard-canvas</code>
                </p>
                {imageUploadError ? (
                  <p className="text-[10px] text-red-400">{imageUploadError}</p>
                ) : null}
              </div>
            )}

            {activeTool === 'layers' && (
              <div className="space-y-1">
                <p className="text-[9px] text-gray-500">Ordre : bas → haut. Cliquez pour sélectionner.</p>
                {[...objects].reverse().map((o) => {
                  const label =
                    o.type === 'text' ? (o.text || '').slice(0, 28) || 'Texte' : o.type === 'image' ? 'Image' : o.type;
                  return (
                    <div
                      key={o.id}
                      className={`flex items-center gap-1 rounded-lg border px-1 py-1 text-[10px] ${
                        selectedId === o.id ? 'border-[#D4AF37]/60 bg-[#D4AF37]/10' : 'border-white/10 bg-[#0d1525]'
                      }`}
                    >
                      <button type="button" className="flex-1 truncate text-left" onClick={() => setSelectedId(o.id)}>
                        {label}
                      </button>
                      <button type="button" className="p-0.5 text-gray-500" onClick={() => moveLayer(o.id, -1)} title="Descendre">
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" className="p-0.5 text-gray-500" onClick={() => moveLayer(o.id, 1)} title="Monter">
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Canevas */}
        <div
          className="relative flex-1 overflow-auto bg-[#1a1a1f] p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          <div
            className="relative mx-auto bg-white shadow-2xl ring-1 ring-black/20"
            style={{
              width: CANVAS_W * canvasScale,
              height: CANVAS_H * canvasScale,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.12]" aria-hidden>
              <defs>
                <pattern id="sb-grid" width={20 * canvasScale} height={20 * canvasScale} patternUnits="userSpaceOnUse">
                  <path
                    d={`M ${20 * canvasScale} 0 L 0 0 0 ${20 * canvasScale}`}
                    fill="none"
                    stroke="#888"
                    strokeWidth="0.5"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#sb-grid)" />
            </svg>
            {objects.map((obj) => (
              <React.Fragment key={obj.id}>
                <RenderObject
                  obj={obj}
                  scale={canvasScale}
                  selected={selectedId === obj.id}
                  onMouseDown={(e) => onObjectMouseDown(e, obj.id)}
                />
                {selectedId === obj.id && !obj.locked && (
                  <SelectionHandles obj={obj} scale={canvasScale} onHandleDown={(h, ev) => onHandleMouseDown(ev, h, obj.id)} />
                )}
              </React.Fragment>
            ))}
            <div
              className="pointer-events-none absolute bottom-1 right-2 font-mono text-[8px] tracking-wide"
              style={{ color: `${GOLD}88`, fontSize: 9 * canvasScale }}
            >
              SMARTBOARD {CANVAS_W}×{CANVAS_H}
            </div>
          </div>
        </div>

        {/* Propriétés */}
        <div className="flex w-[220px] flex-shrink-0 flex-col border-l border-white/10 bg-black/25">
          <div className="flex border-b border-white/10">
            <button
              type="button"
              onClick={() => setRightTab('props')}
              className={`flex flex-1 items-center justify-center gap-1 py-2 text-[10px] font-bold uppercase ${
                rightTab === 'props' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'text-gray-500'
              }`}
            >
              Propriétés
            </button>
            <button
              type="button"
              onClick={() => setRightTab('layers')}
              className={`flex flex-1 items-center justify-center gap-1 py-2 text-[10px] font-bold uppercase ${
                rightTab === 'layers' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'text-gray-500'
              }`}
            >
              <Layers className="h-3 w-3" /> Calques
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {rightTab === 'layers' && (
              <div className="space-y-1 text-[10px]">
                {[...objects].reverse().map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSelectedId(o.id)}
                    className={`w-full truncate rounded border px-2 py-1.5 text-left ${
                      selectedId === o.id ? 'border-[#D4AF37]/50 bg-[#D4AF37]/10' : 'border-white/10'
                    }`}
                  >
                    {o.type === 'text' ? o.text?.slice(0, 40) : o.type}
                  </button>
                ))}
              </div>
            )}
            {rightTab === 'props' && !selectedObj && (
              <p className="text-[11px] text-gray-500">Sélectionnez un objet sur le canevas.</p>
            )}
            {rightTab === 'props' && selectedObj && (
              <div className="space-y-2 text-[11px]">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => duplicateObject(selectedObj.id)}
                    className="flex flex-1 items-center justify-center gap-1 rounded border border-white/15 py-1.5 hover:bg-white/5"
                  >
                    <Copy className="h-3 w-3" /> Dup.
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteObject(selectedObj.id)}
                    className="flex flex-1 items-center justify-center gap-1 rounded border border-red-500/30 py-1.5 text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <label className="text-[9px] uppercase text-gray-500">Position</label>
                <div className="grid grid-cols-2 gap-1">
                  <input
                    type="number"
                    className={inp}
                    value={Math.round(selectedObj.x)}
                    onChange={(e) => updateObject(selectedObj.id, { x: +e.target.value })}
                  />
                  <input
                    type="number"
                    className={inp}
                    value={Math.round(selectedObj.y)}
                    onChange={(e) => updateObject(selectedObj.id, { y: +e.target.value })}
                  />
                </div>
                <label className="text-[9px] uppercase text-gray-500">Taille</label>
                <div className="grid grid-cols-2 gap-1">
                  <input
                    type="number"
                    className={inp}
                    value={Math.round(selectedObj.width)}
                    onChange={(e) => updateObject(selectedObj.id, { width: +e.target.value })}
                  />
                  <input
                    type="number"
                    className={inp}
                    value={Math.round(selectedObj.height)}
                    onChange={(e) => updateObject(selectedObj.id, { height: +e.target.value })}
                  />
                </div>
                <label className="text-[9px] uppercase text-gray-500">Opacité</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={selectedObj.opacity ?? 1}
                  onChange={(e) => updateObject(selectedObj.id, { opacity: +e.target.value })}
                  className="w-full"
                />
                {selectedObj.type === 'text' && (
                  <>
                    <label className="text-[9px] uppercase text-gray-500">Mise en forme</label>
                    <CanvasTextFormatToolbar
                      className="w-full"
                      textObj={selectedObj}
                      onPatch={(patch) => updateObject(selectedObj.id, patch)}
                    />
                    <label className="text-[9px] uppercase text-gray-500">Police</label>
                    <select
                      className={inp}
                      value={selectedObj.fontFamily || ''}
                      onChange={(e) => updateObject(selectedObj.id, { fontFamily: e.target.value })}
                    >
                      {selectedObj.fontFamily &&
                      !filteredFonts.some((f) => f.family === selectedObj.fontFamily) ? (
                        <option value={selectedObj.fontFamily}>{selectedObj.fontFamily}</option>
                      ) : null}
                      {filteredFonts.map((f) => (
                        <option key={f.id} value={f.family}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[8px] text-gray-600">
                      Filtrez la liste via la recherche / catégorie dans l'onglet Texte à gauche.
                    </p>
                    <label className="text-[9px] uppercase text-gray-500">Contenu</label>
                    <textarea
                      className={`${inp} min-h-[72px] resize-y`}
                      value={selectedObj.text}
                      onChange={(e) => updateObject(selectedObj.id, { text: e.target.value })}
                    />
                    <label className="text-[9px] uppercase text-gray-500">Taille (px)</label>
                    <input
                      type="number"
                      className={inp}
                      value={selectedObj.fontSize}
                      onChange={(e) => updateObject(selectedObj.id, { fontSize: +e.target.value })}
                    />
                    <label className="text-[9px] uppercase text-gray-500">Interligne</label>
                    <input
                      type="number"
                      min={0.8}
                      max={3}
                      step={0.05}
                      className={inp}
                      value={
                        selectedObj.lineHeight != null && selectedObj.lineHeight !== ''
                          ? selectedObj.lineHeight
                          : 1.35
                      }
                      onChange={(e) => updateObject(selectedObj.id, { lineHeight: +e.target.value })}
                    />
                    <label className="text-[9px] uppercase text-gray-500">Couleur</label>
                    <input
                      type="color"
                      className="h-9 w-full cursor-pointer rounded border border-white/15"
                      value={selectedObj.color?.startsWith('#') ? selectedObj.color : '#111111'}
                      onChange={(e) => updateObject(selectedObj.id, { color: e.target.value })}
                    />
                  </>
                )}
                {(selectedObj.type === 'rect' || selectedObj.type === 'circle') && (
                  <>
                    <label className="text-[9px] uppercase text-gray-500">Fond</label>
                    <input
                      type="color"
                      className="h-9 w-full cursor-pointer rounded border border-white/15"
                      value={selectedObj.fill?.startsWith('#') ? selectedObj.fill : '#D4AF37'}
                      onChange={(e) => updateObject(selectedObj.id, { fill: e.target.value })}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
