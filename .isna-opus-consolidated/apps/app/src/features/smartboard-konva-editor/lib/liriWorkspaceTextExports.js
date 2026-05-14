/**
 * Exports texte hors canvas (Module 10) — script prof, support élève, flashcards.
 */

/**
 * @param {string} filename
 * @param {string} body
 * @param {string} [mime]
 */
export function triggerDownloadTextFile(filename, body, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([body], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** @param {string} s */
function escMd(s) {
  return String(s ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * @param {import('../model/courseCopilotTypes').LiriCourseCopilotCourse} course
 * @param {{ slideTimingMinutes?: number[] | null }} [opts]
 */
export function buildProfessorScriptMarkdown(course, opts = {}) {
  const timing = opts.slideTimingMinutes;
  const lines = [];
  lines.push(`# ${escMd(course.title)}`);
  lines.push('');
  lines.push(escMd(course.description));
  lines.push('');
  lines.push('## Analyse');
  const a = course.analysis;
  if (a) {
    lines.push(`- **Sujet principal :** ${escMd(a.mainTopic)}`);
    if (a.estimatedDurationMinutes != null) {
      lines.push(`- **Durée recommandée :** ${a.estimatedDurationMinutes} min`);
    }
    if (a.complexity) lines.push(`- **Niveau :** ${escMd(a.complexity)}`);
  }
  lines.push('');
  if (course.masterScriptOverview?.trim()) {
    lines.push('## Vue globale (MasterScript)');
    lines.push('');
    lines.push(escMd(course.masterScriptOverview));
    lines.push('');
  }

  const slides = course.slides || [];
  slides.forEach((slide, i) => {
    const dur = Array.isArray(timing) && timing[i] != null ? ` — *${timing[i]} min*` : '';
    lines.push(`## Fiche ${i + 1} — ${escMd(slide.title)}${dur}`);
    lines.push('');
    lines.push(`**Type :** ${escMd(slide.type)}`);
    lines.push('');
    lines.push('### Objectif');
    lines.push(escMd(slide.objective));
    lines.push('');
    const ms = slide.masterScript;
    if (ms) {
      lines.push('### Discours suggéré');
      lines.push(escMd(ms.discourse));
      lines.push('');
      if (ms.keyPoints?.length) {
        lines.push('### Points clés');
        ms.keyPoints.forEach((k) => lines.push(`- ${escMd(k)}`));
        lines.push('');
      }
      lines.push('### Transition');
      lines.push(escMd(ms.transitions));
      lines.push('');
    }
    const sug = slide.suggestions;
    if (sug) {
      lines.push('### Pistes visuelles');
      lines.push(`- Type : ${escMd(sug.visualType)}`);
      lines.push(`- Schéma : ${escMd(sug.diagramHint)}`);
      if (sug.layoutTips?.length) {
        sug.layoutTips.forEach((t, j) => lines.push(`- Conseil ${j + 1} : ${escMd(t)}`));
      }
      lines.push('');
    }
  });

  return lines.join('\n').trim() + '\n';
}

/**
 * @param {import('../model/courseCopilotTypes').LiriCourseCopilotCourse} course
 */
export function buildStudentHandoutMarkdown(course) {
  const lines = [];
  lines.push(`# ${escMd(course.title)}`);
  lines.push('');
  lines.push('*Support élève — à compléter en cours.*');
  lines.push('');
  lines.push(escMd(course.description));
  lines.push('');

  const slides = course.slides || [];
  slides.forEach((slide, i) => {
    lines.push(`## ${i + 1}. ${escMd(slide.title)}`);
    lines.push('');
    lines.push(`**À retenir :** ${escMd(slide.objective)}`);
    lines.push('');
    if (slide.masterScript?.keyPoints?.length) {
      slide.masterScript.keyPoints.forEach((k) => lines.push(`- ${escMd(k)}`));
      lines.push('');
    }
    const blocks = slide.content?.blocks;
    if (Array.isArray(blocks) && blocks.length) {
      lines.push('*Contenus (extraits) :*');
      blocks.slice(0, 6).forEach((b) => {
        if (typeof b === 'string' && b.trim()) lines.push(`- ${escMd(b)}`);
      });
      lines.push('');
    }
  });

  return lines.join('\n').trim() + '\n';
}

/**
 * @param {import('../model/courseCopilotTypes').LiriCourseCopilotCourse} course
 */
export function buildFlashcardsPlainText(course) {
  const lines = [];
  lines.push(`# Flashcards — ${escMd(course.title)}`);
  lines.push('');
  const slides = course.slides || [];
  slides.forEach((slide, i) => {
    const q = slide.title?.trim() || `Fiche ${i + 1}`;
    const kp = slide.masterScript?.keyPoints?.[0]?.trim();
    const r = kp || slide.objective?.trim() || '—';
    lines.push(`---`);
    lines.push(`Q${i + 1}: ${escMd(q)}`);
    lines.push(`R${i + 1}: ${escMd(r)}`);
    lines.push('');
  });
  return lines.join('\n').trim() + '\n';
}

/**
 * Quiz synthétique à partir du plan (M10) — à relire avant diffusion.
 * @param {import('../model/courseCopilotTypes').LiriCourseCopilotCourse} course
 */
export function buildQuizMarkdown(course) {
  const lines = [];
  lines.push(`# Quiz — ${escMd(course.title)}`);
  lines.push('');
  lines.push('*Généré depuis le plan Copilot — valider les énoncés et le barème.*');
  lines.push('');

  const slides = course.slides || [];
  slides.forEach((slide, i) => {
    lines.push(`## Question ${i + 1} — ${escMd(slide.title)}`);
    lines.push('');
    lines.push(`**Objectif pédagogique testé :** ${escMd(slide.objective)}`);
    lines.push('');
    const kp = (slide.masterScript?.keyPoints || []).filter(Boolean);
    if (kp.length >= 2) {
      lines.push('**Propositions (une bonne réponse) :**');
      const labels = ['A', 'B', 'C', 'D'];
      kp.slice(0, 4).forEach((k, j) => {
        lines.push(`- **${labels[j]}.** ${escMd(k)}`);
      });
      lines.push('');
      lines.push(
        `*Piste de correction :* la réponse attendue s’aligne sur l’objectif ci-dessus (adapter selon votre pédagogie).`,
      );
    } else {
      lines.push('**Réponse attendue (rédaction courte) :** *(à formuler)*');
      lines.push('');
      if (kp[0]) lines.push(`*Indice :* ${escMd(kp[0])}`);
    }
    lines.push('');
  });

  return lines.join('\n').trim() + '\n';
}

/**
 * Pack plan — vue condensée pour partage / impression (M10).
 * @param {import('../model/courseCopilotTypes').LiriCourseCopilotCourse} course
 * @param {{ slideTimingMinutes?: number[] | null }} [opts]
 */
export function buildSlidePackOutlineMarkdown(course, opts = {}) {
  const timing = opts.slideTimingMinutes;
  const lines = [];
  lines.push(`# Pack plan — ${escMd(course.title)}`);
  lines.push('');
  lines.push(escMd(course.description));
  lines.push('');
  const a = course.analysis;
  if (a?.estimatedDurationMinutes != null) {
    lines.push(`**Durée recommandée (analyse) :** ${a.estimatedDurationMinutes} min`);
    lines.push('');
  }

  const slides = course.slides || [];
  let sumT = 0;
  slides.forEach((slide, i) => {
    const t = Array.isArray(timing) && timing[i] != null ? timing[i] : null;
    if (typeof t === 'number' && Number.isFinite(t)) sumT += t;
    const dur = t != null ? ` — *${t} min*` : '';
    lines.push(`### ${i + 1}. ${escMd(slide.title)}${dur}`);
    lines.push('');
    lines.push(`- **Type :** ${escMd(slide.type)}`);
    lines.push(`- **Objectif :** ${escMd(slide.objective)}`);
    if (slide.masterScript?.keyPoints?.length) {
      lines.push('- **Points clés :**');
      slide.masterScript.keyPoints.forEach((k) => lines.push(`  - ${escMd(k)}`));
    }
    lines.push('');
  });

  if (sumT > 0) {
    lines.push(`---`);
    lines.push(`**Σ durées plan :** ${Math.round(sumT * 10) / 10} min`);
    lines.push('');
  }

  return lines.join('\n').trim() + '\n';
}
