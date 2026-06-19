import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Center, Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { COLOR_HEX, type OrganColor } from './api';
import { BodyViewer, type OrganNode } from './BodyViewer';

const GREY = '#c9bdab';
const DRACO = '/draco/';

// Codes organes (cf. référentiel API) → fichier(s) GLB anatomiques (HRA, CC-BY).
// Plusieurs fichiers = un seul organe logique (reins L/R, intestin grêle+gros…).
const ORGAN_FILES: Record<string, string[]> = {
  brain: ['brain.glb'],
  heart: ['heart.glb'],
  lungs: ['lungs.glb'],
  liver: ['liver.glb'],
  pancreas: ['pancreas.glb'],
  gut: ['gut_small.glb', 'gut_large.glb'],
  kidneys: ['kidney_l.glb', 'kidney_r.glb'],
  immune: ['spleen.glb', 'thymus.glb'],
  reproductive: ['reproductive.glb'],
};
const ORGAN_ORDER = Object.keys(ORGAN_FILES);
// Organes sans mesh 3D dans le HRA → restent en vue 2D.
const ONLY_2D = ['thyroid', 'stomach', 'adrenals'];

// Orientation / cadrage du corps (ajustables après vérif visuelle).
const GROUP_ROT: [number, number, number] = [0, 0, 0];

type Sex = 'female' | 'male';
type Status = 'normal' | 'critical' | 'selected' | 'dim';

function webglOk(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}

function OrganModel({
  url, color, status, onSelect, onHover, dragRef,
}: {
  url: string;
  color: string;
  status: Status;
  onSelect: () => void;
  onHover: (h: boolean) => void;
  dragRef: React.MutableRefObject<{ x: number; y: number; moved: boolean }>;
}) {
  const { scene } = useGLTF(url, DRACO);
  // Clone (matériaux propres → on peut recolorer sans toucher le cache useGLTF).
  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o: any) => {
      if (o.isMesh) {
        o.material = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.04 });
        o.castShadow = false;
        o.receiveShadow = false;
      }
    });
    return c;
  }, [scene]);

  useEffect(() => {
    const col = new THREE.Color(color);
    const dim = status === 'dim';
    clone.traverse((o: any) => {
      if (o.isMesh && o.material) {
        o.material.color.copy(col);
        o.material.emissive.copy(col);
        o.material.emissiveIntensity = status === 'critical' ? 0.5 : status === 'selected' ? 0.32 : 0.04;
        o.material.transparent = dim;
        o.material.opacity = dim ? 0.16 : 1;
        o.material.depthWrite = !dim;
        o.material.needsUpdate = true;
      }
    });
  }, [clone, color, status]);

  return (
    <primitive
      object={clone}
      onClick={(e: any) => { e.stopPropagation(); if (!dragRef.current.moved) onSelect(); }}
      onPointerOver={(e: any) => { e.stopPropagation(); onHover(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { onHover(false); document.body.style.cursor = 'auto'; }}
    />
  );
}

function Skin({ url }: { url: string }) {
  const { scene } = useGLTF(url, DRACO);
  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o: any) => {
      if (o.isMesh) {
        o.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#e9dcc8'), transparent: true, opacity: 0.07,
          roughness: 1, metalness: 0, side: THREE.DoubleSide, depthWrite: false,
        });
        o.raycast = () => {}; // silhouette non cliquable
      }
    });
    return c;
  }, [scene]);
  return <primitive object={clone} />;
}

function Scene({
  sex, organs, selected, onSelect, setHovered, dragRef,
}: {
  sex: Sex;
  organs: OrganNode[];
  selected: string | null;
  onSelect: (code: string) => void;
  setHovered: (code: string | null) => void;
  dragRef: React.MutableRefObject<{ x: number; y: number; moved: boolean }>;
}) {
  const base = `/models/${sex}/`;
  const byCode = new Map(organs.map((o) => [o.code, o]));
  const colorOf = (code: string) => {
    const s = byCode.get(code)?.score;
    return s ? COLOR_HEX[s.color] : GREY;
  };
  const statusOf = (code: string): Status => {
    if (selected === code) return 'selected';
    if (selected && selected !== code) return 'dim';
    return byCode.get(code)?.score?.color === 'red' ? 'critical' : 'normal';
  };

  return (
    <Center key={sex}>
      <group rotation={GROUP_ROT}>
        {ORGAN_ORDER.map((code) =>
          ORGAN_FILES[code].map((f) => (
            <OrganModel
              key={code + f}
              url={base + f}
              color={colorOf(code)}
              status={statusOf(code)}
              onSelect={() => onSelect(code)}
              onHover={(h) => setHovered(h ? code : null)}
              dragRef={dragRef}
            />
          )),
        )}
        <Skin url={base + 'skin.glb'} />
      </group>
    </Center>
  );
}

export function BodyViewer3D({
  organs, selected, onSelect, sex: sexProp,
}: {
  organs: OrganNode[];
  selected: string | null;
  onSelect: (code: string) => void;
  sex?: Sex;
}) {
  const [sex, setSex] = useState<Sex>(sexProp || 'female');
  const [hovered, setHovered] = useState<string | null>(null);
  const dragRef = useRef({ x: 0, y: 0, moved: false });
  const controls = useRef<any>(null);

  useEffect(() => { if (sexProp) setSex(sexProp); }, [sexProp]);

  // Fallback : pas de WebGL → la vue SVG 2D (toujours dispo).
  if (typeof window !== 'undefined' && !webglOk()) {
    return <BodyViewer organs={organs} selected={selected} onSelect={onSelect} />;
  }

  const byCode = new Map(organs.map((o) => [o.code, o]));
  const hoveredOrgan = hovered ? byCode.get(hovered) : null;

  const dolly = (factor: number) => {
    const c = controls.current;
    if (!c) return;
    c.object.position.sub(c.target).multiplyScalar(factor).add(c.target);
    c.update();
  };

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 480, position: 'relative', borderRadius: 16, overflow: 'hidden', background: 'radial-gradient(circle at 50% 22%, #fffaf2, var(--zw-bg-subtle))' }}>
      {/* Barre haut : sexe + zoom */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 5, display: 'flex', gap: 4, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(6px)', borderRadius: 9, padding: 3, border: '1px solid var(--zw-border)' }}>
        {(['female', 'male'] as Sex[]).map((s) => (
          <button key={s} onClick={() => setSex(s)} style={{ padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: sex === s ? 'var(--brand-primary)' : 'transparent', color: sex === s ? '#fff' : 'var(--zw-text-muted)' }}>
            {s === 'female' ? 'Femme' : 'Homme'}
          </button>
        ))}
      </div>
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 5, display: 'flex', gap: 6 }}>
        <button onClick={() => dolly(0.82)} title="Zoom avant" style={zbtn}>+</button>
        <button onClick={() => dolly(1.22)} title="Zoom arrière" style={zbtn}>−</button>
        <button onClick={() => controls.current?.reset()} title="Réinitialiser" style={zbtn}>⟲</button>
      </div>

      {/* Étiquette organe survolé */}
      {hoveredOrgan && (
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 5, background: 'rgba(43,27,31,0.9)', color: '#fff', padding: '4px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          {hoveredOrgan.name_fr}{hoveredOrgan.score ? ` · ${hoveredOrgan.score.score}/100` : ' · non évalué'}
        </div>
      )}

      <Canvas
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 0.05, 2.5], fov: 42 }}
        onPointerDown={(e) => { dragRef.current = { x: e.clientX, y: e.clientY, moved: false }; }}
        onPointerMove={(e) => { const d = dragRef.current; if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) d.moved = true; }}
        style={{ touchAction: 'none' }}
      >
        <ambientLight intensity={0.55} />
        <hemisphereLight intensity={0.5} groundColor={new THREE.Color('#d8c8ad')} />
        <directionalLight position={[3, 5, 4]} intensity={1.15} />
        <directionalLight position={[-4, 2, -3]} intensity={0.4} />
        <Suspense fallback={<Html center style={{ color: 'var(--zw-text-faint)', fontSize: 13, whiteSpace: 'nowrap' }}>Chargement des organes…</Html>}>
          <Scene sex={sex} organs={organs} selected={selected} onSelect={(c) => { if (!dragRef.current.moved) onSelect(c); }} setHovered={setHovered} dragRef={dragRef} />
        </Suspense>
        <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping minDistance={0.7} maxDistance={6} />
      </Canvas>

      {/* Légende + note 2D */}
      <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', flexWrap: 'wrap', gap: '5px 14px', justifyContent: 'center', padding: '0 8px', fontSize: 11, color: 'var(--zw-text-muted)', pointerEvents: 'none' }}>
        {(['green', 'yellow', 'orange', 'red'] as OrganColor[]).map((c, i) => (
          <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: COLOR_HEX[c] }} />
            {['Optimal', 'À surveiller', 'Sub-optimal', 'Critique'][i]}
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: GREY }} />Non évalué</span>
      </div>
      {/* Attribution CC BY 4.0 (obligatoire) */}
      <div style={{ position: 'absolute', bottom: 3, right: 8, fontSize: 9, color: 'var(--zw-text-faint)', opacity: 0.75, pointerEvents: 'none' }} title="Modèles anatomiques : HuBMAP Human Reference Atlas — CC BY 4.0">
        Anatomie : HuBMAP HRA · CC BY 4.0
      </div>
    </div>
  );
}

const zbtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 8, border: '1px solid var(--zw-border)', background: '#fff',
  color: 'var(--zw-text-soft)', fontSize: 15, lineHeight: 1, cursor: 'pointer', display: 'inline-flex',
  alignItems: 'center', justifyContent: 'center', padding: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};

// Préchargement des GLB du corps courant (snappier au changement d'onglet).
ORGAN_ORDER.forEach((code) => ORGAN_FILES[code].forEach((f) => {
  useGLTF.preload(`/models/female/${f}`, DRACO);
}));
void ONLY_2D;
