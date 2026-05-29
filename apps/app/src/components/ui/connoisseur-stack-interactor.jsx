import { useEffect, useRef, useState, useLayoutEffect } from "react";
import gsap from "gsap";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const defaultItems = [
  {
    num: "01",
    name: "L'étincelle",
    year: "2020",
    text: "NGOWAZULU identifie le gouffre entre l'ambition entrepreneuriale africaine et les outils disponibles.",
    clipId: "clip-original",
    image: "/brad-studio.webp",
    accent: "#8b5cf6",
  },
  {
    num: "02",
    name: "Les modules",
    year: "2021",
    text: "Virtuel Mbolo et Payflow Africa prennent forme. Vendre et encaisser sur le continent, enfin.",
    clipId: "clip-hexagons",
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80",
    accent: "#06b6d4",
  },
  {
    num: "03",
    name: "L'intelligence",
    year: "2022",
    text: "LIRI AI Core intégré. CIMOLACE cesse d'être un outil pour devenir une infrastructure intelligente.",
    clipId: "clip-pixels",
    image: "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800&q=80",
    accent: "#8b5cf6",
  },
  {
    num: "04",
    name: "L'écosystème",
    year: "2023",
    text: "10 modules interconnectés. Formation, événement, live, automatisation — tout dans un seul système.",
    clipId: "clip-bento",
    image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80",
    accent: "#06b6d4",
  },
  {
    num: "05",
    name: "Le déploiement",
    year: "2024",
    text: "CIMOLACE s'ouvre au marché. Des milliers d'entrepreneurs ont l'infrastructure qu'ils méritaient.",
    clipId: "clip-diamonds",
    image: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&q=80",
    accent: "#f59e0b",
  },
];

export const ConnoisseurStackInteractor = ({ items = defaultItems, className }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const mainGroupRef = useRef(null);
  const masterTl = useRef(null);

  const createLoop = (index) => {
    const item = items[index];
    const selector = `#${item.clipId} .path`;

    if (masterTl.current) masterTl.current.kill();

    if (imageRef.current) imageRef.current.setAttribute("href", item.image);
    if (mainGroupRef.current)
      mainGroupRef.current.setAttribute("clip-path", `url(#${item.clipId})`);

    gsap.set(selector, { scale: 0, transformOrigin: "50% 50%" });

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1 });
    tl.to(selector, {
      scale: 1,
      duration: 0.8,
      stagger: { amount: 0.4, from: "random" },
      ease: "expo.out",
    })
      .to(selector, {
        scale: 1.05,
        duration: 1.5,
        yoyo: true,
        repeat: 1,
        ease: "sine.inOut",
        stagger: { amount: 0.2, from: "center" },
      })
      .to(selector, {
        scale: 0,
        duration: 0.6,
        stagger: { amount: 0.3, from: "edges" },
        ease: "expo.in",
      });

    masterTl.current = tl;
  };

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      createLoop(0);
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const handleItemHover = (index) => {
    if (index === activeIndex) return;
    setActiveIndex(index);
    createLoop(index);
  };

  const active = items[activeIndex];

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col lg:flex-row items-center justify-between w-full gap-12 lg:gap-0",
        className
      )}
    >
      {/* LEFT — menu */}
      <div className="z-20 w-full lg:w-1/2">
        <nav>
          <ul className="flex flex-col gap-8">
            {items.map((item, index) => (
              <li
                key={item.num}
                onMouseEnter={() => handleItemHover(index)}
                className="group cursor-pointer"
              >
                <div className="flex items-start gap-5">
                  <span
                    className="text-2xl font-bold transition-all duration-500 mt-1.5 tabular-nums"
                    style={{
                      color: activeIndex === index ? item.accent : "rgba(255,255,255,0.2)",
                    }}
                  >
                    {item.num}
                  </span>
                  <div className="flex flex-col">
                    <span
                      className="text-xs tracking-[0.28em] uppercase mb-1 transition-all duration-500"
                      style={{
                        color: activeIndex === index ? item.accent : "rgba(255,255,255,0.25)",
                      }}
                    >
                      {item.year}
                    </span>
                    <h2
                      className={cn(
                        "text-4xl lg:text-5xl font-black uppercase tracking-tighter leading-[0.9] transition-all duration-700",
                        activeIndex === index
                          ? "text-white opacity-100 translate-x-3"
                          : "opacity-30 translate-x-0 text-white"
                      )}
                    >
                      {item.name.split(" ")[0]}
                      <br />
                      {item.name.split(" ").slice(1).join(" ")}
                    </h2>
                    {activeIndex === index && (
                      <p className="text-sm text-white/50 mt-3 leading-relaxed max-w-xs transition-all duration-500">
                        {item.text}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* RIGHT — animated SVG image */}
      <div className="relative w-full lg:w-1/2 flex justify-center items-center">
        <div
          className="absolute w-[80%] h-[80%] blur-[100px] rounded-full transition-all duration-1000 opacity-20"
          style={{ backgroundColor: active.accent }}
        />
        <svg
          viewBox="0 0 500 500"
          className="w-full max-w-[440px] h-auto z-10"
        >
          <defs>
            <clipPath id="clip-original">
              <path className="path" d="M480.6,235H19.4c-6,0-10.8-4.9-10.8-10.8v-9.5c0-6,4.9-10.8,10.8-10.8h461.1c6,0,10.8,4.9,10.8,10.8v9.5C491.4,230.2,486.6,235,480.6,235z" />
              <path className="path" d="M483.1,362.4H16.9c-4.6,0-8.3-3.7-8.3-8.3v-1.8c0-4.6,3.7-8.3,8.3-8.3h466.1c4.6,0,8.3,3.7,8.3,8.3v1.8C491.4,358.7,487.7,362.4,483.1,362.4z" />
              <path className="path" d="M460.3,336.3H39.7c-17.2,0-31.1-13.9-31.1-31.1v-31.5c0-17.2,13.9-31.1,31.1-31.1h420.7c17.2,0,31.1,13.9,31.1,31.1v31.5C491.4,322.4,477.5,336.3,460.3,336.3z" />
              <path className="path" d="M459.2,196.2H40.8v-35c0-47.5,38.5-86,86-86h246.5c47.5,0,86,38.5,86,86V196.2z" />
              <path className="path" d="M441.9,424.9H58.1c-9.6,0-17.3-7.8-17.3-17.3v-37.4h418.5v37.4C459.2,417.1,451.5,424.9,441.9,424.9z" />
            </clipPath>

            <clipPath id="clip-hexagons">
              <rect className="path" x="20" y="20" width="200" height="280" rx="12" />
              <rect className="path" x="20" y="320" width="200" height="160" rx="12" />
              <rect className="path" x="240" y="20" width="240" height="140" rx="12" />
              <rect className="path" x="240" y="180" width="110" height="160" rx="12" />
              <rect className="path" x="370" y="180" width="110" height="160" rx="12" />
              <rect className="path" x="240" y="360" width="240" height="120" rx="12" />
            </clipPath>

            <clipPath id="clip-pixels">
              {Array.from({ length: 9 }).map((_, i) => (
                <rect
                  key={i}
                  className="path"
                  x={(i % 3) * 160 + 20}
                  y={Math.floor(i / 3) * 160 + 20}
                  width="140"
                  height="140"
                  rx="4"
                />
              ))}
            </clipPath>

            <clipPath id="clip-bento">
              <rect className="path" x="20" y="20" width="460" height="200" rx="16" />
              <rect className="path" x="20" y="240" width="220" height="240" rx="16" />
              <rect className="path" x="260" y="240" width="220" height="110" rx="16" />
              <rect className="path" x="260" y="370" width="220" height="110" rx="16" />
            </clipPath>

            <clipPath id="clip-diamonds">
              <rect className="path" x="20" y="20" width="140" height="460" rx="8" />
              <rect className="path" x="180" y="20" width="140" height="220" rx="8" />
              <rect className="path" x="340" y="20" width="140" height="140" rx="8" />
              <rect className="path" x="180" y="260" width="140" height="220" rx="8" />
              <rect className="path" x="340" y="180" width="140" height="300" rx="8" />
            </clipPath>
          </defs>

          <g ref={mainGroupRef} clipPath={`url(#${items[0].clipId})`}>
            <image
              ref={imageRef}
              href={items[0].image}
              width="500"
              height="500"
              preserveAspectRatio="xMidYMid slice"
            />
          </g>
        </svg>
      </div>
    </div>
  );
};
