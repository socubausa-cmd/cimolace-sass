import jsPDF from 'jspdf';

/**
 * Export PDF d'un COURS extrait d'un replay (transcription → document structuré).
 *
 * Texte NATIF jsPDF (pas de html2canvas) : le PDF reste léger, le texte est
 * sélectionnable/copiable et cherchable — indispensable pour un document de
 * révision de plusieurs dizaines de pages. Mise en page sobre, chaude (charte
 * LIRI), avec page de garde, sommaire, modules/leçons, points clés et glossaire.
 */

const COLORS = {
  ink: [38, 38, 36], //  #262624 — texte principal
  coral: [217, 119, 87], // #d97757 — accents
  clay: [194, 104, 63], //  #c2683f — accents secondaires
  muted: [130, 128, 122], // #82807a — texte discret
  rule: [222, 218, 210],
};

const A4 = { w: 210, h: 297 };
const M = { top: 22, bottom: 20, left: 20, right: 20 };
const CONTENT_W = A4.w - M.left - M.right;

export async function exportCoursePdf(course, opts = {}) {
  const schoolName = opts.schoolName || 'Prorascience';
  const fileName =
    opts.fileName ||
    `${slugify(course?.title || 'cours')}.pdf`;

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  let page = 1;
  let y = M.top;

  // ── helpers ──────────────────────────────────────────────────────────────
  const setFont = (style = 'normal', size = 11, color = COLORS.ink) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const newPage = () => {
    doc.addPage();
    page += 1;
    y = M.top;
    footer();
  };
  const room = (h) => {
    if (y + h > A4.h - M.bottom) newPage();
  };
  const footer = () => {
    setFont('normal', 8, COLORS.muted);
    doc.text(schoolName, M.left, A4.h - 12);
    doc.text(String(page), A4.w - M.right, A4.h - 12, { align: 'right' });
  };
  /** Écrit un paragraphe justifié avec retour à la ligne + saut de page auto. */
  const paragraph = (text, { size = 10.5, style = 'normal', color = COLORS.ink, lead = 5.2, gap = 3 } = {}) => {
    if (!text) return;
    setFont(style, size, color);
    const lines = doc.splitTextToSize(String(text), CONTENT_W);
    lines.forEach((ln) => {
      room(lead);
      doc.text(ln, M.left, y);
      y += lead;
    });
    y += gap;
  };
  const rule = () => {
    room(6);
    doc.setDrawColor(...COLORS.rule);
    doc.setLineWidth(0.2);
    doc.line(M.left, y, A4.w - M.right, y);
    y += 6;
  };

  // ── Page de garde ────────────────────────────────────────────────────────
  y = 70;
  setFont('normal', 9, COLORS.coral);
  doc.text(schoolName.toUpperCase(), M.left, y);
  y += 4;
  doc.setDrawColor(...COLORS.coral);
  doc.setLineWidth(0.8);
  doc.line(M.left, y, M.left + 24, y);
  y += 16;

  setFont('bold', 24, COLORS.ink);
  doc.splitTextToSize(course.title || 'Cours', CONTENT_W).forEach((ln) => {
    doc.text(ln, M.left, y);
    y += 10.5;
  });

  if (course.subtitle) {
    y += 2;
    setFont('normal', 12, COLORS.clay);
    doc.splitTextToSize(course.subtitle, CONTENT_W).forEach((ln) => {
      doc.text(ln, M.left, y);
      y += 6;
    });
  }

  y += 10;
  const meta = course.meta || {};
  setFont('normal', 9, COLORS.muted);
  const metaLines = [
    meta.sourceTitle ? `D'après la séance : ${meta.sourceTitle}` : null,
    meta.durationMin ? `Durée du direct : ${formatDuration(meta.durationMin)}` : null,
    meta.generatedAt ? `Document généré le ${new Date(meta.generatedAt).toLocaleDateString('fr-FR')}` : null,
  ].filter(Boolean);
  metaLines.forEach((l) => {
    doc.text(l, M.left, y);
    y += 4.6;
  });

  // Résumé en encadré chaud
  if (course.summary) {
    y += 8;
    const lines = doc.splitTextToSize(course.summary, CONTENT_W - 12);
    const boxH = lines.length * 5 + 12;
    doc.setFillColor(250, 246, 243);
    doc.setDrawColor(...COLORS.coral);
    doc.setLineWidth(0.4);
    doc.roundedRect(M.left, y, CONTENT_W, boxH, 2, 2, 'FD');
    setFont('normal', 10, COLORS.ink);
    let ty = y + 8;
    lines.forEach((ln) => {
      doc.text(ln, M.left + 6, ty);
      ty += 5;
    });
    y += boxH + 10;
  }

  // Objectifs
  if (course.objectives?.length) {
    setFont('bold', 11, COLORS.ink);
    room(8);
    doc.text('Ce que vous saurez à la fin', M.left, y);
    y += 6;
    course.objectives.forEach((o) => {
      setFont('normal', 10, COLORS.ink);
      const lines = doc.splitTextToSize(String(o), CONTENT_W - 6);
      lines.forEach((ln, i) => {
        room(5);
        if (i === 0) {
          doc.setTextColor(...COLORS.coral);
          doc.text('•', M.left, y);
          doc.setTextColor(...COLORS.ink);
        }
        doc.text(ln, M.left + 5, y);
        y += 5;
      });
      y += 1;
    });
  }
  footer();

  // ── Sommaire ─────────────────────────────────────────────────────────────
  const modules = Array.isArray(course.modules) ? course.modules : [];
  if (modules.length) {
    newPage();
    setFont('bold', 15, COLORS.ink);
    doc.text('Sommaire', M.left, y);
    y += 9;
    rule();
    modules.forEach((m, i) => {
      setFont('bold', 11, COLORS.clay);
      room(7);
      doc.text(`${i + 1}. ${m.title || 'Module'}`, M.left, y);
      y += 6;
      (m.lessons || []).forEach((l, j) => {
        setFont('normal', 10, COLORS.muted);
        room(5);
        doc.text(`${i + 1}.${j + 1}  ${l.title || 'Leçon'}`, M.left + 6, y);
        y += 5;
      });
      y += 3;
    });
  }

  // ── Modules & leçons ─────────────────────────────────────────────────────
  modules.forEach((m, i) => {
    newPage();
    // Bandeau de module
    setFont('normal', 9, COLORS.coral);
    doc.text(`MODULE ${i + 1}`, M.left, y);
    y += 7;
    setFont('bold', 17, COLORS.ink);
    doc.splitTextToSize(m.title || 'Module', CONTENT_W).forEach((ln) => {
      doc.text(ln, M.left, y);
      y += 8;
    });
    if (m.description) {
      y += 1;
      paragraph(m.description, { size: 10.5, color: COLORS.muted, lead: 5 });
    }
    rule();

    (m.lessons || []).forEach((l, j) => {
      room(24);
      setFont('bold', 12.5, COLORS.clay);
      const tLines = doc.splitTextToSize(`${i + 1}.${j + 1}  ${l.title || 'Leçon'}`, CONTENT_W);
      tLines.forEach((ln) => {
        room(7);
        doc.text(ln, M.left, y);
        y += 6.5;
      });
      y += 2;

      paragraph(l.content, { size: 10.5, lead: 5.4, gap: 3 });

      if (l.key_points?.length) {
        const kp = l.key_points.map((k) => `• ${k}`).join('\n');
        setFont('normal', 9.5, COLORS.ink);
        const lines = doc.splitTextToSize(kp, CONTENT_W - 12);
        const boxH = lines.length * 4.8 + 10;
        room(boxH + 4);
        doc.setFillColor(248, 245, 240);
        doc.setDrawColor(...COLORS.rule);
        doc.setLineWidth(0.2);
        doc.roundedRect(M.left, y, CONTENT_W, boxH, 1.5, 1.5, 'FD');
        setFont('bold', 8.5, COLORS.coral);
        doc.text('À RETENIR', M.left + 5, y + 6);
        setFont('normal', 9.5, COLORS.ink);
        let ty = y + 11.5;
        lines.forEach((ln) => {
          doc.text(ln, M.left + 5, ty);
          ty += 4.8;
        });
        y += boxH + 7;
      }
      y += 2;
    });
  });

  // ── Glossaire ────────────────────────────────────────────────────────────
  if (course.glossary?.length) {
    newPage();
    setFont('bold', 15, COLORS.ink);
    doc.text('Glossaire', M.left, y);
    y += 9;
    rule();
    course.glossary.forEach((g) => {
      room(10);
      setFont('bold', 10.5, COLORS.clay);
      doc.text(String(g.term || ''), M.left, y);
      y += 5;
      paragraph(g.definition, { size: 10, lead: 5, gap: 3 });
    });
  }

  // ── Mention de provenance ────────────────────────────────────────────────
  room(16);
  y = Math.max(y, A4.h - M.bottom - 14);
  setFont('normal', 8, COLORS.muted);
  doc.text(
    'Document généré automatiquement à partir de la transcription de la séance, puis reformulé.',
    M.left,
    y,
  );
  doc.text('Il complète la vidéo et ne la remplace pas.', M.left, y + 4);

  doc.save(fileName);
  return fileName;
}

function formatDuration(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}

function slugify(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'cours';
}
