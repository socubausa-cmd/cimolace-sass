/**
 * SmartPencilController — stateful API for the Smart Pencil Engine.
 * Usage:
 *   const controller = new SmartPencilController();
 *   controller.startStroke();
 *   controller.appendPoint(x, y);
 *   const result = controller.endStroke();
 */
import type { DesignElement } from '@/engines/types';
import type { Point, RawStroke } from './index';
import {
  smoothStroke,
  simplifyStroke,
  recognizeShape,
  suggestShapeVariants,
  recognizedShapeToElement,
} from './index';
import type { RecognizedShape, ShapeVariant } from './index';

export type StrokeResult = {
  recognized: RecognizedShape;
  variants: ShapeVariant[];
  bestElement: DesignElement | null;
};

type StrokeListener = (result: StrokeResult) => void;

export class SmartPencilController {
  private currentStroke: Point[] = [];
  private isDrawing = false;
  private listeners: StrokeListener[] = [];
  private config: { smoothingIterations: number; simplifyTolerance: number; minPoints: number };

  constructor(config?: { smoothingIterations?: number; simplifyTolerance?: number; minPoints?: number }) {
    this.config = {
      smoothingIterations: config?.smoothingIterations ?? 2,
      simplifyTolerance: config?.simplifyTolerance ?? 3,
      minPoints: config?.minPoints ?? 3,
    };
  }

  /** Start a new stroke. */
  startStroke(): void {
    this.currentStroke = [];
    this.isDrawing = true;
  }

  /** Append a point to the current stroke. */
  appendPoint(x: number, y: number): void {
    if (!this.isDrawing) return;
    this.currentStroke.push({ x, y });
  }

  /** End the stroke, analyze it, and return the result. */
  endStroke(): StrokeResult | null {
    if (!this.isDrawing) return null;
    this.isDrawing = false;

    const rawPoints = this.currentStroke;
    if (rawPoints.length < this.config.minPoints) {
      this.currentStroke = [];
      return null;
    }

    // Pipeline: smooth → simplify → recognize → suggest
    const smoothed = smoothStroke(rawPoints, this.config.smoothingIterations);
    const simplified = simplifyStroke(smoothed, this.config.simplifyTolerance);
    const recognized = recognizeShape(simplified);
    const variants = suggestShapeVariants(recognized);
    const bestElement = recognizedShapeToElement(recognized);

    const result: StrokeResult = { recognized, variants, bestElement };

    // Notify listeners
    this.listeners.forEach((fn) => fn(result));
    this.currentStroke = [];

    return result;
  }

  /** Cancel the current stroke without processing. */
  cancelStroke(): void {
    this.currentStroke = [];
    this.isDrawing = false;
  }

  /** Get current raw points (for live rendering). */
  getCurrentPoints(): Point[] {
    return [...this.currentStroke];
  }

  /** Register a callback called when a stroke is completed. */
  onStrokeComplete(listener: StrokeListener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter((l) => l !== listener); };
  }

  /** Whether a stroke is currently being drawn. */
  get active(): boolean {
    return this.isDrawing;
  }

  /** Number of points in the current stroke. */
  get pointCount(): number {
    return this.currentStroke.length;
  }

  /** Recognize a set of points without starting/ending a stroke (one-shot). */
  recognizePoints(points: Point[]): StrokeResult {
    const smoothed = smoothStroke(points, this.config.smoothingIterations);
    const simplified = simplifyStroke(smoothed, this.config.simplifyTolerance);
    const recognized = recognizeShape(simplified);
    const variants = suggestShapeVariants(recognized);
    const bestElement = recognizedShapeToElement(recognized);
    return { recognized, variants, bestElement };
  }
}

/** Singleton for use across the app. */
export const smartPencil = new SmartPencilController();
