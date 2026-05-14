/**
 * LONGIA Decision Engine — normalisation, priorité, audience, timing, composition.
 * @see src/data/longiaDecisionEngine.json
 * @see src/data/longiaRealtimeBus.json
 */

/** @typedef {'low'|'medium'|'high'|'critical'} PriorityLevel */
/** @typedef {'send_now'|'aggregate_then_send'|'delay'|'store_only'|'auto_apply'|'require_confirmation'} DecisionMode */
/** @typedef {'teacher_notification'|'guest_response'|'smartboard_suggestion'|'clip_marker'|'quiz_suggestion'|'recap_store'|'silent_store'} TargetChannel */

/**
 * @typedef {object} NormalizedSignal
 * @property {string} type
 * @property {string} source
 * @property {number} importance 1–5
 * @property {string|null} potentialTarget
 * @property {number} ts
 * @property {Record<string, unknown>} context
 */

/**
 * @typedef {object} DecisionOutput
 * @property {string} id
 * @property {string[]} source_event_ids
 * @property {PriorityLevel} priority
 * @property {TargetChannel} target_channel
 * @property {DecisionMode} mode
 * @property {string} message
 * @property {{ label: string, action: string, payload?: Record<string, unknown> }[]} [actions]
 */

export const PRIORITY = {
  LOW: /** @type {const} */ ('low'),
  MEDIUM: /** @type {const} */ ('medium'),
  HIGH: /** @type {const} */ ('high'),
  CRITICAL: /** @type {const} */ ('critical'),
};

export const TARGET = {
  TEACHER_NOTIFICATION: /** @type {const} */ ('teacher_notification'),
  GUEST_RESPONSE: /** @type {const} */ ('guest_response'),
  SMARTBOARD_SUGGESTION: /** @type {const} */ ('smartboard_suggestion'),
  CLIP_MARKER: /** @type {const} */ ('clip_marker'),
  QUIZ_SUGGESTION: /** @type {const} */ ('quiz_suggestion'),
  RECAP_STORE: /** @type {const} */ ('recap_store'),
  SILENT_STORE: /** @type {const} */ ('silent_store'),
};

export const MODE = {
  SEND_NOW: /** @type {const} */ ('send_now'),
  AGGREGATE_THEN_SEND: /** @type {const} */ ('aggregate_then_send'),
  DELAY: /** @type {const} */ ('delay'),
  STORE_ONLY: /** @type {const} */ ('store_only'),
  AUTO_APPLY: /** @type {const} */ ('auto_apply'),
  REQUIRE_CONFIRMATION: /** @type {const} */ ('require_confirmation'),
};

let decisionSeq = 0;
function nextDecisionId() {
  decisionSeq += 1;
  return `dec_${Date.now().toString(36)}_${decisionSeq}`;
}

function newEventId() {
  return `evt_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @param {{ v: number; event: string; timestamp?: number; [k: string]: unknown }} msg
 * @returns {NormalizedSignal | null}
 */
export function normalizeStudentActionFromBus(msg) {
  if (!msg || msg.event !== 'student.action') return null;
  const action = typeof msg.action === 'string' ? msg.action : '';
  if (!action) return null;
  const studentId = typeof msg.student_id === 'string' ? msg.student_id : 'unknown';
  const topic = typeof msg.topic === 'string' && msg.topic.trim() ? msg.topic.trim() : null;
  const ts =
    typeof msg.timestamp === 'number' && Number.isFinite(msg.timestamp)
      ? msg.timestamp * 1000
      : Date.now();
  const importance = action === 'teacher_escalation' ? 4 : 2;
  return {
    type: 'student.action',
    source: 'longia_bus',
    importance,
    potentialTarget: studentId,
    ts,
    context: { action, student_id: studentId, topic, event_id: newEventId() },
  };
}

/**
 * Score simplifié : importance × fréquence × urgence × portée (portée = élèves uniques).
 * @param {NormalizedSignal[]} cluster
 * @param {{ uniqueStudents: number, repeatFactor: number }} dims
 */
export function computeClusterScore(cluster, dims) {
  if (!cluster.length) return 0;
  const imp = Math.max(1, ...cluster.map((s) => s.importance || 1));
  const freq = Math.min(8, 1 + Math.log2(1 + cluster.length) * dims.repeatFactor);
  const urgency = cluster.some((s) => s.context?.action === 'teacher_escalation') ? 1.4 : 1;
  const scope = Math.min(6, 1 + dims.uniqueStudents * 0.85);
  return imp * freq * urgency * scope;
}

/**
 * @param {number} score
 * @param {{ hasEscalation: boolean, massConfusion: boolean }} flags
 * @returns {PriorityLevel}
 */
export function resolvePriorityFromScore(score, flags) {
  if (flags.hasEscalation && flags.massConfusion) return PRIORITY.CRITICAL;
  if (flags.massConfusion || score >= 28) return PRIORITY.HIGH;
  if (flags.hasEscalation || score >= 18) return PRIORITY.MEDIUM;
  if (score >= 10) return PRIORITY.MEDIUM;
  return PRIORITY.LOW;
}

/**
 * @param {NormalizedSignal[]} events
 * @param {Partial<{ confusedMinForTeacher: number, confusedTopicHigh: number, confusedMassTotal: number }>} [thresholds]
 * @returns {DecisionOutput[]}
 */
export function composeTeacherDecisionsFromStudentSignals(events, thresholds = {}) {
  const confusedMinForTeacher = thresholds.confusedMinForTeacher ?? 3;
  const confusedTopicHigh = thresholds.confusedTopicHigh ?? 3;
  const confusedMassTotal = thresholds.confusedMassTotal ?? 6;

  const confused = events.filter((e) => e.context?.action === 'confused');
  const escalations = events.filter((e) => e.context?.action === 'teacher_escalation');

  /** @type {DecisionOutput[]} */
  const out = [];

  const byTopic = new Map();
  for (const e of confused) {
    const key = e.context?.topic ? String(e.context.topic) : '_general';
    if (!byTopic.has(key)) byTopic.set(key, []);
    byTopic.get(key).push(e);
  }
  let maxTopic = 0;
  let maxTopicLabel = '';
  for (const [k, arr] of byTopic) {
    if (arr.length > maxTopic) {
      maxTopic = arr.length;
      maxTopicLabel = k === '_general' ? 'le fil général' : k;
    }
  }

  const uniqueStudents = new Set(
    events.map((e) => (typeof e.context?.student_id === 'string' ? e.context.student_id : '')),
  ).size;

  const massConfusion = confused.length >= confusedMassTotal || maxTopic >= confusedTopicHigh;
  const hasEscalation = escalations.length > 0;

  /** Cas 1 — confusion isolée : pas de notification prof */
  if (confused.length > 0 && confused.length < confusedMinForTeacher && !hasEscalation) {
    out.push({
      id: nextDecisionId(),
      source_event_ids: events.map((e) => String(e.context?.event_id || '')).filter(Boolean),
      priority: PRIORITY.LOW,
      target_channel: TARGET.SILENT_STORE,
      mode: MODE.STORE_ONLY,
      message:
        'Signaux élèves enregistrés (aide individuelle LONGIA) — pas de sollicitation formateur.',
    });
    return out;
  }

  /** Uniquement escalades explicites (peu nombreuses) */
  if (confused.length === 0 && hasEscalation) {
    const score = computeClusterScore(escalations, {
      uniqueStudents,
      repeatFactor: 1.2,
    });
    const pr = resolvePriorityFromScore(score, { hasEscalation: true, massConfusion: false });
    out.push({
      id: nextDecisionId(),
      source_event_ids: escalations.map((e) => String(e.context?.event_id || '')).filter(Boolean),
      priority: pr,
      target_channel: TARGET.TEACHER_NOTIFICATION,
      mode: MODE.SEND_NOW,
      message: `${escalations.length} remontée(s) élève(s) via LONGIA (signal prof).`,
      actions: [
        { label: 'Voir le journal signaux', action: 'open_signals' },
        { label: 'Garder pour clôture', action: 'mark_for_closure' },
      ],
    });
    return out;
  }

  /** Confusion collective / sujet répété + option recap */
  const cluster = [...confused, ...escalations];
  const score = computeClusterScore(cluster, {
    uniqueStudents,
    repeatFactor: massConfusion ? 1.5 : 1,
  });
  const pr = resolvePriorityFromScore(score, { hasEscalation, massConfusion });

  let message = '';
  if (maxTopic >= confusedTopicHigh) {
    message = `Plusieurs élèves bloquent sur un même thème (${maxTopicLabel}).`;
  } else if (confused.length >= confusedMassTotal) {
    message = `Fort volume de signaux « je ne comprends pas » (${confused.length}) sur la session.`;
  } else {
    message = `Plusieurs élèves (${confused.length}) signalent des difficultés.${hasEscalation ? ' Dont remontées explicites au formateur.' : ''}`;
  }

  out.push({
    id: nextDecisionId(),
    source_event_ids: cluster.map((e) => String(e.context?.event_id || '')).filter(Boolean),
    priority: pr,
    target_channel: TARGET.TEACHER_NOTIFICATION,
    mode: MODE.SEND_NOW,
    message,
    actions: [
      { label: 'Répondre maintenant', action: 'answer_now' },
      { label: 'Préparer une reformulation', action: 'draft_rephrase' },
      { label: 'Garder pour clôture', action: 'mark_for_closure' },
    ],
  });

  if (massConfusion) {
    out.push({
      id: nextDecisionId(),
      source_event_ids: cluster.map((e) => String(e.context?.event_id || '')).filter(Boolean),
      priority: PRIORITY.LOW,
      target_channel: TARGET.RECAP_STORE,
      mode: MODE.STORE_ONLY,
      message: 'Point de clôture suggéré : reformuler le passage identifié par le bus.',
    });
  }

  return out;
}

/**
 * @param {NormalizedSignal[]} buffer
 * @param {Partial<{ burstImmediateTotal: number, confusedTopicHigh: number, confusedMassTotal: number }>} th
 */
export function shouldFlushStudentBufferImmediately(buffer, th = {}) {
  const burst = th.burstImmediateTotal ?? 6;
  const topicHigh = th.confusedTopicHigh ?? 3;
  const mass = th.confusedMassTotal ?? 6;
  const confused = buffer.filter((e) => e.context?.action === 'confused');
  const esc = buffer.filter((e) => e.context?.action === 'teacher_escalation');
  if (confused.length >= burst || esc.length >= 3) return true;
  const byTopic = new Map();
  for (const e of confused) {
    const key = e.context?.topic ? String(e.context.topic) : '_general';
    byTopic.set(key, (byTopic.get(key) || 0) + 1);
  }
  for (const c of byTopic.values()) {
    if (c >= topicHigh) return true;
  }
  if (confused.length >= mass) return true;
  return false;
}

/**
 * Tampon temps réel : agrège les student.action, compose des décisions, évite le spam prof.
 * @param {(decisions: DecisionOutput[]) => void} onFlush
 * @param {{ flushMs?: number, thresholds?: Partial<{ confusedMinForTeacher: number, confusedTopicHigh: number, confusedMassTotal: number, burstImmediateTotal: number }> }} [opts]
 */
export function createStudentActionDecisionBuffer(onFlush, opts = {}) {
  const flushMs = typeof opts.flushMs === 'number' ? opts.flushMs : 14_000;
  const th = opts.thresholds || {};

  /** @type {NormalizedSignal[]} */
  const buffer = [];
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;

  function runFlush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!buffer.length) return;
    const snapshot = buffer.splice(0, buffer.length);
    const decisions = composeTeacherDecisionsFromStudentSignals(snapshot, th);
    onFlush(decisions);
  }

  return {
    /**
     * @param {{ v: number; event: string; timestamp?: number; [k: string]: unknown }} msg
     */
    ingestBusStudentAction(msg) {
      const n = normalizeStudentActionFromBus(msg);
      if (!n) return;
      buffer.push(n);
      if (shouldFlushStudentBufferImmediately(buffer, th)) {
        runFlush();
        return;
      }
      if (!timer) timer = setTimeout(runFlush, flushMs);
    },
    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
      buffer.length = 0;
    },
  };
}

/**
 * @param {{ v: number; event: string; metric?: string; value?: number; detail?: string; [k: string]: unknown }} msg
 * @returns {DecisionOutput[]}
 */
export function composeFromAudienceMetricBus(msg) {
  const metric = typeof msg.metric === 'string' ? msg.metric : '';
  if (!metric) return [];
  if (metric === 'engagement_drop' || metric === 'attention_low') {
    return [
      {
        id: nextDecisionId(),
        source_event_ids: [],
        priority: PRIORITY.MEDIUM,
        target_channel: TARGET.TEACHER_NOTIFICATION,
        mode: MODE.SEND_NOW,
        message:
          typeof msg.detail === 'string' && msg.detail.trim()
            ? `Audience : ${msg.detail.trim()}`
            : 'Signal audience : baisse d’engagement détectée — envisager une question interactive ou une pause.',
        actions: [
          { label: 'Question interactive', action: 'launch_interactive_prompt' },
          { label: 'Noter pour clôture', action: 'mark_for_closure' },
        ],
      },
    ];
  }
  return [];
}

/**
 * @param {{ v: number; event: string; status?: string; surface?: string; [k: string]: unknown }} msg
 * @returns {DecisionOutput[]}
 */
export function composeFromSecureAppStatusBus(msg) {
  const status = typeof msg.status === 'string' ? msg.status : '';
  if (!status) return [];
  const hidden =
    status === 'hidden' ||
    status === 'minimized' ||
    status === 'host_tab_hidden' ||
    status === 'lost_focus';
  if (!hidden) return [];
  return [
    {
      id: nextDecisionId(),
      source_event_ids: [],
      priority: PRIORITY.CRITICAL,
      target_channel: TARGET.TEACHER_NOTIFICATION,
      mode: MODE.SEND_NOW,
      message:
        typeof msg.surface === 'string'
          ? `Contexte live : surface « ${msg.surface} » signalée comme masquée ou hors focus.`
          : 'Contexte live : application ou onglet formateur semble masqué — vérifier le flux visible élèves.',
      actions: [
        { label: 'Vérifier le partage', action: 'check_share' },
        { label: 'Pause sécurisée', action: 'secure_pause_if_configured' },
      ],
    },
  ];
}

/**
 * Heuristique légère sur une fenêtre de messages chat (sans LLM).
 * @param {{ text?: string }[]} rows
 * @returns {DecisionOutput[]}
 */
export function composeFromChatWindowHeuristic(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length < 12) return [];
  const q = list.filter((m) => typeof m.text === 'string' && m.text.includes('?')).length;
  if (q < 5) return [];
  return [
    {
      id: nextDecisionId(),
      source_event_ids: [],
      priority: PRIORITY.MEDIUM,
      target_channel: TARGET.TEACHER_NOTIFICATION,
      mode: MODE.SEND_NOW,
      message:
        'Le chat est très questionnant — une phase Q&R ou une reformulation courte pourrait débloquer la salle.',
      actions: [
        { label: 'Lancer Q&R', action: 'start_qna' },
        { label: 'Synthèse chat', action: 'summarize_chat' },
      ],
    },
  ];
}

/**
 * Transcript final (STT / bus) : définition probable → suggestion SmartBoard.
 * @param {string} text
 * @returns {DecisionOutput[]}
 */
export function composeFromTranscriptFinalStub(text) {
  const t = String(text || '').trim();
  if (t.length < 40) return [];
  const looksDef = /\b(définition|on appelle|c’est|signifie|veut dire)\b/i.test(t);
  if (!looksDef) return [];
  return [
    {
      id: nextDecisionId(),
      source_event_ids: [],
      priority: PRIORITY.LOW,
      target_channel: TARGET.SMARTBOARD_SUGGESTION,
      mode: MODE.REQUIRE_CONFIRMATION,
      message: 'Une définition centrale semble avoir été énoncée — proposer un encadré « à retenir » sur le SmartBoard ?',
      actions: [
        { label: 'Proposer sur SmartBoard', action: 'suggest_smartboard_keypoint' },
        { label: 'Stocker recap', action: 'recap_store' },
      ],
    },
  ];
}
