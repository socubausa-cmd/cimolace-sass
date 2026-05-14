import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import './full-screen-scroll-fx.css';

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export const FullScreenScrollFX = forwardRef(
  (
    {
      sections,
      className,
      style,
      fontFamily = '"Rubik Wide", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
      header,
      footer,
      gap = 1,
      gridPaddingX = 2,
      showProgress = true,
      debug = false,
      durations = { change: 0.7, snap: 800 },
      reduceMotion,
      bgTransition = "fade",
      parallaxAmount = 4,
      currentIndex,
      onIndexChange,
      initialIndex = 0,
      colors = {
        text: "rgba(245,245,245,0.92)",
        overlay: "rgba(0,0,0,0.35)",
        pageBg: "#0a0a0f",
        stageBg: "#000000",
      },
      apiRef,
      ariaLabel = "Full screen scroll slideshow",
    },
    ref
  ) => {
    const total = sections.length;
    const [localIndex, setLocalIndex] = useState(clamp(initialIndex, 0, Math.max(0, total - 1)));
    const isControlled = typeof currentIndex === "number";
    const index = isControlled ? clamp(currentIndex, 0, Math.max(0, total - 1)) : localIndex;

    const rootRef        = useRef(null);
    const fixedRef       = useRef(null);
    const fixedSectionRef= useRef(null);
    const bgRefs         = useRef([]);
    const wordRefs       = useRef([]);
    const leftTrackRef   = useRef(null);
    const rightTrackRef  = useRef(null);
    const leftItemRefs   = useRef([]);
    const rightItemRefs  = useRef([]);
    const progressFillRef    = useRef(null);
    const currentNumberRef   = useRef(null);
    const stRef              = useRef(null);
    const lastIndexRef       = useRef(index);
    const isAnimatingRef     = useRef(false);
    const isSnappingRef      = useRef(false);
    const sectionTopRef      = useRef([]);

    const prefersReduced = useMemo(() => {
      if (typeof window === "undefined") return false;
      return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    }, []);
    const motionOff = reduceMotion ?? prefersReduced;

    const tempWordBucket = useRef([]);

    const splitWords = (text) => {
      const words = text.split(/\s+/).filter(Boolean);
      return words.map((w, i) => (
        <span className="fx-word-mask" key={i}>
          <span className="fx-word" ref={(el) => el && tempWordBucket.current.push(el)}>{w}</span>
          {i < words.length - 1 ? " " : null}
        </span>
      ));
    };

    const WordsCollector = ({ onReady }) => {
      useEffect(() => { onReady(); }, []); // eslint-disable-line
      return null;
    };

    const computePositions = () => {
      const el = fixedSectionRef.current;
      if (!el) return;
      const top = el.offsetTop;
      const h   = el.offsetHeight;
      const arr = [];
      for (let i = 0; i < total; i++) arr.push(top + (h * i) / total);
      sectionTopRef.current = arr;
    };

    const measureRAF = (fn) => {
      if (typeof window === "undefined") return;
      requestAnimationFrame(() => requestAnimationFrame(fn));
    };

    const measureAndCenterLists = (toIndex = index, animate = true) => {
      const centerTrack = (container, items, trackRef) => {
        if (!container || items.length === 0 || !trackRef.current) return;
        const first  = items[0];
        const second = items[1];
        const contRect = container.getBoundingClientRect();
        let rowH = first.getBoundingClientRect().height;
        if (second) rowH = second.getBoundingClientRect().top - first.getBoundingClientRect().top;
        const targetY = contRect.height / 2 - rowH / 2 - toIndex * rowH;
        if (animate) {
          gsap.to(trackRef.current, { y: targetY, duration: (durations.change ?? 0.7) * 0.9, ease: "power3.out" });
        } else {
          gsap.set(trackRef.current, { y: targetY });
        }
      };
      measureRAF(() => {
        measureRAF(() => {
          centerTrack(leftTrackRef.current, leftItemRefs.current, leftTrackRef);
          centerTrack(rightTrackRef.current, rightItemRefs.current, rightTrackRef);
        });
      });
    };

    const changeSection = (to) => {
      if (to === lastIndexRef.current || isAnimatingRef.current) return;
      const from = lastIndexRef.current;
      const down = to > from;
      isAnimatingRef.current = true;

      if (!isControlled) setLocalIndex(to);
      onIndexChange?.(to);

      if (currentNumberRef.current) currentNumberRef.current.textContent = String(to + 1).padStart(2, "0");
      if (progressFillRef.current) progressFillRef.current.style.width = `${(to / (total - 1 || 1)) * 100}%`;

      const D = durations.change ?? 0.7;

      const outWords = wordRefs.current[from] || [];
      const inWords  = wordRefs.current[to]   || [];
      if (outWords.length) gsap.to(outWords, { yPercent: down ? -100 : 100, opacity: 0, duration: D * 0.6, stagger: down ? 0.03 : -0.03, ease: "power3.out" });
      if (inWords.length) {
        gsap.set(inWords, { yPercent: down ? 100 : -100, opacity: 0 });
        gsap.to(inWords, { yPercent: 0, opacity: 1, duration: D, stagger: down ? 0.05 : -0.05, ease: "power3.out" });
      }

      const prevBg = bgRefs.current[from];
      const newBg  = bgRefs.current[to];
      if (bgTransition === "fade") {
        if (newBg)  { gsap.set(newBg, { opacity: 0, scale: 1.04, yPercent: down ? 1 : -1 }); gsap.to(newBg,  { opacity: 1, scale: 1, yPercent: 0, duration: D, ease: "power2.out" }); }
        if (prevBg) gsap.to(prevBg, { opacity: 0, yPercent: down ? -parallaxAmount : parallaxAmount, duration: D, ease: "power2.out" });
      } else {
        if (newBg)  { gsap.set(newBg, { opacity: 1, clipPath: down ? "inset(100% 0 0 0)" : "inset(0 0 100% 0)", scale: 1, yPercent: 0 }); gsap.to(newBg, { clipPath: "inset(0 0 0 0)", duration: D, ease: "power3.out" }); }
        if (prevBg) gsap.to(prevBg, { opacity: 0, duration: D * 0.8, ease: "power2.out" });
      }

      measureAndCenterLists(to, true);

      leftItemRefs.current.forEach((el, i) => {
        el.classList.toggle("active", i === to);
        gsap.to(el, { opacity: i === to ? 1 : 0.35, x: i === to ? 10 : 0, duration: D * 0.6, ease: "power3.out" });
      });
      rightItemRefs.current.forEach((el, i) => {
        el.classList.toggle("active", i === to);
        gsap.to(el, { opacity: i === to ? 1 : 0.35, x: i === to ? -10 : 0, duration: D * 0.6, ease: "power3.out" });
      });

      gsap.delayedCall(D, () => { lastIndexRef.current = to; isAnimatingRef.current = false; });
    };

    const goTo = (to, withScroll = true) => {
      const clamped = clamp(to, 0, total - 1);
      isSnappingRef.current = true;
      changeSection(clamped);
      const pos    = sectionTopRef.current[clamped];
      const snapMs = durations.snap ?? 800;
      if (withScroll && typeof window !== "undefined") {
        window.scrollTo({ top: pos, behavior: "smooth" });
        setTimeout(() => (isSnappingRef.current = false), snapMs);
      } else {
        setTimeout(() => (isSnappingRef.current = false), 10);
      }
    };

    const next = () => goTo(index + 1);
    const prev = () => goTo(index - 1);

    useImperativeHandle(apiRef, () => ({ next, prev, goTo, getIndex: () => index, refresh: () => ScrollTrigger.refresh() }));

    useLayoutEffect(() => {
      if (typeof window === "undefined") return;
      const fixed = fixedRef.current;
      const fs    = fixedSectionRef.current;
      if (!fixed || !fs || total === 0) return;

      gsap.set(bgRefs.current, { opacity: 0, scale: 1.04, yPercent: 0 });
      if (bgRefs.current[0]) gsap.set(bgRefs.current[0], { opacity: 1, scale: 1 });

      wordRefs.current.forEach((words, sIdx) => {
        words?.forEach((w) => gsap.set(w, { yPercent: sIdx === index ? 0 : 100, opacity: sIdx === index ? 1 : 0 }));
      });

      computePositions();
      measureAndCenterLists(index, false);

      const st = ScrollTrigger.create({
        trigger: fs,
        start: "top top",
        end: "bottom bottom",
        pin: fixed,
        pinSpacing: true,
        onUpdate: (self) => {
          if (motionOff || isSnappingRef.current) return;
          const target = Math.min(total - 1, Math.floor(self.progress * total));
          if (target !== lastIndexRef.current && !isAnimatingRef.current) {
            goTo(lastIndexRef.current + (target > lastIndexRef.current ? 1 : -1), false);
          }
          if (progressFillRef.current) {
            progressFillRef.current.style.width = `${(lastIndexRef.current / (total - 1 || 1)) * 100}%`;
          }
        },
      });

      stRef.current = st;
      if (initialIndex > 0 && initialIndex < total) requestAnimationFrame(() => goTo(initialIndex, false));

      const ro = new ResizeObserver(() => { computePositions(); measureAndCenterLists(lastIndexRef.current, false); ScrollTrigger.refresh(); });
      ro.observe(fs);

      return () => { ro.disconnect(); st.kill(); stRef.current = null; };
    }, [total, initialIndex, motionOff, bgTransition, parallaxAmount]); // eslint-disable-line

    useEffect(() => {
      leftItemRefs.current.forEach((el, i) => gsap.fromTo(el, { opacity: 0, y: 20 }, { opacity: i === index ? 1 : 0.35, y: 0, duration: 0.5, delay: i * 0.06, ease: "power3.out" }));
      rightItemRefs.current.forEach((el, i) => gsap.fromTo(el, { opacity: 0, y: 20 }, { opacity: i === index ? 1 : 0.35, y: 0, duration: 0.5, delay: 0.2 + i * 0.06, ease: "power3.out" }));
      measureAndCenterLists(index, false);
    }, []); // eslint-disable-line

    const cssVars = {
      "--fx-font":     fontFamily,
      "--fx-text":     colors.text     ?? "rgba(245,245,245,0.92)",
      "--fx-overlay":  colors.overlay  ?? "rgba(0,0,0,0.35)",
      "--fx-page-bg":  colors.pageBg   ?? "#0a0a0f",
      "--fx-stage-bg": colors.stageBg  ?? "#000",
      "--fx-gap":      `${gap}rem`,
      "--fx-grid-px":  `${gridPaddingX}rem`,
      "--fx-row-gap":  "10px",
    };

    return (
      <div
        ref={(node) => {
          rootRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        className={["fx", className].filter(Boolean).join(" ")}
        style={{ ...cssVars, ...style }}
        aria-label={ariaLabel}
      >
        {debug && <div className="fx-debug">Section: {index}</div>}

        <div className="fx-scroll">
          {/* Tall scrollable region — height drives how many sections the pin spans */}
          <div
            className="fx-fixed-section"
            ref={fixedSectionRef}
            style={{ height: `${Math.max(1, total + 1) * 100}vh` }}
          >
            <div className="fx-fixed" ref={fixedRef}>
              {/* Backgrounds */}
              <div className="fx-bgs" aria-hidden="true">
                {sections.map((s, i) => (
                  <div className="fx-bg" key={s.id ?? i}>
                    {s.renderBackground ? s.renderBackground(index === i, lastIndexRef.current === i) : (
                      <>
                        <img ref={(el) => el && (bgRefs.current[i] = el)} src={s.background} alt="" className="fx-bg-img" />
                        <div className="fx-bg-overlay" />
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div className="fx-grid">
                {header && <div className="fx-header">{header}</div>}

                <div className="fx-content">
                  {/* Left list */}
                  <div className="fx-left" role="list">
                    <div className="fx-track" ref={leftTrackRef}>
                      {sections.map((s, i) => (
                        <div key={`L-${s.id ?? i}`} className={`fx-item fx-left-item ${i === index ? "active" : ""}`} ref={(el) => el && (leftItemRefs.current[i] = el)} onClick={() => goTo(i)} role="button" tabIndex={0} aria-pressed={i === index}>
                          {s.leftLabel}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Center titles */}
                  <div className="fx-center">
                    {sections.map((s, sIdx) => {
                      tempWordBucket.current = [];
                      const isString = typeof s.title === "string";
                      return (
                        <div key={`C-${s.id ?? sIdx}`} className={`fx-featured ${sIdx === index ? "active" : ""}`}>
                          <h3 className="fx-featured-title">
                            {isString ? splitWords(s.title) : s.title}
                          </h3>
                          <WordsCollector onReady={() => {
                            if (tempWordBucket.current.length) wordRefs.current[sIdx] = [...tempWordBucket.current];
                            tempWordBucket.current = [];
                          }} />
                        </div>
                      );
                    })}
                  </div>

                  {/* Right list */}
                  <div className="fx-right" role="list">
                    <div className="fx-track" ref={rightTrackRef}>
                      {sections.map((s, i) => (
                        <div key={`R-${s.id ?? i}`} className={`fx-item fx-right-item ${i === index ? "active" : ""}`} ref={(el) => el && (rightItemRefs.current[i] = el)} onClick={() => goTo(i)} role="button" tabIndex={0} aria-pressed={i === index}>
                          {s.rightLabel}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer + progress */}
                <div className="fx-footer">
                  {footer && <div className="fx-footer-title">{footer}</div>}
                  {showProgress && (
                    <div className="fx-progress">
                      <div className="fx-progress-numbers">
                        <span ref={currentNumberRef}>{String(index + 1).padStart(2, "0")}</span>
                        <span>{String(total).padStart(2, "0")}</span>
                      </div>
                      <div className="fx-progress-bar">
                        <div className="fx-progress-fill" ref={progressFillRef} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="fx-end">
            <p className="fx-fin">fin</p>
          </div>
        </div>
      </div>
    );
  }
);

FullScreenScrollFX.displayName = "FullScreenScrollFX";
