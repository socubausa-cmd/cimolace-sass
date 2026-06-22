import { create } from 'zustand';
import { defaultNeuroInkSettings } from '@/lib/neuroInk';

const noop = () => {};

const initialBoard = {
  alignLeft: noop, alignRight: noop, alignCenterH: noop,
  alignTop: noop, alignBottom: noop, alignCenterV: noop,
  distributeH: noop, distributeV: noop,
  undo: noop,
  redo: noop,
  clear: noop,
  download: noop,
  groupBoardSelection: noop,
  ungroupBoardSelection: noop,
  copyBoardSelection: noop,
  cutBoardSelection: noop,
  pasteBoardClipboard: noop,
  duplicateBoardSelection: noop,
  deleteBoardSelection: noop,
  bringToFront: noop,
  sendToBack: noop,
  bringForward: noop,
  sendBackward: noop,
  updateStrokeProperties: noop,
  aiRasterize: () => null,
  aiReadBoardText: () => '',
};

/**
 * État partagé entre le rail latéral (LiveRoomShell) et le canvas tableau blanc (WhiteboardScene).
 */
export const useLiveWhiteboardStore = create((set, get) => ({
  tool: 'pencil',
  setTool: (tool) =>
    set((state) => ({
      tool,
      boardIaRevision: state.boardIaRevision + 1,
    })),

  /** Fond du tableau : `dark` studio ou `chalkboard` (vert craie + gomme qui efface le dessin). */
  boardSurface: 'dark',
  setBoardSurface: (boardSurface) => set({ boardSurface }),

  /** Translation vue (outil Main ou Espace + glisser). */
  boardPan: { x: 0, y: 0 },
  setBoardPan: (next) =>
    set((state) => ({
      boardPan:
        typeof next === 'function'
          ? next(state.boardPan)
          : { ...state.boardPan, ...next },
    })),
  /** Zoom vue (1 = normal). */
  boardZoom: 1,
  setBoardZoom: (next) =>
    set((state) => ({
      boardZoom: typeof next === 'function' ? next(state.boardZoom) : next,
    })),
  resetBoardView: () => set({ boardPan: { x: 0, y: 0 }, boardZoom: 1 }),

  color: '#ffffff',
  setColor: (color) => set({ color }),

  size: 3,
  setSize: (size) => set({ size }),

  shapeFill: false,
  setShapeFill: (shapeFill) => set({ shapeFill }),

  textFontSize: 20,
  setTextFontSize: (textFontSize) => set({ textFontSize }),

  /** Presets compositeur (titre, sous-titre, paragraphe, légende) — tableau blanc live. */
  textPreset: 'body',
  setTextPreset: (textPreset) => set({ textPreset }),
  textBold: false,
  setTextBold: (textBold) => set({ textBold: typeof textBold === 'function' ? textBold(get().textBold) : textBold }),
  textItalic: false,
  setTextItalic: (textItalic) =>
    set({ textItalic: typeof textItalic === 'function' ? textItalic(get().textItalic) : textItalic }),
  textAlign: 'left',
  setTextAlign: (textAlign) => set({ textAlign }),

  neuroInkOpen: false,
  setNeuroInkOpen: (v) =>
    set((state) => {
      const next = typeof v === 'function' ? v(state.neuroInkOpen) : v;
      return {
        neuroInkOpen: next,
        boardIaRevision: state.boardIaRevision + 1,
      };
    }),

  neuroInk: defaultNeuroInkSettings(),
  neuroInkRevision: 0,
  setNeuroInk: (fnOrObj) =>
    set((state) => ({
      neuroInk:
        typeof fnOrObj === 'function'
          ? fnOrObj(state.neuroInk)
          : { ...state.neuroInk, ...fnOrObj },
      neuroInkRevision: state.neuroInkRevision + 1,
    })),

  /** NeuroInk IA — copilote pédagogique (activé par l'hôte). État partagé panneau ↔ orchestrateur. */
  neuroInkAi: {
    enabled: false,
    premium: false,
    busy: false,
    activeKind: null,
    comprehension: null,
    suggestions: [],
    error: null,
  },
  setNeuroInkAi: (patch) =>
    set((state) => ({
      neuroInkAi: {
        ...state.neuroInkAi,
        ...(typeof patch === 'function' ? patch(state.neuroInkAi) : patch),
      },
    })),

  /** Pour le panneau Architect (live) : traits, brouillon texte, révision globale. */
  boardStrokeCount: 0,
  boardTextDraftActive: false,
  boardTextDraftPreview: '',
  boardIaRevision: 0,
  emitBoardIaTelemetry: (partial) =>
    set((state) => ({
      boardStrokeCount:
        typeof partial?.strokeCount === 'number' ? partial.strokeCount : state.boardStrokeCount,
      boardTextDraftActive:
        typeof partial?.textDraftActive === 'boolean'
          ? partial.textDraftActive
          : state.boardTextDraftActive,
      boardTextDraftPreview:
        typeof partial?.textDraftPreview === 'string'
          ? partial.textDraftPreview
          : state.boardTextDraftPreview,
      boardIaRevision: state.boardIaRevision + 1,
    })),

  /** Indices des traits sélectionnés (scène board, outil « Sélection »). */
  boardSelection: [],
  setBoardSelection: (next) =>
    set((state) => ({
      boardSelection:
        typeof next === 'function' ? next(state.boardSelection) : next,
    })),

  /** Traits copiés (presse-papiers tableau) — sérialisation interne. */
  boardClipboard: [],
  setBoardClipboard: (strokes) =>
    set({ boardClipboard: Array.isArray(strokes) ? strokes : [] }),

  _board: initialBoard,
  bindBoardActions: (partial) =>
    set((state) => ({
      _board: { ...state._board, ...partial },
    })),

  undoBoard: () => get()._board.undo(),
  redoBoard: () => get()._board.redo?.(),
  clearBoard: () => get()._board.clear(),
  downloadBoard: () => get()._board.download(),
  groupBoardSelection: () => get()._board.groupBoardSelection(),
  ungroupBoardSelection: () => get()._board.ungroupBoardSelection(),
  copyBoardSelection: () => get()._board.copyBoardSelection(),
  cutBoardSelection: () => get()._board.cutBoardSelection(),
  pasteBoardClipboard: () => get()._board.pasteBoardClipboard(),
  duplicateBoardSelection: () => get()._board.duplicateBoardSelection(),
  deleteBoardSelection: () => get()._board.deleteBoardSelection(),
  bringToFront: () => get()._board.bringToFront(),
  sendToBack: () => get()._board.sendToBack(),
  bringForward: () => get()._board.bringForward(),
  sendBackward: () => get()._board.sendBackward(),
  updateStrokeProperties: (patch) => get()._board.updateStrokeProperties(patch),
  /** NeuroInk IA — primitives tableau exposées par le compositor. */
  aiRasterizeBoard: () => get()._board.aiRasterize?.(),
  aiReadBoardText: () => get()._board.aiReadBoardText?.(),
  alignLeft: () => get()._board.alignLeft(),
  alignRight: () => get()._board.alignRight(),
  alignCenterH: () => get()._board.alignCenterH(),
  alignTop: () => get()._board.alignTop(),
  alignBottom: () => get()._board.alignBottom(),
  alignCenterV: () => get()._board.alignCenterV(),
  distributeH: () => get()._board.distributeH(),
  distributeV: () => get()._board.distributeV(),

  /** Couleur de remplissage indépendante du contour */
  boardFillColor: null,
  boardFillColorEnabled: false,
  setBoardFillColor: (color) => set({ boardFillColor: color, boardFillColorEnabled: color !== null }),
  setBoardFillColorEnabled: (v) => set({ boardFillColorEnabled: v }),

  /** Template en attente de placement */
  pendingTemplate: null,
  setPendingTemplate: (t) => set({ pendingTemplate: t }),

  /** Snap to grid */
  snapToGrid: false,
  setSnapToGrid: (v) => set({ snapToGrid: v }),
  gridSize: 24,

  /** Timer tableau blanc */
  wbTimer: { visible: false, durationSec: 300, remainingSec: 300, running: false },
  setWbTimer: (patch) => set((state) => ({ wbTimer: { ...state.wbTimer, ...patch } })),

  /** Info du(es) trait(s) sélectionné(s) — mis à jour par le compositor */
  selectedStrokeInfo: null,
  setSelectedStrokeInfo: (info) => set({ selectedStrokeInfo: info }),

  /** Image en attente de placement */
  pendingImage: null,
  setPendingImage: (img) => set({ pendingImage: img }),

  /** Configuration des outils scolaires */
  schoolConfig: {
    polygonSides: 6,
    arrowDouble: false,
    starPoints: 5,
    tableCols: 3,
    tableRows: 3,
    numberlineMin: 0,
    numberlineMax: 10,
    numberlineStep: 1,
    latexFormula: '',
    latexDisplayMode: true,
    arcMode: false,
    /* vecteur nommé */
    vectorLabel: 'F',
    /* fraction visuelle */
    fracNumerator: 1,
    fracDenominator: 4,
    fracStyle: 'bar',
    fracCellSize: 32,
    /* tracé de courbe f(x) */
    fnExpr: 'x',
    fnXMin: -5,
    fnXMax: 5,
    fnScaleX: 50,
    fnScaleY: 50,
    /* segment / droite / demi-droite nommés */
    segmentLabelA: 'A',
    segmentLabelB: 'B',
    segmentStyle: 'segment',
    segmentShowLength: false,
    segmentTickCount: 0,
    /* mesure distance */
    measureLabel: '',
    /* tableau de valeurs */
    vtExpr: 'x',
    vtXMin: -3,
    vtXMax: 3,
    vtXStep: 1,
    /* histogramme */
    histLabels: 'Lun, Mar, Mer, Jeu, Ven',
    histValues: '4, 7, 3, 8, 5',
    histTitle: '',
    /* diagramme circulaire */
    pieLabels: 'Rouge, Bleu, Vert, Jaune',
    pieValues: '30, 25, 20, 25',
    pieTitle: '',
    /* homothétie */
    homothetieRatio: 2,
    /* tableau de signes */
    signXVals: '-∞, -1, 0, 2, +∞',
    signRows: '(x+1): -, 0, +, +, +, +, +\nx: -, -, -, 0, +, +, +\n(x-2): -, -, -, -, -, 0, +\nProduit: +, 0, -, 0, +, 0, -',
    /* arbre de probabilités */
    probL1: 'A:0.3, Ā:0.7',
    probL2A: 'B:0.4, B̄:0.6',
    probL2B: 'B:0.2, B̄:0.8',
    probShowProducts: true,
    /* composant électrique */
    electricComp: 'resistor',
    electricSize: 50,
    electricAngle: 0,
    electricLabel: '',
    /* tableau de variations */
    vtFnName: 'f',
    vtXVals: '-∞, 1, +∞',
    vtDerivSigns: '+, -',
    vtCritFVals: '3',
    vtIncreasing: 'true, false',
    vtBoundaryFVals: ', ',
    /* nuage de points */
    scatterData: '1,2; 3,4; 5,1; 7,6; 2,5',
    scatterTitle: '',
    scatterConnect: false,
    scatterScaleX: 40,
    scatterScaleY: 40,
    scatterXMin: -2,
    scatterXMax: 10,
  },
  setSchoolConfig: (patch) =>
    set((state) => ({
      schoolConfig: {
        ...state.schoolConfig,
        ...(typeof patch === 'function' ? patch(state.schoolConfig) : patch),
      },
    })),

  /** Formule LaTeX en attente de placement (outil latex) */
  pendingLatex: null,
  setPendingLatex: (v) => set({ pendingLatex: v }),
}));
