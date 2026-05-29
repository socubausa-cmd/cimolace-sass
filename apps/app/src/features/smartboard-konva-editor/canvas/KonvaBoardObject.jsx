import React, { useEffect, useRef, useState } from 'react';
import Konva from 'konva';
import {
  Text,
  Rect,
  Circle,
  Ellipse,
  Image,
  Group,
  Star,
  Line,
  RegularPolygon,
  Arrow,
} from 'react-konva';

/**
 * Un objet scène → nœud(s) Konva. `shapeProps` = draggable, on* events, ref.
 * Types supportés : text, rect, circle, triangle, starshape, line, diamond, image, icon, html
 */
export default function KonvaBoardObject({ obj, selected, shapeProps }) {
  const baseStyle = obj.style || {};
  const blend = baseStyle.globalCompositeOperation;
  const common = {
    id: obj.id,
    rotation: obj.rotation || 0,
    opacity: obj.visible === false ? 0.35 : (obj.opacity ?? 1),
    visible: obj.visible !== false,
    ...(typeof blend === 'string' && blend && blend !== 'source-over'
      ? { globalCompositeOperation: blend }
      : {}),
    ...shapeProps,
  };

  if (obj.locked) {
    common.draggable = false;
  }

  switch (obj.type) {
    case 'text': {
      const st = obj.style || {};
      const fw =
        st.fontWeight != null
          ? Number(st.fontWeight)
          : st.fontStyle === 'bold'
            ? 700
            : 400;
      return (
        <Text
          {...common}
          x={obj.x}
          y={obj.y}
          width={obj.width}
          height={obj.height}
          text={obj.content?.text ?? ''}
          fontFamily={st.fontFamily || 'Inter, system-ui, sans-serif'}
          fontSize={st.fontSize || 24}
          fontStyle={[
            st.fontStyle === 'italic' ? 'italic' : '',
            String(st.fontWeight || 400) === '700' || String(st.fontWeight || 400) === 'bold' ? 'bold' : '',
          ].filter(Boolean).join(' ') || 'normal'}
          fontVariant="normal"
          fill={st.fill || '#F7F2E8'}
          align={st.align || 'left'}
          lineHeight={st.lineHeight || 1.25}
          letterSpacing={typeof st.letterSpacing === 'number' ? st.letterSpacing : 0}
          fontWeight={String(fw)}
          opacity={typeof st.opacity === 'number' ? st.opacity : undefined}
          shadowColor={st.shadowColor}
          shadowBlur={st.shadowBlur || 0}
          shadowOffsetX={st.shadowOffsetX || 0}
          shadowOffsetY={st.shadowOffsetY || 0}
          shadowOpacity={typeof st.shadowOpacity === 'number' ? st.shadowOpacity : undefined}
          stroke={st.textStroke}
          strokeWidth={st.textStrokeWidth || 0}
          textDecoration={st.textDecoration || ''}
        />
      );
    }
    case 'rect': {
      const st = obj.style || {};
      return (
        <Rect
          {...common}
          x={obj.x}
          y={obj.y}
          width={obj.width}
          height={obj.height}
          fill={st.fill || 'rgba(212,175,55,0.15)'}
          stroke={st.stroke || undefined}
          strokeWidth={st.strokeWidth ?? 0}
          cornerRadius={st.cornerRadius || 0}
          dash={Array.isArray(st.dash) ? st.dash : undefined}
          opacity={typeof st.opacity === 'number' ? st.opacity : undefined}
          shadowColor={st.shadowColor}
          shadowBlur={st.shadowBlur || 0}
        />
      );
    }
    case 'circle': {
      const st = obj.style || {};
      const cx = obj.x + obj.width / 2;
      const cy = obj.y + obj.height / 2;
      const r = Math.min(obj.width, obj.height) / 2;
      return (
        <Circle
          {...common}
          x={cx}
          y={cy}
          radius={r}
          offsetX={0}
          offsetY={0}
          fill={st.fill || 'rgba(96,165,250,0.2)'}
          stroke={st.stroke || undefined}
          strokeWidth={st.strokeWidth ?? 0}
        />
      );
    }
    case 'triangle': {
      const st = obj.style || {};
      const cx = obj.x + obj.width / 2;
      const cy = obj.y + obj.height / 2;
      const r = Math.min(obj.width, obj.height) / 2;
      return (
        <RegularPolygon
          {...common}
          x={cx}
          y={cy}
          sides={3}
          radius={r}
          fill={st.fill || 'rgba(168,85,247,0.25)'}
          stroke={st.stroke || undefined}
          strokeWidth={st.strokeWidth ?? 0}
        />
      );
    }
    case 'starshape': {
      const st = obj.style || {};
      const cx = obj.x + obj.width / 2;
      const cy = obj.y + obj.height / 2;
      const outerR = Math.min(obj.width, obj.height) / 2;
      const innerR = outerR * 0.42;
      return (
        <Star
          {...common}
          x={cx}
          y={cy}
          numPoints={st.numPoints || 5}
          outerRadius={outerR}
          innerRadius={innerR}
          fill={st.fill || '#D4AF37'}
          stroke={st.stroke || undefined}
          strokeWidth={st.strokeWidth ?? 0}
        />
      );
    }
    case 'diamond': {
      const st = obj.style || {};
      const cx = obj.x + obj.width / 2;
      const cy = obj.y + obj.height / 2;
      const r = Math.min(obj.width, obj.height) / 2;
      return (
        <RegularPolygon
          {...common}
          x={cx}
          y={cy}
          sides={4}
          radius={r}
          rotation={45}
          fill={st.fill || 'rgba(20,184,166,0.25)'}
          stroke={st.stroke || undefined}
          strokeWidth={st.strokeWidth ?? 0}
        />
      );
    }
    case 'line': {
      const st = obj.style || {};
      const rawPts = obj.content?.points;
      const useCustom = Array.isArray(rawPts) && rawPts.length >= 4;
      const pts = useCustom ? rawPts : [0, 0, obj.width, 0];
      const lineY = useCustom ? obj.y : obj.y + obj.height / 2;
      return (
        <Line
          {...common}
          x={obj.x}
          y={lineY}
          points={pts}
          stroke={st.stroke ?? '#94a3b8'}
          strokeWidth={st.strokeWidth ?? 2}
          lineCap={st.lineCap || 'round'}
          lineJoin="round"
          dash={st.dash || undefined}
          opacity={typeof st.opacity === 'number' ? st.opacity : 1}
          hitStrokeWidth={typeof st.hitStrokeWidth === 'number' ? st.hitStrokeWidth : 14}
        />
      );
    }
    case 'arrow': {
      const st = obj.style || {};
      const fromContent = obj.content?.points;
      const useCustom = Array.isArray(fromContent) && fromContent.length >= 4;
      const pts = useCustom
        ? fromContent
        : st.doubleArrow
          ? [obj.width, 0, 0, 0]
          : [0, 0, obj.width, 0];
      const stroke = st.stroke ?? '#94a3b8';
      const ay = useCustom ? obj.y : obj.y + (obj.height || 40) / 2;
      return (
        <Arrow
          {...common}
          x={obj.x}
          y={ay}
          points={pts}
          stroke={stroke}
          fill={st.fill ?? stroke}
          strokeWidth={st.strokeWidth ?? 3}
          pointerLength={typeof st.pointerLength === 'number' ? st.pointerLength : 14}
          pointerWidth={typeof st.pointerWidth === 'number' ? st.pointerWidth : 10}
          pointerAtBeginning={st.doubleArrow || false}
          lineCap={st.lineCap || 'round'}
          lineJoin="round"
          dash={st.dash || undefined}
          opacity={typeof st.opacity === 'number' ? st.opacity : 1}
          hitStrokeWidth={typeof st.hitStrokeWidth === 'number' ? st.hitStrokeWidth : 14}
        />
      );
    }
    case 'ellipse': {
      const st = obj.style || {};
      const cx = obj.x + obj.width / 2;
      const cy = obj.y + obj.height / 2;
      const rx = obj.width / 2;
      const ry = obj.height / 2;
      return (
        <Ellipse
          {...common}
          x={cx}
          y={cy}
          radiusX={rx}
          radiusY={ry}
          offsetX={0}
          offsetY={0}
          fill={st.fill || 'rgba(139,92,246,0.2)'}
          stroke={st.stroke}
          strokeWidth={st.strokeWidth ?? 0}
          shadowColor={st.shadowColor}
          shadowBlur={st.shadowBlur || 0}
        />
      );
    }
    case 'table':
      return <KonvaBoardTable obj={obj} common={common} />;
    case 'image':
      return <KonvaBoardImage obj={obj} common={common} />;
    case 'icon': {
      const st = obj.style || {};
      const glyph = obj.content?.glyph || '★';
      const fontSize = st.fontSize || Math.min(obj.width, obj.height) * 0.75;
      return (
        <Text
          {...common}
          x={obj.x}
          y={obj.y}
          width={obj.width}
          height={obj.height}
          text={glyph}
          fontSize={fontSize}
          fontFamily="system-ui, sans-serif"
          align="center"
          verticalAlign="middle"
          fill={st.fill || '#D4AF37'}
        />
      );
    }
    case 'html': {
      const html = String(obj.content?.html ?? '').trim();
      const preview = html ? `${html.slice(0, 80)}${html.length > 80 ? '…' : ''}` : '—';
      return (
        <Group {...common} x={obj.x} y={obj.y}>
          <Rect
            width={obj.width}
            height={obj.height}
            fill="rgba(76,29,149,0.2)"
            stroke="rgba(167,139,250,0.65)"
            strokeWidth={1}
            cornerRadius={6}
          />
          <Text
            x={10}
            y={10}
            width={obj.width - 20}
            height={obj.height - 20}
            text={`HTML / animation\n${preview}`}
            fontFamily="ui-monospace, monospace"
            fontSize={11}
            fill="rgba(233,213,255,0.92)"
            lineHeight={1.35}
          />
        </Group>
      );
    }
    default:
      return null;
  }
}

function KonvaBoardTable({ obj, common }) {
  const st = obj.style || {};
  const data = obj.content?.data || [['A', 'B'], ['1', '2']];
  const rows = data.length;
  const cols = data[0]?.length || 1;
  const W = obj.width;
  const H = obj.height;
  const colW = W / cols;
  const rowH = H / rows;
  const fontSize = st.fontSize || 14;
  const headerRow = st.headerRow !== false;

  return (
    <Group {...common} x={obj.x} y={obj.y}>
      {/* Fond global */}
      <Rect width={W} height={H} fill={st.cellBg || '#0d1020'} stroke={st.stroke || 'rgba(212,175,55,0.35)'} strokeWidth={st.strokeWidth ?? 1} cornerRadius={4} />
      {/* Cellules */}
      {data.flatMap((row, ri) => {
        const isHeader = headerRow && ri === 0;
        return row.map((cell, ci) => {
          const x = ci * colW;
          const y = ri * rowH;
          return (
            <Group key={`${ri}-${ci}`}>
              <Rect
                x={x} y={y} width={colW} height={rowH}
                fill={isHeader ? (st.headerBg || '#1a1f35') : (ri % 2 === 0 ? st.cellBg || '#0d1020' : 'rgba(255,255,255,0.03)')}
                stroke={st.stroke || 'rgba(212,175,55,0.25)'}
                strokeWidth={st.strokeWidth ?? 1}
              />
              <Text
                x={x + 6} y={y + rowH / 2 - fontSize * 0.65}
                width={colW - 12}
                text={String(cell ?? '')}
                fontSize={fontSize}
                fontFamily={st.fontFamily || 'Inter, system-ui, sans-serif'}
                fontStyle={isHeader ? 'bold' : 'normal'}
                fill={isHeader ? (st.headerFill || '#f5dd8a') : (st.cellFill || '#e8e8e8')}
                ellipsis
                wrap="none"
              />
            </Group>
          );
        });
      })}
    </Group>
  );
}

function KonvaBoardImage({ obj, common }) {
  const [img, setImg] = useState(null);
  const imgRef = useRef(null);
  const st = obj.style || {};

  useEffect(() => {
    const src = obj.content?.src;
    if (!src) { setImg(null); return; }
    const im = new window.Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => setImg(im);
    im.onerror = () => setImg(null);
    im.src = src;
  }, [obj.content?.src]);

  // Applique les filtres Konva apres rendu (étalonnage type NLE + HSL teinte)
  useEffect(() => {
    const node = imgRef.current;
    if (!node || !img) return;
    const activeFilters = [];
    if (st.blurRadius > 0) activeFilters.push(Konva.Filters.Blur);
    if (st.brightness !== undefined && st.brightness !== 0) activeFilters.push(Konva.Filters.Brighten);
    if (st.contrast !== undefined && st.contrast !== 0) activeFilters.push(Konva.Filters.Contrast);
    const hslOn =
      (st.saturation !== undefined && st.saturation !== 0) ||
      (st.hue !== undefined && st.hue !== 0);
    if (hslOn) activeFilters.push(Konva.Filters.HSL);
    if (activeFilters.length > 0) {
      node.cache();
      node.filters(activeFilters);
      if (st.blurRadius > 0) node.blurRadius(st.blurRadius);
      if (st.brightness !== undefined) node.brightness(st.brightness);
      if (st.contrast !== undefined) node.contrast(st.contrast);
      if (hslOn) {
        if (typeof node.hue === 'function') node.hue(st.hue ?? 0);
        node.saturation(st.saturation ?? 0);
      }
    } else {
      node.clearCache();
      node.filters([]);
    }
    node.getLayer()?.batchDraw();
  }, [img, st.blurRadius, st.brightness, st.contrast, st.saturation, st.hue]);

  const crop = obj.content?.crop;
  const cropRect =
    crop &&
    typeof crop === 'object' &&
    Number(crop.width) > 0 &&
    Number(crop.height) > 0
      ? {
          x: Number(crop.x) || 0,
          y: Number(crop.y) || 0,
          width: Number(crop.width),
          height: Number(crop.height),
        }
      : undefined;

  if (!img) {
    return (
      <Rect
        {...common}
        x={obj.x}
        y={obj.y}
        width={obj.width}
        height={obj.height}
        fill="rgba(255,255,255,0.06)"
        stroke="rgba(212,175,55,0.35)"
        strokeWidth={1}
        dash={[6, 4]}
      />
    );
  }

  const mask = st.mask;
  const mx = Number(mask?.x) || 0;
  const my = Number(mask?.y) || 0;
  const mw = Number(mask?.width) || 0;
  const mh = Number(mask?.height) || 0;
  const hasMask = mw > 0 && mh > 0;

  const shadowed = {
    cornerRadius: st.cornerRadius || 0,
    shadowColor: st.shadowColor,
    shadowBlur: st.shadowBlur || 0,
    shadowOffsetX: st.shadowOffsetX || 0,
    shadowOffsetY: st.shadowOffsetY || 0,
  };

  if (hasMask) {
    return (
      <Group
        {...common}
        x={obj.x}
        y={obj.y}
        clipFunc={(ctx) => {
          ctx.rect(mx, my, mw, mh);
        }}
      >
        <Image
          ref={imgRef}
          x={0}
          y={0}
          width={obj.width}
          height={obj.height}
          image={img}
          crop={cropRect}
          listening={false}
          opacity={1}
          visible
          {...shadowed}
        />
      </Group>
    );
  }

  return (
    <Image
      ref={imgRef}
      {...common}
      x={obj.x}
      y={obj.y}
      width={obj.width}
      height={obj.height}
      image={img}
      crop={cropRect}
      cornerRadius={st.cornerRadius || 0}
      shadowColor={st.shadowColor}
      shadowBlur={st.shadowBlur || 0}
      shadowOffsetX={st.shadowOffsetX || 0}
      shadowOffsetY={st.shadowOffsetY || 0}
    />
  );
}
