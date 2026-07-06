// vnpProtocol — machine à états PURE du « Protocole de Visite » VNP (spec §3).
// Zéro React, zéro DOM, zéro effet de bord : dispatch(action) → { effects:[...], state }.
// L'appelant EXÉCUTE les effets (SPEAK/ENTER_SCENE/…) en PRÉSERVANT leur ordre et le chaînage
// asynchrone (un SPEAK avec callback avant le suivant). Entièrement testable sans navigateur.
//
// Phases : accueil → orientation → { visite_guidee | exploration_libre } → approfondissement → conversion → cloture.
// Principes du spec : RÉSUMÉ d'abord (SPEAK summary), DÉTAIL sur demande (WANT_DETAIL → SPEAK content) ;
// mode GUIDÉ qui déroule par priorite_tour (graph.tourOrder) avec PAUSE/REPRISE.
//
// Effets émis (descriptifs) : SPEAK, SET_SUGGESTIONS, SET_ACTIONS, TOUR_STEP, ASK_TOUR_CONTINUE,
//                             OPEN_CONTACT, GO_CHECKOUT, ASK_BRAIN, LOG.

export const VNP_PHASES = ['accueil', 'orientation', 'visite_guidee', 'exploration_libre', 'approfondissement', 'conversion', 'cloture'];

// Transitions LÉGALES (déclaratif) : phase → { TYPE_ACTION: phaseSuivante }. Une action absente = illégale.
export const STEPS_SCHEMA = {
  accueil: { ASK_TOUR: 'visite_guidee', FREE_QUESTION: 'exploration_libre', OPEN_NODE: 'approfondissement', ACTION: 'conversion' },
  orientation: { ASK_TOUR: 'visite_guidee', FREE_QUESTION: 'exploration_libre', OPEN_NODE: 'approfondissement', ACTION: 'conversion' },
  visite_guidee: { TOUR_NEXT: 'visite_guidee', TOUR_PAUSE: 'exploration_libre', OPEN_NODE: 'approfondissement', ACTION: 'conversion' },
  exploration_libre: { OPEN_NODE: 'approfondissement', FREE_QUESTION: 'exploration_libre', ASK_TOUR: 'visite_guidee', ACTION: 'conversion' },
  approfondissement: { WANT_DETAIL: 'approfondissement', OPEN_NODE: 'approfondissement', ASK_TOUR: 'visite_guidee', FREE_QUESTION: 'exploration_libre', ACTION: 'conversion', BACK: 'exploration_libre' },
  conversion: { DELIVERED: 'cloture', CANCEL: 'exploration_libre', OPEN_NODE: 'approfondissement', ACTION: 'conversion' },
  cloture: { RESTART: 'accueil', OPEN_NODE: 'approfondissement', ASK_TOUR: 'visite_guidee', FREE_QUESTION: 'exploration_libre' },
};

const initial = () => ({ phase: 'accueil', nodeId: null, detailShown: false, tourIdx: -1, covered: [], history: [] });

export function createProtocol({ graph, order } = {}) {
  const g = graph || {};
  const nodeOf = (id) => (typeof g.byId === 'function' ? g.byId(id) : (g.nodes || {})[id]) || null;
  const tour = (order && order.length) ? order.slice() : (g.tourOrder || Object.keys(g.nodes || {}));
  let state = initial();

  const suggest = (n) => ((n && n.related) || []).map(nodeOf).filter(Boolean).slice(0, 3).map((r) => ({ nodeId: r.id, label: r.title }));
  const cover = (arr, id) => (arr.includes(id) ? arr : [...arr, id]);

  function nodeEffects(n) {
    const actions = [];
    if (n.content && n.content.trim() && n.content !== n.summary) actions.push({ id: '__detail__', label: 'Approfondir' });
    (n.actions || []).forEach((a) => actions.push({ id: a }));
    return [
      { type: 'SPEAK', text: (n.summary || n.title || '').trim() }, // RÉSUMÉ d'abord
      { type: 'SET_ACTIONS', items: actions },
      { type: 'SET_SUGGESTIONS', items: suggest(n) },
      { type: 'LOG', event: 'node_opened', payload: { nodeId: n.id } },
    ];
  }

  // Avance d'un beat de la VISITE GUIDÉE (ordre priorite_tour). first=true → repart de zéro.
  function stepTour(s, base) {
    const idx = s.tourIdx + 1;
    if (idx >= tour.length) {
      const done = { ...s, phase: 'orientation', tourIdx: -1 };
      state = done;
      return { effects: [...base, { type: 'TOUR_STEP', nodeId: null, index: idx, total: tour.length, end: true }, { type: 'SPEAK', text: 'Voilà le tour. Que voulez-vous approfondir ?' }], state: done };
    }
    const id = tour[idx];
    const n = nodeOf(id);
    const s2 = { ...s, phase: 'visite_guidee', tourIdx: idx, nodeId: id, detailShown: false, covered: cover(s.covered, id) };
    state = s2;
    const eff = [...base, { type: 'TOUR_STEP', nodeId: id, index: idx, total: tour.length, end: false }];
    if (n) {
      eff.push({ type: 'SPEAK', text: (n.summary || n.title || '').trim() });
      eff.push({ type: 'SET_SUGGESTIONS', items: suggest(n) });
      eff.push({ type: 'LOG', event: 'node_opened', payload: { nodeId: id, tour: true } });
    }
    eff.push({ type: 'ASK_TOUR_CONTINUE' }); // l'appelant propose « On continue ? »
    return { effects: eff, state: s2 };
  }

  function dispatch(action) {
    const type = action && action.type;
    const payload = (action && action.payload) || {};
    if (type === 'RESET') { state = initial(); return { effects: [], state }; }

    const table = STEPS_SCHEMA[state.phase] || {};
    if (!table[type]) return { effects: [], state }; // transition ILLÉGALE → no-op déterministe

    let s = { ...state, phase: table[type], history: [...state.history, type].slice(-24) };
    const effects = [];

    switch (type) {
      case 'ASK_TOUR':
        return stepTour({ ...s, tourIdx: -1 }, effects);
      case 'TOUR_NEXT':
        return stepTour(s, effects);
      case 'TOUR_PAUSE':
        effects.push({ type: 'SPEAK', text: 'On reprend quand vous voulez.' });
        break;
      case 'OPEN_NODE': {
        const n = nodeOf(payload.nodeId);
        if (!n) return { effects: [], state };
        s = { ...s, nodeId: n.id, detailShown: false, covered: cover(s.covered, n.id) };
        effects.push(...nodeEffects(n));
        break;
      }
      case 'WANT_DETAIL': {
        const n = nodeOf(s.nodeId);
        if (n && !s.detailShown && n.content) { effects.push({ type: 'SPEAK', text: n.content }); s = { ...s, detailShown: true }; }
        break;
      }
      case 'ACTION': {
        const act = payload.action;
        effects.push(act === 'contacter' || act === 'participer' ? { type: 'OPEN_CONTACT', action: act } : { type: 'GO_CHECKOUT', action: act });
        effects.push({ type: 'LOG', event: 'action_triggered', payload: { action: act } });
        break;
      }
      case 'FREE_QUESTION':
        effects.push({ type: 'ASK_BRAIN', message: payload.message || '' });
        break;
      case 'DELIVERED':
        effects.push({ type: 'SPEAK', text: "C'est fait. Autre chose ?" });
        break;
      case 'RESTART':
        effects.push({ type: 'LOG', event: 'phase_transition', payload: { to: 'accueil' } });
        break;
      default:
        break; // BACK / CANCEL : simple changement de phase, aucun effet
    }

    state = s;
    return { effects, state };
  }

  return {
    get state() { return state; },
    dispatch,
    reset() { state = initial(); return state; },
    phases: VNP_PHASES,
    tourLength: tour.length,
  };
}
