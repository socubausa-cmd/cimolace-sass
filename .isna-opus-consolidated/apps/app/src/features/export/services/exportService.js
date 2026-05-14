/**
 * Export Service — PDF, JSON, PPTX, student/teacher variants.
 */
import { genId } from '@/lib/ids';

// ── JSON Export ───────────────────────────────────────────────────────────────

export function exportProjectJson(slides) {
  const payload = JSON.stringify({
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    slides,
  }, null, 2);
  downloadBlob(new Blob([payload], { type: 'application/json' }), 'liri-smartboard.json');
}

// ── Canvas PNG Export ─────────────────────────────────────────────────────────

export async function exportSlidePng(stageRef, filename = 'slide.png') {
  if (!stageRef?.current) throw new Error('Stage ref non disponible');
  const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
  downloadDataUrl(uri, filename);
}

// ── PDF Export (via html2canvas + jsPDF) ─────────────────────────────────────

export async function exportSlidesPdf(slides, stageRef, options = {}) {
  const { includeTeacherNotes = false, title = 'SmartBoard LIRI' } = options;

  // Dynamically import to avoid bundle bloat if unused
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  pdf.setProperties({ title, creator: 'LIRI Pro' });

  // One page per slide
  for (let i = 0; i < slides.length; i++) {
    if (i > 0) pdf.addPage();

    // Slide title
    pdf.setFontSize(10);
    pdf.setTextColor(180, 180, 180);
    pdf.text(`${i + 1}. ${slides[i].title}`, 10, pageH - 5);

    // If stage is available, capture it
    if (stageRef?.current && i === 0) {
      try {
        const canvas = await html2canvas(stageRef.current, { scale: 1, useCORS: true });
        const imgData = canvas.toDataURL('image/jpeg', 0.85);
        pdf.addImage(imgData, 'JPEG', 0, 0, pageW, pageH - 10);
      } catch {
        // Fallback: just show title
        pdf.setFontSize(18);
        pdf.setTextColor(255, 255, 255);
        pdf.text(slides[i].title, pageW / 2, pageH / 2, { align: 'center' });
      }
    } else {
      // Slide without rendered canvas
      pdf.setFillColor(15, 17, 23);
      pdf.rect(0, 0, pageW, pageH, 'F');
      pdf.setFontSize(18);
      pdf.setTextColor(212, 175, 55);
      pdf.text(slides[i].title, pageW / 2, pageH / 2 - 5, { align: 'center' });

      if (slides[i].sections?.length > 0) {
        pdf.setFontSize(10);
        pdf.setTextColor(150, 150, 150);
        slides[i].sections.forEach((sec, si) => {
          pdf.text(`• ${sec.label}`, pageW / 2, pageH / 2 + 10 + si * 7, { align: 'center' });
        });
      }
    }

    // Teacher notes page
    if (includeTeacherNotes && slides[i].segmentIds?.length > 0) {
      pdf.addPage();
      pdf.setFillColor(10, 12, 20);
      pdf.rect(0, 0, pageW, pageH, 'F');
      pdf.setFontSize(12);
      pdf.setTextColor(212, 175, 55);
      pdf.text(`Notes prof — ${slides[i].title}`, 10, 15);
      pdf.setFontSize(9);
      pdf.setTextColor(200, 200, 200);
      pdf.text(`Sections : ${slides[i].sections?.map((s) => s.label).join(' → ') || 'Aucune'}`, 10, 25);
    }
  }

  pdf.save(`${title}.pdf`);
}

// ── Student PDF (elements visibles par les élèves uniquement) ─────────────────

export async function exportStudentPdf(slides, title = 'Support Élève') {
  return exportSlidesPdf(slides, null, { title, includeTeacherNotes: false });
}

export async function exportTeacherPdf(slides, title = 'Guide Professeur') {
  return exportSlidesPdf(slides, null, { title, includeTeacherNotes: true });
}

// ── PPTX Export (via pptxgenjs) ───────────────────────────────────────────────

export async function exportSlidesPptx(slides, title = 'LIRI SmartBoard') {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'WIDESCREEN', width: 13.33, height: 7.5 });
  pptx.layout = 'WIDESCREEN';

  for (const slide of slides) {
    const pSlide = pptx.addSlide();

    // Background
    pSlide.background = { color: '0F1117' };

    // Title
    pSlide.addText(slide.title, {
      x: 0.5, y: 0.3, w: 12, h: 0.8,
      fontSize: 28, color: 'D4AF37', bold: true, fontFace: 'Inter',
    });

    // Sections as bullet points
    if (slide.sections?.length > 0) {
      slide.sections.forEach((sec, i) => {
        pSlide.addText(sec.label, {
          x: 0.8, y: 1.5 + i * 0.6, w: 11, h: 0.5,
          fontSize: 14, color: '94A3B8', fontFace: 'Inter',
          bullet: { type: 'bullet', characterCode: '25B8' },
        });
      });
    }

    // Slide number
    pSlide.addText(String(slide.order + 1), {
      x: 12.5, y: 7, w: 0.8, h: 0.4,
      fontSize: 8, color: '334155', align: 'right',
    });
  }

  await pptx.writeFile({ fileName: `${title}.pptx` });
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
