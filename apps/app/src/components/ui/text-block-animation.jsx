import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useRef } from "react";

gsap.registerPlugin(ScrollTrigger);

export default function TextBlockAnimation({
  children,
  animateOnScroll = true,
  delay = 0,
  blockColor = "#5b3df5",
  stagger = 0.1,
  duration = 0.6,
}) {
  const containerRef = useRef(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;

      // Manual line split: wrap each child text block's lines
      const el = containerRef.current;

      // Get computed line-height to slice manually
      const style = window.getComputedStyle(el);
      const lineH = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4;

      // Measure and extract lines using a Range approach
      const textNodes = [];
      const walk = (node) => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
          textNodes.push(node);
        } else {
          node.childNodes.forEach(walk);
        }
      };
      walk(el);

      // Wrap each inline element or block in a line-clip wrapper
      const blockEls = Array.from(el.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,a,li'));
      const targets = blockEls.length ? blockEls : [el];

      const wrappers = [];
      const blocks = [];

      targets.forEach((line) => {
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "position:relative;display:block;overflow:hidden;";

        const block = document.createElement("div");
        block.style.cssText = `
          position:absolute;top:0;left:0;
          width:100%;height:100%;
          background-color:${blockColor};
          z-index:2;
          transform:scaleX(0);
          transform-origin:left center;
        `;

        line.parentNode.insertBefore(wrapper, line);
        wrapper.appendChild(line);
        wrapper.appendChild(block);

        gsap.set(line, { opacity: 0 });

        wrappers.push(wrapper);
        blocks.push(block);
      });

      const tl = gsap.timeline({
        defaults: { ease: "expo.inOut" },
        delay,
        scrollTrigger: animateOnScroll
          ? {
              trigger: containerRef.current,
              start: "top 85%",
              toggleActions: "play none none reverse",
            }
          : null,
      });

      tl.to(blocks, {
        scaleX: 1,
        duration,
        stagger,
        transformOrigin: "left center",
      })
        .set(
          targets,
          { opacity: 1, stagger },
          `<${duration / 2}`
        )
        .to(
          blocks,
          {
            scaleX: 0,
            duration,
            stagger,
            transformOrigin: "right center",
          },
          `<${duration * 0.4}`
        );
    },
    {
      scope: containerRef,
      dependencies: [animateOnScroll, delay, blockColor, stagger, duration],
    }
  );

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {children}
    </div>
  );
}
