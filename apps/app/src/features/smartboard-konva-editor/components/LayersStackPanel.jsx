import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine, ArrowUpToLine, Circle, Code, Eye, EyeOff, GripVertical,
  Image as ImageIcon, Layers, Lock, Pencil, Slash, Sparkles, Square, Type, Unlock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONES_TYPE = {
  text: Type,
  rect: Square,
  circle: Circle,
  ellipse: Circle,
  image: ImageIcon,
  icon: Sparkles,
  html: Code,
  line: Slash,
  arrow: Slash,
};

const LIBELLES_TYPE = {
  text: 'Texte',
  rect: 'Rectangle',
  circle: 'Cercle',
  ellipse: 'Ellipse',
  image: 'Image',
  icon: 'Icône',
  html: 'Animé',
  line: 'Ligne',
  arrow: 'Flèche',
};

/** Nom affiché : le nom donné par l'utilisateur d'abord, sinon un repère lisible. */
export function nomDeCalque(o) {
  const donne = typeof o?.name === 'string' ? o.name.trim() : '';
  if (donne) return donne;
  if (o?.type === 'text') {
    const t = String(o?.content?.text ?? '').replace(/\s+/g, ' ').trim();
    if (t) return t.slice(0, 32);
    return 'Texte vide';
  }
  return `${LIBELLES_TYPE[o?.type] ?? o?.type ?? 'Objet'} ${String(o?.id ?? '').slice(-4)}`;
}

/**
 * Panneau « Calques » — la PILE réelle, réordonnable.
 *
 * ⛔ CONTRAINTE : le rendu Konva trie par `layer` croissant (sortObjectsByLayer),
 * et ce tri est STABLE. Deux objets au même `layer` gardent donc l'ordre du
 * tableau — un glissement ne peut pas se contenter de déplacer une ligne : il
 * faut RENUMÉROTER toute la pile, sinon la vue et le rendu divergent en silence.
 *
 * La liste est affichée du PREMIER PLAN vers l'ARRIÈRE-PLAN (convention Figma /
 * Canva) alors que `layer` croît vers l'avant : les index sont donc inversés.
 *
 * @param {{
 *   objects: any[],
 *   selectedIds: string[],
 *   onSelectOnly: (id: string) => void,
 *   onRenumber: (idsDuFondVersLeHaut: string[]) => void,
 *   onToggleLock: (id: string) => void,
 *   onToggleVisibility: (id: string) => void,
 *   onRename: (id: string, nom: string) => void,
 *   onBringToFront?: (id: string) => void,
 *   onSendToBack?: (id: string) => void,
 *   filterQuery?: string,
 * }} props
 */
export default function LayersStackPanel({
  objects = [],
  selectedIds = [],
  onSelectOnly,
  onRenumber,
  onToggleLock,
  onToggleVisibility,
  onRename,
  onBringToFront,
  onSendToBack,
  filterQuery = '',
}) {
  const [idEnEdition, setIdEnEdition] = useState(null);
  const [brouillonNom, setBrouillonNom] = useState('');
  const [indexSurvole, setIndexSurvole] = useState(null);
  const indexTireRef = useRef(/** @type {number | null} */ (null));

  /* Du premier plan vers l'arrière-plan. Le tri est fait sur une COPIE — trier le
     tableau du store en place corromprait l'ordre de rendu. */
  const pile = useMemo(
    () => [...objects].sort((a, b) => (b.layer ?? 0) - (a.layer ?? 0)),
    [objects],
  );

  const q = String(filterQuery || '').trim().toLowerCase();
  const filtree = useMemo(
    () => (q ? pile.filter((o) => nomDeCalque(o).toLowerCase().includes(q)) : pile),
    [pile, q],
  );

  /**
   * Déplace la ligne `de` sur la position `vers` DANS LA PILE COMPLÈTE, puis rend
   * l'ordre du fond vers le haut — c'est l'ordre attendu par la renumérotation.
   */
  const deplacer = (de, vers) => {
    if (de == null || vers == null || de === vers) return;
    const suite = [...pile];
    const [tire] = suite.splice(de, 1);
    if (!tire) return;
    suite.splice(vers, 0, tire);
    onRenumber?.([...suite].reverse().map((o) => o.id));
  };

  const validerNom = (id) => {
    const nom = brouillonNom.trim();
    setIdEnEdition(null);
    /* Un nom vide ne s'écrit pas : il ferait disparaître le repère (texte, type)
       au profit d'une ligne anonyme. */
    if (nom) onRename?.(id, nom.slice(0, 60));
  };

  if (!pile.length) {
    return <p className="py-6 text-center text-[10px] text-white/30">Scène vide.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">
          Premier plan
        </p>
        <span className="text-[9px] text-white/25">
          {q ? `${filtree.length}/${pile.length}` : `${pile.length} objet${pile.length > 1 ? 's' : ''}`}
        </span>
      </div>

      {filtree.length === 0 ? (
        <p className="py-6 text-center text-[10px] text-white/30">Aucun calque ne correspond au filtre.</p>
      ) : (
        <div className="space-y-0.5">
          {filtree.map((o) => {
            const indexPile = pile.indexOf(o);
            const Icone = ICONES_TYPE[o.type] || Layers;
            const selectionne = selectedIds.includes(o.id);
            const enEdition = idEnEdition === o.id;
            return (
              <div
                key={o.id}
                /* ⛔ Le glissement est DÉSACTIVÉ pendant que le filtre masque des
                   lignes : réordonner une pile partielle poserait les calques
                   invisibles n'importe où. */
                draggable={!q && !enEdition}
                onDragStart={(e) => {
                  indexTireRef.current = indexPile;
                  e.dataTransfer.effectAllowed = 'move';
                  /* Safari refuse le glissement sans charge utile. */
                  e.dataTransfer.setData('text/plain', String(o.id));
                }}
                onDragOver={(e) => {
                  if (q || indexTireRef.current == null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setIndexSurvole(indexPile);
                }}
                onDrop={(e) => {
                  if (q || indexTireRef.current == null) return;
                  e.preventDefault();
                  e.stopPropagation();
                  deplacer(indexTireRef.current, indexPile);
                  indexTireRef.current = null;
                  setIndexSurvole(null);
                }}
                onDragEnd={() => { indexTireRef.current = null; setIndexSurvole(null); }}
                className={cn(
                  'group flex items-center gap-1 rounded-md px-1 py-1 text-[11.5px] transition-colors',
                  indexSurvole === indexPile && indexTireRef.current !== indexPile
                    ? 'ring-1 ring-[#d4924a]/50'
                    : '',
                  selectionne
                    ? 'bg-[#d4924a]/15 text-[#ecc98f] ring-1 ring-[#d4924a]/35'
                    : o.hidden
                      ? 'text-white/25 hover:bg-white/[0.04]'
                      : 'text-white/70 hover:bg-white/[0.06]',
                )}
              >
                <GripVertical
                  className={cn('h-3 w-3 shrink-0', q ? 'text-white/10' : 'cursor-grab text-white/25')}
                  aria-hidden
                />
                <Icone className="h-3 w-3 shrink-0 opacity-60" />

                {enEdition ? (
                  <input
                    autoFocus
                    value={brouillonNom}
                    onChange={(e) => setBrouillonNom(e.target.value)}
                    onBlur={() => validerNom(o.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') validerNom(o.id);
                      if (e.key === 'Escape') setIdEnEdition(null);
                    }}
                    className="min-w-0 flex-1 rounded border border-[#d4924a]/40 bg-black/50 px-1 py-0.5 text-[11px] text-white/90 outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectOnly?.(o.id)}
                    onDoubleClick={() => { setIdEnEdition(o.id); setBrouillonNom(nomDeCalque(o)); }}
                    title={`${nomDeCalque(o)} — double-clic pour renommer`}
                    className="min-w-0 flex-1 truncate text-left"
                  >
                    {nomDeCalque(o)}
                  </button>
                )}

                <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => { setIdEnEdition(o.id); setBrouillonNom(nomDeCalque(o)); }}
                    title="Renommer"
                    className="flex h-5 w-5 items-center justify-center rounded text-white/35 hover:bg-white/10 hover:text-white/80"
                  >
                    <Pencil className="h-2.5 w-2.5" />
                  </button>
                  {onBringToFront ? (
                    <button
                      type="button"
                      onClick={() => onBringToFront(o.id)}
                      title="Mettre au premier plan"
                      className="flex h-5 w-5 items-center justify-center rounded text-white/35 hover:bg-white/10 hover:text-white/80"
                    >
                      <ArrowUpToLine className="h-2.5 w-2.5" />
                    </button>
                  ) : null}
                  {onSendToBack ? (
                    <button
                      type="button"
                      onClick={() => onSendToBack(o.id)}
                      title="Envoyer à l'arrière-plan"
                      className="flex h-5 w-5 items-center justify-center rounded text-white/35 hover:bg-white/10 hover:text-white/80"
                    >
                      <ArrowDownToLine className="h-2.5 w-2.5" />
                    </button>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => onToggleVisibility?.(o.id)}
                  title={o.hidden ? 'Afficher' : 'Masquer'}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-white/35 hover:bg-white/10 hover:text-white/80"
                >
                  {o.hidden ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleLock?.(o.id)}
                  title={o.locked ? 'Déverrouiller' : 'Verrouiller'}
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-white/10 hover:text-white/80',
                    o.locked ? 'text-[#e0a458]' : 'text-white/35',
                  )}
                >
                  {o.locked ? <Lock className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="px-0.5 text-[9px] uppercase tracking-[0.18em] text-white/25">Arrière-plan</p>
      {q ? (
        <p className="px-0.5 text-[9px] leading-relaxed text-white/30">
          Videz le filtre pour réordonner la pile au glissement.
        </p>
      ) : null}
    </div>
  );
}
