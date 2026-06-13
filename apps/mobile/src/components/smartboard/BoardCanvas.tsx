/**
 * Canevas Skia natif du tableau. Rend les objets de la scène active et capte
 * les gestes de dessin via PanResponder (compatible Expo build, sans worklet).
 *
 * Coordonnées : on travaille en repère « modèle » 1037×750 puis on met à
 * l'échelle pour remplir la largeur disponible (le payload reste portable web).
 */
import { Canvas, Circle, Fill, Group, Path, Rect, Skia, Text as SkText, matchFont } from '@shopify/react-native-skia';
import { useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { LiriColors as C } from '@/constants/liri-theme';

import { SB_CANVAS_H, SB_CANVAS_W, strokePoints } from './model';
import type { SbKonvaObjectBase } from './types';
import type { Tool } from './Toolbar';

export interface DrawPoint {
  x: number;
  y: number;
}

interface Props {
  objects: SbKonvaObjectBase[];
  background: string;
  tool: Tool;
  penColor: string;
  penWidth: number;
  /** Tracé en cours (points en repère modèle), null si rien. */
  livePoints: DrawPoint[] | null;
  /** Rectangle/cercle en cours { x, y, w, h } en repère modèle. */
  liveShape: { x: number; y: number; w: number; h: number } | null;
  onDrawStart: (p: DrawPoint) => void;
  onDrawMove: (p: DrawPoint) => void;
  onDrawEnd: () => void;
  /** Tap simple pour l'outil texte. */
  onTap: (p: DrawPoint) => void;
}

const font = matchFont({ fontFamily: 'sans-serif', fontSize: 26, fontWeight: '600' });

/** Construit un SkPath à partir d'une polyligne (lissage minimal). */
function pointsToPath(points: DrawPoint[], scale: number) {
  const path = Skia.Path.Make();
  if (points.length === 0) return path;
  path.moveTo(points[0].x * scale, points[0].y * scale);
  for (let i = 1; i < points.length; i += 1) {
    path.lineTo(points[i].x * scale, points[i].y * scale);
  }
  return path;
}

export function BoardCanvas(props: Props) {
  const {
    objects,
    background,
    tool,
    penColor,
    penWidth,
    livePoints,
    liveShape,
    onDrawStart,
    onDrawMove,
    onDrawEnd,
    onTap,
  } = props;

  const sizeRef = useRef({ w: SB_CANVAS_W, h: SB_CANVAS_H });
  const scaleRef = useRef(1);
  const movedRef = useRef(false);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    sizeRef.current = { w: width, h: height };
    scaleRef.current = width / SB_CANVAS_W;
  };

  /** Écran → repère modèle. */
  const toModel = (lx: number, ly: number): DrawPoint => {
    const s = scaleRef.current || 1;
    return { x: lx / s, y: ly / s };
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          movedRef.current = false;
          const { locationX, locationY } = e.nativeEvent;
          onDrawStart(toModel(locationX, locationY));
        },
        onPanResponderMove: (e) => {
          movedRef.current = true;
          const { locationX, locationY } = e.nativeEvent;
          onDrawMove(toModel(locationX, locationY));
        },
        onPanResponderRelease: (e) => {
          if (tool === 'text' && !movedRef.current) {
            const { locationX, locationY } = e.nativeEvent;
            onTap(toModel(locationX, locationY));
          } else {
            onDrawEnd();
          }
        },
        onPanResponderTerminate: () => onDrawEnd(),
      }),
    // toModel/callbacks capturent les refs et props stables via fermeture ; recréation au changement d'outil
    [tool, onDrawStart, onDrawMove, onDrawEnd, onTap],
  );

  const scale = scaleRef.current || 1;
  const canvasH = sizeRef.current.h || (SB_CANVAS_H * scale);

  return (
    <View
      style={styles.wrap}
      onLayout={onLayout}
      {...responder.panHandlers}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <Fill color={background && background !== 'transparent' ? background : C.panel} />

        {objects.map((o) => (
          <ObjectNode key={o.id} obj={o} scale={scale} />
        ))}

        {/* Tracé libre en cours */}
        {livePoints && livePoints.length > 1 ? (
          <Path
            path={pointsToPath(livePoints, scale)}
            style="stroke"
            color={tool === 'eraser' ? (background !== 'transparent' ? background : C.panel) : penColor}
            strokeWidth={(tool === 'eraser' ? penWidth * 2.4 : penWidth) * scale}
            strokeCap="round"
            strokeJoin="round"
          />
        ) : null}

        {/* Forme rect/cercle en cours */}
        {liveShape && tool === 'rect' ? (
          <Rect
            x={liveShape.x * scale}
            y={liveShape.y * scale}
            width={liveShape.w * scale}
            height={liveShape.h * scale}
            style="stroke"
            color={penColor}
            strokeWidth={penWidth * scale}
          />
        ) : null}
        {liveShape && tool === 'circle' ? (
          <Circle
            cx={(liveShape.x + liveShape.w / 2) * scale}
            cy={(liveShape.y + liveShape.h / 2) * scale}
            r={(Math.max(Math.abs(liveShape.w), Math.abs(liveShape.h)) / 2) * scale}
            style="stroke"
            color={penColor}
            strokeWidth={penWidth * scale}
          />
        ) : null}
      </Canvas>
      {/* Bordure de cadrage pour ancrer visuellement le plateau */}
      <View pointerEvents="none" style={[styles.frame, { height: canvasH }]} />
    </View>
  );
}

/** Rendu d'un objet persistant (stylo/gomme/rect/cercle/texte). */
function ObjectNode({ obj, scale }: { obj: SbKonvaObjectBase; scale: number }) {
  const style = obj.style as {
    stroke?: string;
    strokeWidth?: number;
    fill?: string;
    fontSize?: number;
  };

  if (obj.type === 'line') {
    const pts = strokePoints(obj);
    if (pts.length < 2) return null;
    return (
      <Path
        path={pointsToPath(pts, scale)}
        style="stroke"
        color={style.stroke ?? C.ink}
        strokeWidth={(style.strokeWidth ?? 4) * scale}
        strokeCap="round"
        strokeJoin="round"
      />
    );
  }

  if (obj.type === 'rect') {
    return (
      <Group>
        {style.fill && style.fill !== 'transparent' ? (
          <Rect
            x={obj.x * scale}
            y={obj.y * scale}
            width={obj.width * scale}
            height={obj.height * scale}
            color={style.fill}
          />
        ) : null}
        <Rect
          x={obj.x * scale}
          y={obj.y * scale}
          width={obj.width * scale}
          height={obj.height * scale}
          style="stroke"
          color={style.stroke ?? C.ink}
          strokeWidth={(style.strokeWidth ?? 3) * scale}
        />
      </Group>
    );
  }

  if (obj.type === 'circle' || obj.type === 'ellipse') {
    const cx = (obj.x + obj.width / 2) * scale;
    const cy = (obj.y + obj.height / 2) * scale;
    const r = (Math.max(obj.width, obj.height) / 2) * scale;
    return (
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        style="stroke"
        color={style.stroke ?? C.ink}
        strokeWidth={(style.strokeWidth ?? 3) * scale}
      />
    );
  }

  if (obj.type === 'text') {
    const text = String((obj.content as { text?: unknown }).text ?? '');
    if (!text || !font) return null;
    return (
      <SkText
        x={obj.x * scale}
        y={(obj.y + (style.fontSize ?? 26)) * scale}
        text={text}
        font={font}
        color={style.fill ?? C.ink}
      />
    );
  }

  return null;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden' },
  frame: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    borderWidth: 1,
    borderColor: C.line,
  },
});
