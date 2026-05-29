import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useTransform, useSpring, useMotionValue } from "framer-motion";

const IMG_WIDTH  = 60;
const IMG_HEIGHT = 85;

function FlipCard({ src, index, target }) {
  return (
    <motion.div
      animate={{ x: target.x, y: target.y, rotate: target.rotation, scale: target.scale, opacity: target.opacity }}
      transition={{ type: "spring", stiffness: 40, damping: 15 }}
      style={{ position: "absolute", width: IMG_WIDTH, height: IMG_HEIGHT, transformStyle: "preserve-3d", perspective: "1000px" }}
      className="cursor-pointer group"
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
        whileHover={{ rotateY: 180 }}
      >
        {/* Front */}
        <div className="absolute inset-0 h-full w-full overflow-hidden rounded-xl shadow-lg bg-gray-800" style={{ backfaceVisibility: "hidden" }}>
          <img src={src} alt={`cimolace-${index}`} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-transparent" />
        </div>
        {/* Back */}
        <div
          className="absolute inset-0 h-full w-full overflow-hidden rounded-xl shadow-lg flex flex-col items-center justify-center p-2 border border-violet-500/40"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "linear-gradient(135deg, #1a0a2e, #0a0a1e)" }}
        >
          <div className="text-center">
            <p className="text-[7px] font-bold text-violet-400 uppercase tracking-widest mb-1">CIMOLACE</p>
            <p className="text-[9px] font-medium text-white leading-tight">Découvrir</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

const TOTAL_IMAGES = 20;
const MAX_SCROLL   = 3000;

const IMAGES = [
  "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=300&q=80",
  "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=300&q=80",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=300&q=80",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=300&q=80",
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=300&q=80",
  "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=300&q=80",
  "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=300&q=80",
  "https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=300&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&q=80",
  "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=300&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&q=80",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&q=80",
  "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=300&q=80",
  "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=300&q=80",
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300&q=80",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=300&q=80",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&q=80",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=300&q=80",
  "https://images.unsplash.com/photo-1523961131990-5ea7c61b2107?w=300&q=80",
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=300&q=80",
];

const lerp = (start, end, t) => start * (1 - t) + end * t;

export default function ScrollMorphHero() {
  const navigate = useNavigate();
  const [introPhase,    setIntroPhase]    = useState("scatter");
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    ro.observe(containerRef.current);
    setContainerSize({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
    return () => ro.disconnect();
  }, []);

  const virtualScroll = useMotionValue(0);
  const scrollRef     = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      // Release page scroll once max is reached and scrolling down
      if (scrollRef.current >= MAX_SCROLL && e.deltaY > 0) return;
      e.preventDefault();
      const next = Math.min(Math.max(scrollRef.current + e.deltaY, 0), MAX_SCROLL);
      scrollRef.current = next;
      virtualScroll.set(next);
    };

    let touchStartY = 0;
    const handleTouchStart = (e) => { touchStartY = e.touches[0].clientY; };
    const handleTouchMove  = (e) => {
      const delta = touchStartY - e.touches[0].clientY;
      touchStartY = e.touches[0].clientY;
      const next = Math.min(Math.max(scrollRef.current + delta, 0), MAX_SCROLL);
      scrollRef.current = next;
      virtualScroll.set(next);
    };

    container.addEventListener("wheel",       handleWheel,      { passive: false });
    container.addEventListener("touchstart",  handleTouchStart, { passive: false });
    container.addEventListener("touchmove",   handleTouchMove,  { passive: false });
    return () => {
      container.removeEventListener("wheel",      handleWheel);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove",  handleTouchMove);
    };
  }, [virtualScroll]);

  const morphProgress      = useTransform(virtualScroll, [0, 600],  [0, 1]);
  const smoothMorph        = useSpring(morphProgress,   { stiffness: 40, damping: 20 });
  const scrollRotate       = useTransform(virtualScroll, [600, 3000], [0, 360]);
  const smoothScrollRotate = useSpring(scrollRotate,    { stiffness: 40, damping: 20 });

  const mouseX       = useMotionValue(0);
  const smoothMouseX = useSpring(mouseX, { stiffness: 30, damping: 20 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onMove = (e) => {
      const rect = container.getBoundingClientRect();
      const norm = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseX.set(norm * 100);
    };
    container.addEventListener("mousemove", onMove);
    return () => container.removeEventListener("mousemove", onMove);
  }, [mouseX]);

  useEffect(() => {
    const t1 = setTimeout(() => setIntroPhase("line"),   500);
    const t2 = setTimeout(() => setIntroPhase("circle"), 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const scatterPositions = useMemo(() =>
    IMAGES.map(() => ({
      x: (Math.random() - 0.5) * 1500,
      y: (Math.random() - 0.5) * 1000,
      rotation: (Math.random() - 0.5) * 180,
      scale: 0.6,
      opacity: 0,
    })),
  []);

  const [morphValue,    setMorphValue]    = useState(0);
  const [rotateValue,   setRotateValue]   = useState(0);
  const [parallaxValue, setParallaxValue] = useState(0);

  useEffect(() => {
    const u1 = smoothMorph.on("change",        setMorphValue);
    const u2 = smoothScrollRotate.on("change", setRotateValue);
    const u3 = smoothMouseX.on("change",       setParallaxValue);
    return () => { u1(); u2(); u3(); };
  }, [smoothMorph, smoothScrollRotate, smoothMouseX]);

  const contentOpacity = useTransform(smoothMorph, [0.8, 1], [0, 1]);
  const contentY       = useTransform(smoothMorph, [0.8, 1], [20, 0]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen overflow-hidden"
      style={{ background: "#050507" }}
    >
      <div className="flex h-full w-full flex-col items-center justify-center" style={{ perspective: "1000px" }}>

        {/* Intro text */}
        <div className="absolute z-0 flex flex-col items-center justify-center text-center pointer-events-none top-1/2 -translate-y-1/2">
          <motion.h1
            initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
            animate={
              introPhase === "circle" && morphValue < 0.5
                ? { opacity: 1 - morphValue * 2, y: 0, filter: "blur(0px)" }
                : { opacity: 0, filter: "blur(10px)" }
            }
            transition={{ duration: 1 }}
            className="text-2xl md:text-4xl font-bold tracking-tight text-white"
          >
            L'Afrique construit sur l\'IA.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={
              introPhase === "circle" && morphValue < 0.5
                ? { opacity: 0.5 - morphValue }
                : { opacity: 0 }
            }
            transition={{ duration: 1, delay: 0.2 }}
            className="mt-4 text-xs font-bold tracking-[0.25em] text-violet-400 uppercase"
          >
            Défiler pour explorer
          </motion.p>
        </div>

        {/* Arc active content */}
        <motion.div
          style={{ opacity: contentOpacity, y: contentY }}
          className="absolute top-[8%] z-10 flex flex-col items-center justify-center text-center pointer-events-none px-6"
        >
          <span className="inline-block text-[10px] text-violet-400 tracking-[0.3em] uppercase mb-4">
            L'écosystème intelligent pour l\'Afrique
          </span>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4 leading-tight">
            Une plateforme.{' '}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Plusieurs intelligences.
            </span>
          </h2>
          <p className="text-sm md:text-base text-white/50 max-w-lg leading-relaxed mb-6">
            Construis, automatise et fais évoluer ton business avec une seule infrastructure IA.
          </p>
          <div className="pointer-events-auto flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate('/cimolace/configurateur')}
              className="inline-flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold text-sm rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-violet-500/25"
            >
              Commencer maintenant →
            </button>
            <button
              onClick={() => navigate('/cimolace/about')}
              className="inline-flex items-center gap-2 px-7 py-3 bg-white/5 border border-white/10 text-white font-semibold text-sm rounded-xl hover:bg-white/10 transition-colors"
            >
              Découvrir CIMOLACE
            </button>
          </div>
        </motion.div>

        {/* Cards */}
        <div className="relative flex items-center justify-center w-full h-full">
          {IMAGES.slice(0, TOTAL_IMAGES).map((src, i) => {
            let target = { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 };

            if (introPhase === "scatter") {
              target = scatterPositions[i];
            } else if (introPhase === "line") {
              const lineSpacing   = 70;
              const lineTotalWidth = TOTAL_IMAGES * lineSpacing;
              target = { x: i * lineSpacing - lineTotalWidth / 2, y: 0, rotation: 0, scale: 1, opacity: 1 };
            } else {
              const isMobile     = containerSize.width < 768;
              const minDimension = Math.min(containerSize.width, containerSize.height);

              const circleRadius = Math.min(minDimension * 0.35, 350);
              const circleAngle  = (i / TOTAL_IMAGES) * 360;
              const circleRad    = (circleAngle * Math.PI) / 180;
              const circlePos    = {
                x: Math.cos(circleRad) * circleRadius,
                y: Math.sin(circleRad) * circleRadius,
                rotation: circleAngle + 90,
              };

              const baseRadius    = Math.min(containerSize.width, containerSize.height * 1.5);
              const arcRadius     = baseRadius * (isMobile ? 1.4 : 1.1);
              const arcApexY      = containerSize.height * (isMobile ? 0.35 : 0.25);
              const arcCenterY    = arcApexY + arcRadius;
              const spreadAngle   = isMobile ? 100 : 130;
              const startAngle    = -90 - spreadAngle / 2;
              const step          = spreadAngle / (TOTAL_IMAGES - 1);

              const scrollProgress  = Math.min(Math.max(rotateValue / 360, 0), 1);
              const maxRotation     = spreadAngle * 0.8;
              const boundedRotation = -scrollProgress * maxRotation;
              const currentArcAngle = startAngle + i * step + boundedRotation;
              const arcRad          = (currentArcAngle * Math.PI) / 180;

              const arcPos = {
                x: Math.cos(arcRad) * arcRadius + parallaxValue,
                y: Math.sin(arcRad) * arcRadius + arcCenterY,
                rotation: currentArcAngle + 90,
                scale: isMobile ? 1.4 : 1.8,
              };

              target = {
                x:        lerp(circlePos.x,        arcPos.x,        morphValue),
                y:        lerp(circlePos.y,        arcPos.y,        morphValue),
                rotation: lerp(circlePos.rotation, arcPos.rotation, morphValue),
                scale:    lerp(1,                  arcPos.scale,    morphValue),
                opacity:  1,
              };
            }

            return <FlipCard key={i} src={src} index={i} total={TOTAL_IMAGES} phase={introPhase} target={target} />;
          })}
        </div>
      </div>
    </div>
  );
}
