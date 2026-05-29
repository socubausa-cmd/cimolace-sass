/**
 * Export PDF A4 portrait — une image par page (html2canvas + jsPDF).
 */

/**
 * @param {{
 *   pages: { bodyHtml: string }[],
 *   header: string,
 *   footer: string,
 *   formatFooter: (template: string, page: number, total: number) => string,
 *   documentStyle?: { fontFamily?: string, fontSize?: number, lineHeight?: number },
 *   fileName?: string,
 * }} opts
 */
export async function exportAdminDocumentPdf(opts) {
  const {
    pages,
    header,
    footer,
    formatFooter,
    documentStyle,
    fileName = 'document-administratif.pdf',
  } = opts;
  const ds = documentStyle && typeof documentStyle === 'object' ? documentStyle : {};
  const fontFamily = typeof ds.fontFamily === 'string' && ds.fontFamily.trim() ? ds.fontFamily.trim() : 'Georgia, serif';
  let fontSize = typeof ds.fontSize === 'number' ? ds.fontSize : 13;
  if (fontSize < 8) fontSize = 8;
  if (fontSize > 28) fontSize = 28;
  let lineHeight = typeof ds.lineHeight === 'number' ? ds.lineHeight : 1.45;
  if (lineHeight < 1) lineHeight = 1;
  if (lineHeight > 2.5) lineHeight = 2.5;
  if (!pages?.length) throw new Error('Aucune page à exporter.');

  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const total = pages.length;

  for (let i = 0; i < pages.length; i += 1) {
    if (i > 0) pdf.addPage();
    const footerText = formatFooter(footer, i + 1, total);
    const wrap = document.createElement('div');
    wrap.setAttribute('data-admin-pdf-export', '1');

    const pdfStyle = document.createElement('style');
    pdfStyle.textContent = `
      .admin-doc-pdf-body table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
      .admin-doc-pdf-body td, .admin-doc-pdf-body th { border: 1px solid #d1d5db; padding: 4px 8px; vertical-align: top; }
      .admin-doc-pdf-body th { background: #f9fafb; font-weight: 600; }
      .admin-doc-pdf-body img { max-width: 100%; height: auto; display: block; margin: 0.5em 0; }
      .admin-doc-pdf-body p.longia-text-animated { border-left: 4px solid rgba(180, 140, 50, 0.65); padding-left: 10px; margin: 0.6em 0; background: linear-gradient(90deg, rgba(212, 175, 55, 0.1), transparent); }
    `;

    wrap.style.cssText = [
      'position:fixed',
      'left:0',
      'top:0',
      'width:210mm',
      'min-height:297mm',
      'padding:18mm 20mm 22mm 20mm',
      'box-sizing:border-box',
      'background:#ffffff',
      'color:#111827',
      `font-family:${fontFamily}`,
      `font-size:${fontSize}pt`,
      `line-height:${lineHeight}`,
      'z-index:-1',
      'pointer-events:none',
    ].join(';');

    const headEl = document.createElement('div');
    headEl.style.cssText = 'border-bottom:1px solid #e5e7eb;padding-bottom:10px;margin-bottom:14px;font-size:10pt;white-space:pre-wrap;color:#374151;';
    headEl.textContent = header;

    const bodyEl = document.createElement('div');
    bodyEl.className = 'admin-doc-body admin-doc-pdf-body';
    bodyEl.style.cssText = 'min-height:180mm;word-break:break-word;';
    bodyEl.innerHTML = pages[i].bodyHtml || '<p></p>';

    const footEl = document.createElement('div');
    footEl.style.cssText = 'border-top:1px solid #e5e7eb;padding-top:10px;margin-top:14px;font-size:9pt;color:#6b7280;white-space:pre-wrap;';
    footEl.textContent = footerText;

    wrap.appendChild(pdfStyle);
    wrap.appendChild(headEl);
    wrap.appendChild(bodyEl);
    wrap.appendChild(footEl);

    document.body.appendChild(wrap);

    try {
      const canvas = await html2canvas(wrap, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(imgData, 'JPEG', 0, 0, pageW, pageH);
    } finally {
      wrap.remove();
    }
  }

  pdf.save(fileName);
}
