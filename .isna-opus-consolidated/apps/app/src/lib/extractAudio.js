import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpegInstance = null;

async function getFFmpeg(onProgress) {
  if (!ffmpegInstance) {
    ffmpegInstance = new FFmpeg();
  }
  if (!ffmpegInstance.loaded) {
    ffmpegInstance.on('progress', ({ progress }) => onProgress?.(Math.round(progress * 100)));
    await ffmpegInstance.load({
      coreURL: '/ffmpeg-core.js',
      wasmURL: '/ffmpeg-core.wasm',
    });
  }
  return ffmpegInstance;
}

/**
 * Extracts mono 16kHz MP3 audio from a video/audio File.
 * Returns an audio Blob (audio/mpeg) ready for Groq Whisper.
 * At 32kbps: 1h video → ~14MB, well under the 25MB Groq limit.
 */
export async function extractAudioFromFile(file, onProgress) {
  const ff = await getFFmpeg((p) => onProgress?.(p));

  const ext = file.name.split('.').pop() || 'mp4';
  const inputName = `input.${ext}`;

  await ff.writeFile(inputName, await fetchFile(file));
  await ff.exec([
    '-i', inputName,
    '-vn',          // no video
    '-ar', '16000', // 16kHz sample rate (optimal for speech)
    '-ac', '1',     // mono
    '-b:a', '16k',  // 16kbps — speech quality fine for ASR, 3h → ~22MB
    'output.mp3',
  ]);

  const data = await ff.readFile('output.mp3');
  await ff.deleteFile(inputName).catch(() => {});
  await ff.deleteFile('output.mp3').catch(() => {});

  return new Blob([data.buffer], { type: 'audio/mpeg' });
}
