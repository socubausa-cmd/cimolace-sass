import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';

gsap.registerPlugin(ScrollTrigger);

// ── Narration PRORASCIENCE & Ngowazulu : présentation en 4 temps (textes authentiques de la marque) ──
// Doctrine → École (ISNA) → Temple (Ngowazulu) → Fondateur (le Manikongo).
const WORLDS = [
  { title: 'PRORASCIENCE', l1: 'La science africaine totale.', l2: 'Elle unifie le visible et l’invisible.' },
  { title: 'ISNA', l1: 'L’École — comprendre avant d’agir.', l2: 'Comprendre, maîtriser, puis évoluer.' },
  { title: 'NGOWAZULU', l1: 'L’hôpital spirituel de la science africaine.', l2: 'Prorascience enseigne. Ngowazulu intervient.' },
  { title: 'LE MANIKONGO', l1: 'Restaurer · traduire · structurer · transmettre.', l2: 'Recevez les yeux pour voir et les oreilles pour comprendre.' },
];
const TOTAL = WORLDS.length - 1; // interpolation caméra sur les positions ci-dessous

const STYLE = `
  .horizon-root { position:fixed; inset:0; z-index:120; overflow-y:auto; overflow-x:hidden;
    background:radial-gradient(ellipse at 50% 0%, #15100a 0%, #06040a 60%, #030208 100%);
    color:#f4efe6; font-family:'Inter', system-ui, -apple-system, sans-serif; -webkit-font-smoothing:antialiased; }
  .horizon-root .hero-canvas { position:fixed; inset:0; width:100vw; height:100vh; z-index:0; pointer-events:none; }
  .horizon-root .hero-canvas canvas { position:absolute; inset:0; width:100% !important; height:100% !important; display:block; }
  .horizon-root .hero-content, .horizon-root .content-section { position:relative; z-index:2; height:100vh;
    display:flex; flex-direction:column; align-items:center; justify-content:flex-end; text-align:center; padding:0 6vw 16vh; }
  .horizon-root .hero-content::before, .horizon-root .content-section::before { content:''; position:absolute; left:0; right:0; bottom:0;
    height:66%; z-index:-1; pointer-events:none;
    background:linear-gradient(to top, rgba(6,4,10,0.82) 0%, rgba(6,4,10,0.5) 36%, rgba(6,4,10,0.18) 64%, transparent 100%); }
  .horizon-root .hero-title { font-family:'Fraunces','Source Serif 4',Georgia,serif; font-weight:600;
    letter-spacing:-0.02em; line-height:0.92; font-size:clamp(2rem, 9vw, 8.5rem); margin:0; color:#f6efe1;
    white-space:nowrap; max-width:100%; text-shadow:0 3px 30px rgba(0,0,0,0.92), 0 0 90px rgba(216,180,104,0.3); }
  .horizon-root .title-char { display:inline-block; will-change:transform,opacity; }
  .horizon-root .hero-subtitle { margin-top:1.6rem; display:flex; flex-direction:column; gap:.25rem; }
  .horizon-root .subtitle-line { font-size:clamp(.8rem,1.6vw,1.05rem); letter-spacing:.18em; text-transform:uppercase; color:#dccaa4; text-shadow:0 1px 16px rgba(0,0,0,0.95); }
  .horizon-root .side-menu { position:fixed; left:1.6rem; top:50%; transform:translateY(-50%); z-index:3;
    display:flex; flex-direction:column; align-items:center; gap:1.4rem; }
  .horizon-root .menu-icon { display:flex; flex-direction:column; gap:5px; }
  .horizon-root .menu-icon span { width:26px; height:2px; background:#d8b468; display:block; }
  .horizon-root .vertical-text { writing-mode:vertical-rl; text-orientation:mixed; letter-spacing:.4em;
    font-size:.7rem; color:#8c8472; text-transform:uppercase; }
  .horizon-root .scroll-progress { position:fixed; left:50%; bottom:2rem; transform:translateX(-50%); z-index:3;
    display:flex; align-items:center; gap:1rem; font-size:.62rem; letter-spacing:.3em; text-transform:uppercase; color:#8c8472; }
  .horizon-root .progress-track { width:180px; height:2px; background:rgba(255,255,255,.12); position:relative; overflow:hidden; }
  .horizon-root .progress-fill { position:absolute; left:0; top:0; height:100%; background:linear-gradient(90deg,#bf9a4f,#d8b468); }
  .horizon-root .section-counter { color:#d8b468; }
  .horizon-root .scroll-sections { position:relative; z-index:2; }
  .horizon-root .horizon-skip { position:fixed; right:1.6rem; top:1.4rem; z-index:3; font-size:.62rem; letter-spacing:.25em;
    text-transform:uppercase; color:#8c8472; text-decoration:none; border:1px solid rgba(255,255,255,.14);
    padding:.5rem .9rem; border-radius:999px; transition:.2s; }
  .horizon-root .horizon-skip:hover { color:#0d0b09; background:#d8b468; border-color:#d8b468; }
  @media (max-width:767px){ .horizon-root .side-menu{ display:none; } }
  @keyframes hzCharUp { from { opacity:0; transform:translateY(48px); } to { opacity:1; transform:none; } }
  @keyframes hzFadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:none; } }
  .horizon-root .hero-content .title-char { animation:hzCharUp .85s cubic-bezier(.2,.7,.2,1) both; animation-delay:calc(var(--i,0) * .045s + .15s); }
  .horizon-root .hero-content .hero-subtitle { animation:hzFadeUp 1s ease both; animation-delay:.9s; }
  .horizon-root .side-menu { animation:hzFadeUp 1s ease both; animation-delay:.2s; }
  .horizon-root .scroll-progress { animation:hzFadeUp 1s ease both; animation-delay:1.1s; }
  @media (prefers-reduced-motion: reduce){ .horizon-root .title-char, .horizon-root .hero-subtitle, .horizon-root .side-menu, .horizon-root .scroll-progress { animation:none !important; } }
`;

export const Component = ({ skipHref = '/maquette-b' }) => {
  const containerRef = useRef(null);
  const canvasMountRef = useRef(null);
  const titleRef = useRef(null);
  const subtitleRef = useRef(null);
  const scrollProgressRef = useRef(null);
  const menuRef = useRef(null);

  const smoothCameraPos = useRef({ x: 0, y: 30, z: 100 });

  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentSection, setCurrentSection] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // Fallback : pas de WebGL lourd si mobile ou mouvement réduit
  const [reduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    const rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return rm || window.innerWidth < 768;
  });

  const threeRefs = useRef({
    scene: null, camera: null, renderer: null, composer: null,
    stars: [], nebula: null, mountains: [], animationId: null, locations: [],
  });

  // Three.js
  useEffect(() => {
    if (reduced) { setIsReady(true); return undefined; }

    const initThree = () => {
      const { current: refs } = threeRefs;

      refs.scene = new THREE.Scene();
      refs.scene.fog = new THREE.FogExp2(0x06040a, 0.00025);

      refs.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
      refs.camera.position.z = 100;
      refs.camera.position.y = 20;

      refs.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      refs.renderer.setSize(window.innerWidth, window.innerHeight);
      refs.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      if (canvasMountRef.current) {
        canvasMountRef.current.innerHTML = '';
        canvasMountRef.current.appendChild(refs.renderer.domElement);
      }
      refs.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      refs.renderer.toneMappingExposure = 0.46;

      refs.composer = new EffectComposer(refs.renderer);
      refs.composer.addPass(new RenderPass(refs.scene, refs.camera));
      refs.composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.5, 0.9));

      createStarField();
      createNebula();
      createMountains();
      createAtmosphere();
      getLocation();
      animate();
      setIsReady(true);
    };

    const createStarField = () => {
      const { current: refs } = threeRefs;
      const starCount = 5000;
      for (let i = 0; i < 3; i++) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);
        for (let j = 0; j < starCount; j++) {
          const radius = 200 + Math.random() * 800;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(Math.random() * 2 - 1);
          positions[j * 3] = radius * Math.sin(phi) * Math.cos(theta);
          positions[j * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
          positions[j * 3 + 2] = radius * Math.cos(phi);
          const color = new THREE.Color();
          const c = Math.random();
          if (c < 0.7) color.setHSL(0.1, 0.15, 0.85 + Math.random() * 0.15); // blanc chaud
          else if (c < 0.9) color.setHSL(0.11, 0.55, 0.78); // or
          else color.setHSL(0.07, 0.6, 0.7); // ambre
          colors[j * 3] = color.r; colors[j * 3 + 1] = color.g; colors[j * 3 + 2] = color.b;
          sizes[j] = Math.random() * 2 + 0.5;
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        const material = new THREE.ShaderMaterial({
          uniforms: { time: { value: 0 }, depth: { value: i } },
          vertexShader: `
            attribute float size; attribute vec3 color; varying vec3 vColor;
            uniform float time; uniform float depth;
            void main(){ vColor=color; vec3 pos=position;
              float angle=time*0.05*(1.0-depth*0.3);
              mat2 rot=mat2(cos(angle),-sin(angle),sin(angle),cos(angle));
              pos.xy=rot*pos.xy;
              vec4 mvPosition=modelViewMatrix*vec4(pos,1.0);
              gl_PointSize=size*(300.0/-mvPosition.z);
              gl_Position=projectionMatrix*mvPosition; }`,
          fragmentShader: `
            varying vec3 vColor;
            void main(){ float dist=length(gl_PointCoord-vec2(0.5));
              if(dist>0.5) discard;
              float opacity=1.0-smoothstep(0.0,0.5,dist);
              gl_FragColor=vec4(vColor,opacity); }`,
          transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const stars = new THREE.Points(geometry, material);
        refs.scene.add(stars);
        refs.stars.push(stars);
      }
    };

    const createNebula = () => {
      const { current: refs } = threeRefs;
      const geometry = new THREE.PlaneGeometry(8000, 4000, 100, 100);
      const material = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          color1: { value: new THREE.Color(0xe8c87a) }, // or
          color2: { value: new THREE.Color(0x7a3b12) }, // ember
          opacity: { value: 0.2 },
        },
        vertexShader: `
          varying vec2 vUv; varying float vElevation; uniform float time;
          void main(){ vUv=uv; vec3 pos=position;
            float elevation=sin(pos.x*0.01+time)*cos(pos.y*0.01+time)*20.0;
            pos.z+=elevation; vElevation=elevation;
            gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.0); }`,
        fragmentShader: `
          uniform vec3 color1; uniform vec3 color2; uniform float opacity; uniform float time;
          varying vec2 vUv; varying float vElevation;
          void main(){ float m=sin(vUv.x*10.0+time)*cos(vUv.y*10.0+time);
            vec3 color=mix(color1,color2,m*0.5+0.5);
            float alpha=opacity*(1.0-length(vUv-0.5)*2.0);
            alpha*=1.0+vElevation*0.01;
            gl_FragColor=vec4(color,alpha); }`,
        transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
      });
      const nebula = new THREE.Mesh(geometry, material);
      nebula.position.z = -1050;
      refs.scene.add(nebula);
      refs.nebula = nebula;
    };

    const createMountains = () => {
      const { current: refs } = threeRefs;
      const layers = [
        { distance: -50, height: 60, color: 0x150f0a, opacity: 1 },
        { distance: -100, height: 80, color: 0x231811, opacity: 0.8 },
        { distance: -150, height: 100, color: 0x3a2614, opacity: 0.6 },
        { distance: -200, height: 120, color: 0x563a18, opacity: 0.4 },
      ];
      layers.forEach((layer, index) => {
        const points = [];
        const segments = 50;
        for (let i = 0; i <= segments; i++) {
          const x = (i / segments - 0.5) * 1000;
          const y = Math.sin(i * 0.1) * layer.height + Math.sin(i * 0.05) * layer.height * 0.5 + Math.random() * layer.height * 0.2 - 100;
          points.push(new THREE.Vector2(x, y));
        }
        points.push(new THREE.Vector2(5000, -300));
        points.push(new THREE.Vector2(-5000, -300));
        const shape = new THREE.Shape(points);
        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({ color: layer.color, transparent: true, opacity: layer.opacity, side: THREE.DoubleSide });
        const mountain = new THREE.Mesh(geometry, material);
        mountain.position.z = layer.distance;
        mountain.position.y = layer.distance;
        mountain.userData = { baseZ: layer.distance, index };
        refs.scene.add(mountain);
        refs.mountains.push(mountain);
      });
    };

    const createAtmosphere = () => {
      const { current: refs } = threeRefs;
      const geometry = new THREE.SphereGeometry(600, 32, 32);
      const material = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 } },
        vertexShader: `
          varying vec3 vNormal; varying vec3 vPosition;
          void main(){ vNormal=normalize(normalMatrix*normal); vPosition=position;
            gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `
          varying vec3 vNormal; varying vec3 vPosition; uniform float time;
          void main(){ float intensity=pow(0.7-dot(vNormal,vec3(0.0,0.0,1.0)),2.0);
            vec3 atmosphere=vec3(0.85,0.66,0.32)*intensity;
            float pulse=sin(time*2.0)*0.1+0.9; atmosphere*=pulse;
            gl_FragColor=vec4(atmosphere,intensity*0.25); }`,
        side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true,
      });
      refs.scene.add(new THREE.Mesh(geometry, material));
    };

    const animate = () => {
      const { current: refs } = threeRefs;
      refs.animationId = requestAnimationFrame(animate);
      const time = Date.now() * 0.001;
      refs.stars.forEach((s) => { if (s.material.uniforms) s.material.uniforms.time.value = time; });
      if (refs.nebula && refs.nebula.material.uniforms) refs.nebula.material.uniforms.time.value = time * 0.5;
      if (refs.camera && refs.targetCameraX !== undefined) {
        const k = 0.05;
        smoothCameraPos.current.x += (refs.targetCameraX - smoothCameraPos.current.x) * k;
        smoothCameraPos.current.y += (refs.targetCameraY - smoothCameraPos.current.y) * k;
        smoothCameraPos.current.z += (refs.targetCameraZ - smoothCameraPos.current.z) * k;
        refs.camera.position.x = smoothCameraPos.current.x + Math.sin(time * 0.1) * 2;
        refs.camera.position.y = smoothCameraPos.current.y + Math.cos(time * 0.15) * 1;
        refs.camera.position.z = smoothCameraPos.current.z;
        refs.camera.lookAt(0, 10, -600);
      }
      refs.mountains.forEach((m, i) => {
        const p = 1 + i * 0.5;
        m.position.x = Math.sin(time * 0.1) * 2 * p;
        m.position.y = 50 + Math.cos(time * 0.15) * 1 * p;
      });
      if (refs.composer) refs.composer.render();
    };

    const getLocation = () => {
      const { current: refs } = threeRefs;
      refs.locations = refs.mountains.map((m) => m.position.z);
    };

    initThree();

    const handleResize = () => {
      const { current: refs } = threeRefs;
      if (refs.camera && refs.renderer && refs.composer) {
        refs.camera.aspect = window.innerWidth / window.innerHeight;
        refs.camera.updateProjectionMatrix();
        refs.renderer.setSize(window.innerWidth, window.innerHeight);
        refs.composer.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      const { current: refs } = threeRefs;
      if (refs.animationId) cancelAnimationFrame(refs.animationId);
      window.removeEventListener('resize', handleResize);
      refs.stars.forEach((s) => { s.geometry.dispose(); s.material.dispose(); });
      refs.mountains.forEach((m) => { m.geometry.dispose(); m.material.dispose(); });
      if (refs.nebula) { refs.nebula.geometry.dispose(); refs.nebula.material.dispose(); }
      if (refs.renderer) {
        refs.renderer.dispose();
        if (refs.renderer.forceContextLoss) refs.renderer.forceContextLoss();
        const el = refs.renderer.domElement;
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }
      refs.scene = null; refs.camera = null; refs.renderer = null; refs.composer = null;
      refs.nebula = null; refs.stars = []; refs.mountains = []; refs.locations = [];
      delete refs.targetCameraX; delete refs.targetCameraY; delete refs.targetCameraZ;
    };
  }, [reduced]);

  // Intro GSAP (titre + sous-titre + indicateurs)
  // Animations d'entrée : gérées en CSS (cf. STYLE @keyframes) — déclaratives, robustes en StrictMode,
  // se terminent toujours dans l'état visible (le combo gsap.from + double-montage les laissait cachées).

  // Scroll auto-contenu (sur le conteneur, pas window — robuste dans le shell de l'app)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const handleScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      const progress = max > 0 ? Math.min(el.scrollTop / max, 1) : 0;
      setScrollProgress(progress);
      const newSection = Math.min(Math.floor(progress * TOTAL), TOTAL);
      setCurrentSection(newSection);
      if (reduced) return;
      const { current: refs } = threeRefs;
      if (!refs.camera) return;
      const totalProgress = progress * TOTAL;
      const sectionProgress = totalProgress % 1;
      const cameraPositions = [
        { x: 0, y: 30, z: 300 },
        { x: 0, y: 40, z: -50 },
        { x: 0, y: 48, z: -480 },
        { x: 0, y: 56, z: -880 },
      ];
      const cur = cameraPositions[newSection] || cameraPositions[0];
      const nxt = cameraPositions[newSection + 1] || cur;
      refs.targetCameraX = cur.x + (nxt.x - cur.x) * sectionProgress;
      refs.targetCameraY = cur.y + (nxt.y - cur.y) * sectionProgress;
      refs.targetCameraZ = cur.z + (nxt.z - cur.z) * sectionProgress;
      refs.mountains.forEach((m, i) => {
        const speed = 1 + i * 0.9;
        const targetZ = m.userData.baseZ + el.scrollTop * speed * 0.5;
        m.userData.targetZ = targetZ;
        m.position.z = progress > 0.7 ? 600000 : (refs.locations[i] ?? m.position.z);
      });
      if (refs.nebula && refs.mountains[3]) refs.nebula.position.z = refs.mountains[3].position.z;
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => el.removeEventListener('scroll', handleScroll);
  }, [reduced]);

  const splitTitle = (text) => text.split('').map((char, i) => (
    <span key={i} className="title-char" style={{ '--i': i }}>{char === ' ' ? ' ' : char}</span>
  ));

  return (
    <div ref={containerRef} className="horizon-root">
      <style>{STYLE}</style>
      {!reduced && <div ref={canvasMountRef} className="hero-canvas" />}

      <a className="horizon-skip" href={skipHref}>Entrer ↗</a>

      <div ref={menuRef} className="side-menu">
        <div className="menu-icon"><span /><span /><span /></div>
        <div className="vertical-text">PRORASCIENCE</div>
      </div>

      <div className="hero-content">
        <h1 ref={titleRef} className="hero-title">{splitTitle(WORLDS[0].title)}</h1>
        <div ref={subtitleRef} className="hero-subtitle">
          <p className="subtitle-line">{WORLDS[0].l1}</p>
          <p className="subtitle-line">{WORLDS[0].l2}</p>
        </div>
      </div>

      <div ref={scrollProgressRef} className="scroll-progress">
        <div className="scroll-text">Défiler</div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${scrollProgress * 100}%` }} />
        </div>
        <div className="section-counter">
          {String(currentSection).padStart(2, '0')} / {String(TOTAL).padStart(2, '0')}
        </div>
      </div>

      <div className="scroll-sections">
        {WORLDS.slice(1).map((w, i) => (
          <section key={i} className="content-section">
            <h1 className="hero-title">{w.title}</h1>
            <div className="hero-subtitle">
              <p className="subtitle-line">{w.l1}</p>
              <p className="subtitle-line">{w.l2}</p>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default Component;
