import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Link as LinkIcon, Zap, Brain, Hourglass, Network, Scale, GitBranch, Layers, Globe } from 'lucide-react';

// Timeline orbitale (d'après radial-orbital-timeline, 21st.dev) — JSX, charte PRORASCIENCE (or/sombre),
// carte/badge/bouton inline (pas de dépendance shadcn), cœur = portrait optionnel (`centerImage`).

// Les 8 grandes thèses du Manikongo, à faire graviter sur la page « À propos de l'auteur ».
export const FOUNDER_THESES = [
  { id: 1, title: 'La Conscience', date: 'Thèse I', category: 'Esprit', icon: Brain, status: 'completed', energy: 96, relatedIds: [2, 7], content: 'La conscience ne naît pas du cerveau, elle s’y manifeste. Le cerveau est une interface, non le générateur.' },
  { id: 2, title: 'La Mort', date: 'Thèse II', category: 'Transition', icon: Hourglass, status: 'completed', energy: 88, relatedIds: [1, 3], content: 'La mort est une transition informationnelle, pas une annihilation. Rien ne se perd, tout se transforme.' },
  { id: 3, title: 'La Mémoire', date: 'Thèse III', category: 'Lignée', icon: Network, status: 'in-progress', energy: 80, relatedIds: [2, 8], content: 'L’Être survit par la relation, non par la forme. L’oubli est la véritable seconde mort.' },
  { id: 4, title: 'Le Karma', date: 'Thèse IV', category: 'Causalité', icon: Scale, status: 'in-progress', energy: 74, relatedIds: [5], content: 'Le karma est le prix énergétique du destin : une loi mécanique de causalité, non une punition.' },
  { id: 5, title: 'Le Destin', date: 'Thèse V', category: 'Possible', icon: GitBranch, status: 'in-progress', energy: 68, relatedIds: [4, 6], content: 'Le destin est un effondrement localisé du possible. Nos choix solidifient une ligne temporelle.' },
  { id: 6, title: 'L’Énergie', date: 'Thèse VI', category: 'Force', icon: Zap, status: 'pending', energy: 62, relatedIds: [5], content: 'L’énergie est la résistance à l’impossible : la friction entre l’intention de l’esprit et la matière.' },
  { id: 7, title: 'La Trinité', date: 'Thèse VII', category: 'L’Être', icon: Layers, status: 'pending', energy: 84, relatedIds: [1], content: 'Corps, Âme, Esprit : trois technologies, un seul Être. L’Esprit guide l’Âme qui guide le Corps.' },
  { id: 8, title: 'Savoirs africains', date: 'Thèse VIII', category: 'Synthèse', icon: Globe, status: 'completed', energy: 92, relatedIds: [3], content: 'L’Afrique possède le paradigme de synthèse : une science de la complexité, initiatique et rationnelle.' },
];

export default function RadialOrbitalTimeline({ timelineData = FOUNDER_THESES, centerImage }) {
  const [expandedItems, setExpandedItems] = useState({});
  const [rotationAngle, setRotationAngle] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [pulseEffect, setPulseEffect] = useState({});
  const [activeNodeId, setActiveNodeId] = useState(null);
  const containerRef = useRef(null);
  const orbitRef = useRef(null);
  const nodeRefs = useRef({});

  const handleContainerClick = (e) => {
    if (e.target === containerRef.current || e.target === orbitRef.current) {
      setExpandedItems({});
      setActiveNodeId(null);
      setPulseEffect({});
      setAutoRotate(true);
    }
  };

  const getRelatedItems = (itemId) => {
    const current = timelineData.find((i) => i.id === itemId);
    return current ? current.relatedIds : [];
  };

  const centerViewOnNode = (nodeId) => {
    const idx = timelineData.findIndex((i) => i.id === nodeId);
    const target = (idx / timelineData.length) * 360;
    setRotationAngle(270 - target);
  };

  const toggleItem = (id) => {
    setExpandedItems((prev) => {
      const next = {};
      Object.keys(prev).forEach((k) => { next[parseInt(k, 10)] = false; });
      next[id] = !prev[id];
      if (!prev[id]) {
        setActiveNodeId(id);
        setAutoRotate(false);
        const pulses = {};
        getRelatedItems(id).forEach((rid) => { pulses[rid] = true; });
        setPulseEffect(pulses);
        centerViewOnNode(id);
      } else {
        setActiveNodeId(null);
        setAutoRotate(true);
        setPulseEffect({});
      }
      return next;
    });
  };

  useEffect(() => {
    let timer;
    if (autoRotate) {
      timer = setInterval(() => {
        setRotationAngle((prev) => Number(((prev + 0.3) % 360).toFixed(3)));
      }, 50);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [autoRotate]);

  const calculateNodePosition = (index, total) => {
    const angle = ((index / total) * 360 + rotationAngle) % 360;
    const radius = 200;
    const radian = (angle * Math.PI) / 180;
    const x = radius * Math.cos(radian);
    const y = radius * Math.sin(radian);
    const zIndex = Math.round(100 + 50 * Math.cos(radian));
    const opacity = Math.max(0.4, Math.min(1, 0.4 + 0.6 * ((1 + Math.sin(radian)) / 2)));
    return { x, y, zIndex, opacity };
  };

  const isRelatedToActive = (itemId) => {
    if (!activeNodeId) return false;
    return getRelatedItems(activeNodeId).includes(itemId);
  };

  return (
    <div
      className="relative flex h-full min-h-[600px] w-full flex-col items-center justify-center overflow-hidden"
      ref={containerRef}
      onClick={handleContainerClick}
      style={{ background: 'var(--bg)' }}
    >
      <div className="relative flex h-full w-full max-w-4xl items-center justify-center">
        <div className="absolute flex h-full w-full items-center justify-center" ref={orbitRef} style={{ perspective: '1000px' }}>
          {/* Cœur : portrait ou orbe doré */}
          <div className="absolute z-10 flex h-32 w-32 items-center justify-center rounded-full">
            <div className="absolute h-40 w-40 animate-ping rounded-full border opacity-60" style={{ borderColor: 'rgba(216,180,104,0.35)' }} />
            <div className="absolute h-48 w-48 animate-ping rounded-full border opacity-40" style={{ borderColor: 'rgba(216,180,104,0.18)', animationDelay: '0.6s' }} />
            {centerImage ? (
              <div className="h-32 w-32 overflow-hidden rounded-full border-2 shadow-lg" style={{ borderColor: 'var(--gold)', boxShadow: '0 0 45px rgba(216,180,104,0.5)' }}>
                <img src={centerImage} alt="Le Manikongo" className="h-full w-full object-cover object-top" />
              </div>
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-full" style={{ background: 'radial-gradient(circle at 30% 30%, #e7cd8f, #bf9a4f 70%)', boxShadow: '0 0 45px rgba(216,180,104,0.5)' }}>
                <div className="h-12 w-12 rounded-full" style={{ background: 'rgba(255,255,255,0.85)' }} />
              </div>
            )}
          </div>

          {/* Anneau d'orbite */}
          <div className="absolute h-96 w-96 rounded-full border" style={{ borderColor: 'var(--border)' }} />

          {timelineData.map((item, index) => {
            const pos = calculateNodePosition(index, timelineData.length);
            const isExpanded = expandedItems[item.id];
            const isRelated = isRelatedToActive(item.id);
            const isPulsing = pulseEffect[item.id];
            const Icon = item.icon;
            const nodeStyle = {
              transform: `translate(${pos.x}px, ${pos.y}px)`,
              zIndex: isExpanded ? 200 : pos.zIndex,
              opacity: isExpanded ? 1 : pos.opacity,
            };

            return (
              <div
                key={item.id}
                ref={(el) => { nodeRefs.current[item.id] = el; }}
                className="absolute cursor-pointer transition-all duration-700"
                style={nodeStyle}
                onClick={(e) => { e.stopPropagation(); toggleItem(item.id); }}
              >
                <div
                  className={`absolute rounded-full -inset-1 ${isPulsing ? 'animate-pulse' : ''}`}
                  style={{
                    background: 'radial-gradient(circle, rgba(216,180,104,0.25) 0%, rgba(216,180,104,0) 70%)',
                    width: `${item.energy * 0.5 + 40}px`,
                    height: `${item.energy * 0.5 + 40}px`,
                    left: `-${(item.energy * 0.5) / 2}px`,
                    top: `-${(item.energy * 0.5) / 2}px`,
                  }}
                />
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all duration-300"
                  style={{
                    background: isExpanded ? 'var(--gold)' : isRelated ? 'rgba(216,180,104,0.45)' : 'var(--panel)',
                    color: isExpanded || isRelated ? '#0d0b09' : 'var(--fg)',
                    borderColor: isExpanded ? 'var(--gold)' : isRelated ? 'var(--gold)' : 'rgba(216,180,104,0.4)',
                    transform: isExpanded ? 'scale(1.4)' : 'scale(1)',
                    boxShadow: isExpanded ? '0 0 20px rgba(216,180,104,0.4)' : 'none',
                  }}
                >
                  <Icon size={16} />
                </div>
                <div
                  className="absolute top-12 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.15em] transition-all duration-300"
                  style={{ color: isExpanded ? 'var(--fg)' : 'var(--muted)', transform: isExpanded ? 'translateX(-50%) scale(1.1)' : 'translateX(-50%)' }}
                >
                  {item.title}
                </div>

                {isExpanded && (
                  <div className="absolute top-20 left-1/2 w-72 -translate-x-1/2 overflow-visible rounded-xl border p-5 shadow-2xl backdrop-blur-lg" style={{ background: 'rgba(22,18,12,0.96)', borderColor: 'rgba(216,180,104,0.35)' }}>
                    <div className="absolute -top-3 left-1/2 h-3 w-px -translate-x-1/2" style={{ background: 'var(--gold)' }} />
                    <div className="flex items-center justify-between">
                      <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gold)', borderColor: 'rgba(216,180,104,0.4)' }}>
                        {item.category}
                      </span>
                      <span className="font-mono text-[10px]" style={{ color: 'var(--muted2)' }}>{item.date}</span>
                    </div>
                    <h3 className="mq-display mt-3 text-lg font-semibold" style={{ color: 'var(--fg)' }}>{item.title}</h3>
                    <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>{item.content}</p>

                    <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                      <div className="mb-1 flex items-center justify-between text-[11px]" style={{ color: 'var(--muted)' }}>
                        <span className="flex items-center gap-1"><Zap size={10} /> Intensité</span>
                        <span className="font-mono">{item.energy}%</span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                        <div className="h-full rounded-full" style={{ width: `${item.energy}%`, background: 'linear-gradient(90deg, #bf9a4f, #e7cd8f)' }} />
                      </div>
                    </div>

                    {item.relatedIds.length > 0 && (
                      <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                        <div className="mb-2 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                          <LinkIcon size={10} /> Notions liées
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {item.relatedIds.map((rid) => {
                            const rel = timelineData.find((i) => i.id === rid);
                            return (
                              <button
                                key={rid}
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleItem(rid); }}
                                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-all hover:brightness-110"
                                style={{ borderColor: 'rgba(216,180,104,0.3)', color: 'var(--muted)', background: 'transparent' }}
                              >
                                {rel?.title}
                                <ArrowRight size={9} style={{ color: 'var(--gold)' }} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
