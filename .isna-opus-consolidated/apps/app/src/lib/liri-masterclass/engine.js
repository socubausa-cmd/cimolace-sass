import { SYSTEM_LIRI_MASTERCLASS_COACH } from '@/lib/liri-brain/prompts';

export const LIRI_MASTERCLASS_ENGINE_NAME = 'LIRI_MASTERCLASS_COACH';
export const LIRI_MASTERCLASS_ENGINE_VERSION = '1.0';

const CHAPTER_REQUIRED_FLAGS = [
  'has_objective',
  'has_skill',
  'has_knowledge',
  'has_situation',
  'has_tension',
  'has_thought_experiment',
  'has_revelation',
  'has_analogies',
  'has_examples',
  'has_workshop',
  'has_je_retiens',
  'has_test',
  'has_transition',
];

function defaultQualityCheck() {
  return {
    has_objective: false,
    has_skill: false,
    has_knowledge: false,
    has_situation: false,
    has_tension: false,
    has_thought_experiment: false,
    has_revelation: false,
    has_analogies: false,
    has_examples: false,
    has_workshop: false,
    has_je_retiens: false,
    has_test: false,
    has_transition: false,
  };
}

function defaultMasterclassJson(inputContent = '') {
  return {
    engine_name: LIRI_MASTERCLASS_ENGINE_NAME,
    version: LIRI_MASTERCLASS_ENGINE_VERSION,
    input: {
      type: 'text',
      content: inputContent,
      audience_level: 'mixed',
      duration_target_minutes: 120,
      teaching_style: 'participative_masterclass',
      language: 'fr',
    },
    pipeline: [
      'read_full_text',
      'segment_text_by_meaning',
      'extract_revealed_ideas',
      'extract_central_ideas',
      'detect_pedagogical_tensions',
      'build_chapters',
      'generate_chapter_scenarios',
      'generate_smartboard_blocks',
      'generate_student_notes',
      'generate_tests',
      'quality_check',
    ],
    analysis_output: {
      global_subject: '',
      global_revelations: [],
      central_themes: [],
      estimated_total_duration: '',
      segments: [],
    },
    chapters: [],
    smartboard_blocks: [],
    dictation_je_retiens: [],
    exercises: [],
    tests: [],
    transitions: [],
    quality_check: defaultQualityCheck(),
    missing_requirements: [],
  };
}

export function buildMasterclassJsonInstruction(sourceText) {
  return [
    SYSTEM_LIRI_MASTERCLASS_COACH,
    '',
    'CONTRAINTE DE SORTIE:',
    'Réponds en JSON strict uniquement, sans markdown.',
    `Le JSON doit suivre ce moteur: ${LIRI_MASTERCLASS_ENGINE_NAME} v${LIRI_MASTERCLASS_ENGINE_VERSION}.`,
    'Inclure les clés: engine_name, version, input, pipeline, analysis_output, chapters, smartboard_blocks, dictation_je_retiens, exercises, tests, transitions, quality_check.',
    '',
    'Règles minimales qualité par chapitre:',
    '- analogies >= 2',
    '- examples >= 3',
    '- workshop présent',
    '- je_retiens présent',
    '- understanding_test présent',
    '- transition_to_next présent',
    '',
    'TEXTE SOURCE:',
    String(sourceText || ''),
  ].join('\n');
}

export function tryParseMasterclassJson(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeChapter(ch, idx) {
  const c = ch && typeof ch === 'object' ? ch : {};
  const analogies = Array.isArray(c.analogies) ? c.analogies.filter(Boolean) : [];
  const examples = Array.isArray(c.examples) ? c.examples.filter(Boolean) : [];
  const jeRetiens = Array.isArray(c.je_retiens) ? c.je_retiens.filter(Boolean) : [];
  const tests = Array.isArray(c.understanding_test) ? c.understanding_test.filter(Boolean) : [];
  const workshop = c.workshop && typeof c.workshop === 'object'
    ? c.workshop
    : { instructions: '', questions: [], expected_answers: [], expected_errors: [] };
  return {
    chapter_id: Number(c.chapter_id) || idx + 1,
    title: String(c.title || `Chapitre ${idx + 1}`),
    source_segments: Array.isArray(c.source_segments) ? c.source_segments : [],
    objective: String(c.objective || ''),
    skill_to_acquire: String(c.skill_to_acquire || ''),
    knowledge_to_transmit: String(c.knowledge_to_transmit || ''),
    main_revelation: String(c.main_revelation || ''),
    recommended_duration_minutes: Number(c.recommended_duration_minutes) || 0,
    difficulty: String(c.difficulty || 'medium'),
    real_life_situation: String(c.real_life_situation || ''),
    pedagogical_tension: String(c.pedagogical_tension || ''),
    thought_experiment: String(c.thought_experiment || ''),
    revelation_moment: String(c.revelation_moment || ''),
    simple_lesson: String(c.simple_lesson || ''),
    deep_lesson: String(c.deep_lesson || ''),
    analogies,
    examples,
    reformulation: String(c.reformulation || ''),
    workshop,
    deep_error: String(c.deep_error || ''),
    pedagogical_correction: String(c.pedagogical_correction || ''),
    je_retiens: jeRetiens,
    understanding_test: tests,
    real_application: String(c.real_application || ''),
    concept_links: Array.isArray(c.concept_links) ? c.concept_links : [],
    mastery_level: c.mastery_level && typeof c.mastery_level === 'object'
      ? c.mastery_level
      : {
          level_1_understand: '',
          level_2_explain: '',
          level_3_apply: '',
          level_4_transmit: '',
        },
    transition_to_next: String(c.transition_to_next || ''),
  };
}

export function normalizeMasterclassOutput(rawJson, sourceText = '') {
  const base = defaultMasterclassJson(sourceText);
  const json = rawJson && typeof rawJson === 'object' ? rawJson : {};
  const chapters = Array.isArray(json.chapters)
    ? json.chapters.map(normalizeChapter)
    : [];
  return {
    ...base,
    ...json,
    engine_name: LIRI_MASTERCLASS_ENGINE_NAME,
    version: LIRI_MASTERCLASS_ENGINE_VERSION,
    input: {
      ...base.input,
      ...(json.input && typeof json.input === 'object' ? json.input : {}),
      content: String((json.input && json.input.content) || sourceText || ''),
    },
    analysis_output: {
      ...base.analysis_output,
      ...(json.analysis_output && typeof json.analysis_output === 'object' ? json.analysis_output : {}),
      segments: Array.isArray(json?.analysis_output?.segments) ? json.analysis_output.segments : [],
    },
    chapters,
    smartboard_blocks: Array.isArray(json.smartboard_blocks) ? json.smartboard_blocks : [],
    dictation_je_retiens: Array.isArray(json.dictation_je_retiens) ? json.dictation_je_retiens : [],
    exercises: Array.isArray(json.exercises) ? json.exercises : [],
    tests: Array.isArray(json.tests) ? json.tests : [],
    transitions: Array.isArray(json.transitions) ? json.transitions : [],
    quality_check: {
      ...defaultQualityCheck(),
      ...(json.quality_check && typeof json.quality_check === 'object' ? json.quality_check : {}),
    },
  };
}

function chapterMissing(chapter) {
  const missing = [];
  if (!chapter.objective) missing.push('objective');
  if (!chapter.skill_to_acquire) missing.push('skill_to_acquire');
  if (!chapter.knowledge_to_transmit) missing.push('knowledge_to_transmit');
  if (!chapter.real_life_situation) missing.push('real_life_situation');
  if (!chapter.pedagogical_tension) missing.push('pedagogical_tension');
  if (!chapter.thought_experiment) missing.push('thought_experiment');
  if (!chapter.main_revelation && !chapter.revelation_moment) missing.push('revelation');
  if (!Array.isArray(chapter.analogies) || chapter.analogies.length < 2) missing.push('analogies>=2');
  if (!Array.isArray(chapter.examples) || chapter.examples.length < 3) missing.push('examples>=3');
  if (!chapter.workshop?.instructions) missing.push('workshop');
  if (!Array.isArray(chapter.je_retiens) || chapter.je_retiens.length === 0) missing.push('je_retiens');
  if (!Array.isArray(chapter.understanding_test) || chapter.understanding_test.length === 0) missing.push('understanding_test');
  if (!chapter.transition_to_next) missing.push('transition_to_next');
  return missing;
}

export function evaluateMasterclassQuality(masterclass) {
  const missing = [];
  const chapters = Array.isArray(masterclass?.chapters) ? masterclass.chapters : [];
  if (!chapters.length) missing.push('chapters');
  chapters.forEach((ch, idx) => {
    const m = chapterMissing(ch);
    if (m.length) missing.push(`chapter_${idx + 1}:${m.join(',')}`);
  });
  const nextQuality = {
    has_objective: chapters.every((ch) => Boolean(ch.objective)),
    has_skill: chapters.every((ch) => Boolean(ch.skill_to_acquire)),
    has_knowledge: chapters.every((ch) => Boolean(ch.knowledge_to_transmit)),
    has_situation: chapters.every((ch) => Boolean(ch.real_life_situation)),
    has_tension: chapters.every((ch) => Boolean(ch.pedagogical_tension)),
    has_thought_experiment: chapters.every((ch) => Boolean(ch.thought_experiment)),
    has_revelation: chapters.every((ch) => Boolean(ch.main_revelation || ch.revelation_moment)),
    has_analogies: chapters.every((ch) => Array.isArray(ch.analogies) && ch.analogies.length >= 2),
    has_examples: chapters.every((ch) => Array.isArray(ch.examples) && ch.examples.length >= 3),
    has_workshop: chapters.every((ch) => Boolean(ch.workshop?.instructions)),
    has_je_retiens: chapters.every((ch) => Array.isArray(ch.je_retiens) && ch.je_retiens.length > 0),
    has_test: chapters.every((ch) => Array.isArray(ch.understanding_test) && ch.understanding_test.length > 0),
    has_transition: chapters.every((ch) => Boolean(ch.transition_to_next)),
  };
  CHAPTER_REQUIRED_FLAGS.forEach((k) => {
    if (!nextQuality[k]) missing.push(k);
  });
  return {
    quality_check: nextQuality,
    missing_requirements: [...new Set(missing)],
    valid: missing.length === 0,
  };
}

export function buildMasterclassRepairInstruction(masterclassJson) {
  return [
    SYSTEM_LIRI_MASTERCLASS_COACH,
    '',
    'Corrige le JSON ci-dessous pour satisfaire toutes les contraintes de qualité.',
    'Tu dois conserver le contenu existant et compléter seulement les sections manquantes.',
    'Réponds en JSON strict uniquement.',
    '',
    JSON.stringify(masterclassJson || {}, null, 2),
  ].join('\n');
}

export function buildArchitectSourceFromMasterclass(masterclass) {
  const m = masterclass && typeof masterclass === 'object' ? masterclass : {};
  const analysis = m.analysis_output || {};
  const chapters = Array.isArray(m.chapters) ? m.chapters : [];
  const top = [
    `Sujet global: ${analysis.global_subject || ''}`.trim(),
    `Révélations globales: ${(analysis.global_revelations || []).join(' | ')}`.trim(),
    `Thèmes centraux: ${(analysis.central_themes || []).join(' | ')}`.trim(),
  ].filter(Boolean).join('\n');
  const body = chapters.map((ch, i) => {
    const analogies = (ch.analogies || []).map((a) => `- ${a?.content || ''}`).filter(Boolean).join('\n');
    const examples = (ch.examples || []).map((e) => `- ${e?.content || ''}`).filter(Boolean).join('\n');
    const jeRetiens = (ch.je_retiens || []).map((x) => `- ${x}`).join('\n');
    return [
      `CHAPITRE ${i + 1} — ${ch.title || `Chapitre ${i + 1}`}`,
      `Objectif: ${ch.objective || ''}`,
      `Compétence: ${ch.skill_to_acquire || ''}`,
      `Connaissance: ${ch.knowledge_to_transmit || ''}`,
      `Révélation: ${ch.main_revelation || ch.revelation_moment || ''}`,
      `Leçon simple: ${ch.simple_lesson || ''}`,
      `Leçon développée: ${ch.deep_lesson || ''}`,
      `Analogies:\n${analogies || '- (à compléter)'}`,
      `Exemples:\n${examples || '- (à compléter)'}`,
      `JE RETIENS:\n${jeRetiens || '- (à compléter)'}`,
      `Transition: ${ch.transition_to_next || ''}`,
    ].join('\n');
  }).join('\n\n');
  return [top, body].filter(Boolean).join('\n\n');
}
