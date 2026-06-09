import { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { COLOR_HEX, type OrganColor } from './api';

// Tiny inline hook — viewport width tracker for responsive switches.
function useViewportWidth(): number {
  const [w, setW] = useState<number>(() => (typeof window === 'undefined' ? 1024 : window.innerWidth));
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return w;
}

export type OrganNode = {
  code: string;
  name_fr: string;
  position: { x: number; y: number; z: number } | null;
  score: { score: number; color: OrganColor } | null;
};

const GREY = '#cbd5e1';

function OrganMesh({
  organ,
  selected,
  onSelect,
}: {
  organ: OrganNode;
  selected: boolean;
  onSelect: (code: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const p = organ.position ?? { x: 0, y: 0, z: 0 };
  const color = organ.score ? COLOR_HEX[organ.score.color] : GREY;
  const critical = organ.score?.color === 'red';
  const r = selected ? 0.27 : hover ? 0.25 : 0.22;

  return (
    <group position={[p.x, p.y, p.z]}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onSelect(organ.code);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
      >
        <sphereGeometry args={[r, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={critical ? 0.6 : hover || selected ? 0.3 : 0.12}
          roughness={0.45}
          metalness={0.1}
        />
      </mesh>
      {(hover || selected) && (
        <Html distanceFactor={8} position={[0, r + 0.18, 0]} center>
          <div
            style={{
              background: 'rgba(15,23,42,0.92)',
              color: '#fff',
              padding: '4px 9px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {organ.name_fr}
            {organ.score ? ` · ${organ.score.score}/100` : ' · —'}
          </div>
        </Html>
      )}
    </group>
  );
}

export function BodyViewer({
  organs,
  selected,
  onSelect,
}: {
  organs: OrganNode[];
  selected: string | null;
  onSelect: (code: string) => void;
}) {
  const vw = useViewportWidth();
  const isMobile = vw <= 768;
  const wrapRef = useRef<HTMLDivElement>(null);

  // Liste compacte des organes scorés, affichée SOUS le canvas en mobile.
  const scored = organs.filter((o) => o.score).sort((a, b) => (a.score!.score - b.score!.score));

  return (
    <div
      ref={wrapRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        minHeight: isMobile ? 360 : 460,
      }}
    >
      <div
        style={{
          width: '100%',
          height: isMobile ? 'clamp(280px, 50vh, 460px)' : '100%',
          minHeight: isMobile ? 280 : 460,
          flex: isMobile ? '0 0 auto' : '1 1 auto',
          background: 'radial-gradient(circle at 50% 30%, #0f172a, #020617)',
          borderRadius: isMobile ? '16px 16px 0 0' : 16,
          touchAction: 'pan-y',
        }}
      >
        <Canvas camera={{ position: [0, 1.2, 6.2], fov: isMobile ? 48 : 42 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 6, 4]} intensity={1.1} />
          <directionalLight position={[-4, 2, -3]} intensity={0.4} color="#93c5fd" />

          {/* Silhouette corporelle translucide */}
          <mesh position={[0, 0.9, -0.05]}>
            <capsuleGeometry args={[0.95, 3.1, 8, 24]} />
            <meshStandardMaterial color="#38bdf8" transparent opacity={0.06} roughness={1} />
          </mesh>
          {/* Tête */}
          <mesh position={[0, 3.25, 0]}>
            <sphereGeometry args={[0.55, 24, 24]} />
            <meshStandardMaterial color="#38bdf8" transparent opacity={0.06} roughness={1} />
          </mesh>

          {organs.map((o) => (
            <OrganMesh key={o.code} organ={o} selected={selected === o.code} onSelect={onSelect} />
          ))}

          <OrbitControls
            enablePan={false}
            minDistance={3.5}
            maxDistance={9}
            target={[0, 0.9, 0]}
            autoRotate={!selected}
            autoRotateSpeed={0.6}
          />
        </Canvas>
      </div>

      {/* Mobile-only: liste organes sous le canvas */}
      {isMobile && scored.length > 0 && (
        <div style={{ padding: 12, background: '#fff', borderRadius: '0 0 16px 16px', borderTop: '1px solid #e8eaf0' }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
            Organes scorés ({scored.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 220, overflowY: 'auto' }}>
            {scored.map((o) => (
              <button
                key={o.code}
                onClick={() => onSelect(o.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  background: selected === o.code ? '#eef2ff' : '#f8fafc',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: COLOR_HEX[o.score!.color],
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{o.name_fr}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: COLOR_HEX[o.score!.color] }}>{o.score!.score}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
