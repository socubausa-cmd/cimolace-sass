import React from 'react';
import { TC } from '@/features/live/host/liveSmartboardLegacySlides';

export const LiveRadialMindmap = ({
  activeEtapes,
  step,
  stepCount,
  isGuestUi,
  gotoStep,
}) => {
  const cx = 150;
  const cy = 110;
  const r = 85;
  const lines = (activeEtapes || []).map((e, i) => {
    const angle = (i / stepCount) * Math.PI * 2 - Math.PI / 2;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    const c = TC[e.type] || '#888';
    const active = i === step;
    return { i, e, px, py, c, active };
  });
  return (
    <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', alignItems: 'stretch' }}>
      <svg
        id="mm-radial"
        style={{ width: '100%', height: '100%', minHeight: 'min(340px, 48vh)' }}
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 300 220"
      >
        <circle cx={cx} cy={cy} r="30" fill={`${TC.conclusion}18`} stroke={TC.conclusion} strokeWidth="1" />
        <text x={cx} y={cy - 4} textAnchor="middle" fill={TC.conclusion} fontSize="7" fontWeight="700">
          D+A=C
        </text>
        <text x={cx} y={cy + 9} textAnchor="middle" fill="rgba(255,255,255,.4)" fontSize="5.5">
          COURS
        </text>
        {lines.map(({ i, e, px, py, c, active }) => (
          <g key={i}>
            <line
              x1={cx}
              y1={cy}
              x2={px}
              y2={py}
              stroke={c}
              strokeWidth={active ? 1.5 : 0.5}
              strokeDasharray={active ? undefined : '3 2'}
              opacity={active ? 0.8 : 0.4}
            />
            <g
              style={{ cursor: isGuestUi ? 'default' : 'pointer' }}
              onClick={isGuestUi ? undefined : () => gotoStep(i)}
            >
              <circle
                cx={px}
                cy={py}
                r={active ? 15 : 12}
                fill={active ? `${c}33` : 'rgba(0,0,0,.4)'}
                stroke={c}
                strokeWidth={active ? 2 : 1}
              />
              <text x={px} y={py - 2} textAnchor="middle" fill={c} fontSize="7" fontWeight="700">
                {e.n}
              </text>
              <text
                x={px}
                y={py + 8}
                textAnchor="middle"
                fill={`rgba(255,255,255,${active ? 0.9 : 0.45})`}
                fontSize="5.5"
              >
                {(e.court || '').substring(0, 10)}
              </text>
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
};

export default LiveRadialMindmap;
