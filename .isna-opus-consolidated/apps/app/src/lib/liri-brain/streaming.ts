/**
 * Utilitaires streaming SSE — encapsulation LIRI Brain.
 */

import { parseOpenAiSseDataLine } from './openai';
import type { LiriStructuredOutput } from './types';

export interface BrainStreamEvent {
  type: 'token' | 'done' | 'error';
  text?: string;
  structured?: LiriStructuredOutput;
  message?: string;
}

/** Encode un événement en ligne SSE standard. */
export function encodeSseLine(obj: BrainStreamEvent): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

/**
 * Transforme le flux SSE OpenAI en flux d’événements `BrainStreamEvent` (token).
 * `sink.fullText` agrège le texte assistant pour l’événement `done` final.
 */
export function transformOpenAiSseToBrainTokens(
  rawBody: ReadableStream<Uint8Array>,
  sink?: { fullText: string },
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  let buffer = '';

  return new ReadableStream({
    async start(controller) {
      const reader = rawBody.getReader();
      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const delta = parseOpenAiSseDataLine(line);
            if (delta) {
              if (sink) sink.fullText += delta;
              controller.enqueue(new TextEncoder().encode(encodeSseLine({ type: 'token', text: delta })));
            }
          }
        }
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });
}

export function encodeDone(structured: LiriStructuredOutput): Uint8Array {
  return new TextEncoder().encode(encodeSseLine({ type: 'done', structured }));
}

export function encodeError(message: string): Uint8Array {
  return new TextEncoder().encode(encodeSseLine({ type: 'error', message }));
}

/** Réinjecte les chunks puis un événement `done` en fin de flux. */
export function appendDoneEvent(
  tokenStream: ReadableStream<Uint8Array>,
  buildStructured: () => LiriStructuredOutput,
): ReadableStream<Uint8Array> {
  return tokenStream.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk);
      },
      flush(controller) {
        controller.enqueue(encodeDone(buildStructured()));
      },
    }),
  );
}
