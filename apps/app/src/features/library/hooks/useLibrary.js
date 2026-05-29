/**
 * useLibrary — bridge hook between useLibraryStore and UI.
 * Handles full import pipeline + designer integration.
 */
import { useCallback, useState } from 'react';
import { useLibraryStore } from '@/stores';
import {
  analyzeImport,
  generatePreview,
  convertToLiriFormat,
  libraryItemToElement,
  extractTemplateElements,
  applyLutToElement,
} from '@/engines/library-engine';
import { readFileAsDataUrl } from '@/engines/asset-engine';

export function useLibrary() {
  const store = useLibraryStore();
  const [importJob, setImportJob] = useState(null);

  // ── Import pipeline ─────────────────────────────────────────────────────────

  const startImport = useCallback(async (file, options = {}) => {
    const jobId = `job-${Date.now()}`;
    setImportJob({ id: jobId, file, step: 'analyzing', analysis: null, preview: null, progress: 10 });

    try {
      // Step 1: Analyze
      setImportJob((j) => ({ ...j, step: 'analyzing', progress: 20 }));
      const analysis = await analyzeImport(file);

      // Step 2: Generate preview
      setImportJob((j) => ({ ...j, step: 'previewing', analysis, progress: 50 }));
      const preview = await generatePreview(file, analysis.detectedCategory);

      // Step 3: Convert if needed
      setImportJob((j) => ({ ...j, step: 'converting', preview, progress: 70 }));
      const asset = analysis.needsConversion
        ? await convertToLiriFormat(file, analysis)
        : await readFileAsDataUrl(file);

      // Step 4: Save
      setImportJob((j) => ({ ...j, step: 'saving', progress: 90 }));
      const newItem = store.addItem({
        title: options.title || file.name.replace(/\.[^.]+$/, ''),
        category: analysis.detectedCategory,
        tags: options.tags ?? analysis.suggestedTags,
        theme: options.theme ?? analysis.suggestedTheme,
        preview,
        asset,
        compatibility: analysis.compatibility,
        usable_in: getUsableIn(analysis.detectedCategory),
        source: 'personal',
        fileType: analysis.detectedFileType,
        fileSize: analysis.fileSize,
        width: analysis.width,
        height: analysis.height,
      });

      setImportJob((j) => ({ ...j, step: 'done', progress: 100 }));
      store.closeImportModal();
      return { ok: true, item: newItem };
    } catch (e) {
      setImportJob((j) => ({ ...j, step: 'error', error: e.message ?? 'Erreur import', progress: 0 }));
      return { ok: false, error: e.message };
    }
  }, [store]);

  const cancelImport = useCallback(() => {
    setImportJob(null);
    store.closeImportModal();
  }, [store]);

  // ── Use in designer ─────────────────────────────────────────────────────────

  const useItemInDesigner = useCallback((item, { addElement, addElements, updateElement, selectedIds }) => {
    switch (item.category) {
      case 'image':
      case 'vector': {
        const el = libraryItemToElement(item);
        if (el) {
          addElement(el);
          store.incrementDownloads(item.id);
        }
        break;
      }
      case 'template': {
        const elements = extractTemplateElements(item);
        if (elements.length > 0) {
          addElements(elements);
          store.incrementDownloads(item.id);
        }
        break;
      }
      case 'lut': {
        // Apply to all selected elements or all image elements
        if (!updateElement || !selectedIds?.length) break;
        for (const id of selectedIds) {
          // This requires getting the element — pass element directly in real integration
          console.log('[useLibrary] Apply LUT to element', id, 'with LUT', item.id);
        }
        store.incrementDownloads(item.id);
        break;
      }
      case 'project': {
        // Load project data — handled at page level
        console.log('[useLibrary] Load project', item.id);
        break;
      }
    }
  }, [store]);

  // ── Derived state ───────────────────────────────────────────────────────────

  const filteredItems = store.getFilteredItems();
  const stats = {
    total: filteredItems.length,
    personal: store.library.personal.length,
    community: store.library.community.length,
    byCategory: {
      image: filteredItems.filter((i) => i.category === 'image').length,
      vector: filteredItems.filter((i) => i.category === 'vector').length,
      lut: filteredItems.filter((i) => i.category === 'lut').length,
      template: filteredItems.filter((i) => i.category === 'template').length,
      project: filteredItems.filter((i) => i.category === 'project').length,
    },
  };

  return {
    ...store,
    filteredItems,
    stats,
    importJob,
    startImport,
    cancelImport,
    useItemInDesigner,
  };
}

function getUsableIn(category) {
  switch (category) {
    case 'image': return ['designer', 'builder'];
    case 'vector': return ['designer', 'builder'];
    case 'lut': return ['designer'];
    case 'template': return ['designer', 'builder'];
    case 'project': return ['designer', 'builder', 'live', 'export'];
    default: return ['designer'];
  }
}
