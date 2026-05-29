import { describe, expect, it } from 'vitest';
import {
  composeFromAudienceMetricBus,
  composeFromChatWindowHeuristic,
  composeFromSecureAppStatusBus,
  composeFromTranscriptFinalStub,
  composeTeacherDecisionsFromStudentSignals,
  MODE,
  normalizeStudentActionFromBus,
  PRIORITY,
  shouldFlushStudentBufferImmediately,
  TARGET,
} from './longiaDecisionEngine';

function busMsg(action, student_id, topic = null) {
  return {
    v: 1,
    event: 'student.action',
    timestamp: Math.floor(Date.now() / 1000),
    action,
    student_id,
    topic,
  };
}

describe('normalizeStudentActionFromBus', () => {
  it('returns null for wrong event', () => {
    expect(normalizeStudentActionFromBus({ v: 1, event: 'chat.message' })).toBeNull();
  });

  it('normalizes confused', () => {
    const n = normalizeStudentActionFromBus(busMsg('confused', 'u1', 'âme'));
    expect(n?.type).toBe('student.action');
    expect(n?.context?.action).toBe('confused');
    expect(n?.context?.topic).toBe('âme');
  });
});

describe('composeTeacherDecisionsFromStudentSignals', () => {
  it('isolated confusion — no teacher channel', () => {
    const e = [normalizeStudentActionFromBus(busMsg('confused', 'a'))].filter(Boolean);
    const d = composeTeacherDecisionsFromStudentSignals(e);
    expect(d.some((x) => x.target_channel === TARGET.TEACHER_NOTIFICATION)).toBe(false);
    expect(d.some((x) => x.target_channel === TARGET.SILENT_STORE)).toBe(true);
  });

  it('explicit escalation alone — notifies teacher', () => {
    const e = [normalizeStudentActionFromBus(busMsg('teacher_escalation', 'b'))].filter(Boolean);
    const d = composeTeacherDecisionsFromStudentSignals(e);
    const t = d.find((x) => x.target_channel === TARGET.TEACHER_NOTIFICATION);
    expect(t?.mode).toBe(MODE.SEND_NOW);
  });

  it('mass confusion — high priority + recap', () => {
    const e = [];
    for (let i = 0; i < 6; i += 1) {
      const n = normalizeStudentActionFromBus(busMsg('confused', `s${i}`));
      if (n) e.push(n);
    }
    const d = composeTeacherDecisionsFromStudentSignals(e);
    const t = d.find((x) => x.target_channel === TARGET.TEACHER_NOTIFICATION);
    expect(t?.priority === PRIORITY.HIGH || t?.priority === PRIORITY.CRITICAL).toBe(true);
    expect(d.some((x) => x.target_channel === TARGET.RECAP_STORE)).toBe(true);
  });

  it('same topic cluster ≥3 — teacher notified', () => {
    const e = [1, 2, 3]
      .map((i) => normalizeStudentActionFromBus(busMsg('confused', `u${i}`, 'topic_x')))
      .filter(Boolean);
    const d = composeTeacherDecisionsFromStudentSignals(e);
    expect(d.some((x) => x.target_channel === TARGET.TEACHER_NOTIFICATION)).toBe(true);
  });
});

describe('shouldFlushStudentBufferImmediately', () => {
  it('true when topic bucket ≥3', () => {
    const buf = [1, 2, 3]
      .map((i) => normalizeStudentActionFromBus(busMsg('confused', `u${i}`, 't1')))
      .filter(Boolean);
    expect(shouldFlushStudentBufferImmediately(buf)).toBe(true);
  });
});

describe('composeFromTranscriptFinalStub', () => {
  it('returns smartboard suggestion for definition-like text', () => {
    const d = composeFromTranscriptFinalStub(
      'Aujourd\'hui on donne la définition du concept central pour la suite du cours.',
    );
    expect(d.length).toBeGreaterThan(0);
    expect(d[0].target_channel).toBe(TARGET.SMARTBOARD_SUGGESTION);
  });
});

describe('composeFromAudienceMetricBus', () => {
  it('notifies on engagement_drop', () => {
    const d = composeFromAudienceMetricBus({
      v: 1,
      event: 'audience.metric',
      metric: 'engagement_drop',
    });
    expect(d[0]?.target_channel).toBe(TARGET.TEACHER_NOTIFICATION);
    expect(d[0]?.mode).toBe(MODE.SEND_NOW);
  });
});

describe('composeFromSecureAppStatusBus', () => {
  it('critical on hidden', () => {
    const d = composeFromSecureAppStatusBus({
      v: 1,
      event: 'secure_app.status',
      status: 'host_tab_hidden',
    });
    expect(d[0]?.priority).toBe(PRIORITY.CRITICAL);
  });
});

describe('composeFromChatWindowHeuristic', () => {
  it('empty when few messages', () => {
    expect(composeFromChatWindowHeuristic([{ text: '?' }])).toEqual([]);
  });

  it('suggests Q&R when many question marks', () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({
      text: i % 2 === 0 ? `Question ${i} ?` : 'ok',
    }));
    const d = composeFromChatWindowHeuristic(rows);
    expect(d.length).toBe(1);
    expect(d[0].target_channel).toBe(TARGET.TEACHER_NOTIFICATION);
  });
});
