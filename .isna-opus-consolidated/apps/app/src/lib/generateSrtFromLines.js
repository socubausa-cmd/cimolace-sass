/**
 * Génère un fichier SRT ou VTT depuis un tableau de segments traduits.
 * Les timestamps sont distribués équitablement sur la durée totale.
 */

/**
 * @param {number} totalMs
 * @returns {string} "HH:MM:SS,mmm"
 */
function msToSrtTime(totalMs) {
  const ms = Math.round(totalMs) % 1000;
  const s = Math.floor(totalMs / 1000) % 60;
  const m = Math.floor(totalMs / 60000) % 60;
  const h = Math.floor(totalMs / 3600000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * @param {number} totalMs
 * @returns {string} "HH:MM:SS.mmm"
 */
function msToVttTime(totalMs) {
  return msToSrtTime(totalMs).replace(',', '.');
}

/**
 * @param {{ text: string }[]} lines
 * @param {number} durationMinutes
 * @param {'srt' | 'vtt'} [format='srt']
 * @returns {string}
 */
export function generateSubtitleFile(lines, durationMinutes, format = 'srt') {
  const validLines = (Array.isArray(lines) ? lines : [])
    .map((l) => String(l?.text || '').trim())
    .filter(Boolean);

  if (validLines.length === 0) return format === 'vtt' ? 'WEBVTT\n' : '';

  const totalMs = Math.max(1, Math.round(Number(durationMinutes) || 10) * 60 * 1000);
  const segMs = totalMs / validLines.length;

  const toTime = format === 'vtt' ? msToVttTime : msToSrtTime;
  const sep = format === 'vtt' ? '.' : ',';
  void sep;

  const blocks = validLines.map((text, i) => {
    const start = toTime(i * segMs);
    const end = toTime((i + 1) * segMs - 1);
    if (format === 'vtt') {
      return `${start} --> ${end}\n${text}`;
    }
    return `${i + 1}\n${start} --> ${end}\n${text}`;
  });

  return format === 'vtt'
    ? `WEBVTT\n\n${blocks.join('\n\n')}\n`
    : `${blocks.join('\n\n')}\n`;
}

/**
 * Déclenche le téléchargement côté navigateur.
 * @param {{ text: string }[]} lines
 * @param {number} durationMinutes
 * @param {string} lang
 * @param {'srt' | 'vtt'} [format='srt']
 */
export function downloadSubtitleFile(lines, durationMinutes, lang, format = 'srt') {
  const content = generateSubtitleFile(lines, durationMinutes, format);
  const mime = format === 'vtt' ? 'text/vtt' : 'application/x-subrip';
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `liri-subtitles-${lang}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}
