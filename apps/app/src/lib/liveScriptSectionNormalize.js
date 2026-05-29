import { formatMasterAgentContent } from '@/lib/smartboardIAMapper';

/**
 * Normalise une ligne `live_script_sections` vers le format attendu par MasterScriptPanel / LiveRoomShell.
 */
export function normalizeLiveScriptSection(row) {
  if (!row || typeof row !== 'object') return row;
  const m = row.master_agent && typeof row.master_agent === 'object' ? row.master_agent : null;
  const baseContent = String(row.content || '').trim();
  const content = baseContent || (m ? formatMasterAgentContent(m) : '') || '';
  const script = String(m?.teacher_script || row.script || '').trim() || content;
  return {
    ...row,
    title: row.title || m?.slide_title || null,
    content,
    script,
    objective: m?.message_central || row.objective,
    description: m?.intention || row.description,
    retention: m?.student_understanding || row.retention,
    memorization_tip: m?.simple_version || row.memorization_tip,
    transition: m?.transition || row.transition,
    master_agent: m || row.master_agent,
  };
}
