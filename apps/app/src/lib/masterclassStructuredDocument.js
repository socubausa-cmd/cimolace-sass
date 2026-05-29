/**
 * Masterclass — document structuré (CDC : analyse → blocs horodatés → chapitres par sujet).
 * Valide les passages renvoyés par l'IA (index caractères) et construit blocs / chapitres.
 */

export function computeTextStats(text) {
  const t = String(text || '').trim();
  if (!t) {
    return { word_count: 0, paragraph_count: 0, char_count: 0 };
  }
  const word_count = t.split(/\s+/).filter(Boolean).length;
  const paragraph_count = t.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0).length || 1;
  return { word_count, paragraph_count, char_count: t.length };
}

export function offsetToLineRange(text, start, end) {
  const L = text.length;
  const s = Math.max(0, Math.min(Number(start) || 0, L));
  const e = Math.max(s, Math.min(Number(end) || 0, L));
  const start_line = text.slice(0, s).split('\n').length;
  const end_line = text.slice(0, e).split('\n').length;
  return { start_line, end_line };
}

/**
 * @param {string} text — même chaîne que celle utilisée pour start_char/end_char (ex. préfixe si tronqué)
 * @param {object} sd — payload brut API
 * @returns {object|null}
 */
export function validateStructuredDocument(text, sd) {
  if (!sd || typeof sd !== 'object') return null;
  const L = String(text || '').length;

  const topics = Array.isArray(sd.topics)
    ? sd.topics
      .map((t, i) => ({
        id: String(t.id || `t${i + 1}`).trim() || `t${i + 1}`,
        label: String(t.label || t.title || `Sujet ${i + 1}`).slice(0, 160),
        one_line_summary: String(t.one_line_summary || t.summary || '').slice(0, 400),
      }))
      .filter((t) => t.id && t.label)
    : [];

  if (!topics.length) return null;

  const topicIds = new Set(topics.map((t) => t.id));

  const rawPassages = Array.isArray(sd.passages) ? sd.passages : [];
  const fixed = [];
  for (const p of rawPassages) {
    const topic_id = String(p.topic_id || '').trim();
    if (!topicIds.has(topic_id)) continue;
    let s = Math.max(0, Math.min(Number(p.start_char) || 0, L));
    let e = Math.max(0, Math.min(Number(p.end_char) || 0, L));
    if (e <= s) continue;
    const slice = String(text).slice(s, e);
    if (!slice.trim()) continue;
    const pass_index = Math.max(1, Number(p.pass_index) || 1);
    fixed.push({
      topic_id,
      start_char: s,
      end_char: e,
      summary: String(p.summary || '').slice(0, 600),
      pass_index,
      new_elements: p.new_elements != null && String(p.new_elements).trim()
        ? String(p.new_elements).slice(0, 600)
        : null,
      ...(p.fragment_start_id != null && p.fragment_end_id != null
        ? { fragment_start_id: p.fragment_start_id, fragment_end_id: p.fragment_end_id }
        : {}),
      ...(p.gap_fill ? { gap_fill: true } : {}),
    });
  }

  fixed.sort((a, b) => a.start_char - b.start_char || a.end_char - b.end_char);

  let order = Array.isArray(sd.recommended_chapter_order)
    ? sd.recommended_chapter_order.map((x) => String(x).trim()).filter((id) => topicIds.has(id))
    : [];
  for (const t of topics) {
    if (!order.includes(t.id)) order.push(t.id);
  }

  const search_index = Array.isArray(sd.search_index)
    ? sd.search_index.slice(0, 60).map((row) => ({
      term: String(row.term || '').slice(0, 80),
      hits: Array.isArray(row.hits)
        ? row.hits.slice(0, 14).map((h) => ({
          start_char: Math.max(0, Math.min(Number(h.start_char) || 0, L)),
          end_char: Math.max(0, Math.min(Number(h.end_char) || 0, L)),
        })).filter((h) => h.end_char > h.start_char)
        : [],
    })).filter((row) => row.term && row.hits.length)
    : [];

  return {
    central_theme: String(sd.central_theme || '').slice(0, 400),
    target_audience: String(sd.target_audience || '').slice(0, 220),
    knowledge_level: String(sd.knowledge_level || '').slice(0, 160),
    pedagogical_reordering_rationale: String(sd.pedagogical_reordering_rationale || '').slice(0, 4000),
    concept_dependencies: Array.isArray(sd.concept_dependencies) ? sd.concept_dependencies : [],
    topics,
    passages: fixed,
    recommended_chapter_order: order,
    search_index,
  };
}

export function topicLabelFromId(structured, topicId) {
  const t = structured?.topics?.find((x) => String(x.id) === String(topicId));
  return t?.label || String(topicId);
}

/**
 * @returns {object[]|null} blocs de sens ou null si aucun passage valide
 */
export function buildSenseBlocksFromStructure(text, structured) {
  if (!structured?.passages?.length) return null;
  const passages = structured.passages;
  return passages.map((p, i) => {
    const raw = String(text).slice(p.start_char, p.end_char).trim();
    const lines = offsetToLineRange(text, p.start_char, p.end_char);
    const subj = topicLabelFromId(structured, p.topic_id);
    const title = subj.slice(0, 88);
    return {
      id: `blk${i + 1}`,
      order: i,
      type: 'sense_block',
      subject_id: p.topic_id,
      subject_label: subj,
      title,
      central_idea: raw.length > 20 ? raw.slice(0, 12000) : (p.summary || raw),
      core_claim: (p.summary || raw).slice(0, 220) || title,
      lines_label:
        p.fragment_start_id != null && p.fragment_end_id != null
          ? `Frag. ${p.fragment_start_id}–${p.fragment_end_id} · L. ${lines.start_line}–${lines.end_line} · vague ${p.pass_index}`
          : `L. ${lines.start_line}–${lines.end_line} · vague ${p.pass_index}`,
      start_offset: p.start_char,
      end_offset: p.end_char,
      start_line: lines.start_line,
      end_line: lines.end_line,
      passage_index: p.pass_index,
      new_elements: p.new_elements,
      duration_minutes: Math.max(8, Math.min(35, Math.round((p.end_char - p.start_char) / 100))),
      ...(p.fragment_start_id != null && p.fragment_end_id != null
        ? { fragment_start_id: p.fragment_start_id, fragment_end_id: p.fragment_end_id }
        : {}),
    };
  });
}

/**
 * Un chapitre = un sujet (topic) ; regroupe tous les blocs qui partagent subject_id.
 * Ordre des chapitres = recommended_chapter_order puis sujets restants.
 */
export function buildChaptersFromStructuredTopics(blocks, structured) {
  if (!structured?.topics?.length || !blocks?.length) return [];

  const senseBlocks = blocks.filter(
    (b) => (b.type === 'sense_block' || !b.type) && b.subject_id,
  );
  if (!senseBlocks.length) return [];

  const order = Array.isArray(structured.recommended_chapter_order) && structured.recommended_chapter_order.length
    ? [...structured.recommended_chapter_order]
    : structured.topics.map((t) => t.id);

  const extraIds = [...new Set(senseBlocks.map((b) => String(b.subject_id)))].filter((id) => !order.includes(id));
  const fullOrder = [...order, ...extraIds];

  const byTopic = new Map();
  for (const b of senseBlocks) {
    const tid = String(b.subject_id);
    if (!byTopic.has(tid)) byTopic.set(tid, []);
    byTopic.get(tid).push(b);
  }
  for (const [, arr] of byTopic) {
    arr.sort((a, b) => (a.start_offset ?? a.order ?? 0) - (b.start_offset ?? b.order ?? 0));
  }

  const topicMeta = new Map(structured.topics.map((t) => [String(t.id), t]));
  const chapters = [];
  let ci = 0;
  for (const tid of fullOrder) {
    const group = byTopic.get(String(tid));
    if (!group?.length) continue;
    const meta = topicMeta.get(String(tid)) || {};
    const mergedContent = group.map((g) => g.central_idea).join('\n\n');
    const newBits = group.filter((g) => g.new_elements).map((g) => g.new_elements);
    chapters.push({
      id: `ch${ci}`,
      order: ci,
      title: String(meta.label || group[0].subject_label || `Chapitre ${ci + 1}`).slice(0, 120),
      objective: String(
        meta.one_line_summary || group.map((g) => g.core_claim).filter(Boolean).join(' · '),
      ).slice(0, 280),
      summary: mergedContent.slice(0, 320),
      duration: `${Math.max(15, group.length * 12)} min`,
      segments: [],
      source_block_ids: group.map((g) => g.id),
      content: mergedContent.slice(0, 12000),
      subject_id: String(tid),
      structural_new_elements: newBits.length ? newBits : undefined,
    });
    ci += 1;
  }
  return chapters;
}
