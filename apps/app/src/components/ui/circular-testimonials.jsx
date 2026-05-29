import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function calculateGap(width) {
  const minWidth = 1024, maxWidth = 1456, minGap = 60, maxGap = 86;
  if (width <= minWidth) return minGap;
  if (width >= maxWidth) return Math.max(minGap, maxGap + 0.06018 * (width - maxWidth));
  return minGap + (maxGap - minGap) * ((width - minWidth) / (maxWidth - minWidth));
}

export const CircularTestimonials = ({
  testimonials,
  autoplay = true,
  colors = {},
  fontSizes = {},
}) => {
  const colorName         = colors.name             ?? "#ffffff";
  const colorDesignation  = colors.designation      ?? "#a1a1aa";
  const colorTestimony    = colors.testimony        ?? "#d4d4d8";
  const colorArrowBg      = colors.arrowBackground  ?? "#1e1e2e";
  const colorArrowFg      = colors.arrowForeground  ?? "#f1f1f7";
  const colorArrowHover   = colors.arrowHoverBackground ?? "#7c3aed";
  const fontSizeName       = fontSizes.name         ?? "1.5rem";
  const fontSizeDesignation= fontSizes.designation  ?? "0.925rem";
  const fontSizeQuote      = fontSizes.quote        ?? "1.125rem";

  const [activeIndex, setActiveIndex]   = useState(0);
  const [hoverPrev, setHoverPrev]       = useState(false);
  const [hoverNext, setHoverNext]       = useState(false);
  const [containerWidth, setContainerWidth] = useState(1200);

  const imageContainerRef  = useRef(null);
  const autoplayRef        = useRef(null);
  const len = useMemo(() => testimonials.length, [testimonials]);
  const active = useMemo(() => testimonials[activeIndex], [activeIndex, testimonials]);

  useEffect(() => {
    const handleResize = () => {
      if (imageContainerRef.current) setContainerWidth(imageContainerRef.current.offsetWidth);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (autoplay) {
      autoplayRef.current = setInterval(() => setActiveIndex(p => (p + 1) % len), 5000);
    }
    return () => { if (autoplayRef.current) clearInterval(autoplayRef.current); };
  }, [autoplay, len]);

  const handleNext = useCallback(() => {
    setActiveIndex(p => (p + 1) % len);
    if (autoplayRef.current) clearInterval(autoplayRef.current);
  }, [len]);

  const handlePrev = useCallback(() => {
    setActiveIndex(p => (p - 1 + len) % len);
    if (autoplayRef.current) clearInterval(autoplayRef.current);
  }, [len]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlePrev, handleNext]);

  const getImageStyle = (index) => {
    const gap = calculateGap(containerWidth);
    const maxStickUp = gap * 0.8;
    const isActive = index === activeIndex;
    const isLeft   = (activeIndex - 1 + len) % len === index;
    const isRight  = (activeIndex + 1) % len === index;
    const base = "all 0.8s cubic-bezier(.4,2,.3,1)";
    if (isActive) return { zIndex: 3, opacity: 1, pointerEvents: "auto", transform: "translateX(0px) translateY(0px) scale(1) rotateY(0deg)", transition: base };
    if (isLeft)   return { zIndex: 2, opacity: 1, pointerEvents: "auto", transform: `translateX(-${gap}px) translateY(-${maxStickUp}px) scale(0.85) rotateY(15deg)`, transition: base };
    if (isRight)  return { zIndex: 2, opacity: 1, pointerEvents: "auto", transform: `translateX(${gap}px) translateY(-${maxStickUp}px) scale(0.85) rotateY(-15deg)`, transition: base };
    return { zIndex: 1, opacity: 0, pointerEvents: "none", transition: base };
  };

  const quoteVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit:    { opacity: 0, y: -20 },
  };

  return (
    <div className="w-full max-w-4xl p-8">
      {/* Grid: image left, content right */}
      <div className="grid md:grid-cols-2 gap-16">

        {/* Image stack */}
        <div
          ref={imageContainerRef}
          className="relative w-full h-80 md:h-96"
          style={{ perspective: "1000px" }}
        >
          {testimonials.map((t, i) => (
            <img
              key={t.src}
              src={t.src}
              alt={t.name}
              className="absolute w-full h-full object-cover rounded-3xl shadow-2xl"
              style={getImageStyle(i)}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex flex-col justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              variants={quoteVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <h3 className="font-bold mb-1" style={{ color: colorName, fontSize: fontSizeName }}>
                {active.name}
              </h3>
              <p className="mb-8" style={{ color: colorDesignation, fontSize: fontSizeDesignation }}>
                {active.designation}
              </p>
              <p className="leading-7" style={{ color: colorTestimony, fontSize: fontSizeQuote }}>
                {active.quote.split(" ").map((word, i) => (
                  <motion.span
                    key={i}
                    initial={{ filter: "blur(10px)", opacity: 0, y: 5 }}
                    animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: "easeInOut", delay: 0.025 * i }}
                    style={{ display: "inline-block" }}
                  >
                    {word}&nbsp;
                  </motion.span>
                ))}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Arrow buttons */}
          <div className="flex gap-6 pt-12 md:pt-0">
            <button
              onClick={handlePrev}
              onMouseEnter={() => setHoverPrev(true)}
              onMouseLeave={() => setHoverPrev(false)}
              aria-label="Précédent"
              className="w-11 h-11 rounded-full flex items-center justify-center cursor-pointer border-0 outline-none flex-shrink-0 transition-colors duration-300"
              style={{ backgroundColor: hoverPrev ? colorArrowHover : colorArrowBg }}
            >
              <ArrowLeft size={20} color={colorArrowFg} />
            </button>
            <button
              onClick={handleNext}
              onMouseEnter={() => setHoverNext(true)}
              onMouseLeave={() => setHoverNext(false)}
              aria-label="Suivant"
              className="w-11 h-11 rounded-full flex items-center justify-center cursor-pointer border-0 outline-none flex-shrink-0 transition-colors duration-300"
              style={{ backgroundColor: hoverNext ? colorArrowHover : colorArrowBg }}
            >
              <ArrowRight size={20} color={colorArrowFg} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CircularTestimonials;
