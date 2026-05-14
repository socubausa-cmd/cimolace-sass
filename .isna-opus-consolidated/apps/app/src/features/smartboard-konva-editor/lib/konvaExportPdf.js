/**
 * Export PDF à partir de captures PNG (Konva) — parité avec Polotno `saveAsPDF`.
 */
import { jsPDF } from 'jspdf';

/**
 * @param {object} pdf
 * @param {string} dataUrl
 * @param {number} boxW
 * @param {number} boxH
 * @param {number} boxX
 * @param {number} boxY
 * @returns {Promise<void>}
 */
function addImageFitBox(pdf, dataUrl, boxW, boxH, boxX, boxY) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        if (!iw || !ih) {
          reject(new Error('Image invalide'));
          return;
        }
        const ratio = Math.min(boxW / iw, boxH / ih);
        const w = iw * ratio;
        const h = ih * ratio;
        const x = boxX + (boxW - w) / 2;
        const y = boxY + (boxH - h) / 2;
        pdf.addImage(dataUrl, 'PNG', x, y, w, h);
        resolve();
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('Chargement image'));
    img.src = dataUrl;
  });
}

const PDF_HEADER_PT = 26;

/**
 * Une page PDF A4 paysage par image (scène Konva).
 * @param {string[]} pngDataUrls
 * @param {string} fileName
 * @param {{ pageLabels?: string[] } | undefined} [options]
 */
export async function downloadPdfFromPngDataUrls(pngDataUrls, fileName, options) {
  if (!pngDataUrls?.length) {
    throw new Error('Aucune image à exporter.');
  }
  const labels = options?.pageLabels;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginX = 36;
  for (let i = 0; i < pngDataUrls.length; i += 1) {
    if (i > 0) pdf.addPage();
    const label = labels?.[i];
    let imgTop = 0;
    let imgH = pageH;
    if (label) {
      pdf.setFontSize(9);
      pdf.setTextColor(55, 55, 62);
      pdf.text(String(label).slice(0, 140), marginX, 20);
      imgTop = PDF_HEADER_PT;
      imgH = pageH - PDF_HEADER_PT;
    }
    await addImageFitBox(pdf, pngDataUrls[i], pageW, imgH, 0, imgTop);
  }
  pdf.save(fileName);
}
