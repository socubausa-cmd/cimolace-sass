/**
 * Mappe la réponse de smartboard-mindmap-course vers le brouillon wizard (scènes ia_data texte + script).
 * Sections enrichies LIRI : pedagogical_phase, teacher_intention, questions_for_class, MasterScript, etc.
 */

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * @param {object} data — { deck_title, mindmap_mermaid, sections[] }
 * @param {string} [draftTitle]
 * @returns {object} patch pour updateDraft
 */
export function mapMindmapCourseResponseToDraft(data, draftTitle = '') {
  const sections = Array.isArray(data?.sections) ? data.sections : [];
  const mindmap = String(data?.mindmap_mermaid || '').trim();
  const deckTitle = String(data?.deck_title || draftTitle || 'Cours').trim();

  const master_sections = sections.map((sec, i) => {
    const points = (sec.key_points || []).slice(0, 6);
    const retention = points.filter((p) => p && p !== '—').join(' · ') || sec.summary;
    const qs = Array.isArray(sec.questions_for_class) ? sec.questions_for_class : [];
    const lines = [];
    if (sec.pedagogical_phase) lines.push(`【Phase】 ${sec.pedagogical_phase}`);
    if (sec.teacher_intention) lines.push(`【Intention】\n${sec.teacher_intention}`);
    lines.push(`【Résumé élève / SmartBoard】\n${sec.summary || '—'}`);
    lines.push(`【Sous-titre】\n${sec.subtitle || '—'}`);
    if (qs.length) lines.push(`【Questions à poser】\n${qs.map((q) => `• ${q}`).join('\n')}`);
    if (sec.refutation_or_limits && String(sec.refutation_or_limits).trim() && sec.refutation_or_limits !== '—') {
      lines.push(`【Limites / réfutations】\n${sec.refutation_or_limits}`);
    }
    if (sec.student_understanding) lines.push(`【Compréhension visée】\n${sec.student_understanding}`);
    lines.push(`【À retenir】\n${points.map((p) => `• ${p}`).join('\n')}`);
    if (sec.transition) lines.push(`【Transition】\n${sec.transition}`);
    return {
      id: uid('ms'),
      slide_index: i,
      title: sec.title,
      script: sec.oral_script || sec.summary,
      content: lines.join('\n\n'),
      objective: sec.student_understanding || sec.summary,
      description: sec.subtitle || '',
      retention,
    };
  });

  const scenes = sections.map((sec, i) => {
    const pts = (sec.key_points || []).slice(0, 3);
    while (pts.length < 3) pts.push('—');
    const ill = String(sec.illustration_hint || '').trim();
    const ia_data = {
      display_context: {
        shell: 'liri_intelligent_screen',
        responsive: true,
        design_width: 1037,
        design_height: 750,
        note:
          'Canevas conception 1037×750 mis à l\'échelle (contain) dans l\'Écran intelligent — aligné Architect / JSON.',
      },
      title: sec.title,
      subtitle: sec.subtitle || '',
      core_idea: sec.summary,
      slide_summary: sec.summary,
      development: [
        { label: 'Points clés', points: pts },
        ...(sec.pedagogical_phase
          ? [{ label: 'Phase LIRI', points: [String(sec.pedagogical_phase)] }]
          : []),
      ],
      hero_visual: { type: 'concept_diagram', description: ill.slice(0, 400) },
      illustration: {
        scene: ill.slice(0, 200),
        insight: sec.teacher_intention ? String(sec.teacher_intention).slice(0, 200) : '',
        formula: '',
        advice: sec.transition ? String(sec.transition).slice(0, 200) : '',
        mermaid: i === 0 ? mindmap : '',
      },
      illustration_image_url: '',
      visual_description: ill.slice(0, 500),
      layout_mode: 'smartboard_horizontal',
      course_mode: 'mindmap_outline',
    };
    return {
      id: uid('mm'),
      name: sec.title,
      order_index: i,
      scene_type: 'progressive_build',
      ia_data,
      elements: [],
    };
  });

  const patch = {
    smartboard_element_scenes: scenes,
    smartboard_master_script_sections: master_sections,
    smartboard_course_mindmap_mermaid: mindmap,
  };
  if (!String(draftTitle || '').trim() && deckTitle) {
    patch.title = deckTitle;
  }
  return patch;
}
