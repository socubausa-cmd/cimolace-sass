/**
 * Extraction de texte depuis PDF (pdfjs-dist) ou fichier texte (.txt, .md, etc.).
 * Même configuration worker que KnowledgeBaseManager.
 */
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function extractTextFromFile(file) {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  let text = '';

  if (ext === 'pdf') {
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const ct = await page.getTextContent();
      pages.push(
        ct.items.map((item) => ('str' in item ? item.str : '')).join(' '),
      );
    }
    text = pages.join('\n\n');
  } else {
    text = await file.text();
  }

  return text.replace(/\r\n/g, '\n').replace(/[ \t]{3,}/g, '  ').trim();
}
